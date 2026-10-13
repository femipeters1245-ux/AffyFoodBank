// backend/src/routes/email.ts
import { Router, Request, Response } from 'express';
import {
  sendEmail,
  sendOrderReceiptEmail,
  sendWelcomeEmail,
  DEFAULT_FROM_EMAIL,
} from '../services/email.service';
import { BadRequestError } from '../utils/errors';

const router = Router();

/**
 * GET /api/v1/email/status
 * Returns Resend configuration status
 */
router.get('/status', (_req: Request, res: Response) => {
  const hasApiKey = Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_your_'));
  res.json({
    status: 'success',
    configured: hasApiKey,
    sender: DEFAULT_FROM_EMAIL,
    provider: 'Resend (https://resend.com)',
  });
});

/**
 * POST /api/v1/email/send-test
 * Sends a test email to verify Resend integration
 */
router.post('/send-test', async (req: Request, res: Response) => {
  const { to, subject, message } = req.body;

  if (!to) {
    throw new BadRequestError('Recipient email address ("to") is required');
  }

  const result = await sendEmail({
    to,
    subject: subject || '🌾 Affy FoodBank - Resend Email Integration Test',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #15803d;">Resend Email Service Active! 🚀</h2>
        <p>This is a test email sent from <strong>Affy FoodBank</strong> via Resend.</p>
        <p style="background: #f1f5f9; padding: 12px; border-radius: 8px;">${message || 'Your email notifications are ready for order receipts, signups, and food savings.'}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <small style="color: #64748b;">Timestamp: ${new Date().toISOString()}</small>
      </div>
    `,
    text: message || 'This is a test email sent from Affy FoodBank via Resend.',
  });

  res.json({
    status: result.success ? 'success' : 'failed',
    message: result.success ? 'Test email dispatched' : 'Failed to send email',
    details: result,
  });
});

/**
 * POST /api/v1/email/send-welcome
 * Sends a welcome email
 */
router.post('/send-welcome', async (req: Request, res: Response) => {
  const { to, firstName } = req.body;
  if (!to) {
    throw new BadRequestError('Recipient email is required');
  }
  const result = await sendWelcomeEmail({ to, firstName });
  res.json({ status: 'success', result });
});

export default router;
