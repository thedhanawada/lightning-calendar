import { LightningElement, api } from 'lwc';

export default class LightningCalendarMonthView extends LightningElement {
    @api viewData;

    get dayHeaders() {
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }

    get weeks() {
        const weeks = this.viewData?.weeks || [];
        return weeks.map(week => ({
            ...week,
            days: week.days.map(day => ({
                ...day,
                classes: this.getDayClasses(day),
                visibleEvents: this.getVisibleEvents(day.events).map(event => ({
                    ...event,
                    classes: this.getEventClasses(event)
                })),
                moreCount: this.getMoreCount(day.events),
                hasMore: this.hasMoreEvents(day.events)
            }))
        }));
    }

    handleDateClick(event) {
        const date = event.currentTarget.dataset.date;
        if (date) {
            this.dispatchEvent(new CustomEvent('dateclick', {
                bubbles: true,
                composed: true,
                detail: { date }
            }));
        }
    }

    handleEventClick(event) {
        event.stopPropagation();
        const eventId = event.currentTarget.dataset.eventId;
        if (eventId) {
            this.dispatchEvent(new CustomEvent('eventclick', {
                bubbles: true,
                composed: true,
                detail: { eventId }
            }));
        }
    }

    getDayClasses(day) {
        const classes = ['calendar-day'];
        if (!day.isCurrentMonth) classes.push('other-month');
        if (day.isToday) classes.push('today');
        if (day.isWeekend) classes.push('weekend');
        return classes.join(' ');
    }

    getEventClasses(event) {
        const classes = ['calendar-event'];
        if (event.allDay) classes.push('all-day');
        if (event.metadata?.colorClass) {
            classes.push(event.metadata.colorClass);
        }
        return classes.join(' ');
    }

    getVisibleEvents(events) {
        return events?.slice(0, 3) || [];
    }

    getMoreCount(events) {
        const count = (events?.length || 0) - 3;
        return count > 0 ? count : 0;
    }

    hasMoreEvents(events) {
        return this.getMoreCount(events) > 0;
    }
}
