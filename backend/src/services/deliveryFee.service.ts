// backend/src/services/deliveryFee.service.ts
import fs from 'fs';
import path from 'path';

export interface DeliveryFeeConfig {
  standardFeeCents: number;
  freeDeliveryThresholdCents: number;
  expressFeeCents: number;
  stateFees?: Record<string, number>;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_DELIVERY_CONFIG: DeliveryFeeConfig = {
  standardFeeCents: 250000, // ₦2,500
  freeDeliveryThresholdCents: 10000000, // ₦100,000 (0 means free delivery disabled)
  expressFeeCents: 500000, // ₦5,000
  stateFees: {
    Lagos: 250000,
    Ogun: 350000,
    Abuja: 450000,
    Rivers: 500000,
    Oyo: 350000,
    Default: 250000,
  },
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default',
};

const CONFIG_PATH = path.join(
  process.platform === 'win32' ? process.cwd() : '/tmp',
  'affy_delivery_fee_config.json'
);

let cachedConfig: DeliveryFeeConfig | null = null;

export function getDeliveryFeeConfig(): DeliveryFeeConfig {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      cachedConfig = { ...DEFAULT_DELIVERY_CONFIG, ...JSON.parse(data) };
      return cachedConfig!;
    }
  } catch (err) {
    console.warn('[deliveryFee] Could not read config file, using default:', err);
  }
  cachedConfig = { ...DEFAULT_DELIVERY_CONFIG };
  return cachedConfig;
}

export function updateDeliveryFeeConfig(
  newConfig: Partial<DeliveryFeeConfig>,
  updatedBy?: string
): DeliveryFeeConfig {
  const current = getDeliveryFeeConfig();
  const merged: DeliveryFeeConfig = {
    ...current,
    ...newConfig,
    stateFees: {
      ...current.stateFees,
      ...(newConfig.stateFees || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy,
  };

  cachedConfig = merged;

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[deliveryFee] Could not persist config file:', err);
  }

  return merged;
}
