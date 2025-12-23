/**
 * PerformanceOptimizer - Optimizes calendar operations for large datasets
 * Includes caching, lazy loading, and batch processing
 */

import { LRUCache } from './LRUCache.js';

export class PerformanceOptimizer {
  constructor(config = {}) {
    // Configuration
    this.config = {
      enableCache: true,
      cacheCapacity: 500,
      maxIndexDays: 365,
      batchSize: 100,
      enableMetrics: true,
      cleanupInterval: 3600000, // 1 hour in ms
      maxIndexAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      ...config
    };

    // Caches
    this.eventCache = new LRUCache(this.config.cacheCapacity);
    this.queryCache = new LRUCache(Math.floor(this.config.cacheCapacity / 2));
    this.dateRangeCache = new LRUCache(Math.floor(this.config.cacheCapacity / 4));

    // Lazy loading tracking
    this.lazyIndexes = new Map(); // eventId -> Set of date strings
    this.pendingIndexes = new Map(); // eventId -> Promise

    // Batch processing
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchCallbacks = [];

    // Performance metrics
    this.metrics = {
      operations: {},
      averageTimes: {},
      slowQueries: []
    };

    // Cleanup timer
    this.cleanupTimer = null;
    if (this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Measure operation performance
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to measure
   * @returns {*} Function result
   */
  measure(operation, fn) {
    if (!this.config.enableMetrics) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration, true);
      throw error;
    }
  }

