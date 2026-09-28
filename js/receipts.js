/* =====================================================
   receipts.js — builds printable receipt documents and
   handles printing / sharing them (invoice copies and
   "amount due" credit receipts).
===================================================== */

const RECEIPT_CSS = `
  *{box-sizing:border-box;}
  body{font-family:Arial, sans-serif; font-size:12px; width:80mm; margin:0 auto; padding:10px; color:#111;}
  .r-head{text-align:center; margin-bottom:8px;}
  .r-head h1{margin:0; font-size:16px;}
  .r-head p{margin:2px 0;}
  .r-tag{display:inline-block; margin-top:4px; padding:2px 8px; border:1px solid #111; font-size:10px; letter-spacing:.05em; text-transform:uppercase;}
  hr{border:none; border-top:1px dashed #111; margin:8px 0;}
  table{width:100%; border-collapse:collapse; margin:8px 0;}
  th,td{padding:3px 2px; font-size:11.5px; text-align:left;}
  th{border-bottom:1px solid #111; font-size:10px; text-transform:uppercase;}
  td.num, th.num{text-align:right;}
  .totals p{display:flex; justify-content:space-between; margin:3px 0; font-size:12px;}
  .totals p.grand{font-weight:bold; font-size:14px; border-top:1px solid #111; padding-top:5px;}
  .totals p.due{font-weight:bold; color:#111;}
  .r-foot{text-align:center; margin-top:14px; font-size:10px;}
  .note{margin-top:8px; font-size:11px; border:1px dashed #111; padding:6px; text-align:center;}
`;

