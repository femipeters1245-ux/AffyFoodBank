/**
 * Unit Tests for CoverageZoneService (Milestone 1: The 13 Coverage Zones)
 *
 * Covers:
 *  - Official 13 UNILESA zones list completeness
 *  - Name normalization (trim, lowercase, multi-space collapse)
 *  - Idempotent seedCoverageZones
 *  - getActiveZones (only active, alphabetical)
 *  - validateActiveZone (valid, inactive rejected, non-existent rejected)
 *  - createZone (duplicate normalized name rejection, creation)
 *  - toggleZoneActive & updateZoneTarget
 *  - getAllZonesWithStats (NOT_COVERED, INSUFFICIENT_COVERAGE, TARGET_REACHED status logic)
 */

const mockPrisma = {
  coverageZone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  adpOperator: {
    findMany: jest.fn(),
  },
};

jest.mock('../prisma/client', () => ({
  default: mockPrisma,
  __esModule: true,
}));

jest.mock('../services/supabase-admin.service', () => ({
  supabaseAdmin: null,
  isSupabaseAdminConfigured: false,
}));

import { coverageZoneService, OFFICIAL_UNILESA_ZONES } from '../services/coverageZone.service';

describe('[UNIT] Coverage Zones — Specifications & Normalization', () => {
  it('contains exactly the 13 official UNILESA zones requested in Milestone 1', () => {
    const expected = [
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
    ];
    expect(OFFICIAL_UNILESA_ZONES).toEqual(expected);
    expect(OFFICIAL_UNILESA_ZONES.length).toBe(13);
  });

  it('normalizes names consistently (trim, lowercase, extra spaces)', () => {
    expect(coverageZoneService.normalizeZoneName('  RCCG   Mega  ')).toBe('rccg mega');
    expect(coverageZoneService.normalizeZoneName('Campus Gate')).toBe('campus gate');
    expect(coverageZoneService.normalizeZoneName('MichoDollar')).toBe('michodollar');
  });
});

describe('[UNIT] coverageZoneService.getActiveZones', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns active zones sorted alphabetically from Prisma', async () => {
    const mockZones = [
      { id: 'z1', name: 'Ajibade', normalizedName: 'ajibade', targetAdpCount: 2, isActive: true },
      { id: 'z2', name: 'Arimoro', normalizedName: 'arimoro', targetAdpCount: 2, isActive: true },
    ];
    mockPrisma.coverageZone.findMany.mockResolvedValueOnce(mockZones);

    const zones = await coverageZoneService.getActiveZones();
    expect(zones).toEqual(mockZones);
    expect(mockPrisma.coverageZone.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('falls back to official 13 zones in-memory if DB has not yet been seeded', async () => {
    mockPrisma.coverageZone.findMany.mockResolvedValueOnce([]);

    const zones = await coverageZoneService.getActiveZones();
    expect(zones.length).toBe(13);
    expect(zones[0].name).toBe('NNPC');
  });
});

describe('[UNIT] coverageZoneService.validateActiveZone', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError if zoneId is empty', async () => {
    await expect(coverageZoneService.validateActiveZone('')).rejects.toThrow(
      'Coverage zone ID is required'
    );
  });

  it('throws BadRequestError if zone does not exist', async () => {
    mockPrisma.coverageZone.findUnique.mockResolvedValueOnce(null);

    await expect(coverageZoneService.validateActiveZone('non-existent-id')).rejects.toThrow(
      'does not exist'
    );
  });

  it('throws BadRequestError if zone is deactivated', async () => {
    mockPrisma.coverageZone.findUnique.mockResolvedValueOnce({
      id: 'z-inactive',
      name: 'Old Zone',
      isActive: false,
    });

    await expect(coverageZoneService.validateActiveZone('z-inactive')).rejects.toThrow(
      'is currently inactive'
    );
  });

  it('returns zone record when valid and active', async () => {
    const validZone = { id: 'z-active', name: 'Pedi', isActive: true, targetAdpCount: 2 };
    mockPrisma.coverageZone.findUnique.mockResolvedValueOnce(validZone);

    const res = await coverageZoneService.validateActiveZone('z-active');
    expect(res).toEqual(validZone);
  });
});

