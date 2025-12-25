/**
 * SafeCommandParser - Secure alternative to eval() for executing calendar commands
 * Prevents XSS and injection attacks while maintaining functionality
 */
export class SafeCommandParser {
    constructor(context) {
        this.context = context;
        this.allowedObjects = ['calendar', 'Event', 'EventStore'];
        this.allowedMethods = this.buildAllowedMethods();
        this.sanitizers = {
            string: (val) => String(val).replace(/[<>]/g, ''),
            number: (val) => Number(val),
            boolean: (val) => Boolean(val),
            date: (val) => new Date(val),
            object: (val) => this.sanitizeObject(val)
        };
    }

    buildAllowedMethods() {
        return {
            calendar: [
                'getEvents', 'addEvent', 'updateEvent', 'removeEvent', 'setEvents',
                'getEventsForDate', 'getEventsInRange', 'setView', 'getView',
                'next', 'previous', 'today', 'getCurrentDate', 'setCurrentDate',
                'getTimezone', 'setTimezone', 'getViewData', 'getEventById',
                'detectConflicts', 'on', 'off', 'emit'
            ],
            Event: ['constructor', 'validate', 'normalize', 'clone'],
            EventStore: [
                'add', 'update', 'remove', 'get', 'getAll', 'clear',
                'getByDate', 'getByDateRange', 'getStats', 'getPerformanceMetrics',
                'query', 'hasConflicts', 'getConflicts'
            ],
            eventStore: [ // calendar.eventStore methods
                'add', 'update', 'remove', 'get', 'getAll', 'clear',
                'getByDate', 'getByDateRange', 'getStats', 'getPerformanceMetrics'
            ],
            state: [ // calendar.state methods
                'undo', 'redo', 'canUndo', 'canRedo', 'getUndoCount', 'getRedoCount',
                'subscribe', 'unsubscribe', 'getState'
            ]
        };
    }

    /**
     * Parse and execute a command safely
     * @param {string} command - The command to execute
     * @returns {any} The result of the command
     * @throws {Error} If command is invalid or unsafe
     */
    execute(command) {
        try {
            // Remove whitespace and semicolons
            command = command.trim().replace(/;$/, '');

            // Check for dangerous patterns
            this.validateSafety(command);

            // Parse the command
            const parsed = this.parseCommand(command);

            if (!parsed) {
                throw new Error('Invalid command format');
            }

            // Execute based on type
            switch (parsed.type) {
                case 'method':
                    return this.executeMethod(parsed);
                case 'property':
                    return this.executeProperty(parsed);
                case 'constructor':
                    return this.executeConstructor(parsed);
                default:
                    throw new Error(`Unsupported command type: ${parsed.type}`);
            }
        } catch (error) {
            // Re-throw with more context
            throw new Error(`Command execution failed: ${error.message}`);
        }
    }

