/**
 * AeroBeat — Auth Module
 * JWT-based authentication client.
 * Manages token storage, login/register/logout, and reactive UI updates.
 */

const API_BASE = window.location.origin;

export class Auth {
    constructor() {
        this.token = localStorage.getItem('aerobeat-jwt');
        this.user = null;
        this._listeners = [];
    }

    /**
     * Validate stored token on startup.
     * Logs out if token is expired or invalid.
     */
    async init() {
        if (!this.token) return;
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` },
            });
            if (res.ok) {
                this.user = await res.json();
                this._notify();
            } else {
                this.logout();
            }
        } catch {
            /* offline or server unreachable — keep token for retry */
        }
    }

    /**
     * Register a new user.
     * @param {string} username
     * @param {string} password
     * @param {string} [email]
     * @returns {Promise<{token: string, user: object}>}
     */
    async register(username, password, email) {
        const body = { username, password };
        if (email) body.email = email;

        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('aerobeat-jwt', this.token);
        this._notify();
        return data;
    }

    /**
     * Login with username and password.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{token: string, user: object}>}
     */
    async login(username, password) {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('aerobeat-jwt', this.token);
        this._notify();
        return data;
    }

    /**
     * Logout — clear token and user state.
     */
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('aerobeat-jwt');
        this._notify();
    }

    /** @returns {boolean} Whether a user is currently logged in */
    get isLoggedIn() {
        return !!this.user;
    }

    /**
     * Subscribe to auth state changes (login/logout).
     * @param {function(object|null): void} callback
     */
    onChange(callback) {
        this._listeners.push(callback);
    }

    /** Notify all listeners of auth state change */
    _notify() {
        this._listeners.forEach(cb => cb(this.user));
    }

    /**
     * Authorization header for protected API requests.
     * @returns {object} Headers object
     */
    get authHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }
}
