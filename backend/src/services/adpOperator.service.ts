// backend/src/services/adpOperator.service.ts
import crypto from 'crypto';
import prisma from '../prisma/client';
import { supabaseAdmin } from './supabase-admin.service';
import { coverageZoneService } from './coverageZone.service';
import { encryptSensitiveData, maskAccountNumber } from './encryption.service';
import { transactPayService } from './transactpay.service';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface SubmitAdpApplicationInput {
  coverageZoneId: string;
  fullName: string;
  matricNumber: string;
  institution?: string;
  faculty: string;
  department: string;
  academicLevel: string;
  phone: string;
  email: string;
  studentIdDocPath: string;
  hostelName: string;
  hostelAddress: string;
  closestLandmark?: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  alternativeContact?: string;
}

export class AdpOperatorService {
  /**
   * Normalize matriculation number for reliable duplicate detection.
   * Example: "  UNILESA / 2023 / 0012 " -> "UNILESA/2023/0012"
   */
  normalizeMatric(matric: string): string {
    return matric.trim().toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Generate a human-friendly unique application reference
   * Format: ADP-YYYYMMDD-XXXX (e.g. ADP-20261127-A9F2)
   */
  generateApplicationReference(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `ADP-${dateStr}-${randomHex}`;
  }

  /**
   * Submits a new ADP Student Delivery Port application.
   */
  async submitApplication(userId: string, input: SubmitAdpApplicationInput) {
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // 1. Validate required fields
    const required = [
      'coverageZoneId',
      'fullName',
      'matricNumber',
      'faculty',
      'department',
      'academicLevel',
      'phone',
      'email',
      'studentIdDocPath',
      'hostelName',
      'hostelAddress',
      'bankName',
      'bankCode',
      'accountNumber',
      'accountName',
    ];

    for (const field of required) {
      if (!input[field as keyof SubmitAdpApplicationInput]) {
        throw new BadRequestError(`Field '${field}' is required for ADP application`);
      }
    }

    // Validate account number format (10-digit NUBAN)
    const cleanAccount = input.accountNumber.trim();
    if (!/^\d{10}$/.test(cleanAccount)) {
      throw new BadRequestError('Account number must be a valid 10-digit NUBAN');
    }

    // 2. Validate Coverage Zone is active
    await coverageZoneService.validateActiveZone(input.coverageZoneId);

    // 3. Normalize matriculation number & check for active/pending duplicates
    const normalizedMatric = this.normalizeMatric(input.matricNumber);

    let existingAdp: any = null;
    try {
      existingAdp = await prisma.adpOperator.findFirst({
        where: {
          normalizedMatric,
          status: { notIn: ['REJECTED'] },
        },
      });
    } catch {
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('AdpOperator')
          .select('id, status')
          .eq('normalizedMatric', normalizedMatric)
          .neq('status', 'REJECTED')
          .limit(1)
          .maybeSingle();
        existingAdp = data;
      }
    }

    if (existingAdp) {
      throw new BadRequestError(
        'An active or pending application already exists for this matriculation number.'
      );
    }

    // Check if user already submitted an active application
    let userExisting: any = null;
    try {
      userExisting = await prisma.adpOperator.findFirst({
        where: {
          userId,
          status: { notIn: ['REJECTED'] },
        },
      });
    } catch {
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('AdpOperator')
          .select('id, status')
          .eq('userId', userId)
          .neq('status', 'REJECTED')
          .limit(1)
          .maybeSingle();
        userExisting = data;
      }
    }

    if (userExisting) {
      throw new BadRequestError('You already have an active or pending ADP application.');
    }

    // 4. Server-Side Bank Name Enquiry Verification with TransactPay
    let verifiedAccountName: string | null = null;
    let paymentVerificationStatus = 'PENDING';
    let paymentVerificationNotes: string | null = null;

