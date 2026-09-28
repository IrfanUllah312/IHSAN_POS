/* =====================================================
   invoice.js — billing page logic
===================================================== */
renderShell('invoice.html', 'New Invoice', 'Billing');

let inventory = DB.getInventory();
let lastSavedInvoice = null;
let lastSavedDue = null;

function initInvoiceHeader() {
  const settings = DB.getSettings();
  document.getElementById('rp-business-name').textContent = settings.businessName;
  document.getElementById('rp-phone').textContent = 'Ph#: ' + settings.phone;
  document.getElementById('rp-footer-note').innerHTML = '<strong>' + escapeHtml(settings.footerNote) + '</strong>';
  document.getElementById('invoice-number').textContent = DB.peekNextInvoiceNumber();
  updateDateTime();
}
function updateDateTime() {
  document.getElementById('invoice-date').textContent = nowStr();
}
setInterval(updateDateTime, 30000);

function itemOptionsHtml(selected) {
  return Object.keys(inventory).map(name =>
    `<option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`
  ).join('');
}

function addRow() {
  const tbody = document.querySelector('#invoice-table tbody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <select onchange="updatePrice(this)">
        <option value="">Select item</option>
        ${itemOptionsHtml('')}
      </select>
    </td>
    <td><input type="number" value="1" min="1" oninput="updateTotal(this)"></td>
    <td><input type="number" value="0" min="0" oninput="updateTotal(this)" readonly></td>
    <td class="item-total mono">0</td>
    <td class="no-print"><button class="icon-btn danger" onclick="removeRow(this)" title="Remove">&#10005;</button></td>
  `;
  tbody.appendChild(row);
}

function updatePrice(select) {
  const row = select.closest('tr');
  const priceInput = row.cells[2].querySelector('input');
  const item = select.value;
  const stockInfoDiv = document.getElementById('stock-info');

  if (item && inventory[item]) {
    priceInput.value = inventory[item].sellPrice;
    updateTotal(priceInput);
    if (inventory[item].stock <= 0) {
      stockInfoDiv.innerHTML = `<div class="stock-msg bad">Out of stock: ${escapeHtml(item)}</div>`;
      toggleSaveButton(true);
    } else {
      stockInfoDiv.innerHTML = `<div class="stock-msg ok">In stock: ${escapeHtml(item)} (${inventory[item].stock} available)</div>`;
      toggleSaveButton(false);
    }
  } else {
    priceInput.value = 0;
    updateTotal(priceInput);
    stockInfoDiv.innerHTML = '';
    toggleSaveButton(false);
  }
}

function toggleSaveButton(disable) {
  document.getElementById('save-btn').disabled = disable;
}

function updateTotal(el) {
  const row = el.closest('tr');
  const qty = parseInt(row.cells[1].querySelector('input').value) || 0;
  const price = parseFloat(row.cells[2].querySelector('input').value) || 0;
  row.cells[3].textContent = (qty * price).toLocaleString('en-US');
  updateGrandTotal();
  checkStockForAllItems();
  syncPreview();
}

function updateGrandTotal() {
  let total = 0;
  document.querySelectorAll('#invoice-table .item-total').forEach(cell => {
    total += parseInt(cell.textContent.replace(/,/g, '')) || 0;
  });
  document.getElementById('grand-total').textContent = total.toLocaleString('en-US');
  updateBalance();
}

function removeRow(btn) {
  btn.closest('tr').remove();
  updateGrandTotal();
  checkStockForAllItems();
  syncPreview();
}

function checkStockForAllItems() {
  let outOfStock = false;
  let msg = '';
  document.querySelectorAll('#invoice-table tbody tr').forEach(row => {
    const item = row.cells[0].querySelector('select').value;
    const qty = parseInt(row.cells[1].querySelector('input').value) || 0;
    if (item && inventory[item] && qty > inventory[item].stock) {
      outOfStock = true;
      msg = `Insufficient stock: only ${inventory[item].stock} left for ${item}`;
    }
  });
  const stockInfoDiv = document.getElementById('stock-info');
  if (outOfStock) {
    stockInfoDiv.innerHTML = `<div class="stock-msg bad">${escapeHtml(msg)}</div>`;
  } else if (stockInfoDiv.querySelector('.bad')) {
    stockInfoDiv.innerHTML = '';
  }
  toggleSaveButton(outOfStock);
  return !outOfStock;
}

function getGrandTotal() {
  return parseInt(document.getElementById('grand-total').textContent.replace(/,/g, '')) || 0;
}

function updateBalance() {
  const grand = getGrandTotal();
  let paid = parseFloat(document.getElementById('amount-paid').value) || 0;
  if (paid > grand) paid = grand;
  const balance = Math.max(0, grand - paid);
  document.getElementById('balance-due').textContent = formatMoney(balance);

  const badge = document.getElementById('payment-status-badge');
  if (grand === 0) {
    badge.className = 'badge badge-neutral';
    badge.textContent = 'Nothing added yet';
  } else if (balance === 0) {
    badge.className = 'badge badge-success';
    badge.textContent = 'Paid in full';
  } else if (paid > 0) {
    badge.className = 'badge badge-warn';
    badge.textContent = 'Partially paid — rest on credit';
  } else {
    badge.className = 'badge badge-danger';
    badge.textContent = 'Full amount on credit';
  }
  syncPreview();
  togglePhoneRequirement(balance);
}

// Phone becomes required the moment a balance would be left unpaid,
// since that balance can only be tracked/looked-up by phone number.
function togglePhoneRequirement(balance) {
  const hint = document.getElementById('phone-required-hint');
  if (!hint) return;
  hint.style.display = balance > 0 ? 'block' : 'none';
}

function syncPreview() {
  document.getElementById('rp-customer').textContent = document.getElementById('customer-name').value || 'Walk-in';

  const body = document.getElementById('rp-items-body');
  const rows = document.querySelectorAll('#invoice-table tbody tr');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" class="muted small">Add items to see them here</td></tr>`;
  } else {
    body.innerHTML = Array.from(rows).map(row => {
      const name = row.cells[0].querySelector('select').value || '—';
      const qty = row.cells[1].querySelector('input').value || 0;
      const price = row.cells[2].querySelector('input').value || 0;
      const total = row.cells[3].textContent || 0;
      return `<tr><td>${escapeHtml(name)}</td><td class="num">${qty}</td><td class="num">${price}</td><td class="num">${total}</td></tr>`;
    }).join('');
  }

  const grand = getGrandTotal();
  const paid = Math.min(parseFloat(document.getElementById('amount-paid').value) || 0, grand);
  const balance = Math.max(0, grand - paid);
  document.getElementById('rp-grand-total').textContent = formatMoney(grand);
  document.getElementById('rp-paid').textContent = formatMoney(paid);
  document.getElementById('rp-due-row').style.display = balance > 0 ? 'flex' : 'none';
  document.getElementById('rp-balance').textContent = formatMoney(balance);
}

