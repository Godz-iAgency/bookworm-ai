/**
 * The Personal Development library: six pillars, 25 books each.
 *
 * Separate from the main course flow on purpose. A course turns a book the
 * reader searched for into a 7-day arc with chat and flashcards; a mastery
 * summary is a single long-form read of a book from this fixed shelf, with
 * none of that scaffolding. Different shape, different route, different
 * storage collection.
 */

export interface MasteryBook {
  /** Stable url-safe id, derived once here rather than recomputed per render. */
  slug: string;
  title: string;
  author: string;
}

export interface MasteryPillar {
  slug: string;
  name: string;
  /** One line shown under the pillar name on the category grid. */
  blurb: string;
  books: MasteryBook[];
}

/** "The Challenger Sale" -> "the-challenger-sale" */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shelf(titles: [string, string][]): MasteryBook[] {
  return titles.map(([title, author]) => ({ slug: slugify(title), title, author }));
}

export const MASTERY_PILLARS: MasteryPillar[] = [
  {
    slug: "sales",
    name: "Sales",
    blurb: "Persuasion, prospecting, and closing.",
    books: shelf([
      ["The Challenger Sale", "Brent Adamson"],
      ["The Psychology of Selling", "Brian Tracy"],
      ["Spin Selling", "Neil Rackham"],
      ["To Sell Is Human", "Daniel H. Pink"],
      ["Fanatical Prospecting", "Jeb Blount"],
      ["Sell or Be Sold", "Grant Cardone"],
      ["Little Red Book of Selling", "Jeffrey Gitomer"],
      ["Secrets of Closing the Sale", "Zig Ziglar"],
      ["Way of the Wolf", "Jordan Belfort"],
      ["Influence", "Robert Cialdini"],
      ["Gap Selling", "Keenan"],
      ["Sales EQ", "Jeb Blount"],
      ["New Sales. Simplified.", "Mike Weinberg"],
      ["The Ultimate Sales Machine", "Chet Holmes"],
      ["Selling 101", "Zig Ziglar"],
      ["The Sales Acceleration Formula", "Mark Roberge"],
      ["Pitch Anything", "Oren Klaff"],
      ["Objections", "Jeb Blount"],
      ["High-Profit Prospecting", "Mark Hunter"],
      ["The Art of Closing the Sale", "Brian Tracy"],
      ["Sell Different!", "Lee B. Salz"],
      ["You Can't Teach a Kid to Ride a Bike at a Seminar", "David Sandler"],
      ["Smart Calling", "Art Sobczak"],
      ["Insight Selling", "Mike Schultz"],
      ["The Go-Giver", "Bob Burg"],
    ]),
  },
  {
    slug: "negotiation",
    name: "Negotiation",
    blurb: "Leverage, framing, and hard conversations.",
    books: shelf([
      ["Never Split the Difference", "Chris Voss"],
      ["Getting to Yes", "Roger Fisher"],
      ["Bargaining for Advantage", "G. Richard Shell"],
      ["Negotiation Genius", "Deepak Malhotra"],
      ["Getting Past No", "William Ury"],
      ["You Can Negotiate Anything", "Herb Cohen"],
      ["The Art of Negotiation", "Michael Wheeler"],
      ["Crucial Conversations", "Kerry Patterson"],
      ["Negotiating the Impossible", "Deepak Malhotra"],
      ["Getting More", "Stuart Diamond"],
      ["Pre-Suasion", "Robert Cialdini"],
      ["Secrets of Power Negotiating", "Roger Dawson"],
      ["Ask for More", "Alexandra Carter"],
      ["Difficult Conversations", "Douglas Stone"],
      ["3-D Negotiation", "David Lax"],
      ["The Power of a Positive No", "William Ury"],
      ["Start with No", "Jim Camp"],
      ["Beyond Winning", "Robert Mnookin"],
      ["Negotiating at Work", "Deborah M. Kolb"],
      ["The Book of Real-World Negotiations", "Joshua N. Weiss"],
      ["The Negotiator's Fieldbook", "Christopher Honeyman"],
      ["Say Less, Get More", "Fotini Iconomopoulos"],
      ["Winning Together", "Bruno S. Frey"],
      ["Everything is Negotiable", "Gavin Kennedy"],
      ["Trump: The Art of the Deal", "Donald J. Trump"],
    ]),
  },
  {
    slug: "human-nature",
    name: "Human Nature",
    blurb: "Why people actually do what they do.",
    books: shelf([
      ["The Laws of Human Nature", "Robert Greene"],
      ["Sapiens", "Yuval Noah Harari"],
      ["Thinking, Fast and Slow", "Daniel Kahneman"],
      ["Man's Search for Meaning", "Viktor Frankl"],
      ["The 48 Laws of Power", "Robert Greene"],
      ["How to Win Friends & Influence People", "Dale Carnegie"],
      ["Behave", "Robert Sapolsky"],
      ["Quiet", "Susan Cain"],
      ["The Blank Slate", "Steven Pinker"],
      ["Predictably Irrational", "Dan Ariely"],
      ["The Righteous Mind", "Jonathan Haidt"],
      ["Outliers", "Malcolm Gladwell"],
      ["Talking to Strangers", "Malcolm Gladwell"],
      ["The Better Angels of Our Nature", "Steven Pinker"],
      ["Meditations", "Marcus Aurelius"],
      ["Lord of the Flies", "William Golding"],
      ["The Power of Habit", "Charles Duhigg"],
      ["Blink", "Malcolm Gladwell"],
      ["12 Rules for Life", "Jordan B. Peterson"],
      ["The Red Queen", "Matt Ridley"],
      ["Animal Farm", "George Orwell"],
      ["Games People Play", "Eric Berne"],
      ["Drive", "Daniel H. Pink"],
      ["The Selfish Gene", "Richard Dawkins"],
      ["Flow", "Mihaly Csikszentmihalyi"],
    ]),
  },
  {
    slug: "money",
    name: "Money",
    blurb: "Earning, keeping, and compounding it.",
    books: shelf([
      ["The Psychology of Money", "Morgan Housel"],
      ["Rich Dad Poor Dad", "Robert Kiyosaki"],
      ["The Total Money Makeover", "Dave Ramsey"],
      ["The Intelligent Investor", "Benjamin Graham"],
      ["The Millionaire Next Door", "Thomas J. Stanley"],
      ["I Will Teach You to Be Rich", "Ramit Sethi"],
      ["The Richest Man in Babylon", "George S. Clason"],
      ["The Simple Path to Wealth", "JL Collins"],
      ["Money: Master the Game", "Tony Robbins"],
      ["Think and Grow Rich", "Napoleon Hill"],
      ["Principles", "Ray Dalio"],
      ["A Random Walk Down Wall Street", "Burton Malkiel"],
      ["Your Money or Your Life", "Vicki Robin"],
      ["Broke Millennial", "Erin Lowry"],
      ["The Little Book of Common Sense Investing", "John C. Bogle"],
      ["The Creature from Jekyll Island", "G. Edward Griffin"],
      ["Die with Zero", "Bill Perkins"],
      ["The Alchemist of Finance", "George Soros"],
      ["Financial Feminist", "Tori Dunlap"],
      ["How to Make Money in Stocks", "William O'Neil"],
      ["The Coffeehouse Investor", "Bill Schultheis"],
      ["One Up On Wall Street", "Peter Lynch"],
      ["The Art of Spending Money", "Morgan Housel"],
      ["Wealth Warrior", "Linda Garcia"],
      ["Finance for the People", "Paco de Leon"],
    ]),
  },
  {
    slug: "business",
    name: "Business",
    blurb: "Building things that last and scale.",
    books: shelf([
      ["Good to Great", "Jim Collins"],
      ["The E-Myth Revisited", "Michael Gerber"],
      ["The Innovator's Dilemma", "Clayton Christensen"],
      ["Built to Last", "Jim Collins"],
      ["Zero to One", "Peter Thiel"],
      ["Start with Why", "Simon Sinek"],
      ["Blue Ocean Strategy", "W. Chan Kim"],
      ["The Lean Startup", "Eric Ries"],
      ["Atomic Habits", "James Clear"],
      ["The Hard Thing About Hard Things", "Ben Horowitz"],
      ["Measure What Matters", "John Doerr"],
      ["High Output Management", "Andrew Grove"],
      ["Shoe Dog", "Phil Knight"],
      ["Competitive Strategy", "Michael Porter"],
      ["Scaling Up", "Verne Harnish"],
      ["Profit First", "Mike Michalowicz"],
      ["The Goal", "Eliyahu M. Goldratt"],
      ["Crossing the Chasm", "Geoffrey Moore"],
      ["Leaders Eat Last", "Simon Sinek"],
      ["Work Rules!", "Laszlo Bock"],
      ["The 4-Hour Workweek", "Tim Ferriss"],
      ["Deep Work", "Cal Newport"],
      ["Principles: Life and Work", "Ray Dalio"],
      ["Creativity, Inc.", "Ed Catmull"],
      ["The Outsiders", "William N. Thorndike"],
    ]),
  },
  {
    slug: "relentlessness",
    name: "Relentlessness",
    blurb: "Discipline, grit, and refusing to quit.",
    books: shelf([
      ["Can't Hurt Me", "David Goggins"],
      ["Relentless", "Tim S. Grover"],
      ["Grit", "Angela Duckworth"],
      ["Extreme Ownership", "Jocko Willink"],
      ["Unbroken", "Laura Hillenbrand"],
      ["Endurance", "Alfred Lansing"],
      ["The Obstacle Is the Way", "Ryan Holiday"],
      ["Discipline Equals Freedom", "Jocko Willink"],
      ["Never Finished", "David Goggins"],
      ["The War of Art", "Steven Pressfield"],
      ["Mindset", "Carol S. Dweck"],
      ["Antifragile", "Nassim Nicholas Taleb"],
      ["The Comfort Crisis", "Michael Easter"],
      ["Winning", "Tim S. Grover"],
      ["Lone Survivor", "Marcus Luttrell"],
      ["Make Your Bed", "William H. McRaven"],
      ["The 5 AM Club", "Robin Sharma"],
      ["The Art of War", "Sun Tzu"],
      ["Living with a SEAL", "Jesse Itzler"],
      ["Level Up", "Rob Dial"],
      ["The 10X Rule", "Grant Cardone"],
      ["Ego Is the Enemy", "Ryan Holiday"],
      ["Total Recall", "Arnold Schwarzenegger"],
      ["The Spartan Way", "Joe De Sena"],
      ["The Way of the SEAL", "Mark Divine"],
    ]),
  },
];

export function pillarBySlug(slug: string): MasteryPillar | undefined {
  return MASTERY_PILLARS.find((p) => p.slug === slug);
}

export function bookBySlug(pillarSlug: string, bookSlug: string): MasteryBook | undefined {
  return pillarBySlug(pillarSlug)?.books.find((b) => b.slug === bookSlug);
}
