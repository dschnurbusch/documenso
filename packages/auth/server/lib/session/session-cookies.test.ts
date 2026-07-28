import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./session', () => ({
  generateSessionToken: () => 'test-csrf-token',
}));

describe('setSessionCookie', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('NEXTAUTH_SECRET', 'test-auth-secret');
    vi.stubEnv('NEXT_PUBLIC_WEBAPP_URL', 'http://localhost:3000');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('calculates a fresh expiration for every session cookie', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const { setSessionCookie } = await import('./session-cookies');
    const app = new Hono();

    app.get('/', async (c) => {
      await setSessionCookie(c, 'test-session-token');
      return c.text('ok');
    });

    const firstResponse = await app.request('/');
    const firstCookie = firstResponse.headers.get('set-cookie') ?? '';

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    const secondResponse = await app.request('/');
    const secondCookie = secondResponse.headers.get('set-cookie') ?? '';

    expect(firstCookie).toContain('Expires=Sat, 31 Jan 2026 00:00:00 GMT');
    expect(secondCookie).toContain('Expires=Sun, 01 Feb 2026 00:00:00 GMT');
  });

  it('uses a secure cookie for a production HTTPS deployment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_WEBAPP_URL', 'https://signatures.schnurbuschlaw.com');

    const { setSessionCookie } = await import('./session-cookies');
    const app = new Hono();

    app.get('/', async (c) => {
      await setSessionCookie(c, 'test-session-token');
      return c.text('ok');
    });

    const response = await app.request('/');
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(cookie).toContain('__Secure-sessionId=');
    expect(cookie).toContain('Domain=signatures.schnurbuschlaw.com');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=None');
  });
});
