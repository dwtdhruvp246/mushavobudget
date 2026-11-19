// Call only after getUser() validates the same bearer-bound user client.
// No service client, actor/session arguments, client flags or cached approvals.
const CHECK_TIMEOUT_MS = 8000;
class EmailVerificationError extends Error {
  constructor(required) {
    super(required ? 'EMAIL_VERIFICATION_REQUIRED' : 'EMAIL_VERIFICATION_UNAVAILABLE');
    this.code = this.message;
    this.status = required ? 403 : 503;
  }
}

export async function requireEmailVerifiedSession(userClient) {
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => userClient.rpc('email_gate_current_session_verified')),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new EmailVerificationError(false)), CHECK_TIMEOUT_MS);
      }),
    ]);
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || result.error !== null || typeof result.data !== 'boolean') {
      throw new EmailVerificationError(false);
    }
    if (result.data !== true) throw new EmailVerificationError(true);
  } catch (error) {
    if (error instanceof EmailVerificationError) throw error;
    // Never expose SDK errors, JWTs, database details or unexpected payloads.
    throw new EmailVerificationError(false);
  } finally {
    clearTimeout(timer);
  }
}

export function emailVerificationFailure(error) {
  return error instanceof EmailVerificationError
    ? { code: error.code, status: error.status }
    : null;
}
