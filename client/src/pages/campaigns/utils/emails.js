const RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Pulls every email address out of pasted text or a CSV/TXT file, de-duplicated
export const extractEmails = (text = '') => [...new Set((text.match(RE) || []).map((e) => e.toLowerCase()))];
