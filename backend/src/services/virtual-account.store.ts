// backend/src/services/virtual-account.store.ts
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../prisma/client';
import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.service';
import logger from '../utils/logger';

export interface VirtualAccountRecord {
  id: string;
  customerProfileId: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  accountName: string;
  accountReference: string;
  alias?: string;
  currency: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const VA_FILE = path.join(DATA_DIR, 'virtual_accounts.json');

// Concurrency Mutex: prevents two concurrent requests from creating duplicate accounts
const inFlightGenerations = new Map<string, Promise<any>>();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

function readLocalBackup(): VirtualAccountRecord[] {
  try {
    if (fs.existsSync(VA_FILE)) {
      const raw = fs.readFileSync(VA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function writeLocalBackup(records: VirtualAccountRecord[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(VA_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch {}
}

export const virtualAccountStore = {
  /**
   * Concurrency guard: executes an async account generation task under a per-key lock
   */
  async withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (inFlightGenerations.has(key)) {
      logger.info('[virtualAccountStore] Concurrent request waiting for in-flight generation:', { key });
      return inFlightGenerations.get(key) as Promise<T>;
    }

    const promise = task().finally(() => {
      inFlightGenerations.delete(key);
    });

    inFlightGenerations.set(key, promise);
    return promise;
  },

  /**
   * Find existing virtual account by alias
   */
  async getByAlias(alias: string): Promise<VirtualAccountRecord | null> {
    if (!alias) return null;
    const cleanAlias = alias.trim();

    try {
      const pRecord = await (prisma as any).virtualAccount?.findFirst({
        where: { alias: cleanAlias },
      });
      if (pRecord) {
        return {
          id: pRecord.id,
          customerProfileId: pRecord.customerProfileId,
          accountNumber: pRecord.accountNumber,
          bankName: pRecord.bankName,
          bankCode: pRecord.bankCode,
          accountName: pRecord.accountName,
          accountReference: pRecord.accountReference,
          alias: pRecord.alias,
          currency: pRecord.currency || 'NGN',
          provider: pRecord.provider || 'TRANSACTPAY',
          isActive: pRecord.isActive ?? true,
          createdAt: pRecord.createdAt ? new Date(pRecord.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: pRecord.updatedAt ? new Date(pRecord.updatedAt).toISOString() : new Date().toISOString(),
        };
      }
    } catch {}

    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: supaRow, error } = await supabaseAdmin
          .from('VirtualAccount')
          .select('*')
          .eq('alias', cleanAlias)
          .maybeSingle();

        if (supaRow && !error) {
          return supaRow as VirtualAccountRecord;
        }
      } catch {}
    }

    const local = readLocalBackup().find((r) => r.alias === cleanAlias && r.isActive);
    return local || null;
  },

  /**
   * Find existing virtual account for customer to avoid creating duplicate accounts
   */
  async getByCustomerProfileId(customerProfileId: string): Promise<VirtualAccountRecord | null> {
    // 1. Try Prisma
    try {
      const pRecord = await (prisma as any).virtualAccount?.findUnique({
        where: { customerProfileId },
      });
      if (pRecord) {
        return {
          id: pRecord.id,
          customerProfileId: pRecord.customerProfileId,
          accountNumber: pRecord.accountNumber,
          bankName: pRecord.bankName,
          bankCode: pRecord.bankCode,
          accountName: pRecord.accountName,
          accountReference: pRecord.accountReference,
          alias: pRecord.alias,
          currency: pRecord.currency || 'NGN',
          provider: pRecord.provider || 'TRANSACTPAY',
          isActive: pRecord.isActive ?? true,
          createdAt: pRecord.createdAt ? new Date(pRecord.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: pRecord.updatedAt ? new Date(pRecord.updatedAt).toISOString() : new Date().toISOString(),
        };
      }
    } catch {}

    // 2. Try Supabase VirtualAccount table
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: supaRow, error } = await supabaseAdmin
          .from('VirtualAccount')
          .select('*')
          .eq('customerProfileId', customerProfileId)
          .eq('isActive', true)
          .maybeSingle();

        if (supaRow && !error) {
          return supaRow as VirtualAccountRecord;
        }
      } catch {}

      // 3. Try Supabase AuditLog permanent JSON cloud store
      try {
        const { data: auditRows, error } = await supabaseAdmin
          .from('AuditLog')
          .select('*')
          .eq('targetTable', 'VirtualAccount')
          .eq('targetId', customerProfileId)
          .order('createdAt', { ascending: false })
          .limit(1);

        if (auditRows && auditRows.length > 0 && !error) {
          const val = auditRows[0].newValues as VirtualAccountRecord;
          if (val && val.accountNumber) return val;
        }
      } catch {}
    }

    // 4. Try local backup file
    const local = readLocalBackup().find((r) => r.customerProfileId === customerProfileId && r.isActive);
    return local || null;
  },

  /**
   * Find virtual account by account number or account reference (used for webhook matching)
   */
  async getByAccountOrReference(identifier: string): Promise<VirtualAccountRecord | null> {
    if (!identifier) return null;
    const cleanId = identifier.trim();

    // 1. Try Prisma
    try {
      const pRecord = await (prisma as any).virtualAccount?.findFirst({
        where: {
          OR: [{ accountNumber: cleanId }, { accountReference: cleanId }],
        },
      });
      if (pRecord) {
        return {
          id: pRecord.id,
          customerProfileId: pRecord.customerProfileId,
          accountNumber: pRecord.accountNumber,
          bankName: pRecord.bankName,
          accountName: pRecord.accountName,
          accountReference: pRecord.accountReference,
          alias: pRecord.alias,
          currency: pRecord.currency || 'NGN',
          provider: pRecord.provider || 'TRANSACTPAY',
          isActive: pRecord.isActive ?? true,
          createdAt: pRecord.createdAt ? new Date(pRecord.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: pRecord.updatedAt ? new Date(pRecord.updatedAt).toISOString() : new Date().toISOString(),
        };
      }
    } catch {}

    // 2. Try Supabase VirtualAccount table
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        const { data: supaRow, error } = await supabaseAdmin
          .from('VirtualAccount')
          .select('*')
          .or(`accountNumber.eq.${cleanId},accountReference.eq.${cleanId}`)
          .maybeSingle();

        if (supaRow && !error) {
          return supaRow as VirtualAccountRecord;
        }
      } catch {}

      // 3. Try Supabase AuditLog search
      try {
        const { data: auditRows, error } = await supabaseAdmin
          .from('AuditLog')
          .select('*')
          .eq('targetTable', 'VirtualAccount')
          .order('createdAt', { ascending: false })
          .limit(50);

        if (auditRows && !error) {
          for (const row of auditRows) {
            const val = row.newValues as VirtualAccountRecord;
            if (val && (val.accountNumber === cleanId || val.accountReference === cleanId || val.alias === cleanId)) {
              return val;
            }
          }
        }
      } catch {}

      // 4. Try matching customerProfile by embedded UUID in accountReference (e.g. AFFY-WLT-<userId>)
      try {
        const uuidMatch = cleanId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) {
          const userId = uuidMatch[0];
          const { data: cp } = await supabaseAdmin
            .from('CustomerProfile')
            .select('id, userId')
            .eq('userId', userId)
            .maybeSingle();

          if (cp) {
            return {
              id: uuidv4(),
              customerProfileId: cp.id,
              accountNumber: cleanId.replace(/[^0-9]/g, '') || '0000000000',
              bankName: 'Moniepoint Microfinance Bank',
              accountName: 'Affy FoodBank',
              accountReference: `AFFY-WLT-${userId}`,
              alias: `AFFY-CUST-${userId}`,
              currency: 'NGN',
              provider: 'TRANSACTPAY',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
        }
      } catch {}
    }

    // 4. Try local backup
    const local = readLocalBackup().find(
      (r) => r.accountNumber === cleanId || r.accountReference === cleanId
    );
    return local || null;
  },

  /**
   * Persistently store virtual account
   */
  async save(record: Omit<VirtualAccountRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<VirtualAccountRecord> {
    const fullRecord: VirtualAccountRecord = {
      id: uuidv4(),
      ...record,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Try Prisma
    try {
      await (prisma as any).virtualAccount?.upsert({
        where: { customerProfileId: fullRecord.customerProfileId },
        create: fullRecord,
        update: {
          accountNumber: fullRecord.accountNumber,
          bankName: fullRecord.bankName,
          bankCode: fullRecord.bankCode,
          accountName: fullRecord.accountName,
          accountReference: fullRecord.accountReference,
          alias: fullRecord.alias,
          currency: fullRecord.currency,
          isActive: fullRecord.isActive,
          updatedAt: new Date(),
        },
      });
    } catch {}

    // 2. Try Supabase VirtualAccount table
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('VirtualAccount').upsert(fullRecord, {
          onConflict: 'customerProfileId',
        });
      } catch {}

      // 3. Persist to Supabase AuditLog (permanent cloud JSON store)
      try {
        await supabaseAdmin.from('AuditLog').insert({
          id: uuidv4(),
          action: 'VIRTUAL_ACCOUNT_SAVED',
          targetTable: 'VirtualAccount',
          targetId: fullRecord.customerProfileId,
          newValues: fullRecord,
          ipAddress: 'server',
        });
      } catch (err: any) {
        logger.warn('[virtualAccountStore] Supabase audit write warning:', { message: err?.message });
      }
    }

    // 4. Local file backup
    const localList = readLocalBackup().filter((r) => r.customerProfileId !== fullRecord.customerProfileId);
    localList.push(fullRecord);
    writeLocalBackup(localList);

    return fullRecord;
  },
};
