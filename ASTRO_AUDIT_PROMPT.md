# Bookworm.AI — Follow-up Audit Brief

## Goal

Make this app more robust and closer to production-ready. That means: find every real inconsistency, bug, and gap between intent and behavior across the whole codebase — not just the areas called out below, those are where I already suspect problems, not the limit of where to look — and **fix** what you find, not just list it. You are a more capable model than the one that built this and than the one that ran the last audit; the whole point of this pass is for you to catch what neither of us thought to check. Use your own judgment about where to look beyond what's flagged here.

## Where the code is

Work only inside this directory:

```
C:\Users\druma\OneDrive\Desktop\GODZ-i\Apps\Bookworm.ai\bookworm-ai
```

If your environment reports a different "primary working directory" (e.g. `C:\Users\druma\Bookworm.ai`), ignore it — that path is empty and unrelated. Confirm you're in the right place before doing anything: `git remote -v` should show `Godz-iAgency/bookworm-ai`, and `git log -5 --oneline` should show recent commits about a Book Club feature and an admin control centre.

## What this app is

A Next.js 15 / TypeScript / Firebase (Auth + Firestore) / Stripe app that turns any book into a 7-day AI-generated course (daily lesson, AI chat, flashcards). Courses expire on a deliberate schedule — that's a product feature, not a bug, so don't "fix" it. Three paid tiers (Page Turner $9.99, Well-Read $19.99, Book Club $34.99 — a 4-person family plan), a 7-day free trial, and Stripe billing throughout.

## What I built since the last audit — read this before you read any code

I'm the model that built everything listed in the commit log below. This is my own account of what each system is and why it's shaped the way it is, so you can spend your effort finding real inconsistencies instead of reverse-engineering intent from diffs. Treat this as a starting hypothesis to verify against the actual code, not as ground truth — I could be wrong about my own work, and finding a place where the code doesn't match this description is itself a valid finding.

### Complimentary access (`lib/access.ts`, `lib/admin.ts`, `app/api/access/redeem`, `app/go/[token]`)

An account's Firestore user doc can carry `accessOverride: { label, lifetimeGenerations, maxOpenBooks, active }`. Everywhere `lib/billing.ts` decides "does this account have access" or "can it generate another book," it checks this override *first*, before falling back to plan/trial/family logic. Two accounts carry one right now: `founders@bookworm-ai.app` (1 lifetime generation, 1 open book — a podcast-demo account) and `hudson@bookworm-ai.app` (unlimited generations, 5 open books — a shared parent/child reading account).

Sign-in for these happens at `/go/<token>`: the route looks up `accessLinks/{token}`, checks the link is `active` *and* the target account's `accessOverride.active` is true, mints a Firebase custom token, and the browser exchanges it via `signInWithCustomToken`. No password is ever involved in this path — that's the point, not an oversight; the whole reason this exists is so someone can tap a link with zero setup.

The kill switch (toggling a link in `/admin`) writes to *both* `accessLinks/{token}.active` and the account's `accessOverride.active` in the same call, because every access check re-reads `accessOverride.active` live — there's no cached "you're allowed in" session flag. My intent was that this revokes instantly, even for someone already mid-session. **Verify that intent actually holds** — it's the single most important behavioral claim in this whole system.

`accessOverride` is in `firestore.rules`' server-only field list (a client can't write it), and `accessLinks/*` documents are unreadable/unwritable by clients in both directions — every touch goes through `/api/access/redeem` (redeem-only, unauthenticated by necessity) or `/api/admin/links` (list/toggle, gated to the admin email).

### Book Club sharing (`lib/book-club.ts`, `lib/family-server.ts`, `app/api/family/*`, `lib/account-delete.ts`, `app/api/cron/purge-removed-members`)

Sharing a book takes a **snapshot** of it (days, lessons, flashcards, at the moment of sharing) into `families/{familyId}/sharedBooks/{shareId}`, where `shareId = <sharerUid>_<courseId>`. Deliberately a copy, not a live reference: the sharer's later edits to their own course don't propagate, and opening a shared book never triggers regeneration or spends anyone's quota.

When a member opens a shared book, the server creates — once — a copy of that snapshot in *their own* `users/{uid}/courses/{shareId}`, tagged `sharedFrom`. From then on their progress is just an ordinary write to their own document; there's no shared mutable state between members to keep consistent, by construction. This copy is also excluded from that member's personal open-book cap (`personalCourses()` filters anything with `sharedFrom` set) — a shared book costs the recipient nothing.

