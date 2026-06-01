/* eslint-disable no-console */
/**
 * create-superadmin.ts
 *
 * Creates (or updates the password of) a global super-admin in the control
 * plane. Super-admins sign in to the super-admin app / API to onboard and
 * manage white-label tenants.
 *
 * Requires CONTROL_DATABASE_URL to be set.
 *
 * Usage:
 *   pnpm tsx scripts/create-superadmin.ts \
 *     --email you@rankership.com --name "Your Name" --password '<strong-password>'
 */
import bcrypt from 'bcryptjs';
import { PrismaClient as ControlPrisma } from '../src/generated/prisma-control/index.js';

function arg(name: string): string | undefined {
  return process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
    ?? (() => {
      const i = process.argv.indexOf(`--${name}`);
      return i !== -1 ? process.argv[i + 1] : undefined;
    })();
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim();
  const password = arg('password');
  if (!email || !name || !password) {
    throw new Error('Usage: tsx scripts/create-superadmin.ts --email <e> --name <n> --password <p>');
  }

  const control = new ControlPrisma({ datasources: { db: { url: process.env.CONTROL_DATABASE_URL } } });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await control.superAdmin.upsert({
      where: { email },
      update: { passwordHash, name, isActive: true },
      create: { email, name, passwordHash, isActive: true },
    });
    console.log(`Super-admin ready: ${admin.email} (${admin.id})`);
  } finally {
    await control.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