    try {
      const nameEnquiryRes = await transactPayService.nameEnquiry({
        accountNumber: cleanAccount,
        bankCode: input.bankCode.trim(),
      });

      if (nameEnquiryRes?.accountName) {
        verifiedAccountName = nameEnquiryRes.accountName;
        paymentVerificationNotes = `TransactPay Name Enquiry confirmed beneficiary: ${verifiedAccountName}`;
      }
    } catch (neErr: any) {
      logger.warn('[AdpOperatorService] Bank name enquiry failed or timed out:', neErr.message);
      // Fallback to manual review so applicant is not blocked by third-party latency
      paymentVerificationStatus = 'MANUAL_REVIEW';
      paymentVerificationNotes = `Auto name enquiry failed: ${neErr.message || 'Unknown error'}. Requires manual Finance review.`;
    }

    // 5. Encrypt bank account number at rest using AES-256-GCM
    const accountNumberEncrypted = encryptSensitiveData(cleanAccount);
    const accountNumberMasked = maskAccountNumber(cleanAccount);
    const applicationReference = this.generateApplicationReference();

    const adpRecord = {
      applicationReference,
      userId,
      coverageZoneId: input.coverageZoneId,
      fullName: input.fullName.trim(),
      matricNumber: input.matricNumber.trim(),
      normalizedMatric,
      institution: input.institution?.trim() || 'University of Ilesa (UNILESA)',
      faculty: input.faculty.trim(),
      department: input.department.trim(),
      academicLevel: input.academicLevel.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      studentIdDocPath: input.studentIdDocPath.trim(),
      hostelName: input.hostelName.trim(),
      hostelAddress: input.hostelAddress.trim(),
      closestLandmark: input.closestLandmark?.trim() || null,
      bankName: input.bankName.trim(),
      bankCode: input.bankCode.trim(),
      accountNumberEncrypted,
      accountNumberMasked,
      accountName: input.accountName.trim(),
      nameEnquiryVerifiedName: verifiedAccountName,
      alternativeContact: input.alternativeContact?.trim() || null,
      status: 'PENDING_REVIEW',
      studentVerificationStatus: 'PENDING',
      hostelVerificationStatus: 'PENDING',
      paymentVerificationStatus,
      paymentVerificationNotes,
      isActive: false,
    };

    let createdRecord: any = null;

    try {
      createdRecord = await prisma.adpOperator.create({
        data: adpRecord as any,
      });

      // Write initial verification history audit entry
      await prisma.adpVerificationHistory.create({
        data: {
          adpOperatorId: createdRecord.id,
          track: 'OVERALL',
          oldStatus: 'NONE',
          newStatus: 'PENDING_REVIEW',
          reason: 'Initial student application submission',
        },
      });
    } catch (dbErr: any) {
      logger.warn('[AdpOperatorService] Prisma create failed, trying Supabase fallback:', dbErr.message);
      if (!supabaseAdmin) {
        throw new Error('Database service unavailable: ' + dbErr.message);
      }
      const { data, error } = await supabaseAdmin
        .from('AdpOperator')
        .insert([adpRecord])
        .select()
        .single();

      if (error || !data) {
        logger.error('[AdpOperatorService] Supabase insert failed:', error);
        throw new Error(`Failed to save application: ${error?.message || 'Database error'}`);
      }

      createdRecord = data;

      // Audit history fallback
      await supabaseAdmin.from('AdpVerificationHistory').insert([
        {
          adpOperatorId: createdRecord.id,
          track: 'OVERALL',
          oldStatus: 'NONE',
          newStatus: 'PENDING_REVIEW',
          reason: 'Initial student application submission',
        },
      ]);
    }

