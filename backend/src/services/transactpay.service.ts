// backend/src/services/transactpay.service.ts
import crypto from 'crypto';
import logger from '../utils/logger';

const TRANSACTPAY_BASE_URL = process.env.TRANSACTPAY_BASE_URL || 'https://payment-api-service.transactpay.ai';

export interface VirtualAccountResult {
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountReference: string;
  alias?: string;
  currency?: string;
  status?: string;
  raw?: any;
}

export interface FundingDetailsResult {
  sessionId: string;
  paymentReference: string;
  totalAmountCharged: number; // In Naira as returned by provider
  amountCents: number; // Computed in cents
  currencyName: string;
  status: string;
  statusId: number;
  datePaymentConfirmed?: string;
  accountReference?: string;
  sourceAccountName?: string;
  productName?: string;
  raw?: any;
}

export interface NameEnquiryResult {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  responseCode: string;
  status: string;
  message?: string;
}

export interface PayoutInitiationResult {
  clientReference: string;
  providerReference?: string;
  batchReference?: string;
  statusCode: string;
  status: string;
  message: string;
  raw?: any;
}

export interface PayoutRequeryResult {
  clientReference: string;
  providerReference?: string;
  amount: number;
  amountCents: number;
  status: 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'REVERSED';
  responseCode: string;
  responseMessage: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  raw?: any;
}

/**
 * Encrypt payload using TransactPay's 4096-bit RSA XML Public Key with RSA PKCS#1 v1.5 padding
 * Reference: https://transactpay.readme.io/reference/encryption.md
 */
export function encryptTransactPayPayload(payloadObj: object, encKeyBase64?: string): string {
  const encKey = encKeyBase64 || process.env.TRANSACTPAY_ENCRYPTION_KEY;
  if (!encKey) {
    throw new Error('TRANSACTPAY_ENCRYPTION_KEY environment variable is not configured');
  }

  const xml = Buffer.from(encKey, 'base64').toString('utf8');
  const modulusMatch = xml.match(/<Modulus>([^<]+)<\/Modulus>/);
  const exponentMatch = xml.match(/<Exponent>([^<]+)<\/Exponent>/);

  if (!modulusMatch || !exponentMatch) {
    throw new Error('Invalid TransactPay encryption key format: Modulus or Exponent not found in XML key');
  }

  // Convert Base64 to Base64URL for JWK format
  const n = modulusMatch[1].replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const e = exponentMatch[1].replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const publicKey = crypto.createPublicKey({
    key: { kty: 'RSA', n, e },
    format: 'jwk',
  });

  const payloadStr = JSON.stringify(payloadObj);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(payloadStr, 'utf8')
  );

  return encrypted.toString('base64');
}

/**
 * TransactPay Provider Integration Service
 * Strictly adheres to https://transactpay.readme.io/
 */
