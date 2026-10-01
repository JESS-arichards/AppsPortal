import { Request, Response, NextFunction } from 'express';
import { repository } from '../db/repository.js';
import { verifySignedPayload } from '../services/crypto.js';
import { verifyEntraIdToken } from '../services/graph.js';
import * as Types from '../db/types.js';
import { config } from '../config.js';
import { applyInitialAdmin } from '../services/adminBootstrap.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  forename?: string | null;
  surname?: string | null;
  userType: 'Staff' | 'Student' | 'Parent';
  authType: 'Entra' | 'Local';
  roles?: string[];
  classes?: string[];
  adminSections?: string[];
  parkingSpace?: number | null;
  extension?: number | null;
  department?: string | null;
  division?: string | null;
  jobTitle?: string | null;
  profilePicture?: string | null;
  linkedStudents?: Types.StudentUser[];
}

export interface ImpersonationState {
  active: boolean;
  actorId: string;
  actorEmail: string;
  actorName: string;
  targetId: string;
  targetType: 'Staff' | 'Student' | 'Parent';
  mode: 'view' | 'test';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      actualActorUser?: AuthenticatedUser;
      impersonation?: ImpersonationState;
    }
  }
}

// In-memory token cache for Entra Bearer token lookups (5-minute TTL per Section 10)
const entraTokenCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always disable caching for API responses per Section 3.2
  res.setHeader('Cache-Control', 'no-store');

  let user: AuthenticatedUser | undefined;

  // 1. Check Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    const cached = entraTokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      user = cached.user;
    } else {
      const claims = await verifyEntraIdToken(token);
      if (claims) {
        const email = claims.email || claims.preferred_username;
        if (email) {
          // Check if student
          const isStudent = (claims.department && claims.department.toLowerCase().includes('student')) || false;
          if (isStudent) {
            let student = await repository.getStudentByEmail(email);
            if (!student) {
              student = await repository.upsertStudentUser({
                id: claims.oid || claims.sub || 'student-' + email,
                email,
                displayName: claims.name || email,
                forename: claims.given_name,
                surname: claims.family_name,
                department: claims.department,
              });
            }
            user = { ...student, userType: 'Student' };
          } else {
            // Staff
            let staff = await repository.getStaffByEmail(email);
            if (!staff) {
              staff = await repository.upsertStaffUser({
                id: claims.oid || claims.sub || 'staff-' + email,
                email,
                displayName: claims.name || email,
                forename: claims.given_name,
                surname: claims.family_name,
                jobTitle: claims.jobTitle,
                department: claims.department,
              });
            }
            staff = await applyInitialAdmin(staff);
            user = { ...staff, userType: 'Staff' };
          }

          entraTokenCache.set(token, { user, expiresAt: Date.now() + 5 * 60 * 1000 });
        }
      }
    }
  }

  // 2. Check signed session cookie (set by Entra sync for Staff/Student, or parent code verification)
  if (!user && req.cookies && req.cookies.portal_session) {
    const session = verifySignedPayload<{ userType: 'Staff' | 'Student' | 'Parent'; id: string; email: string; exp: number }>(req.cookies.portal_session);
    if (session && session.exp > Date.now()) {
      if (session.userType === 'Parent') {
        const parent = await repository.getParentById(session.id);
        if (parent) user = { ...parent, userType: 'Parent' };
      } else if (session.userType === 'Staff') {
        const staff = await repository.getStaffById(session.id);
        if (staff) user = { ...staff, userType: 'Staff' };
      } else if (session.userType === 'Student') {
        const student = await repository.getStudentById(session.id);
        if (student) user = { ...student, userType: 'Student' };
      }
    }
  }

  // 3. Fallback: Local dev convenience header, only available outside production so it can
  // never be used to bypass authentication on a deployed environment.
  if (!user && !config.isProduction && req.headers['x-user-id']) {
    const userId = req.headers['x-user-id'] as string;
    const staff = await repository.getStaffById(userId);
    if (staff) user = { ...staff, userType: 'Staff' };
    else {
      const parent = await repository.getParentById(userId);
      if (parent) user = { ...parent, userType: 'Parent' };
      else {
        const student = await repository.getStudentById(userId);
        if (student) user = { ...student, userType: 'Student' };
      }
    }
  }

  req.user = user;
  req.actualActorUser = user;

  // 4. Impersonation handling
  const impersonationCookie = req.cookies?.portal_impersonation;
  if (impersonationCookie && user) {
    const impSession = verifySignedPayload<{
      sessionId: string;
      actorId: string;
      targetId: string;
      targetType: 'Staff' | 'Student' | 'Parent';
      mode: 'view' | 'test';
      exp: number;
    }>(impersonationCookie);

    if (impSession && impSession.exp > Date.now()) {
      let targetUser: AuthenticatedUser | null = null;
      if (impSession.targetType === 'Staff') {
        const staff = await repository.getStaffById(impSession.targetId);
        if (staff) targetUser = { ...staff, userType: 'Staff' };
      } else if (impSession.targetType === 'Student') {
        const student = await repository.getStudentById(impSession.targetId);
        if (student) targetUser = { ...student, userType: 'Student' };
      } else if (impSession.targetType === 'Parent') {
        const parent = await repository.getParentById(impSession.targetId);
        if (parent) targetUser = { ...parent, userType: 'Parent' };
      }

      if (targetUser) {
        req.impersonation = {
          active: true,
          actorId: user.id,
          actorEmail: user.email,
          actorName: user.displayName,
          targetId: targetUser.id,
          targetType: impSession.targetType,
          mode: impSession.mode,
        };
        req.user = targetUser; // Effective user is replaced

        // Enforce View-mode write blocking
        if (impSession.mode === 'view') {
          const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase());
          const isExitRoute = req.originalUrl === '/api/admin/impersonation/stop';

          if (isMutating && !isExitRoute) {
            await repository.logImpersonationAudit({
              sessionId: impSession.sessionId,
              actorUserId: req.actualActorUser?.id || '',
              actorEmail: req.actualActorUser?.email || '',
              targetUserId: targetUser.id,
              targetEmail: targetUser.email,
              targetType: impSession.targetType,
              mode: 'view',
              eventType: 'action_blocked',
              method: req.method,
              path: req.originalUrl,
              details: 'Modification blocked in view-only impersonation mode',
            });

            res.status(403).json({ error: 'Impersonation view mode does not permit modifications.' });
            return;
          }
        }

        // Test-mode mutation audit log
        if (impSession.mode === 'test' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method.toUpperCase())) {
          await repository.logImpersonationAudit({
            sessionId: impSession.sessionId,
            actorUserId: req.actualActorUser?.id || '',
            actorEmail: req.actualActorUser?.email || '',
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            targetType: impSession.targetType,
            mode: 'test',
            eventType: 'action_allowed',
            method: req.method,
            path: req.originalUrl,
          });
        }
      }
    }
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.userType !== 'Staff') {
    res.status(403).json({ error: 'Forbidden: Staff access only' });
    return;
  }
  next();
}