  /**
   * Measure async operation performance
   * @param {string} operation - Operation name
   * @param {Function} fn - Async function to measure
   * @returns {Promise<*>} Function result
   */
  async measureAsync(operation, fn) {
    if (!this.config.enableMetrics) {
      return await fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration, true);
      throw error;
    }
  }

  /**
   * Record performance metric
   * @private
   */
  recordMetric(operation, duration, isError = false) {
    if (!this.metrics.operations[operation]) {
      this.metrics.operations[operation] = {
        count: 0,
        totalTime: 0,
        errors: 0,
        min: Infinity,
        max: 0
      };
    }

    const metric = this.metrics.operations[operation];
    metric.count++;
    metric.totalTime += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);

    if (isError) {
      metric.errors++;
    }

    // Update average
    this.metrics.averageTimes[operation] = metric.totalTime / metric.count;

    // Track slow queries
    if (duration > 100) {
      this.metrics.slowQueries.push({
        operation,
        duration,
        timestamp: new Date(),
        isError
      });

      // Keep only last 100 slow queries
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const summary = {
      cacheStats: {
        event: this.eventCache.getStats(),
        query: this.queryCache.getStats(),
        dateRange: this.dateRangeCache.getStats()
      },
      operations: {},
      slowestOperations: [],
      recentSlowQueries: this.metrics.slowQueries.slice(-10)
    };

    // Process operations
    for (const [op, data] of Object.entries(this.metrics.operations)) {
      summary.operations[op] = {
        count: data.count,
        avgTime: `${(data.totalTime / data.count).toFixed(2)}ms`,
        minTime: `${data.min.toFixed(2)}ms`,
        maxTime: `${data.max.toFixed(2)}ms`,
        totalTime: `${data.totalTime.toFixed(2)}ms`,
        errors: data.errors,
        errorRate: `${((data.errors / data.count) * 100).toFixed(2)}%`
      };
    }

    // Find slowest operations
    summary.slowestOperations = Object.entries(this.metrics.averageTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([op, time]) => ({
        operation: op,
        avgTime: `${time.toFixed(2)}ms`
      }));

    return summary;
  }

  /**
   * Check if event should use lazy indexing
   * @param {import('../events/Event.js').Event} event - Event to check
   * @returns {boolean} True if should use lazy indexing
   */
  shouldUseLazyIndexing(event) {
    const daySpan = Math.ceil(
      (event.end - event.start) / (24 * 60 * 60 * 1000)
    );
    return daySpan > this.config.maxIndexDays;
  }

  /**
   * Create lazy index markers for large events
   * @param {import('../events/Event.js').Event} event - Event to index
   * @returns {Object} Index boundaries
   */
  createLazyIndexMarkers(event) {
    const markers = {
      eventId: event.id,
      start: event.start,
      end: event.end,
      indexed: new Set(),
      pending: false
    };

    // Index first and last month only initially
    const startMonth = new Date(event.start.getFullYear(), event.start.getMonth(), 1);
    const endMonth = new Date(event.end.getFullYear(), event.end.getMonth(), 1);

    markers.indexed.add(this.getMonthKey(startMonth));
    if (this.getMonthKey(startMonth) !== this.getMonthKey(endMonth)) {
      markers.indexed.add(this.getMonthKey(endMonth));
    }

    this.lazyIndexes.set(event.id, markers);
    return markers;
  }

  /**
   * Expand lazy index for a specific date range
   * @param {string} eventId - Event ID
   * @param {Date} rangeStart - Start of range to index
   * @param {Date} rangeEnd - End of range to index
   * @returns {Promise<Set<string>>} Indexed date strings
   */
  async expandLazyIndex(eventId, rangeStart, rangeEnd) {
    const markers = this.lazyIndexes.get(eventId);
    if (!markers) {
      return new Set();
    }

    // Check if already pending
    if (markers.pending) {
      return this.pendingIndexes.get(eventId);
    }

    markers.pending = true;

    const promise = new Promise((resolve) => {
      // Simulate async indexing (in real app, could be in worker)
      setTimeout(() => {
        const indexed = new Set();
        const current = new Date(rangeStart);

        while (current <= rangeEnd) {
          const dateStr = current.toDateString();
          if (!markers.indexed.has(dateStr)) {
            indexed.add(dateStr);
            markers.indexed.add(dateStr);
          }
          current.setDate(current.getDate() + 1);
        }

        markers.pending = false;
        this.pendingIndexes.delete(eventId);
        resolve(indexed);
      }, 0);
    });

    this.pendingIndexes.set(eventId, promise);
    return promise;
  }

  /**
   * Get month key for date
   * @private
   */
  getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Cache event with TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {string} cacheType - Type of cache to use
   */
  cache(key, value, cacheType = 'event') {
    if (!this.config.enableCache) return;

    switch (cacheType) {
      case 'event':
        this.eventCache.put(key, value);
        break;
      case 'query':
        this.queryCache.put(key, value);
        break;
      case 'dateRange':
        this.dateRangeCache.put(key, value);
        break;
    }
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @param {string} cacheType - Type of cache
   * @returns {*} Cached value or undefined
   */
  getFromCache(key, cacheType = 'event') {
    if (!this.config.enableCache) return undefined;

    switch (cacheType) {
      case 'event':
        return this.eventCache.get(key);
      case 'query':
        return this.queryCache.get(key);
      case 'dateRange':
        return this.dateRangeCache.get(key);
      default:
        return undefined;
    }
  }

  /**
   * Invalidate caches for an event
   * @param {string} eventId - Event ID
   */
  invalidateEventCaches(eventId) {
    // Remove from event cache
    this.eventCache.delete(eventId);

    // Clear query cache (conservative approach)
    // In production, track which queries include this event
    this.queryCache.clear();
    this.dateRangeCache.clear();
  }

  /**
   * Batch operation for efficiency
   * @param {Function} operation - Operation to batch
   * @returns {Promise} Batch result
   */
  batch(operation) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push(operation);
      this.batchCallbacks.push({ resolve, reject });

      if (this.batchQueue.length >= this.config.batchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        // Process batch after 10ms if not full
        this.batchTimer = setTimeout(() => this.processBatch(), 10);
      }
    });
  }

  /**
   * Process batched operations
   * @private
   */
  processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.length === 0) return;

    const operations = this.batchQueue.splice(0);
    const callbacks = this.batchCallbacks.splice(0);

    // Process all operations
    const results = [];
    const errors = [];

    operations.forEach((op, index) => {
      try {
        results[index] = op();
      } catch (error) {
        errors[index] = error;
      }
    });

    // Resolve callbacks
    callbacks.forEach((callback, index) => {
      if (errors[index]) {
        callback.reject(errors[index]);
      } else {
        callback.resolve(results[index]);
      }
    });
  }

  /**
   * Start cleanup timer for old indexes
   * @private
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldIndexes();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up old indexes
   * @private
   */
  cleanupOldIndexes() {
    const now = Date.now();
    const maxAge = this.config.maxIndexAge;

    // Clean up lazy indexes for events that are too old
    for (const [eventId, markers] of this.lazyIndexes) {
      if (markers.end.getTime() < now - maxAge) {
        this.lazyIndexes.delete(eventId);
      }
    }

    // Clean up slow query log
    if (this.metrics.slowQueries.length > 100) {
      this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
    }
  }

  /**
   * Optimize query by checking cache first
   * @param {string} queryKey - Unique query identifier
   * @param {Function} queryFn - Function to execute if not cached
   * @returns {*} Query result
   */
  optimizeQuery(queryKey, queryFn) {
    // Check cache first
    const cached = this.getFromCache(queryKey, 'query');
    if (cached !== undefined) {
      return cached;
    }

    // Execute query and cache result
    const result = this.measure(`query:${queryKey}`, queryFn);
    this.cache(queryKey, result, 'query');
    return result;
  }

  /**
   * Destroy optimizer and clean up resources
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.eventCache.clear();
    this.queryCache.clear();
    this.dateRangeCache.clear();
    this.lazyIndexes.clear();
    this.pendingIndexes.clear();
  }
}