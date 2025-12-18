import { LightningElement, api, track } from 'lwc';
import { Calendar } from './core/calendar/Calendar.js';

/**
 * Lightning Calendar - LWC Wrapper
 * Enterprise-grade calendar component for Salesforce Lightning
 */
export default class LightningCalendar extends LightningElement {
    // Public API properties
    @api view = 'month';
    @api weekStartsOn = 0;
    @api locale = 'en-US';
    @api showWeekNumbers = false;
    @api showWeekends = false;
    @api fixedWeekCount = false;
    @api height = '600px';

    // Tracked properties
    @track currentDate = new Date();
    @track selectedEventId = null;
    @track selectedDate = null;
    @track _viewData = null;

    // Private properties
    _calendar = null;
    _events = [];
    _isInitialized = false;

    /**
     * Events API - accepts array of event objects
     */
    @api
    get events() {
        return this._events;
    }

    set events(value) {
        this._events = Array.isArray(value) ? value : [];
        if (this._calendar && this._isInitialized) {
            this._calendar.setEvents(this._events);
            this._updateViewData(); // Refresh view after setting events
        }
    }

    /**
     * Current date API
     */
    @api
    get date() {
        return this.currentDate;
    }

    set date(value) {
        this.currentDate = value instanceof Date ? value : new Date(value);
        if (this._calendar) {
            this._calendar.goToDate(this.currentDate);
        }
    }

    /**
     * Business hours configuration
     */
    @api businessHoursStart = '09:00';
    @api businessHoursEnd = '17:00';

    /**
     * Lifecycle: Component connected to DOM
     */
    connectedCallback() {
        this.initializeCalendar();
    }

    /**
     * Lifecycle: Component disconnected from DOM
     */
    disconnectedCallback() {
        if (this._calendar) {
            this._calendar.destroy();
        }
    }

    /**
     * Initialize the calendar core
     */
    initializeCalendar() {
        this._calendar = new Calendar({
            view: this.view,
            date: this.currentDate,
            weekStartsOn: this.weekStartsOn,
            locale: this.locale,
            showWeekNumbers: this.showWeekNumbers,
            showWeekends: this.showWeekends,
            fixedWeekCount: this.fixedWeekCount,
            businessHours: {
                start: this.businessHoursStart,
                end: this.businessHoursEnd
            },
            events: this._events
        });

        // Set up event listeners
        this._calendar.on('eventAdd', this.handleEventAdd.bind(this));
        this._calendar.on('eventUpdate', this.handleEventUpdate.bind(this));
        this._calendar.on('eventRemove', this.handleEventRemove.bind(this));
        this._calendar.on('navigate', this.handleNavigate.bind(this));
        this._calendar.on('viewChange', this.handleViewChange.bind(this));
        this._calendar.on('eventSelect', this.handleEventSelect.bind(this));
        this._calendar.on('dateSelect', this.handleDateSelect.bind(this));

        this._isInitialized = true;

        // Set initial view data
        this._updateViewData();
    }

    /**
     * Get view data for rendering
     */
    get viewData() {
        return this._viewData;
    }

    /**
     * Update view data from calendar
     */
    _updateViewData() {
        if (this._calendar) {
            this._viewData = this._calendar.getViewData();
        }
    }

    /**
     * Get current view type
     */
    get currentView() {
        return this._calendar ? this._calendar.getView() : this.view;
    }

