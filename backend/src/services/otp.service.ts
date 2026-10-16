// backend/src/services/otp.service.ts
import crypto from 'crypto';
import { sendOtpEmail } from './email.service';
import { BadRequestError } from '../utils/errors';

interface StoredOtp {
  otp: string;
  purpose: 'SIGNUP' | 'LOGIN';
  expiresAt: number;
  attempts: number;
  metadata?: any;
}

// In-memory OTP storage keyed by email
const otpStore = new Map<string, StoredOtp>();

// Clean up expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

const getSigningSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[OTP Service] JWT_SECRET environment variable is required for OTP signing.');
  }
  return secret;
};

export const otpService = {
  /**
   * Generate a secure 6-digit OTP and send it via Resend email
   */
  async generateAndSendOtp(params: {
    email: string;
    purpose: 'SIGNUP' | 'LOGIN';
    firstName?: string;
    metadata?: any;
  }) {
    const { email, purpose, firstName, metadata } = params;
    const normalizedEmail = email.trim().toLowerCase();

    // Generate 6-digit code
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 1. In-memory store (for single-process / local environments)
    otpStore.set(normalizedEmail, {
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      metadata,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP Service] Generated ${purpose} OTP for ${normalizedEmail}: ${otp}`);
    } else {
      console.log(`[OTP Service] Generated ${purpose} OTP for ${normalizedEmail}`);
    }

    // 2. Generate a stateless cryptographic verification ticket (serverless / multi-instance resilient)
    const secret = getSigningSecret();
    const hmacPayload = `${normalizedEmail}:${otp}:${purpose}:${expiresAt}`;
    const hmac = crypto.createHmac('sha256', secret).update(hmacPayload).digest('hex');
    const verificationTicket = Buffer.from(
      JSON.stringify({ email: normalizedEmail, purpose, expiresAt, hmac, metadata })
    ).toString('base64');

    // 3. Dispatch email via Resend
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose,
      firstName: firstName || 'there',
    });

    // 4. Handle email dispatch results
    if (!emailResult.success) {
      console.error(`[OTP Service] Resend email delivery failed for ${normalizedEmail}:`, emailResult.error);
      throw new BadRequestError(
        emailResult.error || 'Failed to dispatch verification email. Please check your email address or try again in a few moments.'
      );
    }

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      expiresInMinutes: 10,
      verificationTicket,
      simulated: (emailResult as any)?.simulated || false,
    };
  },

  /**
   * Verify an OTP code provided by the user (supports both verificationTicket & in-memory store)
   */
  verifyOtp(
    emailOrParams: string | { email: string; candidateOtp: string; purpose: 'SIGNUP' | 'LOGIN'; verificationTicket?: string },
    candidateOtpArg?: string,
    purposeArg?: 'SIGNUP' | 'LOGIN',
    verificationTicketArg?: string
  ): any {
    let email: string;
    let candidateOtp: string;
    let purpose: 'SIGNUP' | 'LOGIN';
    let verificationTicket: string | undefined;

    if (typeof emailOrParams === 'object') {
      email = emailOrParams.email;
      candidateOtp = emailOrParams.candidateOtp;
      purpose = emailOrParams.purpose;
      verificationTicket = emailOrParams.verificationTicket;
    } else {
      email = emailOrParams;
      candidateOtp = candidateOtpArg || '';
      purpose = purposeArg || 'LOGIN';
      verificationTicket = verificationTicketArg;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = candidateOtp.trim();

    // ── Method A: Stateless Cryptographic Ticket Verification (Serverless Resilient) ──
    if (verificationTicket) {
      try {
        const ticket = JSON.parse(Buffer.from(verificationTicket, 'base64').toString('utf8'));
        if (ticket.email === normalizedEmail && ticket.purpose === purpose) {
          if (Date.now() > ticket.expiresAt) {
            throw new BadRequestError('Verification code has expired. Please request a new code.');
          }

          const secret = getSigningSecret();
          const expectedPayload = `${ticket.email}:${cleanOtp}:${ticket.purpose}:${ticket.expiresAt}`;
          const expectedHmac = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');

          if (crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(ticket.hmac))) {
            otpStore.delete(normalizedEmail);
            return ticket.metadata;
          }
        }
      } catch (err: any) {
        if (err instanceof BadRequestError) throw err;
        // Continue to check in-memory store if ticket parsing failed
      }
    }

    // ── Method B: In-Memory Verification (Local / Stateful Process) ──
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      throw new BadRequestError('Verification code has expired or was not requested. Please request a new code.');
    }

    if (record.purpose !== purpose) {
      throw new BadRequestError('Invalid verification purpose.');
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      throw new BadRequestError('Verification code has expired. Please request a new code.');
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      otpStore.delete(normalizedEmail);
      throw new BadRequestError('Too many failed attempts. Please request a new code.');
    }

    if (record.otp !== cleanOtp) {
      throw new BadRequestError('Incorrect verification code. Please check your email and try again.');
    }

    // OTP verified successfully — clear and return metadata
    const metadata = record.metadata;
    otpStore.delete(normalizedEmail);
    return metadata;
  },
};
