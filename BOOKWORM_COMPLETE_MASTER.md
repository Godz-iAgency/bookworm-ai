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
# BOOKWORM.AI — UI/UX DESIGN STANDARDS
**Version 1.0 | Claude Sonnet 4.6**
**This document governs every screen in the app.
Paste it at the top of every Antigravity prompt as the design brief.**

---

## THE DESIGN IDENTITY

Bookworm.AI is not a utility app. It is a reading experience. The design must
reflect that — every screen should feel like the app was made by people who
love books, love learning, and built something they would use themselves.

The aesthetic direction: **refined dark luxury with editorial warmth.**

Not cold. Not clinical. Not another dark SaaS dashboard.
Think: a beautifully designed reading lamp in a dark room.
Warm light on rich content. Calm focus. Everything in its place.

The one thing a user will remember: the feeling that this app
respects their attention and makes learning feel like a reward,
not a task.

---

## BRAND TOKENS — USE THESE EXACTLY

```css
:root {
  /* Core palette */
  --bg:           #080808;       /* Near black — deeper than #0a0a0a */
  --surface:      #111111;       /* Card backgrounds */
  --surface-2:    #1a1a1a;       /* Elevated cards, inputs */
  --surface-3:    #222222;       /* Hover states */
  --border:       rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);

  /* Gradient — cyan to pink, the brand signature */
  --cyan:         #00d4ff;
  --pink:         #ff2d78;
  --gradient:     linear-gradient(135deg, #00d4ff, #ff2d78);
  --gradient-text: linear-gradient(135deg, #00d4ff, #ff2d78);

  /* Warm reading accent — for lesson content only */
  --amber:        #f59e0b;
  --amber-soft:   rgba(245,158,11,0.15);

  /* Text */
  --text:         #f0f0f0;       /* Not pure white — easier on eyes */
  --text-muted:   #666666;
  --text-faint:   #333333;

  /* Status */
  --green:        #10b981;
  --green-soft:   rgba(16,185,129,0.15);
  --amber-status: #f59e0b;
  --amber-soft:   rgba(245,158,11,0.12);
  --red:          #ef4444;
  --red-soft:     rgba(239,68,68,0.12);

  /* Spacing */
  --radius-sm:    8px;
  --radius:       14px;
  --radius-lg:    20px;
  --radius-full:  9999px;

  /* Touch */
  --touch-min:    48px;

  /* Typography */
  --font-ui:      'DM Sans', system-ui, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-read:    'Lora', Georgia, serif;

  /* Shadows */
  --shadow-card:  0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-cyan: 0 0 20px rgba(0,212,255,0.15);
  --shadow-glow-pink: 0 0 20px rgba(255,45,120,0.15);
}
```

---

## TYPOGRAPHY SYSTEM

### Font Roles

**DM Sans** — all UI elements: navigation, buttons, labels, captions, body copy outside lessons.
Clean, geometric, confident. Pairs perfectly with Playfair.

**Playfair Display** — headings, screen titles, the brand name.
Editorial and literary. Signals that this is a reading app, not a dashboard.

**Lora** — lesson content only.
A reading font. Serif, warm, optimized for sustained reading.
Kindle users spend time reading lessons — they deserve a reading experience.

### Type Scale

```css
/* Display — screen titles, hero headings */
.text-display {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* Heading — section titles, card titles */
.text-heading {
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
}

/* UI Body — all interface copy */
.text-body {
  font-family: var(--font-ui);
  font-size: 1rem;           /* 16px — never smaller on mobile */
  line-height: 1.6;
  font-weight: 400;
}

/* Label — tags, badges, metadata */
.text-label {
  font-family: var(--font-ui);
  font-size: 0.75rem;        /* 12px */
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Reading — lesson content */
.text-read {
  font-family: var(--font-read);
  font-size: 1.125rem;       /* 18px */
  line-height: 1.85;
  letter-spacing: 0.01em;
  max-width: 65ch;           /* Optimal reading width */
}
```

---

## LAYOUT PRINCIPLES

### Single Column Flow
Every screen is single column on mobile. No side-by-side panels.
Content stacks vertically, reads top to bottom.
Max content width: 680px, centered.

### Breathing Room
Generous padding is not wasted space. It is the design.
Minimum vertical padding between sections: 32px.
Content padding from screen edges: 20px on mobile, 32px on tablet.

### Visual Hierarchy — Three Levels Only
1. Primary — the one thing the user needs to do or read right now.
   Largest text, highest contrast, most space around it.
2. Secondary — supporting context, descriptive text.
   Muted color, smaller size, less space.
3. Tertiary — metadata, labels, hints.
   Faintest color, smallest text. Should not compete.

Never let levels two and three fight for attention with level one.

### Cards
Cards have subtle borders, not heavy outlines.
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow-card);
  transition: border-color 200ms ease, transform 200ms ease;
}
.card:hover {
  border-color: var(--border-hover);
  transform: translateY(-1px);
}
```

Selected or active cards get the gradient border treatment:
```css
.card-selected {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    var(--gradient) border-box;
  box-shadow: var(--shadow-glow-cyan);
}
```

---

## MOTION AND ANIMATION

### Philosophy
One well-timed animation creates more delight than ten scattered ones.
Use motion to guide attention, confirm actions, and reward completion.
Never animate for decoration alone.

### Staggered Page Entry
Every screen enters with a staggered reveal — elements appear
sequentially from top to bottom, 60ms apart.

```css
.fade-up {
  opacity: 0;
  transform: translateY(16px);
  animation: fadeUp 400ms ease forwards;
}
.fade-up:nth-child(1) { animation-delay: 0ms; }
.fade-up:nth-child(2) { animation-delay: 60ms; }
.fade-up:nth-child(3) { animation-delay: 120ms; }
.fade-up:nth-child(4) { animation-delay: 180ms; }
.fade-up:nth-child(5) { animation-delay: 240ms; }

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### Button Press
All buttons have a tactile press feeling:
```css
button:active {
  transform: scale(0.97);
  transition: transform 80ms ease;
}
```

### Gradient Button Shimmer
The primary gradient CTA button has a subtle shimmer on hover —
a light sweep across the gradient surface.

```css
.btn-gradient {
  position: relative;
  background: var(--gradient);
  overflow: hidden;
}
.btn-gradient::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255,255,255,0.15) 50%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 0ms;
}
.btn-gradient:hover::after {
  transform: translateX(100%);
  transition: transform 500ms ease;
}
```

### Loading States
Never show a spinner alone. Show a skeleton that matches the
shape of the content that is loading.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--surface-2) 50%,
    var(--surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Flashcard Flip
The signature interaction of the app. Must be flawless.
```css
.flashcard-scene {
  perspective: 1200px;
}
.flashcard {
  transform-style: preserve-3d;
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
.flashcard.flipped {
  transform: rotateY(180deg);
}
.flashcard-front,
.flashcard-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flashcard-back {
  transform: rotateY(180deg);
}
```

### Progress Bar
Course generation progress bar — smooth, animated fill.
```css
.progress-bar {
  height: 3px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--gradient);
  border-radius: var(--radius-full);
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## INTERACTION STANDARDS

### Touch Targets
Every tappable element: minimum 48px height, minimum 44px width.
Add padding around small icons to hit the minimum without
making the visual element look large.

```css
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 150ms ease;
}
.icon-btn:hover {
  background: var(--surface-2);
}
```

### Focus States
Every interactive element must have a visible focus ring for
keyboard and accessibility. Kindles support keyboard navigation.

```css
:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

### No Hover-Only Interactions
Kindle Fire has no hover state. Every interactive behavior
triggered by hover must also work on tap.

### Disabled States
Disabled buttons are not just opacity 50%. They communicate
what is needed to enable them.
Example: "Generate My Course →" button shows as disabled with
a subtle tooltip or label: "Select a reading level to continue."

---

## SCREEN-BY-SCREEN DESIGN DIRECTION

### Landing Page / Auth Screen
Tone: invitation. The user is arriving somewhere worth coming to.
Background: pure dark with an extremely subtle radial gradient
blooming from center — barely perceptible warm glow.
The Bookworm.AI logo uses Playfair Display with the gradient
applied to the text itself (background-clip: text).
The tagline "Your books. Seven days. Transformed." sits below
in DM Sans, muted, generous letter-spacing.
No clutter. No features list. One clear action.

### Book Search Screen
Tone: focused and responsive. The user has one job here.
The search input is the hero element — centered, large, warm
border glow on focus (cyan, soft).
Search results animate in with a gentle slide up.
The confirmation card feels like picking up a physical book —
the cover image has a subtle shadow and slight tilt on hover.

### Reading Level Screen
Tone: personal and considered. This is the user making a choice
about how they want to learn.
The four cards are generous — not cramped. Each has an icon,
a level name in Playfair Display, and a one-line description.
Selected state: gradient border glow + a faint gradient background
wash inside the card (very subtle — just enough to feel alive).
The cards animate in with staggered delay.

### Course Preview / Soft Gate
Tone: anticipation. The user can see what they are about to get.
The locked day cards have a subtle lock icon and a translucent
overlay — not fully opaque. The lesson titles are visible beneath,
creating a sense of "almost there."
The card form (Stripe Elements) is embedded with a warm border
and a padlock icon at the top right corner — communicating
security without a heavy "Secure Checkout" banner.
The CTA button is the largest, most prominent element on screen.

### Dashboard
Tone: calm command. The user is in control of their learning.
The My Library shelf is a horizontal scroll row with book cards
that feel like physical books on a shelf — slightly different
heights add organic rhythm.
The active book card has a gentle gradient glow behind it.
The generating card pulses — but slowly and warmly,
not urgently. Learning is not a timer. The urgency lives
in the day countdown, not the loading animation.

### 7-Day Course Tab
Tone: editorial. This is the reading experience.
Day cards are clean and wide — the lesson title in Playfair,
the metadata (read time, status) in DM Sans below.
When a day card expands, it does so smoothly — max-height
transition with a subtle fade in of the content.
Lesson content uses Lora at 18px with generous line height.
The "Mark Day Complete" button is full width, gradient,
at the very bottom of the lesson. The user scrolls to earn it.

### AI Chat Tab
Tone: intimate and responsive. This is a conversation.
User messages: right-aligned, gradient background, rounded
corner on the bottom-right is square (speech bubble asymmetry).
AI messages: left-aligned, dark surface, small Bookworm icon
avatar at the top-left of the first message in a group.
The typing indicator is three dots that breathe — scale
animation, staggered, warm amber color.
The input bar is minimal — no heavy border, just a soft
separator line. The send button only appears when text is entered.

### Flashcard Tab
Tone: playful focus. This is active recall — it should feel
like a game that respects your intelligence.
The flashcard is large, centered, and slightly elevated with
a deep shadow — it feels like a physical card.
Front face: the question in Playfair Display, centered.
Back face: the answer in Lora, left-aligned for readability.
Swipe gesture has a directional visual cue — the card tilts
slightly in the swipe direction before animating out.
"Got It" swipe: card exits right with a green flash.
"Review Again" swipe: card exits left with a subtle amber flash.
The mastery counter increments with a micro-bounce animation.

---

## MICRO-COPY STANDARDS

Every label, placeholder, error, and empty state must be written
in the voice of someone who loves books and respects the user.

### Tone Rules
- Direct but warm. Never cold. Never corporate.
- Present tense. Active voice.
- Short sentences. Reading apps should not make users read
  long instructions.
- Never say "Please." It is filler.
- Never say "Successfully." If the action worked, show it.

### Examples

| Context | Bad | Good |
|---|---|---|
| Search placeholder | "Enter book title..." | "What are you reading?" |
| Loading course | "Loading..." | "Preparing your course" |
| Day locked | "This content is locked" | "Complete Day 2 to unlock this" |
| Error: search failed | "An error occurred" | "Search hit a snag. Try again." |
| Empty chat | "No messages yet" | "Ask the book anything" |
| Card saved | "Payment method saved successfully" | "You are all set." |
| Trial banner | "Your trial expires soon" | "Your trial ends in 3 days — your book disappears with it." |
| Flashcard complete | "You have completed all flashcards" | "All 20 mastered. You know this book." |

---

## ACCESSIBILITY STANDARDS

These are not optional. Kindle Fire runs on Android — standard
Android accessibility tools apply.

- All images have descriptive alt text
- Color is never the only indicator of state — always pair
  with an icon or label
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- All interactive elements reachable by tab key
- Touch targets minimum 48x48px
- Error messages linked to their inputs via aria-describedby
- Loading states announced to screen readers via aria-live

---

## KINDLE FIRE SPECIFIC RULES

- Font size minimum 16px everywhere — prevents auto-zoom on input focus
- No `position: fixed` on elements that sit above the keyboard —
  use `position: sticky` with JavaScript viewport height adjustment
- Test all tap targets at 768px viewport width (Kindle Fire HD 8 portrait)
- Avoid multi-column layouts below 800px
- Ensure horizontal scroll only exists where intentional
  (My Library shelf) — never as overflow from content

---

## HOW TO USE THIS DOCUMENT IN ANTIGRAVITY

