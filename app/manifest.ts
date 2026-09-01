import type { MetadataRoute } from "next";

/**
 * Web app manifest, served by Next at /manifest.webmanifest and linked into
 * <head> automatically. This is what Microsoft PWA Builder reads to package
 * Bookworm as an Android app, so the fields here become the Play listing's
 * launcher name, splash screen and adaptive icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` keeps the installed app identified as the same app across
    // deploys even if start_url ever changes; Play uses it as the stable key.
    id: "/",
    name: "Bookworm.AI",
    short_name: "Bookworm",
    description:
      "Turn any book into a 7-day course with daily lessons, flashcards and a chat tutor that has already read it.",

    /**
     * Not "/" on purpose. Tapping an installed app icon should open the
     * reader's shelf, not the marketing landing page. Signed-out visitors are
     * sent on to /login by the dashboard's own guard, so this is safe for
     * someone who has been signed out since they last opened the app.
     */
    start_url: "/dashboard",
    scope: "/",

    // standalone is what makes this packageable as an Android app rather than
    // a browser shortcut — no URL bar, own entry in the task switcher.
    display: "standalone",
    orientation: "portrait",

    // Both match the app's real body background, so the splash screen and the
    // status bar are continuous with the first frame the reader sees.
    background_color: "#080808",
    theme_color: "#080808",

    categories: ["education", "books", "productivity"],
    lang: "en",
    dir: "ltr",

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /**
       * Android crops launcher icons to a circle or squircle depending on the
       * device. Only the inner 80%-diameter circle is guaranteed to survive,
       * so these carry extra padding — without them the mark would be clipped.
       */
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    shortcuts: [
      {
        name: "My Shelf",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Find a book",
        url: "/search",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
