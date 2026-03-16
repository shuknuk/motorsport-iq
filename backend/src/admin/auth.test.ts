jest.mock('../db/supabaseClient', () => ({
  __esModule: true,
  default: {},
}));

import { createAdminSessionToken, verifyAdminSessionToken } from './auth';

describe('admin auth helpers', () => {
  it('accepts a valid session token', () => {
    const secret = 'test-secret';
    const token = createAdminSessionToken(Date.now() + 60_000, secret);

    expect(verifyAdminSessionToken(token, secret)).toBe(true);
  });

  it('rejects an expired session token', () => {
    const secret = 'test-secret';
    const token = createAdminSessionToken(Date.now() - 1_000, secret);

    expect(verifyAdminSessionToken(token, secret)).toBe(false);
  });

  it('rejects a tampered session token', () => {
    const secret = 'test-secret';
    const token = createAdminSessionToken(Date.now() + 60_000, secret);
    const tampered = `${token}tampered`;

    expect(verifyAdminSessionToken(tampered, secret)).toBe(false);
  });
});
