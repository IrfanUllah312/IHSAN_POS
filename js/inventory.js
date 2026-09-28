/* =====================================================
   inventory.js — inventory management page logic
===================================================== */
renderShell('inventory.html', 'Inventory', 'Stock & pricing');

let inv = DB.getInventory();

function renderStats() {
  const settings = DB.getSettings();
  const names = Object.keys(inv);
  const totalValue = names.reduce((s, n) => s + inv[n].stock * inv[n].sellPrice, 0);
  const lowStock = names.filter(n => inv[n].stock <= settings.lowStockThreshold);
  document.getElementById('inv-stats').innerHTML = `
    <div class="stat"><div class="label">Total Items</div><div class="value">${names.length}</div></div>
    <div class="stat success"><div class="label">Stock Value</div><div class="value">${formatMoney(totalValue)}</div></div>
    <div class="stat ${lowStock.length ? 'warn' : ''}"><div class="label">Low Stock</div><div class="value">${lowStock.length}</div><div class="sub">Threshold: ${settings.lowStockThreshold} units</div></div>
  `;
}

function renderInventoryTable() {
  const settings = DB.getSettings();
  const term = (document.getElementById('search-item').value || '').toLowerCase();
  const body = document.getElementById('inventory-body');
  const names = Object.keys(inv).filter(n => n.toLowerCase().includes(term)).sort();

  if (!names.length) {
    body.innerHTML = `<tr class="empty-row"><td colspan="6">No items match your search.</td></tr>`;
    return;
  }

  body.innerHTML = names.map(name => {
    const it = inv[name];
    const low = it.stock <= settings.lowStockThreshold;
    return `
      <tr>
        <td>${escapeHtml(name)} ${low ? '<span class="badge badge-danger">Low</span>' : ''}</td>
        <td class="text-right mono">${it.stock}</td>
        <td class="text-right mono">${formatMoney(it.purchasePrice)}</td>
        <td class="text-right mono">${formatMoney(it.sellPrice)}</td>
        <td class="text-right mono">${formatMoney(it.stock * it.sellPrice)}</td>
        <td class="text-right">
          <div class="row-actions" style="justify-content:flex-end;">
            <button class="icon-btn" title="Edit" onclick="openItemModal('${escapeJs(name)}')">&#9998;</button>
            <button class="icon-btn danger" title="Delete" onclick="deleteItem('${escapeJs(name)}')">&#128465;</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function escapeJs(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function openItemModal(name) {
  document.getElementById('item-modal-title').textContent = name ? 'Edit Item' : 'Add Item';
  document.getElementById('item-original-name').value = name || '';
  document.getElementById('item-name').value = name || '';
  document.getElementById('item-stock').value = name ? inv[name].stock : '';
  document.getElementById('item-purchase-price').value = name ? inv[name].purchasePrice : '';
  document.getElementById('item-sell-price').value = name ? inv[name].sellPrice : '';
  document.getElementById('item-overlay').classList.add('open');
}
function closeItemModal() {
  document.getElementById('item-overlay').classList.remove('open');
}

function saveItem() {
  const original = document.getElementById('item-original-name').value;
  const name = document.getElementById('item-name').value.trim();
  const stock = parseInt(document.getElementById('item-stock').value);
  const purchasePrice = parseFloat(document.getElementById('item-purchase-price').value);
  const sellPrice = parseFloat(document.getElementById('item-sell-price').value);

  if (!name || isNaN(stock) || stock < 0 || isNaN(purchasePrice) || purchasePrice < 0 || isNaN(sellPrice) || sellPrice < 0) {
    alert('Please fill in valid values for every field.');
    return;
  }

  if (original && original !== name) delete inv[original];
  inv[name] = { stock, purchasePrice, sellPrice };
  DB.saveInventory(inv);
  autoSyncIfEnabled();
  closeItemModal();
  renderStats();
  renderInventoryTable();
  showToast('Item saved.');
}

function deleteItem(name) {
  if (!confirm(`Delete "${name}" from inventory?`)) return;
  delete inv[name];
  DB.saveInventory(inv);
  autoSyncIfEnabled();
  renderStats();
  renderInventoryTable();
  showToast('Item deleted.');
}

renderStats();
renderInventoryTable();
