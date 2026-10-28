import { gmail } from './gmail.js';
import { imap } from './imap.js';

export const providerFor = (account) =>
  (account.provider === 'GMAIL' || account.provider === 'GSUITE') && !account.imapHost ? gmail : imap;