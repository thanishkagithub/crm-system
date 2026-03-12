const express = require('express');
const router  = express.Router();

// ─── Hardcoded offline-capable user list ────────────────────────────────────
// In production this should query a users table in the DB.
const USERS = [
  { id: 1, username: 'admin',   password: 'admin123',   role: 'admin',   name: 'Administrator' },
  { id: 2, username: 'user',    password: 'user123',    role: 'user',    name: 'Standard User'  },
  { id: 3, username: 'manager', password: 'manager123', role: 'manager', name: 'Manager'        }
];

// Try to get extra users from DB if available
let db = null;
try {
  db = require('../config/database');
} catch(e) {
  // DB not configured – fall back to hardcoded users
  console.log('[CRMM Auth] Using hardcoded users (DB config not found).');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  // 1. Check hardcoded users
  let user = USERS.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  // 2. If DB available: also check database users table
  if (!user && db) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ? LIMIT 1',
        [username, password]
      );
      if (rows.length > 0) {
        user = rows[0];
        user.name = user.name || user.username;
      }
    } catch(dbErr) {
      // Table may not exist yet – that's fine, fall through
    }
  }

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  // Return session token (simple format – use JWT in production)
  const token = Buffer.from(`${user.username}:${Date.now()}`).toString('base64');

  res.json({
    token,
    username: user.username,
    role:     user.role,
    name:     user.name
  });
});

// POST /api/auth/logout  (client just clears localStorage, but endpoint available)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out.' });
});

module.exports = router;
