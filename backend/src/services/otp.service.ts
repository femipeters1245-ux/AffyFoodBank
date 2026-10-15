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

    otpStore.set(normalizedEmail, {
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      metadata,
    });

    console.log(`[OTP Service] Generated ${purpose} OTP for ${normalizedEmail}: ${otp}`);

    // Send via Resend
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose,
      firstName: firstName || 'there',
    });

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      expiresInMinutes: 10,
      // For development/demo convenience if Resend API key is in sandbox mode
      simulated: (emailResult as any)?.simulated || false,
    };
  },

  /**
   * Verify an OTP code provided by the user
   */
  verifyOtp(email: string, candidateOtp: string, purpose: 'SIGNUP' | 'LOGIN'): any {
    const normalizedEmail = email.trim().toLowerCase();
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

    if (record.otp !== candidateOtp.trim()) {
      throw new BadRequestError('Incorrect verification code. Please check your email and try again.');
    }

    // OTP verified successfully — clear and return metadata
    const metadata = record.metadata;
    otpStore.delete(normalizedEmail);
    return metadata;
  },
};
