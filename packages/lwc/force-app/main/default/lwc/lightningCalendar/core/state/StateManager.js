/**
 * StateManager - Central state management for the calendar
 * Implements an immutable state pattern with change notifications
 */
export class StateManager {
  constructor(initialState = {}) {
    this.state = {
      // Current view configuration
      view: 'month', // 'month', 'week', 'day', 'list'
      currentDate: new Date(),

      // UI state
      selectedEventId: null,
      selectedDate: null,
      hoveredEventId: null,
      hoveredDate: null,

      // Display options
      weekStartsOn: 0, // 0 = Sunday, 1 = Monday, etc.
      showWeekNumbers: false,
      showWeekends: true,
      fixedWeekCount: true, // Always show 6 weeks in month view

      // Time configuration
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: 'en-US',
      hourFormat: '12h', // '12h' or '24h'

      // Business hours (for week/day views)
      businessHours: {
        start: '09:00',
        end: '17:00'
      },

      // Filters
      filters: {
        searchTerm: '',
        categories: [],
        showAllDay: true,
        showTimed: true
      },

      // Interaction flags
      isDragging: false,
      isResizing: false,
      isCreating: false,

      // Loading states
      isLoading: false,
      loadingMessage: '',

      // Error state
      error: null,

      // Custom metadata
      metadata: {},

      // Apply initial state overrides
      ...initialState
    };

    // Observers for state changes
    this.listeners = new Map();
    this.globalListeners = new Set();

    // History for undo/redo (optional)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
  }

  /**
   * Get the current state
   * @returns {Object} Current state (frozen)
   */
  getState() {
    return Object.freeze({ ...this.state });
  }

  /**
   * Get a specific state value
   * @param {string} key - The state key
   * @returns {*} The state value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Update state with partial updates
   * @param {Object|Function} updates - Object with updates or updater function
   */
  setState(updates) {
    const oldState = this.state;

    // Support function updater pattern
    if (typeof updates === 'function') {
      updates = updates(oldState);
    }

    // Create new state with updates
    const newState = {
      ...oldState,
      ...updates,
      // Preserve nested objects
      filters: updates.filters ? { ...oldState.filters, ...updates.filters } : oldState.filters,
      businessHours: updates.businessHours ? { ...oldState.businessHours, ...updates.businessHours } : oldState.businessHours,
      metadata: updates.metadata ? { ...oldState.metadata, ...updates.metadata } : oldState.metadata
    };

    // Check if state actually changed
    if (this._hasChanged(oldState, newState)) {
      this.state = newState;

      // Add to history
      this._addToHistory(oldState);

      // Notify listeners
      this._notifyListeners(oldState, newState);
    }
  }

  /**
   * Set the current view
   * @param {string} view - The view type
   */
  setView(view) {
    const validViews = ['month', 'week', 'day', 'list'];
    if (!validViews.includes(view)) {
      throw new Error(`Invalid view: ${view}. Must be one of: ${validViews.join(', ')}`);
    }
    this.setState({ view });
  }

  /**
   * Set the current date
   * @param {Date} date - The date to set
   */
  setCurrentDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    this.setState({ currentDate: date });
  }

  /**
   * Navigate to the next period (month/week/day based on view)
   */
  navigateNext() {
    const { view, currentDate } = this.state;
    const newDate = new Date(currentDate);

    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }

    this.setCurrentDate(newDate);
  }

  /**
   * Navigate to the previous period
   */
  navigatePrevious() {
    const { view, currentDate } = this.state;
    const newDate = new Date(currentDate);

    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }

    this.setCurrentDate(newDate);
  }

  /**
   * Navigate to today
   */
  navigateToday() {
    this.setCurrentDate(new Date());
  }

  /**
   * Select an event
   * @param {string} eventId - The event ID to select
   */
  selectEvent(eventId) {
    this.setState({ selectedEventId: eventId });
  }

  /**
   * Clear event selection
   */
  clearEventSelection() {
    this.setState({ selectedEventId: null });
  }

  /**
   * Select a date
   * @param {Date} date - The date to select
   */
  selectDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    this.setState({ selectedDate: date });
  }

  /**
   * Clear date selection
   */
  clearDateSelection() {
    this.setState({ selectedDate: null });
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   * @param {string} message - Optional loading message
   */
  setLoading(isLoading, message = '') {
    this.setState({
      isLoading,
      loadingMessage: message
    });
  }

  /**
   * Set error state
   * @param {Error|string|null} error - The error
   */
  setError(error) {
    this.setState({
      error: error ? (error instanceof Error ? error.message : error) : null
    });
  }

  /**
   * Update filters
   * @param {Object} filters - Filter updates
   */
  updateFilters(filters) {
    this.setState({
      filters: {
        ...this.state.filters,
        ...filters
      }
    });
  }

  /**
   * Subscribe to all state changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.globalListeners.add(callback);

    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Subscribe to specific state key changes
   * @param {string|string[]} keys - State key(s) to watch
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  watch(keys, callback) {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    keyArray.forEach(key => {
      if (!this.listeners.has(key)) {
        this.listeners.set(key, new Set());
      }
      this.listeners.get(key).add(callback);
    });

    return () => {
      keyArray.forEach(key => {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            this.listeners.delete(key);
          }
        }
      });
    };
  }

  /**
   * Undo the last state change
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = { ...this.history[this.historyIndex] };
      this._notifyListeners(this.history[this.historyIndex + 1], this.state);
    }
  }

  /**
   * Redo the next state change
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = { ...this.history[this.historyIndex] };
      this._notifyListeners(this.history[this.historyIndex - 1], this.state);
    }
  }

  /**
   * Reset state to initial values
   */
  reset() {
    const initialState = this.history[0] || {};
    this.setState(initialState);
    this.history = [initialState];
    this.historyIndex = 0;
  }

  /**
   * Check if state has changed
   * @private
   */
  _hasChanged(oldState, newState) {
    // Simple shallow comparison for now
    // Could be optimized with deep comparison for specific keys
    return JSON.stringify(oldState) !== JSON.stringify(newState);
  }

  /**
   * Add state to history
   * @private
   */
  _addToHistory(state) {
    // Remove any future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new state
    this.history.push({ ...state });
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Notify listeners of state changes
   * @private
   */
  _notifyListeners(oldState, newState) {
    // Notify global listeners
    for (const callback of this.globalListeners) {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    }

    // Notify specific key listeners
    for (const [key, callbacks] of this.listeners) {
      if (oldState[key] !== newState[key]) {
        for (const callback of callbacks) {
          try {
            callback(newState[key], oldState[key], newState, oldState);
          } catch (error) {
            console.error(`Error in state listener for key "${key}":`, error);
          }
        }
      }
    }
  }
}