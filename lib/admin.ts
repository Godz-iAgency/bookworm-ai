/**
 * The one account that runs Bookworm rather than reads it.
 *
 * Identity, not a secret — it is checked against the email on a verified
 * Firebase ID token, server-side, on every admin route. Keeping it in code
 * rather than an env var means the client can also use it to route the sign-in
 * straight to /admin, and there is exactly one place to change it.
 */
export const ADMIN_EMAIL = "christopher@godz-iagency.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}
