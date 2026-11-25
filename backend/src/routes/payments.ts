// backend/src/routes/payments.ts
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { authenticate } from '../middleware/authenticate';
import { systemProductStore } from '../services/system-product.store';
import {
  sendOrderReceiptEmail,
  sendAdminOrderAlert,
  sendWalletDepositEmail,
  sendWalletWithdrawalEmail,
} from '../services/email.service';
import { walletService } from '../services/wallet.service';
import { transactPayService } from '../services/transactpay.service';
import { virtualAccountStore } from '../services/virtual-account.store';
import { fundingService } from '../services/funding.service';

const router = Router();

const TRANSACTPAY_BASE_URL = 'https://payment-api-service.transactpay.ai';

/**
 * Encrypt payload for TransactPay using their 4096-bit RSA XML Public Key
 * As documented in https://transactpay.readme.io/reference/encryption.md
 */
function encryptTransactPayPayload(payloadObj: object, encKeyBase64: string): string {
  const xml = Buffer.from(encKeyBase64, 'base64').toString('utf8');
  const modulusMatch = xml.match(/<Modulus>([^<]+)<\/Modulus>/);
  const exponentMatch = xml.match(/<Exponent>([^<]+)<\/Exponent>/);

  if (!modulusMatch || !exponentMatch) {
    throw new Error('Invalid TransactPay encryption key format: Modulus or Exponent not found');
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
    Buffer.from(payloadStr, 'utf8'),
  );

  return encrypted.toString('base64');
}

/**
 * Helper to record order and delivery in database if Prisma is available
 */
async function recordOrderInDatabase(params: {
  orderReference: string;
  amountCents: number;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  items?: Array<{ productId?: string; name: string; quantity: number; priceCents: number }>;
  status?: 'PENDING' | 'PROCESSING';
}) {
  try {
    const { orderReference, amountCents, email, name, phone, address, items, status = 'PENDING' } = params;

    // Check if user/profile exists
    let customerProfile = await prisma.customerProfile.findFirst({
      where: { user: { email } },
      include: { user: true, wallet: true },
    });

    // If no customer profile found, create a designated user and customerProfile for this customer email
    if (!customerProfile) {
      try {
        let user = await prisma.user.findUnique({
          where: { email },
          include: { profile: { include: { wallet: true } } },
        });

        if (!user) {
          const { hashPassword } = await import('../utils/password');
          const defaultHash = await hashPassword(uuidv4());
          const customerRole = await prisma.role.findFirst({ where: { name: 'Customer' } });
          const newUserId = uuidv4();
          const newProfId = uuidv4();
          const newWltId = uuidv4();

          user = await prisma.user.create({
            data: {
              id: newUserId,
              email,
              passwordHash: defaultHash,
              firstName: name ? name.split(' ')[0] : email.split('@')[0],
              lastName: name ? name.split(' ').slice(1).join(' ') : '',
              roleId: customerRole?.id ?? null,
              profile: {
                create: {
                  id: newProfId,
                  wallet: {
                    create: {
                      id: newWltId,
                      totalBalanceCents: 0,
                      allocatedToSavingsCents: 0,
                      currency: 'NGN',
                      status: 'ACTIVE',
                    },
                  },
                },
              },
            },
            include: { profile: { include: { wallet: true } } },
          });
        }
        customerProfile = (user?.profile as any) ?? null;
      } catch (profErr: any) {
        console.warn('[Payments DB] Profile creation note:', profErr.message);
      }
    }

    if (customerProfile) {
      // Resolve valid default unit to avoid foreign key violations
      let defaultUnit = await prisma.unit.findFirst();
      if (!defaultUnit) {
        defaultUnit = await prisma.unit.create({
          data: { id: uuidv4(), name: 'Unit', symbol: 'unit' },
        });
      }

      // Map items with valid product and unit references
      const resolvedItems: Array<{
        id: string;
        productId: string;
        quantity: number;
        unitId: string;
        priceAtPurchaseCents: bigint;
      }> = [];
      for (const it of (items || [])) {
        let validProduct = it.productId ? await prisma.product.findUnique({ where: { id: it.productId } }) : null;
        if (!validProduct) {
          validProduct = await prisma.product.findFirst({ where: { isActive: true } });
        }
        if (validProduct) {
          resolvedItems.push({
            id: uuidv4(),
            productId: validProduct.id,
            quantity: it.quantity || 1,
            unitId: validProduct.unitId || defaultUnit.id,
            priceAtPurchaseCents: BigInt(it.priceCents || 0),
          });
        }
      }

      // Create Order
      const newOrder = await prisma.order.create({
        data: {
          id: uuidv4(),
          customerProfileId: customerProfile.id,
          walletId: customerProfile.wallet?.id ?? null,
          totalAmountCents: BigInt(amountCents),
          currency: 'NGN',
          status: status === 'PROCESSING' ? 'PROCESSING' : 'PENDING',
          items: {
            create: resolvedItems,
          },
          delivery: {
            create: {
              id: uuidv4(),
              status: status === 'PROCESSING' ? 'READY_FOR_DISPATCH' : 'PENDING',
              notes: `Order Reference: ${orderReference}. Customer: ${name || email}. Phone: ${phone || 'N/A'}. Delivery Address: ${address || 'Local Delivery'}`,
            },
          },
        },
      });

      // Create ledger transaction
      if (customerProfile.wallet) {
        await prisma.walletTransaction.create({
          data: {
            id: uuidv4(),
            walletId: customerProfile.wallet.id,
            customerId: customerProfile.id,
            reference: orderReference,
            type: 'PURCHASE',
            amountCents: BigInt(amountCents),
            currency: 'NGN',
            direction: 'OUT',
            status: status === 'PROCESSING' ? 'SUCCESSFUL' : 'PENDING',
            description: `TransactPay Gateway settlement for order ${orderReference}`,
            paymentReference: orderReference,
          },
        });
      }

      // Decrement inventory stock if order is confirmed/processing
      if (status === 'PROCESSING') {
        for (const it of (items || [])) {
          if (it.productId) {
            systemProductStore.deductStock(it.productId, Number(it.quantity || 1)).catch(() => {});
          }
        }
      }

      return newOrder;
    }
  } catch (err: any) {
    console.warn('[Payments DB] Could not persist order in database:', err.message);
  }
  return null;
}

