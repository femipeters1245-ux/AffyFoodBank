/**
 * Unit Tests for FundingService (Permanent Virtual Accounts & Funding Pipeline)
 *
 * Covers:
 *  - recordFundingEvent: extraction, deduplication, durable storage
 *  - verifyAndProcessFundingEvent:
 *      * ALREADY_CREDITED early exit
 *      * TransactPay provider verification failure handling
 *      * Non-successful status handling
 *      * Currency mismatch rejection (NGN only)
 *      * Zero/negative amount rejection
 *      * Unmatched VA without guessing
 *      * Exactly-once atomic ledger crediting
 */

jest.mock('../services/transactpay.service', () => ({
  transactPayService: {
    verifyFundingDetails: jest.fn(),
  },
}));

jest.mock('../services/virtual-account.store', () => ({
  virtualAccountStore: {
    getByAccountOrReference: jest.fn(),
  },
}));

jest.mock('../services/supabase-admin.service', () => ({
  supabaseAdmin: null,
  isSupabaseAdminConfigured: false,
}));

const mockPrismaTx = {
  walletFundingEvent: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  walletTransaction: {
    create: jest.fn(),
  },
};

jest.mock('../prisma/client', () => ({
  default: {
    walletFundingEvent: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaTx)),
  },
  __esModule: true,
}));

import { fundingService } from '../services/funding.service';
import { transactPayService } from '../services/transactpay.service';
import { virtualAccountStore } from '../services/virtual-account.store';
import prisma from '../prisma/client';

describe('[UNIT] fundingService.recordFundingEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws an error if sessionId is missing from payload', async () => {
    await expect(fundingService.recordFundingEvent({})).rejects.toThrow(
      'Missing required sessionId in webhook payload'
    );
  });

  it('records a new funding event durably in Prisma', async () => {
    (prisma.walletFundingEvent.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.walletFundingEvent.create as jest.Mock).mockResolvedValueOnce({});

    const payload = {
      sessionId: 'sess_12345',
      paymentReference: 'PAY_REF_999',
      accountReference: 'AFFY-WLT-user1',
      totalAmountCharged: 5000,
      fee: 50,
      orderPayments: [{ orderPaymentInstrument: '9988776655' }],
    };

    const res = await fundingService.recordFundingEvent(payload);

    expect(res.sessionId).toBe('sess_12345');
    expect(res.isDuplicate).toBe(false);
    expect(prisma.walletFundingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess_12345',
          paymentReference: 'PAY_REF_999',
          accountReference: 'AFFY-WLT-user1',
          destinationAccountNumber: '9988776655',
          status: 'RECEIVED',
          grossAmountCents: BigInt(500000),
          feeCents: BigInt(5000),
          netAmountCents: BigInt(495000),
        }),
      })
    );
  });

  it('detects existing event and returns isDuplicate: true without inserting again', async () => {
    (prisma.walletFundingEvent.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'existing_evt_id',
      sessionId: 'sess_duplicate',
      status: 'RECEIVED',
    });

    const res = await fundingService.recordFundingEvent({
      sessionId: 'sess_duplicate',
      paymentReference: 'PAY_DUP',
    });

    expect(res.isDuplicate).toBe(true);
    expect(res.eventId).toBe('existing_evt_id');
    expect(prisma.walletFundingEvent.create).not.toHaveBeenCalled();
  });
});

