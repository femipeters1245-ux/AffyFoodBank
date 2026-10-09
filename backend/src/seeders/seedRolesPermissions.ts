import prisma from '../prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed essential roles and permissions.
 * This script is idempotent – it upserts records to avoid duplicates.
 */
export async function seedRolesPermissions() {
  // ----- Permissions -----
  const permissionDefs = [
    // Auth
    { action: 'auth', resource: 'login' },
    { action: 'auth', resource: 'register' },
    // Product
    { action: 'product', resource: 'read' },
    { action: 'product', resource: 'create' },
    { action: 'product', resource: 'update' },
    { action: 'product', resource: 'deactivate' },
    // Wallet (new)
    { action: 'wallet', resource: 'read' },
    { action: 'wallet', resource: 'deposit' },
    { action: 'wallet', resource: 'withdraw' },
    { action: 'wallet', resource: 'allocate' },
    { action: 'wallet', resource: 'release' },
    // Orders
    { action: 'order', resource: 'create' },
    { action: 'order', resource: 'read' },
    { action: 'order', resource: 'update' },
    // Savings
    { action: 'savings', resource: 'create' },
    { action: 'savings', resource: 'read' },
    { action: 'savings', resource: 'cancel' },
    // Packages
    { action: 'package', resource: 'read' },
    { action: 'package', resource: 'create' },
    { action: 'package', resource: 'update' },
    { action: 'package', resource: 'deactivate' },
    // Admin wildcard
    { action: '*', resource: '*' },
  ];

  for (const perm of permissionDefs) {
    await prisma.permission.upsert({
      where: { action_resource: { action: perm.action, resource: perm.resource } },
      update: {},
      create: {
        id: uuidv4(),
        action: perm.action,
        resource: perm.resource,
        description: `${perm.action}:${perm.resource}`,
      },
    });
  }

  // ----- Roles -----
  const roleDefs = [
    { name: 'Customer', description: 'End‑user buying goods' },
    { name: 'FinanceStaff', description: 'Manages wallets and payments' },
    { name: 'LogisticsStaff', description: 'Handles deliveries' },
    { name: 'Admin', description: 'Full system access' },
    { name: 'SuperAdmin', description: 'All privileges' },
  ];

  for (const role of roleDefs) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: { id: uuidv4(), name: role.name, description: role.description },
    });
  }

  // ----- Role‑Permission linking -----
  const rolePermissionMap: Record<string, string[]> = {
    Customer: [
      'auth:login',
      'auth:register',
      'product:read',
      'wallet:read',
      'wallet:deposit',
      'wallet:withdraw',
      'wallet:allocate',
      'wallet:release',
      'order:create',
      'order:read',
      'savings:create',
      'savings:read',
      'savings:cancel',
      'package:read',
    ],
    FinanceStaff: [
      'wallet:read',
      'wallet:deposit',
      'wallet:withdraw',
      'wallet:allocate',
      'wallet:release',
      'order:update',
    ],
    LogisticsStaff: ['order:update'],
    Admin: [
      '*:*',
    ],
    SuperAdmin: ['*:*'],
  };

  for (const [roleName, perms] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const permString of perms) {
      const [action, resource] = permString.split(':');
      const permission = await prisma.permission.findUnique({
        where: { action_resource: { action, resource } },
      });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

/**
 * Seed demo users (Admin, Staff, Customer) with pre-configured credentials & wallet.
 */
export async function seedDemoAccounts() {
  await seedRolesPermissions();

  const customerRole = await prisma.role.findUnique({ where: { name: 'Customer' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  const staffRole = await prisma.role.findUnique({ where: { name: 'FinanceStaff' } });

  const bcrypt = await import('bcrypt');
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

  // 1. Admin Account: admin@affyfoodbank.ng / AdminPassword123!
  const adminHash = await bcrypt.hash('AdminPassword123!', saltRounds);
  await prisma.user.upsert({
    where: { email: 'admin@affyfoodbank.ng' },
    update: { roleId: adminRole?.id, isActive: true },
    create: {
      id: uuidv4(),
      email: 'admin@affyfoodbank.ng',
      passwordHash: adminHash,
      firstName: 'Affy',
      lastName: 'Administrator',
      roleId: adminRole?.id,
      isActive: true,
    },
  });

  // 2. Staff Account: staff@affyfoodbank.ng / StaffPassword123!
  const staffHash = await bcrypt.hash('StaffPassword123!', saltRounds);
  await prisma.user.upsert({
    where: { email: 'staff@affyfoodbank.ng' },
    update: { roleId: staffRole?.id, isActive: true },
    create: {
      id: uuidv4(),
      email: 'staff@affyfoodbank.ng',
      passwordHash: staffHash,
      firstName: 'Finance',
      lastName: 'Staff',
      roleId: staffRole?.id,
      isActive: true,
    },
  });

  // 3. Customer Account: customer@affyfoodbank.ng / Password123!
  const customerHash = await bcrypt.hash('Password123!', saltRounds);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@affyfoodbank.ng' },
    update: { roleId: customerRole?.id, isActive: true },
    create: {
      id: uuidv4(),
      email: 'customer@affyfoodbank.ng',
      passwordHash: customerHash,
      firstName: 'Adebayo',
      lastName: 'Ogunlesi',
      roleId: customerRole?.id,
      isActive: true,
    },
  });

  // Ensure Customer Profile & Funded Wallet
  let profile = await prisma.customerProfile.findUnique({ where: { userId: customer.id } });
  if (!profile) {
    profile = await prisma.customerProfile.create({
      data: {
        id: uuidv4(),
        userId: customer.id,
        phone: '+2348031234567',
      },
    });
  }

  const existingWallet = await prisma.wallet.findUnique({ where: { customerProfileId: profile.id } });
  if (!existingWallet) {
    await prisma.wallet.create({
      data: {
        id: uuidv4(),
        customerProfileId: profile.id,
        totalBalanceCents: BigInt(15000000), // ₦150,000.00
        allocatedToSavingsCents: BigInt(5000000), // ₦50,000.00
        currency: 'NGN',
        status: 'ACTIVE',
      },
    });
  }
}

// Run when executed directly
if (require.main === module) {
  seedDemoAccounts()
    .then(() => console.log('✅ Roles, permissions, and demo users (Admin, Staff, Customer) seeded'))
    .catch((e) => {
      console.error('❌ Seeding failed', e);
      process.exit(1);
    });
}
