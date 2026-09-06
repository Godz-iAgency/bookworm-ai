import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import Link from "next/link";

/**
 * Public privacy policy.
 *
 * Google Play requires a privacy policy at a URL reachable without installing
 * the app, and the Data Safety form's answers have to match what this page
 * says. Everything here was written against the actual data flows in this
 * repo rather than from a template - the third parties listed are the ones the
 * code really calls, and the claims about what is not collected (no personal
 * identifiers reaching the AI providers, no stored cover photos) are true of
 * the current implementation. If those flows change, this page changes with
 * them.
 *
 * A server component with no client JavaScript: a policy should render for
 * anyone, including a reviewer with scripting restricted.
 */

/**
 * Bumped by hand, never generated. A "last updated" date that moved on every
 * deploy would tell a reader nothing about whether the terms had changed.
 */
const LAST_UPDATED = "August 31, 2026";
const OPERATOR = "GODZ-i LLC";
const CONTACT_EMAIL = "christopher@godz-iagency.com";

export const metadata: Metadata = {
  title: "Privacy Policy — Bookworm.AI",
  description:
    "What Bookworm.AI collects, why, who it is shared with, and how to get your data deleted.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-black tracking-tight text-white">{title}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

function Row({ who, what, why }: { who: string; what: string; why: string }) {
  return (
    <div className="border-t border-white/10 py-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-bold text-white">{who}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/65">{what}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/45">{why}</p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-[hsl(222,94%,5%)] px-4 py-10">
      <Link href="/" className="shrink-0">
        <Logo variant="stacked" priority className="w-44 drop-shadow-2xl sm:w-52" />
      </Link>

      <article className="mt-6 w-full max-w-2xl pb-16">
        <h1 className="text-2xl font-black tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-1.5 text-xs text-white/40">Last updated {LAST_UPDATED}</p>

        <p className="mt-5 text-sm leading-relaxed text-white/70">
          Bookworm.AI is operated by {OPERATOR}. This page explains what the app collects, why it
          collects it, who else sees it, and how to get rid of it. It is written to be read, not
          skimmed past, so it is in plain English.
        </p>

        <Section title="What we collect">
          <p>
            <span className="font-bold text-white">Your account.</span> Your email address, and your
            name and profile picture if you sign in with Google or add them yourself. If you sign up
            with a password, that password is handled and stored by Firebase Authentication and is
            never visible to us.
          </p>
          <p>
            <span className="font-bold text-white">Your reading.</span> The books you generate
            courses for, the lessons, flashcards and chat those courses contain, which days you have
            completed, your reading streak and badges, your chosen reading level, your genre
            preferences, and your reading display settings such as text size.
          </p>
          <p>
            <span className="font-bold text-white">Your subscription.</span> Which plan you are on,
            how many books you have generated this billing period, and identifiers that let us match
            your account to your subscription in Stripe. Card numbers go directly to Stripe and are
            never sent to or stored by us.
          </p>
          <p>
            <span className="font-bold text-white">Book cover photos.</span> If you use the camera to
            add a book, the photo is shrunk in your browser and sent to be read once, so we can
            identify the title and author. It is not saved, and it is not attached to your account.
          </p>
          <p>
            <span className="font-bold text-white">Basic usage.</span> Aggregate page views through
            Vercel Web Analytics, which we use to understand which parts of the app get used. It
            does not build an advertising profile of you.
          </p>
        </Section>

        <Section title="What we do with it">
          <p>
            We use it to run the service: to sign you in, to write and store your courses, to track
            your progress and streak, to apply the limits of the plan you pay for, and to contact
            you about your account when we need to.
          </p>
          <p className="font-bold text-white">
            We do not sell your personal information, and we do not use it for advertising or
            behavioural targeting.
          </p>
        </Section>

        <Section title="How the AI part works">
          <p>
            Lessons, flashcards and chat answers are generated by third-party AI models. When you
            generate a course or ask a question, what is sent is the book&apos;s title and author,
            the lesson you are reading, and the message you typed.
          </p>
          <p>
            Your email address and your account identifier are <span className="font-bold text-white">not</span>{" "}
            sent to those providers. They receive the book and the question, not who is asking.
          </p>
        </Section>

        <Section title="Who else your data reaches">
          <p className="!mt-0">
            These are the companies that process data on our behalf so the app can work. Each is
            bound by its own privacy terms.
          </p>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <Row
              who="Google Firebase"
              what="Your account, sign-in credentials, profile and all of your course and progress data."
              why="Authentication and the database the app runs on."
            />
            <Row
              who="Google (Gemini API)"
              what="Book titles and authors, lesson text, your chat messages, and book cover photos when you scan one."
              why="Generating lessons and reading book covers."
            />
            <Row
              who="Groq"
              what="Book titles and authors, lesson text and your chat messages."
              why="A backup text generator used when the primary one is unavailable."
            />
            <Row
              who="Google Books API"
              what="The book titles you search for."
              why="Finding books and their cover images."
            />
            <Row
              who="Stripe"
              what="Your email, payment card details and billing history."
              why="Taking payment. Card details go to Stripe directly and never through us."
            />
            <Row
              who="Vercel"
              what="Standard server request logs and aggregate page-view analytics."
              why="Hosting the app."
            />
          </div>
          <p>
            We may also disclose information if the law requires it, or to protect the rights and
            safety of our readers.
          </p>
        </Section>

        <Section title="Amazon links">
          <p>
            When a course finishes, we offer a link to buy the book on Amazon. Those are Amazon
            Associates affiliate links, which means we may earn a commission if you buy through
            them, at no extra cost to you. Following one takes you to Amazon, where Amazon&apos;s
            own privacy policy and cookies apply, not ours.
          </p>
        </Section>

        <Section title="How long we keep things">
          <p>
            Courses expire on their own schedule and are deleted automatically once they lapse. Your
            account and profile are kept for as long as your account exists.
          </p>
          <p>
            When you delete your account, your profile, your courses and your sign-in are removed
            immediately, and any subscription is cancelled. Records of payments you already made
            stay with Stripe, because tax and accounting rules require them to be kept. They are no
            longer attached to a usable account.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can view and change your name, profile picture, reading level, genres and reading
            settings at any time from the Profile tab, and cancel your subscription from the same
            place.
          </p>
          <p>
            You can permanently delete your account and everything in it, either in the app under
            Profile or, without installing the app, at{" "}
            <Link
              href="/delete-account"
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              bookworm-ai.app/delete-account
            </Link>
            .
          </p>
          <p>
            Depending on where you live, you may also have the right to request a copy of your data,
            to have it corrected, or to object to how it is used. Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will respond.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Bookworm.AI is a general-audience service and is not directed to children under 13. We
            do not knowingly collect personal information from children under 13. If you believe a
            child has created an account, email us and we will delete it.
          </p>
          <p>
            The Explorer reading level writes lessons in simpler language. It is a writing style for
            readers who want plainer explanations, not a children&apos;s mode.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Data is stored with Google Firebase and transmitted over encrypted connections. Billing
            fields can only be written by our servers, never by the browser, so an account cannot
            grant itself a paid plan. No system is perfectly secure, and we cannot promise
            otherwise, but we treat your reading and your payment details as things worth
            protecting.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes, the date at the top changes with it. If a change materially
            affects how your information is used, we will tell you in the app rather than rely on
            you re-reading this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {OPERATOR} — questions, privacy requests or complaints:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20question`}
              className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </article>
    </main>
  );
}
