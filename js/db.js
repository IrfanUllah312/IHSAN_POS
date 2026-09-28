/* =====================================================
   DB.js — the app's built-in database.
   Everything is persisted in the browser's localStorage,
   so the app needs no server or external database to run.
===================================================== */
const DB = (() => {
  const KEYS = {
    settings: 'ihsan_settings_v1',
    inventory: 'ihsan_inventory_v1',
    invoices: 'ihsan_invoices_v1',
    dues: 'ihsan_dues_v1',
    invoiceSeq: 'ihsan_invoice_seq_v1',
    auth: 'ihsan_auth_v1'
  };

  const DEFAULT_SETTINGS = {
    businessName: 'IHSAN TRADERS',
    phone: '+923000579411',
    address: '',
    footerNote: 'Thank You For Visiting!',
    lowStockThreshold: 5,
    sheetUrl: '',
    autoSync: false
  };

  const DEFAULT_INVENTORY = {
    'Medium 6 Person (9900)': { stock: 10, purchasePrice: 80, sellPrice: 9900 },
    'Zeera Raita': { stock: 20, purchasePrice: 40, sellPrice: 110 },
    'Mineral Water': { stock: 50, purchasePrice: 30, sellPrice: 110 },
    'Pepsi 1.5': { stock: 30, purchasePrice: 50, sellPrice: 220 }
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DB read error for', key, e);
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('DB write error for', key, e);
      return false;
    }
  }

  function activeUserKey(key) {
    const username = sessionStorage.getItem('ihsan_auth_user');
    return username ? `${key}_${encodeURIComponent(username.toLowerCase())}` : key;
  }

  return {
    KEYS,

    getAccounts() {
      const stored = read(KEYS.auth, null);
      if (!stored) return [];
      if (Array.isArray(stored.accounts)) return stored.accounts;
      if (stored.username && stored.passwordHash) return [stored];
      return [];
    },
    saveAccount(account) {
      const accounts = this.getAccounts();
      accounts.push(account);
      return write(KEYS.auth, { accounts });
    },
    initializeUser(username) {
      const marker = 'ihsan_user_data_migrated_v1';
      if (localStorage.getItem(marker)) return;
      const userKey = key => `${key}_${encodeURIComponent(username.toLowerCase())}`;
      [KEYS.settings, KEYS.inventory, KEYS.invoices, KEYS.dues, KEYS.invoiceSeq].forEach(key => {
        const legacy = localStorage.getItem(key);
        if (legacy !== null && localStorage.getItem(userKey(key)) === null) {
          localStorage.setItem(userKey(key), legacy);
        }
      });
      localStorage.setItem(marker, 'true');
    },

    // ---------- settings ----------
    getSettings() {
      return { ...DEFAULT_SETTINGS, ...read(activeUserKey(KEYS.settings), {}) };
    },
    saveSettings(s) {
      return write(activeUserKey(KEYS.settings), s);
    },

    // ---------- inventory ----------
    getInventory() {
      let inv = read(activeUserKey(KEYS.inventory), null);
      if (!inv) {
        inv = DEFAULT_INVENTORY;
        write(activeUserKey(KEYS.inventory), inv);
      }
      return inv;
    },
    saveInventory(inv) {
      return write(activeUserKey(KEYS.inventory), inv);
    },

    // ---------- invoices ----------
    getInvoices() {
      return read(activeUserKey(KEYS.invoices), []);
    },
    saveInvoices(list) {
      return write(activeUserKey(KEYS.invoices), list);
    },
    addInvoice(invoice) {
      const list = this.getInvoices();
      list.unshift(invoice);
      this.saveInvoices(list);
    },

    // ---------- dues / credit ledger ----------
    // One record per CUSTOMER, matched strictly by phone number
    // (never by name — names collide too easily). Each record
    // accumulates every credit sale in `invoices` and every
    // payment in `payments`.
    getDues() {
      let list = read(activeUserKey(KEYS.dues), []);
      let changed = false;

      // 1) normalize old single-invoice records to the invoices[] shape
      list.forEach(d => {
        if (!d.invoices) {
          d.invoices = [{ invoiceNumber: d.invoiceNumber || '-', date: d.date || '', amount: d.totalDue || 0 }];
          changed = true;
        }
        if (!d.payments) { d.payments = []; changed = true; }
      });

      // 2) merge any duplicate records that belong to the same phone
      //    number (this self-heals data created before this logic existed)
      const merged = [];
      list.forEach(d => {
        const key = customerDueKey(d.customerPhone);
        const target = key ? merged.find(m => customerDueKey(m.customerPhone) === key) : null;
        if (target) {
          target.totalDue = (target.totalDue || 0) + (d.totalDue || 0);
          target.amountPaid = (target.amountPaid || 0) + (d.amountPaid || 0);
          target.invoices = (target.invoices || []).concat(d.invoices || []);
          target.payments = (target.payments || []).concat(d.payments || []);
          if (d.customerName && !target.customerName) target.customerName = d.customerName;
          changed = true;
        } else {
          merged.push(d);
        }
      });

      if (changed || merged.length !== list.length) {
        write(activeUserKey(KEYS.dues), merged);
      }
      return merged;
    },
    saveDues(list) {
      return write(activeUserKey(KEYS.dues), list);
    },

    // ---------- invoice numbering ----------
    peekNextInvoiceNumber() {
      const n = parseInt(localStorage.getItem(activeUserKey(KEYS.invoiceSeq)) || '0', 10);
      return String(n + 1).padStart(4, '0');
    },
    getInvoiceSequence() {
      return localStorage.getItem(activeUserKey(KEYS.invoiceSeq)) || '0';
    },
    nextInvoiceNumber() {
      let n = parseInt(localStorage.getItem(activeUserKey(KEYS.invoiceSeq)) || '0', 10);
      n += 1;
      localStorage.setItem(activeUserKey(KEYS.invoiceSeq), String(n));
      return String(n).padStart(4, '0');
    },
    setInvoiceSeq(n) {
      localStorage.setItem(activeUserKey(KEYS.invoiceSeq), String(Math.max(0, parseInt(n, 10) || 0)));
    },

    // ---------- auth (local access gate — see js/auth.js) ----------
    getAuth() {
      return read(KEYS.auth, null);
    },
    saveAuth(auth) {
      return write(KEYS.auth, auth);
    },
    clearAuth() {
      localStorage.removeItem(KEYS.auth);
    },

    // ---------- utilities ----------
    genId() {
      return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    // ---------- backup / restore ----------
    exportAll() {
      return {
        exportedAt: new Date().toISOString(),
        settings: this.getSettings(),
        inventory: this.getInventory(),
        invoices: this.getInvoices(),
        dues: this.getDues(),
        invoiceSeq: localStorage.getItem(activeUserKey(KEYS.invoiceSeq)) || '0'
      };
    },
    importAll(data) {
      if (!data || typeof data !== 'object') return false;
      if (data.settings) this.saveSettings(data.settings);
      if (data.inventory) this.saveInventory(data.inventory);
      if (data.invoices) this.saveInvoices(data.invoices);
      if (data.dues) this.saveDues(data.dues);
      if (data.invoiceSeq) this.setInvoiceSeq(data.invoiceSeq);
      return true;
    },
    clearAll() {
      // note: auth is intentionally left untouched by "erase all data" —
      // that button is for business records, not the login itself
      [KEYS.settings, KEYS.inventory, KEYS.invoices, KEYS.dues, KEYS.invoiceSeq].forEach(k => localStorage.removeItem(activeUserKey(k)));
    }
  };
})();

// ---------- shared formatting helpers ----------
function formatMoney(n) {
  const num = Number(n) || 0;
  return 'Rs ' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function todayStr() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function nowStr() {
  return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function showToast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'app-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- shared customer-identity helpers ----------
// Phone is the ONLY identifier used to match a customer's due
// record — normalized so formatting differences (dashes, spaces,
// a leading 0 or +92) don't create false negatives. Name is never
// used for matching since two customers can share a name.
function normalizePhone(p) {
  let digits = (p || '').replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}
function customerDueKey(phone) {
  const normPhone = normalizePhone(phone);
  return normPhone.length >= 7 ? 'p:' + normPhone : null;
}
