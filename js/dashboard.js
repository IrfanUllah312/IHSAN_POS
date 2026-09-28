/* =====================================================
   dashboard.js — stats and overview for index.html
===================================================== */
renderShell('index.html', 'Dashboard', 'Overview');

function statusBadge(status) {
  if (status === 'paid') return '<span class="badge badge-success">Paid</span>';
  if (status === 'partial') return '<span class="badge badge-warn">Partial</span>';
  return '<span class="badge badge-danger">Credit</span>';
}

function renderDashboard() {
  const settings = DB.getSettings();
  const inventory = DB.getInventory();
  const invoices = DB.getInvoices();
  const dues = DB.getDues();

  const today = todayStr();
  const todaysSales = invoices
    .filter(inv => inv.date === today)
    .reduce((sum, inv) => sum + inv.grandTotal, 0);

  const inventoryValue = Object.values(inventory).reduce((sum, it) => sum + it.stock * it.sellPrice, 0);
  const lowStockItems = Object.entries(inventory).filter(([, it]) => it.stock <= settings.lowStockThreshold);
  const outstandingTotal = dues.reduce((sum, d) => sum + Math.max(0, d.totalDue - d.amountPaid), 0);

  document.getElementById('stat-cards').innerHTML = `
    <div class="stat">
      <div class="label">Today's Sales</div>
      <div class="value">${formatMoney(todaysSales)}</div>
      <div class="sub">${invoices.filter(i => i.date === today).length} invoice(s) today</div>
    </div>
    <div class="stat success">
      <div class="label">Inventory Value</div>
      <div class="value">${formatMoney(inventoryValue)}</div>
      <div class="sub">${Object.keys(inventory).length} item types</div>
    </div>
    <div class="stat ${lowStockItems.length ? 'warn' : ''}">
      <div class="label">Low Stock Items</div>
      <div class="value">${lowStockItems.length}</div>
      <div class="sub">Threshold: ${settings.lowStockThreshold} units</div>
    </div>
    <div class="stat ${outstandingTotal ? 'danger' : ''}">
      <div class="label">Outstanding Dues</div>
      <div class="value">${formatMoney(outstandingTotal)}</div>
      <div class="sub">${dues.filter(d => d.totalDue - d.amountPaid > 0).length} customer(s) owe</div>
    </div>
  `;

  const recentBody = document.getElementById('recent-invoices');
  recentBody.innerHTML = invoices.length
    ? invoices.slice(0, 8).map(inv => `
        <tr>
          <td class="mono">#${escapeHtml(inv.number)}</td>
          <td>${escapeHtml(inv.customerName || 'Walk-in')}</td>
          <td>${escapeHtml(inv.date)}</td>
          <td class="text-right mono">${formatMoney(inv.grandTotal)}</td>
          <td>${statusBadge(inv.status)}</td>
        </tr>`).join('')
    : `<tr class="empty-row"><td colspan="5">No invoices yet — create your first one.</td></tr>`;

  const lowStockBody = document.getElementById('low-stock-list');
  lowStockBody.innerHTML = lowStockItems.length
    ? lowStockItems.map(([name, it]) => `<tr><td>${escapeHtml(name)}</td><td class="text-right mono">${it.stock}</td></tr>`).join('')
    : `<tr class="empty-row"><td colspan="2">All items are well stocked.</td></tr>`;
}

renderDashboard();
