# Email Campaign — Phase 1: Inbox

Stack: React + Vite + Tailwind + Lucide (frontend) · Node + Express + Prisma + PostgreSQL (backend).

## 1. Database (pgAdmin)
Create an empty database named `email_campaign`.

## 2. Backend
```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY (+ OAuth keys)
npm install
npx prisma generate
npx prisma migrate dev --name init     # creates all tables
npm run dev                            # http://localhost:5000
```
Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY (64 hex chars)
```
Production: `npx prisma migrate deploy`.

## 3. Frontend
```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```
Register an app user on the login page, then click **Add Mail Account**.

## 4. Provider credentials

**Gmail / Google Workspace (OAuth)**
1. Google Cloud Console → create project → enable **Gmail API**.
2. OAuth consent screen: add scopes `gmail.modify`, `gmail.send`, `userinfo.email`. While in "Testing", add your Gmail addresses as test users. (Restricted Gmail scopes need Google verification for public use.)
3. Credentials → OAuth client ID (Web). Authorized redirect URI: `http://localhost:5000/api/oauth/google/callback`
4. Put the client ID/secret in `backend/.env`.

**Yahoo Mail**
- Easiest: Yahoo account → Security → *Generate app password*, then use Yahoo Mail → app password in the modal (IMAP `imap.mail.yahoo.com:993`, SMTP `smtp.mail.yahoo.com:465`).
- OAuth: create an app at developer.yahoo.com, request mail scopes (Yahoo must approve `mail-w`), and use an **HTTPS** redirect URI `{BACKEND_URL}/api/oauth/yahoo/callback` (e.g. via ngrok; set `BACKEND_URL` accordingly).

**Custom IMAP/SMTP** — enter your server details; many providers require an app password.

## 5. How it works
- Credentials/tokens are AES-256-GCM encrypted in `EmailAccount.encryptedSecret`; they never reach the frontend.
- Sync fetches the newest 50 messages per folder, then only new ones (Gmail: skips known IDs; IMAP: UIDs above the last synced UID, plus a flag refresh of recent messages). "Fetch older mail from provider" backfills 50 more.
- Attachments: only metadata is stored; bytes are streamed from the provider on download.
- HTML email is sanitized with DOMPurify and shown in a sandboxed iframe (scripts disabled).
- Rate limits are retried with exponential backoff; auth failures mark the account `NEEDS_REAUTH` (warning icon in the sidebar).

## 6. API (all under `/api`, Bearer JWT except auth + OAuth callback)
`POST /auth/register|login` · `GET /auth/me` · `GET /accounts` · `POST /accounts/imap` · `GET /accounts/oauth/:gmail|gsuite|yahoo/start` · `GET /oauth/:google|yahoo/callback` · `POST /accounts/:id/sync` · `DELETE /accounts/:id` · `GET /folders` · `GET /messages` (`folder, accountId, folderId, q, page, limit`) · `GET /messages/search` · `GET /messages/:id` · `PATCH /messages/:id` (`isRead`, `isStarred`) · `POST /messages/:id/archive|trash` · `GET /messages/:id/attachments/:attId` · `POST /messages/send`

## Known limits (Phase 1)
- Remote read/star changes made elsewhere are refreshed for IMAP (recent messages) but not for already-synced Gmail messages.
- Remote images in emails are not blocked; Forward does not re-attach files.
- Folder/message deletes are "move to Trash" (no permanent delete).
