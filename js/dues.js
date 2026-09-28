/* =====================================================
   dues.js — customer credit / amount-owed ledger.
   One row per customer (matched by phone, or name if no
   phone was given); each row can list several invoices.
===================================================== */
renderShell('dues.html', 'Customer Dues', 'Amounts to collect later');

let dues = DB.getDues();
let activePaymentDueId = null;

function remainingOf(due) {
  return Math.max(0, due.totalDue - due.amountPaid);
}
function dueStatus(due) {
  const remaining = remainingOf(due);
  if (remaining <= 0) return 'paid';
  if (due.amountPaid > 0) return 'partial';
  return 'unpaid';
}
function invoiceLabel(d) {
  const invs = d.invoices || [];
  if (!invs.length) return '-';
  const latest = invs[invs.length - 1];
  return invs.length === 1
    ? `#${escapeHtml(latest.invoiceNumber)}`
    : `#${escapeHtml(latest.invoiceNumber)} <span class="small muted">+${invs.length - 1} more</span>`;
}
function latestDate(d) {
  const invs = d.invoices || [];
  return invs.length ? invs[invs.length - 1].date : (d.date || '-');
}
function paymentHistoryHtml(d) {
  const payments = d.payments || [];
  if (!payments.length) return '';
  return `<details class="small" style="margin-top:6px;"><summary>Payment history (${payments.length})</summary><div style="margin-top:6px;">${payments.map(payment => `
    <div style="display:flex; justify-content:space-between; gap:8px; border-top:1px solid var(--border); padding:4px 0;">
      <span>${escapeHtml(payment.date || '-')} · ${escapeHtml(payment.method || 'Cash payment')}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</span>
      <strong>${formatMoney(payment.amount)}</strong>
    </div>`).join('')}</div></details>`;
}

function renderDuesStats() {
  const outstanding = dues.reduce((s, d) => s + remainingOf(d), 0);
  const owingCount = dues.filter(d => remainingOf(d) > 0).length;
  const collected = dues.reduce((s, d) => s + d.amountPaid, 0);
  document.getElementById('dues-stats').innerHTML = `
    <div class="stat danger"><div class="label">Total Outstanding</div><div class="value">${formatMoney(outstanding)}</div><div class="sub">${owingCount} customer(s)</div></div>
    <div class="stat success"><div class="label">Collected So Far</div><div class="value">${formatMoney(collected)}</div></div>
    <div class="stat"><div class="label">Customers On Record</div><div class="value">${dues.length}</div></div>
  `;
}

function renderDuesTable() {
  const term = (document.getElementById('dues-search').value || '').toLowerCase();
  const filter = document.getElementById('dues-filter').value;

  let list = dues.filter(d => {
    const nameMatch = (d.customerName || '').toLowerCase().includes(term);
    const invMatch = (d.invoices || []).some(i => (i.invoiceNumber || '').toLowerCase().includes(term));
    return nameMatch || invMatch;
  });
  if (filter === 'unpaid') list = list.filter(d => remainingOf(d) > 0);

  const body = document.getElementById('dues-body');
  if (!list.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="8">No matching records. Nice and clear!</td></tr>`;
    return;
  }

  body.innerHTML = list.map(d => {
    const remaining = remainingOf(d);
    const status = dueStatus(d);
    const badge = status === 'paid' ? '<span class="badge badge-success">Paid</span>'
      : status === 'partial' ? '<span class="badge badge-warn">Partial</span>'
      : '<span class="badge badge-danger">Unpaid</span>';
    return `
      <tr>
        <td>${escapeHtml(d.customerName || 'Walk-in')}${d.customerPhone ? `<br><span class="small muted">${escapeHtml(d.customerPhone)}</span>` : ''}${paymentHistoryHtml(d)}</td>
        <td class="mono">${invoiceLabel(d)}</td>
        <td>${escapeHtml(latestDate(d))}</td>
        <td class="text-right mono">${formatMoney(d.totalDue)}</td>
        <td class="text-right mono">${formatMoney(d.amountPaid)}</td>
        <td class="text-right mono">${formatMoney(remaining)}</td>
        <td>${badge}</td>
        <td class="text-right">
          <div class="row-actions" style="justify-content:flex-end;">
            ${remaining > 0 ? `<button class="icon-btn" title="Record payment" onclick="openPaymentModal('${d.id}')">&#128179;</button>` : ''}
            <button class="icon-btn" title="Print receipt" onclick="printDue('${d.id}')">&#128424;</button>
            <button class="icon-btn" title="Share receipt" onclick="shareDue('${d.id}')">&#128228;</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function findDue(id) { return dues.find(d => d.id === id); }

function openPaymentModal(id) {
  activePaymentDueId = id;
  const d = findDue(id);
  const count = (d.invoices || []).length;
  document.getElementById('payment-context').textContent =
    `${d.customerName || 'Walk-in'} — ${count} invoice(s) on record — Remaining: ${formatMoney(remainingOf(d))}`;
  document.getElementById('payment-amount').value = remainingOf(d);
  document.getElementById('payment-method').value = 'Cash payment';
  document.getElementById('payment-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('payment-note').value = '';
  document.getElementById('payment-overlay').classList.add('open');
}
function closePaymentModal() {
  document.getElementById('payment-overlay').classList.remove('open');
  activePaymentDueId = null;
}

function submitPayment() {
  const d = findDue(activePaymentDueId);
  if (!d) return;
  let amount = parseFloat(document.getElementById('payment-amount').value);
  if (isNaN(amount) || amount <= 0) { alert('Enter a valid amount received.'); return; }
  const remaining = remainingOf(d);
  if (amount > remaining) amount = remaining;

  const paymentDate = document.getElementById('payment-date').value;
  if (!paymentDate) { alert('Select the payment date.'); return; }

  d.amountPaid += amount;
  d.payments = d.payments || [];
  d.payments.push({
    date: paymentDate,
    amount,
    method: document.getElementById('payment-method').value,
    note: document.getElementById('payment-note').value.trim()
  });
  d.status = remainingOf(d) <= 0 ? 'paid' : 'partial';

  DB.saveDues(dues);
  autoSyncIfEnabled();
  closePaymentModal();
  renderDuesStats();
  renderDuesTable();
  showToast('Payment recorded.');
}

function printDue(id) { printDueReceipt(findDue(id)); }
function shareDue(id) { shareDueReceipt(findDue(id)); }

renderDuesStats();
renderDuesTable();
