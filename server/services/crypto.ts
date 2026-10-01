import crypto from 'crypto';
import { config } from '../config.js';

export function signPayload(payload: object, secret = config.sessionSecret): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${hmac}`;
}

export function verifySignedPayload<T = any>(token: string, secret = config.sessionSecret): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedHmac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedHmac);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export function generateSixDigitCode(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}
