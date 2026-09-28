/* =====================================================
   shell.js — renders the sidebar/topbar shell that is
   shared across every page, highlights the active page,
   and shows who's logged in with a logout control.
   Requires js/auth.js to be loaded on the same page for
   the logout button to work.
===================================================== */
const NAV_ITEMS = [
  { href: 'index.html', label: 'Dashboard', icon: '&#9737;' },
  { href: 'invoice.html', label: 'New Invoice', icon: '&#128196;' },
  { href: 'inventory.html', label: 'Inventory', icon: '&#128230;' },
  { href: 'dues.html', label: 'Customer Dues', icon: '&#128179;' },
  { href: 'settings.html', label: 'Settings', icon: '&#9881;' }
];

function renderShell(activeHref, pageTitle, eyebrow) {
  const settings = DB.getSettings();
  const username = typeof currentUsername === 'function' ? currentUsername() : '';

  const sidebar = document.getElementById('shell-sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="brand">
        <div class="brand-mark">${escapeHtml((settings.businessName || 'IT').trim().slice(0, 2).toUpperCase())}</div>
        <div>
          <div class="brand-name">${escapeHtml(settings.businessName || 'IHSAN TRADERS')}</div>
          <div class="brand-sub">Billing &amp; Inventory</div>
        </div>
      </div>
      <nav class="nav">
        ${NAV_ITEMS.map(item => `
          <a href="${item.href}" class="${item.href === activeHref ? 'active' : ''}">
            <span class="ic">${item.icon}</span>${item.label}
          </a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        ${username ? `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <span style="color:rgba(255,255,255,.75); font-weight:600;">${escapeHtml(username)}</span>
            <button class="btn-ghost" style="color:rgba(255,255,255,.55); padding:3px 8px;" onclick="logout()">Logout</button>
          </div>` : ''}
        Software by Irfan Bettani<br>Ph: +923491939236
      </div>
    `;
  }

  const topbar = document.getElementById('shell-topbar');
  if (topbar) {
    topbar.innerHTML = `
      <div>
        <button class="menu-toggle no-print" onclick="toggleSidebar()">&#9776;</button>
        <div class="eyebrow">${escapeHtml(eyebrow || '')}</div>
        <h1>${escapeHtml(pageTitle || '')}</h1>
      </div>
      <div class="topbar-actions no-print" id="shell-topbar-actions"></div>
    `;
  }

  // close mobile sidebar when a nav link is used
  document.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar a')) closeSidebar();
  });
}

function toggleSidebar() {
  document.getElementById('shell-sidebar')?.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('shell-sidebar')?.classList.remove('open');
}
