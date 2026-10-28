import { decrypt } from '../../utils/crypto.js';
import { freshAccessToken } from './yahoo-oauth.js';

// Returns { user, pass } for password accounts or { user, accessToken } for Yahoo OAuth.
export async function credentialsFor(account) {
  const s = decrypt(account.encryptedSecret);
  if (s.password) return { user: account.username || account.email, pass: s.password };
  return { user: account.email, accessToken: await freshAccessToken(account) };
}
