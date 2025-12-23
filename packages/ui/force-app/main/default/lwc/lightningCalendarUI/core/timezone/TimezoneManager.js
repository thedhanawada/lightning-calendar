/**
 * TimezoneManager - Comprehensive timezone handling for global calendar operations
 * Handles timezone conversions, DST transitions, and IANA timezone database
 *
 * Critical for Salesforce orgs spanning multiple timezones
 */

export class TimezoneManager {
    constructor() {
        // Cache timezone offsets for performance
        this.offsetCache = new Map();
        this.dstCache = new Map();

        // Common timezone abbreviations to IANA mapping
        this.timezoneAbbreviations = {
            'EST': 'America/New_York',
            'EDT': 'America/New_York',
            'CST': 'America/Chicago',
            'CDT': 'America/Chicago',
            'MST': 'America/Denver',
            'MDT': 'America/Denver',
            'PST': 'America/Los_Angeles',
            'PDT': 'America/Los_Angeles',
            'GMT': 'Europe/London',
            'BST': 'Europe/London',
            'CET': 'Europe/Paris',
            'CEST': 'Europe/Paris',
            'JST': 'Asia/Tokyo',
            'IST': 'Asia/Kolkata',
            'AEST': 'Australia/Sydney',
            'AEDT': 'Australia/Sydney'
        };

        // IANA timezone offset rules (simplified - in production would use Intl API or timezone database)
        this.timezoneOffsets = {
            'UTC': 0,
            'America/New_York': -5,
            'America/Chicago': -6,
            'America/Denver': -7,
            'America/Los_Angeles': -8,
            'America/Phoenix': -7, // No DST
            'Europe/London': 0,
            'Europe/Paris': 1,
            'Europe/Berlin': 1,
            'Asia/Tokyo': 9,
            'Asia/Shanghai': 8,
            'Asia/Kolkata': 5.5,
            'Australia/Sydney': 10,
            'Pacific/Auckland': 12
        };

        // DST rules (simplified - real implementation would be more complex)
        this.dstRules = {
            'America/New_York': { start: { month: 3, week: 2, day: 0 }, end: { month: 11, week: 1, day: 0 }, offset: 1 },
            'America/Chicago': { start: { month: 3, week: 2, day: 0 }, end: { month: 11, week: 1, day: 0 }, offset: 1 },
            'America/Denver': { start: { month: 3, week: 2, day: 0 }, end: { month: 11, week: 1, day: 0 }, offset: 1 },
            'America/Los_Angeles': { start: { month: 3, week: 2, day: 0 }, end: { month: 11, week: 1, day: 0 }, offset: 1 },
            'Europe/London': { start: { month: 3, week: -1, day: 0 }, end: { month: 10, week: -1, day: 0 }, offset: 1 },
            'Europe/Paris': { start: { month: 3, week: -1, day: 0 }, end: { month: 10, week: -1, day: 0 }, offset: 1 },
            'Australia/Sydney': { start: { month: 10, week: 1, day: 0 }, end: { month: 4, week: 1, day: 0 }, offset: 1 }
        };
    }

    /**
     * Convert date from one timezone to another
     * @param {Date} date - Date to convert
     * @param {string} fromTimezone - Source timezone (IANA identifier)
     * @param {string} toTimezone - Target timezone (IANA identifier)
     * @returns {Date} Converted date
     */
    convertTimezone(date, fromTimezone, toTimezone) {
        if (!date) return null;
        if (fromTimezone === toTimezone) return new Date(date);

        // Get offset difference
        const fromOffset = this.getTimezoneOffset(date, fromTimezone);
        const toOffset = this.getTimezoneOffset(date, toTimezone);
        const offsetDiff = (toOffset - fromOffset) * 60 * 1000; // Convert to milliseconds

        return new Date(date.getTime() + offsetDiff);
    }

    /**
     * Convert date to UTC
     * @param {Date} date - Date in local timezone
     * @param {string} timezone - Source timezone
     * @returns {Date} Date in UTC
     */
    toUTC(date, timezone) {
        if (!date) return null;
        if (timezone === 'UTC') return new Date(date);

        const offset = this.getTimezoneOffset(date, timezone);
        return new Date(date.getTime() - (offset * 60 * 1000));
    }

    /**
     * Convert UTC date to timezone
     * @param {Date} utcDate - Date in UTC
     * @param {string} timezone - Target timezone
     * @returns {Date} Date in specified timezone
     */
    fromUTC(utcDate, timezone) {
        if (!utcDate) return null;
        if (timezone === 'UTC') return new Date(utcDate);

        const offset = this.getTimezoneOffset(utcDate, timezone);
        return new Date(utcDate.getTime() + (offset * 60 * 1000));
    }

