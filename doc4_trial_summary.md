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
