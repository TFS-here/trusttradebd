const nodemailer = require('nodemailer');

// ── Transporter factory ───────────────────────────────────────────
/**
 * Returns a Nodemailer transporter.
 * - Production / staging: uses real SMTP credentials from .env
 * - Development (no EMAIL_USER set): auto-creates an Ethereal test account
 *   and prints the preview URL to the console — no real email sent.
 */
const createTransporter = async () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Real SMTP (Gmail, Brevo, SendGrid SMTP, etc.)
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true', // true for port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // Ethereal fallback — auto-creates a disposable test account
  const testAccount = await nodemailer.createTestAccount();
  console.log('\n📬  [Ethereal] No EMAIL_USER set — using fake SMTP for email preview.');
  console.log(`    User: ${testAccount.user} | Pass: ${testAccount.pass}\n`);

  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

// ── HTML email template ───────────────────────────────────────────
const buildOtpHtml = (otp, name) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your TrustTrade BD email</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(145deg,#16161f,#1a1a2a);border:1px solid rgba(139,92,246,0.25);border-radius:20px;overflow:hidden;max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-block;line-height:40px;text-align:center;font-size:22px;">🛡️</div>
                <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">TrustTrade<span style="opacity:0.75"> BD</span></span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#f4f4f8;font-size:22px;font-weight:700;">Verify your email address</h2>
              <p style="margin:0 0 28px;color:#9ca3af;font-size:15px;line-height:1.6;">
                Hi <strong style="color:#e5e7eb;">${name}</strong>, thanks for joining TrustTrade BD!<br/>
                Use the code below to verify your account. It expires in <strong style="color:#a78bfa;">10 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Your verification code</p>
                <div style="font-size:44px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:'Courier New',monospace;">${otp}</div>
              </div>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Didn't request this? You can safely ignore this email.</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">This code is valid for <strong style="color:#9ca3af;">10 minutes</strong> only.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">© ${new Date().getFullYear()} TrustTrade BD — Secure P2P Escrow Marketplace</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buildResetPasswordHtml = (otp, name) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your TrustTrade BD password</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(145deg,#16161f,#1a1a2a);border:1px solid rgba(139,92,246,0.25);border-radius:20px;overflow:hidden;max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-block;line-height:40px;text-align:center;font-size:22px;">🛡️</div>
                <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">TrustTrade<span style="opacity:0.75"> BD</span></span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#f4f4f8;font-size:22px;font-weight:700;">Reset your password</h2>
              <p style="margin:0 0 28px;color:#9ca3af;font-size:15px;line-height:1.6;">
                Hi <strong style="color:#e5e7eb;">${name}</strong>,<br/>
                We received a request to reset the password for your TrustTrade BD account. Use the OTP below to verify your request. This code expires in <strong style="color:#a78bfa;">15 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Your reset code</p>
                <div style="font-size:44px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:'Courier New',monospace;">${otp}</div>
              </div>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Didn't request this? You can safely ignore this email and your password will remain unchanged.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">© ${new Date().getFullYear()} TrustTrade BD — Secure P2P Escrow Marketplace</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── HTML order confirmation template ──────────────────────────────
const buildOrderConfirmationHtml = (name, order, orderUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order Confirmation - TrustTrade BD</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Segoe UI',Arial,sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;max-width:600px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <h2 style="margin:0;color:#f4f4f5;font-size:24px;font-weight:700;">Order Confirmed! 🎉</h2>
            </td>
          </tr>
          <tr>
            <td style="color:#a1a1aa;font-size:15px;line-height:1.6;">
              Hi <strong style="color:#f4f4f5;">${name}</strong>,<br><br>
              Thank you for your order! We've received your payment and your order is now confirmed.
              <br><br>
              <strong style="color:#f4f4f5;">Order ID:</strong> #${order._id.toString().slice(-8).toUpperCase()}<br>
              <strong style="color:#f4f4f5;">Total Amount:</strong> ৳${order.totalAmount.toLocaleString('en-BD')}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #27272a;border-radius:8px;padding:16px;">
                <tr>
                  <td style="padding-bottom:8px;border-bottom:1px solid #27272a;color:#f4f4f5;font-weight:600;">Order Summary</td>
                </tr>
                ${order.items.map(item => `
                <tr>
                  <td style="padding:8px 0;color:#a1a1aa;font-size:14px;border-bottom:1px solid #27272a;">
                    ${item.quantity}x ${item.title} <span style="float:right;color:#f4f4f5;">৳${(item.price * item.quantity).toLocaleString('en-BD')}</span>
                  </td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0;">
              <a href="${orderUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">View Order Details</a>
            </td>
          </tr>
          <tr>
            <td style="color:#71717a;font-size:13px;text-align:center;">
              If you have any questions, reply to this email or contact our support team.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── Main send function ────────────────────────────────────────────
/**
 * Sends an OTP verification email.
 * @param {string} to      - Recipient email address
 * @param {string} otp     - 6-digit plaintext OTP
 * @param {string} name    - Recipient's display name
 */
const sendVerificationEmail = async (to, otp, name = 'there') => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: `"TrustTrade BD" <${process.env.EMAIL_USER || 'noreply@trusttradebd.com'}>`,
    to,
    subject: `${otp} is your TrustTrade BD verification code`,
    text: `Hi ${name},\n\nYour TrustTrade BD verification code is: ${otp}\n\nIt expires in 10 minutes. Do not share it with anyone.\n\nIf you didn't register, ignore this email.`,
    html: buildOtpHtml(otp, name),
  });

  // In development (Ethereal) — print the preview URL
  if (!process.env.EMAIL_USER) {
    console.log(`\n📧  [Email Preview] Open in browser: ${nodemailer.getTestMessageUrl(info)}\n`);
  }

  return info;
};

/**
 * Sends a password reset email.
 * @param {string} to      - Recipient email address
 * @param {string} otp     - Password reset OTP
 * @param {string} name    - Recipient's display name
 */
const sendPasswordResetEmail = async (to, otp, name = 'there') => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: `"TrustTrade BD" <${process.env.EMAIL_USER || 'noreply@trusttradebd.com'}>`,
    to,
    subject: 'Reset your TrustTrade BD password',
    text: `Hi ${name},\n\nWe received a request to reset your password. Your reset code is:\n\n${otp}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: buildResetPasswordHtml(otp, name),
  });

  // In development (Ethereal) — print the preview URL
  if (!process.env.EMAIL_USER) {
    console.log(`\n📧  [Password Reset Email Preview] Open in browser: ${nodemailer.getTestMessageUrl(info)}\n`);
  }

  return info;
};

/**
 * Sends an order confirmation email to the buyer.
 * @param {string} to      - Recipient email address
 * @param {string} name    - Buyer's display name
 * @param {Object} order   - The order document
 * @param {string} orderUrl - Direct link to the order page
 */
const sendOrderConfirmationEmail = async (to, name, order, orderUrl) => {
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: `"TrustTrade BD" <${process.env.EMAIL_USER || 'noreply@trusttradebd.com'}>`,
    to,
    subject: `Order Confirmed! #${order._id.toString().slice(-8).toUpperCase()} - TrustTrade BD`,
    text: `Hi ${name},\n\nThank you for your order! Your order #${order._id.toString().slice(-8).toUpperCase()} for ৳${order.totalAmount} has been confirmed.\n\nYou can view your order details here: ${orderUrl}`,
    html: buildOrderConfirmationHtml(name, order, orderUrl),
  });

  if (!process.env.EMAIL_USER) {
    console.log(`\n📧  [Order Confirmation Preview] Open in browser: ${nodemailer.getTestMessageUrl(info)}\n`);
  }

  return info;
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };
