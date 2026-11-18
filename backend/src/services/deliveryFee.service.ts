// backend/src/services/deliveryFee.service.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from './supabase-admin.service';
import { BadRequestError } from '../utils/errors';

export interface DeliveryFeeConfig {
  id?: string;
  standardFeeCents: number;
  freeDeliveryThresholdCents: number;
  expressFeeCents: number;
  stateFees: Record<string, number>;
  isActive?: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_DELIVERY_CONFIG: DeliveryFeeConfig = {
  standardFeeCents: 150000, // ₦1,500 within Ilesa
  freeDeliveryThresholdCents: 5000000, // ₦50,000 (0 to disable)
  expressFeeCents: 250000, // ₦2,500
  stateFees: {
    'Ilesa Central (Roundabout, Isokun, Imo)': 120000,
    'Ilesa West (Breweries, Omi Aladiye, Ereja)': 150000,
    'Ilesa East (Grammar School, Bolorunduro, Irojo)': 150000,
    'Ijebu-Jesa / Oriade': 200000,
    'Ipetu-Ijesha': 250000,
    'Ibokun / Obokun': 220000,
    'Osogbo (State Capital)': 300000,
    'Ile-Ife (Campus & Town)': 300000,
    'Other Osun State Locations': 350000,
    Default: 150000,
  },
  isActive: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default',
};

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CONFIG_PATH = path.join(DATA_DIR, 'delivery_fee_config.json');

// Memory cache with 30s TTL
let cachedConfig: DeliveryFeeConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

/**
 * Validate delivery configuration inputs strictly
 */
export function validateDeliveryFeeConfig(cfg: Partial<DeliveryFeeConfig>): void {
  if (cfg.standardFeeCents !== undefined) {
    const val = Number(cfg.standardFeeCents);
    if (!Number.isFinite(val) || val < 0 || val > 50000000) {
      throw new BadRequestError('Standard delivery fee must be a valid non-negative number up to ₦500,000');
    }
  }

  if (cfg.freeDeliveryThresholdCents !== undefined) {
    const val = Number(cfg.freeDeliveryThresholdCents);
    if (!Number.isFinite(val) || val < 0 || val > 500000000) {
      throw new BadRequestError('Free delivery threshold must be a valid non-negative number up to ₦5,000,000');
    }
  }

  if (cfg.expressFeeCents !== undefined) {
    const val = Number(cfg.expressFeeCents);
    if (!Number.isFinite(val) || val < 0 || val > 50000000) {
      throw new BadRequestError('Express surcharge fee must be a valid non-negative number up to ₦500,000');
    }
  }

  if (cfg.stateFees !== undefined) {
    if (typeof cfg.stateFees !== 'object' || cfg.stateFees === null) {
      throw new BadRequestError('Location fees must be a valid key-value object');
    }
    for (const [zone, fee] of Object.entries(cfg.stateFees)) {
      const val = Number(fee);
      if (!Number.isFinite(val) || val < 0 || val > 50000000) {
        throw new BadRequestError(`Invalid delivery rate for "${zone}": must be a non-negative number`);
      }
    }
  }
}

/**
 * Reads the authoritative delivery fee configuration.
 * Priority: Fresh Memory Cache -> Supabase DeliveryFeeConfig -> Supabase AuditLog -> Local File -> Default
 */
export async function getDeliveryFeeConfig(): Promise<DeliveryFeeConfig> {
  const now = Date.now();
  if (cachedConfig && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedConfig;
  }

  // 1. Attempt query from Supabase DeliveryFeeConfig table
  if (supabaseAdmin) {
    try {
      const { data: tableData, error: tableErr } = await supabaseAdmin
        .from('DeliveryFeeConfig')
        .select('*')
        .eq('isActive', true)
        .order('updatedAt', { ascending: false })
        .limit(1);

      if (!tableErr && tableData && tableData.length > 0) {
        const row = tableData[0];
        const loaded: DeliveryFeeConfig = {
          id: row.id,
          standardFeeCents: Number(row.standardFeeCents),
          freeDeliveryThresholdCents: Number(row.freeDeliveryThresholdCents),
          expressFeeCents: Number(row.expressFeeCents),
          stateFees: typeof row.stateFees === 'object' ? row.stateFees : JSON.parse(row.stateFees || '{}'),
          isActive: row.isActive,
          updatedAt: row.updatedAt || new Date().toISOString(),
          updatedBy: row.updatedBy || 'Staff',
        };
        cachedConfig = loaded;
        lastCacheTime = now;
        persistLocalBackup(loaded);
        return loaded;
      }
    } catch {}

    // 2. Query Supabase AuditLog storage (persistent cloud JSON storage)
    try {
      const { data: auditData, error: auditErr } = await supabaseAdmin
        .from('AuditLog')
        .select('*')
        .eq('targetTable', 'DeliveryFeeConfig')
        .eq('action', 'DELIVERY_CONFIG_UPDATE')
        .order('createdAt', { ascending: false })
        .limit(1);

      if (!auditErr && auditData && auditData.length > 0) {
        const raw = auditData[0].newValues as any;
        if (raw && typeof raw.standardFeeCents === 'number') {
          const loaded: DeliveryFeeConfig = {
            standardFeeCents: Number(raw.standardFeeCents),
            freeDeliveryThresholdCents: Number(raw.freeDeliveryThresholdCents),
            expressFeeCents: Number(raw.expressFeeCents),
            stateFees: raw.stateFees || DEFAULT_DELIVERY_CONFIG.stateFees,
            isActive: true,
            updatedAt: raw.updatedAt || auditData[0].createdAt,
            updatedBy: raw.updatedBy || 'Staff',
          };
          cachedConfig = loaded;
          lastCacheTime = now;
          persistLocalBackup(loaded);
          return loaded;
        }
      }
    } catch (err: any) {
      console.warn('[deliveryFee] Supabase fetch warning:', err?.message);
    }
  }

  // 3. Fallback to durable local file storage
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      cachedConfig = { ...DEFAULT_DELIVERY_CONFIG, ...parsed };
      lastCacheTime = now;
      return cachedConfig!;
    }
  } catch {}

  cachedConfig = { ...DEFAULT_DELIVERY_CONFIG };
  lastCacheTime = now;
  return cachedConfig;
}

function persistLocalBackup(config: DeliveryFeeConfig): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch {}
}

/**
 * Updates the authoritative delivery fee configuration.
 * Writes permanently to Supabase and syncs local cache.
 */
export async function updateDeliveryFeeConfig(
  newConfig: Partial<DeliveryFeeConfig>,
  updatedBy?: string
): Promise<DeliveryFeeConfig> {
  validateDeliveryFeeConfig(newConfig);

  const current = await getDeliveryFeeConfig();
  const merged: DeliveryFeeConfig = {
    ...current,
    standardFeeCents: newConfig.standardFeeCents !== undefined ? Math.round(Number(newConfig.standardFeeCents)) : current.standardFeeCents,
    freeDeliveryThresholdCents: newConfig.freeDeliveryThresholdCents !== undefined ? Math.round(Number(newConfig.freeDeliveryThresholdCents)) : current.freeDeliveryThresholdCents,
    expressFeeCents: newConfig.expressFeeCents !== undefined ? Math.round(Number(newConfig.expressFeeCents)) : current.expressFeeCents,
    stateFees: {
      ...current.stateFees,
      ...(newConfig.stateFees || {}),
    },
    isActive: true,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy || 'Staff',
  };

  let writeSucceeded = false;

  // 1. Try updating or inserting into Supabase DeliveryFeeConfig table
  if (supabaseAdmin) {
    try {
      const { data: existingRows } = await supabaseAdmin
        .from('DeliveryFeeConfig')
        .select('id')
        .limit(1);

      if (existingRows && existingRows.length > 0) {
        const { error: updErr } = await supabaseAdmin
          .from('DeliveryFeeConfig')
          .update({
            standardFeeCents: merged.standardFeeCents,
            freeDeliveryThresholdCents: merged.freeDeliveryThresholdCents,
            expressFeeCents: merged.expressFeeCents,
            stateFees: merged.stateFees,
            isActive: true,
            updatedBy: merged.updatedBy,
            updatedAt: merged.updatedAt,
          })
          .eq('id', existingRows[0].id);

        if (!updErr) writeSucceeded = true;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from('DeliveryFeeConfig')
          .insert({
            id: uuidv4(),
            standardFeeCents: merged.standardFeeCents,
            freeDeliveryThresholdCents: merged.freeDeliveryThresholdCents,
            expressFeeCents: merged.expressFeeCents,
            stateFees: merged.stateFees,
            isActive: true,
            updatedBy: merged.updatedBy,
            updatedAt: merged.updatedAt,
          });

        if (!insErr) writeSucceeded = true;
      }
    } catch {}

    // 2. Persist to Supabase AuditLog (permanent cloud JSON store)
    try {
      const { error: auditErr } = await supabaseAdmin
        .from('AuditLog')
        .insert({
          id: uuidv4(),
          action: 'DELIVERY_CONFIG_UPDATE',
          targetTable: 'DeliveryFeeConfig',
          targetId: 'active-config',
          newValues: merged,
          ipAddress: 'admin-portal',
        });

      if (!auditErr) writeSucceeded = true;
    } catch (err: any) {
      console.warn('[deliveryFee] Supabase write warning:', err?.message);
    }
  }

  // 3. Persist local backup
  persistLocalBackup(merged);
  cachedConfig = merged;
  lastCacheTime = Date.now();

  return merged;
}

/**
 * Authoritative Server-Side Delivery Fee Recomputation
 * Computes exact fee based on products subtotal, destination, and express flag.
 */
export async function calculateAuthoritativeDeliveryFee(
  subtotalCents: number,
  location?: string,
  isExpress = false
): Promise<{
  deliveryFeeCents: number;
  baseDeliveryFeeCents: number;
  expressFeeCents: number;
  isFree: boolean;
  location: string;
  isExpress: boolean;
}> {
  const config = await getDeliveryFeeConfig();
  const subtotal = Math.max(0, Number(subtotalCents) || 0);

  let baseFee = 0;
  let isFree = false;

  // 1. Check free delivery threshold
  if (config.freeDeliveryThresholdCents > 0 && subtotal >= config.freeDeliveryThresholdCents) {
    baseFee = 0;
    isFree = true;
  } else {
    // 2. Location lookup
    const locKey = (location || '').trim();
    const locFee = locKey ? config.stateFees?.[locKey] : undefined;

    if (typeof locFee === 'number' && locFee >= 0) {
      baseFee = locFee;
    } else {
      // Fallback to Default region or standard flat fee
      baseFee = config.stateFees?.['Default'] ?? config.standardFeeCents;
    }
  }

  // 3. Priority / Express delivery surcharge
  const expressFee = isExpress ? (config.expressFeeCents ?? 0) : 0;
  const totalDeliveryFeeCents = baseFee + expressFee;

  return {
    deliveryFeeCents: totalDeliveryFeeCents,
    baseDeliveryFeeCents: baseFee,
    expressFeeCents: expressFee,
    isFree,
    location: location || 'Default',
    isExpress,
  };
}
