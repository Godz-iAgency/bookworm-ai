# Bookworm.AI audit — September 10, 2026

Repository: `Godz-iAgency/bookworm-ai`, local branch `main`. This report describes the inspected checkout, not a certification of the deployed site. Priorities: P1 = financial, access, or substantial data-loss risk; P2 = functional defect; P3 = maintenance or performance concern. Each finding identifies its type and disposition. Existing comments and intentional product choices were treated as constraints.

**Result:** seven source files received narrow correctness fixes. No routes or dependencies were deleted. No billing architecture, prompts, visual styling, existing product copy, security rules, or environment files were edited. Newly handled transport failures use the existing error displays. No payments, account deletions, production generations, commits, pushes, or deployments were performed.

## Prioritized findings

### 1. P1 — Public AI endpoints bypass identity, entitlement, and quotas

**Real bug; reported.** Locations: [app/api/course/generate/route.ts:9](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts:9>), [app/api/course/day/route.ts:8](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/day/route.ts:8>), [app/api/course/flashcards/route.ts:15](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/flashcards/route.ts:15>), [app/api/course/axiom/route.ts:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/axiom/route.ts:11>), [app/api/chat/route.ts:6](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/chat/route.ts:6>), [app/api/books/scan/route.ts:38](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/books/scan/route.ts:38>). Legacy generation endpoints have the same exposure.

Anyone can POST directly without a Firebase token and spend the server's AI quota. Neither paid access, monthly generation count, unlocked day, nor the daily chat limit is enforced server-side. Browser-only checks and localStorage counters do not prevent this. Input sizes are also not bounded by application validation; the browser's photo downscaling is bypassable.

**Minimal fix:** authenticate the calling account, validate and bound inputs, and enforce atomic server-side reservations/counters. Resolve course ownership and permitted day from Firestore. The preview-before-payment path, deliberate billing pause, and public search/scan behavior require an explicit access policy before applying gates. Do not simply add a subscription check that breaks first-course previews.

### 2. P1 — Account deletion can leave billing active and data orphaned

**Real bug; reported.** Locations: [app/api/account/delete/route.ts:37](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/account/delete/route.ts:37>), [app/api/account/delete/route.ts:103](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/account/delete/route.ts:103>), [app/delete-account/page.tsx:119](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx:119>).

A Stripe timeout or cancellation failure is logged and ignored, then the account is destroyed. The success page promises no further charges, but Stripe may still renew a subscription whose Firebase association is now gone. Likewise, a failed profile deletion is swallowed before deleting Auth. The comments explicitly choose continuation on cancellation failure, so changing that policy is outside an unambiguous cleanup.

**Minimal fix:** confirm cancellation or a verified already-cancelled/missing subscription before destroying account identity; retain a resumable deletion record on uncertain failures. Require profile deletion success. Coordinate concurrent course writes during deletion and clean up retained family membership identifiers consistently. Specify which billing records must remain; do not blindly delete financial history.

### 3. P1 — Subscription creation is not actually idempotent

**Real bug; reported.** Locations: [app/api/stripe/activate-trial/route.ts:38](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/activate-trial/route.ts:38>), [app/api/stripe/activate-trial/route.ts:50](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/activate-trial/route.ts:50>), [app/api/stripe/create-setup-intent/route.ts:26](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/create-setup-intent/route.ts:26>), [app/api/stripe/upgrade/route.ts:65](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:65>).

Two requests can both read an empty subscription/customer ID and both create one. A Stripe success followed by a failed Firestore update produces the same problem on retry. The last stored subscription wins while the other remains billable. A read-before-create guard only prevents sequential retries after persistence succeeds.

