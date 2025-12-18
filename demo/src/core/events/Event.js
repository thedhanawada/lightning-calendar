/**
 * Event class - represents a calendar event
 * Pure JavaScript, no DOM dependencies
 * Locker Service compatible
 */
export class Event {
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

    // Custom metadata for extensibility
    this.metadata = { ...metadata };

    // Computed properties cache
    this._cache = {};
  }

  /**
   * Get event duration in milliseconds
   */
  get duration() {
    if (!this._cache.duration) {
      this._cache.duration = this.end.getTime() - this.start.getTime();
    }
    return this._cache.duration;
  }

  /**
   * Get event duration in minutes
   */
  get durationMinutes() {
    return Math.floor(this.duration / (1000 * 60));
  }

  /**
   * Get event duration in hours
   */
  get durationHours() {
    return this.duration / (1000 * 60 * 60);
  }

  /**
   * Check if this is a multi-day event
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
   */
  isRecurring() {
    return this.recurring && this.recurrenceRule !== null;
  }

  /**
   * Check if event occurs on a specific date
   * @param {Date} date - The date to check
   * @returns {boolean}
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
   * @param {Event} otherEvent - The other event to check
   * @returns {boolean}
   */
  overlaps(otherEvent) {
    if (!(otherEvent instanceof Event)) {
      throw new Error('Parameter must be an Event instance');
    }

    // Events don't overlap if one ends before the other starts
    return !(this.end <= otherEvent.start || this.start >= otherEvent.end);
  }

  /**
   * Check if event contains a specific datetime
   * @param {Date} datetime - The datetime to check
   * @returns {boolean}
   */
  contains(datetime) {
    if (!(datetime instanceof Date)) {
      datetime = new Date(datetime);
    }
    return datetime >= this.start && datetime <= this.end;
  }

  /**
   * Clone the event with optional updates
   * @param {Object} updates - Properties to update in the clone
   * @returns {Event}
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
      metadata: { ...this.metadata },
      ...updates
    });
  }

  /**
   * Convert event to plain object
   * @returns {Object}
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
   * @param {Object} obj - Plain object with event properties
   * @returns {Event}
   */
  static fromObject(obj) {
    return new Event(obj);
  }

  /**
   * Compare events for equality
   * @param {Event} other - The other event
   * @returns {boolean}
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