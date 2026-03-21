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
