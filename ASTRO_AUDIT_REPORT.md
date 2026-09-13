# Bookworm.AI — follow-up production-readiness audit

September 12–13, 2026, America/Chicago. Baseline: `main` at `da5c3da`, origin `Godz-iAgency/bookworm-ai`.

## What changed and what did not

The earlier unresolved access, quota, billing and persistence findings were real. This pass implements server enforcement, billing retry/order protection, atomic Book Club copy handling, safer deletion, stronger generated-content validation, recovery/accessibility fixes and security dependency updates. All 33 earlier findings are reconciled below. New findings include complimentary-access creation/revocation, refund ownership/retry safety, automatic-deletion protection and dependency advisories.

**This is a locally hardened candidate, not a production-readiness certification.** Changes are uncommitted, unpushed and undeployed. Rules fixes are not effective in production until the founder deploys them. Staging integration tests and review of the explicitly labeled policy choices remain release requirements. No real account, payment, refund, production book generation or production data was touched.

Authored AI prompts, brand artwork, ordinary visible styling, prices and deliberate course expiry were preserved. Structural recovery/accessibility changes expose existing actions and errors. No direct dependency, route or repository file was deleted. Android work and the accepted Android 404 remain untouched.

## Prioritized findings

### A1. P1 — AI spending and course admission were client-controlled

**Disposition: fixed — policy call, please review.** Real bug; prior #1, #8 and #18.

All nine AI routes now authenticate, check live access, and reserve usage transactionally. Study/chat requests require the caller's persisted, unexpired course. Family access requires an active roster entry. Saving a course requires a server-issued generation ticket and an atomic shelf-cap check. Revised rules prohibit client course creation and generation-counter changes/deletion. Evidence: [lib/ai-guard.ts:12](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-guard.ts:12>), [app/api/course/save/route.ts:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/save/route.ts:11>), [firestore.rules:62](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules:62>).

**Policy implemented:** admitted attempts count even when a provider fails; signed-in free previews get three lifetime attempts; cover scans get ten per UTC day; course/study requests also have a 100-per-day operational ceiling. Unlimited complimentary access bypasses the lifetime cap, not that daily ceiling. This bounds uncertain provider spend, but a failed attempt can consume the demo account's sole generation. Review that tradeoff before release. Client billing-pause flags do not disable server authentication/entitlements. These limits are per account, not protection against creating many accounts.

**Production signal:** on a disposable account with one generation left, two concurrent requests admit one and increment `users/{uid}.generationsThisMonth` once. Concurrent saves cannot exceed the shelf cap. After rules deployment, direct client counter deletion/changes, forged profile creation and course creation return permission-denied.

### A2. P1 — Complimentary-access revocation was incomplete

**Disposition: fixed.** Real bug in the new access system.

The admin toggle now batches both active fields. Verified-token resolution rereads the override and checks revoked Firebase tokens; a live Auth listener signs out disabled complimentary accounts. AI results recheck access before delivery; generation tickets check the profile transactionally before creation. Rules deny disabled accounts' course/summary access and close the initial-profile-create override loophole, not just update/merge paths. Evidence: [app/api/admin/links/route.ts:40](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/links/route.ts:40>), [lib/firebase/admin.ts:183](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/admin.ts:183>), [context/AuthContext.tsx:57](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/context/AuthContext.tsx:57>), [firestore.rules:68](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules:68>), [app/api/course/generate/route.ts:39](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts:39>).

“Instant” means enforcement at live server/rules checks and connected-client listener delivery. It cannot retract already downloaded content, an offline copy or bytes already sent; existing content can briefly remain while the listener arrives.

**Production signal:** disable a disposable complimentary link mid-session. Both active fields become false together; the connected browser signs out; fresh API calls fail; a generation whose result check occurs after revocation returns no usable content. No real complimentary account was used here.

### A3. P1 — Deletion could proceed after billing cancellation failed

**Disposition: fixed.** Real bug; prior #2.

Stripe cancellation must succeed or confirm `resource_missing` before deletion starts. A shared account-operation lock serializes billing, joining and deletion. `deletionPending` blocks new protected writes during cleanup; failed cleanup can be retried through the deletion route. Content, generation tickets, usage records, access links and redeemed invitations are explicitly removed in bounded batches. Evidence: [lib/account-delete.ts:27](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-delete.ts:27>), [lib/account-delete.ts:51](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-delete.ts:51>), [lib/account-lock.ts:6](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-lock.ts:6>).

This is ordered, retryable cleanup, not a cross-service transaction. The five-minute lease assumes the operation ends within that window; crashed operations can temporarily require a retry. Large historical accounts need staging timing checks.

