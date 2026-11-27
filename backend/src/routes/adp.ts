// backend/src/routes/adp.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { adpOperatorService } from '../services/adpOperator.service';
import { storageService } from '../services/storage.service';
import { transactPayService } from '../services/transactpay.service';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export const adpRouter = Router();

/**
 * GET /api/v1/adp/banks
 * Returns the list of Nigerian commercial and fintech banks for payout setup.
 */
adpRouter.get('/banks', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const banks = await transactPayService.getBanks();
    return res.json({
      status: 'success',
      count: banks.length,
      banks,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/adp/verify-bank
 * Verifies NUBAN account number and bank code via TransactPay server-side name enquiry.
 */
adpRouter.post('/verify-bank', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
 * GET /api/v1/adp/upload-url
 * Generates a signed upload URL for the applicant to securely upload their Student ID doc directly.
 */
adpRouter.get('/upload-url', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const fileName = (req.query.fileName as string) || 'student_id.jpg';
    const uploadDetails = await storageService.createSignedUploadUrl(userId, fileName);

    return res.json({
      status: 'success',
      ...uploadDetails,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/adp/apply
 * Submits a new ADP student delivery partner application.
 */
adpRouter.post('/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const applicationResult = await adpOperatorService.submitApplication(userId, req.body);

    return res.status(201).json({
      status: 'success',
      message: 'ADP application submitted successfully and is pending verification',
      data: applicationResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/adp/my-applications
 * Returns all ADP applications belonging to the authenticated user.
 */
adpRouter.get('/my-applications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const applications = await adpOperatorService.getMyApplications(userId);

    return res.json({
      status: 'success',
      count: applications.length,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/adp/my/dashboard
 * Returns metrics, assigned orders, and earnings summary for an operator.
 */
adpRouter.get('/my/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const dashboard = await adpOperatorService.getOperatorDashboardData(userId);
    return res.json({
      status: 'success',
      data: dashboard,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/adp/my/bank/change-request
 * Submit sensitive bank account change request
 */
adpRouter.post('/my/bank/change-request', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const updated = await adpOperatorService.requestBankDetailsChange(userId, req.body);
    return res.json({
      status: 'success',
      message: 'Bank details update submitted for verification',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/adp/my/orders/:orderId/confirm-collection
 * Allows operator to confirm student collection
 */
adpRouter.patch('/my/orders/:orderId/confirm-collection', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await adpOperatorService.confirmOrderCollection(userId, req.params.orderId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});