export const transactPayService = {
  /**
   * 1. Generate Virtual Account for customer funding
   * Endpoint: POST /payment/virtual-account/generate
   * Encrypted payload with RSA PKCS#1 v1.5
   */
  async generateVirtualAccount(params: {
    alias: string;
    narration?: string;
    reference?: string;
  }): Promise<VirtualAccountResult> {
    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('TRANSACTPAY_PUBLIC_KEY is not configured');
    }

    const payload = {
      Alias: params.alias,
      Narration: params.narration || 'Affy FoodBank Wallet Funding',
      Reference: params.reference || `VA_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    };

    const encryptedData = encryptTransactPayPayload(payload);

    logger.info('[TransactPay] Calling /payment/virtual-account/generate for alias:', { alias: params.alias });

    const response = await fetch(`${TRANSACTPAY_BASE_URL}/payment/virtual-account/generate`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': publicKey,
        'encryption': 'RSA',
      },
      body: JSON.stringify({ data: encryptedData }),
    });

    const resJson: any = await response.json();
    logger.info('[TransactPay VA] Response status code:', {
      status: response.status,
      statusCode: resJson.statusCode,
      statusDescription: resJson.statusDescription,
    });

    const data = resJson.data || resJson;

    if (
      resJson.statusCode === '00' ||
      resJson.status === 'success' ||
      resJson.status === true ||
      data?.accountNumber ||
      data?.account_number
    ) {
      return {
        accountNumber: data.accountNumber || data.account_number,
        bankName: data.bankName || data.bank_name || data.bank || 'Wema Bank (TransactPay)',
        bankCode: data.bankCode || data.bank_code,
        accountName: data.accountName || data.account_name || `Affy / ${params.alias}`,
        accountReference: data.accountReference || data.account_reference || payload.Reference,
        alias: data.alias || params.alias,
        currency: data.currency || 'NGN',
        status: 'ACTIVE',
        raw: data,
      };
    }

    throw new Error(
      resJson.statusDescription || resJson.message || `Virtual account generation rejected by provider (code ${resJson.statusCode})`
    );
  },

  /**
   * 2. Get Virtual Account Details with Alias
   * Endpoint: GET /payment/account-details?alias={alias}
   * Used to check whether TransactPay already generated a virtual account for this alias
   * before making an unnecessary generate call or recovering from earlier save failure.
   */
  async getAccountDetailsByAlias(alias: string): Promise<VirtualAccountResult | null> {
    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('TRANSACTPAY_PUBLIC_KEY is not configured');
    }

    if (!alias || !alias.trim()) {
      return null;
    }

    const cleanAlias = alias.trim();
    logger.info('[TransactPay] Querying account details by alias:', { alias: cleanAlias });

    try {
      const response = await fetch(
        `${TRANSACTPAY_BASE_URL}/payment/account-details?alias=${encodeURIComponent(cleanAlias)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'api-key': publicKey,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        logger.warn('[TransactPay Alias Lookup] Non-200 response:', { status: response.status });
        return null;
      }

      const resJson: any = await response.json();
      const data = resJson.data || resJson;

      if (
        (resJson.code === '00' || resJson.status === true || resJson.status === 'success') &&
        (data?.accountNumber || data?.account_number)
      ) {
        return {
          accountNumber: data.accountNumber || data.account_number,
          bankName: data.bankName || data.bank_name || data.bank || 'Wema Bank (TransactPay)',
          bankCode: data.bankCode || data.bank_code,
          accountName: data.accountName || data.account_name || `Affy / ${cleanAlias}`,
          accountReference: data.accountReference || data.account_reference || `VA_${cleanAlias}`,
          alias: data.alias || cleanAlias,
          currency: data.currency || 'NGN',
          status: 'ACTIVE',
          raw: data,
        };
      }

      return null;
    } catch (err: any) {
      logger.warn('[TransactPay Alias Lookup] Failed with error:', { message: err.message });
      return null;
    }
  },

  /**
   * 2. Funding Details Verification
   * Endpoint: GET /payment/transaction-details/{sessionId}
   * Independent API re-verification of bank transfer deposits
   */
  async verifyFundingDetails(sessionId: string): Promise<FundingDetailsResult> {
    const authKey = process.env.TRANSACTPAY_SECRET_KEY || process.env.TRANSACTPAY_API_KEY || process.env.TRANSACTPAY_PUBLIC_KEY;
    if (!authKey) {
      throw new Error('TransactPay API authentication key is not configured');
    }

    if (!sessionId || !sessionId.trim()) {
      throw new Error('Valid sessionId is required for funding verification');
    }

    logger.info('[TransactPay] Verifying funding details for sessionId:', { sessionId });

    const response = await fetch(`${TRANSACTPAY_BASE_URL}/payment/transaction-details/${encodeURIComponent(sessionId.trim())}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': authKey,
      },
    });

    const resJson: any = await response.json();
    logger.info('[TransactPay Funding Verify] Response status:', {
      status: response.status,
      statusCode: resJson.statusCode,
      statusStr: resJson.status,
    });

    const data = resJson.data || resJson;
    const amountNum = Number(data.totalAmountCharged || data.amount || 0);

    return {
      sessionId: data.sessionId || sessionId,
      paymentReference: data.paymentReference || data.reference || '',
      totalAmountCharged: amountNum,
      amountCents: Math.round(amountNum * 100),
      currencyName: (data.currencyName || data.currency || 'NGN').toUpperCase(),
      status: (data.status || (data.statusId === 5 ? 'Successful' : 'Pending')).toString(),
      statusId: Number(data.statusId || (data.status?.toLowerCase() === 'successful' ? 5 : 1)),
      datePaymentConfirmed: data.datePaymentConfirmed || data.updatedAt,
      accountReference: data.accountReference || data.account_reference,
      sourceAccountName: data.sourceAccountName || data.source_account_name,
      productName: data.productName,
      raw: resJson,
    };
  },

  /**
   * 3. Name Enquiry (Verify beneficiary account before payout)
   * Endpoint: POST /payout/name-enquiry
   * Payload encrypted with RSA PKCS#1 v1.5
   */
  async nameEnquiry(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<NameEnquiryResult> {
    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('TRANSACTPAY_PUBLIC_KEY is not configured');
    }

    const payload = {
      accountNumber: params.accountNumber.trim(),
      bankCode: params.bankCode.trim(),
    };

    const encryptedData = encryptTransactPayPayload(payload);

    const response = await fetch(`${TRANSACTPAY_BASE_URL}/payout/name-enquiry`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': publicKey,
        'encryption': 'RSA',
      },
      body: JSON.stringify({ data: encryptedData }),
    });

    const resJson: any = await response.json();
    logger.info('[TransactPay Name Enquiry] Response:', {
      statusCode: resJson.statusCode,
      status: resJson.status,
    });

    const data = resJson.data || resJson;

    if (
      resJson.statusCode === '00' ||
      resJson.status === 'success' ||
      data?.accountName ||
      data?.account_name
    ) {
      return {
        accountName: data.accountName || data.account_name,
        accountNumber: params.accountNumber,
        bankCode: params.bankCode,
        responseCode: resJson.statusCode || '00',
        status: 'SUCCESSFUL',
      };
    }

    throw new Error(
      resJson.statusDescription || resJson.message || 'Beneficiary account verification failed. Check account number and bank.'
    );
  },

  /**
   * 4. Initiate Payout (Outbound withdrawal)
   * Endpoint: POST /payout/initiate
   * Payload encrypted with RSA PKCS#1 v1.5
   * Note: '00' response means LOGGED for processing, NOT final payment.
   */
  async initiatePayout(params: {
    clientReference: string;
    accountNumber: string;
    bankCode: string;
    amountNaira: number;
    description: string;
    accountName: string;
  }): Promise<PayoutInitiationResult> {
    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('TRANSACTPAY_PUBLIC_KEY is not configured');
    }

    const payload = {
      payoutDetails: [
        {
          clientReference: params.clientReference,
          accountNumber: params.accountNumber.trim(),
          bankCode: params.bankCode.trim(),
          amount: Number(params.amountNaira),
          description: params.description,
          accountName: params.accountName.trim(),
          creditCurrency: 'NGN',
          debitCurrency: 'NGN',
        },
      ],
    };

    const encryptedData = encryptTransactPayPayload(payload);

    logger.info('[TransactPay Payout] Initiating payout for clientReference:', {
      clientReference: params.clientReference,
      amountNaira: params.amountNaira,
    });

    const response = await fetch(`${TRANSACTPAY_BASE_URL}/payout/initiate`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': publicKey,
        'encryption': 'RSA',
      },
      body: JSON.stringify({ data: encryptedData }),
    });

    const resJson: any = await response.json();
    logger.info('[TransactPay Payout Initiate] Response:', {
      statusCode: resJson.statusCode,
      status: resJson.status,
      message: resJson.statusDescription || resJson.message,
    });

    const isAccepted = resJson.statusCode === '00' || resJson.status === 'success';

    return {
      clientReference: params.clientReference,
      providerReference: resJson.data?.providerReference || resJson.providerReference,
      batchReference: resJson.data?.batchReference || resJson.batchReference,
      statusCode: resJson.statusCode || (isAccepted ? '00' : '99'),
      status: isAccepted ? 'ACCEPTED' : 'REJECTED',
      message: resJson.statusDescription || resJson.message || (isAccepted ? 'Payout accepted for processing' : 'Payout initiation rejected'),
      raw: resJson,
    };
  },

  /**
   * 5. Requery Payout Status
   * Endpoint: GET /payout/requery?clientReference=...
   * Auth: api-key: SECRET_KEY
   */
  async requeryPayout(clientReference: string): Promise<PayoutRequeryResult> {
    const secretKey = process.env.TRANSACTPAY_SECRET_KEY || process.env.TRANSACTPAY_API_KEY;
    if (!secretKey) {
      throw new Error('TRANSACTPAY_SECRET_KEY is required for payout requery');
    }

    logger.info('[TransactPay Requery] Querying payout status for:', { clientReference });

    const response = await fetch(
      `${TRANSACTPAY_BASE_URL}/payout/requery?clientReference=${encodeURIComponent(clientReference.trim())}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': secretKey,
        },
      }
    );

    const resJson: any = await response.json();
    logger.info('[TransactPay Requery] Response payload:', {
      statusCode: resJson.statusCode,
      status: resJson.status,
      statusDescription: resJson.statusDescription,
    });

    const data = resJson.data || resJson;
    const rawStatus = (data.status || resJson.status || '').toUpperCase();
    const statusCode = (resJson.statusCode || data.statusCode || data.responseCode || '').toString();

    let normalizedStatus: 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'REVERSED' = 'PENDING';

    if (rawStatus === 'SUCCESSFUL' || rawStatus === 'SUCCESS' || statusCode === '00') {
      normalizedStatus = 'SUCCESSFUL';
    } else if (
      rawStatus === 'FAILED' ||
      rawStatus === 'REJECTED' ||
      statusCode === '03' ||
      statusCode === '05' ||
      statusCode === '99'
    ) {
      normalizedStatus = 'FAILED';
    } else if (rawStatus === 'REVERSED') {
      normalizedStatus = 'REVERSED';
    } else {
      normalizedStatus = 'PENDING';
    }

    const amountNum = Number(data.amount || data.totalAmount || 0);

    return {
      clientReference,
      providerReference: data.payoutReference || data.providerReference,
      amount: amountNum,
      amountCents: Math.round(amountNum * 100),
      status: normalizedStatus,
      responseCode: statusCode,
      responseMessage: resJson.statusDescription || resJson.message || data.message || '',
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      bankCode: data.bankCode,
      raw: resJson,
    };
  },
};
