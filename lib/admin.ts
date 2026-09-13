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

/**
 * The founder's own reading account — separate from the admin login above,
 * so he can read and generate books like anyone else, sharing a family with
 * Hudson's account, without the admin login ever showing him the reading app.
 *
 * Fixed rather than looked up: the switch endpoint (/api/admin/switch) mints
 * a custom token for exactly this uid and no other, in both directions, so
 * hardcoding it here is what keeps that endpoint from being a general
 * "sign in as anyone" tool. Checked client-side too, purely to decide whether
 * to show the "Switch to admin" button — the real gate is server-side.
 */
export const CHRISTOPHER_READER_UID = "Bw56ysog7SNxrQqaBGKeoQ6LOwd2";
