import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/contact";

/**
 * Where a reader goes for help. A server component with no client JavaScript,
 * like the policy pages, so it loads for anyone. It is also what the support
 * address in the Play listing and in Stripe receipts points back to.
 */
export const metadata: Metadata = {
  title: "Contact and support",
  description: "Email Bookworm AI for help with billing, signing in, your account or your data.",
};

const link = "font-semibold text-[#00D4FF] underline-offset-2 hover:underline";

function Topic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 py-3.5 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/65">{children}</p>
    </div>
  );
}

export default function ContactPage() {
  const mail = (subject: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  return (
    <main className="flex min-h-dvh flex-col items-center bg-[hsl(222,94%,5%)] px-3 py-10">
      <Link href="/" className="shrink-0">
        <Logo variant="stacked" priority className="w-44 drop-shadow-2xl sm:w-52" />
      </Link>

      <article className="mt-6 w-full max-w-2xl pb-16">
        <h1 className="text-2xl font-black tracking-tight text-white">Contact and support</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          Write to us at{" "}
          <a href={mail("Bookworm AI support")} className={link}>
            {SUPPORT_EMAIL}
          </a>
          . We read every message. It helps to write from the email address you signed up with, so
          we can find your account quickly.
        </p>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Topic title="Billing and your trial">
            Questions about a charge, a receipt, cancelling or changing plan.{" "}
            <a href={mail("Billing question")} className={link}>
              Email us about billing
            </a>
            .
          </Topic>
          <Topic title="Can't sign in">
            Tell us the email you used and what you see on screen.{" "}
            <a href={mail("Trouble signing in")} className={link}>
              Email us about signing in
            </a>
            .
          </Topic>
          <Topic title="Delete your account">
            You can do this yourself at any time, without contacting us, at{" "}
            <Link href="/delete-account" className={link}>
              bookworm-ai.app/delete-account
            </Link>{" "}
            or in the app under Profile.
          </Topic>
          <Topic title="Your data and privacy">
            What we collect and how to ask for a copy or a correction is explained in the{" "}
            <Link href="/privacy" className={link}>
              Privacy Policy
            </Link>
            . Requests go to the same address.
          </Topic>
          <Topic title="Copyright concerns">
            If you are a rights holder and something on Bookworm AI concerns you, see the{" "}
            <Link href="/terms" className={link}>
              Terms
            </Link>{" "}
            and email us.
          </Topic>
        </div>

        <p className="mt-7 text-xs text-white/40">
          <Link href="/pricing" className="transition-colors hover:text-white/70">
            Pricing
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="transition-colors hover:text-white/70">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="transition-colors hover:text-white/70">
            Privacy
          </Link>
        </p>
      </article>
    </main>
  );
}
