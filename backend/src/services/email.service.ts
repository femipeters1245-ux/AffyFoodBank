// backend/src/services/email.service.ts
import { Resend } from 'resend';

// Initialize Resend client lazily or when key is present
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_your_')) {
    return null;
  }
  return new Resend(apiKey);
};

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'Affy FoodBank <onboarding@resend.dev>';

export const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_EMAIL || 'affybrand@gmail.com';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Base email sender function wrapping Resend API
 */
export async function sendEmail(options: SendEmailOptions) {
  const resend = getResendClient();
  const primaryFrom = options.from || DEFAULT_FROM_EMAIL;

  if (!resend) {
    console.warn(
      `[EmailService] RESEND_API_KEY not configured. Email to "${options.to}" with subject "${options.subject}" was simulated.`
    );
    return {
      success: true,
      simulated: true,
      message: 'Email logged (Resend API key not set)',
    };
  }

  const to = Array.isArray(options.to) ? options.to : [options.to];

  try {
    // 1. Primary send attempt
    let result = await resend.emails.send({
      from: primaryFrom,
      to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || ADMIN_NOTIFICATION_EMAIL,
    });

    // Check if Resend returned an API-level error
    if (result.error) {
      console.warn(`[EmailService] Primary send with "${primaryFrom}" failed:`, result.error.message);

      // If domain is unverified or has DNS issues (e.g. @affyfoodbank.com), retry with Resend verified sender
      const isDomainIssue =
        result.error.message?.toLowerCase().includes('domain') ||
        result.error.message?.toLowerCase().includes('verify') ||
        result.error.message?.toLowerCase().includes('from');

      if (isDomainIssue && !primaryFrom.includes('onboarding@resend.dev')) {
        console.log(`[EmailService] Retrying with verified sender "Affy FoodBank <onboarding@resend.dev>"...`);
        const fallbackResult = await resend.emails.send({
          from: 'Affy FoodBank <onboarding@resend.dev>',
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo || ADMIN_NOTIFICATION_EMAIL,
        });

        if (!fallbackResult.error) {
          console.log(`[EmailService] Fallback email sent successfully to ${options.to}:`, fallbackResult.data?.id);
          return { success: true, id: fallbackResult.data?.id, data: fallbackResult.data };
        }
        result = fallbackResult;
      }

      // Check if Resend blocked the send due to sandbox restriction (only own account email allowed)
      const isSandboxRestriction =
        result.error.message?.toLowerCase().includes('testing emails to your own email address') ||
        result.error.message?.toLowerCase().includes('resend.com/domains');

      if (isSandboxRestriction && !to.includes(ADMIN_NOTIFICATION_EMAIL)) {
        console.log(`[EmailService] Relaying to admin (${ADMIN_NOTIFICATION_EMAIL}) due to Resend sandbox restriction for ${to.join(', ')}...`);
        const relayResult = await resend.emails.send({
          from: 'Affy FoodBank <onboarding@resend.dev>',
          to: [ADMIN_NOTIFICATION_EMAIL],
          subject: `[Affy FoodBank Relay for ${to.join(', ')}] ${options.subject}`,
          html: `<div style="background:#fef3c7;padding:12px;border:1px solid #f59e0b;border-radius:8px;margin-bottom:16px;font-family:sans-serif;font-size:12px;color:#92400e;">
            <strong>⚠️ Resend Sandbox Relay:</strong> Originally destined for <strong>${to.join(', ')}</strong>. To send directly to all recipient mailboxes, verify your domain on <a href="https://resend.com/domains" target="_blank">resend.com/domains</a>.
          </div>` + options.html,
          text: `[Originally destined for ${to.join(', ')}]\n\n` + (options.text || ''),
          replyTo: options.replyTo || ADMIN_NOTIFICATION_EMAIL,
        });

        if (!relayResult.error) {
          console.log(`[EmailService] Sandbox relay delivered successfully to ${ADMIN_NOTIFICATION_EMAIL}:`, relayResult.data?.id);
          return {
            success: true,
            id: relayResult.data?.id,
            sandboxForwarded: true,
            forwardedTo: ADMIN_NOTIFICATION_EMAIL,
            originalRecipient: options.to,
          };
        }
      }

      console.error(`[EmailService] Resend rejected email to ${options.to}:`, result.error);
      return { success: false, error: result.error.message, details: result.error };
    }

    console.log(`[EmailService] Email sent successfully to ${options.to}:`, result.data?.id);
    return { success: true, id: result.data?.id, data: result.data };
  } catch (error: any) {
    console.error(`[EmailService] Exception sending email to ${options.to}:`, error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML Email Templates
// ─────────────────────────────────────────────────────────────────────────────

const emailWrapper = (title: string, bodyContent: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #15803d 0%, #166534 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px 24px; }
    .btn { display: inline-block; background-color: #16a34a; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-success { background-color: #dcfce7; color: #15803d; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .table th { text-align: left; padding: 8px 4px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
    .table td { padding: 10px 4px; border-bottom: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🌾 Affy FoodBank</h1>
      <p>Nigeria's #1 Foodstuff Marketplace & Food Savings Platform</p>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px;">Affy FoodBank • Direct from Nigerian Farmers Collective</p>
      <p style="margin: 0;">Support: <a href="mailto:affybrand@gmail.com" style="color: #16a34a;">affybrand@gmail.com</a> | Visit: <a href="https://affy-food-bank-czt6.vercel.app" style="color: #16a34a;">affyfoodbank.ng</a></p>
    </div>
  </div>
</body>
</html>
`;

/**
 * 1. Order Confirmation & Payment Receipt
 */
export async function sendOrderReceiptEmail(params: {
  to: string;
  customerName?: string;
  orderReference: string;
  amountNaira: number;
  channel?: string;
  deliveryAddress?: string;
  phone?: string;
  items?: Array<{ name: string; quantity: number; priceNaira?: number }>;
}) {
  const {
    to,
    customerName = 'Valued Customer',
    orderReference,
    amountNaira,
    channel = 'TransactPay Gateway',
    deliveryAddress,
    phone,
    items = [],
  } = params;

  const itemsHtml =
    items.length > 0
      ? `
      <table class="table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${
                item.priceNaira ? `₦${item.priceNaira.toLocaleString()}` : '-'
              }</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
      : '';

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge badge-success">✓ Payment Confirmed</span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">Thank You for Your Order!</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi ${customerName}, your foodstuff order has been received and is being prepared for dispatch.</p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Order Reference:</span>
        <strong style="font-family: monospace; font-size: 13px;">${orderReference}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Payment Method:</span>
        <strong style="font-size: 13px;">${channel}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
        <span style="color: #0f172a; font-weight: 700; font-size: 15px;">Total Paid:</span>
        <span style="color: #15803d; font-weight: 800; font-size: 18px;">₦${amountNaira.toLocaleString()}</span>
      </div>
    </div>

    ${itemsHtml}

    ${
      deliveryAddress
        ? `
    <div style="margin: 20px 0; padding: 14px; background: #f1f5f9; border-radius: 8px; font-size: 13px;">
      <strong style="color: #334155; display: block; margin-bottom: 4px;">🚚 Delivery Destination:</strong>
      <p style="margin: 0; color: #475569;">${deliveryAddress}${phone ? ` (Phone: ${phone})` : ''}</p>
    </div>`
        : ''
    }

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://affy-food-bank-czt6.vercel.app" class="btn">View Order on Affy FoodBank</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `🌾 Order Confirmed (#${orderReference.slice(-8)}) - Affy FoodBank`,
    html: emailWrapper('Order Receipt - Affy FoodBank', bodyContent),
    text: `Hi ${customerName}, your payment of ₦${amountNaira.toLocaleString()} for order ${orderReference} has been confirmed. Thank you for shopping with Affy FoodBank!`,
  });
}

/**
 * 2. Welcome Email for New Signups
 */
export async function sendWelcomeEmail(params: {
  to: string;
  firstName?: string;
}) {
  const { to, firstName = 'there' } = params;

  const bodyContent = `
    <h2 style="font-size: 20px; color: #0f172a; margin-top: 0;">Welcome to Affy FoodBank, ${firstName}! 🎉</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      We are thrilled to welcome you to Nigeria's premier foodstuff marketplace and food-banking community.
    </p>

    <div style="margin: 24px 0;">
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 20px;">🚜</div>
        <div>
          <strong style="color: #0f172a; font-size: 14px;">Farm-Gate Wholesale Prices</strong>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Buy rice, beans, palm oil, garri, yam, and tubers directly from rural farm cooperatives with zero middleman markup.</p>
        </div>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="font-size: 20px;">💰</div>
        <div>
          <strong style="color: #0f172a; font-size: 14px;">Disciplined Food Savings</strong>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Lock in today's food prices ahead of food inflation and save towards Christmas, Ramadan, or household bulk supplies.</p>
        </div>
      </div>
      <div style="display: flex; gap: 12px;">
        <div style="font-size: 20px;">⚡</div>
        <div>
          <strong style="color: #0f172a; font-size: 14px;">Instant CBN-Regulated Payments</strong>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Seamless checkout via TransactPay, bank transfer, debit cards, OPay, and PalmPay.</p>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 28px;">
      <a href="https://affy-food-bank-czt6.vercel.app" class="btn">Start Shopping Foodstuff</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Welcome to Affy FoodBank, ${firstName}! 🌾`,
    html: emailWrapper('Welcome to Affy FoodBank', bodyContent),
    text: `Welcome to Affy FoodBank, ${firstName}! Buy raw foodstuff at farm-gate wholesale prices and save towards bulk household food supplies.`,
  });
}

