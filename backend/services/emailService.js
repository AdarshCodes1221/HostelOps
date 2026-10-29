/**
 * Email Service Module
 *
 * Supports multiple providers:
 * - 'brevo_api' / 'brevo' (HTTPS REST API via https://api.brevo.com/v3/smtp/email) - Essential for Render Free
 * - 'smtp': Standard SMTP server (Gmail, SES, SendGrid, custom server)
 * - 'resend': Resend transactional SMTP
 * - 'ethereal': Zero-config disposable test inbox for local development
 *
 * Configurable Environment Variables:
 * - BREVO_API_KEY: Regular Brevo v3 API key (starts with xkeysib-)
 * - EMAIL_PROVIDER ('brevo_api' | 'brevo' | 'smtp' | 'resend' | 'ethereal')
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD / SMTP_PASS, SMTP_SECURE
 * - MAIL_FROM (e.g. "Hostel Management <noreply@yourdomain.com>" or "noreply@yourdomain.com")
 * - MAIL_FROM_NAME
 * - APP_BASE_URL / FRONTEND_URL
 */

const nodemailer = require('nodemailer');

let cachedTransporter = null;

/**
 * Parses MAIL_FROM and MAIL_FROM_NAME into structured { name, email }
 */
const resolveSenderParts = () => {
  const rawFrom = (process.env.MAIL_FROM || process.env.SMTP_FROM || '').trim();
  let name = (process.env.MAIL_FROM_NAME || '').trim();
  let email = 'noreply@example.com';

  if (rawFrom) {
    const match = rawFrom.match(/^(?:"?([^"]*)"?\s)?<?([^>@]+@[^>]+)>?$/);
    if (match) {
      if (match[1] && !name) {
        name = match[1].trim();
      }
      if (match[2]) {
        email = match[2].trim();
      }
    } else if (rawFrom.includes('@')) {
      email = rawFrom.replace(/[<>"]/g, '').trim();
    }
  }

  if (!name) {
    name = 'Hostel Management System';
  }

  return { name, email };
};

/**
 * Resolves legacy formatted sender string "Name" <email>
 */
const resolveSender = () => {
  const { name, email } = resolveSenderParts();
  return `"${name}" <${email}>`;
};

/**
 * Sends transactional email via Brevo HTTPS REST API (Port 443)
 * Bypasses Render Free outbound SMTP port blocking (ports 25, 465, 587)
 */
const sendBrevoHttpsEmail = async ({ to, toName, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not defined in environment variables.');
  }

  const sender = resolveSenderParts();
  const payload = {
    sender,
    to: [
      {
        email: to,
        name: toName || to.split('@')[0],
      },
    ],
    subject,
    htmlContent: html,
    textContent: text || html.replace(/<[^>]*>?/gm, ''),
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = responseData.message || response.statusText || 'Unknown Brevo API error';
    const errorCode = responseData.code || response.status;
    throw new Error(`Brevo HTTPS API Error (${errorCode}): ${errorMsg}`);
  }

  console.log(`📧 [Brevo HTTPS API] Successfully delivered email to <${to}> (messageId: ${responseData.messageId || 'N/A'})`);
  return {
    provider: 'brevo_api',
    messageId: responseData.messageId,
    info: responseData,
  };
};

/**
 * Builds or retrieves the configured SMTP transporter
 */
const getTransporter = async () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const provider = (process.env.EMAIL_PROVIDER || 'ethereal').toLowerCase();
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

  // 1. Explicit Resend Provider
  if (provider === 'resend' && (smtpPass || process.env.RESEND_API_KEY)) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: smtpPass || process.env.RESEND_API_KEY,
      },
    });
    console.log('📧 Configured Resend transactional email transport');
    return cachedTransporter;
  }

  // 2. Custom / Standard SMTP
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost && smtpUser && smtpPass) {
    const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    console.log(`📧 Configured custom SMTP transport (${smtpHost}:${smtpPort})`);
    return cachedTransporter;
  }

  // 3. Development Fallback: Ethereal test account
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Configured Ethereal dev SMTP test account:', testAccount.user);
  } catch (err) {
    console.warn('⚠️ Could not initialize Ethereal test account, using jsonTransport fallback:', err.message);
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return cachedTransporter;
};

/**
 * Sends a generic email with dynamic provider selection
 */
