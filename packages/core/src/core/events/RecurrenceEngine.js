import { DateUtils } from '../calendar/DateUtils.js';

/**
 * RecurrenceEngine - Handles expansion of recurring events
 * Supports a subset of RFC 5545 (iCalendar) RRULE specification
 */
export class RecurrenceEngine {
  /**
   * Expand a recurring event into individual occurrences
   * @param {import('./Event.js').Event} event - The recurring event
   * @param {Date} rangeStart - Start of the expansion range
   * @param {Date} rangeEnd - End of the expansion range
   * @param {number} [maxOccurrences=365] - Maximum number of occurrences to generate
   * @returns {import('../../types.js').EventOccurrence[]} Array of occurrence objects with start/end dates
   */
  static expandEvent(event, rangeStart, rangeEnd, maxOccurrences = 365) {
    if (!event.recurring || !event.recurrenceRule) {
      return [{ start: event.start, end: event.end }];
    }

    const rule = this.parseRule(event.recurrenceRule);
    const occurrences = [];
    const duration = event.end - event.start;

    let currentDate = new Date(event.start);
    let count = 0;

    // If UNTIL is specified, use it as the range end
    if (rule.until && rule.until < rangeEnd) {
      rangeEnd = rule.until;
    }

    while (currentDate <= rangeEnd && count < maxOccurrences) {
      // Check if this occurrence is within the range
      if (currentDate >= rangeStart) {
        const occurrenceStart = new Date(currentDate);
        const occurrenceEnd = new Date(currentDate.getTime() + duration);

        // Apply exceptions if any
        if (!this.isException(occurrenceStart, rule)) {
          occurrences.push({
            start: occurrenceStart,
            end: occurrenceEnd,
            recurringEventId: event.id
          });
        }
      }

      // Calculate next occurrence
      currentDate = this.getNextOccurrence(currentDate, rule);
      count++;

      // Check COUNT limit
      if (rule.count && count >= rule.count) {
        break;
      }
    }

    return occurrences;
  }

  /**
   * Parse an RRULE string into a rule object
   * @param {string|import('../../types.js').RecurrenceRule} ruleString - RRULE string (e.g., "FREQ=DAILY;INTERVAL=1;COUNT=10") or rule object
   * @returns {import('../../types.js').RecurrenceRule} Parsed rule object
   */
  static parseRule(ruleString) {
    const rule = {
      freq: null,
      interval: 1,
      count: null,
      until: null,
      byDay: [],
      byMonthDay: [],
      byMonth: [],
      bySetPos: [],
      exceptions: []
    };

    if (typeof ruleString === 'object') {
      return { ...rule, ...ruleString };
    }

    const parts = ruleString.split(';');
    parts.forEach(part => {
      const [key, value] = part.split('=');
      switch (key.toUpperCase()) {
        case 'FREQ':
          rule.freq = value.toUpperCase();
          break;
        case 'INTERVAL':
          rule.interval = parseInt(value, 10);
          break;
        case 'COUNT':
          rule.count = parseInt(value, 10);
          break;
        case 'UNTIL':
          rule.until = this.parseDate(value);
          break;
        case 'BYDAY':
          rule.byDay = value.split(',');
          break;
        case 'BYMONTHDAY':
          rule.byMonthDay = value.split(',').map(d => parseInt(d, 10));
          break;
        case 'BYMONTH':
          rule.byMonth = value.split(',').map(m => parseInt(m, 10));
          break;
        case 'BYSETPOS':
          rule.bySetPos = value.split(',').map(p => parseInt(p, 10));
          break;
      }
    });

    return rule;
  }

  /**
   * Calculate the next occurrence based on the rule
   * @param {Date} currentDate - Current occurrence date
   * @param {Object} rule - Recurrence rule object
   * @returns {Date} Next occurrence date
   */
  static getNextOccurrence(currentDate, rule) {
    const next = new Date(currentDate);

    switch (rule.freq) {
      case 'DAILY':
        next.setDate(next.getDate() + rule.interval);
        break;

      case 'WEEKLY':
        if (rule.byDay && rule.byDay.length > 0) {
          // Find next day that matches byDay
          next.setDate(next.getDate() + 1);
          while (!this.matchesByDay(next, rule.byDay)) {
            next.setDate(next.getDate() + 1);
          }
        } else {
          // Simple weekly recurrence
          next.setDate(next.getDate() + (7 * rule.interval));
        }
        break;

      case 'MONTHLY':
        if (rule.byMonthDay && rule.byMonthDay.length > 0) {
          // Specific day(s) of month
          const currentMonth = next.getMonth();
          next.setMonth(currentMonth + rule.interval);
          next.setDate(rule.byMonthDay[0]); // Use first specified day
        } else if (rule.byDay && rule.byDay.length > 0) {
          // Specific weekday of month (e.g., "2nd Tuesday")
          next.setMonth(next.getMonth() + rule.interval);
          this.setToWeekdayOfMonth(next, rule.byDay[0], rule.bySetPos[0] || 1);
        } else {
          // Same day of month
          next.setMonth(next.getMonth() + rule.interval);
        }
        break;

      case 'YEARLY':
        if (rule.byMonth && rule.byMonth.length > 0) {
          next.setFullYear(next.getFullYear() + rule.interval);
          next.setMonth(rule.byMonth[0] - 1); // Months are 0-indexed
        } else {
          next.setFullYear(next.getFullYear() + rule.interval);
        }
        break;

      default:
        // Unsupported frequency
        next.setTime(next.getTime() + (24 * 60 * 60 * 1000)); // Daily fallback
    }

    return next;
  }

