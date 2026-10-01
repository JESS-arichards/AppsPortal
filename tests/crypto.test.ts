import { describe, it, expect } from 'vitest';
import {
  signPayload,
  verifySignedPayload,
  generateSixDigitCode,
  hashCode,
} from '../server/services/crypto.js';

describe('Crypto & Signature Service', () => {
  it('signs and verifies cookie payload objects reliably', () => {
    const original = { sessionId: 'user-session-12345' };
    const signed = signPayload(original);
    expect(signed).toContain('.');

    const verified = verifySignedPayload<{ sessionId: string }>(signed);
    expect(verified).not.toBeNull();
    expect(verified?.sessionId).toBe('user-session-12345');
  });
  it('rejects tampered cookie payloads', () => {
    const original = { sessionId: 'user-session-12345' };
    const signed = signPayload(original);
    const [payload, hmac] = signed.split('.');
    const tampered = `${payload}X.${hmac}`;

    const verified = verifySignedPayload(tampered);
    expect(verified).toBeNull();
  });

  it('creates and verifies impersonation payload tokens', () => {
    const payload = {
      actorAdminId: 'admin-1',
      actorEmail: 'admin@jess.sch.ae',
      targetUserId: 'staff-1',
      targetEmail: 'teacher@jess.sch.ae',
      mode: 'view' as const,
      expiresAt: Date.now() + 1800000,
    };

    const token = signPayload(payload);
    const verified = verifySignedPayload<typeof payload>(token);

    expect(verified).not.toBeNull();
    expect(verified?.actorAdminId).toBe('admin-1');
    expect(verified?.targetUserId).toBe('staff-1');
    expect(verified?.mode).toBe('view');
  });

  it('detects expired payload based on timestamp', () => {
    const payload = {
      actorAdminId: 'admin-1',
      expiresAt: Date.now() - 1000, // already expired
    };

    const token = signPayload(payload);
    const verified = verifySignedPayload<typeof payload>(token);
    expect(verified).not.toBeNull();
    expect(verified!.expiresAt < Date.now()).toBe(true);
  });

  it('generates 6-digit codes and hashes them securely', () => {
    const code = generateSixDigitCode();
    expect(code).toMatch(/^\d{6}$/);

    const hash = hashCode(code);
    expect(hash).toHaveLength(64); // SHA-256 hex string

    expect(hashCode(code)).toBe(hash);
    expect(hashCode('000000')).not.toBe(hash);
  });
});
