/**
 * CalendarRenderer - Handles all calendar view rendering
 * Provides safe DOM manipulation and efficient updates
 */

export class CalendarRenderer {
    constructor(options = {}) {
        this.container = options.container || document.getElementById('calendar-display');
        this.calendar = options.calendar;
        this.currentView = null;
        this.cache = new Map();
    }

    /**
     * Main render method
     */
    render() {
        const view = this.calendar.getView();
        const viewData = this.calendar.getViewData();

        if (!viewData) {
            this.renderEmpty();
            return;
        }

        // Check cache
        const cacheKey = `${view}-${this.calendar.getCurrentDate()}`;
        if (this.cache.has(cacheKey) && !this.hasDataChanged(viewData)) {
            return; // Skip render if data hasn't changed
        }

        // Clear cache if too large
        if (this.cache.size > 10) {
            this.cache.clear();
        }

        // Render based on view type
        switch (view) {
            case 'month':
                this.renderMonthView(viewData);
                break;
            case 'week':
                this.renderWeekView(viewData);
                break;
            case 'day':
                this.renderDayView(viewData);
                break;
            case 'list':
                this.renderListView(viewData);
                break;
            default:
                this.renderEmpty();
        }

        // Cache the rendered data
        this.cache.set(cacheKey, viewData);
        this.currentView = view;
    }

    /**
     * Render month view
     */
    renderMonthView(viewData) {
        const fragment = document.createDocumentFragment();

        // Create month container
        const monthView = this.createElement('div', { class: 'month-view' });

        // Add header
        const header = this.createMonthHeader(viewData);
        monthView.appendChild(header);

        // Add weekdays
        const weekdays = this.createWeekdays();
        monthView.appendChild(weekdays);

        // Add month grid
        const grid = this.createMonthGrid(viewData);
        monthView.appendChild(grid);

        fragment.appendChild(monthView);
        this.updateContainer(fragment);
    }

    /**
     * Create month header
     */
    createMonthHeader(viewData) {
        const header = this.createElement('div', { class: 'month-header' });

        const title = this.createElement('h2', {
            class: 'month-title'
        });

        const date = new Date(this.calendar.getCurrentDate());
        const monthYear = date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        title.textContent = monthYear;

        const subtitle = this.createElement('span', {
            class: 'calendar-view-subtitle'
        });
        subtitle.textContent = ` (${this.calendar.getTimezone()})`;

        title.appendChild(subtitle);
        header.appendChild(title);

        return header;
    }

    /**
     * Create weekdays row
     */
    createWeekdays() {
        const weekdays = this.createElement('div', { class: 'weekdays' });
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        dayNames.forEach(day => {
            const weekday = this.createElement('div', { class: 'weekday' });
            weekday.textContent = day;
            weekdays.appendChild(weekday);
        });

        return weekdays;
    }

    /**
     * Create month grid
     */
    createMonthGrid(viewData) {
        const grid = this.createElement('div', { class: 'month-grid' });

        viewData.weeks.forEach(week => {
            week.days.forEach(day => {
                const dayEl = this.createDayCell(day);
                grid.appendChild(dayEl);
            });
        });

        return grid;
    }

    /**
     * Create day cell for month view
     */
    createDayCell(dayData) {
        const classes = ['day'];
        if (dayData.isToday) classes.push('today');
        if (!dayData.isCurrentMonth) classes.push('other-month');

        const day = this.createElement('div', {
            class: classes.join(' '),
            'data-date': dayData.date
        });

        // Day number
        const dayNumber = this.createElement('div', { class: 'day-number' });
        dayNumber.textContent = dayData.dayOfMonth;
        day.appendChild(dayNumber);

        // Events
        if (dayData.events && dayData.events.length > 0) {
            const eventsEl = this.createElement('div', { class: 'day-events' });
            eventsEl.textContent = `${dayData.events.length} event${dayData.events.length > 1 ? 's' : ''}`;
            day.appendChild(eventsEl);

            // Show first few events
            dayData.events.slice(0, 2).forEach(event => {
                const eventEl = this.createElement('div', { class: 'day-event' });
                eventEl.textContent = event.title;
                eventEl.title = event.title; // Tooltip for full title
                day.appendChild(eventEl);
            });
        }

        return day;
    }

    /**
     * Render week view
     */
    renderWeekView(viewData) {
        const fragment = document.createDocumentFragment();

        const weekView = this.createElement('div', { class: 'week-view' });

        // Add header
        const header = this.createElement('h2', {
            class: 'calendar-view-title'
        });
        header.textContent = 'Week View';
        weekView.appendChild(header);

        // Create week grid
        const grid = this.createElement('div', { class: 'week-days-grid' });

        viewData.days.forEach(day => {
            const dayCol = this.createWeekDayColumn(day);
            grid.appendChild(dayCol);
        });

        weekView.appendChild(grid);
        fragment.appendChild(weekView);
        this.updateContainer(fragment);
    }