Paste the following block at the very top of every Antigravity
screen prompt, before the layout and feature requirements:

--- DESIGN BRIEF ---
Apply the Bookworm.AI design system to this screen.
Aesthetic: refined dark luxury with editorial warmth.
Fonts: Playfair Display for headings, DM Sans for UI copy,
Lora for lesson reading content.
Colors: --bg #080808, --surface #111111, gradient #00d4ff to #ff2d78.
Motion: staggered fade-up entry (60ms delay between elements),
shimmer on CTA button hover, tactile press on all buttons.
Touch targets: 48px minimum height on all interactive elements.
Mobile first: single column, max-width 680px content, 20px edge padding.
Kindle Fire: 768px viewport, no hover-only interactions,
16px minimum font size on all inputs.
This screen must feel like it was designed by someone who loves books.
--- END DESIGN BRIEF ---
# BOOKWORM.AI — COMPLETE INDEX
**Version 2.1 | Claude Sonnet 4.6**

---

## WHAT IS BOOKWORM.AI

Bookworm.AI takes any non-fiction book and turns it into a structured
7-day learning experience. The user searches a book, confirms it,
selects their reading depth, and the app generates a personalized
7-day course, an AI chat assistant that responds as the book's
distilled knowledge, and a deck of 20 smart flashcards.

Every course disappears after 7 days — by design.
The urgency is the product identity, not a restriction.

**Target audience:** Kindle users, active readers, lifelong learners
who buy books but do not finish them.
**Primary devices:** Amazon Kindle Fire HD 8, Kindle Fire HD 10,
Android and iOS phones.

---

## CORE FEATURES

### 1. Book Search and Confirmation
- User types any book title or author name
- Gemini 2.5 Flash-Lite confirms: title, author, year, description
- Google Books API retrieves the cover image
- User confirms before proceeding — search loops until confirmed
- No account or card required to search

### 2. Reading Level Selection
- Four levels: Beginner, Intermediate, Advanced, Deep Dive
- Personalizes all three features — course depth, chat tone, flashcard complexity
- Cannot be changed after course is generated

### 3. Course Preview (Soft Gate Entry Point)
- After reading level, user sees a locked preview of their course
- All 7 day titles visible — generated by a lightweight Flash-Lite call
- Lesson content locked but visible beneath translucent overlay
- Chat and flashcard counts shown below the day list
- Desire peaks here — card is collected on this screen, not at sign-up

### 4. 7-Day Course
- 7 lessons generated by Gemini 2.5 Pro
- 400–800 words per lesson depending on reading level
- Day 1 unlocked immediately, Days 2–7 unlock progressively
- Reading typography: Lora, 18px, 1.85 line-height
- "Mark Day Complete" at bottom of each lesson (scroll to earn it)
- Course expires and is permanently deleted after 7 days

### 5. AI Chat Window
- Powered by Gemini 2.5 Flash
- AI responds as the book's distilled wisdom — not as the author
- Context built from cached 5-concept summary (never raw book text)
- Starter prompts in empty state — tap to send
- Last 10 messages in active context, older messages archived

### 6. Smart Flashcards
- 20 cards generated by Gemini 2.5 Flash-Lite in one call
- 10 definition, 5 application, 5 reflection cards
- Tap to flip, swipe right to master, swipe left to review again
- Progress persists across sessions via Firestore
- Generated once per book, cached permanently — never regenerated

---

## COMPLETE USER FLOW

```
Landing / Auth screen
  ↓
Sign up — Google one-tap or Email/Password
  ↓
/search — find the book (no card required)
  ↓
Book confirmation card — confirm title and author
  No → loop back to search
  Yes → proceed
  ↓
/reading-level — select depth: Beginner / Intermediate / Advanced / Deep Dive
  ↓
/preview — see locked course structure (all 7 day titles visible)
  ↓
SOFT GATE — card collected here, at peak desire
  "We save a payment method on file — just in case you love it."
  No charge today. Reminder email before trial ends.
  ↓
Course queued → /dashboard with real-time progress bar
  ↓
Course active — 3 tabs: Course / Chat / Flashcards
  ↓
Day 5 — reminder email sent (leads with cancel link)
  ↓
Day 7 — two things happen simultaneously:
  Book expires and is permanently deleted
  Card is charged, subscription activates
  OR
Cancel before Day 7 — no charge ever,
book accessible until Day 7 then deleted
```

---

## PLAN STRUCTURE

### Free Trial (7 Days)
- 1 book slot
- Full access: course, chat, 20 flashcards
- Card saved at soft gate — no charge for 7 days
- Reminder email Day 5 with one-tap cancel link
- Auto-converts to paid on Day 7 if not cancelled

### Paid Plan ($9.99/month)
- Unlimited book slots
- 30-day course expiry
- 40 flashcards per book
- Priority generation queue
- Gemini 3.1 Pro upgrade path when activated

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | Firebase Authentication |
| Database | Firestore (Firebase) |
| AI — Course + Compression | Gemini 2.5 Pro |
| AI — Chat | Gemini 2.5 Flash |
| AI — Search, Flashcards, Validation | Gemini 2.5 Flash-Lite |
| Scheduled Jobs | Firebase Cloud Functions + Cloud Scheduler |
| Payments | Stripe Elements (embedded — not Checkout redirect) |
| Hosting | Vercel |
| Repository | GitHub — Godz-iAgency/v0-bookworm-ai |

---

## FULL DOCUMENT MAP

| File | Purpose |
|---|---|
| GEMINI_HANDOFF_PROMPT.md | Read first every session. Context, rules, current status. |
| doc0_ui_ux_standards.md | Design system — tokens, fonts, motion, micro-copy, screen direction. |
| doc1_complete_index.md | This file. Product overview, flow, plan structure, doc map. |
| doc2_concept_compression.md | Gemini Pro prompt, caching, JSON schema, output example. |
| doc3_content_quality.md | Lesson rubric, reading levels, 7-day arc, flashcard and chat standards. |
| doc4_trial_summary.md | Soft gate UX, full trial flow, card copy, Day 5 email, Stripe trial. |
| doc5_antigravity_update.md | 8-phase build sequence with exact prompts per phase. |
| doc6_firebase_stripe_setup.md | Firebase config, auth code, Stripe setup, complete webhook handler. |
| doc7_tech_integration.md | All API routes, model config, rate limit handling, middleware. |
| doc8_auto_delete_spec.md | Cloud Functions, expiry logic, deletion sequence, security rules. |
| bookworm_master_build_v2.md | Single file containing everything above combined. |

---

## ONE-LINE UPGRADE PATH

When income starts — in `/lib/gemini/config.ts`:
Change `PRO: 'gemini-2.5-pro'` to `PRO: 'gemini-3.1-pro-preview'`

Course generation and concept compression both upgrade instantly.
No other code changes. One line.
# BOOKWORM.AI — COMPRESS BOOK INTO 5 CONCEPTS
**Version 2.0 | Updated by Claude Sonnet 4.6**

---

## PURPOSE

The 5-concept compression is the most important single operation in Bookworm.AI. It runs once per book, its output is cached in Firestore permanently, and every downstream AI feature — course generation, chat, and flashcards — uses this cached output as its knowledge base.

This means Gemini 2.5 Pro does the heavy analytical work exactly once. Every subsequent call uses the result. This is the architecture decision that makes the app financially viable on the free tier.

---

## MODEL DECISION

**Model: Gemini 2.5 Pro**

Reasoning: The 5-concept compression is a structured extraction task, but it requires genuine analytical depth — identifying the most essential principles from a full book and distilling them accurately. Gemini 2.5 Pro has the reasoning quality to do this well. The output directly determines the quality of the user's entire learning experience, so this is not a place to use a lighter model.

**Upgrade path:** When income allows, swap to `gemini-3.1-pro-preview`. The output quality will improve, particularly for philosophical or nuanced books. The code change is one line.

---

## WHEN IT RUNS

The compression runs as the first step inside the course generation Cloud Function, immediately before lesson generation begins. If a conceptSummary already exists on the book document (e.g., for a retry), it is used as-is and not regenerated.

```
User confirms book + reading level
  ↓
Job added to generation_queue
  ↓
Cloud Function picks up job
  ↓
Step 1: Concept compression (Flash-Lite → cached to Firestore)
  ↓
Step 2: Lesson 1 generated using concept summary as context
  ↓
Step 3-8: Lessons 2-7 generated sequentially
```

---

## THE PROMPT

```
You are a master teacher. Compress the book "{title}" by {author}
into exactly 5 core concepts.

Reading level target: {readingLevel}

Reading level instructions:
- beginner: Use simple everyday language. No jargon. Short sentences.
- intermediate: Clear language with brief explanations of domain terms.
- advanced: Full domain vocabulary. Dense, precise language expected.
- deep_dive: Maximum depth. Technical and philosophical nuance. No simplification.

For each concept output:
- name: 4 words maximum
- essence: the single most important idea in 20 words maximum
- insight: the key understanding the reader needs, in 2-3 sentences
- application: one practical action the reader can take, in 1-2 sentences

Output valid JSON only. No markdown. No preamble. No explanation.

{
  "bookTitle": "string",
  "author": "string",
  "readingLevel": "string",
  "concepts": [
    {
      "name": "string",
      "essence": "string",
      "insight": "string",
      "application": "string"
    }
  ]
}
```

---

## FULL IMPLEMENTATION

```typescript
// lib/gemini/conceptCompression.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODELS } from './config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const LEVEL_INSTRUCTIONS = {
  beginner: 'Use simple everyday language. No jargon. Short sentences.',
  intermediate: 'Clear language with brief explanations of domain terms.',
  advanced: 'Full domain vocabulary. Dense, precise language expected.',
  deep_dive: 'Maximum depth. Technical and philosophical nuance. No simplification.'
};

export async function compressBookConcepts(
  title: string,
  author: string,
  readingLevel: string
): Promise<ConceptSummary> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.PRO });

  const prompt = `
You are a master teacher. Compress the book "${title}" by ${author}
into exactly 5 core concepts.

Reading level target: ${readingLevel}
${LEVEL_INSTRUCTIONS[readingLevel as keyof typeof LEVEL_INSTRUCTIONS]}

For each concept output:
- name: 4 words maximum
- essence: the single most important idea in 20 words maximum
- insight: the key understanding in 2-3 sentences
- application: one practical action the reader can take in 1-2 sentences

Output valid JSON only. No markdown. No preamble.

{
  "bookTitle": "string",
  "author": "string",
  "readingLevel": "string",
  "concepts": [
    {
      "name": "string",
      "essence": "string",
      "insight": "string",
      "application": "string"
    }
  ]
}
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip any markdown fences if model adds them
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}
```

---

## CACHING TO FIRESTORE

The concept summary is written to the book document immediately after generation. It is never regenerated unless the book document is deleted and recreated.

```typescript
// Inside the Cloud Function — after compression completes:
await db.doc(`users/${userId}/books/${bookId}`)
  .update({ conceptSummary: conceptSummaryObject });
