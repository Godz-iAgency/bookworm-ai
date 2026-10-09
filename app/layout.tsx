import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Caveat, Nunito, Lora } from "next/font/google"
import { PrivateAnalytics } from "@/components/private-analytics"
import { AttributionCapture } from "@/components/attribution-capture"
import { SiteJsonLd } from "@/components/json-ld"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site"

// Warm handwritten display font, used only for the personal Home greeting.
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "600", "700"] })

// The app's UI voice. Nunito is a humanist sans with rounded terminals - it
// reads as warm and friendly where the previous Geist Sans read as technical.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" })

// Long-form lesson text only. A true reading serif (like every e-reader ships
// with) is easier on the eyes for 1000-word lessons than any UI sans.
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" })
import { Suspense } from "react"
import { BookwormProvider } from "@/lib/BookwormContext"
import { AuthProvider } from "@/context/AuthContext"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // A page that sets its own title is shown as "Pricing | Bookworm AI".
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Each page's own title and description are used for its link preview; the
  // picture comes from app/opengraph-image.tsx.
  openGraph: { type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  // Standalone-app behaviour on iOS, which ignores the web app manifest and
  // reads these instead. Android takes its equivalents from manifest.ts.
  appleWebApp: {
    capable: true,
    title: "Bookworm",
    statusBarStyle: "black-translucent",
  },
}

/**
 * themeColor paints the Android status bar and the PWA splash screen. It
 * matches the body background so the app opens as one continuous surface
 * rather than flashing a white bar above the first frame.
 */
export const viewport: Viewport = {
  themeColor: "#080808",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Font variables go on <html>, not <body>: globals.css sets a base
  // font-family on the html element, and a var defined only on body would be
  // undefined there, which silently dropped the whole page back to Times.
  return (
    <html lang="en" className={`${nunito.variable} ${lora.variable} ${GeistMono.variable} ${caveat.variable}`}>
      <body className="font-sans bg-[#080808]">
        <SiteJsonLd />
        <AuthProvider>
          <BookwormProvider>
            <Suspense fallback={<div>Loading...</div>}>
            {children}
            <PrivateAnalytics />
            <AttributionCapture />
          </Suspense>
          <ServiceWorkerRegister />
          </BookwormProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
