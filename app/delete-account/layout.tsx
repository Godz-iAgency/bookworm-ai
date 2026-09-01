import type { Metadata } from "next";

/**
 * Google Play requires the account-deletion URL to be reachable and
 * understandable without installing the app, and a reviewer will open it
 * cold. Giving the route its own title means the tab, the search result and
 * the reviewer's bookmark all say what this page is rather than inheriting
 * the marketing title from the root layout.
 */
export const metadata: Metadata = {
  title: "Delete your Bookworm.AI account",
  description:
    "Permanently delete your Bookworm.AI account, your courses and your reading data. No app install required.",
};

export default function DeleteAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
