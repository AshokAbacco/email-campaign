export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Retry on provider rate limits with exponential backoff
export async function withRetry(fn, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = e.code || e.status || e.response?.status;
      const rate = code === 429 || /rate.?limit|quota|too many|throttl/i.test(e.message || '');
      if (!rate || i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

export const isAuthError = (e) =>
  e?.authenticationFailed === true ||
  e?.response?.status === 401 ||
  e?.code === 401 ||
  /invalid_grant|invalid_client|unauthorized|auth(entication)? ?failed|invalid credentials|login failed/i.test(e?.message || '');