**Production signal:** in staging, force cancellation failure: Auth and content remain. For a successful disposable-account deletion, confirm canceled Stripe subscription, empty listed subcollections, absent access links and Admin Auth `user-not-found`.

### A4. P1 — Scheduled removal could destroy an account that regained access

**Disposition: fixed — policy call, please review.** Real bug in the new cron path.

Eligibility is reread under the account lock. Any complimentary override, subscription pointer, family membership or paid/trial state protects the account. Rejoining clears removal dates. Evidence: [lib/account-delete.ts:37](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-delete.ts:37>), [app/api/family/join/route.ts:64](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/join/route.ts:64>), [app/api/cron/purge-removed-members/route.ts:63](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/cron/purge-removed-members/route.ts:63>).

**Policy implemented:** automatic account destruction is paused unless `ENABLE_AUTOMATIC_ACCOUNT_DELETION=true`. Cron reports checked/reprieved/paused/failures. Recommendation: retain the default until disposable-account staging tests establish safe behavior. This favors retention over irreversible loss and temporarily delays the existing seven-day deletion promise. No live environment setting was changed.

**Production signal:** a due account that converts, rejoins or has an override survives. With the flag absent, due unprotected accounts increase `paused`, not `deleted`. Enable only after successful cleanup and race tests.

### A5. P1 — Billing retries and same-plan changes could duplicate subscriptions or restore quota

**Disposition: fixed.** Real bugs; prior #3 and #6.

Billing mutations share a server lock. Customer/trial/new-subscription creation use stable Stripe idempotency keys; retries reconcile existing Stripe subscriptions before creating another. Complimentary accounts cannot acquire a second entitlement through upgrade/trial routes. Same-plan requests verify Stripe's actual plan, and tier changes no longer reset usage. Evidence: [app/api/stripe/create-setup-intent/route.ts:33](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/create-setup-intent/route.ts:33>), [app/api/stripe/activate-trial/route.ts:66](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/activate-trial/route.ts:66>), [app/api/stripe/upgrade/route.ts:48](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:48>), [app/api/stripe/upgrade/route.ts:82](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:82>).

Existing deferred proration is preserved. Stripe/Firestore cannot commit together; keys and reconciliation support recovery rather than promising cross-service atomicity.

**Production signal:** simulate a lost response after Stripe creation and retry: one customer/subscription. Same-plan and mid-period tier changes leave `generationsThisMonth` unchanged. Concurrent cancel/upgrade operations serialize or return a retryable conflict.

### A6. P1 — An incomplete initial payment could grant paid access

**Disposition: fixed — policy call, please review.** Real bug; prior #7.

Creation, tier updates and early trial conversion use `error_if_incomplete` before granting the resulting Firestore plan. Evidence: [app/api/stripe/upgrade/route.ts:63](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts:63>), [app/api/stripe/end-trial-now/route.ts:30](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/end-trial-now/route.ts:30>).

**Policy implemented:** fail the operation and retain prior entitlement when payment cannot complete. This avoids granting unpaid access but does not add an in-app flow for cards requiring additional customer authentication. That UX needs a separate decision. Existing renewal `past_due` grace is preserved, not redefined.

**Production signal:** Stripe test-mode declines/authentication-required cards must not grant a new plan or family. Successful payment updates the plan. Retrying an error must not create a second subscription.

### A7. P1 — Webhook replay, stale invoices and old families could corrupt access

**Disposition: fixed.** Real bugs; prior #4 and #5.

Webhooks verify signatures, retrieve current Stripe state inside the account lock, reject obsolete subscription pointers and record event receipts. Renewal resets require a newer paid period matching Stripe's current period. Old paid invoices cannot clear a current payment failure or reset current usage. Family handling uses the current profile family/subscription identity, not the first family matching a customer. Missing webhook configuration returns 503 instead of acknowledging lost work. Evidence: [app/api/stripe/webhook/route.ts:14](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:14>), [app/api/stripe/webhook/route.ts:45](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:45>), [app/api/stripe/webhook/route.ts:65](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts:65>).

Receipts live in `stripeEvents`; no TTL/retention policy was added. Current entitlements still depend on webhook delivery and operational monitoring.

**Production signal:** replay a paid renewal and then an older-period invoice: `lastPaidPeriod` and usage remain correct. Inspect `stripeEvents/{eventId}`, `lastPaidInvoice` and `billingEventCreated`. An old canceled subscription must not affect its replacement or new family.

### A8. P1 — Shared-book copies could be missing, orphaned or resurrected

**Disposition: fixed — policy call, please review.** Real bugs in Book Club.

