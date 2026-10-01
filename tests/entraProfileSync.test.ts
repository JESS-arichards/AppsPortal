import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { authRouter } from '../server/routes/auth.js';
import { parkingSpaceFromPostalCode } from '../server/services/graph.js';
import { repository } from '../server/db/repository.js';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims: object) => `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}.x`;

describe('parkingSpaceFromPostalCode', () => {
  it('uses numeric postal codes and defaults everything else to 999', () => {
    expect(parkingSpaceFromPostalCode('42')).toBe(42);
    expect(parkingSpaceFromPostalCode(' 7 ')).toBe(7);
    expect(parkingSpaceFromPostalCode(null)).toBe(999);
    expect(parkingSpaceFromPostalCode('')).toBe(999);
    expect(parkingSpaceFromPostalCode('A12')).toBe(999);
    expect(parkingSpaceFromPostalCode('1234')).toBe(999);
  });
});

describe('Entra profile sync on sign-in', () => {
  let server: Server;
  let baseUrl: string;
  let graphProfile: Record<string, unknown>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    vi.stubGlobal('fetch', async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith('https://graph.microsoft.com/v1.0/me/photos')) return new Response(null, { status: 404 });
      if (url.startsWith('https://graph.microsoft.com/v1.0/me')) return new Response(JSON.stringify(graphProfile), { status: 200 });
      return realFetch(input, init);
    });
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    vi.unstubAllGlobals();
  });

  const sync = (claims: object, graphAccessToken?: string) =>
    fetch(`${baseUrl}/api/auth/users/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken(claims)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphAccessToken }),
    }).then(r => r.json());

  it('populates staff fields from Entra on first sign-in and refreshes them on later sign-ins', async () => {
    const claims = { oid: 'oid-entra-1', email: 'entra.sync@jess.sch.ae', name: 'Entra Sync' };
    graphProfile = {
      id: 'oid-entra-1', displayName: 'Entra Sync', givenName: 'Entra', surname: 'Sync', jobTitle: 'Teacher',
      department: 'Maths', postalCode: '42', employeeId: 'MIS123', employeeOrgData: { division: 'Secondary' },
    };

    const first = await sync(claims, 'graph-token');
    expect(first).toMatchObject({
      forename: 'Entra', surname: 'Sync', jobTitle: 'Teacher', department: 'Maths',
      division: 'Secondary', parkingSpace: 42, misId: 'MIS123',
    });

    graphProfile = { ...graphProfile, jobTitle: 'Head of Maths', postalCode: null, employeeId: null };
    const second = await sync(claims, 'graph-token');
    expect(second).toMatchObject({ jobTitle: 'Head of Maths', parkingSpace: 999, misId: null });

    const stored = await repository.getStaffById('oid-entra-1');
    expect(stored).toMatchObject({ jobTitle: 'Head of Maths', parkingSpace: 999, misId: null });
  });

  it('ignores a Graph profile that belongs to a different user', async () => {
    graphProfile = { id: 'someone-else', postalCode: '5', employeeId: 'HIJACK' };
    const res = await sync({ oid: 'oid-entra-2', email: 'entra.other@jess.sch.ae', name: 'Other' }, 'graph-token');
    expect(res.misId ?? null).toBeNull();
    expect(res.parkingSpace ?? null).toBeNull();
  });
});