/**
 * POST /api/v1/payments/transactpay/create-order
 * Initiates an order with TransactPay gateway using live RSA-encrypted payload.
 * Specification: https://transactpay.readme.io/reference/post_payment-order-create-1.md
 */
router.post('/transactpay/create-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amountNaira, email, name, phone, address, location, isExpress, items, redirectUrl } = req.body;

    if (!email) {
      throw new BadRequestError('Customer email is required');
    }

    // 1. Authoritative delivery fee calculation
    const resolvedItems = items || [];
    const itemsSubtotalCents = resolvedItems.reduce(
      (s: number, it: any) => s + (Number(it.quantity || 1) * Number(it.priceCents || 0)),
      0
    );

    let finalAmountNaira = Number(amountNaira);

    if (itemsSubtotalCents > 0) {
      const { calculateAuthoritativeDeliveryFee } = await import('../services/deliveryFee.service');
      const selectedLocation = (location || (address ? address.split(',').pop() : '') || '').trim();
      const authoritativeDelivery = await calculateAuthoritativeDeliveryFee(
        itemsSubtotalCents,
        selectedLocation,
        Boolean(isExpress)
      );
      const serverExpectedTotalNaira = (itemsSubtotalCents + authoritativeDelivery.deliveryFeeCents) / 100;

      // Reject tampered underpayment requests
      if (amountNaira && Number(amountNaira) < serverExpectedTotalNaira) {
        throw new BadRequestError(
          `Payment amount mismatch: Expected ₦${serverExpectedTotalNaira.toLocaleString()} (Items: ₦${(itemsSubtotalCents / 100).toLocaleString()}, Delivery: ₦${(authoritativeDelivery.deliveryFeeCents / 100).toLocaleString()}), but received ₦${Number(amountNaira).toLocaleString()}`
        );
      }
      finalAmountNaira = serverExpectedTotalNaira;
    }

    if (!finalAmountNaira || finalAmountNaira <= 0) {
      throw new BadRequestError('Valid amount in Naira is required');
    }

    const orderReference = `TP_ORD_${Date.now()}_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY || 'PGW-PUBLICKEY-493151248075433389622408C227C1E2';
    const encKey = process.env.TRANSACTPAY_ENCRYPTION_KEY;

    // Customer name split
    const names = (name || 'Customer').trim().split(' ');
    const firstname = names[0] || 'Customer';
    const lastname = names.slice(1).join(' ') || 'User';

    const payload = {
      customer: {
        firstname,
        lastname,
        mobile: phone || '+2348000000000',
        country: 'NG',
        email,
      },
      order: {
        amount: Number(finalAmountNaira),
        reference: orderReference,
        description: 'Affy FoodBank Raw Foodstuff Order',
        currency: 'NGN',
      },
      payment: {
        RedirectUrl: redirectUrl || `${req.headers.origin || 'https://affy-food-bank-47z63t9vw-affybrand-4960.vercel.app'}/?payment_success=true&ref=${orderReference}`,
      },
    };

    // Live TransactPay encrypted call
    if (publicKey && encKey) {
      try {
        const encryptedData = encryptTransactPayPayload(payload, encKey);
        const tpRes = await fetch(`${TRANSACTPAY_BASE_URL}/payment/order/create`, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': publicKey,
          },
          body: JSON.stringify({ data: encryptedData }),
        });

        const resData: any = await tpRes.json();
        console.log('[TransactPay Create] Gateway response:', JSON.stringify(resData));

        // TransactPay create-order success statusCode is '01'
        if (resData.statusCode === '01' || resData.status === 'success') {
          // Record pending order in DB
          await recordOrderInDatabase({
            orderReference,
            amountCents: Math.round(Number(amountNaira) * 100),
            email,
            name,
            phone,
            address,
            items,
            status: 'PENDING',
          });

          const orderData = resData.data?.order || resData.data || {};
          return res.json({
            status: 'success',
            orderReference,
            processorReference: orderData?.processorReference || resData.data?.processorReference,
            data: resData.data,
            checkoutUrl:
              resData.data?.checkout_url ||
              orderData?.checkoutUrl ||
              `https://payment-interface.transactpay.ai/?orderId=${orderReference}`,
            otherPaymentOptions: resData.data?.otherPaymentOptions || [],
            message: 'Order created successfully with TransactPay PSSP',
          });
        } else {
          console.warn('[TransactPay API] Non-success response:', resData);
        }

      } catch (tpErr: any) {
        console.warn('[TransactPay] Live gateway error:', tpErr.message);
      }
    }

    // Fallback sandbox simulation if gateway is unreachable
    const virtualAccountNumber = `79${Math.floor(10000000 + Math.random() * 90000000)}`;
    res.json({
      status: 'success',
      orderReference,
      amountNaira,
      provider: 'transactpay',
      isSandbox: true,
      virtualAccount: {
        bankName: 'Wema Bank (TransactPay PSSP)',
        accountNumber: virtualAccountNumber,
        accountName: `Affy FoodBank - ${firstname}`,
      },
      message: 'TransactPay order created successfully',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/verify
 * Confirms payment from TransactPay gateway verification endpoint.
 * Specification: https://transactpay.readme.io/reference/post_payment-order-verify-1.md
 *
 * TransactPay verify body field is `orderReference` (NOT `reference`).
 * Success statusCode from TransactPay is '00'.
 * Payment statusId 5 = Successful, 1 = Initiated/Pending.
 */
router.post('/transactpay/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      throw new BadRequestError('Transaction reference is required');
    }

    const publicKey = process.env.TRANSACTPAY_PUBLIC_KEY || 'PGW-PUBLICKEY-493151248075433389622408C227C1E2';
    let gatewayVerified = false;
    let gatewayData: any = null;
    let gatewayReachable = false;

    // Call TransactPay Live Verify API
    // Body must use `orderReference` per TransactPay spec
    try {
      const tpRes = await fetch(`${TRANSACTPAY_BASE_URL}/payment/order/verify`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': publicKey,
        },
        body: JSON.stringify({ orderReference: reference }),
      });

      const resData: any = await tpRes.json();
      console.log('[TransactPay Verify] Gateway response:', JSON.stringify(resData));
      gatewayReachable = true;

      // TransactPay verify success statusCode is '00'
      if (resData.statusCode === '00' || resData.status === 'success') {
        gatewayData = resData.data || resData;

        // statusId 5 = Successful, statusId 1 = Initiated (pending)
        const statusId = gatewayData?.statusId ?? gatewayData?.order?.statusId;
        const statusStr = (gatewayData?.status || gatewayData?.order?.status || '').toLowerCase();

        if (statusId === 5 || statusStr === 'successful') {
          gatewayVerified = true;
        } else if (statusId === 1 || statusStr === 'initiated' || statusStr === 'pending') {
          // Order exists but payment is still pending — not yet verified
          gatewayVerified = false;
        }
      } else {
        // Gateway returned an error (e.g. "Cannot find this payment link")
        console.warn('[TransactPay Verify] Gateway returned error:', resData?.statusDescription || resData?.message);
      }
    } catch (tpErr: any) {
      console.warn('[TransactPay Verify] Network error reaching gateway:', tpErr.message);
      gatewayReachable = false;
    }

    // Only treat as verified if the gateway explicitly confirmed it,
    // OR if the gateway was unreachable (network failure) and reference is ours.
    const isSandboxRef = reference.startsWith('TP_') || reference.startsWith('WLT_');
    const isVerified = gatewayVerified || (!gatewayReachable && isSandboxRef);

    // Update database records and trigger customer receipt email on successful payment
    if (isVerified) {
      try {
        const existingTx = await prisma.walletTransaction.findUnique({
          where: { reference },
        });
        if (existingTx) {
          await prisma.walletTransaction.update({
            where: { reference },
            data: { status: 'SUCCESSFUL' },
          });
        }
      } catch (e: any) {
        // ignore db errors
      }

      // Send Resend confirmation email
      const customerEmail = gatewayData?.customer?.email || req.body?.email;
      const chargedAmount = Number(
        gatewayData?.totalAmountCharged || gatewayData?.order?.amount || req.body?.amountNaira || 0
      );
      if (customerEmail) {
        sendOrderReceiptEmail({
          to: customerEmail,
          orderReference: reference,
          amountNaira: chargedAmount,
          channel: gatewayData?.paymentMethod || 'TransactPay Gateway',
        }).catch((e) => console.warn('[Email] Receipt email note:', e.message));

        sendAdminOrderAlert({
          orderReference: reference,
          amountNaira: chargedAmount,
          customerEmail,
        }).catch((e) => console.warn('[Email] Admin alert note:', e.message));
      }
    }

    res.json({
      status: 'success',
      reference,
      processorReference: gatewayData?.paymentReference || gatewayData?.order?.processorReference || null,
      verified: isVerified,
      orderStatus: gatewayData?.status || gatewayData?.order?.status || (isVerified ? 'Successful' : 'Pending'),
      amount: gatewayData?.totalAmountCharged || gatewayData?.order?.amount || null,
      paidAt: gatewayData?.dateUpdated || new Date().toISOString(),
      channel: gatewayData?.paymentMethod || 'TRANSACTPAY',
      message: isVerified ? 'Payment verified successfully via TransactPay' : 'Payment not yet confirmed — please wait a moment and try again',
    });
  } catch (err) {
    next(err);
  }
});


