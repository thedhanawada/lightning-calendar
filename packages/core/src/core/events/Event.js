/**
 * Event class - represents a calendar event
 * Pure JavaScript, no DOM dependencies
 * Locker Service compatible
 */
export class Event {
  /**
   * Create a new Event instance
   * @param {import('../../types.js').EventData} eventData - Event data object
   * @throws {Error} If required fields are missing or invalid
   */
  constructor({
    id,
    title,
    start,
    end,
    allDay = false,
    description = '',
    location = '',
    color = null,
    backgroundColor = null,
    borderColor = null,
    textColor = null,
    recurring = false,
    recurrenceRule = null,
    timeZone = null,
    metadata = {}
  }) {
    // Required fields
    if (!id) throw new Error('Event must have an id');
    if (!title) throw new Error('Event must have a title');
    if (!start) throw new Error('Event must have a start date');

    this.id = id;
    this.title = title;

    // Ensure dates are Date objects
    this.start = start instanceof Date ? start : new Date(start);
    this.end = end ? (end instanceof Date ? end : new Date(end)) : new Date(this.start);

    // Validate date order
    if (this.end < this.start) {
      throw new Error('Event end time cannot be before start time');
    }

    this.allDay = allDay;
    this.description = description;
    this.location = location;

    // Styling
    this.color = color;
    this.backgroundColor = backgroundColor || color;
    this.borderColor = borderColor || color;
    this.textColor = textColor;

    // Recurrence
    this.recurring = recurring;
    this.recurrenceRule = recurrenceRule;

    // Timezone - if not specified, events are in browser's local timezone
    this.timeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Custom metadata for extensibility
    this.metadata = { ...metadata };

    // Computed properties cache
    this._cache = {};
  }

  /**
   * Get event duration in milliseconds
   * @returns {number} Duration in milliseconds
   */
  get duration() {
    if (!this._cache.duration) {
      this._cache.duration = this.end.getTime() - this.start.getTime();
    }
    return this._cache.duration;
  }

  /**
   * Get event duration in minutes
   * @returns {number} Duration in minutes
   */
  get durationMinutes() {
    return Math.floor(this.duration / (1000 * 60));
  }

  /**
   * Get event duration in hours
   * @returns {number} Duration in hours
   */
  get durationHours() {
    return this.duration / (1000 * 60 * 60);
  }

  /**
   * Check if this is a multi-day event
   * @returns {boolean} True if event spans multiple days
   */
  get isMultiDay() {
    if (!this._cache.hasOwnProperty('isMultiDay')) {
      const startDay = this.start.toDateString();
      const endDay = this.end.toDateString();
      this._cache.isMultiDay = startDay !== endDay;
    }
    return this._cache.isMultiDay;
  }

  /**
   * Check if event is recurring
   * @returns {boolean} True if event is recurring
   */
  isRecurring() {
    return this.recurring && this.recurrenceRule !== null;
  }

  /**
   * Check if event occurs on a specific date
   * @param {Date|string} date - The date to check
   * @returns {boolean} True if event occurs on the given date
   */
  occursOn(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    const dateString = date.toDateString();
    const startString = this.start.toDateString();
    const endString = this.end.toDateString();

    // For all-day events, check if date falls within range
    if (this.allDay) {
      return date >= new Date(startString) && date <= new Date(endString);
    }

    // For timed events, check if any part of the event occurs on this date
    if (this.isMultiDay) {
      // Multi-day event: check if date is within range
      const dayStart = new Date(dateString);
      const dayEnd = new Date(dateString);
      dayEnd.setHours(23, 59, 59, 999);

      return this.start <= dayEnd && this.end >= dayStart;
    } else {
      // Single day event: check if it's on the same day
      return startString === dateString;
    }
  }

  /**
   * Check if this event overlaps with another event
   * @param {Event|{start: Date, end: Date}} otherEvent - The other event or time range to check
   * @returns {boolean} True if events overlap
   * @throws {Error} If otherEvent is not an Event instance or doesn't have start/end
   */
  overlaps(otherEvent) {
    if (otherEvent instanceof Event) {
      // Events don't overlap if one ends before the other starts
      return !(this.end <= otherEvent.start || this.start >= otherEvent.end);
    } else if (otherEvent && otherEvent.start && otherEvent.end) {
      // Allow checking against time ranges
      return !(this.end <= otherEvent.start || this.start >= otherEvent.end);
    } else {
      throw new Error('Parameter must be an Event instance or have start/end properties');
    }
  }

  /**
   * Check if event contains a specific datetime
   * @param {Date|string} datetime - The datetime to check
   * @returns {boolean} True if the datetime falls within the event
   */
  contains(datetime) {
    if (!(datetime instanceof Date)) {
      datetime = new Date(datetime);
    }
    return datetime >= this.start && datetime <= this.end;
  }

  /**
   * Clone the event with optional updates
   * @param {Partial<import('../../types.js').EventData>} [updates={}] - Properties to update in the clone
   * @returns {Event} New Event instance with updated properties
   */
  clone(updates = {}) {
    return new Event({
      id: this.id,
      title: this.title,
      start: new Date(this.start),
      end: new Date(this.end),
      allDay: this.allDay,
      description: this.description,
      location: this.location,
      color: this.color,
      backgroundColor: this.backgroundColor,
      borderColor: this.borderColor,
      textColor: this.textColor,
      recurring: this.recurring,
      recurrenceRule: this.recurrenceRule,
      timeZone: this.timeZone,
      metadata: { ...this.metadata },
      ...updates
    });
  }

  /**
   * Convert event to plain object
   * @returns {import('../../types.js').EventData} Plain object representation of the event
   */
  toObject() {
    return {
      id: this.id,
      title: this.title,
      start: this.start.toISOString(),
      end: this.end.toISOString(),
      allDay: this.allDay,
      description: this.description,
      location: this.location,
      color: this.color,
      backgroundColor: this.backgroundColor,
      borderColor: this.borderColor,
      textColor: this.textColor,
      recurring: this.recurring,
      recurrenceRule: this.recurrenceRule,
      metadata: { ...this.metadata }
    };
  }

  /**
   * Create Event from plain object
   * @param {import('../../types.js').EventData} obj - Plain object with event properties
   * @returns {Event} New Event instance
   */
  static fromObject(obj) {
    return new Event(obj);
  }

  /**
   * Compare events for equality
   * @param {Event} other - The other event
   * @returns {boolean} True if events are equal
   */
  equals(other) {
    if (!(other instanceof Event)) return false;

    return (
      this.id === other.id &&
      this.title === other.title &&
      this.start.getTime() === other.start.getTime() &&
      this.end.getTime() === other.end.getTime() &&
      this.allDay === other.allDay &&
      this.description === other.description &&
      this.location === other.location &&
      this.recurring === other.recurring &&
      this.recurrenceRule === other.recurrenceRule
    );
  }
}