/**
 * 3. Food Savings Deposit Confirmation
 */
export async function sendFoodSavingsDepositEmail(params: {
  to: string;
  customerName?: string;
  planName: string;
  amountNaira: number;
  currentSavingsTotalNaira: number;
  targetNaira: number;
}) {
  const {
    to,
    customerName = 'Valued Member',
    planName,
    amountNaira,
    currentSavingsTotalNaira,
    targetNaira,
  } = params;

  const percentage = Math.min(
    100,
    Math.round((currentSavingsTotalNaira / (targetNaira || 1)) * 100)
  );

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge badge-success">✓ Savings Deposit Recorded</span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">Food Savings Updated!</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi ${customerName}, your deposit towards <strong>${planName}</strong> was received.</p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Amount Deposited:</span>
        <strong style="color: #15803d; font-size: 15px;">+₦${amountNaira.toLocaleString()}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Current Saved Balance:</span>
        <strong style="font-size: 15px;">₦${currentSavingsTotalNaira.toLocaleString()}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #64748b; font-size: 13px;">Target Goal:</span>
        <strong style="font-size: 13px;">₦${targetNaira.toLocaleString()}</strong>
      </div>

      <!-- Progress bar -->
      <div style="background-color: #e2e8f0; border-radius: 9999px; height: 10px; overflow: hidden; margin-top: 8px;">
        <div style="background-color: #16a34a; width: ${percentage}%; height: 100%; border-radius: 9999px;"></div>
      </div>
      <div style="text-align: right; margin-top: 4px; font-size: 11px; color: #64748b;">${percentage}% completed</div>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://affy-food-bank-czt6.vercel.app" class="btn">View My Food Savings</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `🌾 ₦${amountNaira.toLocaleString()} Saved towards ${planName} - Affy FoodBank`,
    html: emailWrapper('Food Savings Deposit Confirmation', bodyContent),
    text: `Hi ${customerName}, your deposit of ₦${amountNaira.toLocaleString()} towards ${planName} has been received. Your total saved is ₦${currentSavingsTotalNaira.toLocaleString()}.`,
  });
}

