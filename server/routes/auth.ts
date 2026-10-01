import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { hashCode, generateSixDigitCode, signPayload } from '../services/crypto.js';
import { verifyEntraIdToken, sendParentLoginCodeEmail } from '../services/graph.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// POST /api/auth/users/sync
authRouter.post('/users/sync', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Valid Entra ID token required' });
      return;
    }

    const token = authHeader.substring(7).trim();
    const claims = await verifyEntraIdToken(token);

    if (!claims) {
      res.status(401).json({ error: 'Invalid Entra ID token' });
      return;
    }

    const email = claims.email || claims.preferred_username;
    if (!email) {
      res.status(400).json({ error: 'Token missing email claim' });
      return;
    }

    const isStudent = (claims.department && claims.department.toLowerCase().includes('student')) || false;

    if (isStudent) {
      const student = await repository.upsertStudentUser({
        id: claims.oid || claims.sub || 'student-' + email,
        email,
        displayName: claims.name || email,
        forename: claims.given_name,
        surname: claims.family_name,
        department: claims.department,
      });
      res.json({ ...student, userType: 'Student' });
    } else {
      const staff = await repository.upsertStaffUser({
        id: claims.oid || claims.sub || 'staff-' + email,
        email,
        displayName: claims.name || email,
        forename: claims.given_name,
        surname: claims.family_name,
        jobTitle: claims.jobTitle,
        department: claims.department,
      });
      res.json({ ...staff, userType: 'Staff' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error during sync' });
  }
});

// POST /api/auth/parent/request-code
authRouter.post('/parent/request-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Invalid email address format' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const parent = await repository.getParentByEmail(normalizedEmail);

    if (!parent) {
      res.status(404).json({ error: 'EMAIL_NOT_FOUND', message: 'Parent email address not found on record.' });
      return;
    }

    const code = generateSixDigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await repository.saveParentLoginCode(normalizedEmail, codeHash, expiresAt);
    await sendParentLoginCodeEmail(normalizedEmail, code);

    res.json({ sent: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing code request' });
  }
});

// POST /api/auth/parent/verify-code
authRouter.post('/parent/verify-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code || typeof code !== 'string') {
      res.status(400).json({ error: 'Email and 6-digit verification code required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      res.status(400).json({ error: 'Code must be exactly 6 numeric digits' });
      return;
    }

    const parent = await repository.getParentByEmail(normalizedEmail);
    if (!parent) {
      res.status(404).json({ error: 'EMAIL_NOT_FOUND' });
      return;
    }

    const latestCode = await repository.getLatestParentLoginCode(normalizedEmail);
    if (!latestCode) {
      res.status(400).json({ error: 'No active verification code found. Please request a new code.' });
      return;
    }

    if (latestCode.attempts >= 5) {
      res.status(429).json({ error: 'Maximum attempts reached. Please request a new code.' });
      return;
    }

    const testHash = hashCode(cleanCode);
    if (testHash !== latestCode.codeHash) {
      await repository.incrementParentLoginCodeAttempts(latestCode);
      const remaining = 5 - latestCode.attempts;
      res.status(400).json({ error: `Invalid code. ${remaining} attempt(s) remaining.` });
      return;
    }

    // Mark used
    await repository.markParentLoginCodeUsed(latestCode);

    // Create 8-hour session cookie
    const eightHoursMs = 8 * 60 * 60 * 1000;
    const sessionToken = signPayload({
      parentId: parent.id,
      email: parent.email,
      exp: Date.now() + eightHoursMs,
    });

    res.cookie('portal_session', sessionToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: eightHoursMs,
    });

    res.json({ authenticated: true, user: { ...parent, userType: 'Parent' } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error verifying code' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('portal_session');
  res.json({ signedOut: true });
});

// GET /api/auth/users/me
authRouter.get('/users/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({
    user: req.user,
    impersonation: req.impersonation || null,
  });
});

// POST /api/auth/users/me/picture
authRouter.post('/users/me/picture', requireAuth, async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Image data URL required' });
      return;
    }

    // Validate data URL format and image type (JPEG, PNG, WebP)
    const match = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match) {
      res.status(400).json({ error: 'Invalid image format. Allowed formats: PNG, JPEG, WebP data URL.' });
      return;
    }

    // Validate size (max 4 MB = ~5.3 MB base64)
    const base64Data = match[2];
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeInBytes > 4 * 1024 * 1024) {
      res.status(400).json({ error: 'Image exceeds maximum allowed size of 4 MB' });
      return;
    }

    await repository.updateUserProfilePicture(req.user!.userType, req.user!.id, image);
    res.json({ profilePicture: image });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save profile picture' });
  }
});
