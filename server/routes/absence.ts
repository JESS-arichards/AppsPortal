import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireEntraStaff } from '../middleware/auth.js';

export const absenceRouter = Router();

// GET /api/absence/overview
absenceRouter.get('/overview', requireEntraStaff, async (req: Request, res: Response) => {
  try {
    const overview = await repository.getAbsenceOverview(req.user!.id);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/absence/requests
absenceRouter.post('/requests', requireEntraStaff, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reason, releaseSpace } = req.body;

    if (!startDate || !endDate || !reason) {
      res.status(400).json({ error: 'startDate, endDate, and reason are required' });
      return;
    }

    const cleanReason = reason.trim();
    if (!cleanReason) {
      res.status(400).json({ error: 'Reason cannot be blank' });
      return;
    }

    if (cleanReason.length > 1000) {
      res.status(400).json({ error: 'Reason must not exceed 1000 characters' });
      return;
    }

    if (endDate < startDate) {
      res.status(400).json({ error: 'End date cannot precede start date' });
      return;
    }

    // Start date max 365 days ahead
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const maxFuture = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    if (new Date(startDate) > maxFuture) {
      res.status(400).json({ error: 'Start date cannot be more than 365 days in advance' });
      return;
    }

    const absence = await repository.createAbsenceRequest(
      req.user!.id,
      startDate,
      endDate,
      cleanReason,
      Boolean(releaseSpace)
    );

    res.status(201).json(absence);
  } catch (err: any) {
    if (err.message.startsWith('OVERLAPPING_RELEASE')) {
      res.status(409).json({ error: 'An overlapping parking release already exists for one or more dates in this absence period.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/absence/requests/:id
absenceRouter.delete('/requests/:id', requireEntraStaff, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repository.cancelAbsenceRequest(id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'You can only cancel your own absence reports' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Absence request not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
