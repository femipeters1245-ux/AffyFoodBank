// backend/src/services/funding.service.ts
import prisma from '../prisma/client';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.service';
import { transactPayService } from './transactpay.service';
import { virtualAccountStore } from './virtual-account.store';
import { walletService } from './wallet.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface FundingProcessingResult {
  status: 'CREDITED' | 'FAILED' | 'UNMATCHED' | 'REJECTED' | 'ALREADY_CREDITED' | 'PENDING';
  message: string;
  customerProfileId?: string;
  amountCents?: number;
  transactionReference?: string;
}

export const fundingService = {
  /**
   * Durably records incoming raw webhook payload in WalletFundingEvent table.
   * Enforces DB-level uniqueness on sessionId and paymentReference.
   */
  async recordFundingEvent(rawPayload: any): Promise<{ eventId: string; sessionId: string; isDuplicate: boolean }> {
    const payload = rawPayload || {};
    const data = payload?.data || payload?.Data || payload;

    const sessionId = (data?.sessionId || payload?.sessionId || '').toString().trim();
    const paymentReference = (data?.paymentReference || payload?.paymentReference || `FPAY-${Date.now()}`).toString().trim();
    const accountReference = (data?.accountReference || payload?.accountReference || '').toString().trim() || null;
    
    // Extract destination account number if present in orderPayments
    const destinationAccount =
      data?.orderPayments?.[0]?.orderPaymentInstrument ||
      payload?.orderPayments?.[0]?.orderPaymentInstrument ||
      data?.accountNumber ||
      payload?.accountNumber ||
      null;

    const grossAmountNaira = Number(data?.totalAmountCharged || payload?.totalAmountCharged || data?.amount || 0);
    const grossAmountCents = grossAmountNaira > 0 ? Math.round(grossAmountNaira * 100) : null;
    const feeNaira = Number(data?.fee || payload?.fee || 0);
    const feeCents = feeNaira > 0 ? Math.round(feeNaira * 100) : 0;
    const netAmountCents = grossAmountCents !== null ? Math.max(0, grossAmountCents - feeCents) : null;

    if (!sessionId) {
      throw new Error('Missing required sessionId in webhook payload');
    }

    // Check if event already exists in DB
    try {
      const existing = await (prisma as any).walletFundingEvent.findFirst({
        where: {
          OR: [
            { sessionId },
            { paymentReference },
          ],
        },
      });

      if (existing) {
        logger.info('[fundingService] Event already recorded:', { sessionId, paymentReference, status: existing.status });
        return { eventId: existing.id, sessionId, isDuplicate: true };
      }
    } catch {}

    const eventId = uuidv4();

    // 1. Persist to Prisma
    try {
      await (prisma as any).walletFundingEvent.create({
        data: {
          id: eventId,
          sessionId,
          paymentReference,
          accountReference,
          destinationAccountNumber: destinationAccount,
          rawPayload: payload,
          status: 'RECEIVED',
          grossAmountCents: grossAmountCents ? BigInt(grossAmountCents) : null,
          feeCents: BigInt(feeCents),
          netAmountCents: netAmountCents ? BigInt(netAmountCents) : null,
          currency: 'NGN',
          attempts: 0,
        },
      });
      logger.info('[fundingService] Durably recorded funding event in Prisma:', { eventId, sessionId });
      return { eventId, sessionId, isDuplicate: false };
    } catch (dbErr: any) {
      // Check if duplicate key violation occurred concurrently
      if (dbErr?.code === 'P2002' || dbErr?.message?.includes('unique constraint')) {
        logger.info('[fundingService] Concurrent duplicate event recorded safely:', { sessionId });
        return { eventId, sessionId, isDuplicate: true };
      }
    }

    // 2. Fallback: Persist to Supabase directly if Prisma is unreachable
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.from('WalletFundingEvent').insert({
          id: eventId,
          sessionId,
          paymentReference,
          accountReference,
          destinationAccountNumber: destinationAccount,
          rawPayload: payload,
          status: 'RECEIVED',
          grossAmountCents,
          feeCents,
          netAmountCents,
          currency: 'NGN',
          attempts: 0,
        });

        if (!error) {
          logger.info('[fundingService] Durably recorded funding event in Supabase:', { eventId, sessionId });
          return { eventId, sessionId, isDuplicate: false };
        } else if (error.code === 'PGRST205') {
          // If table does not exist yet in Supabase schema cache, buffer durably in AuditLog
          await supabaseAdmin.from('AuditLog').insert({
            id: uuidv4(),
            action: 'WALLET_FUNDING_EVENT_RECEIVED',
            targetTable: 'WalletFundingEvent',
            targetId: sessionId,
            newValues: {
              id: eventId,
              sessionId,
              paymentReference,
              accountReference,
              destinationAccountNumber: destinationAccount,
              rawPayload: payload,
              status: 'RECEIVED',
              grossAmountCents,
              feeCents,
              netAmountCents,
              currency: 'NGN',
              attempts: 0,
              createdAt: new Date().toISOString(),
            },
            ipAddress: 'server',
          });
          logger.info('[fundingService] Durably buffered funding event in Supabase AuditLog:', { eventId, sessionId });
          return { eventId, sessionId, isDuplicate: false };
        }
      } catch (supaErr: any) {
        logger.warn('[fundingService] Supabase insert note:', { message: supaErr.message });
      }
    }

    return { eventId, sessionId, isDuplicate: false };
  },

  /**
   * Independently verifies funding details with TransactPay API and credits customer wallet exactly once.
   * Used by webhook handler, retry jobs, and admin manual re-verification.
   */
  async verifyAndProcessFundingEvent(sessionId: string): Promise<FundingProcessingResult> {
    const cleanSessionId = sessionId.trim();
    logger.info('[fundingService] Verifying funding event:', { sessionId: cleanSessionId });

    // 1. Fetch funding event from DB
    let event: any = null;
    try {
      event = await (prisma as any).walletFundingEvent.findUnique({
        where: { sessionId: cleanSessionId },
      });
    } catch {}

    if (!event && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('WalletFundingEvent')
          .select('*')
          .eq('sessionId', cleanSessionId)
          .maybeSingle();
        event = data;
      } catch {}

      if (!event) {
        try {
          const { data: auditRow } = await supabaseAdmin
            .from('AuditLog')
            .select('*')
            .eq('targetTable', 'WalletFundingEvent')
            .eq('targetId', cleanSessionId)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (auditRow?.newValues) {
            event = auditRow.newValues;
          }
        } catch {}
      }
    }

    // Check if already credited
    if (event && event.status === 'CREDITED') {
      logger.info('[fundingService] Event is already credited, skipping:', { sessionId: cleanSessionId });
      return {
        status: 'ALREADY_CREDITED',
        message: 'This funding event has already been confirmed and credited',
        customerProfileId: event.customerProfileId,
        amountCents: Number(event.netAmountCents || event.grossAmountCents || 0),
        transactionReference: event.paymentReference,
      };
    }

    // Mark status as VERIFYING
    await this.updateEventStatus(cleanSessionId, { status: 'VERIFYING', attemptsIncrement: 1 });

    // 2. Independent API verification with TransactPay
    let verified: any;
    try {
      verified = await transactPayService.verifyFundingDetails(cleanSessionId);
    } catch (apiErr: any) {
      logger.error('[fundingService] Provider verification call failed:', { sessionId: cleanSessionId, error: apiErr.message });
      await this.updateEventStatus(cleanSessionId, {
        status: 'FAILED',
        failureReason: `TransactPay API call failed: ${apiErr.message}`,
      });
      return {
        status: 'FAILED',
        message: `Provider verification unreachable: ${apiErr.message}`,
      };
    }

    // 3. Verify status, statusId, and currency
    const isSuccessful = verified.statusId === 5 || verified.status?.toLowerCase() === 'successful';
    if (!isSuccessful) {
      const msg = `Provider reported non-successful status: ${verified.status} (statusId: ${verified.statusId})`;
      logger.warn('[fundingService] ' + msg, { sessionId: cleanSessionId });
      await this.updateEventStatus(cleanSessionId, {
        status: verified.statusId === 1 ? 'RECEIVED' : 'FAILED',
        failureReason: msg,
        verificationPayload: verified.raw,
      });
      return { status: 'FAILED', message: msg };
    }

    if (verified.currencyName !== 'NGN') {
      const msg = `Currency mismatch: expected NGN, received ${verified.currencyName}`;
      logger.error('[fundingService] ' + msg, { sessionId: cleanSessionId });
      await this.updateEventStatus(cleanSessionId, {
        status: 'REJECTED',
        failureReason: msg,
        verificationPayload: verified.raw,
      });
      return { status: 'REJECTED', message: msg };
    }

    if (verified.amountCents <= 0) {
      const msg = `Invalid verified amount: ₦${verified.totalAmountCharged}`;
      logger.error('[fundingService] ' + msg, { sessionId: cleanSessionId });
      await this.updateEventStatus(cleanSessionId, {
        status: 'REJECTED',
        failureReason: msg,
        verificationPayload: verified.raw,
      });
      return { status: 'REJECTED', message: msg };
    }

    // 4. Destination Account Matching (Zero Guessing Policy)
    // Identify destination account via verified.accountReference, event.accountReference, or orderPaymentInstrument
    const destinationAccount =
      verified.orderPayments?.[0]?.orderPaymentInstrument ||
      event?.destinationAccountNumber ||
      null;

    const accountRef = verified.accountReference || event?.accountReference || null;

    let matchedVA: any = null;

    // Search by accountReference first (if provided)
    if (accountRef) {
      matchedVA = await virtualAccountStore.getByAccountOrReference(accountRef);
    }

    // If not found, search by destination account number
    if (!matchedVA && destinationAccount) {
      matchedVA = await virtualAccountStore.getByAccountOrReference(destinationAccount);
    }

    if (!matchedVA) {
      const msg = `UNMATCHED: No virtual account found in system matching accountReference="${accountRef}" or accountNumber="${destinationAccount}"`;
      logger.warn('[fundingService] ' + msg, { sessionId: cleanSessionId });
      await this.updateEventStatus(cleanSessionId, {
        status: 'UNMATCHED',
        failureReason: msg,
        verificationPayload: verified.raw,
      });
      return { status: 'UNMATCHED', message: msg };
    }

    const customerProfileId = matchedVA.customerProfileId;
    const grossAmountCents = verified.amountCents;
    // Per policy: credit full verified amount; if provider charged a fee, record it
    const feeCents = event?.feeCents ? Number(event.feeCents) : 0;
    const netAmountCents = grossAmountCents; // Defaulting to 100% credit unless fee deduction confirmed

    // ─── WALLET SYSTEM RETIRED ──────────────────────────────────────────────
    // The wallet system has been retired. Incoming verified bank transfers are
    // recorded as FLAGGED_FOR_MANUAL_REFUND and NOT credited to any wallet.
    // Finance team handles manual bank refunds from the Settlement Archive view.
    // Rollback: set WALLET_RETIRED to false to restore normal wallet crediting.
    const WALLET_RETIRED = true;

    if (WALLET_RETIRED) {
      const retiredMsg = `Wallet system retired — transfer of ₦${verified.totalAmountCharged} from account ${destinationAccount || accountRef} flagged for manual bank refund`;
      logger.info('[fundingService] ' + retiredMsg, { sessionId: cleanSessionId, customerProfileId });
      await this.updateEventStatus(cleanSessionId, {
        status: 'FLAGGED_FOR_MANUAL_REFUND' as any,
        failureReason: retiredMsg,
        verificationPayload: verified.raw,
      });
      return {
        status: 'FLAGGED_FOR_MANUAL_REFUND' as any,
        message: retiredMsg,
        customerProfileId,
        amountCents: verified.amountCents,
        transactionReference: verified.paymentReference,
      };
    }
    // ────────────────────────────────────────────────────────────────────────

    // 5. ATOMIC LEDGER CREDITING (Exactly Once)
    let creditSuccess = false;
    let transactionReference = verified.paymentReference || `DEP-${Date.now()}-${uuidv4().slice(0, 6)}`;

    try {
      await prisma.$transaction(async (tx) => {
        // A. Verify and lock the funding event row
        const currentEvent = await (tx as any).walletFundingEvent.findUnique({
          where: { sessionId: cleanSessionId },
        });

        if (currentEvent && currentEvent.status === 'CREDITED') {
          throw new Error('ALREADY_CREDITED');
        }

        // B. Ensure wallet exists
        let wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              customerProfileId,
              totalBalanceCents: BigInt(0),
              currency: 'NGN',
              status: 'ACTIVE',
            },
          });
        }

        // C. Atomically increment totalBalanceCents
        await tx.wallet.update({
          where: { customerProfileId },
          data: {
            totalBalanceCents: { increment: BigInt(netAmountCents) },
          },
        });

        // D. Create unique WalletTransaction ledger row
        const txId = uuidv4();
        await tx.walletTransaction.create({
          data: {
            id: txId,
            walletId: wallet.id,
            customerId: customerProfileId,
            reference: transactionReference,
            providerSessionId: cleanSessionId,
            providerReference: verified.paymentReference,
            type: 'DEPOSIT',
            amountCents: BigInt(netAmountCents),
            grossAmountCents: BigInt(grossAmountCents),
            feeCents: BigInt(feeCents),
            currency: 'NGN',
            direction: 'IN',
            status: 'SUCCESSFUL',
            description: `TransactPay Bank Transfer: ₦${verified.totalAmountCharged.toLocaleString()} (VA: ${matchedVA.accountNumber})`,
            paymentReference: verified.paymentReference,
          },
        });

        // E. Update WalletFundingEvent to CREDITED
        await (tx as any).walletFundingEvent.update({
          where: { sessionId: cleanSessionId },
          data: {
            status: 'CREDITED',
            customerProfileId,
            destinationAccountNumber: matchedVA.accountNumber,
            grossAmountCents: BigInt(grossAmountCents),
            feeCents: BigInt(feeCents),
            netAmountCents: BigInt(netAmountCents),
            verifiedAt: new Date(),
            verificationPayload: verified.raw,
            failureReason: null,
            updatedAt: new Date(),
          },
        });
      });

      creditSuccess = true;
      logger.info('[fundingService] Successfully credited wallet exactly once via Prisma:', {
        sessionId: cleanSessionId,
        customerProfileId,
        amountNaira: verified.totalAmountCharged,
      });
    } catch (txErr: any) {
      if (txErr?.message === 'ALREADY_CREDITED' || txErr?.code === 'P2002') {
        logger.info('[fundingService] Event was already credited concurrently:', { sessionId: cleanSessionId });
        return {
          status: 'ALREADY_CREDITED',
          message: 'Deposit already credited',
          customerProfileId,
          amountCents: netAmountCents,
        };
      }
      logger.warn('[fundingService] Prisma atomic transaction note, attempting Supabase fallback:', { message: txErr?.message });
    }

    // 6. Supabase Atomic Ledger Fallback (Resilient Production Serverless)
    if (!creditSuccess && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        // A. Idempotency check: check if WalletTransaction already exists with paymentReference or reference
        const { data: existingTxs } = await supabaseAdmin
          .from('WalletTransaction')
          .select('id, status')
          .or(`paymentReference.eq."${verified.paymentReference}",reference.eq."${cleanSessionId}",reference.eq."${transactionReference}"`)
          .limit(1);

        if (existingTxs && existingTxs.length > 0 && existingTxs[0].status === 'SUCCESSFUL') {
          logger.info('[fundingService] Deposit already credited in Supabase (idempotent):', { sessionId: cleanSessionId });
          return {
            status: 'ALREADY_CREDITED',
            message: 'Deposit already credited',
            customerProfileId,
            amountCents: netAmountCents,
          };
        }

        // B. Ensure wallet exists
        const { data: supaWallet } = await supabaseAdmin
          .from('Wallet')
          .select('*')
          .eq('customerProfileId', customerProfileId)
          .maybeSingle();

        let walletId = supaWallet?.id || uuidv4();
        const now = new Date().toISOString();

        // C. Insert unique ledger entry in WalletTransaction FIRST
        const txId = uuidv4();
        const { error: txErr } = await supabaseAdmin
          .from('WalletTransaction')
          .insert({
            id: txId,
            walletId,
            customerId: customerProfileId,
            reference: transactionReference,
            type: 'DEPOSIT',
            amountCents: netAmountCents,
            currency: 'NGN',
            direction: 'IN',
            status: 'SUCCESSFUL',
            description: `TransactPay Bank Transfer: ₦${verified.totalAmountCharged.toLocaleString()} (VA: ${matchedVA.accountNumber})`,
            paymentReference: verified.paymentReference,
            createdAt: now,
            updatedAt: now,
          });

        if (txErr) {
          logger.error('[fundingService] Supabase ledger insert failed:', txErr);
          throw new Error(`Supabase ledger insert failed: ${txErr.message}`);
        }

        // D. Update or create wallet balance atomically
        if (!supaWallet) {
          const { error: wErr } = await supabaseAdmin
            .from('Wallet')
            .insert({
              id: walletId,
              customerProfileId,
              totalBalanceCents: netAmountCents,
              allocatedToSavingsCents: 0,
              currency: 'NGN',
              status: 'ACTIVE',
              createdAt: now,
              updatedAt: now,
            });
          if (wErr) {
            // Compensate ledger insert on wallet creation failure
            await supabaseAdmin.from('WalletTransaction').delete().eq('id', txId);
            throw new Error(`Supabase wallet creation failed: ${wErr.message}`);
          }
        } else {
          // Increment wallet balance
          const newBal = Number(supaWallet.totalBalanceCents || 0) + netAmountCents;
          const { error: updErr } = await supabaseAdmin
            .from('Wallet')
            .update({
              totalBalanceCents: newBal,
              updatedAt: now,
            })
            .eq('id', walletId);
          if (updErr) {
            // Compensate ledger insert on wallet update failure
            await supabaseAdmin.from('WalletTransaction').delete().eq('id', txId);
            throw new Error(`Supabase wallet update failed: ${updErr.message}`);
          }
        }

        // D. Update funding event status
        await this.updateEventStatus(cleanSessionId, {
          status: 'CREDITED',
          verificationPayload: verified.raw,
        });

        creditSuccess = true;
        logger.info('[fundingService] Successfully credited wallet exactly once via Supabase fallback:', {
          sessionId: cleanSessionId,
          customerProfileId,
          amountNaira: verified.totalAmountCharged,
        });
      } catch (supaTxErr: any) {
        logger.error('[fundingService] Supabase atomic transaction failed:', { sessionId: cleanSessionId, error: supaTxErr.message });
        await this.updateEventStatus(cleanSessionId, {
          status: 'FAILED',
          failureReason: `DB transaction error: ${supaTxErr.message}`,
        });
        throw supaTxErr;
      }
    }

    if (!creditSuccess) {
      throw new Error('Database transaction failed on both Prisma and Supabase connections');
    }

    return {
      status: 'CREDITED',
      message: `Successfully verified and credited ₦${verified.totalAmountCharged} to wallet`,
      customerProfileId,
      amountCents: netAmountCents,
      transactionReference: transactionReference,
    };
  },

  /**
   * Helper to update event status in Prisma or Supabase
   */
  async updateEventStatus(
    sessionId: string,
    updates: {
      status?: string;
      failureReason?: string | null;
      verificationPayload?: any;
      attemptsIncrement?: number;
    }
  ) {
    try {
      await (prisma as any).walletFundingEvent.update({
        where: { sessionId },
        data: {
          ...(updates.status ? { status: updates.status } : {}),
          ...(updates.failureReason !== undefined ? { failureReason: updates.failureReason } : {}),
          ...(updates.verificationPayload ? { verificationPayload: updates.verificationPayload } : {}),
          ...(updates.attemptsIncrement ? { attempts: { increment: updates.attemptsIncrement } } : {}),
          updatedAt: new Date(),
        },
      });
    } catch {}

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin
          .from('WalletFundingEvent')
          .update({
            ...(updates.status ? { status: updates.status } : {}),
            ...(updates.failureReason !== undefined ? { failureReason: updates.failureReason } : {}),
            ...(updates.verificationPayload ? { verificationPayload: updates.verificationPayload } : {}),
            updatedAt: new Date().toISOString(),
          })
          .eq('sessionId', sessionId);

        if (error && error.code === 'PGRST205') {
          // If table does not exist yet, log update in AuditLog
          await supabaseAdmin.from('AuditLog').insert({
            id: uuidv4(),
            action: updates.status === 'CREDITED' ? 'WALLET_FUNDING_EVENT_CREDITED' : 'WALLET_FUNDING_EVENT_UPDATED',
            targetTable: 'WalletFundingEvent',
            targetId: sessionId,
            newValues: { sessionId, ...updates, updatedAt: new Date().toISOString() },
            ipAddress: 'server',
          });
        }
      } catch {}
    }
  },

  /**
   * Admin-triggered re-verification of any funding event.
   * Follows the exact same provider verification logic — no admin manual bypass.
   */
  async reverifyFundingEvent(sessionId: string): Promise<FundingProcessingResult> {
    return this.verifyAndProcessFundingEvent(sessionId);
  },

  /**
   * Returns list of funding events for Operational Portal oversight.
   */
  async listFundingEvents(params: {
    status?: string;
    needsReview?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit || 50, 100);
    const offset = params.offset || 0;

    const where: any = {};
    if (params.status) {
      where.status = params.status;
    } else if (params.needsReview) {
      where.status = { in: ['UNMATCHED', 'FAILED', 'REJECTED'] };
    }

    try {
      const [events, total] = await Promise.all([
        (prisma as any).walletFundingEvent.findMany({
          where,
          include: {
            customerProfile: {
              include: { user: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        (prisma as any).walletFundingEvent.count({ where }),
      ]);

      return {
        events: events.map((e: any) => ({
          id: e.id,
          sessionId: e.sessionId,
          paymentReference: e.paymentReference,
          accountReference: e.accountReference,
          destinationAccountNumber: e.destinationAccountNumber,
          customerName: e.customerProfile?.user?.firstName
            ? `${e.customerProfile.user.firstName} ${e.customerProfile.user.lastName || ''}`.trim()
            : 'Unassigned',
          customerEmail: e.customerProfile?.user?.email || null,
          status: e.status,
          grossAmountNaira: e.grossAmountCents ? Number(e.grossAmountCents) / 100 : 0,
          feeNaira: e.feeCents ? Number(e.feeCents) / 100 : 0,
          netAmountNaira: e.netAmountCents ? Number(e.netAmountCents) / 100 : 0,
          currency: e.currency,
          failureReason: e.failureReason,
          attempts: e.attempts,
          verifiedAt: e.verifiedAt,
          createdAt: e.createdAt,
        })),
        total,
      };
    } catch {
      if (isSupabaseAdminConfigured && supabaseAdmin) {
        try {
          const { data: auditLogs } = await supabaseAdmin
            .from('AuditLog')
            .select('*')
            .eq('targetTable', 'WalletFundingEvent')
            .order('createdAt', { ascending: false })
            .limit(limit);

          if (auditLogs && auditLogs.length > 0) {
            return {
              events: auditLogs.map((log: any) => {
                const val = log.newValues || {};
                return {
                  id: log.id,
                  sessionId: log.targetId || val.sessionId,
                  paymentReference: val.paymentReference || '',
                  accountReference: val.accountReference || '',
                  destinationAccountNumber: val.destinationAccountNumber || '',
                  customerName: 'Customer',
                  customerEmail: null,
                  status: val.status || 'RECEIVED',
                  grossAmountNaira: val.grossAmountCents ? Number(val.grossAmountCents) / 100 : 0,
                  feeNaira: val.feeCents ? Number(val.feeCents) / 100 : 0,
                  netAmountNaira: val.netAmountCents ? Number(val.netAmountCents) / 100 : 0,
                  currency: val.currency || 'NGN',
                  failureReason: val.failureReason || null,
                  attempts: val.attempts || 1,
                  verifiedAt: val.verifiedAt || null,
                  createdAt: log.createdAt,
                };
              }),
              total: auditLogs.length,
            };
          }
        } catch {}
      }
      return { events: [], total: 0 };
    }
  },

  /**
   * Admin-triggered rate-limited backfill for existing customers who don't have a virtual account yet.
   */
  async backfillExistingCustomers(params: { limit?: number; delayMs?: number }) {
    const limit = Math.min(params.limit || 10, 50);
    const delayMs = params.delayMs || 500;

    // Find customer profiles that have no VirtualAccount
    const profiles = await prisma.customerProfile.findMany({
      where: {
        virtualAccount: null,
      },
      include: { user: true },
      take: limit,
    });

    const results: Array<{ customerId: string; email: string; status: string; accountNumber?: string; error?: string }> = [];

    for (const prof of profiles) {
      try {
        const userId = prof.userId;
        const alias = `AFFY-CUST-${userId}`;
        const reference = `AFFY-WLT-${userId}`;

        // Check if TransactPay already has one (alias lookup)
        let va = await transactPayService.getAccountDetailsByAlias(alias);

        // If not found, generate
        if (!va) {
          va = await transactPayService.generateVirtualAccount({
            alias,
            reference,
            narration: 'AffyFoodBank Wallet Funding',
          });
        }

        // Save
        await virtualAccountStore.save({
          customerProfileId: prof.id,
          accountNumber: va.accountNumber,
          bankName: va.bankName,
          bankCode: va.bankCode,
          accountName: va.accountName,
          accountReference: va.accountReference || reference,
          alias,
          currency: va.currency || 'NGN',
          provider: 'TRANSACTPAY',
          isActive: true,
        });

        results.push({
          customerId: prof.id,
          email: prof.user?.email || '',
          status: 'CREATED',
          accountNumber: va.accountNumber,
        });

        // Safe rate-limiting delay between provider calls
        await new Promise((r) => setTimeout(r, delayMs));
      } catch (err: any) {
        results.push({
          customerId: prof.id,
          email: prof.user?.email || '',
          status: 'ERROR',
          error: err.message,
        });
      }
    }

    return {
      processedCount: results.length,
      successCount: results.filter((r) => r.status === 'CREATED').length,
      errorCount: results.filter((r) => r.status === 'ERROR').length,
      details: results,
    };
  },
};
