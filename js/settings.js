/* =====================================================
   settings.js — business info, sheet sync, backup/restore
===================================================== */
renderShell('settings.html', 'Settings', 'Business & data');

function loadSettingsForm() {
  const s = DB.getSettings();
  document.getElementById('s-business-name').value = s.businessName;
  document.getElementById('s-phone').value = s.phone;
  document.getElementById('s-address').value = s.address;
  document.getElementById('s-footer').value = s.footerNote;
  document.getElementById('s-threshold').value = s.lowStockThreshold;
  document.getElementById('s-invoice-seq').value = parseInt(DB.getInvoiceSequence() || '0', 10) + 1;
  document.getElementById('s-sheet-url').value = s.sheetUrl;
  document.getElementById('s-autosync').checked = !!s.autoSync;
  document.getElementById('script-block').textContent = APPS_SCRIPT_TEMPLATE;
}

function saveBusinessSettings() {
  const s = DB.getSettings();
  s.businessName = document.getElementById('s-business-name').value.trim() || 'My Business';
  s.phone = document.getElementById('s-phone').value.trim();
  s.address = document.getElementById('s-address').value.trim();
  s.footerNote = document.getElementById('s-footer').value.trim() || 'Thank You For Visiting!';
  s.lowStockThreshold = parseInt(document.getElementById('s-threshold').value) || 0;
  DB.saveSettings(s);
  DB.setInvoiceSeq(parseInt(document.getElementById('s-invoice-seq').value) - 1);
  renderShell('settings.html', 'Settings', 'Business & data');
  showToast('Business info saved.');
}

function saveSheetSettings() {
  const s = DB.getSettings();
  s.sheetUrl = document.getElementById('s-sheet-url').value.trim();
  s.autoSync = document.getElementById('s-autosync').checked;
  DB.saveSettings(s);
  showToast('Sheet settings saved.');
}

function testSync() {
  saveSheetSettings();
  syncToGoogleSheet(false);
}

function copyScript() {
  navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE)
    .then(() => showToast('Script copied — paste it into Apps Script.'))
    .catch(() => alert('Could not copy automatically — please select and copy the script manually.'));
}

function exportBackup() {
  const data = DB.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ihsan-traders-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded.');
}

function importBackup(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm('This will overwrite current data in this browser with the backup file. Continue?')) return;
      DB.importAll(data);
      loadSettingsForm();
      showToast('Backup restored.');
    } catch (e) {
      alert('That file could not be read as a valid backup.');
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

function clearAllData() {
  if (!confirm('This permanently deletes all inventory, invoices, and dues from this browser. This cannot be undone. Continue?')) return;
  if (!confirm('Are you absolutely sure? Consider exporting a backup first.')) return;
  DB.clearAll();
  location.reload();
}

loadSettingsForm();