```

On every downstream call (chat, flashcards), fetch the cached summary:

```typescript
// Efficient — reads one field from one document
const bookSnap = await db.doc(`users/${userId}/books/${bookId}`).get();
const conceptSummary = bookSnap.data()?.conceptSummary;
```

---

## OUTPUT EXAMPLE

For "Atomic Habits" by James Clear at Intermediate level:

```json
{
  "bookTitle": "Atomic Habits",
  "author": "James Clear",
  "readingLevel": "intermediate",
  "concepts": [
    {
      "name": "1% Daily Improvement",
      "essence": "Small consistent improvements compound into remarkable results over time",
      "insight": "A 1% improvement each day results in 37x improvement over a year. Most people overestimate what they can do in a week and underestimate what they can do in a year. The math of compounding works against you when habits are bad and for you when habits are good.",
      "application": "Identify one habit you perform daily and find one way to improve its execution by a small margin this week."
    },
    {
      "name": "Systems Over Goals",
      "essence": "The system you follow matters more than the goal you set",
      "insight": "Goals are good for setting direction but systems are what actually produce results. Two people can share the same goal but the one with the better system wins consistently. Focusing on outcomes leads to yo-yo cycles — focusing on process leads to lasting change.",
      "application": "Write down your current goal, then describe the weekly system that would make achieving it inevitable."
    }
  ]
}
```

---

## ERROR HANDLING

```typescript
export async function compressBookConceptsSafe(
  title: string,
  author: string,
  readingLevel: string,
  retryCount = 0
): Promise<ConceptSummary | null> {
  try {
    return await compressBookConcepts(title, author, readingLevel);
  } catch (error) {
    if (retryCount < 2) {
      // Wait 5 seconds before retry (rate limit buffer)
      await new Promise(r => setTimeout(r, 5000));
      return compressBookConceptsSafe(title, author, readingLevel, retryCount + 1);
    }
    console.error('Concept compression failed after 3 attempts:', error);
    return null;
  }
}
```

If compression fails after 3 attempts, the job is marked as failed in the queue and the user sees an error state on their book card with a "Try again" option.

---

## FIRESTORE SCHEMA FOR CONCEPT SUMMARY

Stored under `users/{userId}/books/{bookId}` as a field:

```typescript
conceptSummary: {
  bookTitle: string
  author: string
  readingLevel: string
  concepts: Array<{
    name: string       // 4 words max
    essence: string    // 20 words max
    insight: string    // 2-3 sentences
    application: string // 1-2 sentences
  }>
}
```

---

## TOKEN COST NOTE

At Gemini 2.5 Pro rates, a concept compression call uses approximately 500-800 input tokens (prompt) and 400-600 output tokens (5 concepts in JSON). At 100 free RPD, this is well within budget even at high user volumes. Each call is made exactly once per book — the cache makes every subsequent AI operation free in terms of Pro quota.
# BOOKWORM.AI — CONTENT QUALITY STANDARDS
**Version 2.0 | Updated by Claude Sonnet 4.6**

---

## PURPOSE

This document defines the quality bar for every piece of AI-generated content in Bookworm.AI. It covers lesson structure, reading level calibration, the 7-day progression arc, and flashcard standards. These standards are enforced in the prompts sent to Gemini — they are not aspirational guidelines, they are structural requirements baked into every generation call.

---

## PART A: 7-DAY LESSON QUALITY STANDARDS

### A.1 Word Count Targets by Reading Level

| Level | Target Words | Paragraph Style |
|---|---|---|
| Beginner | 400-500 words | Short paragraphs, 2-3 sentences each |
| Intermediate | 500-650 words | Balanced, occasional longer paragraphs |
| Advanced | 600-750 words | Dense, may include longer analytical blocks |
| Deep Dive | 700-800 words | Complex, subordinate clauses, no hand-holding |

### A.2 Required Lesson Structure

Every lesson must contain these elements in this order:

**1. Day X Objective**
One sentence. States exactly what the learner will understand by the end of this lesson.
Example: "Day 3 Objective: Understand how the habit loop — cue, craving, response, reward — operates in your daily behavior."

**2. Three Main Sections (H3 headings)**
Each section covers one concept cluster. Heading should be specific and descriptive, not generic.
Good: "### The Cue Is Not the Habit"
Bad: "### Section One"

**3. Apply This Callout (after every section)**
A specific, actionable exercise or prompt tied directly to the section content.
Labeled exactly as: "Apply This:"
Must be achievable today, not someday.
Example: "Apply This: For the next 24 hours, notice the cue that triggers your most automatic habit. Write it down."

**4. Day X Summary**
2-3 sentences. Recaps the core insight of the lesson. Does not introduce new information.

**5. Estimated Read Time**
Calculated at 200 words per minute and stored in Firestore as `estimatedReadMinutes`.
This appears on the day card before the user opens the lesson.

### A.3 Reading Level Calibration

**Beginner:**
- Vocabulary: common words only, no domain jargon
- If a concept name must be used, define it immediately in the same sentence
- Sentence length: 10-15 words average
- Examples: everyday analogies — sports, cooking, commuting
- Tone: encouraging, supportive
- Concept density: one core idea per section

**Intermediate:**
- Vocabulary: domain terms allowed with brief in-line definitions on first use
- Sentence length: 15-20 words average
- Examples: mix of everyday and professional scenarios
- Tone: direct, collegial
- Concept density: two connected ideas per section

**Advanced:**
- Vocabulary: full domain vocabulary assumed, no hand-holding
- Sentence length: 20-25 words, varied structure
- Examples: case studies, data references, real-world applications
- Tone: peer-to-peer, analytical
- Concept density: three layered ideas per section, builds on each other

**Deep Dive:**
- Vocabulary: technical and philosophical depth, assumes expert familiarity
- Sentence length: complex, subordinate clauses, long-form argument structures
- Examples: original frameworks, edge cases, dissenting perspectives
- Tone: intellectually demanding, no concessions to simplicity
- Concept density: maximum — multiple frameworks per section, nuanced interplay

### A.4 The 7-Day Progression Arc

The 7-day arc is not 7 random chapters. It is a deliberate learning journey that builds on itself. Every lesson must serve its day's purpose — a Day 1 lesson written with Day 4 content fails the user.

| Day | Title | Purpose |
|---|---|---|
| Day 1 | Foundation | What is the book's core premise and why does it exist? Sets the frame for everything that follows. |
| Day 2 | The Problem | What specific problem does this book address? Why does it matter to the reader's life? Creates urgency. |
| Day 3 | The Framework | What is the primary methodology, system, or mental model the book teaches? The intellectual core. |
| Day 4 | Deep Application | How is the primary framework applied in real-world scenarios? Moves from theory to practice. |
| Day 5 | Nuance and Limits | Where does the framework have edges? What are the counterarguments and how does the book address them? |
| Day 6 | Advanced Case Study | A detailed, real-world example showing what mastery looks like in action. |
| Day 7 | Integration and Action Plan | How does the reader synthesize everything? What do they do starting today? Closes the loop. |

### A.5 Lesson Validation Checklist

Before a lesson is written to Firestore, the Cloud Function validates it against these checks:

- Word count within target range for reading level
- "Day X Objective:" present at top
- Exactly 3 H3 headings present
- "Apply This:" present after each of the 3 sections (3 total)
- "Day X Summary:" present at end
- No section heading is generic ("Section One", "Introduction", "Conclusion")
- Content matches the day's purpose from the progression arc

If validation fails: lesson is regenerated (max 2 retries per day).

---

## PART B: FLASHCARD QUALITY STANDARDS

### B.1 Card Distribution — 20 Cards Per Book

| Type | Count | Purpose |
|---|---|---|
| Definition | 10 | Key terms and concepts from the book |
| Application | 5 | Real-world scenarios and the book's recommended response |
| Reflection | 5 | Open-ended questions that deepen understanding |

### B.2 Card Length Limits

- Front: maximum 15 words
- Back: maximum 60 words
- No card duplicates within the deck
- Language must match the user's selected reading level

### B.3 Card Examples by Type

**Definition card:**
Front: "What is the habit loop according to James Clear?"
Back: "A four-step cycle: cue (trigger), craving (motivation), response (the habit itself), and reward (the satisfying outcome). Every habit runs through this loop automatically."

**Application card:**
Front: "You want to start a daily reading habit. How does the book suggest you begin?"
Back: "Make the cue obvious (leave the book on your pillow), make it attractive (pair it with something you enjoy), make it easy (start with 2 pages only), and make it satisfying (track your streak)."

**Reflection card:**
Front: "Why do most people fail to build lasting habits despite strong motivation?"
Back: "According to the book, motivation is unreliable. People rely on willpower, which depletes. Lasting habits are built on system design, not willpower — when your environment makes the right behavior the default, motivation becomes irrelevant."

### B.4 Flashcard Generation Prompt

```
Generate exactly 20 flashcards for the book "{title}" by {author}.
Reading level: {readingLevel}

Use this concept summary as your knowledge base:
{conceptSummary}

Card distribution required:
- 10 definition cards: key term or concept on front, clear
  explanation on back
- 5 application cards: a real-world scenario on front, the
  book's recommended approach on back
- 5 reflection cards: a thought-provoking question on front,
  the book's framework answer on back

Rules:
- Front: maximum 15 words
- Back: maximum 60 words
- No duplicate cards
- Language calibrated to {readingLevel}
- Every card must be grounded in the book's actual content

Output valid JSON only. No markdown. No preamble.

{
  "flashcards": [
    {
      "front": "string",
      "back": "string",
      "type": "definition" | "application" | "reflection"
    }
  ]
}
```

---

## PART C: CHAT RESPONSE QUALITY STANDARDS

### C.1 Chat Response Rules

The AI chat assistant must follow these rules on every response:

1. Every answer connects back to the book's principles. Generic life advice is not acceptable.
2. When drawing from a specific concept, reference it — even briefly.
3. Responses are focused and actionable. No filler sentences.
4. If asked something outside the book's scope, bridge it: "The book's perspective on this would be..."
5. Maximum response length: 200 words unless the user explicitly asks for more depth.
6. Tone must match the reading level — the user chose their depth deliberately.

### C.2 Starter Prompts (shown when chat is empty)

These are the four default starter prompts shown to new users on the chat tab:

- "What is the core message of this book?"
- "How can I apply this to my life starting today?"
- "Explain the most important principle in simple terms"
- "Summarize what I've learned so far in this course"

These are tap-to-send chips, not just suggestions. Tapping sends the message immediately.

### C.3 Context Window Management

To keep Flash token usage efficient:

- Last 10 messages kept in active context per chat session
- Older messages archived in Firestore but removed from the API call
- System prompt built from: book title + author + reading level + cached concept summary
- Total system prompt target: 500 tokens maximum
- Never send raw book text — always use the cached concept summary

---

## PART D: BOOK CONFIRMATION QUALITY STANDARDS

### D.1 Confirmation Accuracy

When a user searches for a book, the app must:
- Return the correct book with high confidence
- Show the exact title, author's full name, and publication year
- Include a one-sentence description that accurately reflects the book's topic
- Display the book cover from Google Books API
- If confidence is low, return found: false rather than a wrong book

### D.2 Ambiguous Search Handling

If the search query could match multiple books (e.g., "think and grow rich" vs "think and grow rich for women"):
- Return the most widely known version as the primary result
- The user has a "Search again" option to find a different version

### D.3 Book Not Found State

If no clear match: show a friendly message — "We couldn't find that book. Try the full title or include the author's name." — and return the user to the search input with focus.

Never show a generic error. Never crash the UI on a failed search.
# BOOKWORM.AI — 7-DAY FREE TRIAL
**Version 2.1 | Updated by Claude Sonnet 4.6**
**Major update: Soft gate UX — search before card collection**

---

## TRIAL DESIGN PHILOSOPHY

The 7-day free trial is not a paywall. It is not a restriction. It is an experience that mirrors the product itself — and the way the card is collected is as deliberate as the way the book disappears.

Three things this trial does simultaneously:

1. It mirrors the core product experience. The book disappears in 7 days. The trial disappears in 7 days. The urgency is the product identity, not a sales tactic.
2. It lets the user get emotionally invested before asking for anything. They search their book, they see the course preview, they want it — and the card collection happens at peak desire, not at the door.
3. It qualifies intent without feeling like a gate. A user who will not save a card for something they already want was never going to pay. The soft gate finds that out gracefully.

There are no extensions. There are no exceptions. This is a feature, not a limitation.

---

## THE SOFT GATE — HOW IT WORKS

The old approach stops the user immediately after sign-up and asks for a card. That feels like a paywall.

The new approach lets the user go further before the card appears. By the time the card is requested, the user has already searched their book, confirmed it, chosen their reading level, and seen a preview of their course. They are invested. The card feels like the last small step to unlock something they already want — not the price of entry.

### The Emotional Arc

```
Sign up → feel excited about the idea
  ↓
Search a book → feel attached to a specific book
  ↓
Confirm the book → see the cover, the description, feel it is real
  ↓
Choose reading level → feel personally invested in their version of the course
  ↓
See course preview (locked) → feel the pull of what they are about to get
  ↓
Soft gate message + card collection → feels like unlocking, not paying
  ↓
Course generates → reward is immediate
```

The card is collected at the moment of maximum desire. That is the architecture.

---

## UPDATED TRIAL RULES

- User can search and preview before any card is required
- Credit card collected at the point of course generation — not at sign-up
- 7 days from card collection — no charge for the first 7 days
- A reminder email is sent on Day 5 — two days before the trial ends
- If not cancelled before Day 7: card is charged, subscription begins
- If cancelled before Day 7: no charge, book accessible until Day 7, then deleted
- The trial book expires on Day 7 — same as any paid book, by design
- No extensions. No pauses. No exceptions.

---

## COMPLETE UPDATED TRIAL FLOW

```
User creates account (Google Sign-In or Email/Password)
  ↓
Middleware: no trialStatus detected
  ↓
User goes directly to /search
(No card required yet — let them find their book first)
  ↓
User searches book → confirms title and author
  ↓
User selects reading level
  ↓
Course preview screen — locked lesson titles visible, course structure shown
  ↓
SOFT GATE: card collection screen appears
(User already has a specific book they want — desire is at peak)
  ↓
Stripe Checkout — card saved, trial starts, no charge today
  ↓
Stripe webhook fires: checkout.session.completed
  → Firestore: trialStatus: 'active', trialStartedAt, trialEndsAt
  ↓
Course generation begins immediately — user goes to /dashboard
  ↓
Real-time progress bar while course generates
  ↓
Course active — full access: course, chat, flashcards
  ↓
Day 5: reminder email sent
  "Your Bookworm trial ends in 2 days — here is how to cancel if you need to"
  ↓
Day 5: in-app banner activates (amber)
  ↓
Day 7 — two things happen simultaneously:
  → Auto-delete Cloud Function expires and deletes the book
  → Stripe charges the card — subscription becomes active
  → Firestore: trialStatus: 'converted', plan: 'paid'
```

**If user cancels before Day 7:**
```
User cancels via Stripe customer portal or in-app cancel link
  ↓
Stripe fires customer.subscription.deleted
  ↓
Firestore: trialStatus: 'cancelled', plan: 'free'
  ↓
