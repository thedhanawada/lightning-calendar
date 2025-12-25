/**
 * ErrorHandler - Comprehensive error handling and reporting
 * Provides user-friendly error messages and tracks errors for debugging
 */

export class ErrorHandler {
    constructor(options = {}) {
        this.maxErrors = options.maxErrors || 100;
        this.errors = [];
        this.errorListeners = new Set();
        this.reportingEnabled = options.reporting || false;
        this.reportingUrl = options.reportingUrl || null;

        // Error type mappings for user-friendly messages
        this.errorMessages = {
            'SyntaxError': 'Invalid command syntax. Check parentheses and quotes.',
            'ReferenceError': 'Referenced object or method not found.',
            'TypeError': 'Type error. Check that you\'re using the correct data types.',
            'RangeError': 'Value out of range.',
            'SecurityError': 'This operation is not allowed for security reasons.',
            'TimeoutError': 'Operation timed out. Try a simpler command.',
            'NetworkError': 'Network request failed. Check your connection.',
            'ValidationError': 'Invalid input. Check the required parameters.'
        };

        this.setupGlobalHandlers();
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.logError(event.error || new Error(event.message), {
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                global: true
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError(
                event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                { promise: true, global: true }
            );
        });
    }

    /**
     * Log an error with context
     */
    logError(error, context = {}) {
        const errorRecord = {
            timestamp: Date.now(),
            message: error.message,
            stack: error.stack,
            type: error.constructor.name,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Add to error list
        this.errors.push(errorRecord);

        // Limit error storage
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Notify listeners
        this.notifyListeners(errorRecord);

        // Report to server if enabled
        if (this.reportingEnabled) {
            this.reportError(errorRecord);
        }

        // Console log in development
        if (this.isDevelopment()) {
            console.error('Error logged:', errorRecord);
        }

        return errorRecord;
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(error) {
        // Check for specific error types
        const errorType = error.constructor.name;
        if (this.errorMessages[errorType]) {
            return `${this.errorMessages[errorType]} (${error.message})`;
        }

        // Check for known patterns in the message
        if (error.message.includes('not found')) {
            return `Command or object not found: ${error.message}`;
        }
        if (error.message.includes('not allowed')) {
            return `Security: ${error.message}`;
        }
        if (error.message.includes('timeout')) {
            return `Operation timed out. Try a simpler command.`;
        }
        if (error.message.includes('parse')) {
            return `Could not parse command. Check your syntax.`;
        }

        // Default message
        return error.message || 'An unexpected error occurred';
    }

    /**
     * Create an error boundary wrapper
     */
    createErrorBoundary(fn, fallback = null) {
        return (...args) => {
            try {
                const result = fn(...args);
                // Handle async functions
                if (result && typeof result.catch === 'function') {
                    return result.catch((error) => {
                        this.logError(error, { boundary: true, function: fn.name });
                        if (fallback) return fallback(error);
                        throw error;
                    });
                }
                return result;
            } catch (error) {
                this.logError(error, { boundary: true, function: fn.name });
                if (fallback) return fallback(error);
                throw error;
            }
        };
    }

    /**
     * Wrap a class with error boundaries
     */
    wrapClass(ClassConstructor) {
        const wrappedClass = class extends ClassConstructor {
            constructor(...args) {
                super(...args);
                this.wrapMethods();
            }

            wrapMethods() {
                const prototype = Object.getPrototypeOf(this);
                const methods = Object.getOwnPropertyNames(prototype);

                methods.forEach(method => {
                    if (method === 'constructor') return;
                    const original = this[method];
                    if (typeof original === 'function') {
                        this[method] = this.createErrorBoundary(original.bind(this));
                    }
                });
            }
        };

        // Copy static properties
        Object.setPrototypeOf(wrappedClass, ClassConstructor);
        return wrappedClass;
    }

    /**
     * Register an error listener
     */
    addListener(callback) {
        this.errorListeners.add(callback);
        return () => this.errorListeners.delete(callback);
    }

    /**
     * Notify all error listeners
     */
    notifyListeners(errorRecord) {
        this.errorListeners.forEach(listener => {
            try {
                listener(errorRecord);
            } catch (error) {
                console.error('Error in error listener:', error);
            }
        });
    }

    /**
     * Report error to server
     */
    async reportError(errorRecord) {
        if (!this.reportingUrl) return;

        try {
            await fetch(this.reportingUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...errorRecord,
                    sessionId: this.getSessionId(),
                    buildVersion: this.getBuildVersion()
                })
            });
        } catch (error) {
            // Silently fail - don't create error loop
            if (this.isDevelopment()) {
                console.warn('Failed to report error:', error);
            }
        }
    }

    /**
     * Get recent errors
     */
    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }

    /**
     * Get error statistics
     */
    getStatistics() {
        const stats = {
            total: this.errors.length,
            byType: {},
            byHour: {},
            topMessages: {}
        };

        this.errors.forEach(error => {
            // By type
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;

            // By hour
            const hour = new Date(error.timestamp).getHours();
            stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

            // Top messages
            const msg = error.message.substring(0, 50);
            stats.topMessages[msg] = (stats.topMessages[msg] || 0) + 1;
        });

        // Sort top messages
        stats.topMessages = Object.entries(stats.topMessages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .reduce((obj, [key, val]) => {
                obj[key] = val;
                return obj;
            }, {});

        return stats;
    }

    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = [];
        this.notifyListeners({ type: 'cleared', timestamp: Date.now() });
    }

    /**
     * Export errors to file
     */
    exportErrors() {
        const data = JSON.stringify(this.errors, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `errors-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Check if in development mode
     */
    isDevelopment() {
        return window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('errorHandlerSessionId');
        if (!sessionId) {
            sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('errorHandlerSessionId', sessionId);
        }
        return sessionId;
    }

    /**
     * Get build version
     */
    getBuildVersion() {
        return 'development';
    }

    /**
     * Create a safe wrapper for async operations
     */
    async safeAsync(operation, fallback = null) {
        try {
            return await operation();
        } catch (error) {
            this.logError(error, { safeAsync: true });
            if (fallback !== null) {
                return typeof fallback === 'function' ? fallback(error) : fallback;
            }
            throw error;
        }
    }

    /**
     * Retry an operation with exponential backoff
     */
    async retry(operation, options = {}) {
        const maxAttempts = options.maxAttempts || 3;
        const baseDelay = options.baseDelay || 1000;
        const maxDelay = options.maxDelay || 10000;

        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                this.logError(error, {
                    retry: true,
                    attempt,
                    maxAttempts
                });

                if (attempt < maxAttempts) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }
}

// Export for use
export default ErrorHandler;