    /**
     * Get timezone offset in minutes
     * @param {Date} date - Date to check (for DST calculation)
     * @param {string} timezone - Timezone identifier
     * @returns {number} Offset in minutes from UTC
     */
    getTimezoneOffset(date, timezone) {
        // Check cache first
        const cacheKey = `${timezone}_${date.getFullYear()}_${date.getMonth()}_${date.getDate()}`;
        if (this.offsetCache.has(cacheKey)) {
            return this.offsetCache.get(cacheKey);
        }

        // Try using Intl API if available (best option for browser/Node.js environments)
        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
            try {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                // Create same date in target timezone
                const parts = formatter.formatToParts(date);
                const tzDate = new Date(
                    parts.find(p => p.type === 'year').value,
                    parts.find(p => p.type === 'month').value - 1,
                    parts.find(p => p.type === 'day').value,
                    parts.find(p => p.type === 'hour').value,
                    parts.find(p => p.type === 'minute').value,
                    parts.find(p => p.type === 'second').value
                );

                const offset = (tzDate.getTime() - date.getTime()) / (1000 * 60);
                this.offsetCache.set(cacheKey, -offset);
                return -offset;
            } catch (e) {
                // Fallback to manual calculation
            }
        }

        // Fallback: Manual calculation
        let baseOffset = (this.timezoneOffsets[timezone] || 0) * 60;

        // Apply DST if applicable
        if (this.isDST(date, timezone)) {
            const dstRule = this.dstRules[timezone];
            if (dstRule) {
                baseOffset += dstRule.offset * 60;
            }
        }