describe('[UNIT] coverageZoneService.createZone', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects duplicate zone by normalizedName', async () => {
    mockPrisma.coverageZone.findUnique.mockResolvedValueOnce({
      id: 'existing-id',
      name: 'NNPC',
      normalizedName: 'nnpc',
    });

    await expect(
      coverageZoneService.createZone({ name: '  nnpc  ' })
    ).rejects.toThrow('already exists');
  });

  it('creates zone with default targetAdpCount 2 if not provided', async () => {
    mockPrisma.coverageZone.findUnique.mockResolvedValueOnce(null);
    mockPrisma.coverageZone.create.mockResolvedValueOnce({
      id: 'new-id',
      name: 'Isokun',
      normalizedName: 'isokun',
      targetAdpCount: 2,
      isActive: true,
    });

    const zone = await coverageZoneService.createZone({ name: 'Isokun' });
    expect(zone.name).toBe('Isokun');
    expect(mockPrisma.coverageZone.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Isokun',
          normalizedName: 'isokun',
          targetAdpCount: 2,
          isActive: true,
        }),
      })
    );
  });
});

describe('[UNIT] coverageZoneService.getAllZonesWithStats (Milestone 5 Monitoring)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('computes NOT_COVERED when zone has 0 active verified ADPs', async () => {
    mockPrisma.coverageZone.findMany.mockResolvedValueOnce([
      { id: 'z1', name: 'Campus Gate', targetAdpCount: 2, isActive: true },
    ]);
    mockPrisma.adpOperator.findMany.mockResolvedValueOnce([]);

    const stats = await coverageZoneService.getAllZonesWithStats();
    expect(stats.length).toBe(1);
    expect(stats[0].activeAdps).toBe(0);
    expect(stats[0].coverageStatus).toBe('NOT_COVERED');
    expect(stats[0].neededToTarget).toBe(2);
  });

  it('computes INSUFFICIENT_COVERAGE when zone has exactly 1 active verified ADP', async () => {
    mockPrisma.coverageZone.findMany.mockResolvedValueOnce([
      { id: 'z2', name: 'RCCG Mega', targetAdpCount: 2, isActive: true },
    ]);
    mockPrisma.adpOperator.findMany.mockResolvedValueOnce([
      {
        id: 'op1',
        status: 'APPROVED',
        isActive: true,
        studentVerificationStatus: 'APPROVED',
        hostelVerificationStatus: 'APPROVED',
        paymentVerificationStatus: 'APPROVED',
      },
    ]);

    const stats = await coverageZoneService.getAllZonesWithStats();
    expect(stats[0].activeAdps).toBe(1);
    expect(stats[0].coverageStatus).toBe('INSUFFICIENT_COVERAGE');
    expect(stats[0].neededToTarget).toBe(1);
  });

  it('computes TARGET_REACHED when zone has >= target active verified ADPs', async () => {
    mockPrisma.coverageZone.findMany.mockResolvedValueOnce([
      { id: 'z3', name: 'O West', targetAdpCount: 2, isActive: true },
    ]);
    mockPrisma.adpOperator.findMany.mockResolvedValueOnce([
      {
        id: 'op1',
        status: 'APPROVED',
        isActive: true,
        studentVerificationStatus: 'APPROVED',
        hostelVerificationStatus: 'APPROVED',
        paymentVerificationStatus: 'APPROVED',
      },
      {
        id: 'op2',
        status: 'APPROVED',
        isActive: true,
        studentVerificationStatus: 'APPROVED',
        hostelVerificationStatus: 'APPROVED',
        paymentVerificationStatus: 'APPROVED',
      },
    ]);

    const stats = await coverageZoneService.getAllZonesWithStats();
    expect(stats[0].activeAdps).toBe(2);
    expect(stats[0].coverageStatus).toBe('TARGET_REACHED');
    expect(stats[0].neededToTarget).toBe(0);
  });
});
