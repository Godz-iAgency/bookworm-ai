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
