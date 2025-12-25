/**
 * ConsoleInterface - Enhanced console with safe command execution
 * Includes error handling, state persistence, and autocomplete
 */

import { SafeCommandParser } from './SafeCommandParser.js';
import { ErrorHandler } from './ErrorHandler.js';
import { StateManager } from './StateManager.js';

export class ConsoleInterface {
    constructor(options = {}) {
        this.output = options.outputElement || document.getElementById('console-output');
        this.input = options.inputElement || document.getElementById('console-input');
        this.runButton = options.runButton || document.getElementById('console-run');

        // Initialize components
        this.parser = new SafeCommandParser(options.context || window);
        this.errorHandler = new ErrorHandler();
        this.stateManager = new StateManager('console-state');

        // Console state
        this.commandHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 100;
        this.autocompleteOptions = this.buildAutocompleteOptions();

        // Load saved state
        this.loadState();

        // Initialize
        this.init();
    }

    init() {
        // Run button
        if (this.runButton) {
            this.runButton.addEventListener('click', () => {
                this.execute(this.input.value);
            });
        }

        // Input handlers
        if (this.input) {
            // Enter key to execute
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.execute(this.input.value);
                }
            });

            // Arrow keys for history navigation
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateHistory(-1);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateHistory(1);
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    this.handleAutocomplete();
                }
            });

            // Input change for autocomplete
            this.input.addEventListener('input', () => {
                this.updateAutocomplete();
            });
        }

        // Quick command buttons
        document.querySelectorAll('.command-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                if (command) {
                    this.input.value = command;
                    this.execute(command);
                }
            });
        });

        // Set up error handling
        this.setupErrorHandling();

        // Initial message
        setTimeout(() => {
            this.log('Console ready. Type "help()" for available commands.', 'success');
        }, 100);
    }

    /**
     * Execute a command safely
     */
    async execute(command) {
        if (!command || !command.trim()) return;

        // Log the command
        this.log(`> ${command}`, 'command');

        // Add to history
        this.addToHistory(command);

        try {
            // Disable input during execution
            this.setInputState(false);

            // Execute with safe parser
            const result = await this.executeWithTimeout(command, 5000);

            // Display result
            if (result !== undefined) {
                this.displayResult(result);
            }

            // Emit event for UI updates
            this.emit('commandExecuted', { command, result });

            // Save state
            this.saveState();

        } catch (error) {
            this.handleError(error, command);
        } finally {
            // Re-enable input
            this.setInputState(true);
            this.clearInput();
        }
    }

    /**
     * Execute command with timeout
     */
    async executeWithTimeout(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Command timed out after ${timeout}ms`));
            }, timeout);

            try {
                const result = this.parser.execute(command);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Display command result
     */
    displayResult(result) {
        if (result === null) {
            this.log('null', 'result');
        } else if (result === undefined) {
            this.log('undefined', 'result');
        } else if (typeof result === 'object') {
            try {
                const formatted = JSON.stringify(result, this.jsonReplacer, 2);
                this.log(formatted, 'result object');
            } catch (error) {
                this.log(String(result), 'result');
            }
        } else {
            this.log(String(result), 'result');
        }
    }

    /**
     * JSON replacer for circular references
     */
    jsonReplacer(key, value) {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === 'function') {
                return '[Function: ' + value.name + ']';
            }
            return value;
        };
    }

    /**
     * Handle command errors
     */
    handleError(error, command) {
        const userMessage = this.errorHandler.getUserMessage(error);
        this.log(userMessage, 'error');

        // Log to error handler for tracking
        this.errorHandler.logError(error, { command });

        // Provide helpful suggestions
        if (error.message.includes('not found')) {
            this.log('Hint: Use "help()" to see available commands', 'info');
        } else if (error.message.includes('not a function')) {
            this.log('Hint: Make sure to include parentheses for function calls', 'info');
        }
    }

    /**
     * Log message to console output
     */
    log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `console-entry ${type}`;

        // Security: Always use textContent instead of innerHTML
        entry.textContent = message;

        this.output.appendChild(entry);
        this.scrollToBottom();

        // Limit output size
        this.trimOutput(500);
    }

    /**
     * Clear console output
     */
    clear() {
        if (this.output) {
            this.output.innerHTML = '';
            this.log('Console cleared', 'system');
        }
    }

    /**
     * Navigate command history
     */
    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        if (direction === -1 && this.historyIndex > 0) {
            this.historyIndex--;
        } else if (direction === 1 && this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
        } else if (direction === 1 && this.historyIndex === this.commandHistory.length - 1) {
            this.historyIndex = this.commandHistory.length;
            this.input.value = '';
            return;
        } else {
            return;
        }

        this.input.value = this.commandHistory[this.historyIndex];
    }

    /**
     * Add command to history
     */
    addToHistory(command) {
        // Don't add duplicates
        if (this.commandHistory[this.commandHistory.length - 1] === command) {
            return;
        }

        this.commandHistory.push(command);

        // Limit history size
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
        }

        this.historyIndex = this.commandHistory.length;
    }

    /**
     * Handle autocomplete
     */
    handleAutocomplete() {
        const input = this.input.value;
        const cursorPos = this.input.selectionStart;

        // Get the word being typed
        const beforeCursor = input.substring(0, cursorPos);
        const words = beforeCursor.split(/[\s\.\(]+/);
        const currentWord = words[words.length - 1];

        if (!currentWord) return;

        // Find matching options
        const matches = this.autocompleteOptions.filter(opt =>
            opt.startsWith(currentWord)
        );

        if (matches.length === 1) {
            // Complete the word
            const completion = matches[0];
            const before = input.substring(0, cursorPos - currentWord.length);
            const after = input.substring(cursorPos);
            this.input.value = before + completion + after;
            this.input.setSelectionRange(
                cursorPos - currentWord.length + completion.length,
                cursorPos - currentWord.length + completion.length
            );
        } else if (matches.length > 1) {
            // Show suggestions
            this.showAutocompleteSuggestions(matches);
        }
    }

    /**
     * Show autocomplete suggestions
     */
    showAutocompleteSuggestions(suggestions) {
        // This could be enhanced with a dropdown UI
        this.log('Suggestions: ' + suggestions.join(', '), 'info');
    }

    /**
     * Build autocomplete options
     */
    buildAutocompleteOptions() {
        return [
            'calendar',
            'calendar.getEvents',
            'calendar.addEvent',
            'calendar.updateEvent',
            'calendar.removeEvent',
            'calendar.setView',
            'calendar.getView',
            'calendar.next',
            'calendar.previous',
            'calendar.today',
            'calendar.getTimezone',
            'calendar.setTimezone',
            'calendar.eventStore',
            'calendar.eventStore.getStats',
            'calendar.eventStore.clear',
            'calendar.state',
            'calendar.state.undo',
            'calendar.state.redo',
            'Event',
            'EventStore',
            'new Date',
            'Date.now',
            'true',
            'false',
            'null',
            'undefined'
        ];
    }

    /**
     * Update autocomplete based on input
     */
    updateAutocomplete() {
        // This could be enhanced with live suggestions
        const input = this.input.value;
        if (input.length > 2 && !input.includes('(')) {
            // Could show inline suggestions
        }
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Catch errors in async operations
        window.addEventListener('unhandledrejection', (event) => {
            this.log(`Unhandled Promise Rejection: ${event.reason}`, 'error');
            event.preventDefault();
        });
    }

    /**
     * Set input state (enabled/disabled)
     */
    setInputState(enabled) {
        if (this.input) {
            this.input.disabled = !enabled;
        }
        if (this.runButton) {
            this.runButton.disabled = !enabled;
            if (!enabled) {
                this.runButton.textContent = 'Running...';
            } else {
                this.runButton.textContent = 'Run';
            }
        }
    }

    /**
     * Clear input field
     */
    clearInput() {
        if (this.input) {
            this.input.value = '';
            this.input.focus();
        }
    }

    /**
     * Scroll output to bottom
     */
    scrollToBottom() {
        if (this.output) {
            this.output.scrollTop = this.output.scrollHeight;
        }
    }

    /**
     * Trim output to limit size
     */
    trimOutput(maxEntries = 500) {
        if (this.output) {
            const entries = this.output.querySelectorAll('.console-entry');
            if (entries.length > maxEntries) {
                const toRemove = entries.length - maxEntries;
                for (let i = 0; i < toRemove; i++) {
                    entries[i].remove();
                }
            }
        }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        this.stateManager.save({
            history: this.commandHistory.slice(-50), // Save last 50 commands
            timestamp: Date.now()
        });
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        const state = this.stateManager.load();
        if (state && state.history) {
            this.commandHistory = state.history;
            this.historyIndex = this.commandHistory.length;
            this.log('History restored from previous session', 'system');
        }
    }

    /**
     * Emit custom event
     */
    emit(eventName, detail) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    /**
     * Export console history
     */
    exportHistory() {
        const blob = new Blob(
            [this.commandHistory.join('\n')],
            { type: 'text/plain' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'console-history.txt';
        a.click();
        URL.revokeObjectURL(url);
        this.log('History exported', 'success');
    }

    /**
     * Get help text
     */
    getHelp() {
        return `
Available Commands:
  calendar.getEvents()           - Get all events
  calendar.addEvent({...})       - Add a new event
  calendar.setView('month')      - Change view (month/week/day/list)
  calendar.next()                - Navigate to next period
  calendar.previous()            - Navigate to previous period
  calendar.today()               - Go to today
  calendar.setTimezone('...')    - Change timezone
  calendar.eventStore.getStats() - Get statistics
  calendar.state.undo()          - Undo last action
  calendar.state.redo()          - Redo action
  clear()                        - Clear console
  help()                         - Show this help

Tips:
  - Use Tab for autocomplete
  - Use Up/Down arrows for history
  - Commands are executed safely without eval()
        `.trim();
    }
}

// Export for use
export default ConsoleInterface;