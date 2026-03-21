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
