/**
 * Event class - represents a calendar event with timezone support
 * Pure JavaScript, no DOM dependencies
 * Locker Service compatible
 */

import { TimezoneManager } from '../timezone/TimezoneManager.js';

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
    endTimeZone = null,
    status = 'confirmed',
    visibility = 'public',
    organizer = null,
    attendees = [],
    reminders = [],
    categories = [],
    attachments = [],
    conferenceData = null,
    metadata = {}
  }) {
    // Required fields
    if (!id) throw new Error('Event must have an id');
    if (!title) throw new Error('Event must have a title');
    if (!start) throw new Error('Event must have a start date');

    this.id = id;
    this.title = title;

    // Initialize timezone manager
    this._timezoneManager = new TimezoneManager();

    // Timezone handling
    // Store the timezone the event was created in (wall-clock time)
    this.timeZone = timeZone || this._timezoneManager.getSystemTimezone();
    this.endTimeZone = endTimeZone || this.timeZone; // Different end timezone for flights etc.

    // Store dates as provided (wall-clock time in event timezone)
    this.start = start instanceof Date ? start : new Date(start);
    this.end = end ? (end instanceof Date ? end : new Date(end)) : new Date(this.start);

    // Store UTC versions for efficient querying and comparison
    this.startUTC = this._timezoneManager.toUTC(this.start, this.timeZone);
    this.endUTC = this._timezoneManager.toUTC(this.end, this.endTimeZone);

    // Validate date order using UTC times
    if (this.endUTC < this.startUTC) {
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

    // Store original timezone from system if not provided
    this._originalTimeZone = timeZone || null;

    // Event status and visibility
    this.status = status;
    this.visibility = visibility;

    // People
    this.organizer = organizer;
    this.attendees = Array.isArray(attendees) ? [...attendees] : [];

    // Reminders
    this.reminders = Array.isArray(reminders) ? [...reminders] : [];

    // Categories/Tags
    this.categories = Array.isArray(categories) ? [...categories] : [];

    // Attachments
    this.attachments = Array.isArray(attachments) ? [...attachments] : [];

    // Conference/Virtual meeting
    this.conferenceData = conferenceData;

    // Custom metadata for extensibility
    this.metadata = { ...metadata };

    // Computed properties cache
    this._cache = {};

    // Validate complex properties
    this._validateAttendees();
    this._validateReminders();
  }

  /**
   * Get event duration in milliseconds
   * @returns {number} Duration in milliseconds
   */
  get duration() {
    if (!this._cache.duration) {
      // Use UTC times for accurate duration calculation
      this._cache.duration = this.endUTC.getTime() - this.startUTC.getTime();
    }
    return this._cache.duration;
  }

  /**
   * Get start date in a specific timezone
   * @param {string} timezone - Target timezone
   * @returns {Date} Start date in specified timezone
   */
  getStartInTimezone(timezone) {
    if (timezone === this.timeZone) {
      return new Date(this.start);
    }
    return this._timezoneManager.fromUTC(this.startUTC, timezone);
  }

  /**
   * Get end date in a specific timezone
   * @param {string} timezone - Target timezone
   * @returns {Date} End date in specified timezone
   */
  getEndInTimezone(timezone) {
    if (timezone === this.endTimeZone) {
      return new Date(this.end);
    }
    return this._timezoneManager.fromUTC(this.endUTC, timezone);
  }

  /**
   * Update event times preserving the timezone
   * @param {Date} start - New start date
   * @param {Date} end - New end date
   * @param {string} [timezone] - Timezone for the new dates
   */
  updateTimes(start, end, timezone) {
    const tz = timezone || this.timeZone;

    this.start = start instanceof Date ? start : new Date(start);
    this.end = end instanceof Date ? end : new Date(end);

    if (timezone) {
      this.timeZone = timezone;
      this.endTimeZone = timezone;
    }

    // Update UTC versions
    this.startUTC = this._timezoneManager.toUTC(this.start, this.timeZone);
    this.endUTC = this._timezoneManager.toUTC(this.end, this.endTimeZone);

    // Clear cache
    this._cache = {};

    // Validate
    if (this.endUTC < this.startUTC) {
      throw new Error('Event end time cannot be before start time');
    }
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
      status: this.status,
      visibility: this.visibility,
      organizer: this.organizer ? { ...this.organizer } : null,
      attendees: this.attendees.map(a => ({ ...a })),
      reminders: this.reminders.map(r => ({ ...r })),
      categories: [...this.categories],
      attachments: this.attachments.map(a => ({ ...a })),
      conferenceData: this.conferenceData ? { ...this.conferenceData } : null,
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
      timeZone: this.timeZone,
      status: this.status,
      visibility: this.visibility,
      organizer: this.organizer,
      attendees: this.attendees,
      reminders: this.reminders,
      categories: this.categories,
      attachments: this.attachments,
      conferenceData: this.conferenceData,
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
      this.recurrenceRule === other.recurrenceRule &&
      this.status === other.status
    );
  }

  // ============ Attendee Management Methods ============

  /**
   * Add an attendee to the event
   * @param {import('../../types.js').Attendee} attendee - Attendee to add
   * @returns {boolean} True if attendee was added, false if already exists
   */
  addAttendee(attendee) {
    if (!attendee || !attendee.email) {
      throw new Error('Attendee must have an email');
    }

    // Check if attendee already exists
    if (this.hasAttendee(attendee.email)) {
      return false;
    }

    // Generate ID if not provided
    if (!attendee.id) {
      attendee.id = `attendee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set defaults
    attendee.responseStatus = attendee.responseStatus || 'needs-action';
    attendee.role = attendee.role || 'required';

    this.attendees.push(attendee);
    return true;
  }

  /**
   * Remove an attendee from the event
   * @param {string} emailOrId - Email or ID of the attendee to remove
   * @returns {boolean} True if attendee was removed
   */
  removeAttendee(emailOrId) {
    const index = this.attendees.findIndex(
      a => a.email === emailOrId || a.id === emailOrId
    );

    if (index !== -1) {
      this.attendees.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update an attendee's response status
   * @param {string} email - Attendee's email
   * @param {import('../../types.js').AttendeeResponseStatus} responseStatus - New response status
   * @returns {boolean} True if attendee was updated
   */
  updateAttendeeResponse(email, responseStatus) {
    const attendee = this.getAttendee(email);
    if (attendee) {
      attendee.responseStatus = responseStatus;
      attendee.responseTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get an attendee by email
   * @param {string} email - Attendee's email
   * @returns {import('../../types.js').Attendee|null} The attendee or null
   */
  getAttendee(email) {
    return this.attendees.find(a => a.email === email) || null;
  }

  /**
   * Check if an attendee exists
   * @param {string} email - Attendee's email
   * @returns {boolean} True if attendee exists
   */
  hasAttendee(email) {
    return this.attendees.some(a => a.email === email);
  }

  /**
   * Get attendees by response status
   * @param {import('../../types.js').AttendeeResponseStatus} status - Response status to filter by
   * @returns {import('../../types.js').Attendee[]} Filtered attendees
   */
  getAttendeesByStatus(status) {
    return this.attendees.filter(a => a.responseStatus === status);
  }

  /**
   * Get count of attendees by response status
   * @returns {Object.<string, number>} Count by status
   */
  getAttendeeCounts() {
    return this.attendees.reduce((counts, attendee) => {
      const status = attendee.responseStatus || 'needs-action';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
  }

  // ============ Reminder Management Methods ============

  /**
   * Add a reminder to the event
   * @param {import('../../types.js').Reminder} reminder - Reminder to add
   * @returns {boolean} True if reminder was added
   */
  addReminder(reminder) {
    if (!reminder || typeof reminder.minutesBefore !== 'number') {
      throw new Error('Reminder must have minutesBefore property');
    }

    // Generate ID if not provided
    if (!reminder.id) {
      reminder.id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set defaults
    reminder.method = reminder.method || 'popup';
    reminder.enabled = reminder.enabled !== false;

    // Check for duplicate
    const duplicate = this.reminders.some(
      r => r.method === reminder.method && r.minutesBefore === reminder.minutesBefore
    );

    if (duplicate) {
      return false;
    }

    this.reminders.push(reminder);
    return true;
  }

  /**
   * Remove a reminder from the event
   * @param {string} reminderId - ID of the reminder to remove
   * @returns {boolean} True if reminder was removed
   */
  removeReminder(reminderId) {
    const index = this.reminders.findIndex(r => r.id === reminderId);
    if (index !== -1) {
      this.reminders.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get active reminders
   * @returns {import('../../types.js').Reminder[]} Active reminders
   */
  getActiveReminders() {
    return this.reminders.filter(r => r.enabled !== false);
  }

  /**
   * Get reminder trigger times
   * @returns {Date[]} Array of dates when reminders should trigger
   */
  getReminderTriggerTimes() {
    return this.getActiveReminders().map(reminder => {
      const triggerTime = new Date(this.start);
      triggerTime.setMinutes(triggerTime.getMinutes() - reminder.minutesBefore);
      return triggerTime;
    });
  }

  // ============ Category Management Methods ============

  /**
   * Add a category to the event
   * @param {string} category - Category to add
   * @returns {boolean} True if category was added
   */
  addCategory(category) {
    if (!category || typeof category !== 'string') {
      throw new Error('Category must be a non-empty string');
    }

    const normalizedCategory = category.trim().toLowerCase();
    if (!this.hasCategory(normalizedCategory)) {
      this.categories.push(normalizedCategory);
      return true;
    }
    return false;
  }

  /**
   * Remove a category from the event
   * @param {string} category - Category to remove
   * @returns {boolean} True if category was removed
   */
  removeCategory(category) {
    const normalizedCategory = category.trim().toLowerCase();
    const index = this.categories.findIndex(
      c => c.toLowerCase() === normalizedCategory
    );

    if (index !== -1) {
      this.categories.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if event has a specific category
   * @param {string} category - Category to check
   * @returns {boolean} True if event has the category
   */
  hasCategory(category) {
    const normalizedCategory = category.trim().toLowerCase();
    return this.categories.some(c => c.toLowerCase() === normalizedCategory);
  }

  /**
   * Check if event has any of the specified categories
   * @param {string[]} categories - Categories to check
   * @returns {boolean} True if event has any of the categories
   */
  hasAnyCategory(categories) {
    return categories.some(category => this.hasCategory(category));
  }

  /**
   * Check if event has all of the specified categories
   * @param {string[]} categories - Categories to check
   * @returns {boolean} True if event has all of the categories
   */
  hasAllCategories(categories) {
    return categories.every(category => this.hasCategory(category));
  }

  // ============ Validation Methods ============

  /**
   * Validate attendees
   * @private
   * @throws {Error} If attendees are invalid
   */
  _validateAttendees() {
    for (const attendee of this.attendees) {
      if (!attendee.email) {
        throw new Error('All attendees must have an email address');
      }
      if (!attendee.name) {
        attendee.name = attendee.email; // Use email as fallback name
      }
      if (!this._isValidEmail(attendee.email)) {
        throw new Error(`Invalid attendee email: ${attendee.email}`);
      }
    }
  }

  /**
   * Validate reminders
   * @private
   * @throws {Error} If reminders are invalid
   */
  _validateReminders() {
    for (const reminder of this.reminders) {
      if (typeof reminder.minutesBefore !== 'number' || reminder.minutesBefore < 0) {
        throw new Error('Reminder minutesBefore must be a positive number');
      }

      const validMethods = ['email', 'popup', 'sms'];
      if (!validMethods.includes(reminder.method)) {
        throw new Error(`Invalid reminder method: ${reminder.method}`);
      }
    }
  }

  /**
   * Validate email address
   * @private
   * @param {string} email - Email to validate
   * @returns {boolean} True if email is valid
   */
  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ============ Enhanced Getters ============

  /**
   * Check if the event is cancelled
   * @returns {boolean} True if event is cancelled
   */
  get isCancelled() {
    return this.status === 'cancelled';
  }

  /**
   * Check if the event is tentative
   * @returns {boolean} True if event is tentative
   */
  get isTentative() {
    return this.status === 'tentative';
  }

  /**
   * Check if the event is confirmed
   * @returns {boolean} True if event is confirmed
   */
  get isConfirmed() {
    return this.status === 'confirmed';
  }

  /**
   * Check if the event is private
   * @returns {boolean} True if event is private
   */
  get isPrivate() {
    return this.visibility === 'private';
  }

  /**
   * Check if the event is public
   * @returns {boolean} True if event is public
   */
  get isPublic() {
    return this.visibility === 'public';
  }

  /**
   * Check if the event has attendees
   * @returns {boolean} True if event has attendees
   */
  get hasAttendees() {
    return this.attendees.length > 0;
  }

  /**
   * Check if the event has reminders
   * @returns {boolean} True if event has reminders
   */
  get hasReminders() {
    return this.reminders.length > 0;
  }

  /**
   * Check if the event is a meeting (has attendees or conference data)
   * @returns {boolean} True if event is a meeting
   */
  get isMeeting() {
    return this.hasAttendees || this.conferenceData !== null;
  }

  /**
   * Check if the event is virtual (has conference data)
   * @returns {boolean} True if event is virtual
   */
  get isVirtual() {
    return this.conferenceData !== null;
  }
}