/**
 * Main Application Entry Point
 * Initializes the Lightning Calendar Demo with all safety features
 */

import { Calendar, Event, EventStore } from './calendar-core.esm.js';
import ConsoleInterface from './ConsoleInterface.js';
import ErrorHandler from './ErrorHandler.js';
import StateManager from './StateManager.js';
import CalendarRenderer from './CalendarRenderer.js';

class LightningCalendarDemo {
    constructor() {
        // Initialize error handler first
        this.errorHandler = new ErrorHandler({
            reporting: false, // Enable for production
            maxErrors: 50
        });

        // Wrap initialization in error boundary
        this.errorHandler.safeAsync(() => this.initialize());
    }

    async initialize() {
        // Initialize state manager
        this.stateManager = new StateManager('lightning-calendar-demo', {
            version: '1.0.0',
            autosave: true
        });

        // Initialize calendar with saved or default settings
        this.initializeCalendar();

        // Initialize UI components
        this.initializeConsole();
        this.initializeRenderer();
        this.initializeControls();

        // Load saved state
        this.restoreState();

        // Set up event listeners
        this.setupEventListeners();

        // Load initial data
        this.loadInitialData();

        // Show ready message
        this.showReadyMessage();
    }

    initializeCalendar() {
        const savedTimezone = this.stateManager.get('timezone', 'Australia/Sydney');
        const savedView = this.stateManager.get('view', 'month');

        this.calendar = new Calendar({
            view: savedView,
            timeZone: savedTimezone
        });

        // Make available globally for console access
        window.calendar = this.calendar;
        window.Calendar = Calendar;
        window.Event = Event;
        window.EventStore = EventStore;
    }

    initializeConsole() {
        this.console = new ConsoleInterface({
            outputElement: document.getElementById('console-output'),
            inputElement: document.getElementById('console-input'),
            runButton: document.getElementById('console-run'),
            context: {
                calendar: this.calendar,
                Event: Event,
                EventStore: EventStore,
                app: this,
                help: () => this.showHelp(),
                clear: () => this.console.clear(),
                exportHistory: () => this.console.exportHistory()
            }
        });

        window.consoleInterface = this.console;
    }

    initializeRenderer() {
        this.renderer = new CalendarRenderer({
            container: document.getElementById('calendar-display'),
            calendar: this.calendar
        });
    }

