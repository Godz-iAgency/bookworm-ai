import type { Metadata } from "next";

/** A sign-in form is no use as a search result, so it gets a clear title and stays out of the index. */
export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
