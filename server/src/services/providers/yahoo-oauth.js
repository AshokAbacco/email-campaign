import { config } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

const { clientId, clientSecret, redirectUri } = config.yahoo;
const basic = () => 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

async function tokenRequest(params) {
  const r = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`${d.error || 'yahoo_error'}: ${d.error_description || 'token request failed'}`);
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: Date.now() + d.expires_in * 1000 };
}

export const authUrl = (state) =>
  'https://api.login.yahoo.com/oauth2/request_auth?' +
  new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email mail-w', state });

export async function exchangeCode(code) {
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const u = await (await fetch('https://api.login.yahoo.com/openid/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.accessToken}` } })).json();
  if (!u.email) throw new Error('Could not read the Yahoo email address');
  return { email: u.email, name: u.name, tokens };
}

export async function freshAccessToken(account) {
  const s = decrypt(account.encryptedSecret);
  if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken, redirect_uri: redirectUri });
  const next = { ...s, ...t, refreshToken: t.refreshToken || s.refreshToken };
  await prisma.emailAccount.update({ where: { id: account.id }, data: { encryptedSecret: encrypt(next) } });
  return next.accessToken;
}
