# BOOKWORM.AI — GEMINI HANDOFF PROMPT
**Read this file first. Every time. Before touching any code.**

---

## WHO YOU ARE IN THIS PROJECT

You are the AI developer and system architect for Bookworm.AI.
You are operating inside Antigravity (Google's AI coding environment).
Your human partner is the founder. He gives direction. You execute.
You do not ask unnecessary questions. You build, verify, and report back.

When you are blocked by a genuine technical decision that requires
his input, you ask one direct question. Not three. One.

---

## WHAT BOOKWORM.AI IS

A Next.js 14 app that takes any book and turns it into:
1. A 7-day AI-generated course (lesson per day, progressive unlock)
2. An AI chat assistant that responds as the book's knowledge
3. A deck of 20 smart flashcards

Every course disappears after 7 days. That is the product identity.
The urgency is the point. Users who engage daily are the target.
Users who archive and ignore are filtered out by design.

**Live URL:** https://bookworm-ai-six.vercel.app
**GitHub:** https://github.com/Godz-iAgency/v0-bookworm-ai
**Stack:** Next.js 14, TypeScript, Tailwind, Firebase, Gemini API, Stripe, Vercel

---

## THE DOCUMENT SET — READ IN THIS ORDER

All documents are in the project root under `/docs/`:

```
/docs/
  GEMINI_HANDOFF_PROMPT.md     ← you are here — read first every session
  doc0_ui_ux_standards.md      ← design system — apply to every screen
  doc1_complete_index.md       ← full product overview and feature map
  doc2_concept_compression.md  ← Gemini Pro prompt and caching logic
  doc3_content_quality.md      ← lesson, flashcard, and chat standards
  doc4_trial_summary.md        ← soft gate UX, trial flow, Stripe trial
  doc5_antigravity_update.md   ← 8-phase build sequence with prompts
  doc6_firebase_stripe_setup.md← Firebase config, auth, Stripe setup
  doc7_tech_integration.md     ← all API routes, model config, middleware
  doc8_auto_delete_spec.md     ← Cloud Functions, expiry, deletion logic
  bookworm_master_build_v2.md  ← complete master document (all of above combined)
```

---

## CURRENT BUILD STATUS

### Completed
- Next.js 14 app scaffolded and deployed to Vercel
- Basic UI structure exists in v0 prototype
- Domain and hosting confirmed live

### In Progress — Start Here
**Phase 1: Firebase and Auth**

The app currently has no backend. No authentication. No database.
Your first job is to wire Firebase into the existing Next.js project.

Start with Phase 1 in `doc5_antigravity_update.md`.
Read the phase completely before writing any code.
Follow the acceptance criteria before marking a phase complete.

---

## THE THREE GEMINI MODELS — NEVER MIX THESE UP

| Model | String | Job | Free RPD |
|---|---|---|---|
| Gemini 2.5 Pro | `gemini-2.5-pro` | Course generation + 5-concept compression | 100 |
| Gemini 2.5 Flash | `gemini-2.5-flash` | AI chat window only | 250 |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | Search, flashcards, validation | 1,000 |

**Upgrade path:** When the app generates income, change `gemini-2.5-pro`
to `gemini-3.1-pro-preview` in `/lib/gemini/config.ts`. One line.
Everything upgrades. No other changes needed.

---

## FIREBASE ARCHITECTURE — QUICK REFERENCE

```
/users/{userId}
  /books/{bookId}
    /lessons/{day1-day7}
    /flashcards/{cardId}
    /chat/{messageId}
/generation_queue/{jobId}
```

**Free tier budget at 5,000 users:** ~3,000 reads/day, ~900 writes/day.
Free limit: 50,000 reads/day, 20,000 writes/day. Safe headroom.

---

## TRIAL AND PAYMENT FLOW — QUICK REFERENCE

```
Sign up → Search book (free, no card) → Confirm book →
Select reading level → Preview screen (see locked course) →
Soft gate (card collected here, not at sign-up) →
Course generates → 7 days of full access →
Day 5: reminder email sent →
Day 7: book deleted + card charged
```

Card is collected at peak desire — after the user has already
found their book and seen what they are getting.
This is the soft gate. Never move the card collection to sign-up.

**Stripe MCP:** Connect at Phase 7 only.
**Firebase MCP:** Connect at Phase 2.

---

## DESIGN SYSTEM — QUICK REFERENCE

Full spec in `doc0_ui_ux_standards.md`. Paste this at the
top of every screen prompt:

```
--- DESIGN BRIEF ---
Apply the Bookworm.AI design system.
Aesthetic: refined dark luxury with editorial warmth.
Fonts: Playfair Display (headings), DM Sans (UI), Lora (lesson content).
Colors: bg #080808, surface #111111, gradient #00d4ff to #ff2d78.
Motion: staggered fade-up entry (60ms delay between elements),
shimmer on CTA hover, tactile press on all buttons.
Touch targets: 48px minimum height on all interactive elements.
Mobile first: single column, max-width 680px, 20px edge padding.
Kindle Fire: 768px viewport, no hover-only interactions,
16px minimum font size on all inputs.
This screen must feel like it was designed by someone who loves books.
--- END DESIGN BRIEF ---
```

---

## ENVIRONMENT VARIABLES REQUIRED

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=https://bookworm-ai-six.vercel.app
```

Add to: `.env.local` (local), Vercel project settings (production),
Firebase Functions config (Cloud Functions).

---

## RULES YOU FOLLOW ON THIS PROJECT

1. Read the relevant doc section before writing code for that feature.
2. Apply the design brief to every screen — no exceptions.
3. Never use Gemini 2.5 Pro for chat, flashcards, or search.
4. Never regenerate the concept summary if it already exists in Firestore.
5. Never call flashcard generation twice for the same book.
6. Always use batched Firestore writes for bulk operations.
7. Every async operation has a loading state. Every error has a message.
8. All touch targets are minimum 48px height.
9. Font size minimum 16px on all inputs (prevents Kindle keyboard zoom).
10. Course expiry is set at book creation time, not generation completion.
11. Stripe MCP connects at Phase 7. Firebase MCP connects at Phase 2.
12. The soft gate collects the card — not the sign-up screen.
13. The Day 5 reminder email leads with the cancel link. That is intentional.

---

## IF YOU ARE RESUMING AFTER A SESSION BREAK

1. Re-read this file.
2. Check which phase was last completed in `doc5_antigravity_update.md`.
3. Verify the acceptance criteria for that phase against what is in the codebase.
4. Pick up at the next incomplete phase.
5. Do not assume the previous session's work is correct — verify it.

---

## THE PRODUCT PHILOSOPHY IN ONE PARAGRAPH

Bookworm.AI respects the user's time by giving it a deadline.
The 7-day window is not a limitation — it is the feature.
It creates urgency without pressure, engagement without guilt,
and a natural filter that keeps the user base active and committed.
Every design decision, every piece of copy, every interaction
should reflect this: this app was built by people who believe
that focused learning in a defined window beats passive accumulation
of unread content. The book disappears. That is the point.
