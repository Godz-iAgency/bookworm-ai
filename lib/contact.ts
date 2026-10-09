/**
 * The one address readers write to, for anything: billing, sign-in trouble,
 * privacy requests, rights-holder concerns. It is an alias on the founder's own
 * Google Workspace account, so mail lands in the same inbox as everything else
 * and replies go out from this address.
 *
 * Kept in one place so a change of address is a one-line change, and so no
 * page quietly shows a personal address instead. The admin sign-in address in
 * lib/admin.ts is a different thing and is deliberately not this.
 */
export const SUPPORT_EMAIL = "bookworm-support@godz-iagency.com";
