// server/src/utils/signature.js
//
// Signature added to the end of every campaign / follow-up email:
//
//   Regards,
//   Leo Barnick – Marketing Analyst
//
// The name is the "Sender Name" of the mailbox that sends the email (set when the account is added),
// so with several rotating accounts each email is signed by its own sender.
// The title defaults to "Marketing Analyst"; change it with SIGNATURE_TITLE in server/.env
// (set SIGNATURE_TITLE= empty to show only the name).

const TITLE = (process.env.SIGNATURE_TITLE ?? 'Marketing Analyst').trim();

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// accounts connected via Google sign-in have the email address as their name: no name line then
export function senderName(account) {
  const n = (account?.displayName || '').trim();
  return n && !n.includes('@') ? n : '';
}

export function signatureHtml(account) {
  const name = senderName(account);
  const line = name ? esc(name) + (TITLE ? ` – ${esc(TITLE)}` : '') : '';
  // bold as a <b> tag (works in every mail client, also when styles are stripped)
  return `<p style="margin:16px 0 0 0"><b>Regards,${line ? `<br>${line}` : ''}</b></p>`;
}

// body + signature; skipped when the pitch already ends with its own "Regards, …" sign-off
export function withSignature(bodyHtml, account) {
  if (/\b(regards|thanks|thank you|sincerely|cheers),\s*[^.?!]{0,80}$/i.test(plain(bodyHtml).slice(-120))) return bodyHtml;
  return bodyHtml + signatureHtml(account);
}