/**
 * 4. Admin Order Alert
 */
export async function sendAdminOrderAlert(params: {
  orderReference: string;
  amountNaira: number;
  customerEmail: string;
  customerName?: string;
  phone?: string;
  address?: string;
}) {
  const {
    orderReference,
    amountNaira,
    customerEmail,
    customerName = 'Customer',
    phone = 'N/A',
    address = 'N/A',
  } = params;

  const bodyContent = `
    <h2 style="color: #0f172a; margin-top: 0;">📦 New Paid Order Received!</h2>
    <p style="color: #475569; font-size: 14px;">A new order was just placed on Affy FoodBank.</p>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px;"><strong>Order Ref:</strong> <code>${orderReference}</code></p>
      <p style="margin: 0 0 8px;"><strong>Amount:</strong> <span style="color: #15803d; font-weight: 700;">₦${amountNaira.toLocaleString()}</span></p>
      <p style="margin: 0 0 8px;"><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
      <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${phone}</p>
      <p style="margin: 0;"><strong>Delivery Address:</strong> ${address}</p>
    </div>
  `;

  return sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `🚨 [NEW ORDER] ₦${amountNaira.toLocaleString()} - ${orderReference}`,
    html: emailWrapper('Admin Order Alert', bodyContent),
    text: `New order ${orderReference} for ₦${amountNaira.toLocaleString()} received from ${customerEmail}.`,
  });
}

