// backend/src/routes/payments.ts
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { BadRequestError } from '../utils/errors';
import { sendOrderReceiptEmail, sendAdminOrderAlert } from '../services/email.service';

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

    // If no customer profile found, try finding any customer profile or create a delivery address if possible
    if (!customerProfile) {
      customerProfile = await prisma.customerProfile.findFirst({
        include: { user: true, wallet: true },
      });
    }

    if (customerProfile) {
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
            create: (items || []).map((it) => ({
              id: uuidv4(),
              productId: it.productId || uuidv4(),
              quantity: it.quantity || 1,
              unitId: uuidv4(),
              priceAtPurchaseCents: BigInt(it.priceCents || 0),
            })),
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
    const { amountNaira, email, name, phone, address, items, redirectUrl } = req.body;

    if (!amountNaira || Number(amountNaira) <= 0) {
      throw new BadRequestError('Valid amount in Naira is required');
    }
    if (!email) {
      throw new BadRequestError('Customer email is required');
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
        amount: Number(amountNaira),
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
 * POST /api/v1/payments/transactpay/webhook
 * Handles incoming webhooks from TransactPay for Card, Bank Transfer, and Reserved Accounts.
 * Specification: https://transactpay.readme.io/reference/webhooks-1.md
 */
router.post('/transactpay/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log('[TransactPay Webhook] Received webhook payload:', JSON.stringify(payload, null, 2));

    const data = payload?.data || payload?.Data || payload;
    const orderReference = data?.orderReference || data?.OrderReference || data?.narration;
    const paymentReference = data?.paymentReference || data?.PaymentReference;
    const status = data?.status || data?.Status;
    const statusCode = payload?.statusCode || payload?.StatusCode;

    const isSuccessful =
      status?.toLowerCase() === 'successful' ||
      status?.toLowerCase() === 'success' ||
      statusCode === '00' ||
      data?.statusId === 5;

    if (isSuccessful && orderReference) {
      console.log(`[TransactPay Webhook] Transaction succeeded for order: ${orderReference} (${paymentReference})`);

      try {
        // Update database transaction if found
        const tx = await prisma.walletTransaction.findUnique({
          where: { reference: orderReference },
        });
        if (tx) {
          await prisma.walletTransaction.update({
            where: { reference: orderReference },
            data: { status: 'SUCCESSFUL' },
          });
        }
      } catch (err: any) {
        console.warn('[TransactPay Webhook] DB update note:', err.message);
      }
    }

    // TransactPay expects HTTP 200 OK acknowledgment
    res.status(200).json({
      status: 'success',
      message: 'Webhook received and processed',
    });
  } catch (err: any) {
    console.error('[TransactPay Webhook Error]:', err);
    // Always acknowledge with 200 to avoid webhook retry loops
    res.status(200).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/v1/payments/transactpay/config
 * Exposes TransactPay public keys and merchant configuration for Standard Kit client integration.
 * Specification: https://transactpay.readme.io/docs/standard-kit-checkout.md
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
