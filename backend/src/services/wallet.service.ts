// backend/src/services/wallet.service.ts
import prisma from '../prisma/client';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.service';
import logger from '../utils/logger';

let lastPrismaErrorTime = 0;
async function safePrismaQuery<T>(fn: () => Promise<T>, timeoutMs = 1500): Promise<T | null> {
  if (Date.now() - lastPrismaErrorTime < 30000) return null;
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      lastPrismaErrorTime = Date.now();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fn(), timeoutPromise]);
    return res as T;
  } catch {
    lastPrismaErrorTime = Date.now();
    return null;
  } finally {
    clearTimeout(timer!);
  }
}

export interface WalletDto {
  id: string;
  customerProfileId: string;
  totalBalanceCents: number;
  allocatedToSavingsCents: number;
  reservedWithdrawalCents: number;
  availableBalanceCents: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wallet service – authoritative ledger and atomic balance management
 */
export const walletService = {
  /**
   * Retrieve the wallet for a given customer profile ID with dynamic fund reservation calculation
   */
  async getWallet(customerProfileId: string): Promise<WalletDto> {
    let rawWallet: any = await safePrismaQuery(() =>
      prisma.wallet.findUnique({
        where: { customerProfileId },
      })
    );

    // Fallback: Query Supabase directly
    if (!rawWallet && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: supaWallet, error } = await supabaseAdmin
          .from('Wallet')
          .select('*')
          .eq('customerProfileId', customerProfileId)
          .maybeSingle();

        if (supaWallet && !error) {
          rawWallet = supaWallet;
        }
      } catch (supaErr: any) {
        logger.warn('[walletService.getWallet] Supabase query note:', { message: supaErr?.message });
      }
    }

    if (!rawWallet) {
      throw new NotFoundError('Wallet not found for customer profile');
    }

    const totalCents = Number(rawWallet.totalBalanceCents || 0);
    const savingsCents = Number(rawWallet.allocatedToSavingsCents || 0);

    // Calculate reserved withdrawal funds (from column or pending withdrawal transactions)
    let reservedCents = Number(rawWallet.reservedWithdrawalCents || 0);

    try {
      const pendingTxs = await this.listPendingWithdrawals(customerProfileId);
      const computedPending = pendingTxs.reduce((sum, tx) => sum + Number(tx.amountCents || 0), 0);
      reservedCents = Math.max(reservedCents, computedPending);
    } catch {}

    const availableCents = Math.max(0, totalCents - savingsCents - reservedCents);