describe('[UNIT] fundingService.verifyAndProcessFundingEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips verification if event is already CREDITED (idempotent)', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_credited',
      status: 'CREDITED',
      customerProfileId: 'cust_profile_1',
      netAmountCents: BigInt(500000),
      paymentReference: 'PAY_DONE',
    });

    const res = await fundingService.verifyAndProcessFundingEvent('sess_credited');

    expect(res.status).toBe('ALREADY_CREDITED');
    expect(transactPayService.verifyFundingDetails).not.toHaveBeenCalled();
  });

  it('marks FAILED when TransactPay verification API call fails', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_fail',
      status: 'RECEIVED',
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockRejectedValueOnce(
      new Error('Connection timeout')
    );

    const res = await fundingService.verifyAndProcessFundingEvent('sess_fail');

    expect(res.status).toBe('FAILED');
    expect(res.message).toContain('Provider verification unreachable');
  });

  it('marks FAILED when TransactPay reports non-successful status (statusId != 5)', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_pending',
      status: 'RECEIVED',
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockResolvedValueOnce({
      statusId: 1, // Pending, not Successful
      status: 'Pending',
      currencyName: 'NGN',
      amountCents: 500000,
      totalAmountCharged: 5000,
      raw: {},
    });

    const res = await fundingService.verifyAndProcessFundingEvent('sess_pending');

    expect(res.status).toBe('FAILED');
    expect(res.message).toContain('Provider reported non-successful status');
  });

  it('marks REJECTED when currency is not NGN', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_currency_err',
      status: 'RECEIVED',
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockResolvedValueOnce({
      statusId: 5,
      status: 'Successful',
      currencyName: 'USD', // Invalid currency
      amountCents: 500000,
      totalAmountCharged: 5000,
      raw: {},
    });

    const res = await fundingService.verifyAndProcessFundingEvent('sess_currency_err');

    expect(res.status).toBe('REJECTED');
    expect(res.message).toContain('Currency mismatch');
  });

  it('marks REJECTED when amountCents is zero or negative', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_zero_amt',
      status: 'RECEIVED',
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockResolvedValueOnce({
      statusId: 5,
      status: 'Successful',
      currencyName: 'NGN',
      amountCents: 0,
      totalAmountCharged: 0,
      raw: {},
    });

    const res = await fundingService.verifyAndProcessFundingEvent('sess_zero_amt');

    expect(res.status).toBe('REJECTED');
    expect(res.message).toContain('Invalid verified amount');
  });

  it('marks UNMATCHED without crediting when account cannot be resolved', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_unknown_va',
      status: 'RECEIVED',
      destinationAccountNumber: '0000000000',
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockResolvedValueOnce({
      statusId: 5,
      status: 'Successful',
      currencyName: 'NGN',
      amountCents: 1000000,
      totalAmountCharged: 10000,
      accountReference: 'UNKNOWN_REF',
      orderPayments: [{ orderPaymentInstrument: '0000000000' }],
      raw: {},
    });
    (virtualAccountStore.getByAccountOrReference as jest.Mock).mockResolvedValue(null);

    const res = await fundingService.verifyAndProcessFundingEvent('sess_unknown_va');

    expect(res.status).toBe('UNMATCHED');
    expect(res.message).toContain('UNMATCHED: No virtual account found');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('atomically credits wallet and records ledger entry when fully verified and matched', async () => {
    (prisma.walletFundingEvent.findUnique as jest.Mock).mockResolvedValueOnce({
      sessionId: 'sess_valid',
      status: 'RECEIVED',
      destinationAccountNumber: '1234567890',
      accountReference: 'AFFY-WLT-cp1',
      feeCents: BigInt(5000),
    });
    (transactPayService.verifyFundingDetails as jest.Mock).mockResolvedValueOnce({
      statusId: 5,
      status: 'Successful',
      currencyName: 'NGN',
      amountCents: 500000, // ₦5,000
      totalAmountCharged: 5000,
      paymentReference: 'PAY_VERIFIED_123',
      accountReference: 'AFFY-WLT-cp1',
      orderPayments: [{ orderPaymentInstrument: '1234567890' }],
      raw: {},
    });
    (virtualAccountStore.getByAccountOrReference as jest.Mock).mockResolvedValue({
      id: 'va_row_1',
      customerProfileId: 'cp_123',
      accountNumber: '1234567890',
      accountReference: 'AFFY-WLT-cp1',
    });

    mockPrismaTx.walletFundingEvent.findUnique.mockResolvedValueOnce({
      sessionId: 'sess_valid',
      status: 'VERIFYING',
    });
    mockPrismaTx.wallet.findUnique.mockResolvedValueOnce({
      id: 'w_123',
      customerProfileId: 'cp_123',
      totalBalanceCents: BigInt(100000),
    });

    const res = await fundingService.verifyAndProcessFundingEvent('sess_valid');

    expect(res.status).toBe('CREDITED');
    expect(res.customerProfileId).toBe('cp_123');
    expect(res.amountCents).toBe(500000);

    // Verify wallet balance incremented
    expect(mockPrismaTx.wallet.update).toHaveBeenCalledWith({
      where: { customerProfileId: 'cp_123' },
      data: {
        totalBalanceCents: { increment: BigInt(500000) },
      },
    });

    // Verify deposit transaction ledger created
    expect(mockPrismaTx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: 'w_123',
          customerId: 'cp_123',
          type: 'DEPOSIT',
          status: 'SUCCESSFUL',
          providerSessionId: 'sess_valid',
          amountCents: BigInt(500000),
          grossAmountCents: BigInt(500000),
          feeCents: BigInt(5000),
        }),
      })
    );

    // Verify event status updated to CREDITED
    expect(mockPrismaTx.walletFundingEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: 'sess_valid' },
        data: expect.objectContaining({
          status: 'CREDITED',
          customerProfileId: 'cp_123',
        }),
      })
    );
  });
});
