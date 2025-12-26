/**
 * Lightning Calendar Core - Main entry point
 * A modern, lightweight, framework-agnostic calendar library
 * Optimized for Salesforce Lightning and Locker Service
 */

// Core exports
export { Calendar } from './calendar/Calendar.js';
export { Event } from './events/Event.js';
export { EventStore } from './events/EventStore.js';
export { StateManager } from './state/StateManager.js';
export { DateUtils } from './calendar/DateUtils.js';

// Version
export const VERSION = '0.2.0';

// Default export
export { Calendar as default } from './calendar/Calendar.js';