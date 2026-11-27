// backend/src/__tests__/adp-compensation.test.ts
import { adpCompensationService } from '../services/adpCompensation.service';
import prisma from '../prisma/client';

jest.mock('../prisma/client', () => ({
  adpCompensationRate: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  adpEarning: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  adpPayoutBatch: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adpOperator: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../services/supabase-admin.service', () => ({
  supabaseAdmin: null,
}));

describe('ADP Compensation, Earnings & Payout Suite (Milestone 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Dynamic Compensation Rate Resolution', () => {
    it('should return zone-specific rate when available', async () => {
      (prisma.adpCompensationRate.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'rate-zone-1',
        coverageZoneId: 'zone-nnpc',
        ratePerCollectionCents: BigInt(50000), // ₦500 per collection
        isActive: true,
      });

      const rate = await adpCompensationService.getActiveRateForZone('zone-nnpc');
      expect(rate).toBe(50000);
      expect(prisma.adpCompensationRate.findFirst).toHaveBeenCalledWith({
        where: { coverageZoneId: 'zone-nnpc', isActive: true },
        orderBy: { effectiveFrom: 'desc' },
      });
    });

    it('should fall back to global rate when zone has no specific rate', async () => {
      // Zone rate not found
      (prisma.adpCompensationRate.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        // Global rate found
        .mockResolvedValueOnce({
          id: 'rate-global',
          coverageZoneId: null,
          ratePerCollectionCents: BigInt(35000), // ₦350 fallback
          isActive: true,
        });

      const rate = await adpCompensationService.getActiveRateForZone('zone-ibodi');
      expect(rate).toBe(35000);
    });

    it('should return 0 when no rates are configured in database', async () => {
      (prisma.adpCompensationRate.findFirst as jest.Mock).mockResolvedValue(null);
      const rate = await adpCompensationService.getActiveRateForZone('zone-none');
      expect(rate).toBe(0);
    });

    it('should reject rate less than or equal to zero', async () => {
      await expect(
        adpCompensationService.setCompensationRate({
          ratePerCollectionCents: 0,
        })
      ).rejects.toThrow(/greater than zero/i);
    });
  });

  describe('2. Atomic Earnings Generation on Order Collection', () => {
    it('should generate an earning record for an assigned order collection', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'ord-123',
        adpOperatorId: 'op-456',
        adpOperator: {
          id: 'op-456',
          coverageZoneId: 'zone-nnpc',
        },
      });

      (prisma.adpEarning.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock rate lookup
      (prisma.adpCompensationRate.findFirst as jest.Mock).mockResolvedValue({
        ratePerCollectionCents: BigInt(40000),
      });

      (prisma.adpEarning.create as jest.Mock).mockResolvedValue({
        id: 'earn-1',
        orderId: 'ord-123',
        adpOperatorId: 'op-456',
        amountCents: BigInt(40000),
        status: 'PENDING',
      });

      const earning = await adpCompensationService.recordOrderCollectionEarning('ord-123');
      expect(earning).toBeDefined();
      expect(prisma.adpEarning.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'ord-123',
          adpOperatorId: 'op-456',
          amountCents: BigInt(40000),
          status: 'PENDING',
        }),
      });
    });

    it('should be idempotent and not duplicate earnings for the same order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'ord-123',
        adpOperatorId: 'op-456',
      });

      (prisma.adpEarning.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-earn',
        orderId: 'ord-123',
        amountCents: BigInt(40000),
      });

      const earning = await adpCompensationService.recordOrderCollectionEarning('ord-123');
      expect(earning.id).toBe('existing-earn');
      expect(prisma.adpEarning.create).not.toHaveBeenCalled();
    });
  });

  describe('3. Payout Batch Creation & Locking', () => {
    it('should create a payout batch and lock earnings to prevent double-payouts', async () => {
      (prisma.adpOperator.findUnique as jest.Mock).mockResolvedValue({
        id: 'op-1',
        fullName: 'Bolu Adeleke',
      });

      (prisma.adpEarning.findMany as jest.Mock).mockResolvedValue([
        { id: 'earn-1', amountCents: BigInt(40000) },
        { id: 'earn-2', amountCents: BigInt(40000) },
      ]);

      (prisma.adpPayoutBatch.create as jest.Mock).mockResolvedValue({
        id: 'batch-uuid-1',
        batchReference: 'BATCH-ADP-TEST',
        totalAmountCents: BigInt(80000),
        status: 'PENDING',
      });

      const batch = await adpCompensationService.createPayoutBatch({
        operatorId: 'op-1',
        earningIds: ['earn-1', 'earn-2'],
        officerUserId: 'finance-staff-1',
      });

      expect(batch).toBeDefined();
      expect(batch.id).toBe('batch-uuid-1');
      expect(prisma.adpEarning.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['earn-1', 'earn-2'] } },
        data: {
          payoutBatchId: 'batch-uuid-1',
          status: 'APPROVED',
        },
      });
    });
  });
});
