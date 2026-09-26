import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import Link from "next/link";

/**
 * Public Terms of Service.
 *
 * Linked from the signup screen (see app/auth/page.tsx) and required by
 * Google Play review alongside the privacy policy. Written against how the
 * app actually behaves rather than a generic template: the trial length, the
 * cancellation mechanics and the plan names all match lib/plans.ts and the
 * Stripe routes as they exist in this repo. If those change, this page
 * changes with them.
 *
 * A server component with no client JavaScript, matching app/privacy/page.tsx.
 */

/** Bumped by hand, never generated — see the same note in app/privacy/page.tsx. */
const LAST_UPDATED = "September 26, 2026";
const OPERATOR = "GODZ-i LLC";
const CONTACT_EMAIL = "christopher@godz-iagency.com";
/** GODZ-i LLC is registered in Texas (formed 06/30/2026, per its business profile). */
const GOVERNING_LAW_STATE = "Texas";

export const metadata: Metadata = {
  title: "Terms of Service | Bookworm AI",
  description: "The terms that apply when you use Bookworm AI, including subscriptions, trials and cancellation.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-black tracking-tight text-white">{title}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-[hsl(222,94%,5%)] px-4 py-10">
      <Link href="/" className="shrink-0">
        <Logo variant="stacked" priority className="w-44 drop-shadow-2xl sm:w-52" />
      </Link>

      <article className="mt-6 w-full max-w-2xl pb-16">
        <h1 className="text-2xl font-black tracking-tight text-white">Terms of Service</h1>
        <p className="mt-1.5 text-xs text-white/40">Last updated {LAST_UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-white/70">
          These terms are the agreement between you and {OPERATOR} for using Bookworm AI. By
          creating an account or using the app, you agree to them. If you do not agree, please do
          not use Bookworm AI.
        </p>

        <Section title="What Bookworm AI is">
          <p>
            Bookworm AI turns a book you choose into a 7-day course: one lesson a day, flashcards,
            and a chat assistant grounded in that day&apos;s lesson. The lessons, flashcards and chat
            replies are written by AI language models, not by the book&apos;s author or by us
            personally.
          </p>
          <p className="font-bold text-white">
            AI-generated content can be incomplete or mistaken. Bookworm AI is a study aid, not a
            replacement for the book itself, and not professional, legal, medical or financial
            advice. Use your own judgment before acting on anything a lesson or chat reply tells you.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You must be at least 13 years old to use Bookworm AI. One account is for one person; you
            are responsible for keeping your sign-in secure and for everything that happens under
            your account.
          </p>
          <p>
            A Book Club subscription can be shared with up to three other people. Each member reads
            and progresses through their own books independently; a member cannot regenerate or edit
            a book another member shares with them, only read and discuss it. See the Privacy Policy
            for what each member&apos;s data is used for.
          </p>
        </Section>

        <Section title="Subscriptions and the free trial">
          <p>
            New readers get a 7-day free trial, limited to one book, with no charge on day one.
            Unless you cancel before the trial ends, it converts automatically into a paid Page
            Turner subscription and your card is charged.
          </p>
          <p>
            Paid plans (Page Turner, Well-Read and Book Club) renew automatically each billing period
            at the price shown at checkout, until you cancel. Each plan has its own monthly book
            allowance and limit on books open at once; generating a course or opening another book
            past that limit is not possible until the next billing period or until you free up room
            on your shelf. We may change plan pricing going forward; you will be told before a change
            affects you.
          </p>
          <p>
            Payment is processed by Stripe. We never see or store your full card number.
          </p>
        </Section>

        <Section title="Cancelling and refunds">
          <p>
            You can cancel anytime from the Profile tab in the app. Cancelling stops future billing;
            it does not cut off the access you already paid for; your plan stays active until the end
            of the billing period you already paid for.
          </p>
          <p>
            Payments already made are generally not refunded, including for a partial or unused
            month. If you believe you were charged in error, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Billing%20question`}
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will look into it. Refunds, when given, are at our discretion.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Share your account, or resell or redistribute access to Bookworm AI;</li>
            <li>Scrape, automate, or bulk-download lessons or other content from the app;</li>
            <li>Try to bypass the plan limits, the trial limits, or the paywall;</li>
            <li>Use the app to generate or request unlawful, abusive, or harmful content;</li>
            <li>Interfere with the app&apos;s normal operation or attempt to access another reader&apos;s account or data.</li>
          </ul>
          <p>
            We may suspend or close an account that breaks these terms, that we reasonably believe is
            being used fraudulently, or that has an unpaid or failed subscription charge.
          </p>
        </Section>

        <Section title="Content and ownership">
          <p>
            Bookworm AI does not copy, scan, or access the text of any book. Lessons, flashcards and
            chat replies are written by AI models in their own words, from their general knowledge of
            a book&apos;s ideas. They are original study material, not the book itself, and they are
            not a substitute for reading it.
          </p>
          <p>
            Bookworm AI is independent and is not affiliated with, endorsed by, or sponsored by the
            authors or publishers of the books it covers. Book titles, author names and cover images
            belong to their respective owners and are used only to identify the book.
          </p>
          <p>
            We want you to read the original. At the end of every course, we link to buy the book on
            Amazon, so readers who want the full story can go straight to it. These are Amazon
            Associates affiliate links: we may earn a commission if you buy through one, at no extra
            cost to you. See the Privacy Policy for more on this.
          </p>
          <p>
            The lessons generated for your account are yours to read and use personally for as long
            as your course remains on your shelf.
          </p>
          <p>
            If you are an author or publisher with a concern about how your book is covered, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Rights%20holder%20concern`}
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="No warranty, limits on liability">
          <p>
            Bookworm AI is provided &quot;as is.&quot; We do not promise it will be uninterrupted,
            error-free, or that any lesson is fully accurate to the source book. To the extent the
            law allows, {OPERATOR} is not liable for indirect, incidental, or consequential damages
            arising from your use of the app, and our total liability for any claim is limited to the
            amount you paid us in the 12 months before the claim.
          </p>
          <p>Nothing here limits liability where the law does not allow it to be limited.</p>
        </Section>

        <Section title="Ending your account">
          <p>
            You can delete your account at any time from the Profile tab, or without installing the
            app at{" "}
            <Link
              href="/delete-account"
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              bookworm-ai.app/delete-account
            </Link>
            . Deleting your account cancels any active subscription and permanently removes your
            profile, courses and progress, as described in the Privacy Policy.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we change these terms, the date at the top changes with them. If a change materially
            affects your rights, we will tell you in the app rather than rely on you re-reading this
            page. Continuing to use Bookworm AI after a change takes effect means you accept it.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the State of {GOVERNING_LAW_STATE}, without
            regard to its conflict-of-law rules, except where local consumer-protection law requires
            otherwise for readers outside the United States.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {OPERATOR}, questions about these terms:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Terms%20question`}
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>
            See also the{" "}
            <Link href="/privacy" className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
      </article>
    </main>
  );
}