Opening a share now creates the recipient copy server-side transactionally and preserves progress on retry. Share/unshare/remove-member transactions reread membership. Dissolution removes snapshots, invitations and affected copies for both owner downgrade and deletion. Client removal listeners evict withdrawn copies; autosave does not recreate known remotely deleted documents. Invite creation rechecks active ownership transactionally. Evidence: [app/api/family/open-shared/route.ts:31](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/open-shared/route.ts:31>), [app/api/family/unshare/route.ts:28](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/unshare/route.ts:28>), [app/api/family/remove-member/route.ts:48](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/remove-member/route.ts:48>), [lib/family-server.ts:116](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/family-server.ts:116>), [lib/account-delete.ts:63](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-delete.ts:63>), [app/api/family/invite/route.ts:44](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/invite/route.ts:44>).

**Policy implemented:** all seven lessons must exist before sharing; shared study content cannot regenerate. This follows the brief's no-regeneration promise, which contradicted the old lazy-day implementation/comments. Readers must open all seven lessons before sharing, while the original expiry keeps running. Review that usability tradeoff.

**Production signal:** for each of unshare, member removal, owner downgrade and owner deletion, every affected `courses/{shareId}` is absent. Race opening against withdrawal: no copy reappears. Reopening an available share preserves progress and consumes no generation quota.

### A9. P1 — Historical partial/orphan shares need a migration decision

**Disposition: reported only, needs your decision first.** Residual historical-data risk, not evidence of an affected live account.

New transactions prevent new partial revocations. They cannot identify every old recipient after a previous failure already removed the snapshot/roster. Existing incomplete snapshots also cannot generate missing lessons under the corrected contract. Evidence: [app/api/family/unshare/route.ts:28](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/unshare/route.ts:28>), [lib/family-server.ts:122](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/family-server.ts:122>), [lib/ai-guard.ts:44](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-guard.ts:44>).

Recommendation: read-only inventory of `sharedFrom` records, then a separately reviewed migration. Retire incomplete snapshots and re-share complete originals; remove confirmed orphan copies. No production inventory or migration was performed.

**Production signal:** after an approved migration, every retained shared copy resolves to active membership and an existing complete snapshot.

### A10. P1 — Refund requests needed ownership and retry protection

**Disposition: fixed.** Real bug in the new payments route.

Admin APIs were already independently token/email gated; that boundary was confirmed and strengthened to require a verified email claim. Refunds require a successful, undisputed charge whose customer maps to exactly one Bookworm account. Concurrent full-refund retries use one deterministic key; foreign/ambiguous mappings are rejected. Evidence: [app/api/admin/payments/route.ts:38](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/payments/route.ts:38>), [app/api/admin/payments/route.ts:80](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/payments/route.ts:80>), [lib/firebase/admin.ts:186](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/admin.ts:186>).

Last-50-charge listing and full refunds are intentional. No refund was issued. Confirm the real admin email is verified before release; no real account was inspected.

**Production signal:** non-admin/unverified-email requests fail before expensive reads. Concurrent refund requests for one eligible test charge produce one refund; foreign/ambiguous charges produce none.

### A11. P1 — Persistence and asynchronous generation could lose or cross account data

**Disposition: fixed.** Real bugs; prior #9 and #10.

Autosave writes only changed courses through serialized transactions, merges generated gaps and monotonic completion/unlocks, and preserves remote data. Action unchecking remains possible: locally changed action fields win, otherwise remote fields survive. AI results bind to the initiating Firebase User; generation checks identity before save/append; account changes clear pending selection. Evidence: [lib/BookwormContext.tsx:231](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:231>), [lib/BookwormContext.tsx:237](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:237>), [lib/ai-fetch.ts:7](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-fetch.ts:7>), [lib/useCourseGeneration.ts:122](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts:122>).

This is not complete live cross-device synchronization. Conflicting edits to the same action field remain last-writer-wins. Save failures are logged and retry on a later state change, not through a durable offline queue.

**Production signal:** edit different days in two tabs and reload: both changes survive. Delete remotely during an outstanding save: no recreation. Switch accounts during generation: no result is appended to the second account.

### A12. P1 — Installed dependencies included security advisories

**Disposition: fixed.** Independent finding.

The initial production dependency audit reported 17 advisories, including two critical and six high. Updated to Next 15.5.25 and Firebase Admin 14.4.0, with scoped PostCSS 8.5.28 and gaxios→uuid 11.1.1 overrides. Final production `npm audit` reports zero known vulnerabilities; `npm ls` reports valid resolution. Evidence: [package.json:52](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json:52>), [package.json:85](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json:85>), [package-lock.json:4](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package-lock.json:4>).

Firebase Admin 14 requires Node >=22, now declared in package.json. Local verification used Node 24.19.0. The inspected UUID consumer uses the compatible `v4()` API. No direct dependency was removed; transitive resolution changed. Advisory presence does not establish exploitability, and zero known advisories is not a security certificate.

