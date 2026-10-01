import { config } from '../config.js';
import { repository } from '../db/repository.js';
import * as Types from '../db/types.js';

/**
 * Grants the Admin role to staff listed in INITIAL_ADMIN_EMAILS when they sign in,
 * so a freshly created database always has an administrator. Never removes roles.
 */
export async function applyInitialAdmin(staff: Types.StaffUser): Promise<Types.StaffUser> {
  if (!config.initialAdminEmails.includes(staff.email.toLowerCase())) return staff;
  if (staff.roles?.includes('Admin')) return staff;

  const roles = [...new Set([...(staff.roles || []), 'Staff', 'Admin'])];
  console.log(`[Auth] Granting Admin role to ${staff.email} (listed in INITIAL_ADMIN_EMAILS).`);
  return repository.updateStaffUser(staff.id, { roles });
}
