// Tarefa 5: username login must NOT resolve an email on the client, and the
// Gemini key must not be hard-wired into the request URL.

jest.mock('expo-linking', () => ({
  createURL: (p) => `calisthenicssolo://${p}`,
  addEventListener: () => ({ remove() {} }),
  getInitialURL: () => Promise.resolve(null),
}));

const mockSignInWithPassword = jest.fn();
const mockInvoke = jest.fn();
const mockSetSession = jest.fn();
const mockRpc = jest.fn();
jest.mock('../src/services/supabase', () => ({
  __esModule: true,
  supabaseEnabled: true,
  supabase: {
    auth: {
      signInWithPassword: (...a) => mockSignInWithPassword(...a),
      setSession: (...a) => mockSetSession(...a),
    },
    functions: { invoke: (...a) => mockInvoke(...a) },
    rpc: (...a) => mockRpc(...a),
  },
}));

import { signInWithIdentifier } from '../src/services/auth';

beforeEach(() => {
  mockSignInWithPassword.mockReset();
  mockInvoke.mockReset();
  mockSetSession.mockReset();
  mockRpc.mockReset();
});

test('email login signs in directly and never calls the function or an RPC', async () => {
  mockSignInWithPassword.mockResolvedValue({ data: { session: { id: 's' } }, error: null });

  const r = await signInWithIdentifier('a@b.com', 'pw');

  expect(r.session).toEqual({ id: 's' });
  expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('username login goes through the Edge Function (email never resolved client-side)', async () => {
  mockInvoke.mockResolvedValue({ data: { access_token: 'at', refresh_token: 'rt' }, error: null });
  mockSetSession.mockResolvedValue({ data: { session: { id: 's2' } }, error: null });

  const r = await signInWithIdentifier('bob', 'pw');

  expect(mockInvoke).toHaveBeenCalledWith('login-username', { body: { username: 'bob', password: 'pw' } });
  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  expect(r.session).toEqual({ id: 's2' });
  // the insecure path is gone
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockSignInWithPassword).not.toHaveBeenCalled();
});

test('failed username login returns a generic error and no session', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function not found' } });

  const r = await signInWithIdentifier('bob', 'pw');

  expect(r.session).toBeNull();
  expect(r.error.message).toBe('Invalid login credentials.'); // -> auth.errWrong, no enumeration
  expect(mockSetSession).not.toHaveBeenCalled();
});

// Static regression guards on the source/schema.
const fs = require('fs');
test('schema.sql no longer grants email_for_username to anon', () => {
  const sql = fs.readFileSync(require('path').join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
  expect(sql).not.toMatch(/grant execute on function public\.email_for_username/i);
  expect(sql).toMatch(/drop function if exists public\.email_for_username/i);
});

test('geminiService does not hard-wire the key into the URL and prefers the proxy', () => {
  const js = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'services', 'geminiService.js'), 'utf8');
  expect(js).not.toMatch(/generateContent\?key=\$\{GEMINI_API_KEY\}/);
  expect(js).toMatch(/gemini-proxy/);
  expect(js).toMatch(/PROXY_ENABLED/);
});
