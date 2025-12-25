/**
 * StateManager - Handles state persistence and restoration
 * Manages localStorage with versioning and data validation
 */

export class StateManager {
    constructor(storageKey = 'app-state', options = {}) {
        this.storageKey = storageKey;
        this.version = options.version || '1.0.0';
        this.maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default
        this.compression = options.compression || false;
        this.encryption = options.encryption || false;
        this.autosave = options.autosave !== false;
        this.autosaveInterval = options.autosaveInterval || 30000; // 30 seconds
        this.listeners = new Set();

        // State cache
        this.state = this.load() || this.getDefaultState();
        this.isDirty = false;

        // Setup autosave if enabled
        if (this.autosave) {
            this.setupAutosave();
        }

        // Handle storage events from other tabs
        this.handleStorageEvents();
    }

    /**
     * Get default state structure
     */
    getDefaultState() {
        return {
            version: this.version,
            timestamp: Date.now(),
            data: {}
        };
    }

    /**
     * Save state to localStorage
     */
    save(data = null) {
        try {
            // Update state
            if (data !== null) {
                this.state.data = { ...this.state.data, ...data };
            }
            this.state.timestamp = Date.now();
            this.state.version = this.version;

            // Prepare data for storage
            let serialized = JSON.stringify(this.state);

            // Check size
            if (serialized.length > this.maxSize) {
                console.warn('State size exceeds maximum, attempting cleanup...');
                this.cleanup();
                serialized = JSON.stringify(this.state);
            }

            // Apply compression if enabled
            if (this.compression) {
                serialized = this.compress(serialized);
            }

            // Apply encryption if enabled
            if (this.encryption) {
                serialized = this.encrypt(serialized);
            }

            // Save to localStorage
            localStorage.setItem(this.storageKey, serialized);
            this.isDirty = false;

            // Notify listeners
            this.notifyListeners('save', this.state);

            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                this.handleQuotaExceeded();
            } else {
                console.error('Failed to save state:', error);
            }
            return false;
        }
    }

    /**
     * Load state from localStorage
     */
    load() {
        try {
            let data = localStorage.getItem(this.storageKey);
            if (!data) return null;

            // Decrypt if needed
            if (this.encryption) {
                data = this.decrypt(data);
            }

            // Decompress if needed
            if (this.compression) {
                data = this.decompress(data);
            }

            // Parse JSON
            const state = JSON.parse(data);

            // Validate version
            if (state.version && !this.isVersionCompatible(state.version)) {
                console.warn('State version mismatch, migrating...');
                return this.migrateState(state);
            }

            // Validate structure
            if (!this.validateState(state)) {
                console.warn('Invalid state structure, using default');
                return null;
            }

            this.notifyListeners('load', state);
            return state;
        } catch (error) {
            console.error('Failed to load state:', error);
            return null;
        }
    }

    /**
     * Get specific data from state
     */
    get(key, defaultValue = null) {
        return this.state.data[key] ?? defaultValue;
    }

    /**
     * Set specific data in state
     */
    set(key, value) {
        this.state.data[key] = value;
        this.isDirty = true;

        if (this.autosave) {
            this.scheduleSave();
        }

        this.notifyListeners('change', { key, value });
    }

    /**
     * Delete specific data from state
     */
    delete(key) {
        delete this.state.data[key];
        this.isDirty = true;

        if (this.autosave) {
            this.scheduleSave();
        }

        this.notifyListeners('delete', { key });
    }

    /**
     * Clear all state
     */
    clear() {
        this.state = this.getDefaultState();
        localStorage.removeItem(this.storageKey);
        this.isDirty = false;
        this.notifyListeners('clear', null);
    }

    /**
     * Validate state structure
     */
    validateState(state) {
        return state &&
               typeof state === 'object' &&
               state.version &&
               state.timestamp &&
               state.data !== undefined;
    }

    /**
     * Check version compatibility
     */
    isVersionCompatible(version) {
        const [major] = version.split('.');
        const [currentMajor] = this.version.split('.');
        return major === currentMajor;
    }

    /**
     * Migrate state to current version
     */
    migrateState(oldState) {
        // Implement migration logic based on version
        console.log(`Migrating state from ${oldState.version} to ${this.version}`);

        const migrated = {
            ...oldState,
            version: this.version,
            timestamp: Date.now()
        };

        // Add migration transformations here
        // Example: if (oldState.version === '0.9.0') { ... }

        return migrated;
    }

    /**
     * Setup autosave
     */
    setupAutosave() {
        this.autosaveTimer = null;

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            if (this.isDirty) {
                this.save();
            }
        });

        // Periodic autosave
        setInterval(() => {
            if (this.isDirty) {
                this.save();
            }
        }, this.autosaveInterval);
    }

    /**
     * Schedule a save operation
     */
    scheduleSave() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }

        this.autosaveTimer = setTimeout(() => {
            if (this.isDirty) {
                this.save();
            }
        }, 1000); // Save after 1 second of inactivity
    }

    /**
     * Handle storage events from other tabs
     */
    handleStorageEvents() {
        window.addEventListener('storage', (event) => {
            if (event.key === this.storageKey) {
                // Reload state from storage
                const newState = this.load();
                if (newState) {
                    this.state = newState;
                    this.notifyListeners('external-change', newState);
                }
            }
        });
    }

    /**
     * Handle quota exceeded error
     */
    handleQuotaExceeded() {
        // Try to clean up old data
        this.cleanup();

        // If still failing, clear non-essential data
        const essentialKeys = ['preferences', 'user'];
        const newData = {};
        essentialKeys.forEach(key => {
            if (this.state.data[key]) {
                newData[key] = this.state.data[key];
            }
        });
        this.state.data = newData;

        // Try saving again
        this.save();
    }

    /**
     * Cleanup old or unnecessary data
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        // Remove old temporary data
        Object.keys(this.state.data).forEach(key => {
            if (key.startsWith('temp_')) {
                const data = this.state.data[key];
                if (data.timestamp && (now - data.timestamp) > maxAge) {
                    delete this.state.data[key];
                }
            }
        });

        // Trim large arrays
        Object.keys(this.state.data).forEach(key => {
            const value = this.state.data[key];
            if (Array.isArray(value) && value.length > 100) {
                this.state.data[key] = value.slice(-100);
            }
        });
    }

    /**
     * Simple compression (placeholder - would use real compression library)
     */
    compress(data) {
        // In production, use a library like pako or lz-string
        return data;
    }

    /**
     * Simple decompression (placeholder)
     */
    decompress(data) {
        // In production, use a library like pako or lz-string
        return data;
    }

    /**
     * Simple encryption (placeholder - would use real encryption)
     */
    encrypt(data) {
        // In production, use Web Crypto API or library
        return btoa(data);
    }

    /**
     * Simple decryption (placeholder)
     */
    decrypt(data) {
        // In production, use Web Crypto API or library
        return atob(data);
    }

    /**
     * Add a state change listener
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of state changes
     */
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Export state to JSON file
     */
    export() {
        const data = JSON.stringify(this.state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `state-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import state from JSON file
     */
    async import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const state = JSON.parse(event.target.result);
                    if (this.validateState(state)) {
                        this.state = state;
                        this.save();
                        resolve(state);
                    } else {
                        reject(new Error('Invalid state file'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Get storage size info
     */
    getStorageInfo() {
        const used = new Blob([localStorage.getItem(this.storageKey) || '']).size;
        const total = this.maxSize;
        const percentage = (used / total * 100).toFixed(2);

        return {
            used,
            total,
            percentage,
            available: total - used
        };
    }

    /**
     * Create a snapshot of current state
     */
    createSnapshot(name = '') {
        const snapshot = {
            ...this.state,
            snapshotName: name,
            snapshotTime: Date.now()
        };

        const key = `${this.storageKey}-snapshot-${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(snapshot));

        return key;
    }

    /**
     * Restore from a snapshot
     */
    restoreSnapshot(snapshotKey) {
        const data = localStorage.getItem(snapshotKey);
        if (data) {
            const snapshot = JSON.parse(data);
            this.state = snapshot;
            delete this.state.snapshotName;
            delete this.state.snapshotTime;
            this.save();
            return true;
        }
        return false;
    }

    /**
     * List available snapshots
     */
    listSnapshots() {
        const snapshots = [];
        const prefix = `${this.storageKey}-snapshot-`;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    snapshots.push({
                        key,
                        name: data.snapshotName || 'Unnamed',
                        time: data.snapshotTime,
                        size: new Blob([localStorage.getItem(key)]).size
                    });
                } catch (error) {
                    // Skip invalid snapshots
                }
            }
        }

        return snapshots.sort((a, b) => b.time - a.time);
    }
}

// Export for use
export default StateManager;