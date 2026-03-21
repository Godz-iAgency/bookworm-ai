# BOOKWORM.AI — UI/UX DESIGN STANDARDS
**Version 1.0 | Claude Sonnet 4.6**
**This document governs every screen in the app.
Paste it at the top of every Antigravity prompt as the design brief.**

---

## THE DESIGN IDENTITY

Bookworm.AI is not a utility app. It is a reading experience. The design must
reflect that — every screen should feel like the app was made by people who
love books, love learning, and built something they would use themselves.

The aesthetic direction: **refined dark luxury with editorial warmth.**

Not cold. Not clinical. Not another dark SaaS dashboard.
Think: a beautifully designed reading lamp in a dark room.
Warm light on rich content. Calm focus. Everything in its place.

The one thing a user will remember: the feeling that this app
respects their attention and makes learning feel like a reward,
not a task.

---

## BRAND TOKENS — USE THESE EXACTLY

```css
:root {
  /* Core palette */
  --bg:           #080808;       /* Near black — deeper than #0a0a0a */
  --surface:      #111111;       /* Card backgrounds */
  --surface-2:    #1a1a1a;       /* Elevated cards, inputs */
  --surface-3:    #222222;       /* Hover states */
  --border:       rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);

  /* Gradient — cyan to pink, the brand signature */
  --cyan:         #00d4ff;
  --pink:         #ff2d78;
  --gradient:     linear-gradient(135deg, #00d4ff, #ff2d78);
  --gradient-text: linear-gradient(135deg, #00d4ff, #ff2d78);

  /* Warm reading accent — for lesson content only */
  --amber:        #f59e0b;
  --amber-soft:   rgba(245,158,11,0.15);

  /* Text */
  --text:         #f0f0f0;       /* Not pure white — easier on eyes */
  --text-muted:   #666666;
  --text-faint:   #333333;

  /* Status */
  --green:        #10b981;
  --green-soft:   rgba(16,185,129,0.15);
  --amber-status: #f59e0b;
  --amber-soft:   rgba(245,158,11,0.12);
  --red:          #ef4444;
  --red-soft:     rgba(239,68,68,0.12);

  /* Spacing */
  --radius-sm:    8px;
  --radius:       14px;
  --radius-lg:    20px;
  --radius-full:  9999px;

  /* Touch */
  --touch-min:    48px;

  /* Typography */
  --font-ui:      'DM Sans', system-ui, sans-serif;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-read:    'Lora', Georgia, serif;

  /* Shadows */
  --shadow-card:  0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow-cyan: 0 0 20px rgba(0,212,255,0.15);
  --shadow-glow-pink: 0 0 20px rgba(255,45,120,0.15);
}
```

---

## TYPOGRAPHY SYSTEM

### Font Roles

**DM Sans** — all UI elements: navigation, buttons, labels, captions, body copy outside lessons.
Clean, geometric, confident. Pairs perfectly with Playfair.

**Playfair Display** — headings, screen titles, the brand name.
Editorial and literary. Signals that this is a reading app, not a dashboard.

**Lora** — lesson content only.
A reading font. Serif, warm, optimized for sustained reading.
Kindle users spend time reading lessons — they deserve a reading experience.

### Type Scale

```css
/* Display — screen titles, hero headings */
.text-display {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* Heading — section titles, card titles */
.text-heading {
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
}

/* UI Body — all interface copy */
.text-body {
  font-family: var(--font-ui);
  font-size: 1rem;           /* 16px — never smaller on mobile */
  line-height: 1.6;
  font-weight: 400;
}

/* Label — tags, badges, metadata */
.text-label {
  font-family: var(--font-ui);
  font-size: 0.75rem;        /* 12px */
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Reading — lesson content */
.text-read {
  font-family: var(--font-read);
  font-size: 1.125rem;       /* 18px */
  line-height: 1.85;
  letter-spacing: 0.01em;
  max-width: 65ch;           /* Optimal reading width */
}
```

---

## LAYOUT PRINCIPLES

### Single Column Flow
Every screen is single column on mobile. No side-by-side panels.
Content stacks vertically, reads top to bottom.
Max content width: 680px, centered.

### Breathing Room
Generous padding is not wasted space. It is the design.
Minimum vertical padding between sections: 32px.
Content padding from screen edges: 20px on mobile, 32px on tablet.

### Visual Hierarchy — Three Levels Only
1. Primary — the one thing the user needs to do or read right now.
   Largest text, highest contrast, most space around it.
2. Secondary — supporting context, descriptive text.
   Muted color, smaller size, less space.
3. Tertiary — metadata, labels, hints.
   Faintest color, smallest text. Should not compete.

Never let levels two and three fight for attention with level one.