Book remains accessible until Day 7 expiry
  ↓
Day 7: book deleted by auto-delete function
  ↓
Account exists but no active plan
  → On next visit: user goes to /search again
  → Soft gate reappears at course generation
```

---

## UPDATED ROUTE PROTECTION LOGIC

The middleware is updated to allow /search and /reading-level before trial activation. The gate only fires at the point of course generation.

```typescript
// middleware.ts

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  // Not logged in — send to auth
  if (!token) return NextResponse.redirect(new URL('/auth', req.url));

  const path = req.nextUrl.pathname;

  // These routes are open before trial activation
  // User can search and preview without a card
  const openRoutes = ['/search', '/reading-level', '/preview'];
  if (openRoutes.some(r => path.startsWith(r))) {
    return NextResponse.next();
  }

  // Dashboard requires active trial or paid plan
  if (path.startsWith('/dashboard')) {
    const userDoc = await getUserDoc(token.uid);

    const hasAccess =
      userDoc?.trialStatus === 'active' ||
      userDoc?.plan === 'paid';

    if (!hasAccess) {
      // Send them to search — let the soft gate do its job
      return NextResponse.redirect(new URL('/search', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/search/:path*', '/reading-level/:path*']
};
```

---

## COURSE PREVIEW SCREEN — /preview

This screen appears after reading level selection, before the card is collected. It shows the user exactly what they are about to get — locked but visible.

### Layout

```
[Book cover — left, 80x120px]  [Title, Author, Reading level badge]

Your 7-Day Course Is Ready

Day 1  [lesson title]          [lock icon]
Day 2  [lesson title]          [lock icon]
Day 3  [lesson title]          [lock icon]
Day 4  [lesson title]          [lock icon]
Day 5  [lesson title]          [lock icon]
Day 6  [lesson title]          [lock icon]
Day 7  [lesson title]          [lock icon]

+ AI Chat — Ask the book anything
+ 20 Smart Flashcards — generated from the book

[Generate My Course →]         ← gradient button, full width
```

The lesson titles are real — generated by a single lightweight Flash-Lite call that produces the 7 day titles only, with no content yet. This makes the preview feel personal and specific, not generic. The full lesson content generates after the card is collected.

Tapping "Generate My Course" triggers the soft gate.

---

## THE SOFT GATE SCREEN — COPY AND LAYOUT

This is the most important screen in the entire onboarding flow. The copy must feel like a service, not a requirement.

### Full Screen Layout

```
[Bookworm.AI logo — small, top center]


Your course is ready to generate.


We save a payment method on file — just in case you love it
and want to keep learning after your 7 days.

You will not be charged today.


✓  A reminder email goes to your inbox before your trial ends
   so nothing catches you off guard.

✓  Cancel in one tap — no forms, no phone calls, no runaround.

✓  Your book disappears in 7 days either way.
   That is kind of the whole point.


[Secure card form — Stripe Elements embedded directly in page]


[Start My Free Experience →]       ← gradient, full width


No charge today.
Cancel before Day 7 and you pay nothing, ever.
```

### Why Each Line Is There

**"We save a payment method on file — just in case you love it"**
Reframes the card as a convenience, not a requirement. "Just in case" implies it might not even be needed.

**"You will not be charged today."**
Said twice — once in the intro, once at the bottom. Repetition removes the fear without being defensive about it.

**"A reminder email goes to your inbox before your trial ends so nothing catches you off guard."**
This is the most important trust line. Most subscription services hide this. You are leading with it. Users who see this line relax immediately.

**"Cancel in one tap — no forms, no phone calls, no runaround."**
Directly addresses the most common subscription fear. Name the fear. Dismiss it.

**"Your book disappears in 7 days either way. That is kind of the whole point."**
This is the line that does the most work. It reframes the 7-day limit as the product identity, not a trial restriction. It also signals confidence — the app has a philosophy. Users who resonate with this line are your best customers.

### Stripe Integration on Soft Gate Screen

Use Stripe Elements (embedded card form) directly on this screen — not a redirect to Stripe Checkout. This keeps the user in the app and makes the card entry feel like part of the flow, not a handoff to a payment processor.

```typescript
// components/SoftGateForm.tsx
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CardForm({ userId, bookData, readingLevel }: CardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    try {
      // Create setup intent to save card without charging
      const { clientSecret } = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        body: JSON.stringify({ userId })
      }).then(r => r.json());

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        { payment_method: { card: elements.getElement(CardElement)! } }
      );

      if (stripeError) {
        setError(stripeError.message || 'Card could not be saved');
        return;
      }

      // Card saved — now create the trial subscription and trigger generation
      await fetch('/api/stripe/activate-trial', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          paymentMethodId: setupIntent.payment_method,
          bookData,
          readingLevel
        })
      });

      // Navigate to dashboard — course is now queued
      router.push('/dashboard?trial=started');

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <CardElement options={{
        style: {
          base: {
            color: '#ffffff',
            fontSize: '16px',
            '::placeholder': { color: '#888888' }
          }
        }
      }} />
      {error && <p className="error-text">{error}</p>}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Setting up your experience...' : 'Start My Free Experience →'}
      </button>
      <p className="muted">No charge today. Cancel before Day 7 and you pay nothing, ever.</p>
    </div>
  );
}

export default function SoftGate({ bookData, readingLevel, userId }: Props) {
  return (
    <Elements stripe={stripePromise}>
      <CardForm userId={userId} bookData={bookData} readingLevel={readingLevel} />
    </Elements>
  );
}
```

---

## DAY 5 REMINDER EMAIL

### When It Sends

Day 5 of the trial — 2 days before the card is charged. This is triggered by the Stripe `customer.subscription_trial_will_end` webhook, which fires 3 days before trial end. The email goes out that same day.

Do not send this on Day 7. Day 7 is too late — the charge is hours away. Day 5 gives the user a real decision window.

### Subject Line

```
Your Bookworm trial ends in 2 days — here is how to cancel if you need to
```

Leading with cancel instructions in the subject line is counterintuitive. It is also the highest-trust subject line you can send. Users who open this and do not cancel are your most committed subscribers. Users who were going to chargeback are given an easy exit before the charge happens.

### Email Body

```
Hi [Name],

Your 7-day Bookworm trial ends on [Day 7 Date].

If you would like to cancel before then, here is the link:
[Cancel My Trial →]

One tap. Done. No charge.

---

If you are enjoying your course on [Book Title], your subscription
continues automatically at $9.99/month after your trial ends.
You can cancel anytime — same one-tap process.

Here is where you are in your course:
Day [X] of 7 completed ✓

Two days left. Make them count.

— The Bookworm Team

---

Questions? Reply to this email. We read every one.
```

### What This Email Does

The cancel link is in the first paragraph. This is intentional. Users who see it and do not click it have made a conscious decision to stay. That removes buyer's remorse and chargebacks.

The course progress line ("Day X of 7 completed") is a retention mechanism. A user who has completed 4 days is unlikely to cancel. Showing them their own progress at the moment of decision is a gentle, honest nudge.

"Two days left. Make them count." — reinforces the disappearing theme without being pushy.

---

## IN-APP TRIAL COUNTDOWN BANNER

Visible on /dashboard when `trialStatus === 'active'`.

### Banner States

**Days 7-6 (neutral, informational):**
```
Your trial ends in X days — your book disappears with it.
[Upgrade Now]
```
Style: dark surface, subtle border. Not urgent. Just present.

**Days 5-4 (neutral, reminder email just sent):**
```
Your trial ends in X days. A reminder is in your inbox.
[Upgrade Now]
```
Style: same as above. Acknowledges the email was sent.

**Days 3-2 (amber):**
```
Your trial ends in X days — your book disappears with it.
[Upgrade Now]
```
Style: amber border, amber highlight on the day count.

**Day 1 (red):**
```
Your trial ends tomorrow. Your book disappears at midnight.
[Keep Learning — $9.99/month]
```
Style: red border, stronger CTA copy. "Keep Learning" replaces "Upgrade Now" — it is about continuation, not payment.

**Day of expiry:**
```
Your trial ends today.
[Keep Learning — $9.99/month]
```

### Upgrade Flow from Banner

Tapping the CTA calls `/api/stripe/create-checkout` — the standard subscription checkout. Because the user already has a Stripe customer ID and saved payment method from the soft gate, Stripe can charge them with one confirmation step. No new card entry required.

---

## FIRESTORE USER DOCUMENT — TRIAL FIELDS

```typescript
{
  // Set at account creation
  email: string,
  displayName: string,
  plan: 'free' | 'paid',
  activeBookCount: number,

  // Set when soft gate card is collected
  trialStatus: 'active' | 'converted' | 'cancelled' | 'expired',
  trialStartedAt: Timestamp,
  trialEndsAt: Timestamp,           // trialStartedAt + 7 days
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  stripePaymentMethodId: string,    // saved from setup intent

  // Set by Day 5 reminder webhook
  showTrialEndWarning: boolean,
  reminderEmailSentAt: Timestamp
}
```

Before the soft gate: `trialStatus` does not exist on the document. Its absence tells middleware the user has not committed yet — they are still in the open search phase.

---

## STRIPE WEBHOOK EVENTS — UPDATED

```typescript
switch (event.type) {

  case 'checkout.session.completed':
    // Soft gate card saved and trial activated
    const session = event.data.object;
    await db.doc(`users/${session.metadata.userId}`).update({
      trialStatus: 'active',
      trialStartedAt: serverTimestamp(),
      trialEndsAt: Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ),
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      plan: 'free'
    });
    break;

  case 'customer.subscription_trial_will_end':
    // Fires 3 days before trial ends — send Day 5 reminder email
    const trialEndSub = event.data.object;
    const trialUser = await getUserByStripeId(trialEndSub.customer);
    if (trialUser) {
      await trialUser.ref.update({
        showTrialEndWarning: true,
        reminderEmailSentAt: serverTimestamp()
      });
      // Trigger reminder email via Firebase extension or email service
      await sendTrialReminderEmail(trialUser.data());
    }
    break;

  case 'customer.subscription.updated':
    // Trial converted to active paid subscription
    const updatedSub = event.data.object;
    if (updatedSub.status === 'active') {
      const convertedUser = await getUserByStripeId(updatedSub.customer);
      if (convertedUser) {
        await convertedUser.ref.update({
          plan: 'paid',
          trialStatus: 'converted'
        });
      }
    }
    break;

  case 'customer.subscription.deleted':
    // Trial cancelled OR paid subscription cancelled
    const deletedSub = event.data.object;
    const cancelledUser = await getUserByStripeId(deletedSub.customer);
    if (cancelledUser) {
      const wasTrial = cancelledUser.data()?.trialStatus === 'active';
      await cancelledUser.ref.update({
        plan: 'free',
        trialStatus: wasTrial ? 'cancelled' : 'expired'
      });
    }
    break;
}
```

---

## ANTIGRAVITY PROMPT — SOFT GATE SCREEN

Add this to Phase 7 in the build sequence, before the standard Stripe routes:

```
Build the soft gate screen for Bookworm.AI.
This screen appears after reading level selection, before course generation.
It collects the card using Stripe Elements embedded directly on the page.
No redirect to Stripe Checkout — the card form lives inside the app.

Route: /preview (combines course preview + card collection)

TOP SECTION — Course Preview:
- Book cover, title, author, reading level badge
- Heading: "Your 7-Day Course Is Ready"
- 7 day cards listed with lesson titles (from Flash-Lite preview call)
  Each card shows a lock icon — not yet unlocked
- Below the day list:
  "+ AI Chat — Ask the book anything"
  "+ 20 Smart Flashcards — generated from the book"

DIVIDER — subtle line or spacing

SOFT GATE SECTION:
Heading: "Your course is ready to generate."
Body copy (exact, do not paraphrase):
  "We save a payment method on file — just in case you love it
  and want to keep learning after your 7 days.
  You will not be charged today."

Three trust bullets:
  ✓ A reminder email goes to your inbox before your trial ends
    so nothing catches you off guard.
  ✓ Cancel in one tap — no forms, no phone calls, no runaround.
  ✓ Your book disappears in 7 days either way.
    That is kind of the whole point.

Stripe Elements card form — embedded, dark theme to match app:
  card number, expiry, CVC in a single row field
  Style: white text on dark surface, 16px, matches app font

CTA button: "Start My Free Experience →"
  Gradient, full width, min-height 48px
  Shows "Setting up your experience..." with spinner while processing

Below button (muted text, small):
  "No charge today. Cancel before Day 7 and you pay nothing, ever."

On success: navigate to /dashboard?trial=started
On error: show inline error below card form, do not clear the form

