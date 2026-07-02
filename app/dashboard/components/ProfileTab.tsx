"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/profile";
import { fileToAvatarDataUrl } from "@/lib/image";
import { READING_LEVELS } from "@/lib/reading-levels";

// Max size we accept from the file picker before resizing. The output stored
// in Firestore is tiny (~10–40KB), but we bound the input to avoid decoding a
// huge photo on a low-end phone.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB

export default function ProfileTab() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [readingLevel, setReadingLevel] = useState<string | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the user's profile doc (avatar + reading level).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled) return;
        // Fall back to the Firebase Auth photo (e.g. Google) if the doc has none.
        setPhotoURL(profile?.photoURL ?? user.photoURL ?? null);
        setReadingLevel(profile?.readingLevel ?? null);
      } catch (e) {
        console.error("Failed to load profile:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePickFile = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That image is too large. Please pick one under 12MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateUserProfile(user.uid, { photoURL: dataUrl });
      setPhotoURL(dataUrl);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      setError("Couldn't update your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectLevel = async (id: string) => {
    if (!user) return;
    if (id === readingLevel) {
      setLevelOpen(false);
      return;
    }
    setSavingLevel(id);
    setError(null);
    const previous = readingLevel;
    setReadingLevel(id); // optimistic
    setLevelOpen(false);
    try {
      await updateUserProfile(user.uid, { readingLevel: id });
    } catch (err) {
      console.error("Failed to save reading level:", err);
      setReadingLevel(previous); // roll back on failure
      setError("Couldn't save your reading level. Please try again.");
    } finally {
      setSavingLevel(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initial = (user?.email?.[0] ?? "?").toUpperCase();
  const currentLevel = READING_LEVELS.find((l) => l.id === readingLevel);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24 md:pb-8 flex flex-col min-h-full">
      {/* Identity */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[#00D4FF]/20 to-[#FF006E]/20 flex items-center justify-center text-3xl font-black shadow-[0_0_25px_rgba(0,212,255,0.2)]">
            {photoURL ? (
              <Image src={photoURL} alt="Your avatar" width={96} height={96} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span>{initial}</span>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                <div className="h-6 w-6 rounded-full border-t-2 border-[#00D4FF] animate-spin" />
              </div>
            )}
          </div>
          {/* Camera button to change photo */}
          <button
            onClick={handlePickFile}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-gradient-to-br from-[#00D4FF] to-[#FF006E] text-white transition-transform hover:scale-110 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
        <h2 className="text-xl font-bold break-all">{user?.email}</h2>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#FF006E]/30 bg-[#FF006E]/10 px-4 py-2.5 text-center text-sm text-[#FF006E]">
          {error}
        </div>
      )}

      {/* Settings: default reading level (collapsible row → dropdown) */}
      <div className="mb-6">
        {/* Closed row — current level + a "tap to change" cue, all inside the pill. */}
        <button
          onClick={() => setLevelOpen((o) => !o)}
          aria-expanded={levelOpen}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a1a] p-3.5 text-left transition-all hover:border-white/30"
        >
          {currentLevel ? (
            <currentLevel.Icon className="h-7 w-7 shrink-0 text-[#00D4FF]" strokeWidth={1.75} />
          ) : null}
          <div className="flex-1 min-w-0">
            <span className="block text-base font-bold text-white">{currentLevel?.label ?? "Choose a level"}</span>
            <span className="block text-xs font-semibold text-[#00D4FF]">Tap to change reading level</span>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-300 ${levelOpen ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>

        {/* Open dropdown — only the levels you're NOT currently on, so you never
            see your own level offered back as a choice. */}
        {levelOpen && (
          <div className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {READING_LEVELS.filter((level) => level.id !== readingLevel).map((level) => (
              <button
                key={level.id}
                onClick={() => handleSelectLevel(level.id)}
                disabled={!!savingLevel}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-3.5 text-left transition-all duration-300 hover:border-white/30 disabled:opacity-70"
              >
                <level.Icon className="h-7 w-7 shrink-0 text-white/70" strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white">{level.label}</h4>
                  <p className="text-[13px] leading-snug text-white/70">{level.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {loading && <p className="mt-2 text-xs text-white/30">Loading your settings…</p>}
      </div>

      {/* Log out — pinned to the bottom of the screen */}
      <div className="mt-auto pt-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#FF006E]/30 bg-[#FF006E]/10 px-4 py-3 font-bold text-[#FF006E] transition-all hover:bg-[#FF006E]/20"
        >
          <LogOut className="w-5 h-5" strokeWidth={2} />
          Log Out
        </button>
      </div>
    </div>
  );
}