**Production signal:** run `npm ci` in staging from the release lockfile, verify Node 22+ and resolved versions, then exercise Admin Auth/Firestore reads and transactions. Audit the release artifact again.

### A13. P2 — Completion and repair paths could count twice or leave incomplete content

**Disposition: fixed.** Real bugs; prior #12–15 and #20.

Completion uses course/day and finished-course IDs, updating course/progress together; backfill cannot lower counters or erase badges. This covers the new Tomorrow action and ordinary completion. Course/profile/progress reads normalize malformed fields; bad course records are skipped, not destroyed. Outline/day/repair output validates required content inside retries. Missing chat starters trigger repair, and in-flight study requests are deduplicated. Evidence: [lib/firebase/progress.ts:127](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:127>), [lib/firebase/progress.ts:112](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts:112>), [lib/course-validation.ts:8](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/course-validation.ts:8>), [app/api/course/flashcards/route.ts:36](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/flashcards/route.ts:36>), [lib/useDayContent.ts:45](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDayContent.ts:45>), [lib/ai-fetch.ts:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-fetch.ts:11>).

Validation enforces reader-consumable structure, not factual accuracy, word count or editorial quality. Previously fixed stuck-repair handling remains covered by the original tests.

**Production signal:** race Tomorrow with day-list completion: one `completedCourseDays` key and one `booksFinished` increment. Malformed output retries or shows the existing error/retry state. Switching tabs must not duplicate identical in-flight study requests.

### A14. P2 — Chat allowance and billing displays could become stale

**Disposition: fixed — policy call, please review.** Real bugs; prior #21 and #22.

Chat uses server daily usage documents and date rollover, removing localStorage as authority. Dashboard, pricing and profile billing refresh from live user-document changes. Reading preferences use per-user storage keys and ignore an older initial read after a local edit. Evidence: [lib/useChatQuota.ts:10](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useChatQuota.ts:10>), [app/dashboard/components/ProfileTab.tsx:68](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ProfileTab.tsx:68>), [app/dashboard/page.tsx:169](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/page.tsx:169>), [app/pricing/page.tsx:98](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx:98>), [lib/ReadingPrefsContext.tsx:38](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ReadingPrefsContext.tsx:38>).

**Policy implemented:** chat resets at UTC midnight for consistent multi-device enforcement. Preference drafts deliberately remain local while edited; this is not a collaborative settings editor.

**Production signal:** two devices reconcile to the same `aiUsage/{UTC-date}.chat_{courseId}`. Cross UTC midnight without reload: allowance resets. Billing changes refresh displays without overwriting a preferences draft.

### A15. P2 — Recovery and accessibility had remaining functional gaps

**Disposition: fixed.** Prior #16, #19, #24 and #25, with additional fixes.

Transport failures retain the existing no-auto-retry contract. Course deletion propagates remote failure instead of falsely removing the local book. Trial conversion displays errors; public deletion sign-in displays redirect failures and links to existing password recovery. Refresh failures are handled. Flashcards have keyboard activation and inactive-face accessibility handling; icon controls have labels; phone reader/pricing dialogs contain focus and handle Escape. Evidence: [lib/api-client.ts:11](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/api-client.ts:11>), [lib/BookwormContext.tsx:280](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx:280>), [app/dashboard/components/TrialBanner.tsx:77](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/TrialBanner.tsx:77>), [app/delete-account/page.tsx:244](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx:244>), [lib/useDialogFocus.ts:4](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDialogFocus.ts:4>), [app/dashboard/components/FlashcardTab.tsx:132](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/FlashcardTab.tsx:132>), [components/auth/modern-animated-sign-in.tsx:430](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/auth/modern-animated-sign-in.tsx:430>).

No visual redesign was made. The support-email fallback still needs a founder-configured address; none was invented. Manual keyboard/screen-reader/device verification remains outstanding.

**Production signal:** failed conversion/deletion shows errors and leaves controls usable. Navigate both dialogs and flip cards with the keyboard; focus returns to the trigger. Verify password recovery and the configured support contact in staging.

### A16. P2 — Curated lookup could still substitute the wrong book

**Disposition: fixed.** Prior #23; the intervening cover fix was only partial.

Curated generation retains catalog title/author and decorates only a normalized match; existing-course matching includes author. Cover lookup requires normalized main-title equality and author matching instead of permissive prefix matching. Evidence: [app/mastery/[pillar]/[book]/page.tsx:95](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/mastery/[pillar]/[book]/page.tsx:95>), [lib/google-books.ts:100](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/google-books.ts:100>), [app/api/books/cover/route.ts:51](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/books/cover/route.ts:51>).

Subtitles after a colon are still normalized away. Conservative matching may show the existing fallback cover instead of a plausible wrong cover. General user search remains a user-selected result list.

