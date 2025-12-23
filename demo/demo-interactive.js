/**
 * Lightning Calendar Core - Interactive Demo with Timezone Support
 */

import { Calendar } from '../packages/core/src/index.js';

class InteractiveDemo {
    constructor() {
        this.currentTimezone = 'America/New_York';
        this.currentView = 'month';
        this.currentDate = new Date();
        this.eventIdCounter = 1;
        this.conflicts = [];

        // Initialize calendar with timezone support
        this.calendar = new Calendar({
            timeZone: this.currentTimezone
        });

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSampleEvents();
        this.updateTimezoneDisplay();
        this.renderCalendar();
        this.updateStatistics();

        // Update time display every second
        setInterval(() => this.updateTimezoneDisplay(), 1000);
    }

    setupEventListeners() {
        // Timezone selector
        document.getElementById('timezoneSelect').addEventListener('change', (e) => {
            this.currentTimezone = e.target.value;
            this.calendar.setTimezone(this.currentTimezone);
            this.updateTimezoneDisplay();
            this.renderCalendar();
            this.updateTimezoneEvents();
        });

        // View buttons
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.renderCalendar();
            });
        });

        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => {
            if (this.currentView === 'month') {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            } else if (this.currentView === 'week') {
                this.currentDate.setDate(this.currentDate.getDate() - 7);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() - 1);
            }
            this.renderCalendar();
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderCalendar();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            if (this.currentView === 'month') {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            } else if (this.currentView === 'week') {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() + 1);
            }
            this.renderCalendar();
        });

        // Detect conflicts
        document.getElementById('detectConflictsBtn').addEventListener('click', () => {
            this.detectConflicts();
        });

        // Quick add form
        document.getElementById('quickAddForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEventFromForm();
        });

        // Set today's date as default
        const today = new Date();
        document.getElementById('eventDate').value = today.toISOString().split('T')[0];
    }

    loadSampleEvents() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Add events in different timezones
        const sampleEvents = [
            {
                id: `event-${this.eventIdCounter++}`,
                title: 'New York Team Standup',
                start: this.createDateInTimezone(today, 9, 0, 'America/New_York'),
                end: this.createDateInTimezone(today, 9, 30, 'America/New_York'),
                timeZone: 'America/New_York',
                categories: ['meeting', 'daily']
            },
            {
                id: `event-${this.eventIdCounter++}`,
                title: 'London Client Call',
                start: this.createDateInTimezone(today, 14, 0, 'Europe/London'),
                end: this.createDateInTimezone(today, 15, 0, 'Europe/London'),
                timeZone: 'Europe/London',
                categories: ['client', 'important']
            },
            {
                id: `event-${this.eventIdCounter++}`,
                title: 'Tokyo Product Launch',
                start: this.createDateInTimezone(tomorrow, 10, 0, 'Asia/Tokyo'),
                end: this.createDateInTimezone(tomorrow, 12, 0, 'Asia/Tokyo'),
                timeZone: 'Asia/Tokyo',
                categories: ['launch', 'important']
            },
            {
                id: `event-${this.eventIdCounter++}`,
                title: 'LA Design Review',
                start: this.createDateInTimezone(today, 15, 0, 'America/Los_Angeles'),
                end: this.createDateInTimezone(today, 16, 0, 'America/Los_Angeles'),
                timeZone: 'America/Los_Angeles',
                categories: ['review']
            },
            // Add a conflicting event
            {
                id: `event-${this.eventIdCounter++}`,
                title: 'Conflicting Meeting',
                start: this.createDateInTimezone(today, 14, 30, 'Europe/London'),
                end: this.createDateInTimezone(today, 15, 30, 'Europe/London'),
                timeZone: 'Europe/London',
                categories: ['meeting']
            }
        ];

        sampleEvents.forEach(event => {
            this.calendar.addEvent(event);
        });

        this.updateTimezoneEvents();
    }

    createDateInTimezone(baseDate, hour, minute, timezone) {
        const date = new Date(baseDate);
        date.setHours(hour, minute, 0, 0);
        return date;
    }

    addEventFromForm() {
        const title = document.getElementById('eventTitle').value;
        const date = document.getElementById('eventDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const timezone = document.getElementById('eventTimezone').value;

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startDate = new Date(date);
        startDate.setHours(startHour, startMinute, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(endHour, endMinute, 0, 0);

        const event = {
            id: `event-${this.eventIdCounter++}`,
            title: title,
            start: startDate,
            end: endDate,
            timeZone: timezone,
            categories: ['user-created']
        };

        this.calendar.addEvent(event);

        // Reset form
        document.getElementById('quickAddForm').reset();
        document.getElementById('eventDate').value = new Date().toISOString().split('T')[0];

        // Update displays
        this.renderCalendar();
        this.updateStatistics();
        this.updateTimezoneEvents();
        this.detectConflicts();
    }

    updateTimezoneDisplay() {
        const now = new Date();
        const timeString = this.calendar.formatInTimezone(now, this.currentTimezone, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
        document.getElementById('currentTime').textContent = timeString;
    }

    updateTimezoneEvents() {
        const container = document.getElementById('timezoneEvents');
        const events = this.calendar.getEvents();

        if (events.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No events to display</div>';
            return;
        }

        // Show first 5 events with times in multiple timezones
        const displayEvents = events.slice(0, 5);
        const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];

        container.innerHTML = displayEvents.map(event => {
            const timezoneStrings = timezones.map(tz => {
                const startStr = this.calendar.formatInTimezone(event.start, tz, {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const tzName = tz.split('/')[1];
                return `${tzName}: ${startStr}`;
            }).join(' | ');

            return `
                <div class="tz-event-item">
                    <div class="tz-event-title">${event.title}</div>
                    <div class="tz-event-times">${timezoneStrings}</div>
                </div>
            `;
        }).join('');
    }

    detectConflicts() {
        const events = this.calendar.getEvents();
        this.conflicts = [];

        for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
                const e1 = events[i];
                const e2 = events[j];

                // Check if events overlap
                if (e1.startUTC < e2.endUTC && e2.startUTC < e1.endUTC) {
                    this.conflicts.push({
                        event1: e1,
                        event2: e2,
                        type: 'time',
                        severity: 'warning'
                    });
                }
            }
        }

        this.displayConflicts();
        this.updateStatistics();
        this.renderCalendar(); // Re-render to show conflicts
    }

    displayConflicts() {
        const container = document.getElementById('conflictList');

        if (this.conflicts.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No conflicts detected</div>';
            return;
        }

        container.innerHTML = this.conflicts.map(conflict => {
            const time1 = this.calendar.formatInTimezone(conflict.event1.start, this.currentTimezone, {
                hour: '2-digit',
                minute: '2-digit'
            });
            const time2 = this.calendar.formatInTimezone(conflict.event2.start, this.currentTimezone, {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="conflict-item ${conflict.severity === 'severe' ? 'severe' : ''}">
                    <strong>Time Conflict:</strong><br>
                    "${conflict.event1.title}" at ${time1}<br>
                    overlaps with<br>
                    "${conflict.event2.title}" at ${time2}
                </div>
            `;
        }).join('');
    }

    renderCalendar() {
        const container = document.getElementById('calendarContent');

        switch (this.currentView) {
            case 'month':
                this.renderMonthView(container);
                break;
            case 'week':
                this.renderWeekView(container);
                break;
            case 'day':
                this.renderDayView(container);
                break;
        }

        this.updateCalendarTitle();
        this.updateStatistics();
    }

    renderMonthView(container) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let html = '<div class="calendar-grid">';

        // Day headers
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });

        // Calendar days
        const today = new Date();
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const isToday = date.toDateString() === today.toDateString();
            const isOtherMonth = date.getMonth() !== month;

            const events = this.calendar.getEventsForDate(date, this.currentTimezone);

            // Check if any events have conflicts
            const conflictingEventIds = new Set();
            this.conflicts.forEach(c => {
                conflictingEventIds.add(c.event1.id);
                conflictingEventIds.add(c.event2.id);
            });

            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isOtherMonth ? 'other-month' : ''}">
                    <div class="day-number">${date.getDate()}</div>
                    <div class="day-events">
                        ${events.slice(0, 3).map(event => `
                            <div class="calendar-event ${conflictingEventIds.has(event.id) ? 'conflict' : ''}"
                                 title="${event.title} (${event.timeZone})">
                                ${this.formatEventTime(event)} ${event.title}
                            </div>
                        `).join('')}
                        ${events.length > 3 ? `<div style="font-size: 11px; color: #666;">+${events.length - 3} more</div>` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    renderWeekView(container) {
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        let html = '<div style="padding: 20px;">';
        html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px;">';

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const events = this.calendar.getEventsForDate(date, this.currentTimezone);

            html += `
                <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                    <h4 style="margin: 0 0 10px 0;">${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h4>
                    ${events.map(event => `
                        <div style="padding: 5px; background: #0070f3; color: white; border-radius: 3px; margin-bottom: 5px; font-size: 12px;">
                            ${this.formatEventTime(event)} ${event.title}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += '</div></div>';
        container.innerHTML = html;
    }

    renderDayView(container) {
        const events = this.calendar.getEventsForDate(this.currentDate, this.currentTimezone);

        let html = '<div style="padding: 20px;">';
        html += `<h3>${this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>`;

        if (events.length === 0) {
            html += '<p style="color: #999;">No events scheduled for this day</p>';
        } else {
            html += '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">';
            events.forEach(event => {
                const startTime = this.calendar.formatInTimezone(event.start, this.currentTimezone, {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const endTime = this.calendar.formatInTimezone(event.end, this.currentTimezone, {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                html += `
                    <div style="padding: 15px; background: white; border-left: 4px solid #0070f3; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-weight: 500; margin-bottom: 5px;">${event.title}</div>
                        <div style="font-size: 14px; color: #666;">
                            ${startTime} - ${endTime}
                            <span style="margin-left: 10px; padding: 2px 6px; background: #f0f0f0; border-radius: 3px; font-size: 12px;">
                                ${event.timeZone}
                            </span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    formatEventTime(event) {
        const time = this.calendar.formatInTimezone(event.start, this.currentTimezone, {
            hour: 'numeric',
            minute: '2-digit'
        });
        return time;
    }

    updateCalendarTitle() {
        const title = document.getElementById('calendarTitle');

        if (this.currentView === 'month') {
            title.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (this.currentView === 'week') {
            const startOfWeek = new Date(this.currentDate);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            title.textContent = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            title.textContent = this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
    }

    updateStatistics() {
        const events = this.calendar.getEvents();
        const today = new Date();
        const todayEvents = this.calendar.getEventsForDate(today, this.currentTimezone);

        // Count unique timezones
        const timezones = new Set(events.map(e => e.timeZone));

        document.getElementById('totalEvents').textContent = events.length;
        document.getElementById('todayEvents').textContent = todayEvents.length;
        document.getElementById('conflictCount').textContent = this.conflicts.length;
        document.getElementById('timezoneCount').textContent = timezones.size;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new InteractiveDemo());
} else {
    new InteractiveDemo();
}