Mobile: card form must not trigger page zoom on focus.
Set font-size 16px minimum on all inputs.
```

---

## ENVIRONMENT VARIABLES FOR TRIAL

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## WHEN TO CONNECT STRIPE MCP IN ANTIGRAVITY

Connect the Stripe MCP at the start of Phase 7 — after auth, course generation, chat, flashcards, and auto-delete are all working. Build what the user pays for first. Collect the payment last.
# BOOKWORM.AI — ANTIGRAVITY BUILD SEQUENCE
**Version 2.0 | Updated by Claude Sonnet 4.6**

---

## HOW TO USE THIS DOCUMENT

This is your step-by-step execution guide for building Bookworm.AI inside Antigravity. Each phase tells you:

- What you are building
- Which LLM to select inside Antigravity for that phase
- When to connect Firebase MCP and Stripe MCP
- The exact prompt to paste — copy it verbatim
- The acceptance criteria you must verify before moving to the next phase

**Rule: Never skip an acceptance check.** Each phase is a foundation. A mistake in Phase 2 will surface as a bug in Phase 5. Catch it early.

---

## LLM SELECTION GUIDE FOR ANTIGRAVITY

| Phase | Use This LLM in Antigravity | Why |
|---|---|---|
| Phase 0 | N/A — outside Antigravity | Setup only |
| Phase 1 | Gemini 2.5 Pro | Architecture and auth decisions need reasoning depth |
| Phase 2 | N/A — MCP connection only | |
| Phase 3 | Gemini 2.5 Pro | API route design and search logic |
| Phase 4 | Gemini 2.5 Pro | Course generation queue is the most complex code in the app |
| Phase 5 | Gemini 2.5 Pro | Dashboard state management and real-time listeners |
| Phase 6 | Gemini 2.5 Pro | Chat and flashcard integration |
| Phase 7 | Gemini 2.5 Pro | Auto-delete Cloud Functions and Stripe integration |
| Phase 8 | Gemini 2.5 Flash | UI polish does not need Pro reasoning |

---

## PHASE 0: PRE-FLIGHT
**Do this before opening Antigravity**

### Step 1 — Firebase Project
1. Go to console.firebase.google.com
2. Create project: `bookworm-ai-prod`
3. Authentication → Sign-in methods → Enable: Google, Email/Password
4. Firestore Database → Create database → Production mode → Region: us-central1
5. Project Settings → Your apps → Add web app → Copy the config object

### Step 2 — Gemini API Key
1. Go to aistudio.google.com
2. Get API Key → Copy
3. One key handles Pro, Flash, and Flash-Lite — the model is specified per call

### Step 3 — Environment Variables Ready
Have these ready to paste into Antigravity and Vercel:
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

**You are ready. Open Antigravity.**

---

## PHASE 1: FIREBASE AND AUTH
**Antigravity LLM: Gemini 2.5 Pro**
**MCP: None yet**

### Prompt 1A — Firebase Setup
```
I am upgrading Bookworm.AI, a Next.js 14 app that turns any book
into a 7-day course, AI chat, and flashcards.
Repo: https://github.com/Godz-iAgency/v0-bookworm-ai

Task: Set up Firebase in this existing project.

1. Install firebase SDK
2. Create /lib/firebase/config.ts — initialize Firebase app
   using environment variables:
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
3. Create /lib/firebase/auth.ts — export:
   - signInWithGoogle: uses signInWithRedirect on mobile and
     Kindle (detect via userAgent containing iPhone, iPad,
     Android, or Kindle), signInWithPopup on desktop
   - signUpWithEmail(email, password)
   - signInWithEmail(email, password)
   - resetPassword(email)
   - ensureUserDocument(user): creates Firestore user doc on
     first login if it does not already exist, with fields:
     email, displayName, photoURL, authProvider, createdAt,
     plan: 'free', activeBookCount: 0
4. Create /lib/firebase/db.ts — export initialized Firestore db
5. Create AuthContext using React Context API that wraps the app,
   tracks auth state via onAuthStateChanged, exposes:
   user, loading, signInWithGoogle, signUpWithEmail,
   signInWithEmail, signOut, resetPassword

Do not build any UI yet. Firebase config and auth logic only.
```

### Prompt 1B — Auth UI
```
Build the Bookworm.AI login and sign-up page.
Route: /auth