**Production signal:** ambiguous titles and identical titles by different authors retain the curated identity; only a matching cover is used.

### A17. P2 — Legacy navigation exposed broken paths

**Disposition: fixed — policy call, please review.** Prior #28.

`/library`, `/course/generate` and `/settings` redirect to maintained dashboard/search flows. Files remain present. Legacy AI endpoints remain authenticated/rate-limited; removal is outside the brief's authority. Evidence: [next.config.mjs:19](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs:19>).

**Policy implemented:** old bookmarks reach maintained flows rather than preserving broken legacy navigation.

**Production signal:** open each old URL directly and confirm the intended redirect. Unauthenticated requests to retained AI endpoints fail.

### A18. P2 — Some authored messages still promise unsupported behavior

**Disposition: reported only, needs your decision first.** Prior #26 and remaining parts of #24/#31.

Chat failures tell readers to check a Gemini key they do not manage. Trial text ties book expiry to midnight/trial end despite per-course expiry, and can claim an inbox reminder although no mail service is wired. The outline's `familiar` flag is not an end-to-end confidence disclosure. Evidence: [app/dashboard/components/ChatTab.tsx:99](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ChatTab.tsx:99>), [app/dashboard/components/TrialBanner.tsx:52](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/TrialBanner.tsx:52>), [app/api/course/generate/route.ts:48](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts:48>), [app/delete-account/page.tsx:260](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx:260>).

These require changing protected copy/product behavior or adding a provider. Recommendation: approve accurate recovery/expiry text, confidence disclosure and a real support address; decide whether reminder delivery should exist. No authored prompt or marketing copy was rewritten.

**Production signal:** after a separately approved change, recovery text points to reader actions, reminder claims have delivery records, and expiry language matches saved `expiresAt`.

### A19. P3 — Build checks, provider deadlines and background work were weaker than intended

**Disposition: fixed.** Prior #29, #31 and #32.

Builds now check TypeScript. Structured generation shares a finite deadline across retries/fallbacks; provider requests have abort signals; truncated Groq responses fail. The retained direct flashcard fetch also times out. Autosave writes changed courses; lesson splitting is memoized; positive/negative cover caching shares a 500-entry bound; service-worker cache writes are awaited; the particle canvas skips expensive offscreen/hidden work while preserving its visible design. Evidence: [next.config.mjs:10](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs:10>), [lib/generation-budget.ts:3](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generation-budget.ts:3>), [lib/groq.ts:58](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/groq.ts:58>), [app/api/flashcards/route.ts:32](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/flashcards/route.ts:32>), [app/dashboard/components/LessonReader.tsx:103](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/LessonReader.tsx:103>), [app/api/books/cover/route.ts:45](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/books/cover/route.ts:45>), [public/sw.js:86](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/public/sw.js:86>), [components/ui/entropy.tsx:140](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/ui/entropy.tsx:140>).

Provider deadlines do not bound unrelated Firestore/scheduling delays or cancel work already accepted remotely. The canvas retains a cheap animation-frame check while offscreen.

**Production signal:** slow-provider logs show bounded attempts and returned errors before route timeout. Builds reject a deliberate staging type error. Offscreen profiles show no particle neighbor calculations; unchanged courses cause no repeated writes.

### A20. P3 — Metric definitions needed hardening; full scans remain intentional

**Disposition: fixed.** New metrics correctness findings.

Paid-tier MRR counts exclude trials/complimentary users. Malformed preference/course fields are tolerated, and null-prototype aggregate maps prevent titles/topics such as `__proto__` from interfering with aggregation. Evidence: [app/api/admin/metrics/route.ts:87](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/metrics/route.ts:87>), [app/api/admin/metrics/route.ts:121](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/metrics/route.ts:121>).

Full Auth/Firestore scans remain the explicit current-scale tradeoff; non-admins are rejected first. Displayed MRR is a plan-count estimate, not Stripe recognized revenue. Resettable usage counters cannot establish all-time conversion history. No live account count was obtained, so actual scan latency and the stated few-hundred-account scale were not verified.

**Production signal:** fixtures containing trial, paid and complimentary users produce correct paid counts. Measure actual read volume/latency; reconcile financial reporting with Stripe rather than this estimate.

### A21. P3 — Retired surfaces, lint setup and billing architecture remain separate work

**Disposition: reported only, needs your decision first.** Prior #30/#33 and remaining lint portion of #29.

Dependencies/legacy files were retained as required. The lint script still invokes `next lint` without a configured lint setup; builds skip linting while now checking types. Historical product docs need a separate ownership pass. Stripe assumptions remain in entitlement consumers; changing billing architecture is expressly out of scope. Evidence: [package.json:8](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json:8>), [next.config.mjs:7](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs:7>), [lib/billing.ts:13](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/billing.ts:13>), [app/api/generate/course/route.ts:5](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/generate/course/route.ts:5>).

