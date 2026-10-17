// backend/src/services/otp.service.ts
import crypto from 'crypto';
import { durableOtpStore, hashOtp, verifyOtpHash, getOtpSecret } from './durable-otp.store';
import { sendOtpEmail } from './email.service';
import { BadRequestError } from '../utils/errors';

export const OTP_EXPIRATION_MINUTES = 5;
export const OTP_EXPIRATION_MS = OTP_EXPIRATION_MINUTES * 60 * 1000;
export const RESEND_COOLDOWN_SECONDS = 60;
export const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_SECONDS * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export interface GenerateOtpParams {
  email: string;
  purpose: 'SIGNUP' | 'LOGIN';
  firstName?: string;
  metadata?: any;
}

export interface VerifyOtpParams {
  email: string;
  candidateOtp: string;
  purpose?: 'SIGNUP' | 'LOGIN' | string;
  verificationTicket?: string;
}

export const otpService = {
  /**
   * Generate a secure 6-digit OTP, store its hash in durable storage with a 5-minute
   * expiration and cooldown enforcement, and dispatch via Resend API directly.
   */
  async generateAndSendOtp(params: GenerateOtpParams) {
    const { email, purpose, firstName, metadata } = params;
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    // 1. Check for active OTP to enforce resend cooldown
    const existing = await durableOtpStore.getLatestActiveOtp(normalizedEmail);
    if (existing && existing.resendAfter.getTime() > now) {
      const waitSecs = Math.max(1, Math.ceil((existing.resendAfter.getTime() - now) / 1000));
      throw new BadRequestError(`Please wait ${waitSecs} second${waitSecs > 1 ? 's' : ''} before requesting another verification code.`);
    }

    // 2. Generate cryptographically secure six-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashOtp(normalizedEmail, otp);

    const expiresAt = new Date(now + OTP_EXPIRATION_MS);
    const resendAfter = new Date(now + RESEND_COOLDOWN_MS);

    // 3. Persist hashed OTP in durable storage (never store plaintext OTP)
    await durableOtpStore.saveOtp({
      email: normalizedEmail,
      hashedOtp,
      purpose,
      expiresAt,
      resendAfter,
      maxAttempts: MAX_VERIFICATION_ATTEMPTS,
      metadata,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP Service] Generated ${purpose} OTP for ${normalizedEmail}: ${otp}`);
    } else {
      console.log(`[OTP Service] Generated ${purpose} OTP for ${normalizedEmail} (Expires in 5 minutes)`);
    }

    // 4. Generate optional stateless cryptographic verification ticket as secondary resilience
    const secret = getOtpSecret();
    const hmacPayload = `${normalizedEmail}:${hashedOtp}:${purpose}:${expiresAt.getTime()}`;
    const hmac = crypto.createHmac('sha256', secret).update(hmacPayload).digest('hex');
    const verificationTicket = Buffer.from(
      JSON.stringify({
        email: normalizedEmail,
        purpose,
        expiresAt: expiresAt.getTime(),
        hmac,
        metadata,
      })
    ).toString('base64');

    // 5. Send OTP directly through Resend API
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose,
      firstName: firstName || 'there',
    });

    if (!emailResult.success) {
      console.error(`[OTP Service] Resend email delivery failed for ${normalizedEmail}:`, emailResult.error);
      throw new BadRequestError(
        emailResult.error || 'Failed to dispatch verification email via Resend. Please check your email address and try again.'
      );
    }

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}. It expires in 5 minutes.`,
      expiresInMinutes: OTP_EXPIRATION_MINUTES,
      expiresInSeconds: OTP_EXPIRATION_MINUTES * 60,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
      verificationTicket,
      simulated: (emailResult as any)?.simulated || false,
    };
  },

  /**
   * Verify candidate OTP against durable hashed storage with attempt limits and expiration
   */
  async verifyOtp(params: VerifyOtpParams): Promise<any> {
    const { email, candidateOtp, purpose, verificationTicket } = params;
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = candidateOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      throw new BadRequestError('Please provide a valid 6-digit numeric verification code.');
    }

    const now = Date.now();

    // 1. Check primary durable storage
    const record = await durableOtpStore.getLatestActiveOtp(
      normalizedEmail,
      purpose && purpose !== 'ANY' ? purpose : undefined
    );

    if (record) {
      // Check expiration
      if (now > record.expiresAt.getTime()) {
        await durableOtpStore.revokeOtp(record.id);
        throw new BadRequestError('Verification code has expired (5-minute limit exceeded). Please request a new code.');
      }

      // Check max attempts limit
      if (record.attempts >= record.maxAttempts) {
        await durableOtpStore.revokeOtp(record.id);
        throw new BadRequestError('Too many failed verification attempts. This code has been revoked. Please request a new code.');
      }

      // Verify hashed OTP
      const isMatch = verifyOtpHash(normalizedEmail, cleanOtp, record.hashedOtp);

      if (!isMatch) {
        const newAttempts = await durableOtpStore.incrementAttempts(record.id);
        const remaining = record.maxAttempts - newAttempts;

        if (remaining <= 0) {
          await durableOtpStore.revokeOtp(record.id);
          throw new BadRequestError('Too many failed verification attempts. This code has been revoked. Please request a new code.');
        }

        throw new BadRequestError(`Incorrect verification code. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
      }

      // Correct OTP! Mark consumed in durable storage
      await durableOtpStore.markConsumed(record.id);
      return record.metadata || { email: normalizedEmail };
    }

    // 2. Fallback to ticket if record was cleared or in stateless context
    if (verificationTicket) {
      try {
        const ticket = JSON.parse(Buffer.from(verificationTicket, 'base64').toString('utf8'));
        if (ticket.email === normalizedEmail) {
          if (now > ticket.expiresAt) {
            throw new BadRequestError('Verification code has expired. Please request a new code.');
          }

          const secret = getOtpSecret();
          const candidateHashed = hashOtp(normalizedEmail, cleanOtp);
          const expectedPayload = `${ticket.email}:${candidateHashed}:${ticket.purpose}:${ticket.expiresAt}`;
          const expectedHmac = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');

          if (crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(ticket.hmac))) {
            return ticket.metadata || { email: normalizedEmail };
          }
        }
      } catch (err: any) {
        if (err instanceof BadRequestError) throw err;
      }
    }

    throw new BadRequestError('Verification code has expired or was not requested. Please request a new code.');
  },
};