**Minimal fix:** durable per-account operation identity, Stripe idempotency keys, and reconciliation before retrying uncertain creation. A constant key forever is unsuitable for legitimate later subscriptions. [Stripe idempotency documentation](https://docs.stripe.com/api/idempotent_requests).

### 4. P1 — Webhook replay and out-of-order events corrupt entitlements and counters

**Real bug; reported.** Locations: [app/api/stripe/webhook/route.ts:19](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:19>), [app/api/stripe/webhook/route.ts:109](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:109>), [app/api/stripe/webhook/route.ts:182](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:182>).

Replaying an already-processed successful invoice resets usage to zero again after the reader has generated more books. A delayed deletion event for an older subscription downgrades the user's newer subscription because the handler matches customer ID without checking the currently linked subscription. A delayed update can restore an obsolete plan. All successful invoices, not just the applicable renewal, trigger allowance resets.

**Minimal fix:** transactional event deduplication and subscription/period matching; reconcile current subscription state for order-sensitive events. Reset only the applicable new billing period. Stripe explicitly does not guarantee event ordering and documents duplicate delivery. [Webhook documentation](https://docs.stripe.com/webhooks).

### 5. P1 — Rejoining Book Club makes customer-based family lookup ambiguous

**Real bug; reported.** Locations: [app/api/stripe/webhook/route.ts:14](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:14>), [app/api/stripe/upgrade/route.ts:82](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:82>).

An owner downgrades, then purchases Book Club again. The old cancelled family document remains and a new one is created with the same Stripe customer. `limit(1)` can select the old family for renewals and cancellation, leaving current members' quotas stale or access unrevoked. Updates against a deleted old member can also fail an entire batch.

**Minimal fix:** resolve the active family through the current user's authoritative family/subscription relationship, and update memberships atomically or with recoverable reconciliation. Do not infer the current family from an arbitrary customer match.

### 6. P1 — Existing paid users can reset quota with a same-plan upgrade

**Real bug; reported.** Location: [app/api/stripe/upgrade/route.ts:73](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:73>).

A subscriber POSTs their existing `targetPlan`. The route permits it and resets `generationsThisMonth` to zero despite no new billing period. Repetition defeats the monthly cap even if generation routes later gain authentication. Switching between tiers has the same unconditional reset.

**Minimal fix:** make an unchanged plan a no-op and tie allowance reset to an actual authorized billing period. Define mid-period tier-change allowance policy separately.

### 7. P1 — Paid entitlement is granted without checking initial payment state

**Real bug; reported.** Locations: [app/api/stripe/upgrade/route.ts:65](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:65>), [app/api/stripe/upgrade/route.ts:73](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:73>).

A previously cancelled reader starts a new subscription using a saved card that now requires authentication or cannot pay. Stripe can return an incomplete subscription (the installed SDK documents `allow_incomplete` as the default), but the route immediately writes the paid plan, converted status, and potentially an active Book Club. The result is paid access without confirmed initial payment, distinct from the intentionally supported grace period on an existing subscriber's renewal.

**Minimal fix:** inspect the returned subscription/payment state and establish entitlement only after the appropriate confirmed event; complete any required payment authentication through an agreed UI flow. Preserve the existing renewal grace policy. No payment behavior was changed during this audit.

### 8. P1 — Firestore's monotonic quota rule permits deleting the counter

**Real bug; reported; rules untouched.** Locations: [firestore.rules:48](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules:48>), [firestore.rules:56](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules:56>), [firestore.rules:23](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules:23>), [lib/billing.ts:46](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/billing.ts:46>).

An owner updates their profile with `generationsThisMonth: deleteField()`. The missing-field branch permits it; the client then reads zero. Creation also does not require a nonnegative numeric starting counter. Newer server-maintained fields such as `subscriptionCancelAt`, `paymentFailedAt`, and `paymentFailureCount` are absent from the protected list, allowing falsified billing UI state.

**Minimal fix:** make quota updates server-owned as part of finding 1; require complete valid defaults on create and protect all server-owned billing fields. Verify in an emulator before deploying rules. The owner UID checks otherwise isolate course/profile paths; this is not evidence that a user can read another user's courses.

### 9. P1 — Whole-course autosave overwrites newer data from other tabs/devices

**Real bug; reported.** Locations: [lib/BookwormContext.tsx:157](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:157>), [lib/BookwormContext.tsx:203](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:203>), [lib/BookwormContext.tsx:213](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:213>).

Tabs A and B load the same shelf once. A completes a day; B changes a different course or an active-day marker. B writes every stale course in full, undoing A's completion, commitments, or newly generated lesson. A deleted course can be recreated by another tab. Hydration itself rewrites all loaded courses, enlarging the race window and write volume.

**Minimal fix:** persist changed fields/documents with conflict-aware transactions and subscribe to authoritative updates. A listener alone does not make stale full-document overwrites safe. This requires a persistence change, not merely `merge: true` on the existing array-containing documents.

### 10. P1 — Generation can cross an account switch

**Real bug; reported.** Locations: [lib/useCourseGeneration.ts:49](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:49>), [lib/useCourseGeneration.ts:127](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:127>), [lib/BookwormContext.tsx:126](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:126>), [lib/BookwormContext.tsx:204](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:204>).

Account A starts generation, navigates away and signs into B before the request finishes. The surviving async callback can append A's new course to B's hydrated state; the provider's current-UID persistence guard then accepts it as B's data. That guard protects initial hydration, not late producers. `currentBook` and `currentReadingLevel` also survive sign-out.

**Minimal fix:** bind generation results to an account/session epoch and reject results from departed sessions; clear account-scoped selections on auth change. Apply the same ownership boundary to preview saving and pending content operations. Functional state updates fixed in finding 17 do not solve this separate race.

### 11. P1 — Play billing and Android origin verification are not ready to certify

**Known readiness gap; acknowledged and deferred while the Android build is in progress.** Locations: [app/preview/page.tsx:7](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx:7>), [app/pricing/page.tsx:122](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx:122>), [app/manifest.ts:9](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/manifest.ts:9>); expected missing file: `public/.well-known/assetlinks.json`.

Packaging the current web payment flow exposes Stripe inside the Android app. There is no Play purchase path or evidence here of enrollment and integration for an applicable alternative-billing program. No Digital Asset Links file, Android package ID, or signing certificate configuration was found in this repository. A read-only live check also returned HTTP 404 at [the live asset-links URL](https://bookworm-ai.app/.well-known/assetlinks.json). Without valid association, the TWA cannot establish the intended trusted fullscreen origin.

**Minimal fix:** choose the permitted purchase path for the intended distribution regions and verify the relevant program requirements; publish association data using the actual Play signing certificate. This audit intentionally does not implement future providers. Current policy permits exceptions/programs, so this is not a blanket claim that Stripe is always prohibited. [Google payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [TWA integration guide](https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide).

### 12. P2 — Malformed courses still pass the safety check and crash readers

**Real bug; reported.** Locations: [lib/BookwormContext.tsx:109](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:109>), [app/dashboard/page.tsx:90](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/page.tsx:90>), [components/book-cover.tsx:161](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/book-cover.tsx:161>), [lib/firebase/profile.ts:24](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/profile.ts:24>), [lib/firebase/progress.ts:59](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:59>).

A document with a valid ID/expiry but `days: [null]` passes `isUsableCourse`, then crashes on `d.dayNumber`. A book with a missing/nonstring title can crash the cover fallback's `split`. Object-valued flashcard fronts or chat starters reach React children. Profile/progress readers similarly cast rather than validate; an object-valued badge list breaks `new Set`.

**Minimal fix:** validate nested fields used by consumers, normalize explicitly supported older shapes, and quarantine malformed documents without deleting them. Validate optional fields only when present so old courses remain supported. Preserve Firestore document IDs from snapshots and check embedded ID consistency rather than saving/deleting an unrelated embedded path. Catch synchronous write validation errors as well as rejected writes.

### 13. P2 — Generated response validation is materially weaker than the schema

**Real bug; reported.** Locations: [app/api/course/generate/route.ts:20](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts:20>), [app/api/course/day/route.ts:28](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/day/route.ts:28>), [app/api/course/flashcards/route.ts:31](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/flashcards/route.ts:31>), [lib/generate-course.ts:35](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate-course.ts:35>).

An outline containing seven entries but duplicate/missing day numbers or malformed later entries is accepted. Day validation checks only a nonempty lesson. `[{}]` is accepted as a nonempty deck on the day path; empty/partial study aids may never be repaired because the hooks check array length. Missing chat starters alone never trigger repair. Flashcard repair validates outside the retry loop, so valid JSON with unusable cards consumes only one attempt. Lesson length and closing-action structure are prompt-only.

**Minimal fix:** shared schema validation inside generation retries: seven sequential days, safe strings, three usable cards/starters, and required axiom. Distinguish hard structural failures from editorial length tolerances before enforcing prose constraints. A repair must preserve every existing usable lesson/deck.

### 14. P2 — Two content owners can race while switching tabs

**Real bug; partially fixed.** Locations: [app/dashboard/page.tsx:97](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/page.tsx:97>), [app/dashboard/components/CourseTab.tsx:97](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseTab.tsx:97>), [app/dashboard/components/CourseTab.tsx:141](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseTab.tsx:141>), [lib/useDayContent.ts:47](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDayContent.ts:47>).

Start opening a missing lesson, then switch to Chat/Learn while it is pending. CourseTab's request continues; the dashboard hook starts another request. Previously the CourseTab response overwrote whichever lesson/deck arrived first. `useDayContent` has exactly one caller, but it is not the single generation owner described by the brief.

**Applied minimal fix:** CourseTab now fills gaps against the latest state, preserving existing lesson, deck, starters, and axiom, with safe defaults for missing arrays. **Remaining fix:** consolidate/deduplicate in-flight day requests across the existing opening and repair flows without changing when lessons open. Manual retry also needs in-flight deduplication.

### 15. P2 — A successful but incomplete repair stays “generating” forever

**Real bug; fixed.** Location: [lib/useDayContent.ts:95](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDayContent.ts:95>).

A response containing cards but no requested lesson or axiom was accepted. The attempt key prevented another automatic attempt, but `needsContent` stayed true with no failed key: perpetual generating state.

**Applied minimal fix:** reject missing required lesson/axiom through the existing error/retry state before accepting the result. Regression checks cover missing/blank fields and preservation of content from a competing successful request.

### 16. P2 — Network failures strand billing, join, and deletion controls

**Real bug; fixed for the shared transport path.** Locations: [lib/api-client.ts:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/api-client.ts:11>), [app/delete-account/page.tsx:71](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx:71>), [app/dashboard/components/ProfileTab.tsx:185](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ProfileTab.tsx:185>), [app/pricing/page.tsx:106](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx:106>), [app/join/\[code\]/page.tsx:44](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/join/[code]/page.tsx:44>).

Token refresh rejection, offline fetch, or an HTML gateway response previously threw through callers expecting `{ error }`, leaving busy/deleting/joining states set. A non-2xx JSON object without `error` could also be treated as success.

**Applied minimal fix:** normalize transport and HTTP failures into the already-supported error result, preserve server messages, and do not automatically retry mutating requests. Regression checks cover these cases. Subsequent `getBillingProfile` refreshes in Profile/Pricing still lack their own catch, and TrialBanner discards returned errors; those remaining UX/error decisions are reported rather than redesigned.

### 17. P2 — New-course creation uses stale shelf state; billing reads can reject uncaught

**Real bugs; fixed.** Locations: [lib/useCourseGeneration.ts:64](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:64>), [lib/useCourseGeneration.ts:127](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:127>), [app/preview/page.tsx:140](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx:140>).

While generation is running, another state update changes an existing course or adds a course. Appending to the originally captured `courses` array discards that change in memory and can overwrite saved progress. A rejected billing read occurs before the hook's normal generation-error handling and escapes fire-and-forget callers.

**Applied minimal fix:** append with functional updates in both creation paths; route failed billing reads to the existing generation error display. Duplicate starts and session ownership remain separate reported issues.

### 18. P2 — Direct preview navigation bypasses shelf and generation caps

**Real bug; reported.** Locations: [app/preview/page.tsx:90](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx:90>), [app/preview/page.tsx:157](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx:157>), [lib/useCourseGeneration.ts:92](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:92>).

An already-subscribed user with a selected book opens `/preview` directly. It generates and saves after checking only `hasActiveAccess`, without `canGenerate` or the shelf cap. Normal generation can also be started twice before the asynchronous billing lookup sets the generating flag. Both requests see the same quota.

**Minimal fix:** shared account-scoped in-flight guard plus authoritative server reservations from finding 1; apply the same eligibility checks to every entry path. Do not remove the legitimate preview-before-card experience.

### 19. P2 — Course deletion reports success when Firestore rejects it

**Real bug; reported.** Locations: [lib/BookwormContext.tsx:223](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:223>), [app/dashboard/components/CourseDetail.tsx:26](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseDetail.tsx:26>).

A rejected delete is swallowed; local state removes the course and returns home anyway. Reload brings the supposedly deleted course back. Simply propagating the error would instead strand `removing`, because the component has no catch/finally/error display.

**Minimal fix:** retain local data until a confirmed delete and handle failure/retry in the existing confirmation flow. The visible error treatment needs a UX decision.

### 20. P2 — Progress transactions are not completion-idempotent

**Real bug; reported.** Locations: [lib/firebase/progress.ts:124](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:124>), [lib/firebase/progress.ts:148](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:148>), [lib/firebase/progress.ts:111](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:111>), [app/dashboard/components/CourseTab.tsx:165](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseTab.tsx:165>).

Two devices complete the same final day. Each transaction increments `booksFinished`; neither records or checks the course/day identity. Conversely, course completion can save while the separate progress request fails, leaving a missed streak. A stale backfill writes its badge array and finished count over a newer completion.

**Minimal fix:** an idempotent completion transaction keyed by course/day, with completion and user progress coordinated. Merge backfill against current transactional state using union/max, not stale replacements.

### 21. P2 — Chat quota fails at midnight and when storage is unavailable

**Real bug; reported.** Location: [lib/useChatQuota.ts:35](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useChatQuota.ts:35>).

Keep the same course open across midnight: `used` never reloads because only `courseId` is an effect dependency. Someone at the limit remains blocked; someone below it writes yesterday's count into today's key. Disabled/full localStorage can throw during the effect or state updater and break the dashboard/send action. Other tabs are not synchronized.

**Minimal fix:** model the day boundary explicitly, catch storage failures, and move persistence side effects out of React's updater. Server enforcement remains necessary regardless of this display fix.

### 22. P2 — Billing and profile displays can become stale

**Real bug; reported.** Locations: [app/dashboard/page.tsx:138](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/page.tsx:138>), [app/pricing/page.tsx:90](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx:90>), [lib/ReadingPrefsContext.tsx:56](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ReadingPrefsContext.tsx:56>), [lib/billing.ts:62](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/billing.ts:62>).

End a trial or receive a webhook after the one-time read: the mounted dashboard can keep showing the old plan/trial. `onConverted` can refetch before the webhook commits. Some billing reads lack cancellation and can resolve after an account change. A delayed reading-preference read can overwrite a size the reader just selected. Active-access checks rely on stored plan/status, not expiry, so missed reconciliation can preserve obsolete access.

**Minimal fix:** account-scoped listeners or explicit versioned refresh, protect local preference edits from late reads, and reconcile expired entitlement state server-side. Preserve the documented payment-retry grace policy rather than immediately revoking all past-due users.

### 23. P2 — Curated-book lookup can substitute a different book

**Real bug; reported.** Location: [app/mastery/\[pillar\]/\[book\]/page.tsx:93](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/mastery/[pillar]/[book]/page.tsx:93>).

Google Books returns an approximate first match. `found ?? fallback` adopts that result's title/author, so tapping one curated book can generate a course for another, despite the comment saying the catalog is authoritative and lookup only decorates it. Existing-course matching also compares title without author.

**Minimal fix:** retain catalog identity and accept decoration only from a verified match; match saved courses by title and author. Define edition/title normalization before changing selection behavior.

### 24. P2 — Public deletion entry exists, but fallback sign-in recovery is incomplete

**Real bug/readiness limitation; reported.** Locations: [app/delete-account/page.tsx:37](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx:37>), [context/AuthContext.tsx:57](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/context/AuthContext.tsx:57>), [lib/firebase/auth.ts:58](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/auth.ts:58>).

The page is outside the dashboard and offers sign-in from a cold session, which is the correct structure. However, if Google falls back to redirect and fails, this page never displays `redirectError`. Its support path is conditional on a public environment setting, and it has no password-reset link. A user without a working password/popup may be stranded even though the privacy page separately lists contact information.

**Minimal fix:** consume redirect errors and provide an explicit recovery route consistent with the product's support policy. Authenticate ownership before destructive deletion; “publicly reachable” does not mean unauthenticated deletion. [Google account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en). A read-only cold request to the live deletion page returned HTTP 200, the expected page title, and deletion instructions. Interactive sign-in and a real deletion were not exercised.

### 25. P2 — Keyboard and assistive-technology gaps in the reader and flashcards

**Real accessibility defects; reported.** Locations: [app/dashboard/components/FlashcardTab.tsx:129](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/FlashcardTab.tsx:129>), [app/dashboard/components/LessonReader.tsx:120](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/LessonReader.tsx:120>), [app/dashboard/components/ChatTab.tsx:177](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ChatTab.tsx:177>), [components/auth/modern-animated-sign-in.tsx:427](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/auth/modern-animated-sign-in.tsx:427>), [app/pricing/page.tsx:76](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx:76>).

The study flashcard is a clickable div without keyboard activation. CSS backface hiding does not hide the inactive answer from assistive technology. The phone portal does not transfer/trap/restore focus or provide Escape dismissal; Tab can reach the dashboard behind it. The pricing confirmation similarly needs focus management. Chat's send icon and password visibility control have no explicit accessible names; reader size choices all announce “A”.

**Minimal fix:** semantic keyboard activation, appropriate inactive-face accessibility state, labels, and focus lifecycle for modal surfaces. Preserve the portal, GPU promotion, eager 3D artwork, and Motion-based flips. These are interaction changes and were not silently applied. Contrast was inspected in source only, not certified through rendered measurements.

### 26. P2 — Chat error copy and trial notices do not match actual recovery

**Real behavior/copy mismatch; reported.** Locations: [app/dashboard/components/ChatTab.tsx:95](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ChatTab.tsx:95>), [app/dashboard/components/TrialBanner.tsx:40](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/TrialBanner.tsx:40>), [app/api/stripe/webhook/route.ts:46](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:46>), [app/offline/page.tsx:70](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/offline/page.tsx:70>).

Every chat failure tells the reader to verify a Gemini API key they do not control, including offline/quota failures. The trial banner promises an inbox reminder although the webhook only sets a flag and contains a TODO for sending email. Book expiry is eight days after course creation, not necessarily trial end or midnight. The offline page promises to resume on reconnection but has no online listener/reload mechanism.

**Minimal fix:** agree on truthful user-facing error/notice text or implement the promised behavior. No existing copy was changed. Offline content is intentionally limited to a fallback page and cached assets; this audit does not propose offline AI generation or caching private API responses.

### 27. P2 — Font-size normalization accepts inherited object properties

**Real bug; fixed.** Location: [lib/reading-prefs.ts:32](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/reading-prefs.ts:32>).

A malformed stored preference such as `constructor` or `__proto__` passed the `in` check, was cast to a valid font size, and supplied non-scale data to reader geometry/styles.

**Applied minimal fix:** require an own property of `FONT_SCALE`. Tests accept all four valid choices and reject inherited/malformed values. No legitimate preference changes.

### 28. P2 — Legacy generation and library routes expose broken paths

**Real bugs plus dead-code drift; reported, not deleted.** Locations: [app/api/generate/course/route.ts:4](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/generate/course/route.ts:4>), [app/course/generate/page.tsx:30](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/course/generate/page.tsx:30>), [app/api/flashcards/route.ts:3](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/flashcards/route.ts:3>), [app/api/generate/flashcards/route.ts:4](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/generate/flashcards/route.ts:4>), [app/library/page.tsx:44](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/library/page.tsx:44>), [app/settings/page.tsx:13](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/settings/page.tsx:13>).

The legacy `/api/generate/course` writes long lessons into `previewText` and returns concepts/reflections instead of the current lesson/cards/starters shape; no application caller was found. The separate `/course/generate` page calls the current API but expects `courseId`, which it never receives, then navigates to `/course/undefined` without saving a course. Two old flashcard APIs differ in card count and key names and have no application callers. `/library` queries the top-level `books` collection denied by current rules, then presents the failure as an empty library. `/settings` is an unguarded old v0 setup guide with event instructions that omit current invoice handlers; it is not an operational secret editor.

**Minimal fix:** decide retirement/redirect compatibility for public routes, then delete their implementations and obsolete helpers. Do not weaken rules to resurrect the legacy global books collection. Keep useful compatibility redirects such as `/course/[id]` unless intentionally retired.

### 29. P3 — Build suppresses type checking; the known type mismatch was real

**Code-quality issue; type mismatch fixed, build policy reported.** Locations: [components/auth/modern-animated-sign-in.tsx:489](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/auth/modern-animated-sign-in.tsx:489>), [next.config.mjs:6](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs:6>), [package.json:8](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json:8>).

`AuthTabs` declared field types as arbitrary strings while `AnimatedForm` accepts a constrained `Field`. Baseline `npx tsc --noEmit` reproduced the documented error. Build configuration intentionally skips type/lint validation, so a successful build alone cannot prove type correctness.

**Applied minimal fix:** reuse `Field[]` in the wrapper. **Remaining minimal fix:** make type checking an explicit deployment/CI gate rather than relying on the skipped build phase; establish a working lint configuration separately. No dependency added.

### 30. P3 — Dependency and documentation drift increases maintenance cost

**Code-quality issue; reported, not deleted.** Locations: [package.json:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json:11>), [components/demo.tsx:1](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/demo.tsx:1>), [components/theme-provider.tsx:1](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/theme-provider.tsx:1>), [lib/gemini.ts:105](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/gemini.ts:105>), [app/mastery/layout.tsx:3](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/mastery/layout.tsx:3>), [app/dashboard/components/HomeTab.tsx:279](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/HomeTab.tsx:279>), [lib/plans.ts:43](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/plans.ts:43>).

A source-import scan found no inbound imports for the demo or theme provider. Candidate unused dependencies include `@hookform/resolvers`, most Radix primitives except label/slot, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, and `zod`. CSS tooling and optional/peer dependencies require separate checking; absence of imports is not sufficient evidence to delete them or claim they inflate runtime bundles.

Comments still describe a summary reader that no longer has a caller and a Llama fallback while the implementation selects a different default model. Home promises “Full summaries” although Mastery now starts normal courses. The brief's $34 Book Club price differs from `lib/plans.ts` at $34.99; its 40 books are implemented as 10 per member across four people, not 40 per account.

**Minimal fix:** approve the intended public copy/pricing, then reconcile docs and remove verified unused code/dependencies in a separate cleanup. Retain the distinct fidelity and persona prompt responsibilities.

### 31. P3 — Generation deadline and honesty signals are not end-to-end contracts

**Code-quality/reliability gaps; reported.** Locations: [lib/gemini.ts:59](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/gemini.ts:59>), [lib/groq.ts:43](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/groq.ts:43>), [lib/generate.ts:59](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate.ts:59>), [app/api/course/generate/route.ts:31](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts:31>), [lib/generate-course.ts:31](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate-course.ts:31>).

Provider fetches have no explicit timeout. Three attempts, each potentially including fallback, have no shared route deadline; one stalled attempt can consume the whole route budget. Groq does not check the finish reason as Gemini does. `familiar: false` is returned by the outline API but dropped by the client, so uncertain topic-based output is indistinguishable to readers; later-day prompts request honesty metadata their response schema does not expose.

**Minimal fix:** an abortable total deadline, bounded provider attempts, and fallback finish-reason validation. Decide how uncertainty should affect the product before adding visible warnings or rejecting unfamiliar books. Do not merge fidelity rules with reading-level personas.

### 32. P3 — Avoidable background rendering and cache-lifecycle work

**Performance/code-quality issue; reported.** Locations: [components/ui/entropy.tsx:126](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/ui/entropy.tsx:126>), [components/ui/entropy.tsx:140](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/ui/entropy.tsx:140>), [lib/BookwormContext.tsx:203](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:203>), [public/sw.js:89](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/public/sw.js:89>), [app/dashboard/components/LessonReader.tsx:101](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/LessonReader.tsx:101>).

The landing canvas maintains 625 particles and periodically checks every pair, continuing while offscreen; it does not consult reduced-motion preferences. A shelf mutation rewrites all courses (also finding 9). Lesson parsing repeats on reader rerenders. Service-worker `cache.put` promises are neither awaited nor attached to `waitUntil`, so worker termination can drop cache writes; storage failures can reject unhandled.

**Minimal fix:** measure before optimizing; pause offscreen/background canvas work and define reduced-motion treatment, cache parsed lesson blocks, save only changed data, and attach cache writes to the worker lifecycle with failure handling. Do not replace intentional Motion animations or alter visual design. No measured frame-rate or first-paint claim is made.

### 33. P3 — Billing-provider assumptions are spread through entitlement consumers

**Architecture/code-quality issue; reported only.** Locations: [lib/billing.ts:84](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/billing.ts:84>), [app/preview/page.tsx:163](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx:163>), [app/dashboard/components/ProfileTab.tsx:185](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ProfileTab.tsx:185>), [app/api/account/delete/route.ts:37](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/account/delete/route.ts:37>), [app/api/stripe/webhook/route.ts:134](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:134>).

Billing enablement depends on a Stripe publishable key; trial setup, cancellation, deletion, and allowance renewal assume Stripe. Adding Play or Whop purchases would require touching both UI entry points and account lifecycle operations, not just adding a receipt endpoint.

**Minimal future fix:** keep a provider-neutral entitlement/period model in Firebase, with provider-specific purchase, cancellation, and reconciliation adapters. Preserve the single Firebase identity. No new provider, migration, or entitlement system was built in this audit.

## Verification and limits

- Read the full audit brief first, inspected every API route, traced active authentication/generation/billing/reader/persistence paths, and scanned imports across 118 source/config files. Supporting assets and historical documentation were inventoried; this is not a line-by-line certification of every historical spec or binary asset.
- Baseline `npx tsc --noEmit`: failed only at the documented `AuthTabs` field mismatch. Post-fix run: passed (exit 0).
- `node tests/audit-regressions.cjs`: passed. Uses the existing TypeScript compiler and built-in Node tools with mocked auth/network boundaries; no live service writes. The final run also covers inherited/malformed font preferences, concurrent shelf changes during generation, and rejected billing-profile reads, in addition to transport errors, HTTP errors, mutation non-retry, incomplete day responses, and gap-only repair preservation.
- First `npm run build`: failed fetching Caveat, Lora, and Nunito due to network `EACCES`. The network-enabled retry passed, and a second network-enabled build after the final source edit also passed (exit 0; 45 static pages generated). Next explicitly skipped its internal type/lint checks; the separate type-check command passed.
- `git diff --check`: passed, including the final check.
- Initial web-tool reads failed, but subsequent direct public HTTP checks succeeded: `/delete-account` 200 with expected title/content, `/manifest.webmanifest` 200 with manifest content type, `/sw.js` 200 with JavaScript content type, and `/.well-known/assetlinks.json` 404. No Android package/emulator test, live Stripe transaction, Firebase emulator test, browser keyboard/screen-reader test, or measured contrast/performance run was performed.
- The public manifest declares stable ID, scope, standalone display, launch URL, and normal/maskable icon paths; the service worker deliberately excludes API caching and has an inline-styled offline document. Those are positive source/HTTP findings, not proof of TWA or Play approval.
- Existing user-owned untracked files `CODEX_AUDIT_PROMPT.md` and `handoff-prompt.md` were preserved. Secrets and Firebase rules were not edited.

Final verification: `node tests/audit-regressions.cjs`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` all passed after the source fixes. All four manifest icon files exist and their PNG dimensions match the declared 192/512 sizes. The report contains 33 findings with 116 checked local file/line links.
