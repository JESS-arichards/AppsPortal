import { describe, it, expect } from 'vitest';
import { repository } from '../server/db/repository.js';
import { memoryStore } from '../server/db/index.js';

describe('Data Repository Operations', () => {
  it('loads branding configuration with defaults', async () => {
    const branding = await repository.getBranding();
    expect(branding).toBeDefined();
    expect(branding.mainColor).toBe('#002B49');
    expect(branding.accentColor).toBe('#BA9B37');
  });
  it('handles staff and student user upsert and retrieval', async () => {
    const staff = await repository.upsertStaffUser({
      id: 'test-staff-1',
      email: 'test.teacher@jess.sch.ae',
      displayName: 'Test Teacher',
      jobTitle: 'Senior Teacher',
      division: 'Secondary',
      parkingSpace: 42,
    });
    expect(staff.email).toBe('test.teacher@jess.sch.ae');

    const fetched = await repository.getStaffById('test-staff-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.parkingSpace).toBe(42);
  });

  it('manages parking release and reservation lifecycle', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    // Create a release for staff-1 space 15
    const [release] = await repository.createParkingReleases('dev-staff-1', 15, [dateStr]);
    expect(release).toBeDefined();
    expect(release.space).toBe(15);
    expect(release.reserverUserId).toBeNull();

    // Staff-2 reserves this space
    const reserved = await repository.reserveParkingRelease(release.id, 'dev-staff-2');
    expect(reserved.reserverUserId).toBe('dev-staff-2');

    // Overview shows reserved space
    const overview = await repository.getParkingOverview('dev-staff-2');
    expect(overview.yourReservations.some(r => r.id === release.id)).toBe(true);

    // Staff-2 cancels reservation
    const cancelled = await repository.cancelParkingReservation(release.id, 'dev-staff-2');
    expect(cancelled.reserverUserId).toBeNull();

    // Owner cancels the release
    const removed = await repository.cancelParkingRelease(release.id, 'dev-staff-1');
    expect(removed.release.id).toBe(release.id);
  });

  it('creates and manages absence requests and optional parking release', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    // Staff with assigned space 45 requests absence and releases space
    const absence = await repository.createAbsenceRequest('staff-teacher-1', dateStr, dateStr, 'Medical appointment', true);
    expect(absence).toBeDefined();
    expect(absence.reason).toBe('Medical appointment');
    expect(absence.releasedSpace).toBe(45);

    const overview = await repository.getAbsenceOverview('staff-teacher-1');
    expect(overview.requests.some(a => a.id === absence.id)).toBe(true);

    const linked = (await repository.getAllParkingReleases()).filter(r => r.absenceRequestId === absence.id);
    expect(linked.map(r => r.date)).toEqual(
      new Date(dateStr).getUTCDay() % 6 === 0 ? [] : [dateStr],
    );
  });

  it('cancelling an absence withdraws unreserved releases and keeps reserved ones', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 30);
    while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1); // next Monday a month out
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 4);
    const [startStr, endStr] = [start, end].map(d => d.toISOString().slice(0, 10));

    const absence = await repository.createAbsenceRequest('staff-teacher-1', startStr, endStr, 'Training', true);
    const releases = (await repository.getAllParkingReleases()).filter(r => r.absenceRequestId === absence.id);
    expect(releases).toHaveLength(5);

    await repository.reserveParkingRelease(releases[2].id, 'dev-staff-2');
    await repository.cancelAbsenceRequest(absence.id, 'staff-teacher-1');

    const remaining = (await repository.getAllParkingReleases()).filter(r => releases.some(x => x.id === r.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(releases[2].id);
    expect(remaining[0].absenceRequestId).toBeNull();
  });

  it('keeps only the latest parent login code per address', async () => {
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await repository.saveParentLoginCode('codes@example.com', 'first', expires);
    await repository.saveParentLoginCode('codes@example.com', 'second', expires);
    expect(memoryStore.parentLoginCodes.filter(c => c.email === 'codes@example.com')).toHaveLength(1);
    expect((await repository.getLatestParentLoginCode('codes@example.com'))?.codeHash).toBe('second');
  });

  it('resolves pending parent links upon student registration', async () => {
    // 1. Admin creates parent and links to future student email
    const parent = await repository.createParentUser({
      email: 'parent.future@example.com',
      displayName: 'Future Parent',
    });
    const studentEmail = 'future.child@jess.sch.ae';
    await repository.createPendingParentLink(parent.id, studentEmail);

    const pendingBefore = await repository.getPendingParentLinks();
    expect(pendingBefore.some(p => p.studentEmail === studentEmail)).toBe(true);

    // 2. Student signs in for first time
    const student = await repository.upsertStudentUser({
      id: 'student-new-1',
      email: studentEmail,
      displayName: 'Future Child',
    });

    // 3. Pending link should have automatically converted into parent student link
    const pendingAfter = await repository.getPendingParentLinks();
    expect(pendingAfter.some(p => p.studentEmail === studentEmail)).toBe(false);

    const linkedStudents = await repository.getParentStudents(parent.id);
    expect(linkedStudents.some(s => s.id === student.id)).toBe(true);
  });

  it('records admin impersonation audit trail', async () => {
    await repository.logImpersonationAudit({
      sessionId: 'sess-audit-1',
      actorUserId: 'dev-admin-1',
      actorEmail: 'admin@jess.sch.ae',
      targetUserId: 'dev-staff-1',
      targetEmail: 'teacher@jess.sch.ae',
      targetType: 'Staff',
      mode: 'view',
      eventType: 'start',
      details: 'Audit trail test',
    });

    const audits = memoryStore.impersonationAudit;
    expect(audits.length).toBeGreaterThan(0);
    const last = audits[audits.length - 1];
    expect(last.actorUserId).toBe('dev-admin-1');
    expect(last.mode).toBe('view');
  });
});