const sendEmail = async ({ to, toName, subject, html, text }) => {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  const hasBrevoApiKey = !!process.env.BREVO_API_KEY;

  let finalTo = to;
  let finalSubject = subject;

  // Safe testing email guard: redirect test domains to safe inbox in non-production
  const safeRecipient = process.env.SAFE_TEST_EMAIL || process.env.MAIL_FROM;
  const isPlaceholderDomain = /@(symbiosis\.ac\.in|siu\.edu\.in|siu\.pune\.edu\.in|example\.com|test\.com)$/i.test(to);

  if (process.env.NODE_ENV !== 'production' && isPlaceholderDomain && safeRecipient) {
    console.log(`🛡️ [SAFE TEST ROUTING] Redirecting test email from <${to}> to test inbox <${safeRecipient}>`);
    finalTo = safeRecipient;
    finalSubject = `[TEST for ${to}] ${subject}`;
  }

  // Provider Selection Logic:
  // Priority 1: Brevo HTTPS API when explicitly selected or BREVO_API_KEY is present
  const useBrevoApi =
    provider === 'brevo_api' ||
    (provider === 'brevo' && hasBrevoApiKey) ||
    (hasBrevoApiKey && provider !== 'smtp' && provider !== 'resend');

  if (useBrevoApi) {
    return sendBrevoHttpsEmail({
      to: finalTo,
      toName,
      subject: finalSubject,
      html,
      text,
    });
  }

  // Priority 2: Standard SMTP transport (Nodemailer)
  const transporter = await getTransporter();
  const from = resolveSender();

  const mailOptions = {
    from,
    to: finalTo,
    subject: finalSubject,
    text: text || html.replace(/<[^>]*>?/gm, ''),
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`📬 Dev Email Preview URL: ${previewUrl}`);
  }

  return { info, previewUrl, provider: provider || 'smtp' };
};

/**
 * Sends student email verification link and 6-digit OTP
 */
const sendVerificationEmail = async ({ to, firstName, verificationToken, verificationUrl, otp }) => {
  const frontendUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8080';
  const verifyLink = verificationUrl || `${frontendUrl}/verify-email?token=${verificationToken || ''}${otp ? `&otp=${otp}` : ''}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email - Hostel Management System</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 28px 24px; text-align: center; color: #ffffff; }
        .content { padding: 32px 28px; }
        .otp-box { background: #f8fafc; border: 2px dashed #2563eb; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
        .otp-code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1d4ed8; margin: 0; }
        .button { display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; font-size: 14px; }
        .token-box { background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 16px 0; color: #475569; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 22px;">Hostel Management System</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Student Account Email Verification</p>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName || 'Student'}</strong>,</p>
          <p>Thank you for registering on the Hostel Management System portal. To verify your email address, please enter the One-Time Password (OTP) below:</p>
          
          ${otp ? `
          <div class="otp-box">
            <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Your Verification OTP</p>
            <h2 class="otp-code">${otp}</h2>
            <p style="margin: 6px 0 0; font-size: 12px; color: #64748b;">Valid for <strong>10 minutes</strong>. Do not share this code.</p>
          </div>
          ` : ''}

          <p>Alternatively, click the button below to verify automatically:</p>
          <div style="text-align: center;">
            <a href="${verifyLink}" class="button">Verify My Email Address</a>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
            Once verified, your account registration will be reviewed by the hostel administration office for room allocation.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Hostel Management System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    toName: firstName,
    subject: otp ? `Your Verification OTP is ${otp} — Hostel Management System` : 'Verify Your Email — Hostel Management System',
    html,
  });
};

/**
 * Sends password reset email
 */
const sendPasswordResetEmail = async ({ to, firstName, resetToken, resetUrl, isAdmin }) => {
  const frontendUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:8080';
  const defaultPath = isAdmin ? '/admin/reset-password' : '/reset-password';
  const resetLink = resetUrl || `${frontendUrl}${defaultPath}/${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset - Hostel Management System</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 580px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #2563eb, #f97316); padding: 28px 24px; text-align: center; color: #ffffff; }
        .content { padding: 32px 28px; }
        .button { display: inline-block; padding: 14px 32px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; font-size: 15px; }
        .token-box { background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 16px 0; color: #475569; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 22px;">Hostel Management System</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Password Reset Request</p>
        </div>
        <div class="content">
          <p>Hello <strong>${firstName || 'User'}</strong>,</p>
          <p>We received a request to reset the password for your account associated with <strong>${to}</strong>.</p>
          <p>Click the button below to reset your password. This link is valid for <strong>15 minutes</strong>:</p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset My Password</a>
          </div>
          <p>Or paste this link into your browser:</p>
          <div class="token-box">${resetLink}</div>
          <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
            If you did not request this password reset, please ignore this email. Your account remains completely secure.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Hostel Management System. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    toName: firstName,
    subject: 'Password Reset Request — Hostel Management System',
    html,
  });
};

module.exports = {
  getTransporter,
  sendEmail,
  sendBrevoHttpsEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  resolveSenderParts,
  resolveSender,
};
