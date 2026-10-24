import { useState } from 'react';
import { Tag, ReceiptText, PackageCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatNaira } from '../utils/helpers';
import type { Order, OrderItem } from '../types';

type Props = { order: Order };

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] as string));
}

function addressValue(address: Record<string, unknown> | null, key: string): string {
  return String(address?.[key] ?? '').trim();
}

export default function OrderDocuments({ order }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const buildDocument = async (kind: 'tag' | 'receipt' | 'packing') => {
    setBusy(true);
    setMessage('');
    try {
      const { data: items, error } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, name, image_url, size, color, price, quantity, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!items?.length) throw new Error('No products were found for this order.');

      const address = order.shipping_address ?? {};
      const customer = addressValue(address, 'fullName') || addressValue(address, 'full_name') || 'Customer';
      const phone = addressValue(address, 'phone');
      const email = addressValue(address, 'email');
      const addressLines = [
        addressValue(address, 'line1'), addressValue(address, 'line2'),
        [addressValue(address, 'city'), addressValue(address, 'state'), addressValue(address, 'postalCode') || addressValue(address, 'postal_code')].filter(Boolean).join(', '),
        addressValue(address, 'country'),
      ].filter(Boolean);
      const title = kind === 'tag' ? 'DELIVERY TAG' : kind === 'packing' ? 'PACKING SLIP' : 'ORDER RECEIPT';
      const showMoney = kind === 'receipt';
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - ${escapeHtml(order.order_number)}</title><style>
        *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#171717;margin:0;padding:28px}main{max-width:760px;margin:auto;border:1px solid #ddd;padding:28px}.brand{font-size:22px;font-weight:800;letter-spacing:2px}.muted{color:#555}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #111;padding-bottom:16px}.tag{font-size:18px;font-weight:800;border:2px dashed #222;padding:10px;text-align:center;margin:20px 0}.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0}h2{font-size:16px;margin:0 0 8px}p{line-height:1.5;margin:3px 0}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border-bottom:1px solid #ddd;padding:10px 7px;text-align:left;vertical-align:top}th{background:#f3f3f3}.num{text-align:right;white-space:nowrap}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px}.footer{border-top:1px solid #ddd;margin-top:28px;padding-top:12px;font-size:11px;color:#555}.barcode{font-family:monospace;font-size:16px;letter-spacing:2px;margin-top:12px;word-break:break-all}@media print{body{padding:0}main{border:0;max-width:none;padding:12mm}.no-print{display:none}}
      </style></head><body><main>
        <div class="top"><div><div class="brand">VAST NATION</div><p class="muted">${title}</p></div><div style="text-align:right"><strong>Order ${escapeHtml(order.order_number)}</strong><p class="muted">${escapeHtml(new Date(order.created_at).toLocaleString())}</p><p>Payment: ${escapeHtml(order.payment_status || 'pending')}</p></div></div>
        ${kind === 'tag' ? `<div class="tag">DELIVERY — ${escapeHtml(order.order_number)}</div>` : ''}
        <div class="cols"><section><h2>${kind === 'tag' ? 'DELIVER TO' : 'CUSTOMER'}</h2><p><strong>${escapeHtml(customer)}</strong></p>${phone ? `<p>${escapeHtml(phone)}</p>` : ''}${email ? `<p>${escapeHtml(email)}</p>` : ''}${addressLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section><section><h2>${kind === 'tag' ? 'CONTENTS' : 'ORDER DETAILS'}</h2><p>Order: ${escapeHtml(order.order_number)}</p><p>Delivery: ${escapeHtml(order.delivery_method || 'Standard')}</p><p>Order status: ${escapeHtml(order.status || 'pending')}</p>${kind !== 'tag' ? `<p>Payment reference: ${escapeHtml(order.payment_reference || order.payment_ref || 'N/A')}</p>` : ''}</section></div>
        <table><thead><tr><th>Product / variant</th><th class="num">Qty</th>${showMoney ? '<th class="num">Unit price</th><th class="num">Amount</th>' : ''}</tr></thead><tbody>${(items as OrderItem[]).map((item) => `<tr><td>${escapeHtml(item.name)}${item.size ? `<br><small>Size: ${escapeHtml(item.size)}</small>` : ''}${item.color ? `<br><small>Colour: ${escapeHtml(item.color)}</small>` : ''}${kind === 'tag' ? `<br><small>Product ID: ${escapeHtml(item.product_id || 'N/A')}</small>` : ''}</td><td class="num">${item.quantity}</td>${showMoney ? `<td class="num">${escapeHtml(formatNaira(Number(item.price)))}</td><td class="num">${escapeHtml(formatNaira(Number(item.price) * Number(item.quantity)))}</td>` : ''}</tr>`).join('')}</tbody></table>
        ${showMoney ? `<p class="total">Total paid: ${escapeHtml(formatNaira(Number(order.total)))}</p>` : `<p style="margin-top:18px"><strong>Total units to ${kind === 'tag' ? 'deliver' : 'pack'}: ${(items as OrderItem[]).reduce((sum, item) => sum + Number(item.quantity), 0)}</strong></p>`}
        <div class="barcode">ORDER ID: ${escapeHtml(order.id)}</div><div class="footer">${kind === 'receipt' ? 'Thank you for shopping with Vast Nation.' : 'Match every listed product and quantity to this order before dispatch.'}</div>
        <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 16px">Save as PDF / Print</button></main></body></html>`;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setMessage('Document opened in a new tab. Choose “Save as PDF” in the print dialog to save a PDF, or select your printer to print it.');
      } else {
        setMessage('Your browser blocked the document tab. Allow pop-ups for this site, then try again.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not prepare order document.');
    } finally {
      setBusy(false);
    }
  };

  const buttonClass = 'inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-50';
  return <div className="mt-4 border-t border-white/10 pt-4">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Delivery documents</p>
    <p className="mb-3 text-xs text-ink-400">Open a document, then choose “Save as PDF” in your browser print dialog or print directly.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void buildDocument('tag')} className={buttonClass}><Tag className="h-4 w-4" /> Delivery tag (PDF / Print)</button>
      <button type="button" disabled={busy} onClick={() => void buildDocument('receipt')} className={buttonClass}><ReceiptText className="h-4 w-4" /> Receipt (PDF / Print)</button>
      <button type="button" disabled={busy} onClick={() => void buildDocument('packing')} className={buttonClass}><PackageCheck className="h-4 w-4" /> Packing slip (PDF / Print)</button>
    </div>
    {busy && <p className="mt-2 text-xs text-ink-400">Preparing document…</p>}
    {message && <p role="status" className="mt-2 text-xs text-ink-300">{message}</p>}
  </div>;
}
