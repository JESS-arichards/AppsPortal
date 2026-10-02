import { Router, Request, Response, NextFunction } from 'express';
import { repository } from '../db/repository.js';
import { decodeDataUrl, isDataUrl, MediaKind, MediaRecord } from '../db/media.js';
import { requireAuth, requireDistanceLearningUser } from '../middleware/auth.js';

/** Serves stored images and lesson files referenced by the URLs repositories return. */
export const mediaRouter = Router();

type Access = (req: Request, record: MediaRecord) => boolean;

/**
 * Responses are sandboxed so a stored SVG or HTML file can never run script in the portal's origin.
 * Versioned URLs (`?v=`) change whenever the content does, so they are cached long-term.
 */
async function sendMedia(req: Request, res: Response, kind: MediaKind, id: string | number | undefined, scope: 'public' | 'private', access?: Access) {
  try {
    const record = await repository.getMedia(kind, id);
    if (!record?.data) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (access && !access(req, record)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!isDataUrl(record.data)) {
      // External URL (e.g. a stream thumbnail hosted elsewhere).
      if (/^https?:\/\//i.test(record.data)) res.redirect(302, record.data);
      else res.status(404).json({ error: 'Not found' });
      return;
    }
    const decoded = decodeDataUrl(record.data);
    if (!decoded) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const isFile = kind === 'lessonResource';
    res.setHeader('Content-Type', isFile ? record.mimeType || decoded.mimeType : decoded.mimeType);
    res.setHeader('Content-Length', decoded.buffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', req.query.v ? `${scope}, max-age=31536000, immutable` : `${scope}, no-cache`);
    if (isFile) {
      const fileName = (record.fileName || 'resource-file').replace(/[\r\n"]/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    }
    res.end(decoded.buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

mediaRouter.get('/branding/navLogo', (req, res) => sendMedia(req, res, 'navLogo', undefined, 'public'));
mediaRouter.get('/branding/favicon', (req, res) => sendMedia(req, res, 'favicon', undefined, 'public'));
mediaRouter.get('/home/heroImage', (req, res) => sendMedia(req, res, 'heroImage', undefined, 'public'));
mediaRouter.get('/streams/:id/thumbnail', (req, res) => sendMedia(req, res, 'streamThumbnail', req.params.id, 'public'));

// Users may see their own picture; staff may see anyone's (e.g. in admin user lists).
mediaRouter.get('/users/:id/picture', requireAuth, (req, res) =>
  sendMedia(req, res, 'userPicture', req.params.id, 'private', () => req.user!.id === req.params.id || req.user!.userType === 'Staff'));

// Same rule as the lesson API: class members or full admins.
mediaRouter.get('/lesson-resources/:id/file', requireDistanceLearningUser, (req, res) =>
  sendMedia(req, res, 'lessonResource', req.params.id, 'private', (_req, r) =>
    !!r.classCode && (!!req.user?.classes?.includes(r.classCode) || !!req.user?.roles?.includes('Admin'))));

mediaRouter.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: 'Not found' });
});