    /**
     * Get formatted title for header
     */
    get calendarTitle() {
        const data = this.viewData;
        if (!data) return '';

        switch (data.type) {
            case 'month':
                return `${data.monthName} ${data.year}`;
            case 'week':
                return `Week ${data.weekNumber}, ${data.startDate.getFullYear()}`;
            case 'day':
                return data.date.toLocaleDateString(this.locale, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'list':
                return 'Event List';
            default:
                return '';
        }
    }

    /**
     * Check if current view is month
     */
    get isMonthView() {
        return this.currentView === 'month';
    }

    /**
     * Check if current view is week
     */
    get isWeekView() {
        return this.currentView === 'week';
    }

    /**
     * Check if current view is day
     */
    get isDayView() {
        return this.currentView === 'day';
    }

    /**
     * Check if current view is list
     */
    get isListView() {
        return this.currentView === 'list';
    }

    /**
     * Get container style
     */
    get containerStyle() {
        return `height: ${this.height};`;
    }

    /**
     * Get variant for month view button
     */
    get monthViewVariant() {
        return this.isMonthView ? 'brand' : 'neutral';
    }

    /**
     * Get variant for week view button
     */
    get weekViewVariant() {
        return this.isWeekView ? 'brand' : 'neutral';
    }

    /**
     * Get variant for day view button
     */
    get dayViewVariant() {
        return this.isDayView ? 'brand' : 'neutral';
    }

    /**
     * Get variant for list view button
     */
    get listViewVariant() {
        return this.isListView ? 'brand' : 'neutral';
    }

    // ========== Public API Methods ==========

    /**
     * Add an event to the calendar
     */
    @api
    addEvent(eventData) {
        if (this._calendar) {
            return this._calendar.addEvent(eventData);
        }
        return null;
    }

    /**
     * Update an event
     */
    @api
    updateEvent(eventId, updates) {
        if (this._calendar) {
            return this._calendar.updateEvent(eventId, updates);
        }
        return null;
    }

    /**
     * Remove an event
     */
    @api
    removeEvent(eventId) {
        if (this._calendar) {
            return this._calendar.removeEvent(eventId);
        }
        return false;
    }

    /**
     * Get an event by ID
     */
    @api
    getEvent(eventId) {
        if (this._calendar) {
            return this._calendar.getEvent(eventId);
        }
        return null;
    }

    /**
     * Navigate to next period
     */
    @api
    next() {
        if (this._calendar) {
            this._calendar.next();
        }
    }

    /**
     * Navigate to previous period
     */
    @api
    previous() {
        if (this._calendar) {
            this._calendar.previous();
        }
    }

    /**
     * Navigate to today
     */
    @api
    today() {
        if (this._calendar) {
            this._calendar.today();
        }
    }

    /**
     * Get current date from calendar
     */
    @api
    getCurrentDate() {
        if (this._calendar) {
            return this._calendar.getCurrentDate();
        }
        return this.currentDate;
    }

    /**
     * Set the calendar view
     */
    @api
    setView(viewType) {
        if (this._calendar) {
            this._calendar.setView(viewType);
            this.view = viewType;
        }
    }

    /**
     * Refresh the calendar
     */
    @api
    refresh() {
        // Update view data to trigger re-render
        this._updateViewData();
    }

    // ========== Event Handlers ==========

    /**
     * Handle previous button click
     */
    handlePreviousClick() {
        this.previous();
    }

    /**
     * Handle next button click
     */
    handleNextClick() {
        this.next();
    }

    /**
     * Handle today button click
     */
    handleTodayClick() {
        this.today();
    }

    /**
     * Handle view button clicks
     */
    handleViewButtonClick(event) {
        const viewType = event.target.dataset.view;
        if (viewType) {
            this.setView(viewType);
        }
    }

    /**
     * Handle date cell click
     */
    handleDateClick(event) {
        const dateStr = event.target.dataset.date;
        if (dateStr) {
            const date = new Date(dateStr);

            // Dispatch custom event
            this.dispatchEvent(new CustomEvent('dateclick', {
                detail: { date }
            }));
        }
    }

    /**
     * Handle event click
     */
    handleEventClick(event) {
        const eventId = event.target.dataset.eventId;
        if (eventId) {
            const calendarEvent = this.getEvent(eventId);

            // Dispatch custom event
            this.dispatchEvent(new CustomEvent('eventclick', {
                detail: { event: calendarEvent }
            }));
        }
    }

    // ========== Calendar Core Event Handlers ==========

    /**
     * Handle event add from core
     */
    handleEventAdd(data) {
        this.refresh();
        this.dispatchEvent(new CustomEvent('eventadd', {
            detail: data
        }));
    }

    /**
     * Handle event update from core
     */
    handleEventUpdate(data) {
        this.refresh();
        this.dispatchEvent(new CustomEvent('eventupdate', {
            detail: data
        }));
    }

    /**
     * Handle event remove from core
     */
    handleEventRemove(data) {
        this.refresh();
        this.dispatchEvent(new CustomEvent('eventremove', {
            detail: data
        }));
    }

    /**
     * Handle navigation from core
     */
    handleNavigate(data) {
        this.currentDate = data.date;
        this._updateViewData();
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: data
        }));
    }

    /**
     * Handle view change from core
     */
    handleViewChange(data) {
        this.view = data.view;
        this.refresh();
        this.dispatchEvent(new CustomEvent('viewchange', {
            detail: data
        }));
    }

    /**
     * Handle event select from core
     */
    handleEventSelect(data) {
        this.selectedEventId = data.event.id;
        this.dispatchEvent(new CustomEvent('eventselect', {
            detail: data
        }));
    }

    /**
     * Handle date select from core
     */
    handleDateSelect(data) {
        this.selectedDate = data.date;
        this.dispatchEvent(new CustomEvent('dateselect', {
            detail: data
        }));
    }
}
