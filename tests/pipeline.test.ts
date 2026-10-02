import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { app } from '../server/index.js';

let server: Server;
let baseUrl = '';

beforeAll(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe('request pipeline', () => {
  it('authenticates API requests and marks them no-store', async () => {
    const res = await fetch(`${baseUrl}/api/auth/users/me`, { headers: { 'x-user-id': 'staff-admin-1' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).user.id).toBe('staff-admin-1');
  });

  it('does not run auth for non-API routes', async () => {
    // A bogus bearer token would otherwise trigger an Entra verification attempt.
    const res = await fetch(`${baseUrl}/portal-config.js`, { headers: { authorization: 'Bearer not-a-real-token' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toContain('window.PORTAL_CONFIG');
  });

  it('lets public content revalidate with ETags', async () => {
    const first = await fetch(`${baseUrl}/api/branding`);
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-cache');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    // fetch() adds "Cache-Control: no-cache" to conditional requests unless one is supplied,
    // which would make Express skip the freshness check; browsers revalidate normally.
    const second = await fetch(`${baseUrl}/api/branding`, { headers: { 'if-none-match': etag!, 'cache-control': 'max-age=0' } });
    expect(second.status).toBe(304);
  });

  it('serves the SPA shell with no-cache', async () => {
    const res = await fetch(`${baseUrl}/some/client/route`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });
});
