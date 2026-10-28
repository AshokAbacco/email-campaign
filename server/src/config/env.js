import 'dotenv/config';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

const missing = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing in .env: ${missing.join(', ')}. Create server/.env from .env.example`);
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl,
  jwtSecret: process.env.JWT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${backendUrl}/api/oauth/google/callback`,
  },
  yahoo: {
    clientId: process.env.YAHOO_CLIENT_ID,
    clientSecret: process.env.YAHOO_CLIENT_SECRET,
    redirectUri: `${backendUrl}/api/oauth/yahoo/callback`,
  },
};

if (!/^[0-9a-f]{64}$/i.test(config.encryptionKey)) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}