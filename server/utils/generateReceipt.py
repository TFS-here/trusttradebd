"""
generateReceipt.py
──────────────────────────────────────────────────────────────────
Generates a professional order receipt PDF for TrustTrade BD.
Called from Node.js via child_process.spawn with order data as JSON.

Usage (from Node):
  python3 utils/generateReceipt.py '{"order": {...}}'

Outputs the PDF bytes to stdout — Node captures and streams to client.
"""

import sys
import json
import io
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Brand colours ─────────────────────────────────────────────────
BLUE       = HexColor('#2563EB')
BLUE_LIGHT = HexColor('#EFF6FF')
BLUE_MID   = HexColor('#DBEAFE')
GRAY_900   = HexColor('#111827')
GRAY_600   = HexColor('#4B5563')
GRAY_400   = HexColor('#9CA3AF')
GRAY_100   = HexColor('#F3F4F6')
GREEN      = HexColor('#16A34A')
GREEN_LIGHT= HexColor('#F0FDF4')
AMBER      = HexColor('#D97706')

W, H = A4  # 210 × 297 mm

# ── Styles ────────────────────────────────────────────────────────
def make_styles():
    return {
        'brand': ParagraphStyle('brand',
            fontName='Helvetica-Bold', fontSize=22,
            textColor=BLUE, alignment=TA_LEFT),

        'tagline': ParagraphStyle('tagline',
            fontName='Helvetica', fontSize=9,
            textColor=GRAY_400, alignment=TA_LEFT, spaceBefore=15),

        'receipt_title': ParagraphStyle('receipt_title',
            fontName='Helvetica-Bold', fontSize=16,
            textColor=GRAY_900, alignment=TA_RIGHT,spaceBefore=2),

        'receipt_sub': ParagraphStyle('receipt_sub',
            fontName='Helvetica', fontSize=9,
            textColor=GRAY_400, alignment=TA_RIGHT, spaceBefore=2),

        'section_head': ParagraphStyle('section_head',
            fontName='Helvetica-Bold', fontSize=8,
            textColor=BLUE, spaceBefore=14, spaceAfter=4,
            letterSpacing=1),

        'label': ParagraphStyle('label',
            fontName='Helvetica', fontSize=8.5,
            textColor=GRAY_400),

        'value': ParagraphStyle('value',
            fontName='Helvetica-Bold', fontSize=9,
            textColor=GRAY_900),

        'value_sm': ParagraphStyle('value_sm',
            fontName='Helvetica', fontSize=8.5,
            textColor=GRAY_600),

        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=8,
            textColor=GRAY_400, alignment=TA_CENTER),

        'status_text': ParagraphStyle('status_text',
            fontName='Helvetica-Bold', fontSize=9,
            textColor=GREEN),
    }

# ── Helpers ───────────────────────────────────────────────────────
def fmt_date(iso):
    try:
        dt = datetime.fromisoformat(iso.replace('Z', '+00:00'))
        return dt.strftime('%d %B %Y, %I:%M %p')
    except Exception:
        return iso

def fmt_money(amount):
    try:
        return f"\u09f3{float(amount):,.2f}"
    except Exception:
        return str(amount)

def info_row(label, value, styles):
    return [
        Paragraph(label, styles['label']),
        Paragraph(str(value) if value else '—', styles['value_sm']),
    ]

