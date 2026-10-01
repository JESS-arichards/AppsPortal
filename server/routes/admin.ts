import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireAdmin, requireFullAdmin } from '../middleware/auth.js';
import { checkContrastCompliant } from '../services/contrast.js';
import { signPayload } from '../services/crypto.js';
import { sendTeamsParkingCancellationNotice } from '../services/graph.js';
import { config } from '../config.js';
import * as Types from '../db/types.js';

export const adminRouter = Router();

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// =============================================================
// USERS SECTION
// =============================================================

// GET /api/admin/users
adminRouter.get('/users', requireAdmin('users'), async (_req: Request, res: Response) => {
  try {
    const data = await repository.getAllUsers();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/staff/:id
adminRouter.put('/staff/:id', requireAdmin('users'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { displayName, email, forename, surname, authType, jobTitle, division, department, parkingSpace, extension, classes, roles, adminSections } = req.body;

    if (!displayName || !email) {
      res.status(400).json({ error: 'Display name and email are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const toOptionalInt = (v: unknown): number | null | undefined =>
      v === undefined ? undefined : v === null || v === '' ? null : Number(v);
    const parkingSpaceValue = toOptionalInt(parkingSpace);
    const extensionValue = toOptionalInt(extension);

    if (parkingSpaceValue != null && (!Number.isInteger(parkingSpaceValue) || parkingSpaceValue < 0 || parkingSpaceValue > 999)) {
      res.status(400).json({ error: 'Parking space must be a whole number between 0 and 999' });
      return;
    }

    if (extensionValue != null && (!Number.isInteger(extensionValue) || extensionValue < 0 || extensionValue > 999)) {
      res.status(400).json({ error: 'Extension must be a whole number between 0 and 999' });
      return;
    }

    const isFullAdmin = req.user?.roles?.includes('Admin');
    const updatePayload: Partial<Types.StaffUser> = {
      displayName: displayName.trim(),
      email: email.toLowerCase().trim(),
      forename: forename?.trim() || null,
      surname: surname?.trim() || null,
      authType: authType === 'Local' ? 'Local' : 'Entra',
      jobTitle: jobTitle?.trim() || null,
      division: division?.trim() || null,
      department: department?.trim() || null,
      parkingSpace: parkingSpaceValue,
      extension: extensionValue,
      classes: Array.isArray(classes) ? classes : undefined,
    };

    // Full admin only for roles and admin sections
    if (isFullAdmin) {
      if (Array.isArray(roles)) {
        const allowedRoles = ['Admin', 'Staff', 'Onboarding', 'Oasis'];
        updatePayload.roles = roles.filter(r => allowedRoles.includes(r));
        if (!updatePayload.roles.includes('Staff')) updatePayload.roles.push('Staff');
      }
      if (Array.isArray(adminSections)) {
        const allowedSections = ['users', 'classes', 'periods', 'parentLinks', 'parking', 'streaming', 'branding'];
        updatePayload.adminSections = adminSections.filter(s => allowedSections.includes(s));
      }
    }

    const updated = await repository.updateStaffUser(id, updatePayload);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: 'Email already in use by another user' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Staff user not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT /api/admin/students/:id
adminRouter.put('/students/:id', requireAdmin('users'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { displayName, email, forename, surname, division, department, classes } = req.body;

    if (!displayName || !email) {
      res.status(400).json({ error: 'Display name and email are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const updated = await repository.updateStudentUser(id, {
      displayName: displayName.trim(),
      email: email.toLowerCase().trim(),
      forename: forename?.trim() || null,
      surname: surname?.trim() || null,
      division: division?.trim() || null,
      department: department?.trim() || 'Student',
      classes: Array.isArray(classes) ? classes : undefined,
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: 'Email already in use' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Student not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/admin/parents
adminRouter.post('/parents', requireAdmin('users'), async (req: Request, res: Response) => {
  try {
    const { displayName, email, forename, surname, studentEmail } = req.body;
    if (!displayName || !email) {
      res.status(400).json({ error: 'Display name and email are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Invalid parent email' });
      return;
    }

    if (studentEmail && !EMAIL_REGEX.test(studentEmail.trim())) {
      res.status(400).json({ error: 'Invalid student email format' });
      return;
    }

    const parent = await repository.createParentUser({
      displayName,
      email,
      forename,
      surname,
      studentEmail,
    });

    res.status(201).json(parent);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: 'A parent with this email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/admin/parents/bulk
adminRouter.post('/parents/bulk', requireAdmin('users'), async (req: Request, res: Response) => {
  try {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string') {
      res.status(400).json({ error: 'CSV data string is required' });
      return;
    }

    const lines = csvData.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 500) {
      res.status(400).json({ error: 'Maximum 500 rows allowed per bulk upload' });
      return;
    }

    const results: Array<{ row: number; success: boolean; email?: string; error?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if line has "displayName" or "email"
      if (i === 0 && line.toLowerCase().includes('displayname')) continue;

      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const [displayName, email, forename, surname, studentEmail] = cols;

      if (!displayName || !email || !EMAIL_REGEX.test(email)) {
        results.push({ row: i + 1, success: false, error: 'Invalid displayName or email' });
        continue;
      }

      try {
        await repository.createParentUser({
          displayName,
          email,
          forename,
          surname,
          studentEmail: studentEmail || undefined,
        });
        results.push({ row: i + 1, success: true, email });
      } catch (err: any) {
        results.push({ row: i + 1, success: false, email, error: err.message });
      }
    }

    res.json({
      total: lines.length,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/parents/:id
adminRouter.put('/parents/:id', requireAdmin('users'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { displayName, email, forename, surname, division } = req.body;

    if (!displayName || !email) {
      res.status(400).json({ error: 'Display name and email are required' });
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    const updated = await repository.updateParentUser(id, {
      displayName: displayName.trim(),
      email: email.toLowerCase().trim(),
      forename: forename?.trim() || null,
      surname: surname?.trim() || null,
      division: division?.trim() || null,
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: 'Email already in use' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Parent not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// =============================================================
// CLASSES SECTION
// =============================================================

// GET /api/admin/classes
adminRouter.get('/classes', requireAdmin('classes'), async (_req: Request, res: Response) => {
  try {
    const classes = await repository.getAllClasses();
    res.json({ classes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/classes
adminRouter.post('/classes', requireAdmin('classes'), async (req: Request, res: Response) => {
  try {
    const { code, campus, name } = req.body;
    if (!code || !campus) {
      res.status(400).json({ error: 'Class code and campus are required' });
      return;
    }

    const cleanCode = code.toUpperCase().trim();
    if (!/^[A-Z0-9-]{1,20}$/.test(cleanCode)) {
      res.status(400).json({ error: 'Class code must be alphanumeric/dashes up to 20 characters' });
      return;
    }

    if (!['ARP', 'JJ', 'ARS'].includes(campus)) {
      res.status(400).json({ error: 'Campus must be ARP, JJ, or ARS' });
      return;
    }

    const entity = await repository.upsertClass(cleanCode, campus, name);
    res.status(201).json(entity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/classes/:code
adminRouter.delete('/classes/:code', requireAdmin('classes'), async (req: Request, res: Response) => {
  try {
    const code = req.params.code;
    const deleted = await repository.deleteClass(code);
    if (!deleted) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }
    res.json({ success: true, deletedCode: code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// PERIODS SECTION
// =============================================================

// GET /api/admin/periods
adminRouter.get('/periods', requireAdmin('periods'), async (_req: Request, res: Response) => {
  try {
    const periods = await repository.getAllPeriods();
    res.json({ periods });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/periods
adminRouter.post('/periods', requireAdmin('periods'), async (req: Request, res: Response) => {
  try {
    const { id, campus, weekday, periodName, startTime, endTime, sortOrder } = req.body;
    if (!campus || !weekday || !periodName || !startTime || !endTime) {
      res.status(400).json({ error: 'Campus, weekday, periodName, startTime, and endTime are required' });
      return;
    }

    if (!['ARP', 'JJ', 'ARS'].includes(campus)) {
      res.status(400).json({ error: 'Invalid campus' });
      return;
    }

    const dayNum = parseInt(weekday, 10);
    if (dayNum < 1 || dayNum > 7) {
      res.status(400).json({ error: 'Weekday must be 1 (Monday) to 7 (Sunday)' });
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      res.status(400).json({ error: 'Times must be in HH:MM format' });
      return;
    }

    const period = await repository.upsertPeriod({
      id: id ? parseInt(id, 10) : undefined,
      campus,
      weekday: dayNum,
      periodName,
      startTime,
      endTime,
      sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
    });

    res.status(201).json(period);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/periods/:id
adminRouter.delete('/periods/:id', requireAdmin('periods'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await repository.deletePeriod(id);
    if (!deleted) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }
    res.json({ success: true, deletedId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// PARENT LINKS SECTION
// =============================================================

// GET /api/admin/parent-links
adminRouter.get('/parent-links', requireAdmin('parentLinks'), async (_req: Request, res: Response) => {
  try {
    const activeLinks = await repository.getAllParentLinks();
    const parents = (await repository.getAllUsers()).parents;
    const students = (await repository.getAllUsers()).students;
    res.json({ activeLinks, parents, students });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/parent-links
adminRouter.post('/parent-links', requireAdmin('parentLinks'), async (req: Request, res: Response) => {
  try {
    const { parentId, studentId, studentEmail } = req.body;
    if (!parentId || (!studentId && !studentEmail)) {
      res.status(400).json({ error: 'parentId and either studentId or studentEmail are required' });
      return;
    }

    if (studentId) {
      await repository.createParentStudentLink(parentId, studentId);
      res.json({ success: true, type: 'active' });
      return;
    }

    const email = studentEmail.toLowerCase().trim();
    const student = await repository.getStudentByEmail(email);
    if (student) {
      await repository.createParentStudentLink(parentId, student.id);
      res.json({ success: true, type: 'active' });
    } else {
      const pending = await repository.createPendingParentLink(parentId, email);
      res.json({ success: true, type: 'pending', pending });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/parent-links/:parentId/:studentId
adminRouter.delete('/parent-links/:parentId/:studentId', requireAdmin('parentLinks'), async (req: Request, res: Response) => {
  try {
    const { parentId, studentId } = req.params;
    const deleted = await repository.deleteParentStudentLink(parentId, studentId);
    if (!deleted) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/parent-links/pending
adminRouter.get('/parent-links/pending', requireAdmin('parentLinks'), async (_req: Request, res: Response) => {
  try {
    const pending = await repository.getPendingParentLinks();
    res.json({ pending });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/parent-links/pending/:id
adminRouter.delete('/parent-links/pending/:id', requireAdmin('parentLinks'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await repository.deletePendingParentLink(id);
    if (!deleted) {
      res.status(404).json({ error: 'Pending link not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// PARKING SECTION
// =============================================================

// GET /api/admin/parking/releases
adminRouter.get('/parking/releases', requireAdmin('parking'), async (_req: Request, res: Response) => {
  try {
    const releases = await repository.getAllParkingReleases();
    const staff = (await repository.getAllUsers()).staff.filter(s => s.parkingSpace && s.parkingSpace !== 999);
    res.json({ releases, eligibleStaff: staff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/parking/releases
adminRouter.post('/parking/releases', requireAdmin('parking'), async (req: Request, res: Response) => {
  try {
    const { ownerUserId, startDate, endDate } = req.body;
    if (!ownerUserId || !startDate || !endDate) {
      res.status(400).json({ error: 'ownerUserId, startDate, and endDate are required' });
      return;
    }

    const staff = await repository.getStaffById(ownerUserId);
    if (!staff || !staff.parkingSpace || staff.parkingSpace === 999) {
      res.status(400).json({ error: 'Owner must be staff with an assigned parking space' });
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (startDate < todayStr) {
      res.status(400).json({ error: 'Start date cannot be in the past' });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ error: 'End date cannot precede start date' });
      return;
    }

    // Weekdays calculation
    const weekdays: string[] = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const day = cur.getUTCDay();
      if (day >= 1 && day <= 5) {
        weekdays.push(cur.toISOString().slice(0, 10));
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    if (weekdays.length === 0) {
      res.status(400).json({ error: 'Selected range must contain at least one weekday' });
      return;
    }

    const created = await repository.createParkingReleases(ownerUserId, staff.parkingSpace, weekdays);
    res.status(201).json({ created });
  } catch (err: any) {
    if (err.message.startsWith('OVERLAPPING_RELEASE')) {
      res.status(409).json({ error: 'Space is already released for one or more selected dates' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/admin/parking/releases/:id
adminRouter.delete('/parking/releases/:id', requireAdmin('parking'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { release, reserverStaff } = await repository.cancelParkingRelease(id);

    let notificationWarning: string | undefined;
    if (reserverStaff) {
      try {
        await sendTeamsParkingCancellationNotice(reserverStaff.email, release.space, release.date);
      } catch (notifyErr: any) {
        notificationWarning = `Could not notify reserver via Teams: ${notifyErr.message}`;
      }
    }

    res.json({ success: true, notificationWarning });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Release not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// =============================================================
// STREAMING SECTION
// =============================================================

// GET /api/admin/streams
adminRouter.get('/streams', requireAdmin('streaming'), async (_req: Request, res: Response) => {
  try {
    const streams = await repository.getAllStreams();
    res.json({ streams });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/streams
adminRouter.post('/streams', requireAdmin('streaming'), async (req: Request, res: Response) => {
  try {
    const { title, description, categories, streamType, accessType, videoUrl, thumbnailUrl, active } = req.body;
    if (!title || !videoUrl || !streamType || !accessType) {
      res.status(400).json({ error: 'Title, videoUrl, streamType, and accessType are required' });
      return;
    }

    // Extract iframe src if full embed code is provided
    let cleanUrl = videoUrl.trim();
    const iframeMatch = cleanUrl.match(/src=["'](https:\/\/[^"']+)["']/i);
    if (iframeMatch) {
      cleanUrl = iframeMatch[1];
    }

    if (!cleanUrl.startsWith('https://')) {
      res.status(400).json({ error: 'Video URL must be HTTPS' });
      return;
    }

    const stream = await repository.upsertStream({
      title,
      description,
      categories: Array.isArray(categories) ? categories.join(', ') : categories,
      streamType,
      accessType,
      videoUrl: cleanUrl,
      thumbnailUrl,
      active: active !== undefined ? active : true,
      createdBy: req.user?.email,
    });

    res.status(201).json(stream);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/streams/:id
adminRouter.put('/streams/:id', requireAdmin('streaming'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, categories, streamType, accessType, videoUrl, thumbnailUrl, active } = req.body;

    let cleanUrl = videoUrl.trim();
    const iframeMatch = cleanUrl.match(/src=["'](https:\/\/[^"']+)["']/i);
    if (iframeMatch) {
      cleanUrl = iframeMatch[1];
    }

    if (!cleanUrl.startsWith('https://')) {
      res.status(400).json({ error: 'Video URL must be HTTPS' });
      return;
    }

    const stream = await repository.upsertStream({
      id,
      title,
      description,
      categories: Array.isArray(categories) ? categories.join(', ') : categories,
      streamType,
      accessType,
      videoUrl: cleanUrl,
      thumbnailUrl,
      active,
    });

    res.json(stream);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/streams/:id
adminRouter.delete('/streams/:id', requireAdmin('streaming'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await repository.deleteStream(id);
    if (!deleted) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// BRANDING & CONTENT SECTION
// =============================================================

// PUT /api/admin/branding
adminRouter.put('/branding', requireAdmin('branding'), async (req: Request, res: Response) => {
  try {
    const { mainColor, accentColor, textColor, navBgColor, navTextColor, navAccentColor, heroBgColor, heroTextColor, heroAccentColor, navLogo, favicon } = req.body;

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!mainColor || !hexRegex.test(mainColor) || !accentColor || !hexRegex.test(accentColor) || !textColor || !hexRegex.test(textColor)) {
      res.status(400).json({ error: 'Main, accent, and text colors must be valid 6-digit hex values (e.g. #002B49)' });
      return;
    }

    // Contrast ratio check (WCAG AA >= 4.5) per Section 4.8
    const effectiveNavBg = navBgColor || mainColor;
    const effectiveNavText = navTextColor || '#FFFFFF';
    const effectiveHeroBg = heroBgColor || mainColor;
    const effectiveHeroText = heroTextColor || '#FFFFFF';

    if (!checkContrastCompliant(effectiveNavText, effectiveNavBg, 4.5)) {
      res.status(400).json({ error: 'Navigation text does not meet the minimum contrast ratio of 4.5 against the background' });
      return;
    }

    if (!checkContrastCompliant(effectiveHeroText, effectiveHeroBg, 4.5)) {
      res.status(400).json({ error: 'Hero text does not meet the minimum contrast ratio of 4.5 against the background' });
      return;
    }

    const updated = await repository.updateBranding({
      mainColor,
      accentColor,
      textColor,
      navBgColor: navBgColor || null,
      navTextColor: navTextColor || null,
      navAccentColor: navAccentColor || null,
      heroBgColor: heroBgColor || null,
      heroTextColor: heroTextColor || null,
      heroAccentColor: heroAccentColor || null,
      navLogo: navLogo || null,
      favicon: favicon || null,
    });

    res.json({ branding: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/home-content
adminRouter.put('/home-content', requireAdmin('branding'), async (req: Request, res: Response) => {
  try {
    const { heroLabel, heroHeadline, heroIntro, heroImage, heroImageAlt, captionName, captionRole, welcomeLabel, welcomeHeading, welcomeMessage } = req.body;

    if (!heroLabel || !heroHeadline || !welcomeHeading || !welcomeMessage) {
      res.status(400).json({ error: 'Required text fields cannot be blank' });
      return;
    }

    const updated = await repository.updateHomeContent({
      heroLabel: heroLabel.substring(0, 120),
      heroHeadline: heroHeadline.substring(0, 200),
      heroIntro: (heroIntro || '').substring(0, 1000),
      heroImage: heroImage || null,
      heroImageAlt: (heroImageAlt || '').substring(0, 200),
      captionName: (captionName || '').substring(0, 150),
      captionRole: (captionRole || '').substring(0, 100),
      welcomeLabel: (welcomeLabel || '').substring(0, 120),
      welcomeHeading: welcomeHeading.substring(0, 250),
      welcomeMessage: welcomeMessage.substring(0, 12000),
    });

    res.json({ content: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/login-content
adminRouter.put('/login-content', requireAdmin('branding'), async (req: Request, res: Response) => {
  try {
    const {
      welcomeLabel,
      welcomeHeadline,
      values,
      signInHeading,
      signInIntro,
      staffChoiceTitle,
      staffChoiceDescription,
      parentChoiceTitle,
      parentChoiceDescription,
      parentEmailLabel,
      parentCodeLabel,
      sendCodeLabel,
      verifyCodeLabel,
      resendCodeLabel,
      helpPrompt,
      helpLinkText,
    } = req.body;

    let valuesJson = '[]';
    if (Array.isArray(values)) {
      valuesJson = JSON.stringify(values.slice(0, 8).map(v => String(v).substring(0, 50)));
    }

    const updated = await repository.updateLoginContent({
      welcomeLabel: (welcomeLabel || '').substring(0, 120),
      welcomeHeadline: (welcomeHeadline || '').substring(0, 200),
      valuesJson,
      signInHeading: (signInHeading || '').substring(0, 200),
      signInIntro: (signInIntro || '').substring(0, 1000),
      staffChoiceTitle: (staffChoiceTitle || '').substring(0, 150),
      staffChoiceDescription: (staffChoiceDescription || '').substring(0, 500),
      parentChoiceTitle: (parentChoiceTitle || '').substring(0, 150),
      parentChoiceDescription: (parentChoiceDescription || '').substring(0, 500),
      parentEmailLabel: (parentEmailLabel || '').substring(0, 100),
      parentCodeLabel: (parentCodeLabel || '').substring(0, 100),
      sendCodeLabel: (sendCodeLabel || '').substring(0, 100),
      verifyCodeLabel: (verifyCodeLabel || '').substring(0, 100),
      resendCodeLabel: (resendCodeLabel || '').substring(0, 100),
      helpPrompt: (helpPrompt || '').substring(0, 250),
      helpLinkText: (helpLinkText || '').substring(0, 100),
    });

    res.json({ content: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// IMPERSONATION
// =============================================================

// POST /api/admin/impersonation/start
adminRouter.post('/impersonation/start', requireFullAdmin, async (req: Request, res: Response) => {
  try {
    const { targetType, targetUserId, mode } = req.body;
    if (!targetType || !targetUserId || !mode) {
      res.status(400).json({ error: 'targetType, targetUserId, and mode are required' });
      return;
    }

    if (!['Staff', 'Student', 'Parent'].includes(targetType) || !['view', 'test'].includes(mode)) {
      res.status(400).json({ error: 'Invalid targetType or mode' });
      return;
    }

    let targetEmail = '';
    let targetName = '';

    if (targetType === 'Staff') {
      const staff = await repository.getStaffById(targetUserId);
      if (!staff) {
        res.status(404).json({ error: 'Staff user not found' });
        return;
      }
      // Section 4.8 / 5: Admins cannot impersonate another Admin
      if (staff.roles?.includes('Admin')) {
        res.status(403).json({ error: 'Admins cannot impersonate another Administrator' });
        return;
      }
      targetEmail = staff.email;
      targetName = staff.displayName;
    } else if (targetType === 'Student') {
      const student = await repository.getStudentById(targetUserId);
      if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      targetEmail = student.email;
      targetName = student.displayName;
    } else if (targetType === 'Parent') {
      const parent = await repository.getParentById(targetUserId);
      if (!parent) {
        res.status(404).json({ error: 'Parent not found' });
        return;
      }
      targetEmail = parent.email;
      targetName = parent.displayName;
    }

    const sessionId = 'imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    const thirtyMinutesMs = 30 * 60 * 1000;
    const token = signPayload({
      sessionId,
      actorId: req.user!.id,
      targetId: targetUserId,
      targetType,
      mode,
      exp: Date.now() + thirtyMinutesMs,
    });

    await repository.logImpersonationAudit({
      sessionId,
      actorUserId: req.user!.id,
      actorEmail: req.user!.email,
      targetUserId,
      targetEmail,
      targetType,
      mode,
      eventType: 'start',
      details: `Started ${mode} impersonation of ${targetName} (${targetType})`,
    });

    res.cookie('portal_impersonation', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: thirtyMinutesMs,
    });

    res.json({
      success: true,
      sessionId,
      target: { id: targetUserId, email: targetEmail, name: targetName, type: targetType },
      mode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/impersonation/stop
adminRouter.post('/impersonation/stop', async (req: Request, res: Response) => {
  try {
    if (req.impersonation?.active) {
      await repository.logImpersonationAudit({
        sessionId: 'ended',
        actorUserId: req.impersonation.actorId,
        actorEmail: req.impersonation.actorEmail,
        targetUserId: req.impersonation.targetId,
        targetEmail: req.user?.email || '',
        targetType: req.impersonation.targetType,
        mode: req.impersonation.mode,
        eventType: 'stop',
        details: 'Impersonation ended by user',
      });
    }

    res.clearCookie('portal_impersonation');
    res.json({ success: true, stopped: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
