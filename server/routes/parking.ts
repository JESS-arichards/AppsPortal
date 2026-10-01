import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireStaff, requireEntraStaff } from '../middleware/auth.js';
import { sendTeamsParkingCancellationNotice } from '../services/graph.js';

export const parkingRouter = Router();

// GET /api/parking/overview
parkingRouter.get('/overview', requireStaff, async (req: Request, res: Response) => {
  try {
    const overview = await repository.getParkingOverview(req.user!.id);
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/parking/releases
parkingRouter.post('/releases', requireEntraStaff, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate are required' });
      return;
    }

    const staffSpace = req.user?.parkingSpace;
    if (!staffSpace || staffSpace === 999) {
      res.status(403).json({ error: 'You do not have an assigned parking space to release' });
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    if (startDate < todayStr) {
      res.status(400).json({ error: 'Start date cannot be in the past' });
      return;
    }

    if (endDate < startDate) {
      res.status(400).json({ error: 'End date cannot precede start date' });
      return;
    }

    // Check maximum start date (180 days ahead)
    const maxStart = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);
    if (new Date(startDate) > maxStart) {
      res.status(400).json({ error: 'Start date cannot be more than 180 days in advance' });
      return;
    }

    // Check maximum span (90 days)
    const spanDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
    if (spanDays > 90) {
      res.status(400).json({ error: 'Release span cannot exceed 90 days' });
      return;
    }

    // Calculate weekdays
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
      res.status(400).json({ error: 'The selected date range contains no weekdays (Monday to Friday)' });
      return;
    }

    const created = await repository.createParkingReleases(req.user!.id, staffSpace, weekdays);
    res.status(201).json({ created });
  } catch (err: any) {
    if (err.message.startsWith('OVERLAPPING_RELEASE')) {
      res.status(409).json({ error: 'You have already released your space on one or more of these dates' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/parking/releases/:id
parkingRouter.delete('/releases/:id', requireStaff, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { release, reserverStaff } = await repository.cancelParkingRelease(id, req.user!.id);

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
    if (err.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'You can only cancel your own parking releases' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Parking release not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/parking/reservations
parkingRouter.post('/reservations', requireStaff, async (req: Request, res: Response) => {
  try {
    const { releaseId } = req.body;
    if (!releaseId) {
      res.status(400).json({ error: 'releaseId is required' });
      return;
    }

    const updated = await repository.reserveParkingRelease(parseInt(releaseId, 10), req.user!.id);
    res.json({ success: true, reservation: updated });
  } catch (err: any) {
    if (err.message === 'CANNOT_RESERVE_OWN') {
      res.status(400).json({ error: 'You cannot reserve your own released parking space' });
    } else if (err.message === 'ALREADY_RESERVED' || err.message === 'RELEASE_EXPIRED') {
      res.status(409).json({ error: 'This parking space is no longer available or has already been reserved' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Parking release not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// DELETE /api/parking/reservations/:id
parkingRouter.delete('/reservations/:id', requireStaff, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await repository.cancelParkingReservation(id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'You can only cancel your own reservation' });
    } else if (err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Reservation not found' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});