        this.offsetCache.set(cacheKey, baseOffset);
        return baseOffset;
    }

    /**
     * Check if date is in DST for given timezone
     * @param {Date} date - Date to check
     * @param {string} timezone - Timezone identifier
     * @returns {boolean} True if in DST
     */
    isDST(date, timezone) {
        const dstRule = this.dstRules[timezone];
        if (!dstRule) return false;

        const year = date.getFullYear();
        const dstStart = this.getNthWeekdayOfMonth(year, dstRule.start.month, dstRule.start.week, dstRule.start.day);
        const dstEnd = this.getNthWeekdayOfMonth(year, dstRule.end.month, dstRule.end.week, dstRule.end.day);

        // Handle Southern Hemisphere (DST crosses year boundary)
        if (dstStart > dstEnd) {
            return date >= dstStart || date < dstEnd;
        }

        return date >= dstStart && date < dstEnd;
    }

    /**
     * Get nth weekday of month
     * @private
     */
    getNthWeekdayOfMonth(year, month, week, dayOfWeek) {
        const date = new Date(year, month, 1);
        const firstDay = date.getDay();

        let dayOffset = dayOfWeek - firstDay;
        if (dayOffset < 0) dayOffset += 7;

        if (week > 0) {
            // Nth occurrence from start
            date.setDate(1 + dayOffset + (week - 1) * 7);
        } else {
            // Nth occurrence from end
            const lastDay = new Date(year, month + 1, 0).getDate();
            date.setDate(lastDay);
            const lastDayOfWeek = date.getDay();
            let offset = lastDayOfWeek - dayOfWeek;
            if (offset < 0) offset += 7;
            date.setDate(lastDay - offset + (week + 1) * 7);
        }

        return date;
    }

    /**
     * Get list of common timezones
     * @returns {Array<{value: string, label: string, offset: string}>}
     */
    getCommonTimezones() {
        const now = new Date();
        const timezones = [
            { value: 'America/New_York', label: 'Eastern Time (New York)', region: 'Americas' },
            { value: 'America/Chicago', label: 'Central Time (Chicago)', region: 'Americas' },
            { value: 'America/Denver', label: 'Mountain Time (Denver)', region: 'Americas' },
            { value: 'America/Phoenix', label: 'Mountain Time - Arizona (Phoenix)', region: 'Americas' },
            { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)', region: 'Americas' },
            { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)', region: 'Americas' },
            { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)', region: 'Pacific' },
            { value: 'America/Toronto', label: 'Eastern Time (Toronto)', region: 'Americas' },
            { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)', region: 'Americas' },
            { value: 'America/Mexico_City', label: 'Central Time (Mexico City)', region: 'Americas' },
            { value: 'America/Sao_Paulo', label: 'Brasilia Time (São Paulo)', region: 'Americas' },
            { value: 'Europe/London', label: 'GMT/BST (London)', region: 'Europe' },
            { value: 'Europe/Paris', label: 'Central European Time (Paris)', region: 'Europe' },
            { value: 'Europe/Berlin', label: 'Central European Time (Berlin)', region: 'Europe' },
            { value: 'Europe/Moscow', label: 'Moscow Time', region: 'Europe' },
            { value: 'Asia/Dubai', label: 'Gulf Time (Dubai)', region: 'Asia' },
            { value: 'Asia/Kolkata', label: 'India Time (Mumbai)', region: 'Asia' },
            { value: 'Asia/Shanghai', label: 'China Time (Shanghai)', region: 'Asia' },
            { value: 'Asia/Tokyo', label: 'Japan Time (Tokyo)', region: 'Asia' },
            { value: 'Asia/Seoul', label: 'Korea Time (Seoul)', region: 'Asia' },
            { value: 'Asia/Singapore', label: 'Singapore Time', region: 'Asia' },
            { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)', region: 'Oceania' },
            { value: 'Australia/Melbourne', label: 'Australian Eastern Time (Melbourne)', region: 'Oceania' },
            { value: 'Pacific/Auckland', label: 'New Zealand Time (Auckland)', region: 'Oceania' },
            { value: 'UTC', label: 'UTC', region: 'UTC' }
        ];

        // Add current offset to each timezone
        return timezones.map(tz => {
            const offset = this.getTimezoneOffset(now, tz.value);
            const offsetHours = -offset / 60; // Convert to hours from UTC
            const hours = Math.floor(Math.abs(offsetHours));
            const minutes = Math.round(Math.abs(offsetHours % 1) * 60);
            const sign = offsetHours >= 0 ? '+' : '-';
            const offsetStr = `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            return {
                ...tz,
                offset: offsetStr,
                offsetMinutes: -offset // Store in minutes for sorting
            };
        }).sort((a, b) => a.offsetMinutes - b.offsetMinutes);
    }

    /**
     * Format date in specific timezone
     * @param {Date} date - Date to format
     * @param {string} timezone - Timezone for formatting
     * @param {Object} options - Formatting options
     * @returns {string} Formatted date string
     */
    formatInTimezone(date, timezone, options = {}) {
        if (!date) return '';

        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        };

        const formatOptions = { ...defaultOptions, ...options };

        try {
            return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
        } catch (e) {
            // Fallback to basic formatting
            const tzDate = this.fromUTC(this.toUTC(date, 'UTC'), timezone);
            return tzDate.toLocaleString('en-US', options);
        }
    }

    /**
     * Get timezone from browser/system
     * @returns {string} IANA timezone identifier
     */
    getSystemTimezone() {
        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
            try {
                return Intl.DateTimeFormat().resolvedOptions().timeZone;
            } catch (e) {
                // Fallback
            }
        }

        // Fallback based on offset
        const offset = new Date().getTimezoneOffset();
        const offsetHours = -offset / 60;

        // Try to match offset to known timezone
        for (const [tz, tzOffset] of Object.entries(this.timezoneOffsets)) {
            if (tzOffset === offsetHours) {
                return tz;
            }
        }

        return 'UTC';
    }

    /**
     * Parse timezone from string (handles abbreviations)
     * @param {string} tzString - Timezone string
     * @returns {string} IANA timezone identifier
     */
    parseTimezone(tzString) {
        if (!tzString) return 'UTC';

        // Check if it's already an IANA identifier
        if (this.timezoneOffsets.hasOwnProperty(tzString)) {
            return tzString;
        }

        // Check abbreviations
        const upperTz = tzString.toUpperCase();
        if (this.timezoneAbbreviations.hasOwnProperty(upperTz)) {
            return this.timezoneAbbreviations[upperTz];
        }

        // Try to parse offset format (e.g., "+05:30", "-08:00")
        const offsetMatch = tzString.match(/^([+-])(\d{2}):?(\d{2})$/);
        if (offsetMatch) {
            const sign = offsetMatch[1] === '+' ? 1 : -1;
            const hours = parseInt(offsetMatch[2], 10);
            const minutes = parseInt(offsetMatch[3], 10);
            const totalOffset = sign * (hours + minutes / 60);

            // Find matching timezone
            for (const [tz, offset] of Object.entries(this.timezoneOffsets)) {
                if (offset === totalOffset) {
                    return tz;
                }
            }
        }

        return 'UTC';
    }

    /**
     * Calculate timezone difference in hours
     * @param {string} timezone1 - First timezone
     * @param {string} timezone2 - Second timezone
     * @param {Date} [date] - Date for DST calculation
     * @returns {number} Hour difference
     */
    getTimezoneDifference(timezone1, timezone2, date = new Date()) {
        const offset1 = this.getTimezoneOffset(date, timezone1);
        const offset2 = this.getTimezoneOffset(date, timezone2);
        return (offset2 - offset1) / 60;
    }

    /**
     * Clear caches (useful when date changes significantly)
     */
    clearCache() {
        this.offsetCache.clear();
        this.dstCache.clear();
    }
}