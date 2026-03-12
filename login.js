/**
 * CRMM - Login Authentication Script
 * Offline-first: LocalStorage auth + API fallback
 */

// ─── Default credentials (offline / fallback) ───────────────────────────────
const DEFAULT_USERS = [
  { username: 'admin',   password: 'admin123', role: 'admin',  name: 'Administrator' },
  { username: 'user',    password: 'user123',  role: 'user',   name: 'Standard User'  },
  { username: 'manager', password: 'manager123', role: 'manager', name: 'Manager'     }
];

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api'; // Proxied via netlify.toml
const STORAGE_KEY = 'crmm_session';

// ─── Check if already logged in ─────────────────────────────────────────────
(function checkExistingSession() {
  const session = getSession();
  if (session && session.username && session.role) {
    window.location.href = 'index.html';
  }
})();

// ─── DOM refs ────────────────────────────────────────────────────────────────
const form       = document.getElementById('login-form');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const errorBanner= document.getElementById('error-banner');
const errorText  = document.getElementById('error-text');
const btnSignin  = document.getElementById('btn-signin');
const btnSpinner = document.getElementById('btn-spinner');
const btnText    = btnSignin.querySelector('.btn-text');
const btnArrow   = btnSignin.querySelector('.btn-arrow');
const togglePw   = document.getElementById('toggle-pw');

// ─── Password toggle ─────────────────────────────────────────────────────────
togglePw.addEventListener('click', () => {
  const isPassword = passwordEl.type === 'password';
  passwordEl.type  = isPassword ? 'text' : 'password';
  document.getElementById('eye-icon').innerHTML = isPassword
    ? `<path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="#3b82f6" stroke-width="1.5"/>
       <circle cx="9" cy="9" r="2.5" stroke="#3b82f6" stroke-width="1.5"/>
       <line x1="2" y1="2" x2="16" y2="16" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"/>`
    : `<path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="#9ca3af" stroke-width="1.5"/>
       <circle cx="9" cy="9" r="2.5" stroke="#9ca3af" stroke-width="1.5"/>`;
});

// ─── Form submit ─────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username || !password) {
    showError('Please enter both username and password.');
    return;
  }

  setLoading(true);
  hideError();

  // 1. Try the backend API (if server is running)
  try {
    const response = await Promise.race([
      fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).catch(err => { throw new Error('network_error'); }), // Catch fetch failures immediately
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);

    if (response.ok) {
      const data = await response.json();
      saveSession({ username: data.username, role: data.role, name: data.name, token: data.token });
      redirectToCRM();
      return;
    } else {
      const err = await response.json().catch(() => ({}));
      setLoading(false);
      showError(err.message || 'Invalid username or password.');
      return;
    }
  } catch (apiErr) {
    // API not available (network error or timeout) — fall through to offline auth
    console.info('[CRMM] Backend not reachable, using offline auth.');
  }

  // 2. Offline fallback (localStorage / hardcoded credentials)
  await fakeDelay(600); // Simulate async
  const match = offlineAuth(username, password);

  if (match) {
    // Also merge any extra users added to localStorage
    saveSession({ username: match.username, role: match.role, name: match.name, token: 'offline-' + Date.now() });
    redirectToCRM();
  } else {
    setLoading(false);
    showError('Invalid username or password.');
    // Shake the form inputs
    usernameEl.classList.add('shake-input');
    passwordEl.classList.add('shake-input');
    setTimeout(() => {
      usernameEl.classList.remove('shake-input');
      passwordEl.classList.remove('shake-input');
    }, 400);
  }
});

// ─── Offline auth logic ───────────────────────────────────────────────────────
function offlineAuth(username, password) {
  // Check hardcoded defaults first
  const defaultMatch = DEFAULT_USERS.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );
  if (defaultMatch) return defaultMatch;

  // Check users saved in localStorage (added by admin panel)
  try {
    const extraUsers = JSON.parse(localStorage.getItem('crmm_users') || '[]');
    return extraUsers.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    ) || null;
  } catch {
    return null;
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────
function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...data,
    loginTime: new Date().toISOString()
  }));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function redirectToCRM() {
  window.location.href = 'index.html';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showError(msg) {
  errorText.textContent = msg;
  errorBanner.hidden = false;
  // Re-trigger animation
  errorBanner.style.animation = 'none';
  errorBanner.offsetHeight;
  errorBanner.style.animation = '';
}

function hideError() {
  errorBanner.hidden = true;
}

function setLoading(loading) {
  btnSignin.disabled = loading;
  btnText.textContent = loading ? 'Signing in…' : 'Sign In';
  btnSpinner.hidden = !loading;
  btnArrow.style.display = loading ? 'none' : '';
}

function fakeDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