Recommendation: approve removal of verified unused surfaces separately, choose a lint baseline without a formatting rewrite, and update product docs after accepting the policy calls.

**Production signal:** later maintenance identifies callers before removal, supplies a working lint command and retains regression/build gates.

### A22. Intentional behavior and Android work left as requested

**Disposition: intentional, not a bug.** Explicit product requirements.

Course expiry, Page-Turner-only trial, per-member Book Club quota, passwordless links, independent snapshots, full refunds/last-50-charge UI and current-scale admin scans are deliberate. Evidence: [lib/generate-course.ts:82](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate-course.ts:82>), [app/api/stripe/activate-trial/route.ts:62](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/activate-trial/route.ts:62>), [lib/plans.ts:9](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/plans.ts:9>), [app/api/access/redeem/route.ts:48](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/access/redeem/route.ts:48>).

Prior #11 remains deferred Android/Play readiness work: you accepted the Android 404 while developing it. No Android origin file or payment architecture was changed, and this audit does not certify Play compliance. Passwordless URLs remain bearer credentials. Analytics now suppresses `/go` and `/join` paths; `/go` gets no-referrer/no-store/noindex headers: [components/private-analytics.tsx:5](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/private-analytics.tsx:5>), [next.config.mjs:14](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs:14>). Browser history and hosting logs may still contain capability URLs.

**Production signal:** verify unchanged limits/expiry against product fixtures. A disposable capability URL must not appear in analytics, and its response headers must prevent referrer propagation. Android readiness needs separate verification when ready.

## Recheck of all 33 prior findings

A-number references above provide current file:line evidence, reasoning and production signals. “Fixed” describes local source, not a deployed result.

| Prior # | Finding | Current disposition | Resolution / boundary |
|---|---|---|---|
| 1 | Public AI endpoints | fixed — policy call, please review | A1; server admission and save claim |
| 2 | Deletion leaves billing/data | fixed | A3; cancellation first, retryable cleanup |
| 3 | Subscription idempotency | fixed | A5; locks, keys and reconciliation |
| 4 | Webhook ordering/replay | fixed | A7; current Stripe state, periods and receipts |
| 5 | Stale family lookup | fixed | A7–A8; current family/subscription identity |
| 6 | Same-plan quota reset | fixed | A5; no mid-period reset |
| 7 | Unpaid entitlement | fixed — policy call, please review | A6; reject incomplete payment |
| 8 | Deletable counter | fixed | A1; rules source fixed, not live until deployed |
| 9 | Whole-course autosave | fixed | A11; transactional merge |
| 10 | Cross-account generation | fixed | A11; initiating identity checks |
| 11 | Android/Play readiness | reported only, needs your decision first | A22; Android 404 accepted during development |
| 12 | Malformed records | fixed | A13; nested validation/normalization |
| 13 | Weak generated schema | fixed | A13; structural validation inside retries |
| 14 | Racing content owners | fixed | A13; in-flight deduplication and gap merges |
| 15 | Stuck incomplete repair | previously reported, now confirmed resolved by other work | Original repair regression passes; A13 adds validation |
| 16 | Network failure stranding | previously reported, now confirmed resolved by other work | Original transport regressions pass; A15 adds visible errors |
| 17 | Stale closure/new-course state | previously reported, now confirmed resolved by other work | Original shelf/billing-failure regressions pass; A1/A11 add server guarantees |
| 18 | Direct preview cap bypass | fixed — policy call, please review | A1; atomic save and attempt limits |
| 19 | Silent deletion failure | fixed | A15; failure propagates |
| 20 | Double completion/backfill | fixed | A13; course/day IDs and transactional backfill |
| 21 | Chat midnight/storage | fixed — policy call, please review | A14; server UTC allowance |
| 22 | Stale billing/preferences | fixed | A14; listeners and protected drafts |
| 23 | Wrong curated identity | fixed | A16; earlier cover fix was partial |
| 24 | Deletion recovery | fixed | A15; redirect errors/recovery link; support configuration still required |
| 25 | Accessibility gaps | fixed | A15; source fixes, manual verification outstanding |
| 26 | Incorrect recovery/expiry copy | reported only, needs your decision first | A18; protected authored copy |
| 27 | Inherited font-size properties | previously reported, now confirmed resolved by other work | Original font regression passes; reading-prefs.ts unchanged |
| 28 | Legacy routes | fixed — policy call, please review | A17 redirects; removal separately reviewable |
| 29 | Build type suppression | fixed | A19 types enabled; lint remains A21 |
| 30 | Dependency/docs drift | reported only, needs your decision first | A12 security updates fixed; A21 unused dependencies/docs retained |
| 31 | Deadline/honesty contract | fixed | A19 deadline fixed; confidence disclosure remains A18 |
| 32 | Background work/cache lifecycle | fixed | A19 autosave/memoization/cache/offscreen work |
| 33 | Provider assumptions | reported only, needs your decision first | A21; architecture out of scope |