    // Do NOT return encrypted details in the response
    return {
      id: createdRecord.id,
      applicationReference: createdRecord.applicationReference,
      status: createdRecord.status,
      studentVerificationStatus: createdRecord.studentVerificationStatus,
      hostelVerificationStatus: createdRecord.hostelVerificationStatus,
      paymentVerificationStatus: createdRecord.paymentVerificationStatus,
      nameEnquiryVerifiedName: createdRecord.nameEnquiryVerifiedName,
      accountNumberMasked: createdRecord.accountNumberMasked,
      createdAt: createdRecord.createdAt,
    };
  }

  /**
   * Retrieves all applications submitted by a specific user.
   */
  async getMyApplications(userId: string) {
    try {
      const records = await prisma.adpOperator.findMany({
        where: { userId },
        include: { coverageZone: true },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.sanitizeOperatorRecord(r));
    } catch {
      if (!supabaseAdmin) return [];
      const { data, error } = await supabaseAdmin
        .from('AdpOperator')
        .select('*, coverageZone:CoverageZone(*)')
        .eq('userId', userId)
        .order('createdAt', { ascending: false });

      if (error) {
        logger.error('[AdpOperatorService] getMyApplications fallback failed:', error);
        return [];
      }

      return (data || []).map((r) => this.sanitizeOperatorRecord(r));
    }
  }

  /**
   * Retrieves all applications for administrative and operational verification.
   */
  async listApplicationsForAdmin(filters?: { zoneId?: string; status?: string; search?: string }) {
    try {
      const where: any = {};
      if (filters?.zoneId) where.coverageZoneId = filters.zoneId;
      if (filters?.status) where.status = filters.status;
      if (filters?.search) {
        where.OR = [
          { fullName: { contains: filters.search, mode: 'insensitive' } },
          { matricNumber: { contains: filters.search, mode: 'insensitive' } },
          { applicationReference: { contains: filters.search, mode: 'insensitive' } },
          { hostelName: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const records = await prisma.adpOperator.findMany({
        where,
        include: {
          coverageZone: true,
          histories: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.sanitizeOperatorRecord(r));
    } catch {
      if (!supabaseAdmin) return [];
      let query = supabaseAdmin
        .from('AdpOperator')
        .select('*, coverageZone:CoverageZone(*), verificationHistories:AdpVerificationHistory(*)')
        .order('createdAt', { ascending: false });

      if (filters?.zoneId) query = query.eq('coverageZoneId', filters.zoneId);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) {
        logger.error('[AdpOperatorService] listApplicationsForAdmin fallback failed:', error);
        return [];
      }

      let res = (data || []).map((r) => this.sanitizeOperatorRecord(r));
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        res = res.filter(
          (r: any) =>
            r.fullName?.toLowerCase().includes(s) ||
            r.matricNumber?.toLowerCase().includes(s) ||
            r.applicationReference?.toLowerCase().includes(s) ||
            r.hostelName?.toLowerCase().includes(s)
        );
      }
      return res;
    }
  }

  /**
   * Fetch a single application by ID
   */
  async getApplicationById(id: string) {
    try {
      const record = await prisma.adpOperator.findUnique({
        where: { id },
        include: {
          coverageZone: true,
          histories: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!record) throw new NotFoundError('ADP operator application not found');
      return this.sanitizeOperatorRecord(record);
    } catch (e: any) {
      if (e instanceof NotFoundError) throw e;
      if (!supabaseAdmin) throw new NotFoundError('ADP application not found');
      const { data, error } = await supabaseAdmin
        .from('AdpOperator')
        .select('*, coverageZone:CoverageZone(*), verificationHistories:AdpVerificationHistory(*)')
        .eq('id', id)
        .single();
      if (error || !data) throw new NotFoundError('ADP application not found');
      return this.sanitizeOperatorRecord(data);
    }
  }

  /**
   * Verify an individual track: STUDENT | HOSTEL | PAYMENT
   */
  async verifyTrack(params: {
    operatorId: string;
    track: 'STUDENT' | 'HOSTEL' | 'PAYMENT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED' | 'MANUAL_REVIEW';
    notes?: string;
    officerUserId: string;
  }) {
    const operator = await this.getApplicationById(params.operatorId);

    // Guard: Officers cannot verify their own application
    if (params.officerUserId === operator.userId) {
      throw new BadRequestError('Security violation: You cannot verify or approve your own application.');
    }

    const trackFieldMap = {
      STUDENT: {
        statusField: 'studentVerificationStatus',
        notesField: 'studentVerificationNotes',
        byField: 'studentVerifiedBy',
        atField: 'studentVerifiedAt',
      },
      HOSTEL: {
        statusField: 'hostelVerificationStatus',
        notesField: 'hostelVerificationNotes',
        byField: 'hostelVerifiedBy',
        atField: 'hostelVerifiedAt',
      },
      PAYMENT: {
        statusField: 'paymentVerificationStatus',
        notesField: 'paymentVerificationNotes',
        byField: 'paymentVerifiedBy',
        atField: 'paymentVerifiedAt',
      },
    } as const;

    const fields = trackFieldMap[params.track];
    const oldStatus = operator[fields.statusField] || 'PENDING';
    const now = new Date();

    const updateData: any = {
      [fields.statusField]: params.status,
      [fields.notesField]: params.notes || null,
      [fields.byField]: params.officerUserId,
      [fields.atField]: now,
      updatedAt: now,
    };

    // If any track is rejected, update overall status
    if (params.status === 'REJECTED') {
      updateData.status = 'REJECTED';
      updateData.rejectionReason = `Rejected on ${params.track} track: ${params.notes || 'Did not meet criteria'}`;
    } else if (params.status === 'INFO_REQUESTED') {
      updateData.status = 'INFO_REQUESTED';
    } else if (operator.status === 'PENDING_REVIEW') {
      updateData.status = 'UNDER_VERIFICATION';
    }

    try {
      await prisma.adpOperator.update({
        where: { id: params.operatorId },
        data: updateData,
      });

      await prisma.adpVerificationHistory.create({
        data: {
          adpOperatorId: params.operatorId,
          track: params.track,
          oldStatus,
          newStatus: params.status,
          reason: params.notes || `Track ${params.track} updated to ${params.status}`,
          officerUserId: params.officerUserId,
        },
      });
    } catch {
      if (supabaseAdmin) {
        await supabaseAdmin.from('AdpOperator').update(updateData).eq('id', params.operatorId);
        await supabaseAdmin.from('AdpVerificationHistory').insert([
          {
            adpOperatorId: params.operatorId,
            track: params.track,
            oldStatus,
            newStatus: params.status,
            reason: params.notes || `Track ${params.track} updated to ${params.status}`,
            officerUserId: params.officerUserId,
          },
        ]);
      }
    }

    return this.getApplicationById(params.operatorId);
  }

  /**
   * Final activation: sets status = APPROVED, isActive = true, assigns role
   * Requires ALL three verification tracks to be APPROVED.
   */
  async approveAndActivateOperator(params: {
    operatorId: string;
    officerUserId: string;
    notes?: string;
  }) {
    const operator = await this.getApplicationById(params.operatorId);

    if (params.officerUserId === operator.userId) {
      throw new BadRequestError('Security violation: You cannot approve your own application.');
    }

    if (
      operator.studentVerificationStatus !== 'APPROVED' ||
      operator.hostelVerificationStatus !== 'APPROVED' ||
      operator.paymentVerificationStatus !== 'APPROVED'
    ) {
      throw new BadRequestError(
        'Cannot activate delivery port. All three tracks (Student Identity, Hostel Location, Payment Details) must be APPROVED first.'
      );
    }

    const now = new Date();
    const updateData = {
      status: 'APPROVED',
      isActive: true,
      updatedAt: now,
    };

    try {
      await prisma.adpOperator.update({
        where: { id: params.operatorId },
        data: updateData,
      });

      // Assign AdpOperator role to user if role exists
      const adpRole = await prisma.role.findUnique({ where: { name: 'AdpOperator' } });
      if (adpRole) {
        await prisma.user.update({
          where: { id: operator.userId },
          data: { roleId: adpRole.id },
        });
      }

      await prisma.adpVerificationHistory.create({
        data: {
          adpOperatorId: params.operatorId,
          track: 'OVERALL',
          oldStatus: operator.status,
          newStatus: 'APPROVED',
          reason: params.notes || 'All 3 tracks approved. Operator activated.',
          officerUserId: params.officerUserId,
        },
      });
    } catch {
      if (supabaseAdmin) {
        await supabaseAdmin.from('AdpOperator').update(updateData).eq('id', params.operatorId);
        const { data: roleData } = await supabaseAdmin
          .from('Role')
          .select('id')
          .eq('name', 'AdpOperator')
          .maybeSingle();

        if (roleData?.id) {
          await supabaseAdmin.from('User').update({ roleId: roleData.id }).eq('id', operator.userId);
        }

        await supabaseAdmin.from('AdpVerificationHistory').insert([
          {
            adpOperatorId: params.operatorId,
            track: 'OVERALL',
            oldStatus: operator.status,
            newStatus: 'APPROVED',
            reason: params.notes || 'All 3 tracks approved. Operator activated.',
            officerUserId: params.officerUserId,
          },
        ]);
      }
    }

    return this.getApplicationById(params.operatorId);
  }

  /**
   * Suspend an active operator with mandatory reason
   */
  async suspendOperator(params: { operatorId: string; officerUserId: string; reason: string }) {
    if (!params.reason?.trim()) {
      throw new BadRequestError('A specific suspension reason is required.');
    }
    const operator = await this.getApplicationById(params.operatorId);

    const now = new Date();
    const updateData = {
      status: 'SUSPENDED',
      isActive: false,
      suspensionReason: params.reason.trim(),
      updatedAt: now,
    };

    try {
      await prisma.adpOperator.update({
        where: { id: params.operatorId },
        data: updateData,
      });

      await prisma.adpVerificationHistory.create({
        data: {
          adpOperatorId: params.operatorId,
          track: 'OVERALL',
          oldStatus: operator.status,
          newStatus: 'SUSPENDED',
          reason: params.reason.trim(),
          officerUserId: params.officerUserId,
        },
      });
    } catch {
      if (supabaseAdmin) {
        await supabaseAdmin.from('AdpOperator').update(updateData).eq('id', params.operatorId);
        await supabaseAdmin.from('AdpVerificationHistory').insert([
          {
            adpOperatorId: params.operatorId,
            track: 'OVERALL',
            oldStatus: operator.status,
            newStatus: 'SUSPENDED',
            reason: params.reason.trim(),
            officerUserId: params.officerUserId,
          },
        ]);
      }
    }

    return this.getApplicationById(params.operatorId);
  }

  /**
   * Block an operator permanently with mandatory reason
   */
  async blockOperator(params: { operatorId: string; officerUserId: string; reason: string }) {
    if (!params.reason?.trim()) {
      throw new BadRequestError('A specific blocking reason is required.');
    }
    const operator = await this.getApplicationById(params.operatorId);

    const now = new Date();
    const updateData = {
      status: 'BLOCKED',
      isActive: false,
      rejectionReason: params.reason.trim(),
      updatedAt: now,
    };

    try {
      await prisma.adpOperator.update({
        where: { id: params.operatorId },
        data: updateData,
      });

      await prisma.adpVerificationHistory.create({
        data: {
          adpOperatorId: params.operatorId,
          track: 'OVERALL',
          oldStatus: operator.status,
          newStatus: 'BLOCKED',
          reason: params.reason.trim(),
          officerUserId: params.officerUserId,
        },
      });
    } catch {
      if (supabaseAdmin) {
        await supabaseAdmin.from('AdpOperator').update(updateData).eq('id', params.operatorId);
        await supabaseAdmin.from('AdpVerificationHistory').insert([
          {
            adpOperatorId: params.operatorId,
            track: 'OVERALL',
            oldStatus: operator.status,
            newStatus: 'BLOCKED',
            reason: params.reason.trim(),
            officerUserId: params.officerUserId,
          },
        ]);
      }
    }

    return this.getApplicationById(params.operatorId);
  }

  /**
   * Returns a 15-minute signed URL to securely view an applicant's student ID card.
   */
  async getStudentDocumentSignedUrl(operatorId: string, _officerUserId: string) {
    const operator = await this.getApplicationById(operatorId);
    if (!operator?.studentIdDocPath) {
      throw new NotFoundError('No verification document attached to this application');
    }
    const { storageService } = await import('./storage.service');
    return storageService.createSignedDownloadUrl(operator.studentIdDocPath, 900);
  }

  /**
   * Strips out raw encrypted fields before returning to frontend.
   */
  private sanitizeOperatorRecord(record: any) {
    const { accountNumberEncrypted, ...safe } = record;
    return safe;
  }
}

export const adpOperatorService = new AdpOperatorService();