Brand: Black background #0a0a0a, dot grid background pattern,
cyan-to-pink gradient accents (#00d4ff to #ff2d78).

Layout: centered card on all screen sizes, max-width 440px.

Elements in order:
1. Bookworm.AI logo centered at top
2. Tagline: "Your books. Seven days. Transformed."
3. Google Sign-In button — full width, white bg, Google icon,
   text "Continue with Google"
4. Divider line with "or" centered
5. Email input field — full width, min-height 48px
6. Password input field — full width, min-height 48px
7. Toggle between Sign In and Sign Up mode on the same page
8. In Sign Up mode: show Confirm Password field
9. "Forgot password?" link shown only in Sign In mode
10. Submit button — gradient background, full width, min-height 48px

Validation:
- Email format
- Password minimum 8 characters
- Confirm password match on sign-up
- Inline error messages below each field
- Loading spinner inside submit button during auth request

On successful auth: check if user has trialStatus in Firestore.
If not: redirect to /trial.
If yes: redirect to /dashboard.

Mobile rules:
- All inputs min-height 48px
- Font size 16px minimum (prevents iOS keyboard zoom)
- Google redirect flow on Kindle and mobile
```

### Acceptance Criteria — Phase 1
- Google Sign-In works and routes correctly after login
- Email sign-up creates user in Firebase Auth console
- User document exists in Firestore under /users/{userId}
- Refresh on any protected page keeps user logged in
- Unauthenticated users redirect to /auth

---

## PHASE 2: CONNECT FIREBASE MCP
**Connect Firebase MCP now. Auth is confirmed working.**

In Antigravity: Tools → Connect MCP → Firebase

This gives Antigravity direct read/write access to your Firestore
database. You will use it to verify data at every phase from here forward.
Do not skip this step — it makes every subsequent phase faster to debug.

---

## PHASE 3: BOOK SEARCH AND CONFIRMATION
**Antigravity LLM: Gemini 2.5 Pro**
**MCP: Firebase connected**

### Prompt 3A — Book Search
```
Build the book search and confirmation flow for Bookworm.AI.

BACKEND — /api/books/search (POST, Next.js App Router):
- Accepts: { query: string }
- Call Gemini 2.5 Flash-Lite (model: gemini-2.5-flash-lite):
  Given this search query, return the best matching book.
  Output JSON only: { found: boolean, title: string,
  author: string, year: number, description: string,
  coverSearchQuery: string }
  If no clear match: { found: false }
- Call Google Books API to get cover:
  https://www.googleapis.com/books/v1/volumes?q={title}+{author}
  Extract from volumeInfo.imageLinks.thumbnail
- If no cover found: use placeholder
- Return combined result
- try/catch on all operations, return 500 on failure

FRONTEND — /search route:
Layout (mobile first, max-width 500px centered):
1. Back arrow to /dashboard
2. Heading: "What are you reading?"
3. Search input with search icon — full width, min-height 48px,
   submit on Enter or tap of search button
4. Loading state: skeleton card placeholder

Confirmation card (renders after search returns a result):
- Book cover image (left, 80x120px, rounded corners)
- Title, author, year
- One-sentence description
- Two buttons: "That's my book →" and "Search again"
- "That's my book" → navigate to /reading-level with book data
  stored in sessionStorage
- "Search again" → clear card, refocus input

If found: false → friendly message:
"We couldn't find that book. Try the full title or
include the author's name."
```

### Acceptance Criteria — Phase 3
- "Atomic Habits" returns correct book with cover image
- Confirmation card renders cleanly at 768px viewport width
- "Search again" clears card and refocuses input
- Book not found state shows helpful message, no crashes

---

## PHASE 4: READING LEVEL AND COURSE GENERATION
**Antigravity LLM: Gemini 2.5 Pro**
**MCP: Firebase connected**

### Prompt 4A — Reading Level Screen
```
Build the reading level selection screen for Bookworm.AI.
Route: /reading-level

Reads from sessionStorage: bookTitle, author, year, coverUrl

Layout (mobile first, max-width 500px centered):
1. Logo top left, step indicator top right: "Step 2 of 2"
2. Book pill at top: cover thumbnail + title + author
3. Heading: "How do you want to learn?"
4. Sub-text: "We'll build your 7-day course at this depth"

Four selection cards (2x2 grid on tablet, stacked on mobile):
- Beginner 🌱 "Simple language, foundational ideas"
- Intermediate 📖 "Balanced depth with clear context"
- Advanced 🧠 "Dense analysis, full nuance"
- Deep Dive 🔬 "Exhaustive breakdown, every principle"

Default state: dark card #1a1a1a, subtle border
Selected state: cyan-to-pink gradient border, soft glow
Single select only

CTA: "Generate My Course →"
- Gradient, full width, disabled until a card is selected
- On tap:
  1. Check activeBookCount in Firestore
     If 3 or more (free plan) → modal: "You have 3 active
     courses. Complete or remove one to add a new one."
  2. If slot available:
     a. Write book document to Firestore with status: 'queued',
        expiresAt: now + 7 days (or 30 days if plan: 'paid')
     b. Write job to generation_queue collection
     c. Navigate to /dashboard
     d. Dashboard shows new book card in generating state

Show loading spinner during Firestore write.
```

### Prompt 4B — Course Generation Cloud Function
```
Build the Firebase Cloud Function that processes course
generation for Bookworm.AI.

File: functions/src/processCourseQueue.ts
Trigger: Cloud Scheduler every 2 minutes

Logic:
1. Query generation_queue where status == 'pending',
   order by createdAt asc, limit 4
2. For each job:
   a. Update job status to 'processing'

   b. STEP 1 — Concept compression:
      Call Gemini 2.5 Pro (model: gemini-2.5-pro)
      Prompt: Compress "{title}" by {author} into exactly 5
      core concepts. Reading level: {readingLevel}.
      Each concept: name (4 words max), essence (20 words max),
      insight (2-3 sentences), application (1-2 sentences).
      Output valid JSON only.
      Write result to Firestore: users/{userId}/books/{bookId}
      field: conceptSummary

   c. STEP 2 — Lesson generation (7 calls):
      Call Gemini 2.5 Pro for each day 1 through 7.
      Wait 13 seconds between each call.
      Each call prompt:
        Write Day {n} of a 7-day course on "{title}" by {author}.
        Day {n} focus: [use this arc:
          Day 1: Core premise and why book exists
          Day 2: The problem the book addresses
          Day 3: Primary framework or methodology
          Day 4: Deep application in real scenarios
          Day 5: Nuance, limits, counterarguments
          Day 6: Advanced case study
          Day 7: Integration and personal action plan]
        Reading level: {readingLevel}
        Context (use as knowledge base): {conceptSummary}
        Structure required:
          - Open with "Day {n} Objective:" one sentence
          - Three H3 headings
          - After each section: "Apply This:" callout
          - Close with "Day {n} Summary:" 2-3 sentences
        Output valid JSON only:
        { lessonTitle, content (markdown), estimatedReadMinutes }
      
      After each lesson: write to Firestore under
      users/{userId}/books/{bookId}/lessons/day{n}
      Update generationProgress on book doc (14 per lesson = 0-98%)

   d. After all 7 lessons: update book status to 'active',
      generationProgress to 100
   e. Update job status to 'complete'

3. Error handling: increment retryCount, if >= 3 set failed
4. Wait 15 seconds between processing each job

All operations wrapped in try/catch with structured logging.
```

### Acceptance Criteria — Phase 4
- Create test course for "Atomic Habits" — Intermediate
- Cloud Function processes queue, writes all 7 lessons to Firestore
- generationProgress updates are visible in real-time in Firebase console
- Book status transitions: queued → generating (progress 0-100) → active
- All 7 lesson documents exist under /users/{uid}/books/{bookId}/lessons

---

## PHASE 5: COURSE DASHBOARD
**Antigravity LLM: Gemini 2.5 Pro**
**MCP: Firebase connected**

### Prompt 5 — Dashboard
```
Build the main Course Dashboard for Bookworm.AI.
Route: /dashboard

This is the primary screen. Optimize every detail for Kindle
Fire HD and mobile. All touch targets minimum 48px height.

TOP — My Library:
- Horizontal scroll row of book cards (up to 3 slots)
- Each card: cover image, title, status badge, days remaining
- Status badges: Generating (pulsing cyan dot), Active (green),
  Expired (red overlay)
- Generating: show progress bar updated via Firestore real-time
  listener on generationProgress field
  Message: "Preparing your course... X%"
- Active: tap card to load that course in main content area
- Selected book card: gradient border
- Expired: "Expired" overlay, delete icon
- If activeBookCount < 3 (free) or unlimited (paid):
  show "+ New Book" card at end of row → navigates to /search

Trial banner (if trialStatus === 'active'):
- "Your trial ends in X days — your book disappears with it."
- "Upgrade Now" button
- Amber at 3 days, red at 1 day
- See trial document for full banner states

MAIN CONTENT — Three tabs pinned to bottom of screen:
Tab 1: Course (book icon) — default active
Tab 2: Chat (message icon)
Tab 3: Flashcards (cards icon)

TAB 1 — 7-Day Course:
Header: cover + title + author + reading level badge + expiry countdown
"X days remaining" — amber under 3 days, red at 1 day

7 Day cards (vertical list, each expands in place on tap):
- Shows: day number, lesson title, estimated read time
- Day 1: always unlocked
- Days 2-7: locked until previous day completed
  Locked state: lock icon + "Complete Day X to unlock"
- Expanded lesson: full content in reading font (Lora or Georgia),
  18px, line-height 1.8
- "Mark Day Complete" button at bottom of expanded lesson
  Gradient, full width, min-height 48px
- Completed days: green checkmark, cannot collapse back
- Completed day unlocks the next day immediately

TAB 2 and TAB 3: Placeholder "Coming soon" for now.

Top right: user avatar or initials — tap opens menu with Sign Out.
```

### Acceptance Criteria — Phase 5
- Dashboard loads real Firestore data for logged-in user
- Real-time progress bar updates during course generation
- Day 1 lesson renders with correct reading typography
- Marking Day 1 complete immediately unlocks Day 2
- 768px viewport (Kindle) has no horizontal overflow

---

## PHASE 6: AI CHAT AND FLASHCARDS
**Antigravity LLM: Gemini 2.5 Pro**
**MCP: Firebase connected**

### Prompt 6A — AI Chat
```
Build the AI Chat tab for Bookworm.AI. Replaces Tab 2 placeholder.

BACKEND — /api/chat (POST):
- Accepts: { userId, bookId, message, history (last 10 messages) }
- Fetch book document from Firestore to get: title, author,
  readingLevel, conceptSummary
- Call Gemini 2.5 Flash (model: gemini-2.5-flash)
  System instruction:
    You are the living knowledge of "{title}" by {author}.
    You are not the author — you are the book's distilled wisdom.
    Reading level: {readingLevel}. Match your depth and
    vocabulary to this level.
    Core concepts: {conceptSummary}
    Rules: Every answer connects to the book's principles.
    No generic advice. Reference concepts when relevant.
    Max 200 words unless user asks for depth.
- Include history as conversation turns (last 10 messages)
- Save user message and AI response to Firestore:
  users/{userId}/books/{bookId}/chat
- If message count in active doc exceeds 10, archive oldest
- Return AI response text

FRONTEND — Chat UI (full height of tab area):
Message area (scrollable):
- User messages: right-aligned, gradient background, white text
- AI messages: left-aligned, dark surface #1a1a1a, white text
- Timestamp below each bubble
- Auto-scroll to latest message

Empty state (no messages yet):
- Four starter prompt chips (tap-to-send):
  "What is the core message of this book?"
  "How can I apply this to my life starting today?"
  "Explain the most important principle in simple terms"
  "Summarize what I have learned so far"

Input bar (sticky bottom, above keyboard on mobile):
- Text input field (flexible width) + Send button (gradient icon)
- Typing indicator (3-dot animation) while waiting for response
- Disable input while response is loading

Show toast notification on API error.
```

### Prompt 6B — Flashcards
```
Build the Flashcard tab for Bookworm.AI. Replaces Tab 3 placeholder.

BACKEND — /api/flashcards/generate (POST):
- Accepts: { userId, bookId }
- Check Firestore: if flashcardsGenerated == true on book doc,
  fetch existing cards from users/{userId}/books/{bookId}/flashcards
  and return them. Never regenerate.
- If not generated: call Gemini 2.5 Flash-Lite
  (model: gemini-2.5-flash-lite)
  Fetch book's conceptSummary from Firestore.
  Prompt: Generate exactly 20 flashcards for "{title}" by {author}.
  Reading level: {readingLevel}.
  Use this concept summary as your knowledge base: {conceptSummary}
  Distribution: 10 definition, 5 application, 5 reflection.
  Front: max 15 words. Back: max 60 words. No duplicates.
  Output valid JSON only:
  { flashcards: [{ front, back, type }] }
- Write all 20 cards to Firestore
- Update book doc: flashcardsGenerated: true
- Return all cards

FRONTEND — Flashcard UI:
Top bar:
- "X mastered" counter on left
- Filter pills: All / Definition / Application / Reflection
- Shuffle and Reset icon buttons on right

Card area (55% of viewport height):
- Single large card centered
- Front: question or term, centered, Lora font, 22px
- Back: answer, same card flipped, 18px, 1.6 line-height
- Flip: CSS rotateY(180deg), 400ms ease, perspective 1000px
- Tap anywhere on card to flip
- Swipe right = "Got It" (mastered)
- Swipe left = "Review Again"

Below card:
- Progress: "Card 7 of 20" centered
- "Review Again" button (outlined) and "Got It ✓" (gradient)
- Both min-height 48px

Completion state: all cards mastered — celebration screen with
stats and "Shuffle and Replay" button.

Persist card status to Firestore after every interaction.
Never lose progress on refresh.
```

### Acceptance Criteria — Phase 6
- Chat sends a message and receives a response grounded in the book
- Chat history persists on refresh
- Flashcards generate once, second load reads from Firestore cache
- Flashcard flip animation smooth on Kindle Fire viewport
- Swipe and button interactions both work
- Mastered card count persists on refresh

---

## PHASE 7: AUTO-DELETE AND STRIPE
**Antigravity LLM: Gemini 2.5 Pro**
**Connect Stripe MCP now**

### Prompt 7A — Auto-Delete
```
Build two Firebase Cloud Functions for course expiry.

Function 1: markExpiredCourses
Trigger: Cloud Scheduler 0 2 * * * (2:00 AM UTC daily)
- Query all users
- For each user: find books where status == 'active'
  and expiresAt <= now
- Batch update those books: status: 'expired'
- Log count

Function 2: deleteExpiredCourseData
Trigger: Cloud Scheduler 0 3 * * * (3:00 AM UTC daily)
- Query all users
- For each user: find books where status == 'expired'
  and expiresAt <= (now minus 24 hours)
- For each expired book:
  - Delete all documents in subcollections: lessons, flashcards, chat
  - Delete the book document itself
  - Decrement user activeBookCount with FieldValue.increment(-1)
- Log count

Use batched writes for efficiency.
Full error handling and logging on all operations.
```

### Prompt 7B — Trial and Stripe
```
Build the complete payment and trial system for Bookworm.AI.
Stripe MCP is now connected.

1. /trial page — see trial document for full UI spec
   Call /api/stripe/create-trial-checkout on tap

2. /api/stripe/create-trial-checkout (POST):
   - Accepts: { userId, email }
   - Create Stripe Checkout Session:
     mode: subscription
     customer_email: email
     line_items: [{ price: STRIPE_MONTHLY_PRICE_ID, quantity: 1 }]
     subscription_data: { trial_period_days: 7, metadata: { userId } }
     metadata: { userId }
     success_url: /dashboard?trial=started
     cancel_url: /trial?cancelled=true
   - Return { url }

3. /api/stripe/webhook (POST):
   - Verify Stripe signature
   - Handle checkout.session.completed:
     Update Firestore user: trialStatus: 'active', trialStartedAt,
     trialEndsAt (+ 7 days), stripeCustomerId, plan: 'free'
   - Handle customer.subscription_trial_will_end:
     Update user: showTrialEndWarning: true
   - Handle customer.subscription.updated (trial converts):
     Update user: plan: 'paid', trialStatus: 'converted'
   - Handle customer.subscription.deleted:
     Update user: plan: 'free', trialStatus: 'cancelled' or 'expired'

4. Route protection (update middleware.ts):
   New user with no trialStatus → /trial
   Cancelled/expired trial with no paid plan → /trial
   Active trial or paid plan → /dashboard
   Unauthenticated → /auth

5. Trial countdown banner on /dashboard:
   Show when trialStatus === 'active'
   "Your trial ends in X days — your book disappears with it."
   Amber at 3 days, red at 1 day
   "Upgrade Now" button → /api/stripe/create-checkout
```

### Acceptance Criteria — Phase 7
- markExpiredCourses marks correct books as expired
- deleteExpiredCourseData purges all subcollection data
- Stripe Checkout opens in test mode and completes
- Firestore user plan updates to 'paid' after test payment
- New user is routed to /trial before /dashboard
- Countdown banner appears correctly for active trial users

---

## PHASE 8: PRODUCTION POLISH
**Antigravity LLM: Gemini 2.5 Flash**
**MCP: Firebase and Stripe both connected**

### Prompt 8 — Polish and Deploy
```
Final production polish for Bookworm.AI before deployment.

1. Loading states on every async operation:
   - Skeleton cards on dashboard while Firestore loads
   - Spinner inside all form submit buttons
   - Skeleton in lesson content area while expanding

2. Error boundaries around all major sections:
   - Fallback UI — never a blank white screen

3. Empty states:
   - New user no books: illustration + "Start your first course"
   - Chat no messages: starter prompt chips
   - Flashcards not generated: "Generate Flashcards" button

4. Toast notifications (use react-hot-toast):
   - Course added to queue
   - Day marked complete
   - Flashcard session complete
   - Upgrade successful
   - Any error condition

5. PWA manifest.json:
   name: Bookworm.AI
   short_name: Bookworm
   background_color: #0a0a0a
   theme_color: #0a0a0a
   display: standalone
   icons: 192x192 and 512x512

6. Meta tags in layout.tsx:
   viewport: width=device-width, initial-scale=1
   theme-color: #0a0a0a
   Open Graph: title, description, image

7. Performance:
   - Lazy load Chat and Flashcard tabs (load on first tap)
   - next/image for all book covers with width and height
   - Firestore offline persistence for dashboard

8. Deploy:
   Push to GitHub (Godz-iAgency/v0-bookworm-ai)
   Add all env vars to Vercel project settings
   Run: npx vercel --prod
   Test on Kindle Fire
   Verify Cloud Functions running in Firebase console
```

---

## PHASE SUMMARY TABLE

| Phase | What Gets Built | LLM | MCP |
|---|---|---|---|
| 0 | Firebase + Gemini setup outside Antigravity | N/A | None |
| 1 | Firebase config, Auth context, Login UI | 2.5 Pro | None |
| 2 | MCP connection | N/A | Connect Firebase |
| 3 | Book search API + confirmation UI | 2.5 Pro | Firebase |
| 4 | Reading level screen + Course generation Cloud Function | 2.5 Pro | Firebase |
| 5 | Dashboard + 7-day course viewer | 2.5 Pro | Firebase |
| 6 | AI chat + Flashcards | 2.5 Pro | Firebase |
| 7 | Auto-delete + Trial + Stripe | 2.5 Pro | Firebase + Connect Stripe |
| 8 | Polish, PWA, deploy | 2.5 Flash | Firebase + Stripe |
# BOOKWORM.AI — FIREBASE AND STRIPE SETUP
**Version 2.0 | Updated by Claude Sonnet 4.6**
**Note: This document was previously titled "Supabase Stripe Setup."
Supabase has been replaced by Firebase. Full reasoning below.**

---

## PART A: BACKEND DECISION — WHY FIREBASE OVER SUPABASE

### The Decision

Firebase is the confirmed backend for Bookworm.AI. Supabase is not used.

### Reasoning

1. **Google Ecosystem Alignment**
   Antigravity, Gemini, Firebase Auth, and Google Sign-In are all under the Google cloud umbrella. Service-to-service calls are more stable within the same ecosystem. This matters for developer velocity — fewer auth tokens to manage, fewer cross-service configurations.

2. **Auth is First-Class in Firebase**
   Firebase Auth ships Google Sign-In, Email/Password, and Magic Link natively. One SDK. Zero custom configuration. For a Kindle/mobile-first audience, Google's one-tap sign-in is a significant UX advantage.

3. **Firestore Matches the Data Model**
   Bookworm's data hierarchy is document-based: users → books → lessons → flashcards → chat sessions. Firestore subcollections map directly to this. PostgreSQL (Supabase) would require joins and relational queries that add complexity with no benefit.

4. **Cloud Functions + Cloud Scheduler = Native Cron**
   The 7-day auto-delete system requires scheduled jobs. Firebase Cloud Functions with Cloud Scheduler run this natively. Supabase would require a third-party cron service.

5. **Free Tier Handles 5,000 Users**
   Firebase Spark (free) plan: 50K auth users, 1GB Firestore storage, 50K reads/day, 20K writes/day. At 5,000 registered users with 10% DAU, estimated daily usage is ~3,000 reads and ~900 writes — well within limits.

### When Supabase Would Be Better
Supabase would be the right choice if the data model were highly relational with complex joins, or if you needed advanced row-level security with custom SQL policies. Neither applies to Bookworm.AI.

---

## PART B: FIREBASE COMPLETE SETUP

### B.1 Firebase Project Configuration

```typescript
// lib/firebase/config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Prevent duplicate initialization in Next.js hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
```

### B.2 Firebase Auth Configuration

```typescript
// lib/firebase/auth.ts
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

const googleProvider = new GoogleAuthProvider();

// Detect Kindle and mobile — use redirect (more reliable than popup)
const isMobileOrKindle = () =>
  /iPhone|iPad|iPod|Android|Kindle|Silk/i.test(navigator.userAgent);

export const signInWithGoogle = () =>
  isMobileOrKindle()
    ? signInWithRedirect(auth, googleProvider)
    : signInWithPopup(auth, googleProvider);

// Call this on /auth page load to handle redirect result
export const handleGoogleRedirectResult = () => getRedirectResult(auth);

export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);

