/**
 * AeroBeat — Profile Screen Module
 * Handles auth forms (login/register), profile display, and logout.
 * Two states: auth-view (unauthenticated) and user-view (logged in).
 */

import { showToast } from './notifications.js';

/**
 * Initialize the profile screen and wire all interactive elements.
 * @param {import('../auth/auth.js').Auth} auth
 */
export function initProfile(auth) {
    // ── Auth state listener ────────────────────────────────────────
    auth.onChange(user => renderProfile(user));

    // ── Tab switching ──────────────────────────────────────────────
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (tabLogin && tabRegister && loginForm && registerForm) {
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('tab-active');
            tabLogin.classList.remove('tab-inactive');
            tabRegister.classList.add('tab-inactive');
            tabRegister.classList.remove('tab-active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('tab-active');
            tabRegister.classList.remove('tab-inactive');
            tabLogin.classList.add('tab-inactive');
            tabLogin.classList.remove('tab-active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
    }

    // ── Login form submit ──────────────────────────────────────────
    const loginFormEl = document.getElementById('login-form');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username')?.value?.trim();
            const password = document.getElementById('login-password')?.value;

            if (!username || !password) {
                showToast('Please fill in all fields');
                return;
            }

            try {
                await auth.login(username, password);
                showToast('Welcome back!');
                resetLoginForm();
            } catch (err) {
                showToast(err.message || 'Login failed');
            }
        });
    }

    // ── Register form submit ───────────────────────────────────────
    const registerFormEl = document.getElementById('register-form');
    if (registerFormEl) {
        registerFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username')?.value?.trim();
            const password = document.getElementById('register-password')?.value;
            const email = document.getElementById('register-email')?.value?.trim();

            if (!username || !password) {
                showToast('Please fill in all required fields');
                return;
            }

            try {
                await auth.register(username, password, email || undefined);
                showToast('Account created!');
                resetRegisterForm();
            } catch (err) {
                showToast(err.message || 'Registration failed');
            }
        });
    }

    // ── Logout button ──────────────────────────────────────────────
    const logoutBtn = document.getElementById('profile-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.logout();
            showToast('Logged out');
        });
    }

    // ── Back button ────────────────────────────────────────────────
    const backBtn = document.getElementById('profile-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.navigate('screen-main-menu');
        });
    }

    // ── Initial render ─────────────────────────────────────────────
    renderProfile(auth.user);
}

/**
 * Render profile screen based on auth state.
 * @param {object|null} user - User object or null if not logged in
 */
function renderProfile(user) {
    const authView = document.getElementById('profile-auth-view');
    const userView = document.getElementById('profile-user-view');

    if (!authView || !userView) return;

    if (user) {
        // Logged in — show profile
        authView.classList.add('hidden');
        userView.classList.remove('hidden');

        // Fill profile data
        const displayName = user.display_name || user.username;
        const initial = displayName.charAt(0).toUpperCase();

        const avatarLetter = document.getElementById('profile-avatar-letter');
        const displayNameEl = document.getElementById('profile-display-name');
        const usernameEl = document.getElementById('profile-username');
        const joinedEl = document.getElementById('profile-joined');

        if (avatarLetter) avatarLetter.textContent = initial;
        if (displayNameEl) displayNameEl.textContent = displayName;
        if (usernameEl) usernameEl.textContent = `@${user.username}`;
        if (joinedEl) {
            try {
                const date = new Date(user.created_at + 'Z');
                joinedEl.textContent = `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
            } catch {
                joinedEl.textContent = '';
            }
        }

        // Update nav bar profile button
        updateNavBarProfile(initial, true);
    } else {
        // Not logged in — show auth forms
        authView.classList.remove('hidden');
        userView.classList.add('hidden');
        resetLoginForm();
        resetRegisterForm();

        // Update nav bar profile button
        updateNavBarProfile(null, false);
    }
}

/**
 * Update the profile button in the bottom nav bar.
 * Shows first letter of username when logged in, person icon when not.
 * @param {string|null} initial
 * @param {boolean} loggedIn
 */
function updateNavBarProfile(initial, loggedIn) {
    const navItems = document.querySelectorAll('footer .flex.flex-col');
    if (navItems.length < 4) return;

    const profileItem = navItems[3];
    const iconContainer = profileItem.querySelector('.w-12');
    const label = profileItem.querySelector('span:last-child');

    if (!iconContainer || !label) return;

    if (loggedIn && initial) {
        iconContainer.innerHTML = `<span class="font-display-lg text-lg text-white font-bold">${initial}</span>`;
        iconContainer.className = 'w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-secondary transition-all';
        label.textContent = 'Profile';
        label.className = 'font-label-sm text-[10px] uppercase tracking-widest mt-1 text-primary font-bold';
    } else {
        iconContainer.innerHTML = '<span class="material-symbols-outlined text-3xl">person</span>';
        iconContainer.className = 'w-12 h-12 flex items-center justify-center rounded-full text-on-surface/60 group-hover:bg-white/40 group-hover:text-primary transition-all';
        label.textContent = 'Profile';
        label.className = 'font-label-sm text-[10px] uppercase tracking-widest mt-1 text-on-surface/60 group-hover:text-primary';
    }
}

/** Reset login form fields */
function resetLoginForm() {
    const username = document.getElementById('login-username');
    const password = document.getElementById('login-password');
    if (username) username.value = '';
    if (password) password.value = '';
}

/** Reset register form fields */
function resetRegisterForm() {
    const username = document.getElementById('register-username');
    const password = document.getElementById('register-password');
    const email = document.getElementById('register-email');
    if (username) username.value = '';
    if (password) password.value = '';
    if (email) email.value = '';
}
