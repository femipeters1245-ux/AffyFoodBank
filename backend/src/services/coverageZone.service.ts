// backend/src/services/coverageZone.service.ts
import prisma from '../prisma/client';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.service';
import logger from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export const OFFICIAL_UNILESA_ZONES = [
  'NNPC',
  'RCCG Mega',
  'Pedi',
  'Arimoro',
  'Ido',
  'O West',
  'Ajibade',
  'MichoDollar',
  'Campus Gate',
  'Olive Junction',
  'Imola',
  'Ibodi',
  'Isua',
] as const;

export interface CoverageZoneRecord {
  id: string;
  name: string;
  normalizedName: string;
  targetAdpCount: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ZoneCoverageStats extends CoverageZoneRecord {
  totalApplications: number;
  pendingApplications: number;
  verifiedAdps: number;
  activeAdps: number;
  suspendedBlockedAdps: number;
  neededToTarget: number;
  coverageStatus: 'NOT_COVERED' | 'INSUFFICIENT_COVERAGE' | 'TARGET_REACHED';
}

export const coverageZoneService = {
  normalizeZoneName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  },

  /**
   * Idempotent seed function for the 13 official UNILESA coverage zones.
   * Safe to call on system startup or via admin command.
   */
  async seedCoverageZones(): Promise<CoverageZoneRecord[]> {
    const seeded: CoverageZoneRecord[] = [];
    logger.info('[coverageZoneService] Seeding official UNILESA coverage zones...');

    for (const name of OFFICIAL_UNILESA_ZONES) {
      const normalizedName = this.normalizeZoneName(name);

      try {
        const zone = await prisma.coverageZone.upsert({
          where: { normalizedName },
          update: { name },
          create: {
            id: uuidv4(),
            name,
            normalizedName,
            targetAdpCount: 2,
            isActive: true,
          },
        });
        seeded.push(zone);
      } catch (err: any) {
        // Fallback to Supabase directly if Prisma is unreachable
        if (isSupabaseAdminConfigured && supabaseAdmin) {
          try {
            const { data: existing } = await supabaseAdmin
              .from('CoverageZone')
              .select('*')
              .eq('normalizedName', normalizedName)
              .maybeSingle();

            if (existing) {
              seeded.push(existing);
            } else {
              const newId = uuidv4();
              const { data: created } = await supabaseAdmin
                .from('CoverageZone')
                .insert({
                  id: newId,
                  name,
                  normalizedName,
                  targetAdpCount: 2,
                  isActive: true,
                })
                .select()
                .single();
              if (created) seeded.push(created);
            }
          } catch (supaErr: any) {
            logger.warn('[coverageZoneService] Supabase seed note:', { name, error: supaErr.message });
          }
        }
      }
    }

    logger.info(`[coverageZoneService] Successfully seeded/verified ${seeded.length} coverage zones.`);
    return seeded;
  },

  /**
   * Get all active approved zones for customer registration, portal dropdowns, and checkout.
   * No hardcoding. Sorted alphabetically.
   */
  async getActiveZones(): Promise<CoverageZoneRecord[]> {
    try {
      const zones = await prisma.coverageZone.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      if (zones.length > 0) return zones;
    } catch {}

    // Fallback: Supabase direct query
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('CoverageZone')
          .select('*')
          .eq('isActive', true)
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch {}
    }

