import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { repository } from '../server/db/repository.js';
import { mediaRouter } from '../server/routes/media.js';
import { isMediaUrl } from '../server/db/media.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const PNG2 = 'data:image/png;base64,AAAAAAAA';
const TXT = `data:text/plain;base64,${Buffer.from('hello lesson').toString('base64')}`;

describe('Media handling in the repository', () => {
  it('returns media URLs instead of data and keeps the stored value when a URL is echoed back', async () => {
    const saved = await repository.updateBranding({ navLogo: PNG });
    expect(isMediaUrl(saved.navLogo)).toBe(true);
    expect((await repository.getMedia('navLogo'))?.data).toBe(PNG);

    const echoed = await repository.updateBranding({ mainColor: '#002B49', navLogo: saved.navLogo });
    expect(isMediaUrl(echoed.navLogo)).toBe(true);
    expect((await repository.getMedia('navLogo'))?.data).toBe(PNG);

    await repository.updateBranding({ navLogo: null });
    expect((await repository.getBranding()).navLogo).toBeNull();
    expect((await repository.getMedia('navLogo'))?.data).toBeNull();
  });

  it('serves profile pictures by URL and preserves them across profile updates', async () => {
    await repository.upsertStaffUser({ id: 'media-staff', email: 'media.staff@jess.sch.ae', displayName: 'Media Staff' });
    const url = await repository.updateUserProfilePicture('Staff', 'media-staff', PNG);
    expect(url).toMatch(/^\/api\/media\/users\/media-staff\/picture\?v=\d+$/);

    const fetched = await repository.getStaffById('media-staff');
    expect(fetched?.profilePicture).toBe(url);
    await repository.updateStaffUser('media-staff', { ...fetched!, jobTitle: 'Teacher' });
    expect((await repository.getMedia('userPicture', 'media-staff'))?.data).toBe(PNG);
  });

  it('passes external stream thumbnails through and keeps uploaded ones on edit', async () => {
    const external = await repository.upsertStream({ title: 'Ext', videoUrl: 'https://x.test/v', streamType: 'Live', accessType: 'Free to Air', categories: '', thumbnailUrl: 'https://img.test/t.png' });
    expect(external.thumbnailUrl).toBe('https://img.test/t.png');

    const uploaded = await repository.upsertStream({ title: 'Up', videoUrl: 'https://x.test/v', streamType: 'Live', accessType: 'Free to Air', categories: '', thumbnailUrl: PNG });
    expect(isMediaUrl(uploaded.thumbnailUrl)).toBe(true);
    const edited = await repository.upsertStream({ ...uploaded, title: 'Up 2' });
    expect(edited.title).toBe('Up 2');
    expect((await repository.getMedia('streamThumbnail', uploaded.id))?.data).toBe(PNG);
  });

  it('updates lesson resources in place, keeping stored files unless replaced', async () => {
    const base = { classCode: '7A', date: '2030-01-07', periodId: 1, title: 'Lesson', teacherUserId: 'dev-staff-1' };
    const first = await repository.upsertLesson({
      ...base,
      resources: [
        { label: 'Worksheet', fileData: TXT, fileName: 'sheet.txt', mimeType: 'text/plain' },
        { label: 'Link', url: 'https://example.com' },
      ],
    });
    const [sheet, link] = first.resources!;
    expect(sheet.fileData).toBeUndefined();
    expect(sheet.hasFile).toBe(true);
    expect(sheet.fileUrl).toBe(`/api/media/lesson-resources/${sheet.id}/file`);
    expect(link.hasFile).toBe(false);

    // Echo the worksheet back (no fileData) and drop the link: same id, same file.
    const second = await repository.upsertLesson({ ...base, title: 'Lesson v2', resources: [{ ...sheet, label: 'Worksheet v2' }] });
    expect(second.resources).toHaveLength(1);
    expect(second.resources![0]).toMatchObject({ id: sheet.id, label: 'Worksheet v2', hasFile: true, fileName: 'sheet.txt' });
    expect((await repository.getMedia('lessonResource', sheet.id))).toMatchObject({ data: TXT, classCode: '7A' });

    // A new upload replaces the stored file.
    await repository.upsertLesson({ ...base, resources: [{ ...second.resources![0], fileData: PNG2, fileName: 'new.png', mimeType: 'image/png' }] });
    expect((await repository.getMedia('lessonResource', sheet.id))).toMatchObject({ data: PNG2, fileName: 'new.png' });
  });
});

describe('Media routes', () => {
  let server: Server;
  let baseUrl: string;
  let currentUser: any = null;

  beforeAll(() => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = currentUser;
      next();
    });
    app.use('/api/media', mediaRouter);
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('serves public branding images with long-lived caching for versioned URLs', async () => {
    const { navLogo } = await repository.updateBranding({ navLogo: PNG });
    const res = await fetch(`${baseUrl}${navLogo}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from('iVBORw0KGgo=', 'base64'));

    await repository.updateBranding({ navLogo: null });
    expect((await fetch(`${baseUrl}/api/media/branding/navLogo`)).status).toBe(404);
  });

  it('restricts lesson files to class members and sends them as attachments', async () => {
    const lesson = await repository.upsertLesson({
      classCode: '7A', date: '2030-01-08', periodId: 1, title: 'Files', teacherUserId: 'dev-staff-1',
      resources: [{ label: 'Notes', fileData: TXT, fileName: 'notes.txt', mimeType: 'text/plain' }],
    });
    const fileUrl = `${baseUrl}${lesson.resources![0].fileUrl}`;

    currentUser = null;
    expect((await fetch(fileUrl)).status).toBe(401);

    currentUser = { id: 'x', userType: 'Staff', roles: ['Staff'], classes: ['8B'] };
    expect((await fetch(fileUrl)).status).toBe(403);

    currentUser = { id: 'x', userType: 'Staff', roles: ['Staff'], classes: ['7A'] };
    const res = await fetch(fileUrl);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment; filename="notes.txt"');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(await res.text()).toBe('hello lesson');
  });

  it('only lets staff view other users\' pictures', async () => {
    await repository.upsertStaffUser({ id: 'pic-owner', email: 'pic.owner@jess.sch.ae', displayName: 'Pic Owner' });
    const url = await repository.updateUserProfilePicture('Staff', 'pic-owner', PNG);

    currentUser = { id: 'parent-1', userType: 'Parent' };
    expect((await fetch(`${baseUrl}${url}`)).status).toBe(403);

    currentUser = { id: 'someone', userType: 'Staff', roles: ['Staff'] };
    const res = await fetch(`${baseUrl}${url}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('private');
  });
});
