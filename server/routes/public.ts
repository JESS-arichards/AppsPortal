import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { config } from '../config.js';

export const publicRouter = Router();

// GET /api/branding & /branding
publicRouter.get(['/api/branding', '/branding'], async (_req: Request, res: Response) => {
  try {
    const branding = await repository.getBranding();
    res.json({ branding });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/home-content & /home-content
publicRouter.get(['/api/home-content', '/home-content'], async (_req: Request, res: Response) => {
  try {
    const content = await repository.getHomeContent();
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/login-content & /login-content
publicRouter.get(['/api/login-content', '/login-content'], async (_req: Request, res: Response) => {
  try {
    const content = await repository.getLoginContent();
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /portal-config.js
publicRouter.get('/portal-config.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const configJs = `window.PORTAL_CONFIG = ${JSON.stringify({
    ENTRA_CLIENT_ID: config.entraClientId,
    ENTRA_TENANT_ID: config.entraTenantId,
    APP_HELPDESK_EMAIL: config.appHelpdeskEmail,
  })};`;

  res.send(configJs);
});
