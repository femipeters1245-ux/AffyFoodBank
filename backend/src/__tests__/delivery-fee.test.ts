// backend/src/__tests__/delivery-fee.test.ts
import request from 'supertest';
import app from '../app';
import {
  getDeliveryFeeConfig,
  updateDeliveryFeeConfig,
  calculateAuthoritativeDeliveryFee,
  validateDeliveryFeeConfig,
  DEFAULT_DELIVERY_CONFIG,
} from '../services/deliveryFee.service';
import jwt from 'jsonwebtoken';

describe('Centralized Delivery Fee Management & Checkout Sync', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'affy-dev-secret-key-foodbank-2026';

  const logisticsToken = jwt.sign(
    { sub: 'logistics-user-1', email: 'logistics@affyfoodbank.ng', role: 'LogisticsStaff', permissions: [] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const financeToken = jwt.sign(
    { sub: 'finance-user-1', email: 'finance@affyfoodbank.ng', role: 'FinanceStaff', permissions: [] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { sub: 'admin-user-1', email: 'admin@affyfoodbank.ng', role: 'Admin', permissions: ['*:*'] },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Restore initial config after tests
  afterAll(async () => {
    await updateDeliveryFeeConfig(DEFAULT_DELIVERY_CONFIG, 'Test Cleanup');
  });

  describe('Test A: Persistence across cold starts and reloads', () => {
    it('should persist an updated standard delivery fee and retrieve it from database', async () => {
      const testStandardFee = 180000; // ₦1,800
      const updated = await updateDeliveryFeeConfig(
        { standardFeeCents: testStandardFee },
        'Automated Test A'
      );
      expect(updated.standardFeeCents).toBe(testStandardFee);

      // Fetch freshly to verify persistence
      const fetched = await getDeliveryFeeConfig();
      expect(fetched.standardFeeCents).toBe(testStandardFee);
    });
  });

  describe('Test B: Location-specific rate synchronization', () => {
    it('should update a specific Ilesa zone fee and return it for checkout', async () => {
      const targetZone = 'Ilesa Central (Roundabout, Isokun, Imo)';
      const newZoneFee = 135000; // ₦1,350

      await updateDeliveryFeeConfig(
        {
          stateFees: {
            [targetZone]: newZoneFee,
          },
        },
        'Automated Test B'
      );

      const publicRes = await request(app).get('/api/v1/delivery-fee');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.stateFees[targetZone]).toBe(newZoneFee);
    });
  });

  describe('Test C: Authoritative order calculation', () => {
    it('should accurately compute order subtotal + location delivery fee', async () => {
      const subtotalCents = 1500000; // ₦15,000 (under threshold)
      const location = 'Ijebu-Jesa / Oriade'; // 200000 cents (₦2,000)

      const result = await calculateAuthoritativeDeliveryFee(subtotalCents, location, false);
      expect(result.deliveryFeeCents).toBe(200000);
      expect(result.isFree).toBe(false);
      expect(result.isExpress).toBe(false);

      const grandTotalCents = subtotalCents + result.deliveryFeeCents;
      expect(grandTotalCents).toBe(1700000); // ₦17,000
    });
  });

  describe('Test D: Free delivery bulk threshold enforcement', () => {
    it('should charge delivery when order is strictly below the free delivery threshold', async () => {
      const thresholdCents = 5000000; // ₦50,000
      const belowSubtotal = 4500000; // ₦45,000
      const location = 'Ilesa West (Breweries, Omi Aladiye, Ereja)';

      const result = await calculateAuthoritativeDeliveryFee(belowSubtotal, location, false);
      expect(result.isFree).toBe(false);
      expect(result.deliveryFeeCents).toBeGreaterThan(0);
    });

    it('should waive the base delivery fee when order meets or exceeds the threshold', async () => {
      const qualifyingSubtotal = 5500000; // ₦55,000
      const location = 'Ilesa West (Breweries, Omi Aladiye, Ereja)';

      const result = await calculateAuthoritativeDeliveryFee(qualifyingSubtotal, location, false);
      expect(result.isFree).toBe(true);
      expect(result.baseDeliveryFeeCents).toBe(0);
      expect(result.deliveryFeeCents).toBe(0);
    });
  });

  describe('Test E: Consistency across public and admin interfaces', () => {
    it('should return identical configuration on /delivery-fee and /admin/delivery-fee', async () => {
      const publicRes = await request(app).get('/api/v1/delivery-fee');
      const adminRes = await request(app)
        .get('/api/v1/admin/delivery-fee')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(publicRes.status).toBe(200);
      expect(adminRes.status).toBe(200);
      expect(publicRes.body.standardFeeCents).toBe(adminRes.body.standardFeeCents);
      expect(publicRes.body.freeDeliveryThresholdCents).toBe(adminRes.body.freeDeliveryThresholdCents);
      expect(publicRes.body.expressFeeCents).toBe(adminRes.body.expressFeeCents);
      expect(publicRes.body.stateFees).toEqual(adminRes.body.stateFees);
    });
  });

  describe('Extra Tests: Security, RBAC, Priority Surcharge & Input Validation', () => {
    it('should add express surcharge only when selected and keep it even on bulk orders', async () => {
      const qualifyingSubtotal = 7000000; // ₦70,000 (free base delivery)
      const location = 'Ilesa Central (Roundabout, Isokun, Imo)';

      // Normal free delivery
      const standardBulk = await calculateAuthoritativeDeliveryFee(qualifyingSubtotal, location, false);
      expect(standardBulk.deliveryFeeCents).toBe(0);

      // Express bulk delivery (free base delivery, but express surcharge applies)
      const expressBulk = await calculateAuthoritativeDeliveryFee(qualifyingSubtotal, location, true);
      expect(expressBulk.isFree).toBe(true);
      expect(expressBulk.baseDeliveryFeeCents).toBe(0);
      expect(expressBulk.expressFeeCents).toBe(250000);
      expect(expressBulk.deliveryFeeCents).toBe(250000);
    });

    it('should reject fee modification from unauthorized role (FinanceStaff)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/delivery-fee')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({ standardFeeCents: 100000 });

      expect(res.status).toBe(403);
      const errMsg = res.body.error || res.body.message;
      expect(errMsg).toMatch(/Only Logistics Staff or Administrators/);
    });

    it('should permit fee modification from authorized LogisticsStaff', async () => {
      const res = await request(app)
        .post('/api/v1/admin/delivery-fee')
        .set('Authorization', `Bearer ${logisticsToken}`)
        .send({ standardFeeCents: 160000 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.config.standardFeeCents).toBe(160000);
    });

    it('should validate inputs and reject negative fees or non-numeric values', () => {
      expect(() => {
        validateDeliveryFeeConfig({ standardFeeCents: -500 });
      }).toThrow(/non-negative/);

      expect(() => {
        validateDeliveryFeeConfig({ expressFeeCents: NaN });
      }).toThrow(/non-negative/);

      expect(() => {
        validateDeliveryFeeConfig({ stateFees: { 'Invalid Zone': -100 } });
      }).toThrow(/non-negative/);
    });

    it('should fallback to default fee when customer selects an unconfigured location', async () => {
      const result = await calculateAuthoritativeDeliveryFee(2000000, 'Unconfigured Remote Village', false);
      expect(result.deliveryFeeCents).toBe(150000); // Default fallback
    });

    it('Tamper test: should reject checkout request with tampered underpaid total', async () => {
      // 1. Verify retired wallet checkout returns HTTP 410 Gone
      const walletRes = await request(app)
        .post('/api/v1/orders/wallet-checkout')
        .send({ totalAmountCents: 50000 });
      expect(walletRes.status).toBe(410);

      // 2. Verify active commercial TransactPay checkout rejects underpayment with 400
      // Items totaling ₦15,000 + ₦1,500 delivery = ₦16,500, but client passes amountNaira: 500
      const res = await request(app)
        .post('/api/v1/payments/transactpay/create-order')
        .send({
          email: 'tamper@affyfoodbank.ng',
          amountNaira: 500,
          location: 'Ilesa Central (Roundabout, Isokun, Imo)',
          items: [
            { productId: 'test-p1', name: 'Rice', quantity: 1, priceCents: 1500000 },
          ],
        });

      expect(res.status).toBe(400);
      const errMsg = res.body.error || res.body.message;
      expect(errMsg).toMatch(/Payment amount mismatch/);
    });
  });
});