  /**
   * Check if a date matches the BYDAY rule
   * @param {Date} date - Date to check
   * @param {Array<string>} byDay - Array of day codes (e.g., ['MO', 'WE', 'FR'])
   * @returns {boolean}
   */
  static matchesByDay(date, byDay) {
    const dayMap = {
      'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3,
      'TH': 4, 'FR': 5, 'SA': 6
    };

    const dayOfWeek = date.getDay();
    return byDay.some(day => {
      // Handle numbered weekdays (e.g., "2MO" for 2nd Monday)
      const match = day.match(/^(-?\d+)?([A-Z]{2})$/);
      if (match) {
        const weekdayCode = match[2];
        return dayMap[weekdayCode] === dayOfWeek;
      }
      return false;
    });
  }

  /**
   * Set date to specific weekday of month
   * @param {Date} date - Date to modify
   * @param {string} weekday - Weekday code (e.g., 'MO', 'TU')
   * @param {number} position - Position in month (1-5, or -1 for last)
   */
  static setToWeekdayOfMonth(date, weekday, position = 1) {
    const dayMap = {
      'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3,
      'TH': 4, 'FR': 5, 'SA': 6
    };

    // Extract weekday code if it has a number prefix
    const match = weekday.match(/^(-?\d+)?([A-Z]{2})$/);
    const weekdayCode = match ? match[2] : weekday;
    const targetDay = dayMap[weekdayCode];

    date.setDate(1); // Start at first of month

    // Find first occurrence of the weekday
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }

    // Move to the nth occurrence
    if (position > 1) {
      date.setDate(date.getDate() + (7 * (position - 1)));
    } else if (position === -1) {
      // Last occurrence of the month
      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(0); // Last day of current month

      while (nextMonth.getDay() !== targetDay) {
        nextMonth.setDate(nextMonth.getDate() - 1);
      }
      date.setTime(nextMonth.getTime());
    }
  }

  /**
   * Check if a date is an exception
   * @param {Date} date - Date to check
   * @param {Object} rule - Rule object with exceptions
   * @returns {boolean}
   */
  static isException(date, rule) {
    if (!rule.exceptions || rule.exceptions.length === 0) {
      return false;
    }

    const dateStr = date.toDateString();
    return rule.exceptions.some(exDate => {
      const exceptionDate = exDate instanceof Date ? exDate : new Date(exDate);
      return exceptionDate.toDateString() === dateStr;
    });
  }

  /**
   * Parse date from RRULE format (YYYYMMDDTHHMMSSZ)
   * @param {string} dateStr - Date string in RRULE format
   * @returns {Date}
   */
  static parseDate(dateStr) {
    if (dateStr.length === 8) {
      // YYYYMMDD
      const year = parseInt(dateStr.substr(0, 4), 10);
      const month = parseInt(dateStr.substr(4, 2), 10) - 1;
      const day = parseInt(dateStr.substr(6, 2), 10);
      return new Date(year, month, day);
    } else if (dateStr.length === 15 || dateStr.length === 16) {
      // YYYYMMDDTHHMMSS[Z]
      const year = parseInt(dateStr.substr(0, 4), 10);
      const month = parseInt(dateStr.substr(4, 2), 10) - 1;
      const day = parseInt(dateStr.substr(6, 2), 10);
      const hour = parseInt(dateStr.substr(9, 2), 10);
      const minute = parseInt(dateStr.substr(11, 2), 10);
      const second = parseInt(dateStr.substr(13, 2), 10);

      if (dateStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        return new Date(year, month, day, hour, minute, second);
      }
    }

    // Fallback to standard date parsing
    return new Date(dateStr);
  }

  /**
   * Generate a human-readable description of the recurrence rule
   * @param {Object|string} rule - Recurrence rule
   * @returns {string} Human-readable description
   */
  static getDescription(rule) {
    if (typeof rule === 'string') {
      rule = this.parseRule(rule);
    }

    let description = '';
    const interval = rule.interval || 1;

    switch (rule.freq) {
      case 'DAILY':
        description = interval === 1 ? 'Daily' : `Every ${interval} days`;
        break;
      case 'WEEKLY':
        description = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
        if (rule.byDay && rule.byDay.length > 0) {
          const days = rule.byDay.map(d => this.getDayName(d)).join(', ');
          description += ` on ${days}`;
        }
        break;
      case 'MONTHLY':
        description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        if (rule.byMonthDay && rule.byMonthDay.length > 0) {
          description += ` on day ${rule.byMonthDay.join(', ')}`;
        }
        break;
      case 'YEARLY':
        description = interval === 1 ? 'Yearly' : `Every ${interval} years`;
        break;
    }

    if (rule.count) {
      description += `, ${rule.count} times`;
    } else if (rule.until) {
      description += `, until ${rule.until.toLocaleDateString()}`;
    }

    return description;
  }

  /**
   * Get day name from RRULE day code
   * @param {string} dayCode - Day code (e.g., 'MO', '2TU')
   * @returns {string} Day name
   */
  static getDayName(dayCode) {
    const dayNames = {
      'SU': 'Sunday', 'MO': 'Monday', 'TU': 'Tuesday',
      'WE': 'Wednesday', 'TH': 'Thursday', 'FR': 'Friday',
      'SA': 'Saturday'
    };

    // Extract day code if it has a number prefix
    const match = dayCode.match(/^(-?\d+)?([A-Z]{2})$/);
    const code = match ? match[2] : dayCode;
    const position = match && match[1] ? parseInt(match[1], 10) : null;

    let name = dayNames[code] || dayCode;

    if (position) {
      const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th'];
      const ordinal = position === -1 ? 'Last' : (ordinals[position] || `${position}th`);
      name = `${ordinal} ${name}`;
    }

    return name;
  }
}