## Verification and limits

- Read `ASTRO_AUDIT_PROMPT.md` in full before code inspection and confirmed remote/history. Retrieved the previous report with `git show 2961b4a:CODEX_AUDIT_REPORT.md`. Reviewed access/family/admin/billing changes alongside route, client, persistence, generation, configuration and dependency inventory.
- `npx tsc --noEmit`: baseline passed; final passed. A temporary invite-transaction syntax error was caught and corrected during editing.
- `node tests/audit-regressions.cjs`: final pass. The original suite was retained; its missing Book Club mock was updated for current imports. `tests/hardening.cjs` adds concurrent quota, in-flight revocation, stale-family denial, account switching, refund ownership/idempotency/auth, cancellation failure, atomic shelf save, share opening/resume/withdrawal, webhook replay/old-period, duplicate completion/backfill and protected-deletion regressions.
- `npm run build`: passed on Next 15.5.25, including all 54 generated pages. An intermediate sandboxed attempt could not download existing Google Fonts; an authorized network-enabled retry used the real fonts. Builds now check types.
- `git diff --check`: passed. Git's line-ending/global-ignore permission warnings were environmental, not whitespace defects.
- `npm audit --omit=dev --json`: zero vulnerabilities after updates. `npm ls next firebase-admin postcss uuid --depth=3`: valid installed resolution. Updates used `npm audit fix --ignore-scripts --no-fund`, `npm install --ignore-scripts --no-fund` and `npm update postcss gaxios --ignore-scripts --no-fund`; remaining overrides were resolved with `npm install`. `npm view` verified package versions and engine requirements.
- Regression tests execute real TypeScript modules behind mocked Auth/Stripe/Firestore boundaries. The in-memory fixture serializes transactions and asserts reads-before-writes; it does not reproduce distributed contention, security rules, external provider behavior or money movement. These tests do not replace staging integration tests.
- No readily available Java/Firebase emulator executable was found. Rules were reviewed directly, not compiled/emulated/deployed. Required emulator/staging cases include initial profile creation with forged overrides, merge/dot-path changes, counter deletion, disabled-account reads/writes and direct course creation.
- No live Stripe/Firebase operations, production generations, browser/device/screen-reader tests, real-account sign-ins, refunds, account deletions, commits, pushes or deployments were performed. No test accounts were created, so none require cleanup. No Play/compliance certification is claimed.

### Required release follow-through

Coordinate application and rules deployment. Releasing only one side leaves security holes or breaks old clients. Existing tabs that directly create courses or increment counters need to reload after release. The founder must run the command below; **I did not run it, and rules-related vulnerabilities are not fixed in production until deployment**:

```powershell
firebase deploy --only firestore:rules --project bookworm-ai-ca43d
```

Verify Node 22+ in the deployment environment before Firebase Admin 14. Keep automatic deletion paused until staging tests pass. Review attempt charging (especially the one-generation demo), preview limits, UTC chat resets, incomplete-payment rejection, full-content-only sharing, legacy redirects and the historical-share inventory recommendation.

The billing health route now requires the configuration fields rather than treating billing pause as readiness: [app/api/health/billing/route.ts:35](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/health/billing/route.ts:35>). This is a configuration check, not proof external credentials can transact. Each A-item gives a specific post-release production signal. Historical-data, copy/support, Android, architecture and lint/documentation work remain distinct from implemented fixes.

### Every file touched