export function requireEntraStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.userType !== 'Staff' || req.user.authType !== 'Entra') {
    res.status(403).json({ error: 'Forbidden: Microsoft Entra Staff authentication required' });
    return;
  }
  next();
}

export function requireDistanceLearningUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  // Per spec section 4.6 & 13: guard is staff-only in current implementation
  if (req.user.userType !== 'Staff') {
    res.status(403).json({ error: 'Forbidden: Staff access only for Distance Learning' });
    return;
  }
  next();
}

export function requireAdmin(section?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Admin tools are blocked while impersonating per Section 4.8 / 5
    if (req.impersonation?.active) {
      res.status(403).json({ error: 'Admin functions are unavailable while impersonating.' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.userType !== 'Staff') {
      res.status(403).json({ error: 'Forbidden: Staff admin required' });
      return;
    }

    const isFullAdmin = req.user.roles?.includes('Admin');
    if (isFullAdmin) {
      return next();
    }

    if (section && req.user.adminSections?.includes(section)) {
      return next();
    }

    res.status(403).json({ error: `Forbidden: Admin permission '${section || 'admin'}' required` });
  };
}

export function requireFullAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.impersonation?.active) {
    res.status(403).json({ error: 'Admin functions are unavailable while impersonating.' });
    return;
  }

  if (!req.user || req.user.userType !== 'Staff' || !req.user.roles?.includes('Admin')) {
    res.status(403).json({ error: 'Forbidden: Full Admin role required' });
    return;
  }
  next();
}
