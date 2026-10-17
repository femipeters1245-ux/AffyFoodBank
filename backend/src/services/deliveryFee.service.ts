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
  standardFeeCents: 150000, // ₦1,500 within Ilesa
  freeDeliveryThresholdCents: 5000000, // ₦50,000
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