    initializeControls() {
        // View switcher
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.setView(view);
            });
        });

        // Navigation
        const prevBtn = document.getElementById('prev-btn');
        const todayBtn = document.getElementById('today-btn');
        const nextBtn = document.getElementById('next-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigate('previous'));
        }
        if (todayBtn) {
            todayBtn.addEventListener('click', () => this.navigate('today'));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigate('next'));
        }

        // Timezone selector
        const timezoneSelect = document.getElementById('timezone-select');
        if (timezoneSelect) {
            timezoneSelect.value = this.calendar.getTimezone();
            timezoneSelect.addEventListener('change', (e) => {
                this.setTimezone(e.target.value);
            });
        }

        // Quick add form
        const quickAddForm = document.getElementById('quick-add');
        if (quickAddForm) {
            quickAddForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.quickAddEvent(e.target);
            });
        }

        // Mobile console toggle
        const toggleBtn = document.getElementById('toggle-console');
        const consolePanel = document.getElementById('console-panel');
        if (toggleBtn && consolePanel) {
            toggleBtn.addEventListener('click', () => {
                consolePanel.classList.toggle('open');
                toggleBtn.textContent = consolePanel.classList.contains('open')
                    ? 'Hide Console'
                    : 'Show Console';
            });
        }
    }

    setupEventListeners() {
        // Listen for calendar changes
        this.calendar.on('change', () => {
            this.updateDisplay();
            this.updateStats();
            this.saveState();
        });

        // Listen for console commands
        window.addEventListener('commandExecuted', (e) => {
            if (e.detail.command.includes('calendar')) {
                this.updateDisplay();
                this.updateStats();
            }
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Refresh when tab becomes visible
                this.updateDisplay();
            }
        });

        // Handle before unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    setView(view) {
        try {
            // Update buttons
            document.querySelectorAll('[data-view]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });

            // Update calendar
            this.calendar.setView(view);

            // Update display
            this.updateDisplay();

            // Save preference
            this.stateManager.set('view', view);

            // Log to console
            this.console.log(`View changed to: ${view}`, 'success');
        } catch (error) {
            this.errorHandler.logError(error, { action: 'setView', view });
            this.console.log(`Failed to change view: ${error.message}`, 'error');
        }
    }

    setTimezone(timezone) {
        try {
            const oldTimezone = this.calendar.getTimezone();

            // Update calendar
            this.calendar.setTimezone(timezone);

            // Update UI
            const currentTimezoneEl = document.getElementById('current-timezone');
            if (currentTimezoneEl) {
                currentTimezoneEl.textContent = timezone;
            }

            // Update display
            this.updateDisplay();
            this.updateStats();

            // Save preference
            this.stateManager.set('timezone', timezone);

            // Log to console
            this.console.log(`Timezone changed from ${oldTimezone} to ${timezone}`, 'success');
        } catch (error) {
            this.errorHandler.logError(error, { action: 'setTimezone', timezone });
            this.console.log(`Failed to change timezone: ${error.message}`, 'error');
        }
    }

    navigate(direction) {
        try {
            switch (direction) {
                case 'previous':
                    this.calendar.previous();
                    break;
                case 'next':
                    this.calendar.next();
                    break;
                case 'today':
                    this.calendar.today();
                    break;
            }

            this.updateDisplay();
            this.console.log(`Navigated: ${direction}`, 'success');
        } catch (error) {
            this.errorHandler.logError(error, { action: 'navigate', direction });
            this.console.log(`Navigation failed: ${error.message}`, 'error');
        }
    }

    quickAddEvent(form) {
        try {
            const title = form.title.value;
            const start = new Date(form.start.value);

            if (!title || !start) {
                throw new Error('Title and start time are required');
            }

            const event = this.calendar.addEvent({
                id: `evt-${Date.now()}`,
                title,
                start,
                end: new Date(start.getTime() + 3600000) // 1 hour default
            });

            this.updateDisplay();
            this.updateStats();
            form.reset();

            // Set default for next add
            const now = new Date();
            form.start.value = this.formatDateTimeLocal(now);

            this.console.log(`Event "${title}" added successfully`, 'success');
        } catch (error) {
            this.errorHandler.logError(error, { action: 'quickAddEvent' });
            this.console.log(`Failed to add event: ${error.message}`, 'error');
        }
    }

    updateDisplay() {
        try {
            this.renderer.render();
        } catch (error) {
            this.errorHandler.logError(error, { action: 'updateDisplay' });
        }
    }

    updateStats() {
        try {
            const stats = this.calendar.eventStore.getStats();
            const metrics = this.calendar.eventStore.getPerformanceMetrics();

            // Update stat elements
            const elements = {
                'total-events': stats.totalEvents,
                'current-view': this.capitalize(this.calendar.getView()),
                'current-timezone': this.calendar.getTimezone(),
                'cache-hits': metrics.cacheHits || 0,
                'undo-count': this.calendar.state?.getUndoCount?.() || 0
            };

            Object.entries(elements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
        } catch (error) {
            this.errorHandler.logError(error, { action: 'updateStats' });
        }
    }

    saveState() {
        try {
            const events = this.calendar.getEvents();
            this.stateManager.set('events', events);
            this.stateManager.set('currentDate', this.calendar.getCurrentDate());
            this.stateManager.save();
        } catch (error) {
            this.errorHandler.logError(error, { action: 'saveState' });
        }
    }

    restoreState() {
        try {
            const events = this.stateManager.get('events');
            if (events && events.length > 0) {
                this.calendar.setEvents(events);
                this.console.log(`Restored ${events.length} events from previous session`, 'system');
            }

            const currentDate = this.stateManager.get('currentDate');
            if (currentDate) {
                this.calendar.setCurrentDate(new Date(currentDate));
            }

            this.updateDisplay();
            this.updateStats();
        } catch (error) {
            this.errorHandler.logError(error, { action: 'restoreState' });
            this.loadSampleEvents(); // Fallback to sample data
        }
    }

    loadInitialData() {
        const events = this.stateManager.get('events');
        if (!events || events.length === 0) {
            this.loadSampleEvents();
        }
    }

    loadSampleEvents() {
        try {
            const now = new Date();
            const events = [
                {
                    id: '1',
                    title: 'Team Meeting',
                    start: new Date(now.getTime() + 3600000),
                    end: new Date(now.getTime() + 7200000),
                    timeZone: this.calendar.getTimezone()
                },
                {
                    id: '2',
                    title: 'Project Review',
                    start: new Date(now.getTime() + 86400000),
                    end: new Date(now.getTime() + 86400000 + 7200000),
                    timeZone: this.calendar.getTimezone()
                },
                {
                    id: '3',
                    title: 'Sprint Planning',
                    start: new Date(now.getTime() + 172800000),
                    end: new Date(now.getTime() + 172800000 + 10800000),
                    timeZone: this.calendar.getTimezone()
                }
            ];

            this.calendar.setEvents(events);
            this.console.log('Loaded sample events', 'system');
        } catch (error) {
            this.errorHandler.logError(error, { action: 'loadSampleEvents' });
        }
    }

    showHelp() {
        const help = this.console.getHelp();
        this.console.log(help, 'info');
        return 'Help displayed above';
    }

    showReadyMessage() {
        this.console.log('Lightning Calendar Demo initialized successfully', 'success');
        this.console.log('Type "help()" for available commands', 'info');

        // Set initial datetime for quick add
        const startInput = document.getElementById('start');
        if (startInput) {
            startInput.value = this.formatDateTimeLocal(new Date());
        }

        // Initial render
        this.updateDisplay();
        this.updateStats();
    }

    formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LightningCalendarDemo();
    });
} else {
    window.app = new LightningCalendarDemo();
}

// Export for testing
export default LightningCalendarDemo;