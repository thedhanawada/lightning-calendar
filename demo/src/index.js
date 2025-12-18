/**
 * Lightning Calendar - Main entry point
 * A modern, lightweight, framework-agnostic calendar library
 * Optimized for Salesforce Lightning and Locker Service
 */

// Core exports
export { Calendar } from './core/calendar/Calendar.js';
export { Event } from './core/events/Event.js';
export { EventStore } from './core/events/EventStore.js';
export { StateManager } from './core/state/StateManager.js';
export { DateUtils } from './core/calendar/DateUtils.js';

// Version
export const VERSION = '0.1.0';

// Default export
export { Calendar as default } from './core/calendar/Calendar.js';