The load-bearing claim I want checked hardest: **"access to a shared book IS the copy."** Unsharing, removing a member, an owner downgrading tier, and an owner deleting their account are each supposed to delete every affected copy from every affected member's own collection, not just the shared snapshot. Three of those four paths (downgrade, delete-account, remove-member) are separate pieces of pre-existing or newly-added code that each had to be taught this rule independently — that's exactly the shape of thing where one path gets it right and a sibling path gets missed. Trace all four and see if they actually agree.

Removing a member clears their `familyId` (which alone is what grants Book Club access — see `getEffectivePlanId`), and — only if they have no other paid access or trial of their own — sets `bookClubDeleteAt` 7 days out. A daily Vercel Cron (`purge-removed-members`, the only scheduled job in this app) re-checks access before deleting in case they converted to a plan in the meantime, then actually deletes the account. This is the first code path in the app that can delete a real account with no human in the loop — treat it accordingly.

### Admin control centre + payments (`app/admin/page.tsx`, `lib/admin.ts`, `app/api/admin/*`)

Gating is one hardcoded email. The `/admin` page redirecting a non-admin away is UX, not the security boundary — the boundary is that every `/api/admin/*` route independently verifies the caller's Firebase ID token server-side and checks the *decoded token's* email, never anything the client asserts. If you find any admin data reachable without that check on the *route* itself, that's a P1 regardless of what the page does.

Metrics are computed live on every dashboard load — full `listUsers` (paginated) plus a full scan of the Firestore users/courses/families collections, no caching or pre-aggregation. That's a stated, deliberate tradeoff for the current account count (a few hundred), not an oversight. Flag it if you think the current scale already makes it a real problem; don't "fix" it by adding a caching layer unless you conclude it's actually necessary now.

Payments reads the last 50 charges directly from Stripe — not from Firestore, which only reflects what the app *believes* happened — and matches them back to Bookworm accounts by `stripeCustomerId`. Refunds are full-amount only (no partial refund UI exists), gated behind a two-step confirm.

## This is a follow-up audit, not the first one

A prior audit (same repo, different model) produced a 33-finding report on 2026-09-10. That report is no longer in the working tree, but it's recoverable from git history if you want the full text:

```bash
git show 2961b4a:CODEX_AUDIT_REPORT.md
```

Its findings, in short: P1s around missing server-side auth/quota enforcement on the AI generation endpoints, account-deletion not confirming Stripe cancellation first, non-idempotent subscription creation, Stripe webhook replay/ordering corrupting entitlements, stale Book-Club-family lookups after a rejoin, same-plan "upgrades" resetting quota for free, paid entitlement granted before confirming payment succeeded, a Firestore rule allowing the generation counter to be deleted, whole-course autosave overwriting newer data from another tab/device, and a generation result able to land on the wrong account after a fast account switch. Several P2s were fixed in that pass (stuck-generating state, network-error handling, stale-closure course creation, a `reading-prefs` prototype-pollution-shaped bug); several P1s were reported but *not* fixed, on the audit's own account.

**Your job:** don't take any of that as settled. Re-check each of those specific claims against the *current* code — some may have been fixed since by other work, some may not have been touched at all. State plainly, for each one you can still locate, whether it's fixed, still open, or was superseded by a later rewrite of that area. Then do a full independent sweep of your own on top of that — don't limit yourself to the old list.

## What's changed since that audit (why a re-check matters now)

Every commit since the audited commit (`2961b4a`), oldest first — do not rely on a summary of these, including the grouped one below; if you want the exact wording, run `git log --oneline 2961b4a..HEAD` and `git show <hash>` yourself:

