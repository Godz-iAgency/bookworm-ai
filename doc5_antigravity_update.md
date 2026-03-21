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
