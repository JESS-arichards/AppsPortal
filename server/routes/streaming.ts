import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireAuth } from '../middleware/auth.js';

export const streamingRouter = Router();

// GET /api/streaming/videos
streamingRouter.get('/videos', requireAuth, async (_req: Request, res: Response) => {
  try {
    const videos = await repository.getActiveStreams();
    res.json({ videos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
