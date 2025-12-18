import { LightningElement, track } from 'lwc';

export default class LightningCalendarDemo extends LightningElement {
    @track events = [];

    connectedCallback() {
        // Load sample events for current month
        this.events = this.generateSampleEvents();
    }

    generateSampleEvents(baseDate = new Date()) {
        const events = [];
        const today = baseDate;
        const eventTypes = [
            { title: 'Team Meeting', category: 'meeting', colorClass: 'event-blue' },
            { title: 'Project Review', category: 'review', colorClass: 'event-purple' },
            { title: 'Client Call', category: 'client', colorClass: 'event-green' },
            { title: 'Development Work', category: 'work', colorClass: 'event-orange' },
            { title: 'Training Session', category: 'training', colorClass: 'event-red' }
        ];

        // Generate 20 events across the month
        for (let i = 0; i < 20; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() + daysOffset);

            // Random time between 8 AM and 6 PM
            const startHour = 8 + Math.floor(Math.random() * 10);
            startDate.setHours(startHour, Math.random() < 0.5 ? 0 : 30, 0, 0);

            const duration = (0.5 + Math.random() * 2); // 0.5 to 2.5 hours
            const endDate = new Date(startDate);
            endDate.setTime(endDate.getTime() + duration * 60 * 60 * 1000);

            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

            events.push({
                id: `event-${i}`,
                title: eventType.title,
                start: startDate,
                end: endDate,
                allDay: Math.random() < 0.15, // 15% chance of all-day event
                description: 'Sample event description',
                location: Math.random() < 0.5 ? 'Conference Room A' : 'Virtual',
                metadata: {
                    category: eventType.category,
                    colorClass: eventType.colorClass
                }
            });
        }

        return events;
    }

    handleAddEvent() {
        const newEvent = {
            id: `event-${Date.now()}`,
            title: 'New Event',
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
            allDay: false,
            description: 'New event added via demo',
            metadata: {
                colorClass: 'event-blue'
            }
        };

        this.template.querySelector('c-lightning-calendar').addEvent(newEvent);
    }

    handleClearEvents() {
        // Create new array reference to trigger reactivity
        this.events = [];
    }

    handleLoadSampleEvents() {
        // Get current calendar date to generate events for visible month
        const calendar = this.template.querySelector('c-lightning-calendar');
        const currentDate = calendar ? calendar.getCurrentDate() : new Date();

        // Create new array reference to trigger reactivity
        this.events = [...this.generateSampleEvents(currentDate)];
    }

    handleEventClick(event) {
        const clickedEvent = event.detail.event;
        console.log('Event clicked:', clickedEvent);
        // You can open a modal, show details, etc.
    }

    handleDateClick(event) {
        const clickedDate = event.detail.date;
        console.log('Date clicked:', clickedDate);
        // You can open a create event modal, etc.
    }

    handleNavigate(event) {
        console.log('Calendar navigated:', event.detail);
    }

    handleViewChange(event) {
        console.log('View changed:', event.detail);
    }
}