    /**
     * Create week day column
     */
    createWeekDayColumn(dayData) {
        const isToday = dayData.isToday;

        const column = this.createElement('div', {
            class: 'week-day-column',
            style: `background: ${isToday ? '#fef5e7' : '#f8f8f8'}`
        });

        // Header
        const header = this.createElement('div', {
            class: 'week-day-header'
        });

        const dayName = this.createElement('div', { class: 'week-day-name' });
        dayName.textContent = dayData.dayName;

        const dayNumber = this.createElement('div', { class: 'week-day-number' });
        dayNumber.textContent = dayData.dayOfMonth;

        header.appendChild(dayName);
        header.appendChild(dayNumber);
        column.appendChild(header);

        // Events
        if (dayData.events && dayData.events.length > 0) {
            const eventsContainer = this.createElement('div', { class: 'day-events-list' });

            dayData.events.forEach(event => {
                const eventEl = this.createElement('div', {
                    class: 'week-event',
                    style: 'padding: 4px; margin: 2px; background: #e3f2fd; font-size: 0.75rem;'
                });
                eventEl.textContent = event.title;
                eventsContainer.appendChild(eventEl);
            });

            column.appendChild(eventsContainer);
        }

        return column;
    }

    /**
     * Render day view
     */
    renderDayView(viewData) {
        const fragment = document.createDocumentFragment();

        const dayView = this.createElement('div', { class: 'day-view' });

        // Add header
        const header = this.createElement('div', { class: 'day-view-header' });

        const title = this.createElement('h2', { class: 'day-view-date' });
        const date = new Date(this.calendar.getCurrentDate());
        title.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        header.appendChild(title);

        dayView.appendChild(header);

        // Create timeline
        const timeline = this.createElement('div', { class: 'day-timeline' });

        for (let hour = 0; hour < 24; hour++) {
            const hourRow = this.createHourRow(hour, viewData.hours?.[hour]);
            timeline.appendChild(hourRow);
        }

        dayView.appendChild(timeline);
        fragment.appendChild(dayView);
        this.updateContainer(fragment);
    }

    /**
     * Create hour row for day view
     */
    createHourRow(hour, hourData) {
        const row = this.createElement('div', { class: 'hour-row' });

        // Hour label
        const label = this.createElement('div', { class: 'hour-label' });
        label.textContent = `${hour}:00`;
        row.appendChild(label);

        // Hour content
        const content = this.createElement('div', { class: 'hour-content' });

        if (hourData?.events?.length > 0) {
            hourData.events.forEach(event => {
                const eventEl = this.createElement('div', { class: 'hour-event' });
                eventEl.textContent = event.title;
                content.appendChild(eventEl);
            });
        }

        row.appendChild(content);
        return row;
    }

    /**
     * Render list view
     */
    renderListView(viewData) {
        const fragment = document.createDocumentFragment();

        const listView = this.createElement('div', { class: 'list-view' });

        // Add header
        const header = this.createElement('h2', {
            class: 'calendar-view-title'
        });
        header.textContent = 'List View';
        listView.appendChild(header);

        if (viewData.days && viewData.days.length > 0) {
            viewData.days.forEach(day => {
                if (day.events && day.events.length > 0) {
                    const daySection = this.createListDaySection(day);
                    listView.appendChild(daySection);
                }
            });
        } else {
            const empty = this.createElement('div', { class: 'list-empty' });
            empty.textContent = 'No events in this period';
            listView.appendChild(empty);
        }

        fragment.appendChild(listView);
        this.updateContainer(fragment);
    }

    /**
     * Create list day section
     */
    createListDaySection(dayData) {
        const section = this.createElement('div', { class: 'list-day-section' });

        // Day header
        const header = this.createElement('h3', { class: 'list-day-header' });
        header.textContent = dayData.dayName || 'Day';
        section.appendChild(header);

        // Events
        dayData.events.forEach(event => {
            const eventEl = this.createElement('div', { class: 'list-event' });

            const time = this.createElement('span', { class: 'list-event-time' });
            if (event.start) {
                const startTime = new Date(event.start);
                time.textContent = startTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                });
            }
            eventEl.appendChild(time);

            const title = this.createElement('span', { class: 'list-event-title' });
            title.textContent = event.title;
            eventEl.appendChild(title);

            section.appendChild(eventEl);
        });

        return section;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        const empty = this.createElement('div', {
            class: 'calendar-empty',
            style: 'text-align: center; padding: 40px; color: #999;'
        });
        empty.textContent = 'No calendar data to display';
        this.updateContainer(empty);
    }

    /**
     * Create element with attributes
     */
    createElement(tag, attrs = {}, children = []) {
        const elem = document.createElement(tag);

        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'class') {
                elem.className = value;
            } else if (key === 'style') {
                elem.style.cssText = value;
            } else if (key.startsWith('data-')) {
                elem.setAttribute(key, value);
            } else {
                elem[key] = value;
            }
        });

        children.forEach(child => {
            if (typeof child === 'string') {
                elem.appendChild(document.createTextNode(child));
            } else {
                elem.appendChild(child);
            }
        });

        return elem;
    }

    /**
     * Update container with new content
     */
    updateContainer(content) {
        // Use requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
            // Clear container
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }

            // Add new content
            if (content instanceof DocumentFragment || content instanceof HTMLElement) {
                this.container.appendChild(content);
            }
        });
    }

    /**
     * Check if data has changed
     */
    hasDataChanged(newData) {
        const cached = this.cache.get(`${this.calendar.getView()}-${this.calendar.getCurrentDate()}`);
        if (!cached) return true;

        // Simple comparison - could be enhanced
        return JSON.stringify(cached) !== JSON.stringify(newData);
    }

    /**
     * Clear render cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export for use
export default CalendarRenderer;