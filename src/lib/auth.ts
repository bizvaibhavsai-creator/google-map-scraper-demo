export const SESSION_COOKIE_NAME = 'auth-session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function computeSessionToken(): Promise<string> {
  const email = process.env.AUTH_EMAIL || '';
  const password = process.env.AUTH_PASSWORD || '';
  if (!email || !password) return '';

  const data = new TextEncoder().encode(`${email}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
