"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { StoredBookCover } from "@/components/book-cover";
import { Copy, QrCode, UserMinus, Users, Loader2, BookOpen, X } from "lucide-react";
import { postAuthed } from "@/lib/api-client";
import { useBookwormContext } from "@/lib/BookwormContext";
import { getCountdown } from "@/lib/countdown";
import { sharedCourses, type ClubOverview } from "@/lib/book-club";

interface BookClubTabProps {
  currentTime: Date;
  onOpenCourse: (courseId: string) => void;
  /** Null while the club is still loading. Owned by the dashboard, which also
   *  needs it to decide whether a book can be shared from its detail screen. */
  overview: ClubOverview | null;
  reloadClub: () => Promise<void>;
}

/**
 * The club's shelf, beside everyone's personal one.
 *
 * Deliberately not a feed. Books appear here only because a member chose to
 * put them here, there is nothing to react to, and the only thing anyone can
 * do with someone else's book is read it. What the screen has to answer is
 * small and concrete: what can I read, who shared it, who else is here, and
 * (for the owner) who is using my seats.
 */
export default function BookClubTab({
  currentTime,
  onOpenCourse,
  overview,
  reloadClub,
}: BookClubTabProps) {
  const { courses, deleteCourse, openSharedBook } = useBookwormContext();

  const [error, setError] = useState<string | null>(null);
  const [busyShare, setBusyShare] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const prunedFor = useRef<string | null>(null);

  /**
   * Stop watching any shared book this reader is no longer entitled to.
   *
   * firestore.rules closes the actual door the moment a share is withdrawn, a
   * member is removed, or the book expires — this just stops the local
   * listener and drops it from the shelf on the same basis, so a device that
   * was mid-read when that happened doesn't sit there quietly re-fetching a
   * book it can no longer read. Keyed on the answer it acted on so it runs
   * once per load, not once per render.
   */
  useEffect(() => {
    if (!overview?.inClub) return;
    const key = overview.sharedBooks.map((s) => s.shareId).join("|");
    if (prunedFor.current === key) return;
    prunedFor.current = key;

    const entitled = new Set(overview.sharedBooks.map((s) => s.shareId));
    for (const course of sharedCourses(courses)) {
      if (!entitled.has(course.id)) void deleteCourse(course.id).catch(e => setError(e.message));
    }
  }, [overview, courses, deleteCourse]);

  const openShared = async (shareId: string) => {
    setError(null);
    if (!overview?.inClub) return;
    // Already watching it: go straight in rather than re-validating a share
    // that's already live on screen.
    if (courses.some((c) => c.id === shareId)) {
      onOpenCourse(shareId);
      return;
    }
    setBusyShare(shareId);
    const res = await postAuthed<{ error?: string; sharedByUid: string; sharedByName: string; sourceCourseId: string }>(
      "/api/family/open-shared",
      { shareId },
    );
    setBusyShare(null);
    if (res.error) {
      setError(res.error);
      // "No longer shared with your Book Club" means this screen is stale, and
      // the reload is what takes the card away rather than leaving a button
      // that keeps failing.
      void reloadClub();
      return;
    }
    openSharedBook(
      shareId,
      { shareId, familyId: overview.familyId, sharedByUid: res.sharedByUid, sharedByName: res.sharedByName },
      res.sharedByUid,
      res.sourceCourseId,
    );
    onOpenCourse(shareId);
  };

  const unshare = async (shareId: string) => {
    setError(null);
    setBusyShare(shareId);
    const res = await postAuthed("/api/family/unshare", { shareId });
    setBusyShare(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    await reloadClub();
  };

  const removeMember = async (memberUid: string) => {
    setError(null);
    setConfirmRemove(null);
    const res = await postAuthed("/api/family/remove-member", { memberUid });
    if (res.error) {
      setError(res.error);
      return;
    }
    setInviteLink(null);
    setQr(null);
    await reloadClub();
  };

  const createInvite = async () => {
    setError(null);
    setInviting(true);
    const res = await postAuthed("/api/family/invite");
    setInviting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const link = `${window.location.origin}/join/${res.code}`;
    setInviteLink(link);
    QRCode.toDataURL(link, { width: 240, margin: 1 })
      .then(setQr)
      // A QR code is the convenience; the link is the invitation. Losing the
      // picture must not take the link down with it.
      .catch((e) => console.error("Could not draw the invite QR code:", e));
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  };

  if (!overview) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  if (!overview.inClub) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 text-center md:p-8">
        <Users className="mx-auto mb-4 h-10 w-10 text-white/30" strokeWidth={1.75} />
        <h2 className="text-xl font-bold">You&rsquo;re not in a Book Club</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/60">
          Book Club is the $34.99 plan: you and up to three others, each with your own books, reading
          from one subscription.
        </p>
      </div>
    );
  }

  const seatsUsed = overview.members.length;

  return (
    <div className="mx-auto w-full max-w-5xl animate-in fade-in p-4 pb-10 duration-500 md:p-8">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Book Club</h2>
        <p className="mt-1 text-sm text-white/60 md:text-base">
          Books your club has chosen to share. Your progress is your own.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Members */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Members</h3>
          <span className="text-xs font-bold text-white/60">
            {seatsUsed} of {overview.maxMembers} seats
          </span>
        </div>

        <ul className="space-y-2">
          {overview.members.map((member) => (
            <li
              key={member.uid}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00D4FF]/25 to-[#FF006E]/25 text-sm font-bold">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{member.name}</span>
              {member.isOwner && (
                <span className="shrink-0 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#00D4FF]">
                  Owner
                </span>
              )}
              {member.isYou && (
                <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                  You
                </span>
              )}
              {/* Removing someone ends their access and starts a 7-day clock on
                  their account, so it never fires straight from the icon. */}
              {overview.isOwner && !member.isOwner && (
                <button
                  onClick={() => setConfirmRemove(member.uid)}
                  aria-label={`Remove ${member.name}`}
                  className="shrink-0 rounded-full p-1.5 text-white/40 transition-colors hover:bg-[#FF006E]/15 hover:text-[#FF006E]"
                >
                  <UserMinus className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>

        {confirmRemove && (
          <div className="mt-3 rounded-xl border border-[#FF006E]/40 bg-[#FF006E]/10 p-4">
            <p className="text-sm leading-relaxed text-white/85">
              Remove{" "}
              <span className="font-bold">
                {overview.members.find((m) => m.uid === confirmRemove)?.name}
              </span>
              ? They lose the club&rsquo;s books straight away and keep their own account for 7 days
              to choose a plan, after which it&rsquo;s deleted.
            </p>
            <div className="mt-3 flex gap-2.5">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 transition-all hover:bg-white/5"
              >
                Keep them
              </button>
              <button
                onClick={() => removeMember(confirmRemove)}
                className="flex-1 rounded-lg bg-[#FF006E] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[#FF006E]/85"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {overview.isOwner && (
          <div className="mt-4 border-t border-white/10 pt-4">
            {overview.seatsAvailable === 0 ? (
              <p className="text-xs text-white/50">
                Every seat is taken. Remove someone to free one up.
              </p>
            ) : inviteLink ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80">
                    {inviteLink}
                  </code>
                  <button
                    onClick={copyInvite}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {qr && (
                    <button
                      onClick={() => setShowQr((v) => !v)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                    >
                      <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
                      {showQr ? "Hide" : "QR"}
                    </button>
                  )}
                </div>
                {showQr && qr && (
                  // On white, always: a scanner needs the quiet zone and the
                  // contrast, and this app's background is nearly black.
                  <div className="mt-3 flex justify-center">
                    <div className="rounded-xl bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="QR code for the Book Club invite link" className="h-44 w-44" />
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-white/40">
                  One invite, one seat. Send it to the person you want to join.
                </p>
              </>
            ) : (
              <button
                onClick={createInvite}
                disabled={inviting}
                className="w-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {inviting ? "Creating…" : "Invite a member"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Shared books */}
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
        Shared books ({overview.sharedBooks.length})
      </h3>

      {overview.sharedBooks.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-white/25" strokeWidth={1.75} />
          <p className="text-sm text-white/60">Nothing shared yet.</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-white/40">
            Open one of your own books, tap the ••• on its card, and choose{" "}
            <span className="text-white/60">Share with Book Club</span>.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {overview.sharedBooks.map((shared) => {
            const countdown = getCountdown(shared.expiresAt, currentTime);
            const started = courses.some((c) => c.id === shared.shareId);
            const busy = busyShare === shared.shareId;
            return (
              <div
                key={shared.shareId}
                className="flex gap-3 rounded-2xl border border-white/10 bg-[#111] p-3.5"
              >
                <StoredBookCover
                  title={shared.title}
                  author={shared.author}
                  coverUrl={shared.coverUrl}
                  className="h-24 w-16 shrink-0 shadow-md"
                  rounded="rounded-lg"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-bold">{shared.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-white/50">
                    {shared.isMine ? "You shared this" : `Shared by ${shared.sharedByName}`}
                  </p>
                  <span
                    className={`mt-1.5 inline-block w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${countdown.className}`}
                  >
                    {countdown.label}
                  </span>

                  <div className="mt-auto flex items-center gap-2 pt-2.5">
                    <button
                      onClick={() => openShared(shared.shareId)}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0096ff] px-3 py-1.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                    >
                      {busy ? "Opening…" : started ? "Continue" : "Start reading"}
                    </button>
                    {shared.isMine && (
                      <button
                        onClick={() => unshare(shared.shareId)}
                        disabled={busy}
                        aria-label="Remove from Book Club"
                        className="shrink-0 rounded-lg border border-white/15 p-1.5 text-white/50 transition-colors hover:bg-[#FF006E]/15 hover:text-[#FF006E] disabled:opacity-60"
                      >
                        <X className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