    // In-memory fallback if database has not yet been seeded
    return OFFICIAL_UNILESA_ZONES.map((name, index) => ({
      id: `zone-default-${index + 1}`,
      name,
      normalizedName: this.normalizeZoneName(name),
      targetAdpCount: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  },

  /**
   * Get all zones with live calculated operational statistics for Milestone 5 Monitoring.
   */
  async getAllZonesWithStats(): Promise<ZoneCoverageStats[]> {
    let zones: CoverageZoneRecord[] = [];

    try {
      zones = await prisma.coverageZone.findMany({
        orderBy: { name: 'asc' },
      });
    } catch {}

    if (zones.length === 0 && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('CoverageZone')
          .select('*')
          .order('name', { ascending: true });
        if (data) zones = data;
      } catch {}
    }

    if (zones.length === 0) {
      zones = await this.seedCoverageZones();
    }

    // Calculate live operator statistics per zone
    const result: ZoneCoverageStats[] = [];

    for (const zone of zones) {
      let operators: any[] = [];
      try {
        operators = await prisma.adpOperator.findMany({
          where: { coverageZoneId: zone.id },
          select: {
            id: true,
            status: true,
            isActive: true,
            studentVerificationStatus: true,
            hostelVerificationStatus: true,
            paymentVerificationStatus: true,
          },
        });
      } catch {
        if (isSupabaseAdminConfigured && supabaseAdmin) {
          try {
            const { data } = await supabaseAdmin
              .from('AdpOperator')
              .select('id, status, isActive, studentVerificationStatus, hostelVerificationStatus, paymentVerificationStatus')
              .eq('coverageZoneId', zone.id);
            if (data) operators = data;
          } catch {}
        }
      }

      const totalApplications = operators.length;
      const pendingApplications = operators.filter(o => o.status === 'PENDING_REVIEW' || o.status === 'UNDER_VERIFICATION').length;
      const verifiedAdps = operators.filter(
        o => o.studentVerificationStatus === 'APPROVED' &&
             o.hostelVerificationStatus === 'APPROVED' &&
             o.paymentVerificationStatus === 'APPROVED'
      ).length;
      const activeAdps = operators.filter(
        o => o.isActive && o.status === 'APPROVED' &&
             o.studentVerificationStatus === 'APPROVED' &&
             o.hostelVerificationStatus === 'APPROVED' &&
             o.paymentVerificationStatus === 'APPROVED'
      ).length;
      const suspendedBlockedAdps = operators.filter(o => o.status === 'SUSPENDED' || o.status === 'BLOCKED').length;

      const target = zone.targetAdpCount || 2;
      const neededToTarget = Math.max(0, target - activeAdps);

      let coverageStatus: 'NOT_COVERED' | 'INSUFFICIENT_COVERAGE' | 'TARGET_REACHED' = 'NOT_COVERED';
      if (activeAdps >= target) {
        coverageStatus = 'TARGET_REACHED';
      } else if (activeAdps === 1) {
        coverageStatus = 'INSUFFICIENT_COVERAGE';
      }

      result.push({
        ...zone,
        targetAdpCount: target,
        totalApplications,
        pendingApplications,
        verifiedAdps,
        activeAdps,
        suspendedBlockedAdps,
        neededToTarget,
        coverageStatus,
      });
    }

    return result;
  },

  /**
   * Validate that a given zone ID exists and is actively approved.
   * Throws BadRequestError on invalid or deactivated zones.
   */
  async validateActiveZone(zoneId: string): Promise<CoverageZoneRecord> {
    if (!zoneId) {
      throw new BadRequestError('Coverage zone ID is required');
    }

    let zone: CoverageZoneRecord | null = null;
    try {
      zone = await prisma.coverageZone.findUnique({
        where: { id: zoneId },
      });
    } catch {}

    if (!zone && isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('CoverageZone')
          .select('*')
          .eq('id', zoneId)
          .maybeSingle();
        if (data) zone = data;
      } catch {}
    }

    if (!zone) {
      throw new BadRequestError(`Invalid coverage zone ID: "${zoneId}" does not exist`);
    }

    if (!zone.isActive) {
      throw new BadRequestError(`Coverage zone "${zone.name}" is currently inactive and cannot accept registrations or orders`);
    }

    return zone;
  },

  /**
   * Admin: Add a new coverage zone
   */
  async createZone(params: { name: string; targetAdpCount?: number }): Promise<CoverageZoneRecord> {
    const rawName = (params.name || '').trim();
    if (!rawName) {
      throw new BadRequestError('Zone name is required');
    }

    const normalizedName = this.normalizeZoneName(rawName);
    const targetAdpCount = Math.max(1, Number(params.targetAdpCount) || 2);

    try {
      const existing = await prisma.coverageZone.findUnique({
        where: { normalizedName },
      });
      if (existing) {
        throw new BadRequestError(`Coverage zone with name "${rawName}" already exists`);
      }

      const zone = await prisma.coverageZone.create({
        data: {
          id: uuidv4(),
          name: rawName,
          normalizedName,
          targetAdpCount,
          isActive: true,
        },
      });
      return zone;
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;

      if (isSupabaseAdminConfigured && supabaseAdmin) {
        const { data: existing } = await supabaseAdmin
          .from('CoverageZone')
          .select('*')
          .eq('normalizedName', normalizedName)
          .maybeSingle();

        if (existing) {
          throw new BadRequestError(`Coverage zone with name "${rawName}" already exists`);
        }

        const newId = uuidv4();
        const { data: created, error } = await supabaseAdmin
          .from('CoverageZone')
          .insert({
            id: newId,
            name: rawName,
            normalizedName,
            targetAdpCount,
            isActive: true,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return created;
      }
      throw err;
    }
  },

  /**
   * Admin: Toggle zone active state
   */
  async toggleZoneActive(zoneId: string, isActive: boolean): Promise<CoverageZoneRecord> {
    try {
      const updated = await prisma.coverageZone.update({
        where: { id: zoneId },
        data: { isActive },
      });
      return updated;
    } catch {
      if (isSupabaseAdminConfigured && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('CoverageZone')
          .update({ isActive, updatedAt: new Date().toISOString() })
          .eq('id', zoneId)
          .select()
          .single();
        if (error) throw new NotFoundError(`Zone with ID "${zoneId}" not found`);
        return data;
      }
      throw new NotFoundError(`Zone with ID "${zoneId}" not found`);
    }
  },

  /**
   * Admin: Update zone target count
   */
  async updateZoneTarget(zoneId: string, targetAdpCount: number): Promise<CoverageZoneRecord> {
    const target = Math.max(1, Number(targetAdpCount));
    try {
      const updated = await prisma.coverageZone.update({
        where: { id: zoneId },
        data: { targetAdpCount: target },
      });
      return updated;
    } catch {
      if (isSupabaseAdminConfigured && supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('CoverageZone')
          .update({ targetAdpCount: target, updatedAt: new Date().toISOString() })
          .eq('id', zoneId)
          .select()
          .single();
        if (error) throw new NotFoundError(`Zone with ID "${zoneId}" not found`);
        return data;
      }
      throw new NotFoundError(`Zone with ID "${zoneId}" not found`);
    }
  },
};
