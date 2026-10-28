import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { credentialsFor } from './providers/credentials.js';
import { gmailClient } from './providers/gmail.js';

// Gmail / G Suite connected via Google OAuth have no IMAP/SMTP host stored -> use the Gmail API.
// Gmail / G Suite connected with an app password have SMTP details -> use SMTP like any other account.
const usesGmailApi = (account) => (account.provider === 'GMAIL' || account.provider === 'GSUITE') && !account.imapHost;

async function transportFor(account) {
  const c = await credentialsFor(account);
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    requireTLS: !account.smtpSecure,
    auth: c.pass ? { user: c.user, pass: c.pass } : { type: 'OAuth2', user: c.user, accessToken: c.accessToken },
  });
}

export async function verifySmtp(account) {
  await (await transportFor(account)).verify();
}

export async function sendMail(account, mail) {
  const message = { from: { name: account.displayName, address: account.email }, ...mail };

  if (usesGmailApi(account)) {
    const raw = await new Promise((resolve, reject) =>
      new MailComposer(message).compile().build((err, buf) => (err ? reject(err) : resolve(buf)))
    );
    await gmailClient(account).users.messages.send({ userId: 'me', requestBody: { raw: raw.toString('base64url') } });
    return;
  }

  await (await transportFor(account)).sendMail(message);
}