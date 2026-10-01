import { Router, Request, Response } from 'express';
import { repository } from '../db/repository.js';
import { requireAuth, requireDistanceLearningUser } from '../middleware/auth.js';

export const distanceLearningRouter = Router();

// GET /api/distance-learning/classes
distanceLearningRouter.get('/classes', requireDistanceLearningUser, async (req: Request, res: Response) => {
  try {
    const userClasses = req.user?.classes || [];
    const allClasses = await repository.getAllClasses();
    const filtered = allClasses.filter(c => userClasses.includes(c.code));
    res.json({ classes: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/distance-learning/day?classCode=&date=
distanceLearningRouter.get('/day', requireDistanceLearningUser, async (req: Request, res: Response) => {
  try {
    const { classCode, date } = req.query;
    if (!classCode || !date || typeof classCode !== 'string' || typeof date !== 'string') {
      res.status(400).json({ error: 'classCode and date query parameters are required' });
      return;
    }

    // Authorization: User must be member of class, or full Admin
    const isMember = req.user?.classes?.includes(classCode) || req.user?.roles?.includes('Admin');
    if (!isMember) {
      res.status(403).json({ error: 'You are not assigned to this class' });
      return;
    }

    const allClasses = await repository.getAllClasses();
    const targetClass = allClasses.find(c => c.code === classCode);
    if (!targetClass) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    // Determine weekday (1 = Monday, ..., 7 = Sunday)
    const dateObj = new Date(date);
    let weekday = dateObj.getUTCDay();
    if (weekday === 0) weekday = 7; // Sunday = 7

    const periods = await repository.getPeriodsForCampusAndWeekday(targetClass.campus, weekday);
    const dayLessons = await repository.getDayLessons(classCode, date);

    // Map lessons to periods
    const periodsWithLessons = periods.map(p => {
      const lesson = dayLessons.find(l => l.periodId === p.id);
      return {
        period: p,
        lesson: lesson || null,
      };
    });

    res.json({
      class: targetClass,
      date,
      weekday,
      schedule: periodsWithLessons,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/distance-learning/lessons
distanceLearningRouter.put('/lessons', requireDistanceLearningUser, async (req: Request, res: Response) => {
  try {
    const { classCode, date, periodId, title, description, resources } = req.body;
    if (!classCode || !date || !periodId || !title) {
      res.status(400).json({ error: 'classCode, date, periodId, and title are required' });
      return;
    }

    // Guard: Staff/Admin role & membership
    const isMember = req.user?.classes?.includes(classCode) || req.user?.roles?.includes('Admin');
    if (!isMember) {
      res.status(403).json({ error: 'Forbidden: Class membership required' });
      return;
    }

    const cleanTitle = title.trim();
    if (cleanTitle.length > 200) {
      res.status(400).json({ error: 'Title must not exceed 200 characters' });
      return;
    }

    const cleanDesc = description ? description.trim() : null;
    if (cleanDesc && cleanDesc.length > 4000) {
      res.status(400).json({ error: 'Description must not exceed 4000 characters' });
      return;
    }

    // Validate resources (max 10 submitted resources)
    const validResources: any[] = [];
    if (Array.isArray(resources)) {
      if (resources.length > 10) {
        res.status(400).json({ error: 'Maximum 10 resources allowed' });
        return;
      }

      for (const r of resources) {
        if (!r.label || !r.label.trim()) {
          res.status(400).json({ error: 'Each resource must have a non-blank label' });
          return;
        }
        if (!r.url && !r.fileData) {
          res.status(400).json({ error: 'Each resource must provide either a URL or an uploaded file' });
          return;
        }
        if (r.url && r.url.length > 1000) {
          res.status(400).json({ error: 'Resource URL cannot exceed 1000 characters' });
          return;
        }
        validResources.push({
          label: r.label.trim(),
          url: r.url?.trim() || null,
          fileData: r.fileData || null,
          fileName: r.fileName?.trim() || null,
          mimeType: r.mimeType || null,
        });
      }
    }

    const lesson = await repository.upsertLesson({
      classCode,
      date,
      periodId: parseInt(periodId, 10),
      title: cleanTitle,
      description: cleanDesc,
      teacherUserId: req.user!.id,
      resources: validResources,
    });

    res.json(lesson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/distance-learning/lessons
distanceLearningRouter.delete('/lessons', requireDistanceLearningUser, async (req: Request, res: Response) => {
  try {
    const { classCode, date, periodId } = req.body;
    if (!classCode || !date || !periodId) {
      res.status(400).json({ error: 'classCode, date, and periodId are required' });
      return;
    }

    const isMember = req.user?.classes?.includes(classCode) || req.user?.roles?.includes('Admin');
    if (!isMember) {
      res.status(403).json({ error: 'Forbidden: Class membership required' });
      return;
    }

    await repository.deleteLesson(classCode, date, parseInt(periodId, 10));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Parent child distance-learning handlers (defined per spec)
// -------------------------------------------------------------

// GET /api/distance-learning/children
distanceLearningRouter.get('/children', requireAuth, async (req: Request, res: Response) => {
  // If later opened to parents, this returns linked children
  if (req.user?.userType !== 'Parent') {
    res.status(403).json({ error: 'Parent identity required' });
    return;
  }
  const children = await repository.getParentStudents(req.user.id);
  res.json({ children });
});

// GET /api/distance-learning/children/:id/classes
distanceLearningRouter.get('/children/:id/classes', requireAuth, async (req: Request, res: Response) => {
  if (req.user?.userType !== 'Parent') {
    res.status(403).json({ error: 'Parent identity required' });
    return;
  }
  const children = await repository.getParentStudents(req.user.id);
  const child = children.find(c => c.id === req.params.id);
  if (!child) {
    res.status(404).json({ error: 'Linked child not found' });
    return;
  }
  const allClasses = await repository.getAllClasses();
  const classes = allClasses.filter(c => child.classes?.includes(c.code));
  res.json({ classes });
});
