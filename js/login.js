/* =====================================================
   login.js — login.html page logic
===================================================== */
document.addEventListener('DOMContentLoaded', init);

function init() {
  const accounts = DB.getAccounts();
  document.getElementById('mode-setup').style.display = accounts.length ? 'none' : 'block';
  document.getElementById('mode-signin').style.display = accounts.length ? 'block' : 'none';
  if (accounts.length === 1) document.getElementById('signin-username').value = accounts[0].username;
}

function showSetup() {
  document.getElementById('mode-setup').style.display = 'block';
  document.getElementById('mode-signin').style.display = 'none';
}

function showSignIn() {
  document.getElementById('mode-setup').style.display = 'none';
  document.getElementById('mode-signin').style.display = 'block';
}

async function createAccount() {
  const username = document.getElementById('setup-username').value.trim();
  const pw = document.getElementById('setup-password').value;
  const pw2 = document.getElementById('setup-password-confirm').value;
  const err = document.getElementById('setup-error');
  err.textContent = '';

  if (!username) { err.textContent = 'Enter a username.'; return; }
  if (pw.length < 4) { err.textContent = 'Password should be at least 4 characters.'; return; }
  if (pw !== pw2) { err.textContent = 'Passwords do not match.'; return; }

  const passwordHash = await sha256Hex(pw);
  if (DB.getAccounts().some(account => account.username.toLowerCase() === username.toLowerCase())) {
    err.textContent = 'That username already exists.';
    return;
  }
  DB.saveAccount({ username, passwordHash });
  completeLogin(username);
}

async function signIn() {
  const account = DB.getAccounts().find(item => item.username.toLowerCase() === document.getElementById('signin-username').value.trim().toLowerCase());
  const username = document.getElementById('signin-username').value.trim();
  const pw = document.getElementById('signin-password').value;
  const err = document.getElementById('signin-error');
  err.textContent = '';

  if (!account) { err.textContent = 'Incorrect username or password.'; return; }
  const hash = await sha256Hex(pw);
  if (username !== account.username || hash !== account.passwordHash) {
    err.textContent = 'Incorrect username or password.';
    return;
  }
  completeLogin(username);
}

function completeLogin(username) {
  DB.initializeUser(username);
  sessionStorage.setItem('ihsan_auth_session', 'true');
  sessionStorage.setItem('ihsan_auth_user', username);
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  window.location.href = redirect || 'index.html';
}

function resetAccount() {
  if (!confirm('This clears the saved login only (your invoices, inventory and dues are untouched) so you can set a new username/password. Continue?')) return;
  DB.clearAuth();
  init();
}
