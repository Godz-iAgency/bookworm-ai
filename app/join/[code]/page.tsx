"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { planFromId } from "@/lib/plans";
import { storePendingInvite, clearPendingInvite } from "@/lib/pending-invite";

/**
 * Redeems a Book Club invite link (/join/<code>). A signed-out visitor is
 * sent to sign up first and lands back here afterwards, since joining needs
 * an account to attach the membership to.
 */
export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading } = useAuth();
  const code = typeof params.code === "string" ? params.code : "";

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookClub = planFromId("book_club");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Signed out: remember the invite so signing up doesn't lose it, and
      // send them to create the account this needs to attach to.
      storePendingInvite(code);
      router.push("/signup");
      return;
    }
    // Signed in and looking at the invite: the stored copy has done its job of
    // getting them here. Clearing it now rather than on a successful join
    // means an invite they decline, or one that turns out to be invalid, can't
    // keep redirecting them back here on every future sign-in.
    clearPendingInvite();
  }, [loading, user, code, router]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    const res = await postAuthed("/api/family/join", { code });
    if (res.error) {
      setError(res.error);
      setJoining(false);
      return;
    }
    clearPendingInvite();
    router.push("/search");
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={160} height={42} priority className="mb-8 opacity-90" />

      <Users className="mb-4 h-10 w-10 text-[#00D4FF]" strokeWidth={1.75} />
      <h1 className="mb-2 text-2xl font-bold">You&apos;ve been invited to a Book Club</h1>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-white/70">
        Join and you&apos;ll get your own {bookClub.monthlyGenerations} books a month, with up to{" "}
        {bookClub.maxOpenBooks} open at a time — on your inviter&apos;s subscription, at no cost to you.
      </p>

      {error && (
        <div className="mb-4 w-full max-w-sm rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <Button
        onClick={handleJoin}
        disabled={joining}
        className="h-12 w-full max-w-xs rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-base font-bold text-white transition-all hover:scale-105 disabled:opacity-60"
      >
        {joining ? "Joining..." : "Join the Book Club →"}
      </Button>
    </div>
  );
}