1. `7cd34a3` Give Personal Development its own art, and give every book a real cover
2. `781a83d` Swap in the re-exported brand art and the de-dotted wordmark
3. `9da0d22` **Stop putting the wrong book's cover on the shelf** — the cover lookup was taking Google Books' first (sometimes wrong) result on faith; it now requires a normalized title match against 5 candidates. **This is the same bug class as the prior audit's finding #23 ("Curated-book lookup can substitute a different book") — specifically re-verify that finding against this fix, and check whether the same "trust the first result" pattern still exists anywhere else that does a lookup (e.g. any other Google Books call site).**
4. `7c6cfa5` Right-align the text on the Personal Development cards (cosmetic)
5. `909f1ea` Drop the dot from every "Bookworm.AI" text reference, add a Napoleon Hill title (cosmetic/content)
6. `f6484ff` **Let the next-day card start tomorrow's lesson, not just preview it** — adds a *new* UI path (a tap on the "Tomorrow · Day N" card) that can mark a day complete and trigger generating the next day's content, reusing the same completion/generation functions the existing day-list buttons use. **This is new surface in exactly the area the prior audit's findings #1 (no server-side generation quota enforcement), #17 (stale-closure course creation), and #18 (direct navigation bypassing caps) were about, and it did not exist when that audit ran. Check specifically: can this new tap path be used to double-count a completion, race with the existing day-list completion button, or generate content the reader hasn't actually paid for.**
7. `565eb75` Use the same branded fallback cover everywhere a book has no art (unifies the "no cover" placeholder across search and Personal Development)
8. `9d6b028` Point onboarding at the library, and recommend from it — `lib/genres.ts` (onboarding topic list) now derives from `lib/mastery-library.ts` instead of a separate hardcoded list
9. `5438143` Add the background art for the four new pillars (asset-only)
10. `7650d78` Recommend across three pillars, and make the back arrow hittable — fixes the "Recommended for you" shelf always drawing from one stale pillar, plus a mobile tap-target fix
11. `a9197f8` Stop retired topics from locking the preferences picker — a saved-but-no-longer-offered onboarding topic was silently occupying one of the 3 preference slots, making the Profile picker un-editable
12. `4e8209b` Give the phone-width greeting and flashcard buttons real margin (two physical-device-only mobile layout fixes)
13. `c465e8d` **Let a Book Club share books, and manage its own seats** — the $34.99 tier's actual sharing feature: a member can put one of their own books on the club's shared shelf (a snapshot copy taken at share time, not a live reference — no regeneration, no shared generation cost charged to anyone); each member who opens a shared book gets their own independent copy/progress; the owner can remove a member, which revokes their access to every shared book immediately and starts a 7-day account-deletion countdown *unless* the removed member already has their own paid access or trial; a new scheduled job (Vercel Cron, daily, `/api/cron/purge-removed-members`) deletes accounts whose countdown expired without the reader choosing a plan.
14. `3ffa69b` **Add complimentary access, sign-in links, and a control centre** — `lib/access.ts` / `app/api/access/redeem/route.ts` / `app/go/[token]/page.tsx`: specific accounts can carry an `accessOverride` that skips billing entirely (a lifetime generation cap, a shelf cap, an on/off switch); visiting `/go/<token>` signs the visitor in via a Firebase custom token with **no password at all** — this exists for a podcast-demo account (1 book, then it stops) and a family reading account (unlimited books, 5 open at a time). Also adds `app/admin/page.tsx` / `app/api/admin/*`, a dashboard gated to one hardcoded email (`lib/admin.ts`), showing metrics from Firebase Auth `listUsers` + full Firestore scans (no caching/aggregation yet).
15. `da5c3da` **Show the money in the control centre, and the way back** — adds `app/api/admin/payments/route.ts`: lists the last 50 Stripe charges and issues full (non-partial) refunds from a confirm-armed button in the admin dashboard.

Commits 3, 6, 13, 14, and 15 are the ones that matter most for this audit — they either intersect a previously-flagged bug class (3, 6) or are brand-new financial/access/admin surface that didn't exist for the last audit at all (13, 14, 15). Give 13–15 in particular the same level of scrutiny the P1 list above got — arguably more, since a bypass-auth mechanism and a refund button are exactly the shape of thing that's cheap to get wrong.

