/* =====================================================
   auth.js — shared authentication helpers.
   This is a local access gate only (no server), suitable
   for keeping casual users out of the till, not for
   protecting sensitive data on a shared/public computer.
===================================================== */

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isLoggedIn() {
  return sessionStorage.getItem('ihsan_auth_session') === 'true';
}

function currentUsername() {
  return sessionStorage.getItem('ihsan_auth_user') || '';
}

function logout() {
  sessionStorage.removeItem('ihsan_auth_session');
  sessionStorage.removeItem('ihsan_auth_user');
  window.location.href = 'login.html';
}

if (isLoggedIn()) DB.initializeUser(currentUsername());