    return {
      id: rawWallet.id,
      customerProfileId: rawWallet.customerProfileId,
      totalBalanceCents: totalCents,
      allocatedToSavingsCents: savingsCents,
      reservedWithdrawalCents: reservedCents,
      availableBalanceCents: availableCents,
      currency: rawWallet.currency || 'NGN',
      status: rawWallet.status || 'ACTIVE',
      createdAt: rawWallet.createdAt ? new Date(rawWallet.createdAt) : new Date(),
      updatedAt: rawWallet.updatedAt ? new Date(rawWallet.updatedAt) : new Date(),
    };
  },

  /**
   * List recent wallet transactions (newest first, limit 50)
   */
  async listTransactions(customerProfileId: string) {
    const wallet = await safePrismaQuery(() =>
      prisma.wallet.findUnique({ where: { customerProfileId } })
    );
    if (wallet) {
      try {
        return await prisma.walletTransaction.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
      } catch {}
    }

    // Fallback: Query Supabase
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: supaWallet } = await supabaseAdmin
          .from('Wallet')
          .select('id')
          .eq('customerProfileId', customerProfileId)
          .maybeSingle();

        if (supaWallet) {
          const { data: txs, error } = await supabaseAdmin
            .from('WalletTransaction')
            .select('*')
            .eq('walletId', supaWallet.id)
            .order('createdAt', { ascending: false })
            .limit(50);

          if (txs && !error) return txs;
        }
      } catch (supaErr: any) {
        logger.warn('[walletService.listTransactions] Supabase note:', { message: supaErr?.message });
      }
    }

    return [];
  },

  /**
   * List active PENDING withdrawal transactions
   */
  async listPendingWithdrawals(customerProfileId: string) {
    try {
      return await prisma.walletTransaction.findMany({
        where: {
          customerProfile: { id: customerProfileId },
          type: 'WITHDRAWAL',
          status: 'PENDING',
        },
      });
    } catch {
      if (isSupabaseAdminConfigured && supabaseAdmin) {
        try {
          const { data: supaTxs } = await supabaseAdmin
            .from('WalletTransaction')
            .select('*')
            .eq('customerId', customerProfileId)
            .eq('type', 'WITHDRAWAL')
            .eq('status', 'PENDING');
          return supaTxs || [];
        } catch {}
      }
    }
    return [];
  },

  /**
   * Atomically reserve funds for a pending withdrawal
   * Pre-condition: available balance >= amountCents
   */
  async reserveWithdrawalFunds(params: {
    customerProfileId: string;
    amountCents: number;
    clientReference: string;
    description: string;
  }): Promise<{ wallet: WalletDto; transaction: any }> {
    const { customerProfileId, amountCents, clientReference, description } = params;
    if (amountCents <= 0) throw new BadRequestError('Withdrawal amount must be greater than zero');

    const wallet = await this.getWallet(customerProfileId);
    if (wallet.availableBalanceCents < amountCents) {
      throw new BadRequestError(
        `Insufficient available balance. You have ₦${(wallet.availableBalanceCents / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })} available, but withdrawal requires ₦${(amountCents / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`
      );
    }

    const txId = uuidv4();

    // 1. Prisma atomic transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Increment reservedWithdrawalCents if column exists
        try {
          await (tx.wallet as any).update({
            where: { id: wallet.id },
            data: { reservedWithdrawalCents: { increment: amountCents } },
          });
        } catch {}

        const createdTx = await tx.walletTransaction.create({
          data: {
            id: txId,
            walletId: wallet.id,
            customerId: customerProfileId,
            reference: clientReference,
            type: 'WITHDRAWAL',
            amountCents: BigInt(amountCents),
            currency: wallet.currency,
            direction: 'OUT',
            status: 'PENDING',
            description,
            paymentReference: clientReference,
          },
        });

        return createdTx;
      });

      const updatedWallet = await this.getWallet(customerProfileId);
      return { wallet: updatedWallet, transaction: result };
    } catch (dbErr: any) {
      logger.warn('[walletService.reserveWithdrawalFunds] Prisma note, trying Supabase fallback:', { message: dbErr?.message });
    }

    // 2. Supabase Fallback
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('WalletTransaction').insert({
          id: txId,
          walletId: wallet.id,
          customerId: customerProfileId,
          reference: clientReference,
          type: 'WITHDRAWAL',
          amountCents: amountCents,
          currency: wallet.currency,
          direction: 'OUT',
          status: 'PENDING',
          description,
          paymentReference: clientReference,
        });

        try {
          await supabaseAdmin
            .from('Wallet')
            .update({ reservedWithdrawalCents: wallet.reservedWithdrawalCents + amountCents })
            .eq('id', wallet.id);
        } catch {}
      } catch (supaErr: any) {
        throw new Error(`Failed to record pending withdrawal: ${supaErr.message}`);
      }
    }

    const updatedWallet = await this.getWallet(customerProfileId);
    return {
      wallet: updatedWallet,
      transaction: {
        id: txId,
        reference: clientReference,
        amountCents,
        status: 'PENDING',
      },
    };
  },

  /**
   * Finalize a successful withdrawal once verified by TransactPay requery
   * Converts reserved funds into a final debit.
   */
  async finalizeSuccessfulWithdrawal(params: {
    clientReference: string;
    providerReference?: string;
    providerSessionId?: string;
  }): Promise<{ success: boolean; transaction?: any }> {
    const { clientReference, providerReference, providerSessionId } = params;

    // 1. Locate the pending transaction
    let existingTx: any = await safePrismaQuery(() =>
      prisma.walletTransaction.findUnique({
        where: { reference: clientReference },
        include: { wallet: true },
      })
    );

    if (!existingTx && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('WalletTransaction')
          .select('*, wallet:Wallet(*)')
          .eq('reference', clientReference)
          .maybeSingle();
        existingTx = data;
      } catch {}
    }

    if (!existingTx) {
      throw new NotFoundError(`Withdrawal transaction not found for reference: ${clientReference}`);
    }

    // Idempotency: if already SUCCESSFUL, return immediately without double-debiting
    if (existingTx.status === 'SUCCESSFUL') {
      logger.info('[walletService] Withdrawal already finalized successfully:', { clientReference });
      return { success: true, transaction: existingTx };
    }

    const amountCents = Number(existingTx.amountCents);
    const walletId = existingTx.walletId;

    // 2. Perform atomic finalization
    try {
      await prisma.$transaction(async (tx) => {
        // Decrement total balance and clear reserved funds
        try {
          await (tx.wallet as any).update({
            where: { id: walletId },
            data: {
              totalBalanceCents: { decrement: BigInt(amountCents) },
              reservedWithdrawalCents: { decrement: BigInt(amountCents) },
            },
          });
        } catch {
          await tx.wallet.update({
            where: { id: walletId },
            data: { totalBalanceCents: { decrement: BigInt(amountCents) } },
          });
        }

        await tx.walletTransaction.update({
          where: { reference: clientReference },
          data: {
            status: 'SUCCESSFUL',
            providerReference: providerReference || existingTx.providerReference,
            providerSessionId: providerSessionId || existingTx.providerSessionId,
            updatedAt: new Date(),
          },
        });
      });
      return { success: true };
    } catch (txErr: any) {
      logger.warn('[walletService] Prisma finalization note, trying Supabase fallback:', { message: txErr?.message });
    }

    // Supabase fallback
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: w } = await supabaseAdmin.from('Wallet').select('*').eq('id', walletId).single();
        if (w) {
          const newTotal = Math.max(0, Number(w.totalBalanceCents) - amountCents);
          const newReserved = Math.max(0, Number(w.reservedWithdrawalCents || 0) - amountCents);
          await supabaseAdmin
            .from('Wallet')
            .update({
              totalBalanceCents: newTotal,
              reservedWithdrawalCents: newReserved,
            })
            .eq('id', walletId);
        }

        await supabaseAdmin
          .from('WalletTransaction')
          .update({
            status: 'SUCCESSFUL',
            providerReference,
            providerSessionId,
            updatedAt: new Date().toISOString(),
          })
          .eq('reference', clientReference);

        return { success: true };
      } catch (sErr: any) {
        throw new Error(`Failed to finalize withdrawal in Supabase: ${sErr.message}`);
      }
    }

    return { success: false };
  },

  /**
   * Release reserved funds when a withdrawal fails or is rejected
   */
  async releaseFailedWithdrawal(params: {
    clientReference: string;
    reason: string;
    providerReference?: string;
  }): Promise<{ success: boolean }> {
    const { clientReference, reason, providerReference } = params;

    let existingTx: any = await safePrismaQuery(() =>
      prisma.walletTransaction.findUnique({
        where: { reference: clientReference },
      })
    );

    if (!existingTx && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('WalletTransaction')
          .select('*')
          .eq('reference', clientReference)
          .maybeSingle();
        existingTx = data;
      } catch {}
    }

    if (!existingTx) return { success: false };

    // Idempotency: if already FAILED, do not release twice
    if (existingTx.status === 'FAILED') {
      return { success: true };
    }

    const amountCents = Number(existingTx.amountCents);
    const walletId = existingTx.walletId;

    try {
      await prisma.$transaction(async (tx) => {
        try {
          await (tx.wallet as any).update({
            where: { id: walletId },
            data: { reservedWithdrawalCents: { decrement: BigInt(amountCents) } },
          });
        } catch {}

        await tx.walletTransaction.update({
          where: { reference: clientReference },
          data: {
            status: 'FAILED',
            description: `${existingTx.description} (Failed: ${reason})`,
            providerReference: providerReference || existingTx.providerReference,
            updatedAt: new Date(),
          },
        });
      });
      return { success: true };
    } catch {}

    // Supabase fallback
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: w } = await supabaseAdmin.from('Wallet').select('*').eq('id', walletId).single();
        if (w) {
          const newReserved = Math.max(0, Number(w.reservedWithdrawalCents || 0) - amountCents);
          await supabaseAdmin
            .from('Wallet')
            .update({ reservedWithdrawalCents: newReserved })
            .eq('id', walletId);
        }

        await supabaseAdmin
          .from('WalletTransaction')
          .update({
            status: 'FAILED',
            description: `${existingTx.description} (Failed: ${reason})`,
            providerReference,
            updatedAt: new Date().toISOString(),
          })
          .eq('reference', clientReference);

        return { success: true };
      } catch {}
    }

    return { success: false };
  },

  /**
   * Credit confirmed deposit – strictly idempotent and only called after independent TransactPay verification
   */
  async creditConfirmedDeposit(params: {
    customerProfileId: string;
    amountCents: number;
    reference: string;
    sessionId: string;
    providerReference?: string;
    description?: string;
  }): Promise<WalletDto> {
    const { customerProfileId, amountCents, reference, sessionId, providerReference, description } = params;
    if (amountCents <= 0) throw new BadRequestError('Deposit amount must be positive');

    // 1. Idempotency check: verify if reference or sessionId has already been credited
    const existingTx = await safePrismaQuery(() =>
      prisma.walletTransaction.findFirst({
        where: {
          OR: [
            { reference },
            { providerSessionId: sessionId },
            ...(providerReference ? [{ providerReference }] : []),
          ],
        },
      })
    );

    if (existingTx && existingTx.status === 'SUCCESSFUL') {
      logger.info('[walletService] Deposit already credited, idempotent return:', { reference, sessionId });
      return this.getWallet(customerProfileId);
    }

    const txId = uuidv4();

    // 2. Atomic credit
    try {
      await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
        if (!wallet) throw new NotFoundError('Wallet not found');

        await tx.wallet.update({
          where: { customerProfileId },
          data: { totalBalanceCents: { increment: BigInt(amountCents) } },
        });

        if (existingTx) {
          await tx.walletTransaction.update({
            where: { id: existingTx.id },
            data: {
              status: 'SUCCESSFUL',
              providerSessionId: sessionId,
              providerReference,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.walletTransaction.create({
            data: {
              id: txId,
              walletId: wallet.id,
              customerId: customerProfileId,
              reference,
              providerSessionId: sessionId,
              providerReference,
              type: 'DEPOSIT',
              amountCents: BigInt(amountCents),
              currency: wallet.currency,
              direction: 'IN',
              status: 'SUCCESSFUL',
              description: description || `Bank Transfer Deposit (${reference})`,
            },
          });
        }
      });
      return this.getWallet(customerProfileId);
    } catch (pErr: any) {
      logger.warn('[walletService] Prisma credit note, trying Supabase fallback:', { message: pErr?.message });
    }

    // Supabase fallback
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: wallet } = await supabaseAdmin
          .from('Wallet')
          .select('*')
          .eq('customerProfileId', customerProfileId)
          .single();

        if (wallet) {
          const newTotal = Number(wallet.totalBalanceCents) + amountCents;
          await supabaseAdmin
            .from('Wallet')
            .update({ totalBalanceCents: newTotal })
            .eq('id', wallet.id);

          await supabaseAdmin.from('WalletTransaction').insert({
            id: txId,
            walletId: wallet.id,
            customerId: customerProfileId,
            reference,
            providerSessionId: sessionId,
            providerReference,
            type: 'DEPOSIT',
            amountCents,
            currency: wallet.currency || 'NGN',
            direction: 'IN',
            status: 'SUCCESSFUL',
            description: description || `Bank Transfer Deposit (${reference})`,
          });
        }
      } catch (sErr: any) {
        throw new Error(`Failed to credit deposit in Supabase: ${sErr.message}`);
      }
    }

    return this.getWallet(customerProfileId);
  },

  /** Move funds from available balance into a savings plan allocation */
  async allocateToSavings(params: {
    customerProfileId: string;
    savingsPlanId: string;
    amountCents: number;
  }) {
    const { customerProfileId, savingsPlanId, amountCents } = params;
    if (amountCents <= 0) throw new BadRequestError('Allocation amount must be positive');

    const wallet = await this.getWallet(customerProfileId);
    if (wallet.availableBalanceCents < amountCents) {
      throw new ConflictError('Insufficient available balance to allocate to savings');
    }

    return prisma.$transaction(async (tx) => {
      const plan = await tx.savingsPlan.findUnique({ where: { id: savingsPlanId } });
      if (!plan) throw new NotFoundError('Savings plan not found');

      const updatedWallet = await tx.wallet.update({
        where: { customerProfileId },
        data: { allocatedToSavingsCents: { increment: amountCents } },
      });

      const txRecord = await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: wallet.id,
          customerId: customerProfileId,
          reference: `savings-alloc-${Date.now()}-${uuidv4().slice(0, 8)}`,
          type: 'SAVINGS_ALLOCATION',
          amountCents,
          currency: wallet.currency,
          direction: 'OUT',
          status: 'SUCCESSFUL',
          description: `Allocation to savings plan: ${plan.name}`,
        },
      });

      await tx.savingsPlan.update({
        where: { id: savingsPlanId },
        data: { amountSavedCents: { increment: amountCents } },
      });

      await tx.savingsContribution.create({
        data: {
          id: uuidv4(),
          savingsPlanId,
          walletTransactionId: txRecord.id,
          amountCents,
        },
      });

      return updatedWallet;
    });
  },

  /** Release funds from a savings plan allocation back to available balance */
  async releaseFromSavings(params: {
    customerProfileId: string;
    savingsPlanId: string;
    amountCents: number;
  }) {
    const { customerProfileId, savingsPlanId, amountCents } = params;
    if (amountCents <= 0) throw new BadRequestError('Release amount must be positive');

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { customerProfileId } });
      if (!wallet) throw new NotFoundError('Wallet not found');

      const plan = await tx.savingsPlan.findUnique({ where: { id: savingsPlanId } });
      if (!plan) throw new NotFoundError('Savings plan not found');

      if (Number(plan.amountSavedCents) < amountCents) {
        throw new ConflictError('Plan does not have enough allocated to release');
      }

      const updatedWallet = await tx.wallet.update({
        where: { customerProfileId },
        data: { allocatedToSavingsCents: { decrement: amountCents } },
      });

      await tx.walletTransaction.create({
        data: {
          id: uuidv4(),
          walletId: wallet.id,
          customerId: customerProfileId,
          reference: `savings-release-${Date.now()}-${uuidv4().slice(0, 8)}`,
          type: 'SAVINGS_RELEASE',
          amountCents,
          currency: wallet.currency,
          direction: 'IN',
          status: 'SUCCESSFUL',
          description: `Release from savings plan: ${plan.name}`,
        },
      });

      await tx.savingsPlan.update({
        where: { id: savingsPlanId },
        data: { amountSavedCents: { decrement: amountCents } },
      });

      return updatedWallet;
    });
  },
};
