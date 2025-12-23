import { LightningElement, api, track } from 'lwc';
import { Calendar } from './core/calendar/Calendar.js';

/**
 * Lightning Calendar Core Component
 * Production-ready calendar with SLDS styling
 */
export default class LightningCalendarCore extends LightningElement {
    // Public API properties (configurable in App Builder)
    @api defaultView = 'month';
    @api timezone = 'America/New_York';
    @api height = 600;

    // Internal state
    @track currentView = 'month';
    @track currentDate = new Date();
    @track viewData = null;
    @track events = [];

    // Core calendar instance
    calendar = null;
    isInitialized = false;

    // Lifecycle
    connectedCallback() {
        this.initializeCalendar();
    }

    disconnectedCallback() {
        if (this.calendar) {
            this.calendar.destroy?.();
        }
    }

    // Initialize core calendar
    initializeCalendar() {
        this.calendar = new Calendar({
            view: this.defaultView,
            date: this.currentDate,
            timezone: this.timezone
        });

        this.currentView = this.defaultView;
        this.isInitialized = true;
        this.updateViewData();
        this.loadSampleEvents();
    }

    // Update view data from core
    updateViewData() {
        if (this.calendar) {
            this.viewData = this.calendar.getViewData();
        }
    }

    // Sample events (replace with real Salesforce data)
    loadSampleEvents() {
        const today = new Date();
        const sampleEvents = [
            {
                id: '1',
                title: 'Team Meeting',
                start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
                end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
                timezone: this.timezone
            },
            {
                id: '2',
                title: 'Client Call',
                start: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 14, 0),
                end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 15, 0),
                timezone: this.timezone
            }
        ];

        this.events = sampleEvents;
        this.calendar.setEvents(sampleEvents);
        this.updateViewData();
    }

    // Computed properties
    get containerStyle() {
        return `height: ${this.height}px;`;
    }

    get calendarTitle() {
        if (!this.viewData) return '';

        switch (this.currentView) {
            case 'month':
                return `${this.getMonthName(this.viewData.month)} ${this.viewData.year}`;
            case 'week':
                return `Week of ${this.formatDate(this.viewData.startDate)}`;
            case 'day':
                return this.formatDate(this.currentDate);
            case 'list':
                return 'All Events';
            default:
                return '';
        }
    }

    get isMonthView() {
        return this.currentView === 'month';
    }

    get isWeekView() {
        return this.currentView === 'week';
    }

    get isDayView() {
        return this.currentView === 'day';
    }

    get isListView() {
        return this.currentView === 'list';
    }

    get monthViewData() {
        if (!this.isMonthView || !this.viewData) return [];

        const weeks = [];
        const { weeks: coreWeeks } = this.viewData;

        if (coreWeeks && Array.isArray(coreWeeks)) {
            coreWeeks.forEach(week => {
                if (week && week.days && Array.isArray(week.days)) {
                    const days = week.days.map(dayData => {
                        return {
                            date: dayData.date.toISOString(),
                            dayNumber: dayData.dayOfMonth,
                            isToday: dayData.isToday,
                            isOtherMonth: !dayData.isCurrentMonth,
                            dayClass: this.getDayClass(dayData.isToday, !dayData.isCurrentMonth),
                            events: dayData.events || [],
                            hasEvents: dayData.events && dayData.events.length > 0
                        };
                    });
                    weeks.push({ days });
                }
            });
        }

        return weeks;
    }

    get weekDayNames() {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }

    get monthViewVariant() {
        return this.currentView === 'month' ? 'brand' : 'neutral';
    }

    get weekViewVariant() {
        return this.currentView === 'week' ? 'brand' : 'neutral';
    }

    get dayViewVariant() {
        return this.currentView === 'day' ? 'brand' : 'neutral';
    }

    get listViewVariant() {
        return this.currentView === 'list' ? 'brand' : 'neutral';
    }

    // Event handlers
    handlePrevious() {
        this.calendar.previous();
        this.currentDate = this.calendar.getCurrentDate();
        this.updateViewData();
    }

    handleToday() {
        this.calendar.today();
        this.currentDate = this.calendar.getCurrentDate();
        this.updateViewData();
    }

    handleNext() {
        this.calendar.next();
        this.currentDate = this.calendar.getCurrentDate();
        this.updateViewData();
    }

    handleViewChange(event) {
        const view = event.currentTarget.dataset.view;
        this.currentView = view;
        this.calendar.setView(view);
        this.updateViewData();
    }

    handleEventClick(event) {
        const eventId = event.currentTarget.dataset.eventId;
        const calendarEvent = this.events.find(e => e.id === eventId);

        if (calendarEvent) {
            this.dispatchEvent(new CustomEvent('eventclick', {
                detail: { event: calendarEvent }
            }));
        }
    }

    handleDateClick(event) {
        const dateStr = event.currentTarget.dataset.date;
        if (dateStr) {
            const date = new Date(dateStr);
            this.dispatchEvent(new CustomEvent('dateclick', {
                detail: { date }
            }));
        }
    }

    // Helper methods
    getEventsForDate(date) {
        return this.events.filter(event =>
            event.start.toDateString() === date.toDateString()
        );
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getDayClass(isToday, isOtherMonth) {
        if (isToday) {
            return 'calendar-day today';
        }
        if (isOtherMonth) {
            return 'calendar-day other-month';
        }
        return 'calendar-day';
    }

    getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex];
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}