/* ---------- existing-customer due lookup ----------
   Matching is by phone number ONLY — never by name, since two
   different customers can easily share a name. normalizePhone()
   and customerDueKey() live in js/db.js so the same matching logic
   is used here, on the Dues page, and by the auto-merge inside
   DB.getDues(). */
function findCustomerDueRecord(duesList, phone) {
  const key = customerDueKey(phone);
  if (!key) return null;
  return duesList.find(d => customerDueKey(d.customerPhone) === key);
}

function checkCustomerDue() {
  const phone = document.getElementById('customer-phone').value;
  const box = document.getElementById('customer-due-alert');

  const due = findCustomerDueRecord(DB.getDues(), phone);
  if (!due) { box.innerHTML = ''; return; }

  const remaining = Math.max(0, due.totalDue - due.amountPaid);
  if (remaining <= 0) { box.innerHTML = ''; return; }

  const count = (due.invoices || []).length;
  const invoiceWord = count === 1 ? 'invoice' : 'invoices';

  box.innerHTML = `
    <div class="stock-msg bad">
      &#9888; ${escapeHtml(due.customerName || 'This customer')} already owes <strong>${formatMoney(remaining)}</strong>
      from ${count} earlier ${invoiceWord}.
      <a href="dues.html" style="color:inherit; text-decoration:underline; margin-left:4px;">View in Customer Dues</a>
    </div>`;
}

