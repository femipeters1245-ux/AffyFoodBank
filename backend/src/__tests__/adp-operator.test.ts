// backend/src/__tests__/adp-operator.test.ts
import {
  encryptSensitiveData,
  decryptSensitiveData,
  maskAccountNumber,
} from '../services/encryption.service';
import { adpOperatorService } from '../services/adpOperator.service';
import { coverageZoneService } from '../services/coverageZone.service';
import { transactPayService } from '../services/transactpay.service';
import prisma from '../prisma/client';

jest.mock('../prisma/client', () => ({
  adpOperator: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  adpVerificationHistory: {
    create: jest.fn(),
  },
}));

jest.mock('../services/supabase-admin.service', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      from: jest.fn(() => ({
        createSignedUploadUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/upload', token: 'tok_123' },
          error: null,
        }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/download' },
          error: null,
        }),
      })),
    },
  },
}));

describe('ADP Operator & Financial Encryption Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Sensitive Financial Data Encryption (AES-256-GCM)', () => {
    it('should encrypt and decrypt a 10-digit NUBAN account number accurately', () => {
      const rawAccount = '0123456789';
      const encrypted = encryptSensitiveData(rawAccount);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(rawAccount);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptSensitiveData(encrypted);
      expect(decrypted).toBe(rawAccount);
    });

    it('should throw an error if cipher text or auth tag has been tampered with', () => {
      const rawAccount = '9876543210';
      const encrypted = encryptSensitiveData(rawAccount);
      const [iv, authTag, cipher] = encrypted.split(':');

      // Tamper with the ciphertext
      const tamperedCipher = cipher.slice(0, -2) + 'aa';
      const tamperedPayload = `${iv}:${authTag}:${tamperedCipher}`;

      expect(() => decryptSensitiveData(tamperedPayload)).toThrow();
    });

    it('should correctly mask account numbers for public display', () => {
      expect(maskAccountNumber('0123456789')).toBe('******6789');
      expect(maskAccountNumber('2098765432')).toBe('******5432');
      expect(maskAccountNumber('1234')).toBe('****1234');
      expect(maskAccountNumber('')).toBe('******');
    });
  });

  describe('2. Matriculation Normalization & Application Reference', () => {
    it('should normalize matriculation number strings', () => {
      expect(adpOperatorService.normalizeMatric(' unilesa / 2023 / 001 ')).toBe('UNILESA/2023/001');
      expect(adpOperatorService.normalizeMatric('csc/2022/1045')).toBe('CSC/2022/1045');
    });

    it('should generate well-structured application references', () => {
      const ref = adpOperatorService.generateApplicationReference();
      expect(ref).toMatch(/^ADP-\d{8}-[A-Z0-9]{4}$/);
    });
  });

  describe('3. Application Submission Logic & Validations', () => {
    it('should reject application if required fields are missing', async () => {
      await expect(
        adpOperatorService.submitApplication('usr-1', {} as any)
      ).rejects.toThrow(/is required/i);
    });

    it('should reject application if account number is not 10 digits', async () => {
      await expect(
        adpOperatorService.submitApplication('usr-1', {
          coverageZoneId: 'zone-1',
          fullName: 'Adekunle Gold',
          matricNumber: 'CSC/2022/100',
          faculty: 'Science',
          department: 'Computer Science',
          academicLevel: '300L',
          phone: '08012345678',
          email: 'student@unilesa.edu.ng',
          studentIdDocPath: 'operators/usr-1/id.jpg',
          hostelName: 'Success Villa',
          hostelAddress: 'MichoDollar Area',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '12345', // invalid length
          accountName: 'Adekunle Gold',
        })
      ).rejects.toThrow(/10-digit NUBAN/i);
    });

    it('should validate coverage zone with coverageZoneService', async () => {
      const validateSpy = jest
        .spyOn(coverageZoneService, 'validateActiveZone')
        .mockRejectedValue(new Error('Coverage zone is inactive or does not exist'));

      await expect(
        adpOperatorService.submitApplication('usr-1', {
          coverageZoneId: 'inactive-zone',
          fullName: 'Adekunle Gold',
          matricNumber: 'CSC/2022/100',
          faculty: 'Science',
          department: 'Computer Science',
          academicLevel: '300L',
          phone: '08012345678',
          email: 'student@unilesa.edu.ng',
          studentIdDocPath: 'operators/usr-1/id.jpg',
          hostelName: 'Success Villa',
          hostelAddress: 'MichoDollar Area',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'Adekunle Gold',
        })
      ).rejects.toThrow(/Coverage zone is inactive/);

      expect(validateSpy).toHaveBeenCalledWith('inactive-zone');
    });

    it('should reject if a duplicate active/pending matric exists', async () => {
      jest.spyOn(coverageZoneService, 'validateActiveZone').mockResolvedValue({
        id: 'zone-1',
        name: 'NNPC',
        normalizedName: 'nnpc',
        targetAdpCount: 2,
        isActive: true,
      } as any);

      (prisma.adpOperator.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'adp-existing',
        matricNumber: 'CSC/2022/100',
        status: 'PENDING_REVIEW',
      });

      await expect(
        adpOperatorService.submitApplication('usr-1', {
          coverageZoneId: 'zone-1',
          fullName: 'Adekunle Gold',
          matricNumber: 'CSC/2022/100',
          faculty: 'Science',
          department: 'Computer Science',
          academicLevel: '300L',
          phone: '08012345678',
          email: 'student@unilesa.edu.ng',
          studentIdDocPath: 'operators/usr-1/id.jpg',
          hostelName: 'Success Villa',
          hostelAddress: 'MichoDollar Area',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountNumber: '0123456789',
          accountName: 'Adekunle Gold',
        })
      ).rejects.toThrow(/already exists for this matriculation/);
    });

    it('should submit successfully with verified bank name enquiry and create initial audit history', async () => {
      jest.spyOn(coverageZoneService, 'validateActiveZone').mockResolvedValue({
        id: 'zone-1',
        name: 'NNPC',
        normalizedName: 'nnpc',
        targetAdpCount: 2,
        isActive: true,
      } as any);

      // No duplicate matric
      (prisma.adpOperator.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock successful name enquiry
      jest.spyOn(transactPayService, 'nameEnquiry').mockResolvedValue({
        accountName: 'ADEKUNLE GOLD',
        accountNumber: '0123456789',
        bankCode: '058',
        responseCode: '00',
        status: 'SUCCESSFUL',
      });

      const mockCreated = {
        id: 'new-adp-uuid',
        applicationReference: 'ADP-20261127-F1E2',
        status: 'PENDING_REVIEW',
        studentVerificationStatus: 'PENDING',
        hostelVerificationStatus: 'PENDING',
        paymentVerificationStatus: 'PENDING',
        nameEnquiryVerifiedName: 'ADEKUNLE GOLD',
        accountNumberMasked: '******6789',
        accountNumberEncrypted: 'mock:enc:data',
        createdAt: new Date().toISOString(),
      };

      (prisma.adpOperator.create as jest.Mock).mockResolvedValue(mockCreated);
      (prisma.adpVerificationHistory.create as jest.Mock).mockResolvedValue({ id: 'hist-1' });

      const result = await adpOperatorService.submitApplication('usr-1', {
        coverageZoneId: 'zone-1',
        fullName: 'Adekunle Gold',
        matricNumber: 'CSC/2022/100',
        faculty: 'Science',
        department: 'Computer Science',
        academicLevel: '300L',
        phone: '08012345678',
        email: 'student@unilesa.edu.ng',
        studentIdDocPath: 'operators/usr-1/id.jpg',
        hostelName: 'Success Villa',
        hostelAddress: 'MichoDollar Area',
        bankName: 'Guaranty Trust Bank',
        bankCode: '058',
        accountNumber: '0123456789',
        accountName: 'Adekunle Gold',
      });

      expect(result.applicationReference).toBe('ADP-20261127-F1E2');
      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.nameEnquiryVerifiedName).toBe('ADEKUNLE GOLD');
      expect(result.accountNumberMasked).toBe('******6789');
      // Ensure encrypted account number is NEVER leaked in response
      expect((result as any).accountNumberEncrypted).toBeUndefined();

      // Ensure initial audit history was logged
      expect(prisma.adpVerificationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adpOperatorId: 'new-adp-uuid',
          track: 'OVERALL',
          oldStatus: 'NONE',
          newStatus: 'PENDING_REVIEW',
        }),
      });
    });

    it('should set paymentVerificationStatus to MANUAL_REVIEW when TransactPay nameEnquiry fails', async () => {
      jest.spyOn(coverageZoneService, 'validateActiveZone').mockResolvedValue({
        id: 'zone-1',
        name: 'NNPC',
      } as any);
      (prisma.adpOperator.findFirst as jest.Mock).mockResolvedValue(null);

      // Name enquiry failure
      jest.spyOn(transactPayService, 'nameEnquiry').mockRejectedValue(new Error('Network timeout'));

      (prisma.adpOperator.create as jest.Mock).mockImplementation(async ({ data }) => ({
        ...data,
        id: 'adp-manual-review',
      }));

      const result = await adpOperatorService.submitApplication('usr-2', {
        coverageZoneId: 'zone-1',
        fullName: 'Tola Shina',
        matricNumber: 'BIO/2021/400',
        faculty: 'Science',
        department: 'Biochemistry',
        academicLevel: '400L',
        phone: '08087654321',
        email: 'tola@unilesa.edu.ng',
        studentIdDocPath: 'operators/usr-2/id.jpg',
        hostelName: 'Grace Lodge',
        hostelAddress: 'NNPC Area',
        bankName: 'Access Bank',
        bankCode: '044',
        accountNumber: '0691234567',
        accountName: 'Tola Shina',
      });

      expect(result.paymentVerificationStatus).toBe('MANUAL_REVIEW');
    });
  });
});
