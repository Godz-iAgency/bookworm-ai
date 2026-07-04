import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Caveat } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

// Warm handwritten display font, used only for the personal Home greeting.
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "600", "700"] })
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
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${caveat.variable} bg-[#080808]`}>
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