- [ASTRO_AUDIT_REPORT.md](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/ASTRO_AUDIT_REPORT.md>)
- [app/api/access/redeem/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/access/redeem/route.ts>)
- [app/api/admin/links/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/links/route.ts>)
- [app/api/admin/metrics/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/metrics/route.ts>)
- [app/api/admin/payments/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/admin/payments/route.ts>)
- [app/api/books/cover/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/books/cover/route.ts>)
- [app/api/books/scan/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/books/scan/route.ts>)
- [app/api/chat/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/chat/route.ts>)
- [app/api/course/axiom/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/axiom/route.ts>)
- [app/api/course/day/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/day/route.ts>)
- [app/api/course/flashcards/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/flashcards/route.ts>)
- [app/api/course/generate/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/generate/route.ts>)
- [app/api/course/save/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/course/save/route.ts>)
- [app/api/cron/purge-removed-members/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/cron/purge-removed-members/route.ts>)
- [app/api/family/invite/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/invite/route.ts>)
- [app/api/family/join/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/join/route.ts>)
- [app/api/family/open-shared/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/open-shared/route.ts>)
- [app/api/family/remove-member/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/remove-member/route.ts>)
- [app/api/family/share/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/share/route.ts>)
- [app/api/family/unshare/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/family/unshare/route.ts>)
- [app/api/flashcards/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/flashcards/route.ts>)
- [app/api/generate/course/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/generate/course/route.ts>)
- [app/api/generate/flashcards/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/generate/flashcards/route.ts>)
- [app/api/health/billing/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/health/billing/route.ts>)
- [app/api/stripe/activate-trial/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/activate-trial/route.ts>)
- [app/api/stripe/attach-card/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/attach-card/route.ts>)
- [app/api/stripe/cancel/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/cancel/route.ts>)
- [app/api/stripe/create-setup-intent/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/create-setup-intent/route.ts>)
- [app/api/stripe/end-trial-now/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/end-trial-now/route.ts>)
- [app/api/stripe/upgrade/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/upgrade/route.ts>)
- [app/api/stripe/webhook/route.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/api/stripe/webhook/route.ts>)
- [app/course/generate/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/course/generate/page.tsx>)
- [app/dashboard/components/BookClubTab.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/BookClubTab.tsx>)
- [app/dashboard/components/ChatTab.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ChatTab.tsx>)
- [app/dashboard/components/CourseDetail.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseDetail.tsx>)
- [app/dashboard/components/CourseTab.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/CourseTab.tsx>)
- [app/dashboard/components/FlashcardTab.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/FlashcardTab.tsx>)
- [app/dashboard/components/LessonReader.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/LessonReader.tsx>)
- [app/dashboard/components/ProfileTab.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/ProfileTab.tsx>)
- [app/dashboard/components/TrialBanner.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/components/TrialBanner.tsx>)
- [app/dashboard/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/dashboard/page.tsx>)
- [app/delete-account/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/delete-account/page.tsx>)
- [app/layout.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/layout.tsx>)
- [app/mastery/[pillar]/[book]/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/mastery/[pillar]/[book]/page.tsx>)
- [app/preview/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/preview/page.tsx>)
- [app/pricing/page.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/app/pricing/page.tsx>)
- [components/auth/modern-animated-sign-in.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/auth/modern-animated-sign-in.tsx>)
- [components/private-analytics.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/private-analytics.tsx>)
- [components/ui/entropy.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/components/ui/entropy.tsx>)
- [context/AuthContext.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/context/AuthContext.tsx>)
- [firestore.rules](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/firestore.rules>)
- [lib/BookwormContext.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/BookwormContext.tsx>)
- [lib/ReadingPrefsContext.tsx](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ReadingPrefsContext.tsx>)
- [lib/account-delete.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-delete.ts>)
- [lib/account-lock.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/account-lock.ts>)
- [lib/ai-fetch.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-fetch.ts>)
- [lib/ai-guard.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/ai-guard.ts>)
- [lib/api-client.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/api-client.ts>)
- [lib/billing.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/billing.ts>)
- [lib/course-validation.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/course-validation.ts>)
- [lib/family-server.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/family-server.ts>)
- [lib/firebase/admin.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/admin.ts>)
- [lib/firebase/profile.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/profile.ts>)
- [lib/firebase/progress.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/firebase/progress.ts>)
- [lib/gemini.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/gemini.ts>)
- [lib/generate-course.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate-course.ts>)
- [lib/generate.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generate.ts>)
- [lib/generation-budget.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/generation-budget.ts>)
- [lib/google-books.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/google-books.ts>)
- [lib/groq.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/groq.ts>)
- [lib/scan-cover.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/scan-cover.ts>)
- [lib/stripe/server.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/stripe/server.ts>)
- [lib/useChatQuota.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useChatQuota.ts>)
- [lib/useCourseGeneration.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useCourseGeneration.ts>)
- [lib/useDayContent.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDayContent.ts>)
- [lib/useDialogFocus.ts](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/lib/useDialogFocus.ts>)
- [next.config.mjs](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/next.config.mjs>)
- [package-lock.json](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package-lock.json>)
- [package.json](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/package.json>)
- [public/sw.js](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/public/sw.js>)
- [tests/audit-regressions.cjs](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/tests/audit-regressions.cjs>)
- [tests/hardening.cjs](<C:/Users/druma/OneDrive/Desktop/GODZ-i/Apps/Bookworm.ai/bookworm-ai/tests/hardening.cjs>)

ASTRO_AUDIT_PROMPT.md was a pre-existing untracked user brief and was read, not edited. CODEX_AUDIT_REPORT.md was not rewritten.
