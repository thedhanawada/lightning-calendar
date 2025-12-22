import { Event } from './Event.js';
import { DateUtils } from '../calendar/DateUtils.js';
import { RecurrenceEngine } from './RecurrenceEngine.js';

/**
 * EventStore - Manages calendar events with efficient querying
 * Uses Map for O(1) lookups and spatial indexing concepts for date queries
 */
export class EventStore {
  constructor() {
    // Primary storage - Map for O(1) ID lookups
    /** @type {Map<string, Event>} */
    this.events = new Map();

    // Indices for efficient queries
    this.indices = {
      /** @type {Map<string, Set<string>>} Date string -> Set of event IDs */
      byDate: new Map(),
      /** @type {Map<string, Set<string>>} YYYY-MM -> Set of event IDs */
      byMonth: new Map(),
      /** @type {Set<string>} Set of recurring event IDs */
      recurring: new Set()
    };

    // Change tracking
    /** @type {number} */
    this.version = 0;
    /** @type {Set<import('../../types.js').EventListener>} */
    this.listeners = new Set();
  }

  /**
   * Add an event to the store
   * @param {Event|import('../../types.js').EventData} event - The event to add
   * @returns {Event} The added event
   * @throws {Error} If event with same ID already exists
   */
  addEvent(event) {
    if (!(event instanceof Event)) {
      event = new Event(event);
    }

    if (this.events.has(event.id)) {
      throw new Error(`Event with id ${event.id} already exists`);
    }

    // Store the event
    this.events.set(event.id, event);

    // Update indices
    this._indexEvent(event);

    // Notify listeners
    this._notifyChange({
      type: 'add',
      event,
      version: ++this.version
    });

    return event;
  }

  /**
   * Update an existing event
   * @param {string} eventId - The event ID
   * @param {Partial<import('../../types.js').EventData>} updates - Properties to update
   * @returns {Event} The updated event
   * @throws {Error} If event not found
   */
  updateEvent(eventId, updates) {
    const existingEvent = this.events.get(eventId);
    if (!existingEvent) {
      throw new Error(`Event with id ${eventId} not found`);
    }

    // Remove old indices
    this._unindexEvent(existingEvent);

    // Create updated event
    const updatedEvent = existingEvent.clone(updates);

    // Store updated event
    this.events.set(eventId, updatedEvent);

    // Re-index
    this._indexEvent(updatedEvent);

    // Notify listeners
    this._notifyChange({
      type: 'update',
      event: updatedEvent,
      oldEvent: existingEvent,
      version: ++this.version
    });

    return updatedEvent;
  }

  /**
   * Remove an event from the store
   * @param {string} eventId - The event ID to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeEvent(eventId) {
    const event = this.events.get(eventId);
    if (!event) {
      return false;
    }

    // Remove from primary storage
    this.events.delete(eventId);

    // Remove from indices
    this._unindexEvent(event);

    // Notify listeners
    this._notifyChange({
      type: 'remove',
      event,
      version: ++this.version
    });

    return true;
  }

  /**
   * Get an event by ID
   * @param {string} eventId - The event ID
   * @returns {Event|null} The event or null if not found
   */
  getEvent(eventId) {
    return this.events.get(eventId) || null;
  }

  /**
   * Get all events
   * @returns {Event[]} Array of all events
   */
  getAllEvents() {
    return Array.from(this.events.values());
  }