/**
 * 5. One-Time Password (OTP) for Sign in & Login
 */
export async function sendOtpEmail(params: {
  to: string;
  otp: string;
  purpose: 'SIGNUP' | 'LOGIN';
  firstName?: string;
}) {
  const { to, otp, purpose, firstName = 'there' } = params;
  const isSignup = purpose === 'SIGNUP';
  const actionText = isSignup ? 'complete your registration' : 'sign in to your account';

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge" style="background-color: #e0e7ff; color: #4338ca;">🔒 Security Verification</span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">
        ${isSignup ? 'Verify Your Email Address' : 'Sign In Verification Code'}
      </h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">
        Hi ${firstName}, use the one-time code below to ${actionText}.
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed #16a34a; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
      <span style="display: block; font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 6-Digit One-Time Code</span>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #15803d; line-height: 1;">
        ${otp}
      </div>
      <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
        ⏱️ This code expires in <strong>10 minutes</strong>. Never share this code with anyone.
      </p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 14px; font-size: 12px; color: #64748b; border: 1px solid #e2e8f0;">
      <strong style="color: #334155;">🛡️ Security Notice:</strong> Affy FoodBank staff will never ask you for your password or OTP. If you did not initiate this request, please ignore this email or contact support.
    </div>
  `;

  return sendEmail({
    to,
    subject: `Affy FoodBank Verification Code: ${otp}`,
    html: emailWrapper('One-Time Password Verification', bodyContent),
    text: `Hi ${firstName}, your Affy FoodBank verification code is ${otp}. It expires in 10 minutes. If you did not request this, please ignore this email.`,
    replyTo: ADMIN_NOTIFICATION_EMAIL,
  });
}

/**
 * 6. Automated Wallet Deposit Notification
 */
export async function sendWalletDepositEmail(params: {
  to: string;
  customerName?: string;
  amountNaira: number;
  newBalanceNaira?: number;
  reference: string;
  channel?: string;
}) {
  const {
    to,
    customerName = 'Valued Member',
    amountNaira,
    newBalanceNaira,
    reference,
    channel = 'TransactPay PSSP',
  } = params;

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge badge-success">✓ Deposit Confirmed</span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">Wallet Credited!</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi ${customerName}, your wallet deposit was processed successfully.</p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Amount Credited:</span>
        <strong style="color: #15803d; font-size: 18px;">+₦${amountNaira.toLocaleString()}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Reference Code:</span>
        <strong style="font-family: monospace; font-size: 13px;">${reference}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Payment Channel:</span>
        <strong style="font-size: 13px;">${channel}</strong>
      </div>
      ${
        newBalanceNaira !== undefined
          ? `
      <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
        <span style="color: #0f172a; font-weight: 700; font-size: 14px;">Updated Wallet Balance:</span>
        <span style="color: #0f172a; font-weight: 800; font-size: 16px;">₦${newBalanceNaira.toLocaleString()}</span>
      </div>`
          : ''
      }
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://affy-food-bank-czt6.vercel.app/wallet" class="btn">View Food Wallet</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `💰 +₦${amountNaira.toLocaleString()} Credited to Your Affy Wallet`,
    html: emailWrapper('Wallet Deposit Receipt', bodyContent),
    text: `Hi ${customerName}, your deposit of ₦${amountNaira.toLocaleString()} (Ref: ${reference}) has been credited to your Affy FoodBank wallet.`,
  });
}

/**
 * 7. Automated Wallet Withdrawal Notification
 */
export async function sendWalletWithdrawalEmail(params: {
  to: string;
  customerName?: string;
  amountNaira: number;
  remainingBalanceNaira?: number;
  reference: string;
  bankName: string;
  accountNumber: string;
  status?: 'SUCCESSFUL' | 'PENDING';
}) {
  const {
    to,
    customerName = 'Valued Member',
    amountNaira,
    remainingBalanceNaira,
    reference,
    bankName,
    accountNumber,
    status = 'SUCCESSFUL',
  } = params;

  const maskedAccount = accountNumber.length >= 4 ? `******${accountNumber.slice(-4)}` : accountNumber;

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge" style="background-color: #fef3c7; color: #b45309;">📤 Bank Disbursement</span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">
        ${status === 'SUCCESSFUL' ? 'Withdrawal Completed' : 'Withdrawal Processing'}
      </h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi ${customerName}, your withdrawal payout has been dispatched via TransactPay.</p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Disbursed Amount:</span>
        <strong style="color: #b45309; font-size: 18px;">-₦${amountNaira.toLocaleString()}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Destination Bank:</span>
        <strong style="font-size: 13px;">${bankName} (${maskedAccount})</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Payout Reference:</span>
        <strong style="font-family: monospace; font-size: 13px;">${reference}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Fee:</span>
        <strong style="color: #15803d; font-size: 13px;">₦0.00 (Zero Fee)</strong>
      </div>
      ${
        remainingBalanceNaira !== undefined
          ? `
      <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
        <span style="color: #0f172a; font-weight: 700; font-size: 14px;">Remaining Available Balance:</span>
        <span style="color: #0f172a; font-weight: 800; font-size: 16px;">₦${remainingBalanceNaira.toLocaleString()}</span>
      </div>`
          : ''
      }
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
      💡 Payouts to Nigerian commercial banks and fintech accounts (OPay, PalmPay, Kuda) typically reflect within 1-5 minutes.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://affy-food-bank-czt6.vercel.app/wallet" class="btn">View Wallet Ledger</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `📤 ₦${amountNaira.toLocaleString()} Withdrawn to ${bankName} - Affy FoodBank`,
    html: emailWrapper('Wallet Withdrawal Notification', bodyContent),
    text: `Hi ${customerName}, your withdrawal of ₦${amountNaira.toLocaleString()} to ${bankName} (${maskedAccount}) has been dispatched. Ref: ${reference}`,
  });
}

/**
 * 8. Order Delivery Stage Update Notification
 */
export async function sendDeliveryStageUpdateEmail(params: {
  to: string;
  customerName?: string;
  orderReference: string;
  stage: string;
  assignedRider?: string;
  riderPhone?: string;
  deliveryAddress?: string;
  notes?: string;
}) {
  const {
    to,
    customerName = 'Valued Customer',
    orderReference,
    stage,
    assignedRider,
    riderPhone,
    deliveryAddress,
    notes,
  } = params;

  const stageDescriptions: Record<string, { label: string; badgeColor: string; description: string }> = {
    PENDING: {
      label: 'Order Placed & Queued',
      badgeColor: '#fef3c7; color: #b45309',
      description: 'Your foodstuff order has been placed and is waiting for warehouse sorting.',
    },
    PROCESSING: {
      label: 'Sorting & Packaging at Farm Hub',
      badgeColor: '#e0e7ff; color: #4338ca',
      description: 'Our warehouse team is weighing, bagging, and quality-checking your raw foodstuffs.',
    },
    READY_FOR_DISPATCH: {
      label: 'Ready for Dispatch',
      badgeColor: '#dbeafe; color: #1d4ed8',
      description: 'Your food items are packed and assigned to a delivery dispatch route.',
    },
    DISPATCHED: {
      label: 'Out for Delivery 🚚',
      badgeColor: '#dcfce7; color: #15803d',
      description: 'Your order is currently with our dispatch driver on the way to your doorstep.',
    },
    DELIVERED: {
      label: 'Successfully Delivered ✅',
      badgeColor: '#dcfce7; color: #166534',
      description: 'Your foodstuff delivery has been successfully received and signed for. Enjoy your farm-fresh food!',
    },
    CANCELLED: {
      label: 'Order Cancelled',
      badgeColor: '#ffe4e6; color: #be123c',
      description: 'This delivery has been cancelled. If payment was made, your refund is credited to your wallet.',
    },
  };

  const currentStageInfo = stageDescriptions[stage.toUpperCase()] || {
    label: stage,
    badgeColor: '#f1f5f9; color: #334155',
    description: 'There is a new update regarding your foodstuff order delivery.',
  };

  const bodyContent = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span class="badge" style="background-color: ${currentStageInfo.badgeColor};">
        ${currentStageInfo.label}
      </span>
      <h2 style="margin: 12px 0 6px; font-size: 22px; color: #0f172a;">Delivery Progress Update</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Hi ${customerName}, here is the latest status of your foodstuff order.</p>
    </div>

    <div style="background-color: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Order Reference:</span>
        <strong style="font-family: monospace; font-size: 13px;">${orderReference}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Current Stage:</span>
        <strong style="font-size: 13px;">${currentStageInfo.label}</strong>
      </div>
      ${
        assignedRider
          ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Assigned Dispatch Rider:</span>
        <strong style="font-size: 13px;">${assignedRider}</strong>
      </div>`
          : ''
      }
      ${
        riderPhone
          ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="color: #64748b; font-size: 13px;">Rider Phone:</span>
        <strong style="color: #15803d; font-size: 13px;">${riderPhone}</strong>
      </div>`
          : ''
      }
      ${
        deliveryAddress
          ? `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 13px;">
        <span style="color: #64748b;">Delivery Destination:</span>
        <div style="font-weight: 600; color: #334155; margin-top: 2px;">${deliveryAddress}</div>
      </div>`
          : ''
      }
      ${
        notes
          ? `
      <div style="margin-top: 10px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569;">
        <strong>Logistics Note:</strong> ${notes}
      </div>`
          : ''
      }
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="https://affy-food-bank-czt6.vercel.app" class="btn">Track Order on Affy FoodBank</a>
    </div>
  `;

  return sendEmail({
    to,
    subject: `🚚 [Delivery Update] Order #${orderReference.slice(-8)} is ${currentStageInfo.label}`,
    html: emailWrapper('Delivery Stage Update', bodyContent),
    text: `Hi ${customerName}, your order #${orderReference} status has been updated to: ${currentStageInfo.label}. ${currentStageInfo.description}`,
  });
}

