import type React from "react"
import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { Caveat, Nunito, Lora } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

// Warm handwritten display font, used only for the personal Home greeting.
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "600", "700"] })

// The app's UI voice. Nunito is a humanist sans with rounded terminals — it
// reads as warm and friendly where the previous Geist Sans read as technical.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" })

// Long-form lesson text only. A true reading serif (like every e-reader ships
// with) is easier on the eyes for 1000-word lessons than any UI sans.
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" })
import { Suspense } from "react"
import { BookwormProvider } from "@/lib/BookwormContext"
import { AuthProvider } from "@/context/AuthContext"
import "./globals.css"

export const metadata: Metadata = {
  title: "Bookworm.AI - Making Every Book Smarter",
  description:
    "Transform your reading experience with AI-powered courses, interactive lessons, and personalized flashcards.",
  generator: "v0.app",
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
        <AuthProvider>
          <BookwormProvider>
            <Suspense fallback={<div>Loading...</div>}>
            {children}
            <Analytics />
          </Suspense>
          </BookwormProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
