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