  /**
   * Query events with filters
   * @param {import('../../types.js').QueryFilters} [filters={}] - Query filters
   * @returns {Event[]} Filtered events
   */
  queryEvents(filters = {}) {
    let results = Array.from(this.events.values());

    // Filter by date range
    if (filters.start || filters.end) {
      const start = filters.start ? new Date(filters.start) : null;
      const end = filters.end ? new Date(filters.end) : null;

      results = results.filter(event => {
        if (start && event.end < start) return false;
        if (end && event.start > end) return false;
        return true;
      });
    }

    // Filter by specific date
    if (filters.date) {
      const date = new Date(filters.date);
      results = results.filter(event => event.occursOn(date));
    }

    // Filter by month
    if (filters.month && filters.year) {
      const monthKey = `${filters.year}-${String(filters.month).padStart(2, '0')}`;
      const eventIds = this.indices.byMonth.get(monthKey) || new Set();
      results = results.filter(event => eventIds.has(event.id));
    }

    // Filter by all-day events
    if (filters.hasOwnProperty('allDay')) {
      results = results.filter(event => event.allDay === filters.allDay);
    }

    // Filter by recurring
    if (filters.hasOwnProperty('recurring')) {
      results = results.filter(event => event.recurring === filters.recurring);
    }

    // Sort results
    if (filters.sort) {
      results.sort((a, b) => {
        switch (filters.sort) {
          case 'start':
            return a.start - b.start;
          case 'end':
            return a.end - b.end;
          case 'duration':
            return a.duration - b.duration;
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
    }

    return results;
  }

  /**
   * Get events for a specific date
   * @param {Date} date - The date to query
   * @returns {Event[]} Events occurring on the date, sorted by start time
   */
  getEventsForDate(date) {
    const dateStr = date.toDateString();
    const eventIds = this.indices.byDate.get(dateStr) || new Set();

    return Array.from(eventIds)
      .map(id => this.events.get(id))
      .filter(event => event) // Filter out any null values
      .sort((a, b) => {
        // Sort by start time, then by duration
        const timeCompare = a.start - b.start;
        if (timeCompare !== 0) return timeCompare;
        return b.duration - a.duration; // Longer events first
      });
  }

  /**
   * Get events that overlap with a given time range
   * @param {Date} start - Start time
   * @param {Date} end - End time
   * @param {string} [excludeId=null] - Optional event ID to exclude (useful when checking for conflicts)
   * @returns {Event[]} Array of overlapping events
   */
  getOverlappingEvents(start, end, excludeId = null) {
    const overlapping = [];

    // Get all events in the date range
    const startDate = DateUtils.startOfDay(start);
    const endDate = DateUtils.endOfDay(end);
    const dates = DateUtils.getDateRange(startDate, endDate);

    // Collect all events from those dates
    const checkedIds = new Set();
    dates.forEach(date => {
      const dateStr = date.toDateString();
      const eventIds = this.indices.byDate.get(dateStr) || new Set();

      eventIds.forEach(id => {
        if (!checkedIds.has(id) && id !== excludeId) {
          checkedIds.add(id);
          const event = this.events.get(id);

          if (event && event.overlaps({ start, end })) {
            overlapping.push(event);
          }
        }
      });
    });

    return overlapping.sort((a, b) => a.start - b.start);
  }

  /**
   * Check if an event would conflict with existing events
   * @param {Date} start - Start time
   * @param {Date} end - End time
   * @param {string} excludeId - Optional event ID to exclude
   * @returns {boolean} True if there are conflicts
   */
  hasConflicts(start, end, excludeId = null) {
    return this.getOverlappingEvents(start, end, excludeId).length > 0;
  }

  /**
   * Get events grouped by overlapping time slots
   * Useful for calculating event positions in week/day views
   * @param {Date} date - The date to analyze
   * @param {boolean} timedOnly - Only include timed events (not all-day)
   * @returns {Array<Event[]>} Array of event groups that overlap
   */
  getOverlapGroups(date, timedOnly = true) {
    let events = this.getEventsForDate(date);

    if (timedOnly) {
      events = events.filter(e => !e.allDay);
    }

    const groups = [];
    const processed = new Set();

    events.forEach(event => {
      if (processed.has(event.id)) return;

      // Start a new group with this event
      const group = [event];
      processed.add(event.id);

      // Find all events that overlap with any event in this group
      let i = 0;
      while (i < group.length) {
        const currentEvent = group[i];

        events.forEach(otherEvent => {
          if (!processed.has(otherEvent.id) && currentEvent.overlaps(otherEvent)) {
            group.push(otherEvent);
            processed.add(otherEvent.id);
          }
        });

        i++;
      }

      groups.push(group);
    });

    return groups;
  }

  /**
   * Calculate positions for overlapping events (for rendering)
   * @param {Event[]} events - Array of overlapping events
   * @returns {Map<string, {column: number, totalColumns: number}>} Position data for each event
   */
  calculateEventPositions(events) {
    const positions = new Map();

    if (events.length === 0) return positions;

    // Sort by start time, then by duration (longer events first)
    events.sort((a, b) => {
      const startDiff = a.start - b.start;
      if (startDiff !== 0) return startDiff;
      return (b.end - b.start) - (a.end - a.start);
    });

    // Track which columns are occupied at each time
    const columns = [];

    events.forEach(event => {
      // Find the first available column
      let column = 0;
      while (column < columns.length) {
        const columnEvents = columns[column];
        const hasConflict = columnEvents.some(e => e.overlaps(event));

        if (!hasConflict) {
          break;
        }
        column++;
      }

      // Add event to the column
      if (!columns[column]) {
        columns[column] = [];
      }
      columns[column].push(event);

      positions.set(event.id, {
        column: column,
        totalColumns: 0 // Will be updated after all events are placed
      });
    });

    // Update total columns for all events
    const totalColumns = columns.length;
    positions.forEach(pos => {
      pos.totalColumns = totalColumns;
    });

    return positions;
  }

  /**
   * Get events for a date range
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @param {boolean} expandRecurring - Whether to expand recurring events
   * @returns {Event[]}
   */
  getEventsInRange(start, end, expandRecurring = true) {
    const baseEvents = this.queryEvents({ start, end, sort: 'start' });

    if (!expandRecurring) {
      return baseEvents;
    }

    // Expand recurring events
    const expandedEvents = [];
    baseEvents.forEach(event => {
      if (event.recurring && event.recurrenceRule) {
        const occurrences = this.expandRecurringEvent(event, start, end);
        expandedEvents.push(...occurrences);
      } else {
        expandedEvents.push(event);
      }
    });

    return expandedEvents.sort((a, b) => a.start - b.start);
  }

  /**
   * Expand a recurring event into individual occurrences
   * @param {Event} event - The recurring event
   * @param {Date} rangeStart - Start of the expansion range
   * @param {Date} rangeEnd - End of the expansion range
   * @returns {Event[]} Array of event occurrences
   */
  expandRecurringEvent(event, rangeStart, rangeEnd) {
    if (!event.recurring || !event.recurrenceRule) {
      return [event];
    }

    const occurrences = RecurrenceEngine.expandEvent(event, rangeStart, rangeEnd);

    return occurrences.map((occurrence, index) => {
      // Create a new event instance for each occurrence
      const occurrenceEvent = event.clone({
        id: `${event.id}_occurrence_${index}`,
        start: occurrence.start,
        end: occurrence.end,
        metadata: {
          ...event.metadata,
          recurringEventId: event.id,
          occurrenceIndex: index
        }
      });

      return occurrenceEvent;
    });
  }

  /**
   * Clear all events
   */
  clear() {
    const oldEvents = this.getAllEvents();

    this.events.clear();
    this.indices.byDate.clear();
    this.indices.byMonth.clear();
    this.indices.recurring.clear();

    this._notifyChange({
      type: 'clear',
      oldEvents,
      version: ++this.version
    });
  }

  /**
   * Bulk load events
   * @param {Event[]} events - Array of events or event data
   */
  loadEvents(events) {
    this.clear();

    for (const eventData of events) {
      this.addEvent(eventData);
    }
  }

  /**
   * Subscribe to store changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Index an event for efficient queries
   * @private
   */
  _indexEvent(event) {
    // Index by date(s)
    const startDate = DateUtils.startOfDay(event.start);
    const endDate = DateUtils.endOfDay(event.end);

    // For each day the event spans, add to date index
    const dates = DateUtils.getDateRange(startDate, endDate);

    dates.forEach(date => {
      const dateStr = date.toDateString();

      if (!this.indices.byDate.has(dateStr)) {
        this.indices.byDate.set(dateStr, new Set());
      }
      this.indices.byDate.get(dateStr).add(event.id);
    });

    // Index by month(s)
    const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

    // Add to all months the event spans
    const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (currentMonth <= endDate) {
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

      if (!this.indices.byMonth.has(monthKey)) {
        this.indices.byMonth.set(monthKey, new Set());
      }
      this.indices.byMonth.get(monthKey).add(event.id);

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Index recurring events
    if (event.recurring) {
      this.indices.recurring.add(event.id);
    }
  }

  /**
   * Remove event from indices
   * @private
   */
  _unindexEvent(event) {
    // Remove from date indices
    for (const [dateStr, eventIds] of this.indices.byDate) {
      eventIds.delete(event.id);
      if (eventIds.size === 0) {
        this.indices.byDate.delete(dateStr);
      }
    }

    // Remove from month indices
    for (const [monthKey, eventIds] of this.indices.byMonth) {
      eventIds.delete(event.id);
      if (eventIds.size === 0) {
        this.indices.byMonth.delete(monthKey);
      }
    }

    // Remove from recurring index
    this.indices.recurring.delete(event.id);
  }

  /**
   * Notify listeners of changes
   * @private
   */
  _notifyChange(change) {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.error('Error in EventStore listener:', error);
      }
    }
  }

  /**
   * Get store statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalEvents: this.events.size,
      recurringEvents: this.indices.recurring.size,
      indexedDates: this.indices.byDate.size,
      indexedMonths: this.indices.byMonth.size,
      version: this.version
    };
  }
}