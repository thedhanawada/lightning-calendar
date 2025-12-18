# Lightning Calendar - LWC Wrapper

Enterprise-grade calendar component for Salesforce Lightning Web Components.

## Features

- 🎯 **Framework-Agnostic Core** - Built on `@lightning-calendar/core`
- 📅 **Multiple Views** - Month, Week, Day, and List views
- 🎨 **SLDS Styling** - Native Salesforce Lightning Design System
- ⚡ **Zero Dependencies** - Lightweight and fast
- 🔌 **Extensible** - Plugin architecture for custom functionality
- ♿ **Accessible** - WCAG compliant (in progress)
- 🔒 **Locker Service Compatible** - Works in all Salesforce environments

## Installation

### Option 1: SFDX Project

1. Clone or copy the `packages/lwc` directory into your SFDX project
2. Deploy to your org:
   ```bash
   sfdx force:source:deploy -p force-app/main/default/lwc
   ```

### Option 2: Package Install (Coming Soon)

```bash
sfdx force:package:install -p 04t...
```

## Usage

### Basic Example

```html
<template>
    <c-lightning-calendar
        events={events}
        view="month"
        height="600px"
    ></c-lightning-calendar>
</template>
```

```javascript
import { LightningElement } from 'lwc';

export default class MyCalendar extends LightningElement {
    events = [
        {
            id: '1',
            title: 'Team Meeting',
            start: new Date(2024, 0, 15, 10, 0),
            end: new Date(2024, 0, 15, 11, 0),
            allDay: false,
            description: 'Weekly team sync',
            location: 'Conference Room A',
            metadata: {
                colorClass: 'event-blue'
            }
        }
    ];
}
```

### API Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `events` | Array | `[]` | Array of event objects |
| `view` | String | `'month'` | Default view: `'month'`, `'week'`, `'day'`, `'list'` |
| `date` | Date | `new Date()` | Initial date to display |
| `height` | String | `'600px'` | Calendar container height |
| `weekStartsOn` | Number | `0` | First day of week (0=Sunday, 1=Monday) |
| `locale` | String | `'en-US'` | Locale for date formatting |
| `showWeekNumbers` | Boolean | `false` | Show week numbers in month view |
| `showWeekends` | Boolean | `true` | Show weekend days |
| `fixedWeekCount` | Boolean | `true` | Always show 6 weeks in month view |

### API Methods

Access methods via template reference:

```javascript
// Get reference
const calendar = this.template.querySelector('c-lightning-calendar');

// Add event
calendar.addEvent({
    id: '2',
    title: 'New Event',
    start: new Date(),
    end: new Date(Date.now() + 3600000)
});

// Update event
calendar.updateEvent('2', { title: 'Updated Event' });

// Remove event
calendar.removeEvent('2');

// Navigation
calendar.next();      // Next period
calendar.previous();  // Previous period
calendar.today();     // Go to today
calendar.setView('week'); // Change view

// Refresh
calendar.refresh();
```

### Events

Listen to calendar events:

```html
<c-lightning-calendar
    oneventclick={handleEventClick}
    ondateclick={handleDateClick}
    oneventadd={handleEventAdd}
    oneventupdate={handleEventUpdate}
    oneventremove={handleEventRemove}
    onnavigate={handleNavigate}
    onviewchange={handleViewChange}
></c-lightning-calendar>
```

```javascript
handleEventClick(event) {
    const clickedEvent = event.detail.event;
    console.log('Event clicked:', clickedEvent);
}

handleDateClick(event) {
    const clickedDate = event.detail.date;
    console.log('Date clicked:', clickedDate);
}
```

### Event Object Structure

```javascript
{
    id: String,              // Required: Unique identifier
    title: String,           // Required: Event title
    start: Date,             // Required: Start date/time
    end: Date,               // Required: End date/time
    allDay: Boolean,         // Optional: All-day event flag
    description: String,     // Optional: Event description
    location: String,        // Optional: Event location
    recurring: Boolean,      // Optional: Recurring event flag
    recurrenceRule: String,  // Optional: Recurrence rule (not yet implemented)
    metadata: Object         // Optional: Custom data
}
```

### Styling Events

Use predefined color classes in event metadata:

```javascript
{
    id: '1',
    title: 'Meeting',
    start: new Date(),
    end: new Date(),
    metadata: {
        colorClass: 'event-blue'  // event-blue, event-green, event-orange, event-red, event-purple
    }
}
```

## Components

### Main Components

- **`c-lightning-calendar`** - Main calendar component
- **`c-lightning-calendar-demo`** - Demo/example component

### View Components (Internal)

- **`c-lightning-calendar-month-view`** - Month view renderer
- **`c-lightning-calendar-week-view`** - Week view renderer (stub)
- **`c-lightning-calendar-day-view`** - Day view renderer (stub)
- **`c-lightning-calendar-list-view`** - List view renderer (stub)

## Demo Component

Deploy the demo component to see the calendar in action:

1. Deploy: `sfdx force:source:deploy -p force-app`
2. Add `c-lightning-calendar-demo` to any Lightning page
3. Interact with sample events

## Roadmap

### v0.2.0
- [ ] Complete Week, Day, and List view renderers
- [ ] Event creation/edit modals
- [ ] Drag and drop support
- [ ] Event resize support

### v0.3.0
- [ ] Recurring events support
- [ ] Timezone handling
- [ ] Salesforce record integration
- [ ] Custom event actions

### v1.0.0
- [ ] Full accessibility (ARIA)
- [ ] Comprehensive test coverage
- [ ] Performance optimizations
- [ ] Documentation site

## Architecture

The LWC wrapper is built on top of `@lightning-calendar/core`, a framework-agnostic calendar engine. This architecture provides:

- **Separation of Concerns** - Business logic separate from UI
- **Testability** - Core logic can be tested independently
- **Reusability** - Same core can power React, Vue, or vanilla JS versions
- **Performance** - Efficient event indexing and querying

## Development

### Prerequisites

- Salesforce CLI
- Node.js 18+
- SFDX project

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint
npm run lint
```

## Contributing

Contributions welcome! Please read our contributing guidelines and submit PRs.

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: [Report bugs](https://github.com/YOUR_USERNAME/lightning-calendar/issues)
- Discussions: [Ask questions](https://github.com/YOUR_USERNAME/lightning-calendar/discussions)

---

Built with ❤️ for the Salesforce community
