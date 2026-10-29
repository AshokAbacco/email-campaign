// server/src/utils/limits.js
export const MAX_ACCOUNTS_PER_FOLDER = 8;

// Hourly sending limit, chosen per sending account (emails per hour). Must match the client copy:
// client/src/pages/campaigns/utils/sendingRate.js
export const MIN_HOURLY_LIMIT = 1;
export const MAX_HOURLY_LIMIT = 500;

// "Default" option in the account list, by provider
export const DEFAULT_HOURLY_LIMIT = { GMAIL: 20, GSUITE: 30, YAHOO: 10, IMAP: 20 };

// Sending interval = 60 minutes ÷ emails per hour (e.g. 30/hour -> one email every 2 minutes)
export const intervalMs = (hourlyLimit) => Math.ceil(3_600_000 / hourlyLimit);