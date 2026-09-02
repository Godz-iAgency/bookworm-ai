"use client";

import { useState, type FormEvent } from "react";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { friendlyAuthError } from "@/lib/firebase/auth";
import { postAuthed } from "@/lib/api-client";

/**
 * Public account-deletion page.
 *
 * Google Play requires a deletion route that works for someone who has
 * already uninstalled the app, so this deliberately lives outside the
 * dashboard: no app shell, no auth guard, nothing that assumes the reader
 * still has Bookworm installed. It signs them in here and then calls the very
 * same /api/account/delete the in-app button uses, so there is one deletion
 * path to keep correct rather than two.
 *
 * Signing in is required rather than, say, emailing a link: deletion is
 * irreversible and takes a Book Club down with it, so proving the account is
 * yours has to happen before anything is destroyed.
 */

/** Optional. Set NEXT_PUBLIC_SUPPORT_EMAIL to offer a route for anyone locked out of their sign-in. */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function DeleteAccountPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch {
      setError("That email or password didn't work. Please try again.");
    }
    setSigningIn(false);
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const res = await postAuthed<{ error?: string }>("/api/account/delete");
    if (res.error) {
      setDeleting(false);
      setError(res.error);
      return;
    }
    // The account no longer exists, so the local session is stale. Sign out
    // before showing the confirmation, or Firebase keeps a user object around
    // for a deleted uid and the page flips back to the confirm step.
    await logout().catch(() => {});
    setDeleted(true);
    setDeleting(false);
  };

  const canDelete = confirmText.trim().toUpperCase() === "DELETE" && !deleting;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[hsl(222,94%,5%)] px-4 py-10">
      <Link href="/" className="shrink-0">
        <Logo variant="stacked" priority className="w-44 drop-shadow-2xl sm:w-52" />
      </Link>

      <div className="mt-6 w-full max-w-lg">
        {/* Deletion succeeded — this must win over every other state, because
            signing out has just set `user` back to null and the sign-in form
            would otherwise reappear as though nothing had happened. */}
        {deleted ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" strokeWidth={2.5} />
            </div>
            <h1 className="mt-4 text-xl font-black text-white">Your account is deleted</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Your profile, your courses and your reading data have been removed, and any
              subscription has been cancelled. You won&apos;t be charged again.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg border border-white/15 px-5 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Back to Bookworm.AI
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight text-white">Delete your account</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              This permanently deletes your Bookworm.AI account and everything in it. You can also
              do this inside the app, under Profile, but you don&apos;t need the app installed to
              use this page.
            </p>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-white/40">
                What gets deleted
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75">
                <li>Your sign-in and your profile.</li>
                <li>
                  Every course you&apos;ve generated, along with its lessons, flashcards and your
                  progress through them.
                </li>
                <li>Your reading level, genre preferences and reading settings.</li>
                <li>Your Book Club membership.</li>
              </ul>

              <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-white/40">
                What happens to your subscription
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75">
                <li>Any active subscription is cancelled immediately and you won&apos;t be charged again.</li>
                <li>
                  If you own a Book Club, everyone you invited loses access at the same moment, so
                  it&apos;s worth telling them first.
                </li>
              </ul>

              <h2 className="mt-6 text-xs font-bold uppercase tracking-wide text-white/40">
                What we keep
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Records of payments you already made stay with our payment processor, Stripe,
                because tax and accounting rules require them to be kept. They are no longer
                attached to a usable account.
              </p>
            </section>

            <div className="mt-4 flex gap-2.5 rounded-lg border border-[#FF006E]/35 bg-[#FF006E]/10 px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF006E]" strokeWidth={2} />
              <p className="text-[13px] leading-relaxed text-[#FF006E]">
                Deletion happens straight away and cannot be undone. There is no recovery window.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {loading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking your sign-in...
              </div>
            ) : user ? (
              /* ---- Signed in: confirm ---------------------------------- */
              <section className="mt-6 rounded-2xl border border-[#FF006E]/25 bg-[#FF006E]/[0.04] p-5">
                <p className="text-sm text-white/70">
                  Signed in as{" "}
                  <span className="font-bold text-white">{user.email ?? "your account"}</span>.{" "}
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
                  >
                    Not you?
                  </button>
                </p>

                <label
                  htmlFor="confirm-delete"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-white/40"
                >
                  Type DELETE to confirm
                </label>
                <input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF006E]/60"
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className="mt-3 w-full rounded-lg bg-[#FF006E] px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
                >
                  {deleting ? "Deleting..." : "Delete my account forever"}
                </button>
              </section>
            ) : (
              /* ---- Signed out: prove it's your account ------------------ */
              <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-bold text-white">Sign in to confirm it&apos;s you</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                  We ask for this because deleting an account can&apos;t be reversed.
                </p>

                <form onSubmit={handleSignIn} className="mt-4 space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]/60"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]/60"
                  />
                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {signingIn ? "Signing in..." : "Sign in"}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-white/30">
                  <span className="h-px flex-1 bg-white/10" />
                  or
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full rounded-lg border border-white/15 px-4 py-3 text-sm font-bold text-white/85 transition-colors hover:bg-white/10"
                >
                  Continue with Google
                </button>

                {SUPPORT_EMAIL && (
                  <p className="mt-4 text-[12px] leading-relaxed text-white/45">
                    Can&apos;t sign in?{" "}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
                      className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
                    >
                      Email us
                    </a>{" "}
                    from the address on your account and we&apos;ll delete it for you.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