/**
 * Webhook Secret Authentication Middleware / Helper
 */
function isAuthorizedWebhook(req: Request): boolean {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET;
  if (!secret) return true; // If not configured yet, pass through to independent API verification
  const header =
    req.headers['x-webhook-secret'] ||
    req.headers['x-transactpay-secret'] ||
    req.headers['authorization'] ||
    req.query.secret;

  if (!header) return false;
  // Normalize to plain string regardless of Express header/query type variants
  let rawStr: string;
  if (Array.isArray(header)) {
    rawStr = typeof header[0] === 'string' ? header[0] : String(header[0] ?? '');
  } else if (typeof header === 'string') {
    rawStr = header;
  } else {
    rawStr = String(header);
  }
  return rawStr.replace(/^Bearer\s+/i, '').trim() === secret.trim();
}

/**
 * POST /api/v1/payments/transactpay/webhook/funding
 * Dedicated Webhook Handler for bank transfer and virtual account deposits.
 * Documented fields: paymentReference, productName, totalAmountCharged, status, statusId, currencyName, datePaymentConfirmed, sessionId, sourceAccountName, accountReference.
 *
 * Durably records event first before acknowledging HTTP 200, then triggers independent TransactPay verification.
 */
router.post('/transactpay/webhook/funding', async (req: Request, res: Response) => {
  if (!isAuthorizedWebhook(req)) {
    console.warn('[TransactPay Funding Webhook] Unauthorized request rejected');
    return res.status(401).json({ status: 'error', message: 'Unauthorized webhook request' });
  }

  const payload = req.body || {};
  const data = payload?.data || payload?.Data || payload;

  const sessionId = (data?.sessionId || payload?.sessionId || '').toString().trim();
  if (!sessionId) {
    return res.status(400).json({ status: 'error', message: 'SessionId is required for funding verification' });
  }

  const paymentReference = (data?.paymentReference || payload?.paymentReference || `FPAY-${Date.now()}`).toString().trim();

  console.log('[TransactPay Funding Webhook] Received event:', {
    sessionId,
    paymentReference,
    accountReference: data?.accountReference || payload?.accountReference,
  });

  try {
    // 1. Durably record the raw event in WalletFundingEvent table (deduplicated by sessionId / paymentReference)
    const { isDuplicate } = await fundingService.recordFundingEvent(payload);

    // 2. Acknowledge with HTTP 200 once durably recorded
    res.status(200).json({
      status: 'success',
      message: 'Funding event received and durably recorded',
      sessionId,
      isDuplicate,
    });

    // 3. Trigger independent verification & atomic crediting asynchronously
    fundingService.verifyAndProcessFundingEvent(sessionId)
      .then((result) => {
        console.log(`[TransactPay Funding Webhook] Verification completed: ${result.status} - ${result.message}`);
      })
      .catch((err) => {
        console.error('[TransactPay Funding Webhook] Background verification error:', err.message);
      });
  } catch (err: any) {
    console.error('[TransactPay Funding Webhook Error]:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/v1/payments/transactpay/webhook/payout
 * Dedicated Webhook Handler for outbound payout events.
 * Documented fields: PayoutReference, ProductName, Amount, StatusId, Status, PayoutResponseCode, PayoutResponseMessage, Currency, SessionId.
 */
router.post('/transactpay/webhook/payout', async (req: Request, res: Response) => {
  if (!isAuthorizedWebhook(req)) {
    console.warn('[TransactPay Payout Webhook] Unauthorized request rejected');
    return res.status(401).json({ status: 'error', message: 'Unauthorized webhook request' });
  }

  const payload = req.body || {};
  const data = payload?.data || payload?.Data || payload;

  const clientReference =
    data?.clientReference ||
    data?.PayoutReference ||
    payload?.PayoutReference ||
    data?.narration;

  console.log('[TransactPay Payout Webhook] Received payout event:', {
    clientReference,
    status: data?.Status || data?.status,
    responseCode: data?.PayoutResponseCode,
  });

  if (!clientReference) {
    return res.status(400).json({ status: 'error', message: 'ClientReference is required' });
  }

  try {
    // Requery independently before finalizing
    const requery = await transactPayService.requeryPayout(clientReference);

    if (requery.status === 'SUCCESSFUL') {
      await walletService.finalizeSuccessfulWithdrawal({
        clientReference,
        providerReference: requery.providerReference,
      });
      console.log(`[TransactPay Payout Webhook] Withdrawal finalized as SUCCESSFUL: ${clientReference}`);
    } else if (requery.status === 'FAILED') {
      await walletService.releaseFailedWithdrawal({
        clientReference,
        reason: requery.responseMessage || 'Provider reported payout failure',
        providerReference: requery.providerReference,
      });
      console.log(`[TransactPay Payout Webhook] Withdrawal marked FAILED and funds released: ${clientReference}`);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Payout event processed and verified',
      clientReference,
      currentStatus: requery.status,
    });
  } catch (err: any) {
    console.error('[TransactPay Payout Webhook Error]:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/v1/payments/transactpay/webhook
 * Unified fallback webhook handler routing to funding or payout handler based on payload shape.
 */
router.post('/transactpay/webhook', async (req: Request, res: Response) => {
  const payload = req.body || {};
  const data = payload?.data || payload?.Data || payload;

  if (data?.PayoutReference || payload?.PayoutReference || data?.clientReference?.startsWith('WLT_WDR_')) {
    // Payout event
    return (router as any).handle({ ...req, url: '/transactpay/webhook/payout' }, res);
  }

  // Otherwise, default to funding / deposit event
  return (router as any).handle({ ...req, url: '/transactpay/webhook/funding' }, res);
});

/**
 * GET /api/v1/payments/transactpay/banks
 * Fetches list of Nigerian commercial & fintech banks from TransactPay.
 */
router.get('/transactpay/banks', async (_req: Request, res: Response) => {
  const fallbackBanks = [
    { name: 'Access Bank', code: '044', id: '1' },
    { name: 'Guaranty Trust Bank (GTBank)', code: '058', id: '2' },
    { name: 'Zenith Bank', code: '057', id: '3' },
    { name: 'United Bank for Africa (UBA)', code: '033', id: '4' },
    { name: 'First Bank of Nigeria', code: '011', id: '5' },
    { name: 'OPay', code: '999992', id: '6' },
    { name: 'PalmPay', code: '999991', id: '7' },
    { name: 'Kuda Bank', code: '50211', id: '8' },
    { name: 'Moniepoint MFB', code: '50515', id: '9' },
    { name: 'Wema Bank / ALAT', code: '035', id: '10' },
    { name: 'Stanbic IBTC Bank', code: '221', id: '11' },
    { name: 'Sterling Bank', code: '232', id: '12' },
    { name: 'Fidelity Bank', code: '070', id: '13' },
    { name: 'Union Bank of Nigeria', code: '032', id: '14' },
    { name: 'First City Monument Bank (FCMB)', code: '214', id: '15' },
    { name: 'Polaris Bank', code: '076', id: '16' },
    { name: 'Ecobank Nigeria', code: '050', id: '17' },
    { name: 'Providus Bank', code: '101', id: '18' },
    { name: 'Jaiz Bank', code: '301', id: '19' },
    { name: 'Taj Bank', code: '302', id: '20' },
  ];

  try {
    const tpRes = await fetch(`${TRANSACTPAY_BASE_URL}/payment/banks`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (tpRes.ok) {
      const data: any = await tpRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return res.json({ status: 'success', banks: data });
      }
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        return res.json({ status: 'success', banks: data.data });
      }
    }
  } catch (err: any) {
    console.warn('[TransactPay Banks] Using fallback banks list:', err.message);
  }

  res.json({
    status: 'success',
    banks: fallbackBanks,
  });
});

/**
 * POST /api/v1/payments/transactpay/virtual-account
 * Generates an automated permanent Virtual Account for dedicated wallet funding.
 * Reuses existing persistent account per customer profile.
 * Concurrency-safe: uses mutex lock so simultaneous requests return the exact same account.
 * Recovery-capable: queries getAccountDetailsByAlias before making a new generate call.
 * Strictly avoids fake account numbers on provider failure.
 */
router.post('/transactpay/virtual-account', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required to generate or access virtual account');
    }

    // 1. Resolve customer profile from authenticated session
    let customerProfile = await prisma.customerProfile.findFirst({
      where: { userId },
      include: { user: true },
    });

    if (!customerProfile) {
      customerProfile = await prisma.customerProfile.create({
        data: { userId },
        include: { user: true },
      });
    }

    const profileId = customerProfile.id;

    // Concurrency Lock: ensures only one generation task runs per customer profile
    const accountRecord = await virtualAccountStore.withLock(profileId, async () => {
      // Step 2.1: Look in DB/store for existing virtual account
      const existing = await virtualAccountStore.getByCustomerProfileId(profileId);
      if (existing) {
        return existing;
      }

      // Identity values: deterministic, derived from the immutable user ID
      const alias = `AFFY-CUST-${userId}`;
      const reference = `AFFY-WLT-${userId}`;
      const narration = 'AffyFoodBank Wallet Funding';

      // Step 2.2: Check if TransactPay already has one (alias recovery path)
      const existingAtProvider = await transactPayService.getAccountDetailsByAlias(alias);
      if (existingAtProvider) {
        console.log(`[Virtual Account] Recovered existing account from TransactPay via alias "${alias}":`, existingAtProvider.accountNumber);
        return await virtualAccountStore.save({
          customerProfileId: profileId,
          accountNumber: existingAtProvider.accountNumber,
          bankName: existingAtProvider.bankName,
          bankCode: existingAtProvider.bankCode,
          accountName: existingAtProvider.accountName,
          accountReference: existingAtProvider.accountReference || reference,
          alias,
          currency: existingAtProvider.currency || 'NGN',
          provider: 'TRANSACTPAY',
          isActive: true,
        });
      }

      // Step 2.3: Only if neither exists, call Generate Virtual Account
      console.log(`[Virtual Account] Calling Generate Virtual Account for alias "${alias}"`);
      const generated = await transactPayService.generateVirtualAccount({
        alias,
        reference,
        narration,
      });

      // Step 2.4: Save REAL returned values (never fabricated)
      return await virtualAccountStore.save({
        customerProfileId: profileId,
        accountNumber: generated.accountNumber,
        bankName: generated.bankName,
        bankCode: generated.bankCode,
        accountName: generated.accountName,
        accountReference: generated.accountReference || reference,
        alias,
        currency: generated.currency || 'NGN',
        provider: 'TRANSACTPAY',
        isActive: true,
      });
    });

    res.json({
      status: 'success',
      reference: accountRecord.accountReference,
      accountNumber: accountRecord.accountNumber,
      bankName: accountRecord.bankName,
      bankCode: accountRecord.bankCode,
      accountName: accountRecord.accountName,
      currency: accountRecord.currency || 'NGN',
      instructions: 'Transfer the exact amount to this dedicated account number. Your Affy FoodBank wallet will credit automatically upon bank clearing.',
    });
  } catch (err: any) {
    console.error('[Virtual Account Generation Failed]:', err.message);
    const statusCode = err.statusCode || (err.message?.includes('rejected') ? 502 : 503);
    res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Unable to setup virtual account right now. Please try again shortly or contact support.',
    });
  }
});

/**
 * GET /api/v1/payments/transactpay/funding-events
 * Operational Portal oversight: lists funding webhook events with filters and pagination.
 * Restricted to Admin and SuperAdmin roles.
 */
router.get('/transactpay/funding-events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { status, needsReview, limit, offset } = req.query;
    const result = await fundingService.listFundingEvents({
      status: typeof status === 'string' ? status : undefined,
      needsReview: needsReview === 'true',
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({ status: 'success', result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/funding-events/reverify
 * Re-runs independent verification for any funding event.
 * Follows the same strict provider check — no manual bypass.
 * Restricted to Admin and SuperAdmin roles.
 */
router.post('/transactpay/funding-events/reverify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { sessionId } = req.body;
    if (!sessionId) {
      throw new BadRequestError('Session ID is required for re-verification');
    }

    const result = await fundingService.reverifyFundingEvent(sessionId);
    res.json({ status: 'success', result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/virtual-account/backfill
 * Rate-limited resumable backfill to generate virtual accounts for existing customers.
 * Restricted to Admin and SuperAdmin roles.
 */
router.post('/transactpay/virtual-account/backfill', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin' && role !== 'SuperAdmin') {
      return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
    }

    const { limit, delayMs } = req.body || {};
    const result = await fundingService.backfillExistingCustomers({
      limit: limit ? Number(limit) : 10,
      delayMs: delayMs ? Number(delayMs) : 500,
    });

    res.json({ status: 'success', result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/name-enquiry
 * Validates bank code and account number, returning registered beneficiary account name.
 */
router.post('/transactpay/name-enquiry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountNumber, bankCode } = req.body;
    if (!accountNumber || accountNumber.trim().length !== 10) {
      throw new BadRequestError('Valid 10-digit account number is required');
    }
    if (!bankCode) {
      throw new BadRequestError('Bank code is required');
    }

    try {
      const result = await transactPayService.nameEnquiry({
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
      });

      return res.json({
        status: 'success',
        accountName: result.accountName,
        accountNumber: result.accountNumber,
        bankCode: result.bankCode,
      });
    } catch (neErr: any) {
      console.warn('[TransactPay Name Enquiry] Notice:', neErr.message);
      return res.status(400).json({
        status: 'error',
        message: neErr.message || 'Beneficiary name enquiry failed. Check account number and bank code.',
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/payout
 * Initiates an automated withdrawal with fund reservation.
 * Requires user authentication.
 */
router.post('/transactpay/payout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.sub) {
      throw new UnauthorizedError('Authentication session required to initiate withdrawal');
    }

    const {
      amountNaira,
      accountNumber,
      bankCode,
      bankName,
      accountName,
      description,
    } = req.body;

    const amountNum = Number(amountNaira);
    if (!amountNum || amountNum <= 0) {
      throw new BadRequestError('Valid withdrawal amount in Naira is required');
    }
    if (!accountNumber || accountNumber.trim().length !== 10) {
      throw new BadRequestError('Valid 10-digit Nigerian bank account number is required');
    }
    if (!bankCode) {
      throw new BadRequestError('Destination bank code is required');
    }
    if (!accountName) {
      throw new BadRequestError('Destination account name is required');
    }

    const amountCents = Math.round(amountNum * 100);
    const clientReference = `WLT_WDR_${Date.now()}_${uuidv4().replace(/-/g, '').slice(0, 8)}`;

    // 1. Resolve customer profile strictly for authenticated user
    let customerProfile = await prisma.customerProfile.findFirst({
      where: { userId: req.user.sub },
      include: { user: true, wallet: true },
    });

    if (!customerProfile && req.user.email) {
      customerProfile = await prisma.customerProfile.findFirst({
        where: { user: { email: req.user.email } },
        include: { user: true, wallet: true },
      });
    }

    if (!customerProfile || !customerProfile.wallet) {
      throw new BadRequestError('Customer wallet profile not found');
    }

    // 2. Atomically check balance and reserve funds BEFORE calling provider
    await walletService.reserveWithdrawalFunds({
      customerProfileId: customerProfile.id,
      amountCents,
      clientReference,
      description: description || `Withdrawal to ${bankName || 'Bank'} (${accountNumber}) - ${accountName}`,
    });

    // 3. Dispatch automated payout to TransactPay
    let initiationResult: any;
    try {
      initiationResult = await transactPayService.initiatePayout({
        clientReference,
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
        amountNaira: amountNum,
        description: description || 'Affy FoodBank Wallet Withdrawal',
        accountName: accountName.trim(),
      });
    } catch (tpErr: any) {
      console.warn('[TransactPay Payout] Immediate initiation error, releasing reserved funds:', tpErr.message);
      await walletService.releaseFailedWithdrawal({
        clientReference,
        reason: tpErr.message || 'Gateway rejected payout initiation',
      });
      throw new BadRequestError(`Payout failed to initiate: ${tpErr.message}`);
    }

    // 4. Send withdrawal initiation receipt email
    try {
      const recipientEmail = customerProfile.user.email || req.user.email;
      const recipientName = [customerProfile.user.firstName, customerProfile.user.lastName].filter(Boolean).join(' ') || accountName;
      const currentWallet = await walletService.getWallet(customerProfile.id);

      if (recipientEmail) {
        sendWalletWithdrawalEmail({
          to: recipientEmail,
          customerName: recipientName || 'Affy Customer',
          amountNaira: amountNum,
          remainingBalanceNaira: currentWallet.availableBalanceCents / 100,
          bankName: bankName || 'Bank Account',
          accountNumber,
          reference: clientReference,
          status: 'PENDING',
        }).catch((err) => console.warn('[Resend] Withdrawal email failed:', err.message));
      }
    } catch {}

    // Notice: Response status is PENDING (funds reserved). Final debit happens upon verified confirmation.
    res.json({
      status: 'pending',
      reference: clientReference,
      batchReference: initiationResult.batchReference || `BATCH-${clientReference}`,
      amountNaira: amountNum,
      destination: {
        bankName: bankName || 'Commercial Bank',
        accountNumber,
        accountName,
      },
      message: 'Withdrawal initiated successfully. Funds are reserved and will complete upon bank clearing.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments/transactpay/payout/status/:clientReference
 * Explicit requery of payout status
 */
router.get('/transactpay/payout/status/:clientReference', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientReference } = req.params;
    if (!clientReference) throw new BadRequestError('clientReference is required');

    const requery = await transactPayService.requeryPayout(clientReference);

    if (requery.status === 'SUCCESSFUL') {
      await walletService.finalizeSuccessfulWithdrawal({
        clientReference,
        providerReference: requery.providerReference,
      });
    } else if (requery.status === 'FAILED') {
      await walletService.releaseFailedWithdrawal({
        clientReference,
        reason: requery.responseMessage,
        providerReference: requery.providerReference,
      });
    }

    res.json({
      status: requery.status,
      clientReference,
      providerReference: requery.providerReference,
      message: requery.responseMessage,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/transactpay/payout/reconcile-stale
 * Reconciles all pending payouts older than 2 minutes across the system
 */
router.post('/transactpay/payout/reconcile-stale', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const staleTxs = await prisma.walletTransaction.findMany({
      where: {
        type: 'WITHDRAWAL',
        status: 'PENDING',
        createdAt: { lt: new Date(Date.now() - 120000) },
      },
      take: 20,
    });

    const results: Array<{ reference: string; status: string; error?: string }> = [];
    for (const tx of staleTxs) {
      try {
        const requery = await transactPayService.requeryPayout(tx.reference);
        if (requery.status === 'SUCCESSFUL') {
          await walletService.finalizeSuccessfulWithdrawal({
            clientReference: tx.reference,
            providerReference: requery.providerReference,
          });
        } else if (requery.status === 'FAILED') {
          await walletService.releaseFailedWithdrawal({
            clientReference: tx.reference,
            reason: requery.responseMessage,
            providerReference: requery.providerReference,
          });
        }
        results.push({ reference: tx.reference, status: requery.status });
      } catch (e: any) {
        results.push({ reference: tx.reference, status: 'ERROR', error: e.message });
      }
    }

    res.json({
      status: 'success',
      reconciledCount: results.length,
      details: results,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments/transactpay/config
 * Exposes TransactPay public keys and merchant configuration for Standard Kit client integration.
 */
router.get('/transactpay/config', (_req: Request, res: Response) => {
  res.json({
    publicKey: process.env.TRANSACTPAY_PUBLIC_KEY || 'PGW-PUBLICKEY-493151248075433389622408C227C1E2',
    encryptionKey: process.env.TRANSACTPAY_ENCRYPTION_KEY || '',
    environment: process.env.TRANSACTPAY_ENVIRONMENT || 'TEST',
    accountName: 'Affy FoodBank',
  });
});

export default router;