function completeInvoice() {
  const rows = document.querySelectorAll('#invoice-table tbody tr');
  if (!rows.length) { alert('Add at least one item before saving.'); return; }
  if (!checkStockForAllItems()) { alert('Cannot save — one or more items exceed available stock.'); return; }

  const items = [];
  let hasEmptyItem = false;
  rows.forEach(row => {
    const name = row.cells[0].querySelector('select').value;
    const qty = parseInt(row.cells[1].querySelector('input').value) || 0;
    const price = parseFloat(row.cells[2].querySelector('input').value) || 0;
    if (!name) { hasEmptyItem = true; return; }
    items.push({ name, qty, price, total: qty * price });
  });
  if (hasEmptyItem || !items.length) { alert('Please select an item for every row.'); return; }

  const grandTotal = items.reduce((s, it) => s + it.total, 0);
  let amountPaid = parseFloat(document.getElementById('amount-paid').value) || 0;
  if (amountPaid > grandTotal) amountPaid = grandTotal;
  const balanceDue = Math.max(0, grandTotal - amountPaid);
  const status = balanceDue === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'credit');

  const customerPhoneRaw = document.getElementById('customer-phone').value.trim();
  if (balanceDue > 0 && !customerDueKey(customerPhoneRaw)) {
    alert('A phone number is required to record this customer\u2019s due amount. Please enter a valid phone number.');
    document.getElementById('customer-phone').focus();
    return;
  }

  // deduct stock
  items.forEach(it => { inventory[it.name].stock -= it.qty; });
  DB.saveInventory(inventory);

  const invoiceNumber = DB.nextInvoiceNumber();
  const invoice = {
    id: DB.genId(),
    number: invoiceNumber,
    date: todayStr(),
    createdAt: new Date().toISOString(),
    customerName: document.getElementById('customer-name').value.trim(),
    customerPhone: customerPhoneRaw,
    items, grandTotal, amountPaid, balanceDue, status
  };
  DB.addInvoice(invoice);
  lastSavedInvoice = invoice;

  // ---- credit handling: add onto the customer's existing due record
  // (matched strictly by phone) instead of creating a brand-new row
  // every time the same customer buys on credit again.
  let due = null;
  if (balanceDue > 0) {
    const duesList = DB.getDues();
    const existing = findCustomerDueRecord(duesList, invoice.customerPhone);

    if (existing) {
      existing.totalDue = (existing.totalDue || 0) + balanceDue;
      if (invoice.customerName) existing.customerName = invoice.customerName;
      existing.customerPhone = invoice.customerPhone;
      existing.invoices = existing.invoices || [];
      existing.invoices.push({ invoiceNumber: invoice.number, date: invoice.date, amount: balanceDue });
      due = existing;
    } else {
      due = {
        id: DB.genId(),
        customerName: invoice.customerName || 'Walk-in',
        customerPhone: invoice.customerPhone,
        totalDue: balanceDue,
        amountPaid: 0,
        invoices: [{ invoiceNumber: invoice.number, date: invoice.date, amount: balanceDue }],
        payments: []
      };
      duesList.unshift(due);
    }
    DB.saveDues(duesList);
    lastSavedDue = due;
  } else {
    lastSavedDue = null;
  }

  autoSyncIfEnabled();
  printInvoiceReceipt(invoice);

  const postCard = document.getElementById('post-save-card');
  postCard.style.display = 'block';
  document.getElementById('post-save-msg').textContent =
    balanceDue > 0
      ? `Invoice #${invoiceNumber} saved. Rs ${balanceDue.toLocaleString('en-US')} added to ${invoice.customerName || 'this customer'}'s balance — total owed is now Rs ${(due.totalDue - due.amountPaid).toLocaleString('en-US')}.`
      : `Invoice #${invoiceNumber} saved and marked fully paid.`;
  document.getElementById('due-print-btn').style.display = balanceDue > 0 ? 'inline-flex' : 'none';
  document.getElementById('due-share-btn').style.display = balanceDue > 0 ? 'inline-flex' : 'none';
  postCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('customer-due-alert').innerHTML = '';
}

function printLastInvoice() {
  if (lastSavedInvoice) printInvoiceReceipt(lastSavedInvoice);
}
function shareLastInvoicePdf() {
  if (lastSavedInvoice) shareInvoicePdf(lastSavedInvoice);
}
function printLastDue() {
  if (lastSavedDue) printDueReceipt(lastSavedDue);
}
function shareLastDue() {
  if (lastSavedDue) shareDueReceipt(lastSavedDue);
}

function newInvoice() {
  inventory = DB.getInventory();
  document.querySelector('#invoice-table tbody').innerHTML = '';
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('amount-paid').value = 0;
  document.getElementById('grand-total').textContent = '0';
  document.getElementById('stock-info').innerHTML = '';
  document.getElementById('customer-due-alert').innerHTML = '';
  document.getElementById('post-save-card').style.display = 'none';
  toggleSaveButton(false);
  initInvoiceHeader();
  updateBalance();
  syncPreview();
}

document.getElementById('customer-name').addEventListener('input', () => { syncPreview(); });
document.getElementById('customer-phone').addEventListener('input', () => { checkCustomerDue(); });

initInvoiceHeader();
addRow();
updateBalance();
syncPreview();
