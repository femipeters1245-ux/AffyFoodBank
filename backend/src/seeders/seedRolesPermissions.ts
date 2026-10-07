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

// Run when executed directly
if (require.main === module) {
  seedRolesPermissions()
    .then(() => console.log('✅ Roles & permissions seeded'))
    .catch((e) => {
      console.error('❌ Seeding failed', e);
      process.exit(1);
    });
}