### Cards
Cards have subtle borders, not heavy outlines.
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow-card);
  transition: border-color 200ms ease, transform 200ms ease;
}
.card:hover {
  border-color: var(--border-hover);
  transform: translateY(-1px);
}
```

Selected or active cards get the gradient border treatment:
```css
.card-selected {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--surface), var(--surface)) padding-box,
    var(--gradient) border-box;
  box-shadow: var(--shadow-glow-cyan);
}
```

---

## MOTION AND ANIMATION

### Philosophy
One well-timed animation creates more delight than ten scattered ones.
Use motion to guide attention, confirm actions, and reward completion.
Never animate for decoration alone.

### Staggered Page Entry
Every screen enters with a staggered reveal — elements appear
sequentially from top to bottom, 60ms apart.

```css
.fade-up {
  opacity: 0;
  transform: translateY(16px);
  animation: fadeUp 400ms ease forwards;
}
.fade-up:nth-child(1) { animation-delay: 0ms; }
.fade-up:nth-child(2) { animation-delay: 60ms; }
.fade-up:nth-child(3) { animation-delay: 120ms; }
.fade-up:nth-child(4) { animation-delay: 180ms; }
.fade-up:nth-child(5) { animation-delay: 240ms; }

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}
```

### Button Press
All buttons have a tactile press feeling:
```css
button:active {
  transform: scale(0.97);
  transition: transform 80ms ease;
}
```

### Gradient Button Shimmer
The primary gradient CTA button has a subtle shimmer on hover —
a light sweep across the gradient surface.

```css
.btn-gradient {
  position: relative;
  background: var(--gradient);
  overflow: hidden;
}
.btn-gradient::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255,255,255,0.15) 50%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 0ms;
}
.btn-gradient:hover::after {
  transform: translateX(100%);
  transition: transform 500ms ease;
}
```

### Loading States
Never show a spinner alone. Show a skeleton that matches the
shape of the content that is loading.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--surface-2) 50%,
    var(--surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Flashcard Flip
The signature interaction of the app. Must be flawless.
```css
.flashcard-scene {
  perspective: 1200px;
}
.flashcard {
  transform-style: preserve-3d;
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
.flashcard.flipped {
  transform: rotateY(180deg);
}
.flashcard-front,
.flashcard-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flashcard-back {
  transform: rotateY(180deg);
}
```

### Progress Bar
Course generation progress bar — smooth, animated fill.
```css
.progress-bar {
  height: 3px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--gradient);
  border-radius: var(--radius-full);
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## INTERACTION STANDARDS

### Touch Targets
Every tappable element: minimum 48px height, minimum 44px width.
Add padding around small icons to hit the minimum without
making the visual element look large.

```css
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 150ms ease;
}
.icon-btn:hover {
  background: var(--surface-2);
}
```

### Focus States
Every interactive element must have a visible focus ring for
keyboard and accessibility. Kindles support keyboard navigation.

```css
:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

### No Hover-Only Interactions
Kindle Fire has no hover state. Every interactive behavior
triggered by hover must also work on tap.

### Disabled States
Disabled buttons are not just opacity 50%. They communicate
what is needed to enable them.
Example: "Generate My Course →" button shows as disabled with
a subtle tooltip or label: "Select a reading level to continue."

---

## SCREEN-BY-SCREEN DESIGN DIRECTION

### Landing Page / Auth Screen
Tone: invitation. The user is arriving somewhere worth coming to.
Background: pure dark with an extremely subtle radial gradient
blooming from center — barely perceptible warm glow.
The Bookworm.AI logo uses Playfair Display with the gradient
applied to the text itself (background-clip: text).
The tagline "Your books. Seven days. Transformed." sits below
in DM Sans, muted, generous letter-spacing.
No clutter. No features list. One clear action.

### Book Search Screen
Tone: focused and responsive. The user has one job here.
The search input is the hero element — centered, large, warm
border glow on focus (cyan, soft).
Search results animate in with a gentle slide up.
The confirmation card feels like picking up a physical book —
the cover image has a subtle shadow and slight tilt on hover.

### Reading Level Screen
Tone: personal and considered. This is the user making a choice
about how they want to learn.
The four cards are generous — not cramped. Each has an icon,
a level name in Playfair Display, and a one-line description.
Selected state: gradient border glow + a faint gradient background
wash inside the card (very subtle — just enough to feel alive).
The cards animate in with staggered delay.

### Course Preview / Soft Gate
Tone: anticipation. The user can see what they are about to get.
The locked day cards have a subtle lock icon and a translucent
overlay — not fully opaque. The lesson titles are visible beneath,
creating a sense of "almost there."
The card form (Stripe Elements) is embedded with a warm border
and a padlock icon at the top right corner — communicating
security without a heavy "Secure Checkout" banner.
The CTA button is the largest, most prominent element on screen.

### Dashboard
Tone: calm command. The user is in control of their learning.
The My Library shelf is a horizontal scroll row with book cards
that feel like physical books on a shelf — slightly different
heights add organic rhythm.
The active book card has a gentle gradient glow behind it.
The generating card pulses — but slowly and warmly,
not urgently. Learning is not a timer. The urgency lives
in the day countdown, not the loading animation.

### 7-Day Course Tab
Tone: editorial. This is the reading experience.
Day cards are clean and wide — the lesson title in Playfair,
the metadata (read time, status) in DM Sans below.
When a day card expands, it does so smoothly — max-height
transition with a subtle fade in of the content.
Lesson content uses Lora at 18px with generous line height.
The "Mark Day Complete" button is full width, gradient,
at the very bottom of the lesson. The user scrolls to earn it.

### AI Chat Tab
Tone: intimate and responsive. This is a conversation.
User messages: right-aligned, gradient background, rounded
corner on the bottom-right is square (speech bubble asymmetry).
AI messages: left-aligned, dark surface, small Bookworm icon
avatar at the top-left of the first message in a group.
The typing indicator is three dots that breathe — scale
animation, staggered, warm amber color.
The input bar is minimal — no heavy border, just a soft
separator line. The send button only appears when text is entered.

### Flashcard Tab
Tone: playful focus. This is active recall — it should feel
like a game that respects your intelligence.
The flashcard is large, centered, and slightly elevated with
a deep shadow — it feels like a physical card.
Front face: the question in Playfair Display, centered.
Back face: the answer in Lora, left-aligned for readability.
Swipe gesture has a directional visual cue — the card tilts
slightly in the swipe direction before animating out.
"Got It" swipe: card exits right with a green flash.
"Review Again" swipe: card exits left with a subtle amber flash.
The mastery counter increments with a micro-bounce animation.

---

## MICRO-COPY STANDARDS

Every label, placeholder, error, and empty state must be written
in the voice of someone who loves books and respects the user.

### Tone Rules
- Direct but warm. Never cold. Never corporate.
- Present tense. Active voice.
- Short sentences. Reading apps should not make users read
  long instructions.
- Never say "Please." It is filler.
- Never say "Successfully." If the action worked, show it.

### Examples

| Context | Bad | Good |
|---|---|---|
| Search placeholder | "Enter book title..." | "What are you reading?" |
| Loading course | "Loading..." | "Preparing your course" |
| Day locked | "This content is locked" | "Complete Day 2 to unlock this" |
| Error: search failed | "An error occurred" | "Search hit a snag. Try again." |
| Empty chat | "No messages yet" | "Ask the book anything" |
| Card saved | "Payment method saved successfully" | "You are all set." |
| Trial banner | "Your trial expires soon" | "Your trial ends in 3 days — your book disappears with it." |
| Flashcard complete | "You have completed all flashcards" | "All 20 mastered. You know this book." |

---

## ACCESSIBILITY STANDARDS

These are not optional. Kindle Fire runs on Android — standard
Android accessibility tools apply.

- All images have descriptive alt text
- Color is never the only indicator of state — always pair
  with an icon or label
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- All interactive elements reachable by tab key
- Touch targets minimum 48x48px
- Error messages linked to their inputs via aria-describedby
- Loading states announced to screen readers via aria-live

---

## KINDLE FIRE SPECIFIC RULES

- Font size minimum 16px everywhere — prevents auto-zoom on input focus
- No `position: fixed` on elements that sit above the keyboard —
  use `position: sticky` with JavaScript viewport height adjustment
- Test all tap targets at 768px viewport width (Kindle Fire HD 8 portrait)
- Avoid multi-column layouts below 800px
- Ensure horizontal scroll only exists where intentional
  (My Library shelf) — never as overflow from content

---

## HOW TO USE THIS DOCUMENT IN ANTIGRAVITY

Paste the following block at the very top of every Antigravity
screen prompt, before the layout and feature requirements:

--- DESIGN BRIEF ---
Apply the Bookworm.AI design system to this screen.
Aesthetic: refined dark luxury with editorial warmth.
Fonts: Playfair Display for headings, DM Sans for UI copy,
Lora for lesson reading content.
Colors: --bg #080808, --surface #111111, gradient #00d4ff to #ff2d78.
Motion: staggered fade-up entry (60ms delay between elements),
shimmer on CTA button hover, tactile press on all buttons.
Touch targets: 48px minimum height on all interactive elements.
Mobile first: single column, max-width 680px content, 20px edge padding.
Kindle Fire: 768px viewport, no hover-only interactions,
16px minimum font size on all inputs.
This screen must feel like it was designed by someone who loves books.
--- END DESIGN BRIEF ---
