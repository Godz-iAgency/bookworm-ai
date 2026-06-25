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