export const signOut = () => firebaseSignOut(auth);

// Create user document in Firestore on first login
export const ensureUserDocument = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      authProvider: user.providerData[0]?.providerId === 'google.com'
        ? 'google' : 'email',
      createdAt: serverTimestamp(),
      plan: 'free',
      activeBookCount: 0
      // trialStatus not set here — set by Stripe webhook after card collected
    });
  }
};
```

### B.3 Auth Context

```typescript
// context/AuthContext.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { ensureUserDocument } from '@/lib/firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await ensureUserDocument(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### B.4 Firestore Offline Persistence (Kindle Support)

Kindle users may have intermittent connections. Enable offline persistence so the dashboard loads from cache:

```typescript
// lib/firebase/config.ts — add after db initialization
import { enableIndexedDbPersistence } from 'firebase/firestore';

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open — persistence only works in one tab at a time
      console.warn('Firestore persistence unavailable: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // Browser does not support persistence (rare)
      console.warn('Firestore persistence not supported in this browser');
    }
  });
}
```

---

## PART C: STRIPE COMPLETE SETUP

### C.1 When to Set Up Stripe

Set up Stripe in Phase 7 of the build sequence — after the core product (auth, course generation, chat, flashcards, auto-delete) is fully working. Build what users pay for first.

### C.2 Stripe Dashboard Setup

1. Create account at stripe.com
2. Create a Product: "Bookworm.AI Monthly"
3. Create a Price: $9.99/month, recurring
4. Copy the Price ID (starts with `price_`) → STRIPE_MONTHLY_PRICE_ID
5. Developers → API keys → Copy Secret Key and Publishable Key
6. Developers → Webhooks → Add endpoint:
   URL: `https://bookworm-ai-six.vercel.app/api/stripe/webhook`
   Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription_trial_will_end`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Copy Webhook Signing Secret → STRIPE_WEBHOOK_SECRET

### C.3 Stripe Installation

```bash
npm install stripe @stripe/stripe-js
```

### C.4 Stripe Client Configuration

```typescript
// lib/stripe/config.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20'
});
```

### C.5 Trial Checkout Route

```typescript
// app/api/stripe/create-trial-checkout/route.ts
import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/config';

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price: process.env.STRIPE_MONTHLY_PRICE_ID!,
        quantity: 1
      }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId }
      },
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?trial=started`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/trial?cancelled=true`
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Stripe trial checkout error:', error);
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
```

### C.6 Standard Upgrade Checkout Route (for existing trial users upgrading early)

```typescript
// app/api/stripe/create-checkout/route.ts
export async function POST(req: NextRequest) {
  try {
    const { userId, email, stripeCustomerId } = await req.json();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId || undefined,
      customer_email: stripeCustomerId ? undefined : email,
      line_items: [{
        price: process.env.STRIPE_MONTHLY_PRICE_ID!,
        quantity: 1
      }],
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
```

### C.7 Webhook Handler — Complete

```typescript
// app/api/stripe/webhook/route.ts
import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { db } from '@/lib/firebase/config';
import {
  doc, updateDoc, collection, query,
  where, getDocs, serverTimestamp, Timestamp
} from 'firebase/firestore';

// Helper: find user by Stripe customer ID
async function getUserByStripeId(stripeCustomerId: string) {
  const q = query(
    collection(db, 'users'),
    where('stripeCustomerId', '==', stripeCustomerId)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      if (!userId) break;

      await updateDoc(doc(db, 'users', userId), {
        trialStatus: 'active',
        trialStartedAt: serverTimestamp(),
        trialEndsAt: Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ),
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        plan: 'free'
      });
      break;
    }

    case 'customer.subscription_trial_will_end': {
      const sub = event.data.object as any;
      const user = await getUserByStripeId(sub.customer);
      if (user) await updateDoc(user.ref, { showTrialEndWarning: true });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      // Trial has converted to active paid subscription
      if (sub.status === 'active' && sub.trial_end) {
        const user = await getUserByStripeId(sub.customer);
        if (user) {
          await updateDoc(user.ref, {
            plan: 'paid',
            trialStatus: 'converted'
          });
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any;
      const user = await getUserByStripeId(sub.customer);
      if (user) {
        const wasTrial = user.data()?.trialStatus === 'active';
        await updateDoc(user.ref, {
          plan: 'free',
          trialStatus: wasTrial ? 'cancelled' : 'expired'
        });
      }
      break;
    }
  }

  return new Response('ok', { status: 200 });
}
```

---

## PART D: ENVIRONMENT VARIABLES — COMPLETE LIST

```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini
GEMINI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://bookworm-ai-six.vercel.app
```

Add all of these to:
1. Your local `.env.local` file
2. Vercel project settings → Environment Variables (before deployment)
3. Firebase Cloud Functions environment config (for the auto-delete functions)

---

## PART E: FIREBASE FREE TIER LIMITS REFERENCE

| Resource | Free (Spark) Limit | Estimated Usage at 5K Users |
|---|---|---|
| Auth users | 50,000 | ~5,000 |
| Firestore reads | 50,000/day | ~3,000/day |
| Firestore writes | 20,000/day | ~900/day |
| Firestore storage | 1 GB | ~200 MB |
| Cloud Functions invocations | 125,000/month | ~15,000/month |
| Cloud Scheduler jobs | 3 free | 2 used |

Safe headroom exists at 5,000 users. Upgrade to Firebase Blaze (pay-as-you-go) when approaching limits. At that scale, daily Firestore costs are approximately $3-5/day — covered by subscription revenue long before you hit the limit.
# BOOKWORM.AI — TECH INTEGRATION
**Version 2.0 | Updated by Claude Sonnet 4.6**

---

## OVERVIEW

This document covers the technical integration layer — how every service connects to every other service, the three-model Gemini architecture with full API route implementations, the Gemini model configuration, and the rate limit management strategy that keeps the app running on the free tier at 5,000 users.

---

## PART A: THREE-MODEL GEMINI ARCHITECTURE

### A.1 The Model Map

Three models. Three jobs. Never swap them outside the defined roles.

| Model | Job | Frequency | Free RPD |
|---|---|---|---|
| Gemini 2.5 Pro | 5-concept compression + all 7 lessons | Once per book (queued) | 100 |
| Gemini 2.5 Flash | AI chat responses | Per message | 250 |
| Gemini 2.5 Flash-Lite | Book search, flashcards, validation | Per search + once per book | 1,000 |

### A.2 Model Configuration File

```typescript
// lib/gemini/config.ts
export const GEMINI_MODELS = {
  // Course generation and 5-concept compression
  // Upgrade path: swap to 'gemini-3.1-pro-preview' when income starts
  PRO: 'gemini-2.5-pro',

  // AI chat window — real-time conversation
  FLASH: 'gemini-2.5-flash',

  // Book search, flashcards, content validation — high volume
  FLASH_LITE: 'gemini-2.5-flash-lite'
} as const;

// Gemini client — shared instance
import { GoogleGenerativeAI } from '@google/generative-ai';
export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
```

### A.3 Rate Limit Safety Rules

**Pro (100 RPD, 5 RPM):**
- Never call Pro for chat, flashcards, search, or validation
- Course generation uses a queue — one job every 15 seconds max (4/min, safely under 5 RPM)
- 13-second wait between each lesson call within a job
- If Pro returns 429: increment retryCount, put job back to pending

**Flash (250 RPD, 10 RPM):**
- Chat only — never call Flash for bulk operations
- Context window managed: last 10 messages only
- If Flash returns 429: return a graceful error to user: "Response delayed — please try again in a moment"

**Flash-Lite (1,000 RPD, 15 RPM):**
- Book search: one call per search attempt
- Flashcards: one call per book (20 cards in one call, never 20 separate calls)
- Content validation: one call per lesson (7 per book)
- If Flash-Lite returns 429: retry after 5 seconds (well within recovery time at 15 RPM)

---

## PART B: ALL API ROUTES

### B.1 Book Search

```typescript
// app/api/books/search/route.ts
import { NextRequest } from 'next/server';
import { genAI, GEMINI_MODELS } from '@/lib/gemini/config';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return Response.json({ error: 'Search query required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH_LITE });

    const prompt = `
A user searched for a book with this query: "${query}"

Return the best matching book. Output valid JSON only. No markdown. No preamble.

{
  "found": true,
  "title": "exact book title",
  "author": "full author name",
  "year": 1990,
  "description": "one sentence describing what this book is about",
  "coverSearchQuery": "title author book cover"
}

If no clear match exists, return exactly: { "found": false }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    const bookData = JSON.parse(text);

    if (!bookData.found) {
      return Response.json({ found: false });
    }

    // Fetch cover from Google Books API
    const booksResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        `${bookData.title} ${bookData.author}`
      )}&maxResults=1`
    );
    const booksData = await booksResponse.json();
    const coverUrl = booksData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      ?.replace('http://', 'https://')
      || null;

    return Response.json({ ...bookData, coverUrl });

  } catch (error) {
    console.error('Book search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

### B.2 Chat

```typescript
// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import { genAI, GEMINI_MODELS } from '@/lib/gemini/config';
import { db } from '@/lib/firebase/config';
import {
  doc, getDoc, collection, addDoc,
  query, orderBy, limit, getDocs, serverTimestamp
} from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, bookId, message } = await req.json();

    // Fetch book data and concept summary
    const bookSnap = await getDoc(doc(db, 'users', userId, 'books', bookId));
    if (!bookSnap.exists()) {
      return Response.json({ error: 'Book not found' }, { status: 404 });
    }
    const book = bookSnap.data();

    // Fetch last 10 messages for context
    const messagesQuery = query(
      collection(db, 'users', userId, 'books', bookId, 'chat'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const messagesSnap = await getDocs(messagesQuery);
    const history = messagesSnap.docs
      .reverse()
      .map(d => d.data());

    // Build model with system instruction
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODELS.FLASH,
      systemInstruction: `
You are the living knowledge of the book "${book.title}" by ${book.author}.
You are not the author — you ARE the book's distilled wisdom.
Reading level of this user: ${book.readingLevel}.
Calibrate your vocabulary, depth, and examples to this level.

Core concepts:
${JSON.stringify(book.conceptSummary, null, 2)}

Rules:
1. Every answer connects back to the book's principles. No generic advice.
2. Reference which concept you are drawing from when relevant.
3. Keep responses focused and actionable. No filler.
4. If asked about something outside the book's scope:
   "The book's perspective on this would be..."
5. Maximum 200 words unless user explicitly asks for more depth.
      `
    });

    // Build conversation history for API
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    // Save both messages to Firestore
    const chatRef = collection(db, 'users', userId, 'books', bookId, 'chat');
    await addDoc(chatRef, {
      role: 'user',
      content: message,
      createdAt: serverTimestamp()
    });
    await addDoc(chatRef, {
      role: 'assistant',
      content: aiResponse,
      createdAt: serverTimestamp()
    });

    return Response.json({ response: aiResponse });

  } catch (error) {
    console.error('Chat error:', error);
    return Response.json({ error: 'Chat failed' }, { status: 500 });
  }
}
```

### B.3 Flashcard Generation

```typescript
// app/api/flashcards/generate/route.ts
import { NextRequest } from 'next/server';
import { genAI, GEMINI_MODELS } from '@/lib/gemini/config';
import { db } from '@/lib/firebase/config';
import {
  doc, getDoc, updateDoc, collection,
  writeBatch, getDocs
} from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, bookId } = await req.json();

    const bookRef = doc(db, 'users', userId, 'books', bookId);
    const bookSnap = await getDoc(bookRef);
    if (!bookSnap.exists()) {
      return Response.json({ error: 'Book not found' }, { status: 404 });
    }
    const book = bookSnap.data();

    // Return cached flashcards if already generated
    if (book.flashcardsGenerated) {
      const cardsSnap = await getDocs(
        collection(db, 'users', userId, 'books', bookId, 'flashcards')
      );
      return Response.json({
        flashcards: cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    }

    // Generate with Flash-Lite — all 20 cards in one call
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH_LITE });

    const prompt = `
Generate exactly 20 flashcards for the book "${book.title}" by ${book.author}.
Reading level: ${book.readingLevel}

Core concepts (knowledge base):
${JSON.stringify(book.conceptSummary, null, 2)}

Card distribution:
- 10 definition cards: key term on front, clear definition on back
- 5 application cards: real-world scenario on front, book's approach on back
- 5 reflection cards: open question on front, book's framework answer on back

Rules:
- Front: maximum 15 words
- Back: maximum 60 words
- No duplicate cards
- Language calibrated to ${book.readingLevel}
- Every card grounded in the book's actual content

Output valid JSON only. No markdown. No preamble.

{
  "flashcards": [
    {
      "front": "string",
      "back": "string",
      "type": "definition" | "application" | "reflection"
    }
  ]
}
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    const { flashcards } = JSON.parse(text);

    // Batch write all 20 cards to Firestore
    const batch = writeBatch(db);
    const cardsRef = collection(db, 'users', userId, 'books', bookId, 'flashcards');

    flashcards.forEach((card: any) => {
      const cardDoc = doc(cardsRef);
      batch.set(cardDoc, {
        front: card.front,
        back: card.back,
        type: card.type,
        status: 'unseen',
        reviewCount: 0
      });
    });

    // Mark flashcards as generated on book doc
    batch.update(bookRef, { flashcardsGenerated: true });
    await batch.commit();

    const cardsSnap = await getDocs(cardsRef);
    return Response.json({
      flashcards: cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    });

  } catch (error) {
    console.error('Flashcard generation error:', error);
    return Response.json({ error: 'Flashcard generation failed' }, { status: 500 });
  }
}
```

### B.4 Flashcard Status Update

```typescript
// app/api/flashcards/update/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, increment } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, bookId, cardId, status } = await req.json();

    await updateDoc(
      doc(db, 'users', userId, 'books', bookId, 'flashcards', cardId),
      {
        status,
        reviewCount: increment(1),
        lastReviewedAt: new Date()
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Update failed' }, { status: 500 });
  }
}
```

---

## PART C: SERVICE INTEGRATION MAP

```
User action
  ↓
Next.js frontend (Vercel)
  ↓
Firebase Auth — verifies session on every protected route
  ↓
API Route (Next.js App Router)
  ↓
Firestore — reads book data and concept summary
  ↓
Gemini API — appropriate model for the operation
  ↓
Firestore — writes result
  ↓
Frontend — real-time listener updates UI via onSnapshot
```

**Course generation is asynchronous — different path:**

```
User confirms book → Firestore write (queued status)
  ↓
Cloud Scheduler fires every 2 minutes
  ↓
Cloud Function reads generation_queue
  ↓
Gemini 2.5 Pro called (concept compression, then 7 lessons)
  ↓
Each lesson written to Firestore immediately
  ↓
generationProgress updated on book document
  ↓
Frontend onSnapshot listener updates progress bar in real-time
  ↓
All 7 lessons complete → status: 'active' → course unlocked
```

---

## PART D: GEMINI PACKAGE INSTALLATION

```bash
npm install @google/generative-ai
```

No additional configuration required. One API key handles all three models.

---

## PART E: RATE LIMIT ERROR HANDLING

```typescript
// lib/gemini/withRetry.ts
// Wraps any Gemini call with retry logic for 429 rate limit errors

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 5000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 ||
        error?.message?.includes('429') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < maxRetries - 1) {
        // Exponential backoff: 5s, 10s, 20s
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

Usage in any Gemini call:

```typescript
const result = await withRetry(() => model.generateContent(prompt));
```

---

## PART F: VERCEL DEPLOYMENT CONFIGURATION

```json
// vercel.json
{
  "functions": {
    "app/api/chat/route.ts": {
      "maxDuration": 30
    },
    "app/api/books/search/route.ts": {
      "maxDuration": 15
    },
    "app/api/flashcards/generate/route.ts": {
      "maxDuration": 30
    }
  }
}
```

The chat and flashcard routes need extended timeouts because Gemini responses can take 5-10 seconds under load. Default Vercel timeout (10s) is too short for Flash and Flash-Lite on complex prompts.

---

## PART G: NEXT.JS MIDDLEWARE — ROUTE PROTECTION

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('firebase-auth-token');
  const trialStatus = req.cookies.get('trial-status');

  const protectedPaths = ['/dashboard', '/search', '/reading-level'];
  const isProtected = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  // New user — no trial status
  if (!trialStatus) {
    return NextResponse.redirect(new URL('/trial', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/search/:path*', '/reading-level/:path*']
};
```

Note: Full server-side token verification requires Firebase Admin SDK in a Server Action or API route. The middleware provides a first layer of redirect logic. The full verification happens inside each protected page or API route.
# BOOKWORM.AI — 7-DAY AUTO DELETE SPEC
**Version 2.0 | Updated by Claude Sonnet 4.6**

---

## PURPOSE

The 7-day expiry and auto-delete system is not a technical constraint — it is a core product feature. The disappearing book is the identity of Bookworm.AI. Users know from day one that the clock is ticking. This urgency drives daily engagement, reduces passive accumulation of unread courses, and reinforces the product's core premise: active learning in a defined window.

This document specifies the full deletion architecture — how courses expire, how data is purged, how the user is notified, and what happens at each stage.

---

## EXPIRY RULES

| Plan | Course Expiry |
|---|---|
| Free trial | 7 days from course creation |
| Free plan (post-trial) | 7 days from course creation |
| Paid plan ($9.99/month) | 30 days from course creation |

The `expiresAt` timestamp is set when the book document is created in Firestore — not when the course finishes generating. A user who queues a book and waits 4 hours for generation still has the same 7-day expiry from the moment they hit "Generate My Course."

---

## TWO-STAGE DELETION ARCHITECTURE

Deletion happens in two stages to give users a grace window between seeing their course expired and losing the data permanently.

### Stage 1: Mark Expired (2:00 AM UTC daily)
Books that have passed their `expiresAt` timestamp are marked `status: 'expired'`.
The data is still in Firestore. The user can see the expired state on their dashboard.

### Stage 2: Permanent Delete (3:00 AM UTC daily)
Books that were marked `expired` at least 24 hours ago are permanently deleted.
All subcollection data (lessons, flashcards, chat history) is purged.
The book document itself is deleted.
The user's `activeBookCount` is decremented.

This 24-hour gap means a user who checks their dashboard and sees "Expired" still has one day before their data is gone.

---

## CLOUD FUNCTION 1: markExpiredCourses

```typescript
// functions/src/markExpiredCourses.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const markExpiredCourses = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const usersSnap = await db.collection('users').get();

    let totalExpired = 0;
    const batch = db.batch();

    for (const userDoc of usersSnap.docs) {
      const booksRef = userDoc.ref.collection('books');

      const expiredBooks = await booksRef
        .where('status', '==', 'active')
        .where('expiresAt', '<=', now)
        .get();

      for (const bookDoc of expiredBooks.docs) {
        batch.update(bookDoc.ref, {
          status: 'expired',
          expiredAt: now
        });
        totalExpired++;
      }
    }

    await batch.commit();
    console.log(`markExpiredCourses: marked ${totalExpired} courses as expired`);
  });
```

---

## CLOUD FUNCTION 2: deleteExpiredCourseData

```typescript
// functions/src/deleteExpiredCourseData.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const deleteExpiredCourseData = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    // Delete books that expired more than 24 hours ago
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const usersSnap = await db.collection('users').get();
    let totalDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      const booksRef = userDoc.ref.collection('books');

      const booksToDelete = await booksRef
        .where('status', '==', 'expired')
        .where('expiredAt', '<=', cutoff)
        .get();

      for (const bookDoc of booksToDelete.docs) {
        // Delete all subcollections first
        await deleteSubcollections(bookDoc.ref);

        // Delete the book document itself
        await bookDoc.ref.delete();

        // Decrement user's active book count
        await userDoc.ref.update({
          activeBookCount: admin.firestore.FieldValue.increment(-1)
        });

        totalDeleted++;
      }
    }

    console.log(`deleteExpiredCourseData: permanently deleted ${totalDeleted} courses`);
  });

