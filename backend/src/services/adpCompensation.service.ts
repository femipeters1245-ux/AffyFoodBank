// backend/src/services/adpCompensation.service.ts
import crypto from 'crypto';
import prisma from '../prisma/client';
import { supabaseAdmin } from './supabase-admin.service';
import { decryptSensitiveData } from './encryption.service';
import { transactPayService } from './transactpay.service';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface SetRateInput {
  coverageZoneId?: string | null;
  ratePerCollectionCents: number;
  createdBy?: string;
}

export class AdpCompensationService {
  /**
   * Resolves the active compensation rate for an ADP zone.
   * Priority:
   * 1. Zone-specific active rate
   * 2. Global fallback rate (where coverageZoneId is null)
   * 3. Default fallback 0 if no rate is configured in the database yet.
   */
  async getActiveRateForZone(coverageZoneId?: string | null): Promise<number> {
    try {
      // 1. Check zone specific
      if (coverageZoneId) {
        const zoneRate = await prisma.adpCompensationRate.findFirst({
          where: { coverageZoneId, isActive: true },
          orderBy: { effectiveFrom: 'desc' },
        });
        if (zoneRate) return Number(zoneRate.ratePerCollectionCents);
      }

      // 2. Check global default
      const globalRate = await prisma.adpCompensationRate.findFirst({
        where: { coverageZoneId: null, isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (globalRate) return Number(globalRate.ratePerCollectionCents);

      return 0;
    } catch {
      if (supabaseAdmin) {
        if (coverageZoneId) {
          const { data } = await supabaseAdmin
            .from('AdpCompensationRate')
            .select('ratePerCollectionCents')
            .eq('coverageZoneId', coverageZoneId)
            .eq('isActive', true)
            .order('effectiveFrom', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) return Number(data.ratePerCollectionCents);
        }

        const { data: globalData } = await supabaseAdmin
          .from('AdpCompensationRate')
          .select('ratePerCollectionCents')
          .is('coverageZoneId', null)
          .eq('isActive', true)
          .order('effectiveFrom', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (globalData) return Number(globalData.ratePerCollectionCents);
      }
      return 0;
    }
  }

  /**
   * Configure compensation rate (Admin / Finance)
   */
  async setCompensationRate(input: SetRateInput) {
    if (input.ratePerCollectionCents <= 0) {
      throw new BadRequestError('Compensation rate must be greater than zero');
    }

    const data = {
      coverageZoneId: input.coverageZoneId || null,
      ratePerCollectionCents: BigInt(input.ratePerCollectionCents),
      isActive: true,
      effectiveFrom: new Date(),
      createdBy: input.createdBy || null,
    };

    try {
      // Deactivate older rates for this zone/global
      await prisma.adpCompensationRate.updateMany({
        where: {
          coverageZoneId: input.coverageZoneId || null,
          isActive: true,
        },
        data: { isActive: false },
      });

      const created = await prisma.adpCompensationRate.create({
        data,
      });
      return created;
    } catch (err: any) {
      logger.warn('[AdpCompensationService] Prisma setRate failed, fallback to Supabase:', err.message);
      if (!supabaseAdmin) throw new Error('Database service unavailable');

      let deactQuery = supabaseAdmin
        .from('AdpCompensationRate')
        .update({ isActive: false })
        .eq('isActive', true);

      if (input.coverageZoneId) {
        deactQuery = deactQuery.eq('coverageZoneId', input.coverageZoneId);
      } else {
        deactQuery = deactQuery.is('coverageZoneId', null);
      }
      await deactQuery;

      const { data: inserted, error } = await supabaseAdmin
        .from('AdpCompensationRate')
        .insert([{
          coverageZoneId: input.coverageZoneId || null,
          ratePerCollectionCents: input.ratePerCollectionCents,
          isActive: true,
          effectiveFrom: new Date().toISOString(),
          createdBy: input.createdBy || null,
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return inserted;
    }
  }

  /**
   * List all configured compensation rates
   */
  async listCompensationRates() {
    try {
      const rates = await prisma.adpCompensationRate.findMany({
        include: { coverageZone: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      return rates;
    } catch {
      if (!supabaseAdmin) return [];
      const { data } = await supabaseAdmin
        .from('AdpCompensationRate')
        .select('*, coverageZone:CoverageZone(*)')
        .order('effectiveFrom', { ascending: false });
      return data || [];
    }
  }

  /**
   * Generates an AdpEarning record atomically when an order is collected.
   * Guaranteed 1 earning per order by unique constraint on orderId.
   */
  async recordOrderCollectionEarning(orderId: string) {
    let order: any = null;
    try {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { adpOperator: true },
      });
    } catch {
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('Order')
          .select('*, adpOperator:AdpOperator(*)')
          .eq('id', orderId)
          .single();
        order = data;
      }
    }

    if (!order || !order.adpOperatorId) {
      return null; // Not an ADP assigned order
    }

    // Check if earning already generated for this order (idempotent)
    let existingEarning: any = null;
    try {
      existingEarning = await prisma.adpEarning.findUnique({
        where: { orderId },
      });
    } catch {
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('AdpEarning')
          .select('id')
          .eq('orderId', orderId)
          .maybeSingle();
        existingEarning = data;
      }
    }

    if (existingEarning) {
      return existingEarning; // Already recorded
    }

    const operator = order.adpOperator;
    const rateCents = await this.getActiveRateForZone(operator?.coverageZoneId);

    const earningRecord = {
      orderId,
      adpOperatorId: order.adpOperatorId,
      amountCents: BigInt(rateCents),
      rateUsedCents: BigInt(rateCents),
      coverageZoneId: operator?.coverageZoneId || null,
      status: 'PENDING',
      collectedAt: new Date(),
    };

    try {
      const created = await prisma.adpEarning.create({
        data: earningRecord,
      });
      return created;
    } catch (err: any) {
      logger.warn('[AdpCompensationService] Prisma earning create failed, trying Supabase:', err.message);
      if (!supabaseAdmin) throw new Error('Database service unavailable');
      const { data, error } = await supabaseAdmin
        .from('AdpEarning')
        .insert([{
          orderId,
          adpOperatorId: order.adpOperatorId,
          amountCents: rateCents,
          rateUsedCents: rateCents,
          coverageZoneId: operator?.coverageZoneId || null,
          status: 'PENDING',
          collectedAt: new Date().toISOString(),
        }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  /**
   * List earnings with optional filters for Finance review
   */
  async listEarnings(filters?: { operatorId?: string; status?: string }) {
    try {
      const where: any = {};
      if (filters?.operatorId) where.adpOperatorId = filters.operatorId;
      if (filters?.status) where.status = filters.status;

      const records = await prisma.adpEarning.findMany({
        where,
        include: {
          adpOperator: {
            include: { coverageZone: true },
          },
          order: true,
        },
        orderBy: { collectedAt: 'desc' },
      });
      return records;
    } catch {
      if (!supabaseAdmin) return [];
      let query = supabaseAdmin
        .from('AdpEarning')
        .select('*, adpOperator:AdpOperator(*, coverageZone:CoverageZone(*)), order:Order(*)')
        .order('collectedAt', { ascending: false });

      if (filters?.operatorId) query = query.eq('adpOperatorId', filters.operatorId);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data } = await query;
      return data || [];
    }
  }

  /**
   * Creates a Payout Batch for an operator's approved/pending earnings.
   * Atomically locks the earnings to this batch to prevent double-payouts.
   */
  async createPayoutBatch(params: {
    operatorId: string;
    earningIds: string[];
    channel?: 'TRANSACTPAY' | 'MANUAL';
    officerUserId: string;
  }) {
    if (!params.earningIds || params.earningIds.length === 0) {
      throw new BadRequestError('Must select at least one earning to create a payout batch');
    }

    const operator = await prisma.adpOperator.findUnique({
      where: { id: params.operatorId },
    });
    if (!operator) throw new NotFoundError('Operator not found');

    const earnings = await prisma.adpEarning.findMany({
      where: {
        id: { in: params.earningIds },
        adpOperatorId: params.operatorId,
        status: { in: ['PENDING', 'APPROVED'] },
        payoutBatchId: null, // Must not be already in an active batch
      },
    });

    if (earnings.length === 0) {
      throw new BadRequestError('No eligible unbatched earnings found for this operator');
    }

    const totalAmountCents = earnings.reduce(
      (sum, e) => sum + Number(e.amountCents || 0),
      0
    );

    const batchReference = `BATCH-ADP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const clientReference = `PAY-ADP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const batch = await prisma.adpPayoutBatch.create({
      data: {
        batchReference,
        clientReference,
        adpOperatorId: params.operatorId,
        totalAmountCents: BigInt(totalAmountCents),
        earningsCount: earnings.length,
        status: 'PENDING',
        channel: params.channel || 'TRANSACTPAY',
        processedBy: params.officerUserId,
      },
    });

    // Lock earnings to this batch
    await prisma.adpEarning.updateMany({
      where: { id: { in: earnings.map((e) => e.id) } },
      data: {
        payoutBatchId: batch.id,
        status: 'APPROVED',
      },
    });

    return batch;
  }

  /**
   * Executes payout via TransactPay or marks manual payout complete.
   * Core rule: Response '00' queues the payout; it is verified before marking PAID.
   */
  async executePayoutBatch(batchId: string, _officerUserId: string) {
    const batch = await prisma.adpPayoutBatch.findUnique({
      where: { id: batchId },
      include: { adpOperator: true },
    });

    if (!batch) throw new NotFoundError('Payout batch not found');
    if (batch.status === 'SUCCESSFUL') {
      throw new BadRequestError('This payout batch is already completed');
    }

    const operator = batch.adpOperator;
    const amountNaira = Number(batch.totalAmountCents) / 100;

    if (batch.channel === 'MANUAL') {
      // Manual bank transfer recorded by Finance
      await prisma.adpPayoutBatch.update({
        where: { id: batchId },
        data: {
          status: 'SUCCESSFUL',
          paidAt: new Date(),
        },
      });

      await prisma.adpEarning.updateMany({
        where: { payoutBatchId: batchId },
        data: { status: 'PAID' },
      });

      return {
        status: 'success',
        message: 'Manual payout confirmed successfully',
      };
    }

    // Automated TransactPay Payout
    const decryptedAccount = decryptSensitiveData(operator.accountNumberEncrypted);

    try {
      const tpRes = await transactPayService.initiatePayout({
        clientReference: batch.clientReference || `PAY-${batch.id.slice(0, 8)}`,
        accountNumber: decryptedAccount,
        bankCode: operator.bankCode,
        amountNaira,
        description: `Affy Delivery Port Collection Earnings: ${operator.hostelName}`,
        accountName: operator.accountName,
      });

      // Update payment reference
      const ref = tpRes.providerReference || tpRes.batchReference || tpRes.clientReference;
      await prisma.adpPayoutBatch.update({
        where: { id: batchId },
        data: {
          paymentReference: ref,
          status: tpRes.status === 'SUCCESSFUL' ? 'SUCCESSFUL' : 'PENDING',
          paidAt: tpRes.status === 'SUCCESSFUL' ? new Date() : null,
        },
      });

      if (tpRes.status === 'SUCCESSFUL') {
        await prisma.adpEarning.updateMany({
          where: { payoutBatchId: batchId },
          data: { status: 'PAID' },
        });
      }

      return {
        status: 'success',
        message: `Payout initiated with TransactPay (Ref: ${ref})`,
        batchStatus: tpRes.status,
      };
    } catch (err: any) {
      logger.error('[AdpCompensationService] TransactPay payout error:', err);
      // If initiation fails, release earnings back to APPROVED for retry
      await prisma.adpPayoutBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED' },
      });

      await prisma.adpEarning.updateMany({
        where: { payoutBatchId: batchId },
        data: { status: 'APPROVED' },
      });

      throw new BadRequestError(`TransactPay payout failed: ${err.message || 'Payment provider error'}`);
    }
  }
}

export const adpCompensationService = new AdpCompensationService();