# ── Main generator ────────────────────────────────────────────────
def generate_receipt(order_data: dict) -> bytes:
    order   = order_data.get('order', order_data)
    buyer   = order.get('buyer',  {})
    seller  = order.get('seller', {})
    items   = order.get('items',  [])
    address = order.get('shippingAddress', {})

    order_id    = str(order.get('_id', ''))
    order_short = order_id[-8:].upper() if order_id else 'UNKNOWN'
    created_at  = fmt_date(order.get('createdAt', ''))
    status      = order.get('escrowStatus', 'LOCKED')
    total       = order.get('totalAmount', 0)
    platform_fee= order.get('platformFee', 0)
    tracking    = order.get('trackingNumber', '')

    styles = make_styles()
    buf    = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )

    story = []

    # ── HEADER ────────────────────────────────────────────────────
    header_data = [[
        # Left: brand
        [Paragraph('TrustTrade BD', styles['brand']),
         Paragraph('Secure Peer-to-Peer Marketplace', styles['tagline'])],
        # Right: receipt title
        [Paragraph('ORDER RECEIPT', styles['receipt_title']),
         Paragraph(f'#{order_short}', styles['receipt_sub'])],
    ]]

    header_tbl = Table(header_data, colWidths=[90*mm, 80*mm])
    header_tbl.setStyle(TableStyle([
        ('VALIGN',      (0,0), (-1,-1), 'TOP'),
        ('ALIGN',       (1,0), (1,0),   'RIGHT'),
        ('BOTTOMPADDING',(0,0),(-1,-1), 10),
    ]))
    story.append(header_tbl)

    # Blue divider line
    story.append(HRFlowable(width='100%', thickness=2, color=BLUE, spaceAfter=4))

    # ── STATUS BADGE ──────────────────────────────────────────────
    status_colours = {
        'LOCKED':    ('#FEF3C7', '#92400E'),
        'SHIPPED':   ('#DBEAFE', '#1E40AF'),
        'DELIVERED': ('#EDE9FE', '#5B21B6'),
        'RELEASED':  ('#D1FAE5', '#065F46'),
        'REFUNDED':  ('#FEE2E2', '#991B1B'),
        'ON_HOLD':   ('#FEE2E2', '#991B1B'),
    }
    bg_hex, fg_hex = status_colours.get(status, ('#F3F4F6', '#374151'))

    badge_style = ParagraphStyle('badge',
        fontName='Helvetica-Bold', fontSize=8.5,
        textColor=HexColor(fg_hex), alignment=TA_CENTER)

    badge_tbl = Table([[Paragraph(f'  Status: {status}  ', badge_style)]],
                      colWidths=[170*mm])
    badge_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor(bg_hex)),
        ('ROUNDEDCORNERS', (0,0), (-1,-1), [4,4,4,4]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(Spacer(1, 6))
    story.append(badge_tbl)
    story.append(Spacer(1, 4))

    # ── ORDER INFO + BUYER + SELLER (3-col) ───────────────────────
    story.append(Paragraph('ORDER INFORMATION', styles['section_head']))

    buyer_name  = buyer.get('name',  '—')
    buyer_email = buyer.get('email', '—')
    seller_name = seller.get('name', '—')
    shop_name   = (seller.get('sellerProfile') or {}).get('shopName', seller_name)
    seller_email= seller.get('email', '—')

    info_data = [
        # Row 1: headers
        [Paragraph('ORDER DETAILS', ParagraphStyle('h', fontName='Helvetica-Bold',
                                                    fontSize=8, textColor=GRAY_600)),
         Paragraph('BUYER', ParagraphStyle('h', fontName='Helvetica-Bold',
                                           fontSize=8, textColor=GRAY_600)),
         Paragraph('SELLER', ParagraphStyle('h', fontName='Helvetica-Bold',
                                             fontSize=8, textColor=GRAY_600))],
        # Row 2: order id / buyer name / seller shop
        [Paragraph(f'#{order_short}', styles['value']),
         Paragraph(buyer_name, styles['value']),
         Paragraph(shop_name, styles['value'])],
        # Row 3: date / buyer email / seller email
        [Paragraph(created_at, styles['value_sm']),
         Paragraph(buyer_email, styles['value_sm']),
         Paragraph(seller_email, styles['value_sm'])],
        # Row 4: tracking / address / blank
        [Paragraph(f'Tracking: {tracking}' if tracking else 'Tracking: Pending',
                   styles['value_sm']),
         Paragraph(
             f"{address.get('address','')}, {address.get('city','')}".strip(', '),
             styles['value_sm']),
         Paragraph('', styles['value_sm'])],
    ]

    info_tbl = Table(info_data, colWidths=[58*mm, 58*mm, 54*mm])
    info_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), GRAY_100),
        ('TOPPADDING',    (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [white, GRAY_100]),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#E5E7EB')),
        ('INNERGRID',     (0,0), (-1,-1), 0.5, HexColor('#E5E7EB')),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(info_tbl)

    # ── ITEMS TABLE ───────────────────────────────────────────────
    story.append(Paragraph('ITEMS PURCHASED', styles['section_head']))

    col_head = ParagraphStyle('col_head',
        fontName='Helvetica-Bold', fontSize=8.5,
        textColor=white, alignment=TA_LEFT)
    col_right = ParagraphStyle('col_right',
        fontName='Helvetica-Bold', fontSize=8.5,
        textColor=white, alignment=TA_RIGHT)

    item_rows = [[
        Paragraph('Item', col_head),
        Paragraph('Unit Price', col_right),
        Paragraph('Qty', col_right),
        Paragraph('Total', col_right),
    ]]

    for item in items:
        title = item.get('title', 'Unknown product')
        price = float(item.get('price', 0))
        qty   = int(item.get('quantity', 1))
        line  = price * qty

        item_rows.append([
            Paragraph(title[:60] + ('…' if len(title) > 60 else ''), styles['value_sm']),
            Paragraph(fmt_money(price), styles['value_sm']),
            Paragraph(str(qty), styles['value_sm']),
            Paragraph(fmt_money(line), styles['value_sm']),
        ])

    # Totals rows
    item_rows.append(['', '', '', ''])  # spacer row

    def total_row(label, value, bold=False):
        s = ParagraphStyle('tr',
            fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=9 if bold else 8.5,
            textColor=BLUE if bold else GRAY_600,
            alignment=TA_RIGHT)
        sv = ParagraphStyle('tv',
            fontName='Helvetica-Bold' if bold else 'Helvetica',
            fontSize=9 if bold else 8.5,
            textColor=BLUE if bold else GRAY_900,
            alignment=TA_RIGHT)
        return ['', '', Paragraph(label, s), Paragraph(value, sv)]

    if platform_fee and float(platform_fee) > 0:
        item_rows.append(total_row('Subtotal', fmt_money(total)))
        item_rows.append(total_row('Platform fee (2.5%)', f'−{fmt_money(platform_fee)}'))
        seller_recv = float(order.get('sellerReceives', float(total) - float(platform_fee)))
        item_rows.append(total_row('Seller received', fmt_money(seller_recv)))

    item_rows.append(total_row('TOTAL PAID', fmt_money(total), bold=True))

    item_tbl = Table(item_rows, colWidths=[88*mm, 30*mm, 20*mm, 32*mm])
    item_tbl.setStyle(TableStyle([
        # Header row
        ('BACKGROUND',    (0,0), (-1,0), BLUE),
        ('TEXTCOLOR',     (0,0), (-1,0), white),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 6),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS',(0,1), (-1,-2), [white, GRAY_100]),
        ('ALIGN',         (1,0), (-1,-1), 'RIGHT'),
        ('BOX',           (0,0), (-1,-2), 0.5, HexColor('#E5E7EB')),
        ('INNERGRID',     (0,0), (-1,-2), 0.5, HexColor('#E5E7EB')),
        ('LINEABOVE',     (2,-1), (-1,-1), 1.5, BLUE),
        ('TOPPADDING',    (0,-1), (-1,-1), 8),
    ]))
    story.append(item_tbl)

    # ── SHIPPING ADDRESS ──────────────────────────────────────────
    if address:
        story.append(Paragraph('DELIVERY ADDRESS', styles['section_head']))
        addr_parts = [
            address.get('fullName', ''),
            address.get('address', ''),
            address.get('city', ''),
            address.get('district', ''),
            address.get('postalCode', ''),
            address.get('phone', ''),
        ]
        addr_text = '\n'.join(p for p in addr_parts if p)

        addr_style = ParagraphStyle('addr',
            fontName='Helvetica', fontSize=9,
            textColor=GRAY_900, leading=14)

        addr_tbl = Table([[Paragraph(addr_text, addr_style)]],
                         colWidths=[170*mm])
        addr_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), BLUE_LIGHT),
            ('LEFTPADDING',   (0,0), (-1,-1), 10),
            ('TOPPADDING',    (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('BOX',           (0,0), (-1,-1), 0.5, BLUE_MID),
        ]))
        story.append(addr_tbl)

    # ── ESCROW NOTE ───────────────────────────────────────────────
    story.append(Spacer(1, 10))
    escrow_note = (
        'Your payment is protected by TrustTrade BD Escrow. Funds are held securely '
        'until you confirm delivery of your order. If you have any issues, '
        'contact support or raise a dispute from your order page.'
    )
    note_style = ParagraphStyle('note',
        fontName='Helvetica', fontSize=8,
        textColor=HexColor('#065F46'), leading=12)

    note_tbl = Table([[Paragraph(f'🔒  {escrow_note}', note_style)]],
                     colWidths=[170*mm])
    note_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), GREEN_LIGHT),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('BOX',           (0,0), (-1,-1), 0.5, HexColor('#BBF7D0')),
    ]))
    story.append(note_tbl)

    # ── FOOTER ────────────────────────────────────────────────────
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width='100%', thickness=0.5, color=HexColor('#E5E7EB')))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        'TrustTrade BD  ·  Secure P2P Marketplace  ·  support@trusttrade.bd  ·  trusttrade.bd',
        styles['footer']
    ))
    story.append(Paragraph(
        f'Generated on {datetime.now().strftime("%d %B %Y at %I:%M %p")}  ·  '
        f'Order #{order_short}  ·  This is a computer-generated receipt.',
        styles['footer']
    ))

    doc.build(story)
    return buf.getvalue()


# ── Entry point ───────────────────────────────────────────────────
if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.stderr.write('Usage: python3 generateReceipt.py \'{"order": {...}}\'\n')
        sys.exit(1)

    try:
        data = json.loads(sys.argv[1])
        pdf_bytes = generate_receipt(data)
        sys.stdout.buffer.write(pdf_bytes)
    except Exception as e:
        sys.stderr.write(f'Error generating PDF: {e}\n')
        sys.exit(1)