function openPrintWindow(bodyHtml, title) {
  const w = window.open('', '_blank', 'width=420,height=680');
  if (!w) {
    alert('Please allow pop-ups for this site to print receipts.');
    return null;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <meta charset="UTF-8"><style>${RECEIPT_CSS}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return w;
}

// ---- Invoice copy (full items list) ----
function buildInvoiceReceiptHtml(invoice, settings) {
  const rows = invoice.items.map(it => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${it.price}</td>
      <td class="num">${it.total}</td>
    </tr>`).join('');

  const statusLabel = invoice.status === 'paid' ? 'PAID IN FULL'
    : invoice.status === 'partial' ? 'PARTIALLY PAID' : 'ON CREDIT';

  return `
    <div class="r-head">
      <h1>${escapeHtml(settings.businessName)}</h1>
      ${settings.address ? `<p>${escapeHtml(settings.address)}</p>` : ''}
      <p>Ph#: ${escapeHtml(settings.phone)}</p>
      <p><strong>Customer Copy</strong></p>
    </div>
    <hr>
    <p>Order #: ${escapeHtml(invoice.number)}</p>
    <p>Date: ${escapeHtml(invoice.date)}</p>
    <p>Customer: ${escapeHtml(invoice.customerName || 'Walk-in')}</p>
    ${invoice.customerPhone ? `<p>Phone: ${escapeHtml(invoice.customerPhone)}</p>` : ''}
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <p class="grand"><span>Grand Total</span><span>${formatMoney(invoice.grandTotal)}</span></p>
      <p><span>Amount Paid</span><span>${formatMoney(invoice.amountPaid)}</span></p>
      ${invoice.balanceDue > 0 ? `<p class="due"><span>Balance Due</span><span>${formatMoney(invoice.balanceDue)}</span></p>` : ''}
    </div>
    <p style="text-align:center;margin-top:8px;"><span class="r-tag">${statusLabel}</span></p>
    <div class="r-foot">
      <p><strong>${escapeHtml(settings.footerNote || 'Thank You For Visiting!')}</strong></p>
      <p>Software by Irfan Bettani &middot; +923491939236</p>
    </div>
  `;
}

function printInvoiceReceipt(invoice) {
  const settings = DB.getSettings();
  openPrintWindow(buildInvoiceReceiptHtml(invoice, settings), `Invoice ${invoice.number}`);
}

function invoicePdfBlob(invoice, settings) {
  if (!window.jspdf || !window.jspdf.jsPDF) return null;
  const rows = invoice.items || [];
  const height = Math.max(150, 105 + rows.length * 8);
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: [80, height] });
  let y = 10;
  const line = (text, size = 9, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(String(text), 5, y);
    y += size >= 12 ? 7 : 5;
  };

  line(settings.businessName, 13, true);
  if (settings.address) line(settings.address);
  line(`Ph#: ${settings.phone}`);
  y += 2;
  line(`Invoice #${invoice.number}`, 10, true);
  line(`Date: ${invoice.date}`);
  line(`Customer: ${invoice.customerName || 'Walk-in'}`);
  if (invoice.customerPhone) line(`Phone: ${invoice.customerPhone}`);
  y += 2;
  rows.forEach(item => line(`${item.name} x${item.qty}   ${formatMoney(item.total)}`));
  y += 2;
  doc.line(5, y, 75, y);
  y += 7;
  line(`Grand Total: ${formatMoney(invoice.grandTotal)}`, 11, true);
  line(`Amount Paid: ${formatMoney(invoice.amountPaid)}`);
  if (invoice.balanceDue > 0) line(`Balance Due: ${formatMoney(invoice.balanceDue)}`, 10, true);
  y += 5;
  line(settings.footerNote || 'Thank You For Visiting!', 8);
  return doc.output('blob');
}

async function shareInvoicePdf(invoice) {
  const settings = DB.getSettings();
  const blob = invoicePdfBlob(invoice, settings);
  if (!blob) {
    alert('PDF sharing is unavailable because the PDF component did not load. Please check your internet connection and try again.');
    return;
  }
  const file = new File([blob], `invoice-${invoice.number}.pdf`, { type: 'application/pdf' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ title: `Invoice ${invoice.number}`, text: `Invoice ${invoice.number} from ${settings.businessName}`, files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoice.number}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  window.open(`https://wa.me/?text=${encodeURIComponent(`Invoice ${invoice.number} from ${settings.businessName}. The PDF was downloaded; attach it in WhatsApp and choose a contact.`)}`, '_blank');
}

// ---- Due / credit receipt (customer's running balance) ----
// A due record can span several invoices, since credit sales for the
// same customer accumulate onto one ledger row instead of creating a
// new row each time.
function buildDueReceiptHtml(due, settings) {
  const remaining = Math.max(0, due.totalDue - due.amountPaid);
  const invs = due.invoices || [];
  const payments = due.payments || [];
  const invRows = invs.map(i => `
    <tr><td>#${escapeHtml(i.invoiceNumber)}</td><td>${escapeHtml(i.date)}</td><td class="num">${formatMoney(i.amount)}</td></tr>
  `).join('');
  const paymentRows = payments.map(payment => `
    <tr>
      <td>${escapeHtml(payment.date || '-')}</td>
      <td>${escapeHtml(payment.method || 'Cash payment')}</td>
      <td class="num">${formatMoney(payment.amount)}</td>
    </tr>
  `).join('');

  return `
    <div class="r-head">
      <h1>${escapeHtml(settings.businessName)}</h1>
      ${settings.address ? `<p>${escapeHtml(settings.address)}</p>` : ''}
      <p>Ph#: ${escapeHtml(settings.phone)}</p>
      <p class="r-tag">Amount Due Receipt</p>
    </div>
    <hr>
    <p>Customer: ${escapeHtml(due.customerName || '-')}</p>
    ${due.customerPhone ? `<p>Phone: ${escapeHtml(due.customerPhone)}</p>` : ''}
    <hr>
    <table>
      <thead><tr><th>Invoice</th><th>Date</th><th class="num">Amount</th></tr></thead>
      <tbody>${invRows || '<tr><td colspan="3">-</td></tr>'}</tbody>
    </table>
    <hr>
    <p><strong>Payment Transactions</strong></p>
    <table>
      <thead><tr><th>Date</th><th>Method</th><th class="num">Amount</th></tr></thead>
      <tbody>${paymentRows || '<tr><td colspan="3">No payments recorded</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <p><span>Total Owed (all invoices)</span><span>${formatMoney(due.totalDue)}</span></p>
      <p><span>Total Paid</span><span>${formatMoney(due.amountPaid)}</span></p>
      <p class="grand due"><span>Balance Owed</span><span>${formatMoney(remaining)}</span></p>
    </div>
    <div class="note">
      This receipt confirms Rs ${remaining.toLocaleString('en-US')} is owed to
      ${escapeHtml(settings.businessName)} across ${invs.length} invoice(s).
    </div>
    <div class="r-foot">
      <p>${escapeHtml(settings.footerNote || 'Thank You For Visiting!')}</p>
      <p>Software by Irfan Bettani &middot; +923491939236</p>
    </div>
  `;
}

function printDueReceipt(due) {
  const settings = DB.getSettings();
  openPrintWindow(buildDueReceiptHtml(due, settings), `Due Receipt - ${due.customerName || 'Customer'}`);
}

function dueReceiptPlainText(due, settings) {
  const remaining = Math.max(0, due.totalDue - due.amountPaid);
  const invs = due.invoices || [];
  const payments = due.payments || [];
  const invLine = invs.map(i => `#${i.invoiceNumber} (${formatMoney(i.amount)})`).join(', ');
  const paymentLines = payments.length
    ? payments.map(payment => `- ${payment.date || '-'} | ${payment.method || 'Cash payment'} | ${formatMoney(payment.amount)}${payment.note ? ` | ${payment.note}` : ''}`).join('\n')
    : '- None';
  return [
    `${settings.businessName} — Amount Due Receipt`,
    `Customer: ${due.customerName || '-'}${due.customerPhone ? ' (' + due.customerPhone + ')' : ''}`,
    `Invoices: ${invLine || '-'}`,
    `Total Owed: ${formatMoney(due.totalDue)}`,
    'Payment Transactions:',
    paymentLines,
    `Total Paid: ${formatMoney(due.amountPaid)}`,
    `Balance Owed: ${formatMoney(remaining)}`,
    `— ${settings.businessName}, Ph: ${settings.phone}`
  ].join('\n');
}

async function shareDueReceipt(due) {
  const settings = DB.getSettings();
  const text = dueReceiptPlainText(due, settings);
  if (navigator.share) {
    try {
      await navigator.share({ title: `Due Receipt - ${due.customerName || 'Customer'}`, text });
      return;
    } catch (e) { /* user cancelled — fall through silently */ return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Sharing isn\u2019t supported here — receipt text copied instead.');
  } catch (e) {
    alert(text);
  }
}
