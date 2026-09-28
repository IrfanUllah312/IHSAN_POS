/* =====================================================
   sheets.js — sends local data to a Google Sheet.

   A static HTML page cannot write to a Google Sheet using
   just the sheet's normal share link — Google requires an
   authenticated endpoint. The practical, no-backend way
   around this is a Google Apps Script "Web App" bound to
   the sheet, which acts as a tiny receiving endpoint.
   Settings > Google Sheet Sync explains how to set this up
   and provides the exact script to paste in.
===================================================== */

async function syncToGoogleSheet(silent) {
  const settings = DB.getSettings();
  if (!settings.sheetUrl) {
    if (!silent) alert('Add your Google Sheet Web App URL in Settings first.');
    return false;
  }

  const payload = {
    syncedAt: new Date().toISOString(),
    username: currentUsername(),
    settings: DB.getSettings(),
    inventory: DB.getInventory(),
    invoices: DB.getInvoices(),
    dues: DB.getDues()
  };

  try {
    // Apps Script web apps don't return CORS headers, so we send the
    // request in no-cors mode: the browser can't read the response,
    // but Google still receives and processes the data.
    await fetch(settings.sheetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!silent) showToast('Sent to Google Sheet — check the sheet to confirm.');
    return true;
  } catch (e) {
    console.error('Sheet sync failed', e);
    if (!silent) alert('Could not reach that Google Sheet link. Double check the URL and your internet connection.');
    return false;
  }
}

// Called after saving an invoice/inventory/payment change, if the
// user has turned on "sync automatically" in Settings.
function autoSyncIfEnabled() {
  const settings = DB.getSettings();
  if (settings.autoSync && settings.sheetUrl) {
    syncToGoogleSheet(true);
  }
}

// NOTE: re-paste this version and deploy a new version after changing the script.
const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  writeSheet(ss, 'Settings', ['Field', 'Value'], Object.keys(data.settings || {}).map(function(k) {
    return [k, data.settings[k]];
  }));

  writeSheet(ss, 'Inventory', ['Item', 'Stock', 'Purchase Price', 'Sell Price'],
    Object.keys(data.inventory).map(function(k) {
      var it = data.inventory[k];
      return [k, it.stock, it.purchasePrice, it.sellPrice];
    }));

  writeSheet(ss, 'Invoices', ['Invoice #', 'Date', 'Created At', 'Customer', 'Phone', 'Items', 'Grand Total', 'Amount Paid', 'Balance Due', 'Status'],
    data.invoices.map(function(inv) {
      return [inv.number, inv.date, inv.createdAt || '', inv.customerName, inv.customerPhone || '', JSON.stringify(inv.items || []), inv.grandTotal, inv.amountPaid, inv.balanceDue, inv.status];
    }));

  writeSheet(ss, 'Customer Dues', ['ID', 'Customer', 'Phone', 'Invoices', 'Total Owed', 'Amount Paid', 'Remaining', 'Status'],
    data.dues.map(function(d) {
      var invLabel = (d.invoices || []).map(function(i) { return '#' + i.invoiceNumber; }).join(', ');
      return [d.id, d.customerName, d.customerPhone || '', invLabel, d.totalDue, d.amountPaid, (d.totalDue - d.amountPaid), d.status || ''];
    }));

  var paymentRows = [];
  data.dues.forEach(function(d) {
    (d.payments || []).forEach(function(p) {
      paymentRows.push([d.id, d.customerName, d.customerPhone || '', p.date || '', p.amount || 0, p.method || '', p.note || '']);
    });
  });
  writeSheet(ss, 'Due Payments', ['Due ID', 'Customer', 'Phone', 'Payment Date', 'Amount', 'Method', 'Note'], paymentRows);

  writeSheet(ss, 'Sync Info', ['Field', 'Value'], [
    ['Synced At', data.syncedAt],
    ['Username', data.username || '']
  ]);

  return ContentService.createTextOutput('OK');
}

function writeSheet(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}`;
