const PDFDocument = require('pdfkit');

// Brand colours
const BLUE = '#2563EB';
const BLUE_LIGHT = '#EFF6FF';
const BLUE_MID = '#DBEAFE';
const GRAY_900 = '#111827';
const GRAY_600 = '#4B5563';
const GRAY_400 = '#9CA3AF';
const GRAY_100 = '#F3F4F6';
const GREEN = '#16A34A';
const GREEN_LIGHT = '#F0FDF4';

function fmtDate(iso) {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    if (isNaN(dt)) return iso;
    // Formatting: 12 July 2026, 02:45 PM
    return dt.toLocaleString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(' at ', ', ');
  } catch (e) {
    return iso;
  }
}

function fmtMoney(amount) {
  try {
    return `BDT ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch (e) {
    return String(amount);
  }
}

/**
 * Generate a PDF receipt for an order
 * @param {Object} order - The populated order object
 * @returns {Promise<Buffer>} - A promise that resolves to the PDF buffer
 */
function generateReceiptPdf(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const buyer = order.buyer || {};
      const seller = order.seller || {};
      const items = order.items || [];
      const address = order.shippingAddress || {};

      const orderId = order._id ? String(order._id) : '';
      const orderShort = orderId ? orderId.slice(-8).toUpperCase() : 'UNKNOWN';
      const createdAt = fmtDate(order.createdAt);
      const status = order.escrowStatus || 'LOCKED';
      const total = order.totalAmount || 0;
      const platformFee = order.platformFee || 0;
      const tracking = order.trackingNumber || '';

      // --- Header ---
      doc.font('Helvetica-Bold').fontSize(22).fillColor(BLUE).text('TrustTrade BD', 50, 50);
      doc.font('Helvetica').fontSize(9).fillColor(GRAY_400).text('Secure Peer-to-Peer Marketplace', 50, 75);
      
      doc.font('Helvetica-Bold').fontSize(16).fillColor(GRAY_900).text('ORDER RECEIPT', 300, 50, { align: 'right' });
      doc.font('Helvetica').fontSize(9).fillColor(GRAY_400).text(`#${orderShort}`, 300, 70, { align: 'right' });

      // Blue divider line
      doc.moveTo(50, 95).lineTo(545, 95).lineWidth(2).stroke(BLUE);

      // --- STATUS BADGE ---
      let bgHex = '#F3F4F6';
      let fgHex = '#374151';
      const statusColours = {
        'LOCKED':    ['#FEF3C7', '#92400E'],
        'SHIPPED':   ['#DBEAFE', '#1E40AF'],
        'DELIVERED': ['#EDE9FE', '#5B21B6'],
        'RELEASED':  ['#D1FAE5', '#065F46'],
        'REFUNDED':  ['#FEE2E2', '#991B1B'],
        'ON_HOLD':   ['#FEE2E2', '#991B1B'],
      };
      if (statusColours[status]) {
        [bgHex, fgHex] = statusColours[status];
      }

      // Draw badge background
      doc.roundedRect(50, 110, 495, 20, 4).fill(bgHex);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(fgHex).text(`Status: ${status}`, 50, 116, { align: 'center', width: 495 });

      // --- ORDER INFO + BUYER + SELLER (3-col) ---
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text('ORDER INFORMATION', 50, 150, { characterSpacing: 1 });

      const buyerName = buyer.name || '—';
      const buyerEmail = buyer.email || '—';
      const sellerName = seller.name || '—';
      const shopName = (seller.sellerProfile && seller.sellerProfile.shopName) ? seller.sellerProfile.shopName : sellerName;
      const sellerEmail = seller.email || '—';

      // Gray Background for Info box
      doc.rect(50, 165, 495, 70).fill(GRAY_100);
      doc.moveTo(50, 185).lineTo(545, 185).lineWidth(0.5).stroke('#E5E7EB');
      
      const col1X = 60, col2X = 220, col3X = 380;
      
      // Row 1 (Headers)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY_600);
      doc.text('ORDER DETAILS', col1X, 172);
      doc.text('BUYER', col2X, 172);
      doc.text('SELLER', col3X, 172);
      
      // Row 2 (Values)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY_900);
      doc.text(`#${orderShort}`, col1X, 192);
      doc.text(buyerName, col2X, 192);
      doc.text(shopName, col3X, 192);

      // Row 3 (Secondary Values)
      doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_600);
      doc.text(createdAt, col1X, 205);
      doc.text(buyerEmail, col2X, 205);
      doc.text(sellerEmail, col3X, 205);

      // Row 4 (Tertiary Values)
      const trackingText = tracking ? `Tracking: ${tracking}` : 'Tracking: Pending';
      const addressText = [address.address, address.city].filter(Boolean).join(', ');
      doc.text(trackingText, col1X, 218);
      doc.text(addressText, col2X, 218);

      // --- ITEMS TABLE ---
      let y = 260;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text('ITEMS PURCHASED', 50, y, { characterSpacing: 1 });
      y += 15;

      // Table Header
      doc.rect(50, y, 495, 20).fill(BLUE);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
      doc.text('Item', 60, y + 6);
      doc.text('Unit Price', 300, y + 6, { width: 80, align: 'right' });
      doc.text('Qty', 390, y + 6, { width: 50, align: 'right' });
      doc.text('Total', 450, y + 6, { width: 85, align: 'right' });
      y += 20;

      // Table Rows
      let isEven = false;
      items.forEach(item => {
        const title = item.title || 'Unknown product';
        const price = Number(item.price || 0);
        const qty = Number(item.quantity || 1);
        const lineTotal = price * qty;
        
        if (isEven) {
          doc.rect(50, y, 495, 20).fill(GRAY_100);
        }
        
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_600);
        doc.text(title.length > 60 ? title.substring(0, 60) + '…' : title, 60, y + 6, { width: 230, height: 15, ellipsis: true });
        doc.text(fmtMoney(price), 300, y + 6, { width: 80, align: 'right' });
        doc.text(String(qty), 390, y + 6, { width: 50, align: 'right' });
        doc.text(fmtMoney(lineTotal), 450, y + 6, { width: 85, align: 'right' });
        
        y += 20;
        isEven = !isEven;
      });

      // Outline the table
      const tableHeight = y - (275);
      doc.rect(50, 275, 495, tableHeight).lineWidth(0.5).stroke('#E5E7EB');

      // Totals
      y += 10;
      if (platformFee && Number(platformFee) > 0) {
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_600).text('Subtotal', 300, y, { width: 140, align: 'right' });
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_900).text(fmtMoney(total), 450, y, { width: 85, align: 'right' });
        y += 15;
        
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_600).text('Platform fee (2.5%)', 300, y, { width: 140, align: 'right' });
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_900).text(`−${fmtMoney(platformFee)}`, 450, y, { width: 85, align: 'right' });
        y += 15;
        
        const sellerRecv = Number(order.sellerReceives !== undefined ? order.sellerReceives : total - platformFee);
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_600).text('Seller received', 300, y, { width: 140, align: 'right' });
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_900).text(fmtMoney(sellerRecv), 450, y, { width: 85, align: 'right' });
        y += 15;
      }

      // Top line for total
      doc.moveTo(350, y).lineTo(545, y).lineWidth(1.5).stroke(BLUE);
      y += 5;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE).text('TOTAL PAID', 300, y, { width: 140, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE).text(fmtMoney(total), 450, y, { width: 85, align: 'right' });
      y += 25;

      // --- SHIPPING ADDRESS ---
      if (Object.keys(address).length > 0) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(BLUE).text('DELIVERY ADDRESS', 50, y, { characterSpacing: 1 });
        y += 15;
        
        const addrParts = [
          address.fullName,
          address.address,
          address.city,
          address.district,
          address.postalCode,
          address.phone
        ].filter(Boolean);
        
        const addrText = addrParts.join('\n');
        
        doc.rect(50, y, 495, 80).fill(BLUE_LIGHT).lineWidth(0.5).stroke(BLUE_MID);
        doc.font('Helvetica').fontSize(9).fillColor(GRAY_900).text(addrText, 60, y + 10, { lineGap: 3 });
        y += 95;
      }

      // --- ESCROW NOTE ---
      doc.rect(50, y, 495, 35).fill(GREEN_LIGHT).lineWidth(0.5).stroke('#BBF7D0');
      const escrowNote = '🔒  Your payment is protected by TrustTrade BD Escrow. Funds are held securely until you confirm delivery of your order. If you have any issues, contact support or raise a dispute from your order page.';
      doc.font('Helvetica').fontSize(8).fillColor('#065F46').text(escrowNote, 60, y + 10, { width: 475, lineGap: 2 });
      y += 50;

      // --- FOOTER ---
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke('#E5E7EB');
      y += 10;
      doc.font('Helvetica').fontSize(8).fillColor(GRAY_400).text('TrustTrade BD  ·  Secure P2P Marketplace  ·  support@trusttrade.bd  ·  trusttrade.bd', 50, y, { align: 'center', width: 495 });
      y += 12;
      
      const genDate = new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).replace(' at ', ' at ');
      
      doc.text(`Generated on ${genDate}  ·  Order #${orderShort}  ·  This is a computer-generated receipt.`, 50, y, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateReceiptPdf
};