    validateSafety(command) {
        // Block dangerous patterns
        const dangerous = [
            /eval\s*\(/i,
            /function\s*\(/i,
            /Function\s*\(/i,
            /new\s+Function/i,
            /setTimeout/i,
            /setInterval/i,
            /document\./i,
            /window\./i,
            /localStorage/i,
            /sessionStorage/i,
            /fetch\s*\(/i,
            /XMLHttpRequest/i,
            /import\s*\(/i,
            /<script/i,
            /on\w+\s*=/i, // Event handlers
            /javascript:/i,
            /\$\{/  // Template literals
        ];

        for (const pattern of dangerous) {
            if (pattern.test(command)) {
                throw new Error(`Unsafe pattern detected: ${pattern}`);
            }
        }
    }

    parseCommand(command) {
        // Handle object.method() calls
        const methodMatch = command.match(/^(\w+)(?:\.(\w+))?(?:\.(\w+))?\((.*)\)$/);
        if (methodMatch) {
            const [, obj, prop1, prop2, args] = methodMatch;
            return {
                type: 'method',
                object: obj,
                property: prop1,
                subProperty: prop2,
                arguments: this.parseArguments(args)
            };
        }

        // Handle property access
        const propMatch = command.match(/^(\w+)(?:\.(\w+))?(?:\.(\w+))?$/);
        if (propMatch) {
            const [, obj, prop1, prop2] = propMatch;
            return {
                type: 'property',
                object: obj,
                property: prop1,
                subProperty: prop2
            };
        }

        // Handle new Event() constructor
        const constructorMatch = command.match(/^new\s+(\w+)\((.*)\)$/);
        if (constructorMatch) {
            const [, className, args] = constructorMatch;
            return {
                type: 'constructor',
                class: className,
                arguments: this.parseArguments(args)
            };
        }

        return null;
    }

    parseArguments(argsString) {
        if (!argsString.trim()) return [];

        const args = [];
        let current = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];

            if (!inString) {
                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (char === '{' || char === '[' || char === '(') {
                    depth++;
                    current += char;
                } else if (char === '}' || char === ']' || char === ')') {
                    depth--;
                    current += char;
                } else if (char === ',' && depth === 0) {
                    args.push(this.parseValue(current.trim()));
                    current = '';
                } else {
                    current += char;
                }
            } else {
                if (char === stringChar && argsString[i - 1] !== '\\') {
                    inString = false;
                    stringChar = '';
                }
                current += char;
            }
        }

        if (current.trim()) {
            args.push(this.parseValue(current.trim()));
        }

        return args;
    }

    parseValue(value) {
        // Handle null/undefined
        if (value === 'null') return null;
        if (value === 'undefined') return undefined;

        // Handle booleans
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Handle strings
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
        }

        // Handle numbers
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return Number(value);
        }

        // Handle Date constructor
        if (value.startsWith('new Date(')) {
            const dateArg = value.slice(9, -1);
            if (dateArg === '') return new Date();
            if (dateArg.startsWith('"') || dateArg.startsWith("'")) {
                return new Date(dateArg.slice(1, -1));
            }
            if (!isNaN(dateArg)) {
                return new Date(Number(dateArg));
            }
            // Handle Date.now() + offset
            if (dateArg.includes('Date.now()')) {
                const expression = dateArg.replace(/Date\.now\(\)/g, Date.now());
                // Safe evaluation of simple arithmetic
                const match = expression.match(/^(\d+)\s*([\+\-])\s*(\d+)$/);
                if (match) {
                    const [, left, op, right] = match;
                    return new Date(op === '+' ? Number(left) + Number(right) : Number(left) - Number(right));
                }
            }
            return new Date(dateArg);
        }

        // Handle objects
        if (value.startsWith('{')) {
            try {
                // Use JSON.parse for safe parsing
                return JSON.parse(value.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
            } catch {
                // If JSON parse fails, try manual parsing
                return this.parseObject(value);
            }
        }

        // Handle arrays
        if (value.startsWith('[')) {
            try {
                return JSON.parse(value.replace(/'/g, '"'));
            } catch {
                return [];
            }
        }

        // Default to string
        return value;
    }

    parseObject(objString) {
        // Remove curly braces
        const content = objString.slice(1, -1);
        const obj = {};

        // Simple regex for key:value pairs
        const pairs = content.match(/(\w+)\s*:\s*([^,]+)/g);
        if (pairs) {
            pairs.forEach(pair => {
                const [key, val] = pair.split(':').map(s => s.trim());
                obj[key] = this.parseValue(val);
            });
        }

        return obj;
    }

    executeMethod(parsed) {
        const { object, property, subProperty, arguments: args } = parsed;

        // Get the target object
        let target = this.context[object];
        if (!target) {
            throw new Error(`Object '${object}' not found`);
        }

        // Navigate to sub-property if needed
        if (property) {
            target = target[property];
            if (!target) {
                throw new Error(`Property '${property}' not found on ${object}`);
            }
        }

        // Get the method
        const methodName = subProperty || (property ? 'call' : object);
        const method = subProperty ? target[subProperty] : target;

        if (typeof method !== 'function') {
            // If it's a property with sub-method, navigate further
            if (subProperty && target[subProperty]) {
                return target[subProperty];
            }
            throw new Error(`'${methodName}' is not a function`);
        }

        // Validate method is allowed
        const allowedList = this.allowedMethods[property] || this.allowedMethods[object];
        if (allowedList && !allowedList.includes(subProperty || 'call')) {
            throw new Error(`Method '${subProperty || property}' is not allowed`);
        }

        // Execute the method
        const context = property ? this.context[object][property] : this.context[object];
        return method.apply(context, args);
    }

    executeProperty(parsed) {
        const { object, property, subProperty } = parsed;

        let value = this.context[object];
        if (!value) {
            throw new Error(`Object '${object}' not found`);
        }

        if (property) {
            value = value[property];
            if (value === undefined) {
                throw new Error(`Property '${property}' not found on ${object}`);
            }
        }

        if (subProperty) {
            value = value[subProperty];
            if (value === undefined) {
                throw new Error(`Property '${subProperty}' not found`);
            }
        }

        return value;
    }

    executeConstructor(parsed) {
        const { class: className, arguments: args } = parsed;

        // Only allow whitelisted constructors
        if (!this.allowedObjects.includes(className)) {
            throw new Error(`Constructor '${className}' is not allowed`);
        }

        const Constructor = this.context[className];
        if (!Constructor) {
            throw new Error(`Class '${className}' not found`);
        }

        return new Constructor(...args);
    }

    sanitizeObject(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip dangerous properties
            if (key.startsWith('__') || key.startsWith('on')) continue;

            if (typeof value === 'string') {
                sanitized[key] = this.sanitizers.string(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

// Export for use in demo
export default SafeCommandParser;