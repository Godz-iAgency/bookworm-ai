/**
 * The landing page's explainer video: a vertical YouTube Short in a
 * phone-shaped frame.
 *
 * The privacy-enhanced youtube-nocookie domain sets no tracking cookies until
 * the visitor presses play. The iframe is lazy-loaded, so it costs nothing
 * until the visitor scrolls near it, and it never autoplays.
 */
const VIDEO_ID = "k3a3QxEfagk";

export function VslVideo() {
  return (
    <section aria-label="Watch how Bookworm AI works" className="mt-10 flex w-full flex-col items-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00D4FF]">See how it works</p>
      <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_0_40px_rgba(0,212,255,0.25)]">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&playsinline=1&modestbranding=1`}
          title="Bookworm AI: turn any book into a 7-day course"
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  )
}