Specific things worth trying to break:
- Can the `/api/admin/*` routes be reached, or made to leak data, by anyone whose *token* doesn't carry the admin email — not just anyone who isn't shown the `/admin` page in the UI? The UI-level redirect is not the security boundary; the routes are supposed to check the verified token server-side.
- Does turning a `/go/<token>` link off in the admin panel actually revoke access for someone *already signed in* through it, or only stop the link from working for a new visit? (The intent, per the code's own comments, is the former — verify it.)
- Is `accessOverride` actually unwritable by a client now that `firestore.rules` was updated and redeployed? Don't just read the rules file — think about whether every write path (including any `merge: true`/dot-path update) is covered.
- Can the refund route be called twice concurrently on the same charge, or with a forged/foreign `chargeId`, and does it check that the charge belongs to *this app's* Stripe account context sensibly?
- Book Club's `remove-member`, `share`, and `unshare` routes all do multi-document writes (family doc + N members' course subcollections) without a Firestore transaction. Two of the old P1s were exactly this class of bug (idempotency, races) in the billing code — check whether the same class of bug exists here: concurrent removals, a share/unshare race, or a partial-failure leaving copies orphaned on some members but not others.
- The admin metrics route reads every user document and every course document (via `collectionGroup`) on every dashboard load, with `listUsers` paginated at 1000. At current scale that's fine and was a deliberate, stated tradeoff — but confirm there's no way for a non-admin to trigger this expensive path, and flag (don't fix) if it's now handling enough data that this should change.

## Priority scheme and finding format (match the prior audit's convention)

- **P1** — financial, access-control, or substantial data-loss risk.
- **P2** — functional defect a real user would hit.
- **P3** — maintenance, performance, or code-quality concern.

For every finding: cite the exact file and line. State whether it's a **real bug**, an **intentional/by-design choice** (and why you believe that, e.g. an explicit comment), or a **previously-reported item** (say what its status is now). Don't flag a deliberate product decision as a bug just because it's unusual — the 7-day course expiry, the trial-only-on-Page-Turner rule, and the family-plan generation split are all intentional.

## Fix policy — this round is different from the last audit

The last audit only fixed what it called "narrow correctness fixes" — self-contained bugs with one obviously-right answer — and *reported without fixing* every P1, because each of those had a real business decision buried in it, not just a code error. That distinction was correct, and it still applies. What's changed is the default: **this time, fix everything you find, including P1s, unless the correct fix genuinely depends on a decision only the founder can make.**

Concretely:
- If a bug has one defensible correct behavior an engineer can determine from the existing code, comments, and product intent (e.g. "this counter should never go negative," "this write should be atomic," "this token should stop working the instant it's deactivated") — **fix it**, don't just report it.
- If the fix requires choosing between two or more legitimate product behaviors (the last audit's own examples: what a subscriber sees when their card fails on reactivation, how long a grace period should be, whether a mid-period tier change should reset or prorate the quota) — **do not guess**. Describe the tradeoff plainly, recommend the option you'd pick and why, and implement your recommendation as the fix, but call it out clearly in the report as a policy call rather than a pure bug fix, so it gets a second look. Don't silently leave it unfixed either — a described, reversible, clearly-labeled judgment call beats an unresolved P1.
- Money-moving and destructive *actions* stay completely off-limits regardless of the above — this is about fixing *code*, not performing *operations*. No live refunds, no real account deletions, no production book generations, no commits, no pushes, no deployments. If a bug can only be verified by doing one of those, describe exactly how you verified it another way (test-mode Stripe, an emulator, a throwaway account you create and delete yourself) instead.
- `firestore.rules`: you may edit it as part of a fix (e.g. closing a gap like the deletable-counter finding). State plainly that a rules change requires `firebase deploy --only firestore:rules --project bookworm-ai-ca43d` to actually take effect — you cannot run that yourself in this pass, so it is not fixed until that command is run.
- Billing *architecture* (switching providers, redesigning the entitlement model, adding a new payment method) is out of scope for a fix — report it. Billing *bugs* (a race condition, a missing idempotency key, a wrong condition on an existing check) are in scope to fix.
- AI prompts (`lib/*-prompts.ts`) and visual styling/copy: leave these alone even if you spot something you'd phrase differently — these are product/brand decisions, not correctness bugs, unless a prompt is producing something that actually breaks a downstream consumer (e.g. its own output doesn't match the schema the code expects), in which case that mismatch is a real bug and is in scope.
- Don't delete routes, files, or dependencies, even ones that look dead — report them (the last audit found several legacy routes with no callers; recheck whether they're still there and still dead before recommending removal).
- Preserve existing code comments and intentional constraints described in them — they usually explain a real prior bug, not a style preference. If a fix would contradict one of these comments, that's a sign to slow down and re-read why the constraint exists before overriding it.
- Test accounts you create for verification must be deleted afterward, and you must confirm the deletion (don't just delete-and-assume). Never touch the real `christopher@godz-iagency.com`, `founders@bookworm-ai.app`, or `hudson@bookworm-ai.app` accounts.

## Verification required for every fix

- `npx tsc --noEmit` clean, before and after.
- `npm run build` clean.
- `node tests/audit-regressions.cjs` (already in the repo from the last audit) still passes; add regression coverage for what you fixed rather than replacing the suite wholesale.
- `git diff --check` clean.
- For anything Firestore-rules-shaped, reason about it directly and verify with the local emulator if one is available — you cannot deploy rules yourself, so state clearly what you verified by reading/emulating vs. what only takes effect once the founder deploys.
- For each fix, name what you'd need to see in production afterward to be sure it actually worked (a specific log line, a specific Stripe event, a specific Firestore field) — you're not claiming the fix is *proven* correct in production, just that it's correct as far as this pass could verify.

## Output

A single markdown report, same shape as the last one, plus one addition: a short summary of what changed and what didn't, then prioritized findings (P1s first) with file:line citations and, for each, a disposition of **fixed** / **fixed — policy call, please review** / **reported only, needs your decision first** / **previously reported, now confirmed resolved by other work** / **intentional, not a bug** — then a "Verification and limits" section stating exactly what commands you ran, what you couldn't test, and a plain list of every file you touched.
