"use client";

import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { db, auth } from "@/lib/firebase/config";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, LogOut, ChevronDown, ScrollText, BookOpen, AlertTriangle, ShieldCheck, Languages } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { CHRISTOPHER_READER_UID } from "@/lib/admin";
import { getUserProfile, updateUserProfile } from "@/lib/firebase/profile";
import { fileToAvatarDataUrl } from "@/lib/image";
import { READING_LEVELS } from "@/lib/reading-levels";
import { LANGUAGES, DEFAULT_LANGUAGE, languageFromId } from "@/lib/languages";
import { GenreGrid } from "@/components/genre-grid";
import { toggleGenre, knownGenres, GENRE_PICK_COUNT } from "@/lib/genres";
import { planFromId } from "@/lib/plans";
import {
  getBillingProfile,
  getEffectivePlanId,
  TRIAL_GENERATION_CAP,
  type BillingProfile,
} from "@/lib/billing";
import { useBookwormContext } from "@/lib/BookwormContext";
import { personalCourses } from "@/lib/book-club";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";

// Max size we accept from the file picker before resizing. The output stored
// in Firestore is tiny (~10–40KB), but we bound the input to avoid decoding a
// huge photo on a low-end phone.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB

export default function ProfileTab({ onOpenBookClub }: { onOpenBookClub: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [readingLevel, setReadingLevel] = useState<string | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [langOpen, setLangOpen] = useState(false);
  const [savingLang, setSavingLang] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  // Reading preferences (genres + last book) — set at onboarding, edited here.
  const [genres, setGenres] = useState<string[]>([]);
  const [lastBook, setLastBook] = useState("");
  const [prefsEditing, setPrefsEditing] = useState(false);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftLastBook, setDraftLastBook] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingProfile | null>(null);

  // Ending a subscription and deleting an account are both irreversible in
  // ways a stray tap must not be able to trigger, so each holds its own
  // confirmation state rather than firing straight from the button.
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { courses } = useBookwormContext();
  const { fontSize, readingMode, setFontSize, setReadingMode } = useReadingPrefs();

  // Keep billing live without replacing an in-progress preferences draft.
  useEffect(() => {
    setBilling(null);
    if (!user) return;
    let cancelled = false;
    let revision = 0;
    const stop = onSnapshot(doc(db, "users", user.uid), () => {
      const request = ++revision;
      getBillingProfile(user.uid).then(value => {
        if (!cancelled && request === revision && auth.currentUser?.uid === user.uid) { setBilling(value); setPlan(value?.plan ?? null); }
      }).catch(e => console.error("Billing refresh failed:", e));
    }, e => console.error("Billing listener failed:", e));
    return () => { cancelled = true; stop(); };
  }, [user]);

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
        setLanguage(profile?.preferredLanguage ?? DEFAULT_LANGUAGE);
        setGenres(knownGenres(profile?.genrePreferences ?? []));
        setLastBook(profile?.lastBookRead ?? "");
        setPlan(profile?.plan ?? null);

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

  /**
   * Same optimistic write + rollback as the reading level above, and entirely
   * independent of it: this only sets the language NEW books are written in.
   * Nothing already on the shelf is touched or retranslated.
   */
  const handleSelectLanguage = async (id: string) => {
    if (!user) return;
    if (id === language) {
      setLangOpen(false);
      return;
    }
    setSavingLang(id);
    setError(null);
    const previous = language;
    setLanguage(id); // optimistic
    setLangOpen(false);
    try {
      await updateUserProfile(user.uid, { preferredLanguage: id });
    } catch (err) {
      console.error("Failed to save language:", err);
      setLanguage(previous); // roll back on failure
      setError("Couldn't save your language. Please try again.");
    } finally {
      setSavingLang(null);
    }
  };

  const startEditingPrefs = () => {
    setError(null);
    setDraftGenres(genres);
    setDraftLastBook(lastBook);
    setPrefsEditing(true);
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    if (draftGenres.length !== GENRE_PICK_COUNT) {
      setError(`Please pick ${GENRE_PICK_COUNT} topics.`);
      return;
    }
    setSavingPrefs(true);
    setError(null);
    try {
      await updateUserProfile(user.uid, {
        genrePreferences: draftGenres,
        lastBookRead: draftLastBook.trim(),
      });
      setGenres(draftGenres);
      setLastBook(draftLastBook.trim());
      setPrefsEditing(false);
    } catch (err) {
      console.error("Failed to save preferences:", err);
      setError("Couldn't save your preferences. Please try again.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Only ever offered on this one account (see CHRISTOPHER_READER_UID) —
  // the server independently re-checks the caller's uid before minting
  // anything, this is just what decides whether the button appears.
  const switchToAdmin = async () => {
    setSwitching(true);
    setError(null);
    const res = await postAuthed<{ customToken?: string; error?: string }>("/api/admin/switch");
    if (res.error || !res.customToken) {
      setError(res.error || "Could not switch accounts.");
      setSwitching(false);
      return;
    }
    await signInWithCustomToken(auth, res.customToken);
    router.replace("/admin");
  };

  /** Stop the renewal, or undo that. Access continues either way until it lapses. */
  const handleCancelSubscription = async (resume: boolean) => {
    setCancelBusy(true);
    setError(null);
    const res = await postAuthed("/api/stripe/cancel", { resume });
    setCancelBusy(false);
    setConfirmCancel(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (user) { try { setBilling(await getBillingProfile(user.uid)); } catch (e) { console.error("Billing refresh failed:", e); } }
  };

  /** Collapsing drops any half-typed deletion confirmation rather than leaving
   *  it armed behind a closed panel. */
  const toggleAccountSettings = () => {
    const opening = !accountOpen;
    setAccountOpen(opening);
    if (!opening) {
      setConfirmDelete(false);
      setDeleteText("");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setError(null);
    const res = await postAuthed("/api/account/delete");
    if (res.error) {
      setDeleteBusy(false);
      setError(res.error);
      return;
    }
    // The account is gone, so the local session is meaningless now. Sign out
    // before routing, or the app would keep trying to load a user that no
    // longer exists and land on a broken dashboard instead of the door.
    await logout().catch(() => {});
    router.push("/");
  };

  const initial = (user?.email?.[0] ?? "?").toUpperCase();
  const currentLevel = READING_LEVELS.find((l) => l.id === readingLevel);
  const currentLanguage = languageFromId(language);
  // Book Club members inherit the tier from their family, so the effective
  // plan (not the raw `plan` field) is what the card should describe.
  const currentPlan = planFromId(billing ? getEffectivePlanId(billing) : plan);
  const trialActive = billing?.trialStatus === "active";
  // A comped account belongs to no tier, so the plan card describes the grant
  // itself rather than naming a subscription nobody is paying for.
  const comp = billing?.accessOverride?.active ? billing.accessOverride : null;
  // Books the reader generated. A book a club member shared takes no slot, so
  // counting it here would show 4 of 3 to someone who has done nothing wrong.
  const openBooks = personalCourses(courses).length;

  // The app's gradient-border + glow card treatment (same as the Your Plan card).
  const gradientBorder = {
    border: "1.5px solid transparent",
    background:
      "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
    boxShadow: "0 0 18px rgba(0,212,255,0.12)",
  } as const;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-8 flex flex-col min-h-full">
      {/* Identity — laid out as a row rather than a stack. Centred, the avatar
          and email alone ate a third of a phone screen before any setting the
          reader actually came here to change was visible. */}
      <div className="mb-5 flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[#00D4FF]/20 to-[#FF006E]/20 flex items-center justify-center text-2xl font-black shadow-[0_0_25px_rgba(0,212,255,0.2)]">
            {photoURL ? (
              <Image src={photoURL} alt="Your avatar" width={64} height={64} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span>{initial}</span>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                <div className="h-5 w-5 rounded-full border-t-2 border-[#00D4FF] animate-spin" />
              </div>
            )}
          </div>
          {/* Camera button to change photo */}
          <button
            onClick={handlePickFile}
            disabled={uploading}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0a0a0a] bg-gradient-to-br from-[#00D4FF] to-[#FF006E] text-white transition-transform hover:scale-110 disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
        <h2 className="min-w-0 flex-1 break-all text-base font-bold leading-tight">{user?.email}</h2>
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
          style={gradientBorder}
          className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-transform hover:scale-[1.01]"
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
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-3.5 text-left transition-all duration-300 hover:border-[#FF006E]/60 hover:shadow-[0_0_16px_rgba(255,0,110,0.28)] disabled:opacity-70"
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

      {/* Settings: output language. Independent of the reading level above —
          level is how hard the writing is, this is which language it is hard
          in. Explorer in Spanish means simple Spanish, not translated English. */}
      <div className="mb-6">
        <button
          onClick={() => setLangOpen((o) => !o)}
          aria-expanded={langOpen}
          style={gradientBorder}
          className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-transform hover:scale-[1.01]"
        >
          <Languages className="h-7 w-7 shrink-0 text-[#00D4FF]" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <span className="block text-base font-bold text-white">{currentLanguage.label}</span>
            <span className="block text-xs font-semibold text-[#00D4FF]">Tap to change language</span>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-300 ${langOpen ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>

        {langOpen && (
          <div className="mt-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {LANGUAGES.filter((l) => l.id !== language).map((l) => (
              <button
                key={l.id}
                onClick={() => handleSelectLanguage(l.id)}
                disabled={!!savingLang}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-3.5 text-left transition-all duration-300 hover:border-[#FF006E]/60 hover:shadow-[0_0_16px_rgba(255,0,110,0.28)] disabled:opacity-70"
              >
                <Languages className="h-7 w-7 shrink-0 text-white/70" strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white">{l.label}</h4>
                  <p className="text-[13px] leading-snug text-white/70">{l.native}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-white/40">
          New books are written in this language. Books already on your shelf stay as they are.
        </p>
      </div>

      {/* How lessons are displayed — text size and scroll vs. page turns. */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">Reading Display</h3>
        <div className="rounded-2xl p-3.5" style={gradientBorder}>
          <p className="mb-2 text-xs font-bold text-white/70">Text size</p>
          <div className="flex gap-2">
            {FONT_SIZE_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => setFontSize(id)}
                aria-pressed={fontSize === id}
                className={`flex flex-1 flex-col items-center justify-end gap-1 rounded-xl border py-2.5 transition-all ${
                  fontSize === id
                    ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white shadow-[0_0_14px_rgba(0,212,255,0.2)]"
                    : "border-white/10 text-white/50 hover:border-white/25"
                }`}
              >
                <span className="font-reading font-bold leading-none" style={{ fontSize: FONT_SCALE[id].body }}>
                  A
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide">{FONT_SCALE[id].label}</span>
              </button>
            ))}
          </div>

          {/* Live sample in the real reading font, so the choice is visible
              here instead of only after opening a lesson. */}
          <p
            className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 font-reading text-white/80"
            style={{ fontSize: FONT_SCALE[fontSize].body, lineHeight: FONT_SCALE[fontSize].lineHeight }}
          >
            The universe conspires to help you achieve your Personal Legend.
          </p>

          <p className="mb-2 mt-5 text-xs font-bold text-white/70">Lesson layout</p>
          <div className="flex gap-2">
            <button
              onClick={() => setReadingMode("scroll")}
              aria-pressed={readingMode === "scroll"}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                readingMode === "scroll"
                  ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white shadow-[0_0_14px_rgba(0,212,255,0.2)]"
                  : "border-white/10 text-white/50 hover:border-white/25"
              }`}
            >
              <ScrollText className="h-4 w-4" strokeWidth={2} />
              Scroll
            </button>
            <button
              onClick={() => setReadingMode("page")}
              aria-pressed={readingMode === "page"}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                readingMode === "page"
                  ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white shadow-[0_0_14px_rgba(0,212,255,0.2)]"
                  : "border-white/10 text-white/50 hover:border-white/25"
              }`}
            >
              <BookOpen className="h-4 w-4" strokeWidth={2} />
              Pages
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-white/40">
            {readingMode === "page"
              ? "Swipe or tap the arrows to turn pages, like a real book."
              : "One continuous page you scroll through."}
          </p>
        </div>
      </div>

      {/* Reading preferences — genres + last book, feeds recommendations. */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Reading Preferences</h3>
          {!prefsEditing && (
            <button
              onClick={startEditingPrefs}
              className="text-xs font-bold text-[#00D4FF] transition-opacity hover:opacity-80"
            >
              Edit
            </button>
          )}
        </div>

        {!prefsEditing ? (
          <div className="rounded-2xl p-3.5" style={gradientBorder}>
            {genres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-1 text-xs font-bold text-white"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/40">No topics picked yet — tap Edit to add them.</p>
            )}
            {lastBook && (
              <p className="mt-3 text-xs text-white/50">
                Last read: <span className="font-semibold text-white/80">{lastBook}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-3.5 animate-in fade-in duration-200" style={gradientBorder}>
            <p className="mb-2.5 text-xs text-white/50">Pick {GENRE_PICK_COUNT} topics you want to grow in.</p>
            <GenreGrid selected={draftGenres} onToggle={(g) => setDraftGenres((prev) => toggleGenre(prev, g))} />
            <p className="mt-2 text-xs text-white/40">
              {draftGenres.length}/{GENRE_PICK_COUNT} selected
            </p>

            <label htmlFor="prefLastBook" className="mt-4 mb-1.5 block text-sm font-bold text-white/80">
              Last book you read
            </label>
            <input
              type="text"
              id="prefLastBook"
              value={draftLastBook}
              onChange={(e) => setDraftLastBook(e.target.value)}
              placeholder="Enter a book title"
              className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#111] px-4 py-2.5 text-sm text-white placeholder:text-white/40 transition-colors focus:border-[#00D4FF] focus:outline-none"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setPrefsEditing(false)}
                disabled={savingPrefs}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-white/80 transition-all hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrefs}
                disabled={savingPrefs || draftGenres.length !== GENRE_PICK_COUNT}
                className="flex-1 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-2.5 font-bold text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPrefs ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Your Plan — tier, this month's usage, and a way to change tiers. */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">Your Plan</h3>
        <div
          className="rounded-2xl p-4"
          style={{
            border: "1.5px solid transparent",
            background:
              "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
            boxShadow: "0 0 18px rgba(0,212,255,0.12)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-lg font-black text-transparent">
                {comp ? comp.label : currentPlan.name}
              </p>
              <p className="text-xs text-white/60">
                {comp ? "Full access, no subscription" : currentPlan.tagline}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#00D4FF]">
              {comp ? "Complimentary" : billing?.trialStatus === "active" ? "Trial" : "Current"}
            </span>
          </div>

          {billing && (
            <div className="mt-3 flex gap-4 border-t border-white/10 pt-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                  {comp ? "Books made" : billing.trialStatus === "active" ? "Trial books" : "This month"}
                </p>
                <p className="text-sm font-bold text-white/90">
                  {billing.generationsThisMonth}
                  {comp
                    ? comp.lifetimeGenerations === null
                      ? ""
                      : ` / ${comp.lifetimeGenerations}`
                    : ` / ${trialActive ? TRIAL_GENERATION_CAP : currentPlan.monthlyGenerations}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Open now</p>
                <p className="text-sm font-bold text-white/90">
                  {openBooks} / {comp ? comp.maxOpenBooks : currentPlan.maxOpenBooks}
                </p>
              </div>
            </div>
          )}

          {/* A Book Club member's plan question is almost always about the club
              — who's in it, who has a seat — so that goes straight there, and
              changing tiers stays one tap further on, inside it.
              A comped account is shown neither: there is no subscription to
              change, and offering one to a child's tablet only invites a
              checkout nobody meant to open. */}
          {!comp && (
            <button
              onClick={() => (currentPlan.id === "book_club" ? onOpenBookClub() : router.push("/pricing"))}
              className="mt-3 w-full rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/80 transition-all hover:bg-white/10"
            >
              {currentPlan.id === "book_club" ? "Manage Book Club" : "Change plan"}
            </button>
          )}
          {!comp && currentPlan.id === "book_club" && (
            <button
              onClick={() => router.push("/pricing")}
              className="mt-2 w-full rounded-lg px-4 py-1.5 text-[11px] font-semibold text-white/45 transition-colors hover:text-white/70"
            >
              Change plan
            </button>
          )}

          {/* A declined renewal used to be completely silent: the first sign
              was the app going quiet days later, once Stripe gave up retrying. */}
          {billing?.paymentFailedAt && (
            <div className="mt-3 flex gap-2.5 rounded-lg border border-[#FFB020]/40 bg-[#FFB020]/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB020]" strokeWidth={2} />
              <p className="text-[12px] leading-relaxed text-[#FFB020]">
                Your last payment didn&apos;t go through. We&apos;ll try again, but your books stop
                when the retries run out, so it&apos;s worth checking your card.
              </p>
            </div>
          )}

          {/* Cancelling is only offered to whoever actually pays: a Book Club
              member has no subscription of their own to end. */}
          {billing?.stripeSubscriptionId && !(billing.familyId && !billing.isFamilyOwner) && (
            <div className="mt-3 border-t border-white/10 pt-3">
              {billing.subscriptionCancelAt ? (
                <>
                  <p className="text-[12px] leading-relaxed text-white/70">
                    Your plan ends on{" "}
                    <span className="font-bold text-white">
                      {new Date(billing.subscriptionCancelAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    . You keep everything until then.
                  </p>
                  <button
                    onClick={() => handleCancelSubscription(true)}
                    disabled={cancelBusy}
                    className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {cancelBusy ? "Working..." : "Keep my plan"}
                  </button>
                </>
              ) : confirmCancel ? (
                <>
                  <p className="text-[12px] leading-relaxed text-white/70">
                    Your books stay until the end of the period you&apos;ve already paid for. After
                    that, generating new ones stops.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelBusy}
                      className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/80 disabled:opacity-60"
                    >
                      Never mind
                    </button>
                    <button
                      onClick={() => handleCancelSubscription(false)}
                      disabled={cancelBusy}
                      className="flex-1 rounded-lg border border-[#FF006E]/50 bg-[#FF006E]/10 px-4 py-2 text-xs font-bold text-[#FF006E] disabled:opacity-60"
                    >
                      {cancelBusy ? "Cancelling..." : "Yes, cancel"}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="w-full rounded-lg px-4 py-2 text-xs font-semibold text-white/45 transition-colors hover:text-white/70"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deletion lives behind a closed, neutrally-named panel rather than as a
          red card on the main Profile screen: it is the one action here that
          destroys the books, the plan and the sign-in at once, and a route that
          obvious invites the accidental tap far more often than the intended
          one. Reaching it is deliberately four steps — open, tap the link, type
          DELETE, confirm. */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <button
          onClick={toggleAccountSettings}
          aria-expanded={accountOpen}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-bold text-white/75 transition-colors hover:text-white"
        >
          Account settings
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
              accountOpen ? "rotate-180" : ""
            }`}
            strokeWidth={2}
          />
        </button>

        {accountOpen && (
          <div className="border-t border-white/10 px-4 py-4">
            {confirmDelete ? (
              <>
                <h3 className="text-sm font-bold text-white/90">Delete your account</h3>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                  This removes your books, your preferences and your sign-in, cancels any
                  subscription, and cannot be undone.
                  {billing?.isFamilyOwner
                    ? " Everyone in your Book Club loses access too."
                    : ""}
                </p>
                <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Type DELETE to confirm
                </label>
                <input
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#FF006E]/60"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteText("");
                    }}
                    disabled={deleteBusy}
                    className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/80 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteBusy || deleteText.trim().toUpperCase() !== "DELETE"}
                    className="flex-1 rounded-lg bg-[#FF006E] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {deleteBusy ? "Deleting..." : "Delete forever"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12px] leading-relaxed text-white/45">
                  Deleting your account removes your books, your preferences and your sign-in, and
                  cancels any subscription. It can&apos;t be undone.
                </p>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="mt-2.5 text-xs font-semibold text-white/45 underline underline-offset-2 transition-colors hover:text-white/75"
                >
                  Delete account
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Log out — pinned to the bottom of the screen */}
      <div className="mt-auto pt-6">
        {user?.uid === CHRISTOPHER_READER_UID && (
          <button
            onClick={() => void switchToAdmin()}
            disabled={switching}
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            <ShieldCheck className="w-5 h-5" strokeWidth={2} />
            {switching ? "Switching…" : "Switch to admin"}
          </button>
        )}
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