// Helper: delete all documents in all subcollections of a book
async function deleteSubcollections(bookRef: admin.firestore.DocumentReference) {
  const subcollections = ['lessons', 'flashcards', 'chat'];

  for (const subcollectionName of subcollections) {
    const subSnap = await bookRef.collection(subcollectionName).get();

    if (subSnap.empty) continue;

    // Use batched deletes (max 500 per batch)
    const chunks = chunkArray(subSnap.docs, 500);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
    }
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

---

## EXPIRY STATES AND UI BEHAVIOR

### Book Card States on Dashboard

| Status | Card Appearance | User Actions |
|---|---|---|
| queued | "Queued" badge, progress 0% | Cancel |
| generating | Pulsing cyan badge, progress bar | None |
| active | Green badge, days remaining countdown | Open, view, delete |
| expired | Red "Expired" overlay | Delete only |

### Days Remaining Countdown

The countdown is calculated client-side from `expiresAt` and updates in real-time:

```typescript
// hooks/useCountdown.ts
import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';

export function useCountdown(expiresAt: Timestamp) {
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const calculate = () => {
      const now = Date.now();
      const expiry = expiresAt.toMillis();
      const diff = expiry - now;

      if (diff <= 0) {
        setDaysRemaining(0);
        return;
      }

      setDaysRemaining(Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    calculate();
    // Recalculate every hour
    const interval = setInterval(calculate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return daysRemaining;
}
```

### Countdown Display Logic

```typescript
// components/DaysRemainingBadge.tsx
function DaysRemainingBadge({ expiresAt }: { expiresAt: Timestamp }) {
  const days = useCountdown(expiresAt);

  if (days === null) return null;
  if (days === 0) return <span className="badge-red">Expires today</span>;
  if (days === 1) return <span className="badge-red">1 day left</span>;
  if (days <= 3) return <span className="badge-amber">{days} days left</span>;
  return <span className="badge-green">{days} days left</span>;
}
```

---

## LESSON UNLOCK LOGIC

Day cards unlock progressively as the user completes each day. This lock system is separate from the expiry system but works alongside it:

```typescript
// Firestore update when user marks a day complete
async function markDayComplete(
  userId: string,
  bookId: string,
  completedDay: number
) {
  const batch = writeBatch(db);

  // Mark current day as complete
  const currentLesson = doc(
    db, 'users', userId, 'books', bookId, 'lessons', `day${completedDay}`
  );
  batch.update(currentLesson, {
    isCompleted: true,
    completedAt: serverTimestamp()
  });

  // Unlock next day if it exists
  if (completedDay < 7) {
    const nextLesson = doc(
      db, 'users', userId, 'books', bookId, 'lessons', `day${completedDay + 1}`
    );
    batch.update(nextLesson, { isUnlocked: true });
  }

  await batch.commit();
}
```

---

## FIRESTORE SECURITY RULES

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;

      // Books subcollection
      match /books/{bookId} {
        allow read, write: if request.auth != null
          && request.auth.uid == userId;

        // Lessons — read only after book is active
        match /lessons/{lessonId} {
          allow read: if request.auth != null
            && request.auth.uid == userId;
          allow write: if false; // Cloud Functions only
        }

        // Flashcards — user can read and update status
        match /flashcards/{cardId} {
          allow read: if request.auth != null
            && request.auth.uid == userId;
          allow update: if request.auth != null
            && request.auth.uid == userId
            && request.resource.data.keys()
               .hasOnly(['status', 'reviewCount', 'lastReviewedAt']);
        }

        // Chat — user can read and create messages
        match /chat/{messageId} {
          allow read: if request.auth != null
            && request.auth.uid == userId;
          allow create: if request.auth != null
            && request.auth.uid == userId;
        }
      }
    }

    // Generation queue — Cloud Functions only, no client access
    match /generation_queue/{jobId} {
      allow read, write: if false;
    }
  }
}
```

---

## GENERATION QUEUE SCHEMA

The queue is a separate top-level Firestore collection, not under any user document. Only Cloud Functions read and write it.

```typescript
// Firestore: /generation_queue/{jobId}
{
  userId: string,
  bookId: string,
  bookTitle: string,
  author: string,
  readingLevel: 'beginner' | 'intermediate' | 'advanced' | 'deep_dive',
  conceptSummary: object | null,   // null until compression completes
  status: 'pending' | 'processing' | 'complete' | 'failed',
  createdAt: Timestamp,
  startedAt: Timestamp | null,
  completedAt: Timestamp | null,
  retryCount: number               // max 3 before marking failed
}
```

---

## FAILED GENERATION HANDLING

If a course fails to generate after 3 retries:

1. Job status set to `failed` in generation_queue
2. Book document status set to `failed`
3. Dashboard shows a "Generation failed" state on the book card
4. "Try again" button on the card creates a new job in the queue
5. The book slot is NOT freed — the failed book still occupies a slot
   (prevents users from gaming the system to get unlimited free generation attempts)
6. If the user deletes the failed book: slot freed, activeBookCount decremented

---

## DEPLOYMENT CHECKLIST FOR CLOUD FUNCTIONS

Before deploying Cloud Functions:

1. Initialize Firebase Functions in the project:
   ```bash
   cd functions
   npm install firebase-admin firebase-functions
   ```

2. Set up Firebase Admin in Cloud Functions:
   ```typescript
   // functions/src/index.ts
   import * as admin from 'firebase-admin';
   admin.initializeApp();
   ```

3. Export both scheduled functions from index.ts:
   ```typescript
   export { markExpiredCourses } from './markExpiredCourses';
   export { deleteExpiredCourseData } from './deleteExpiredCourseData';
   export { processCourseQueue } from './processCourseQueue';
   ```

4. Deploy functions only:
   ```bash
   firebase deploy --only functions
   ```

5. Verify in Firebase console:
   Functions → See `markExpiredCourses`, `deleteExpiredCourseData`, `processCourseQueue` listed
   Cloud Scheduler → See three scheduled jobs configured

6. Test manually by temporarily setting a book's `expiresAt` to one minute in the past and watching the function run at the next scheduled time.
