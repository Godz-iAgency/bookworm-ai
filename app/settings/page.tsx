"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const [webhookSecret, setWebhookSecret] = useState("")
  const [copied, setCopied] = useState(false)
  const [inputSecret, setInputSecret] = useState("")
  const [savedToClipboard, setSavedToClipboard] = useState(false)

  const hasStripeKeys = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/stripe/webhook`
      : "https://your-app.vercel.app/api/stripe/webhook"

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveWebhookSecret = () => {
    if (inputSecret.trim()) {
      navigator.clipboard.writeText(inputSecret)
      setSavedToClipboard(true)
      setTimeout(() => setSavedToClipboard(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDD0] p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 mb-6 text-[#008080] hover:underline">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center gap-4 mb-2">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Oct%205%2C%202025%2C%2010_40_41%20PM-H6XfD24mrebcr7PyZI2hKrfdpYpiFW.png"
            alt="Bookworm.AI"
            width={60}
            height={60}
            className="rounded-lg"
          />
          <h1 className="text-4xl font-bold text-[#008080]">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Stripe Configuration Status */}
        <Card className="p-6 bg-white border-2 border-[#008080]">
          <h2 className="text-2xl font-bold text-[#008080] mb-4">Stripe Configuration</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Stripe API Keys</span>
              <span
                className={`px-3 py-1 rounded ${hasStripeKeys ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {hasStripeKeys ? "✓ Connected" : "✗ Not Connected"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">Webhook Secret</span>
              <span className="px-3 py-1 rounded bg-yellow-100 text-yellow-700">⚠ Needs Setup</span>
            </div>
          </div>
        </Card>

        {/* Webhook Secret Input */}
        <Card className="p-6 bg-white border-2 border-[#CC5500]">
          <h2 className="text-2xl font-bold text-[#CC5500] mb-4">📝 Paste Your Webhook Secret Here</h2>

          <div className="space-y-4">
            <p className="text-gray-700">
              After getting your webhook secret from Stripe (starts with{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">whsec_...</code>), paste it in the box below:
            </p>

            <div className="space-y-3">
              <Label htmlFor="webhook-input" className="text-lg font-semibold">
                Stripe Webhook Secret
              </Label>
              <Input
                id="webhook-input"
                type="text"
                placeholder="whsec_..."
                value={inputSecret}
                onChange={(e) => setInputSecret(e.target.value)}
                className="font-mono text-sm border-2 border-[#008080] focus:border-[#CC5500] h-12"
              />

              <Button
                onClick={saveWebhookSecret}
                disabled={!inputSecret.trim()}
                className="w-full bg-[#CC5500] hover:bg-[#AA4400] text-white h-12 text-lg font-semibold"
              >
                {savedToClipboard ? "✓ Copied to Clipboard!" : "Copy & Prepare for v0 Settings"}
              </Button>

              {savedToClipboard && (
                <div className="p-4 bg-green-50 border-2 border-green-500 rounded">
                  <p className="font-semibold text-green-700 mb-2">✓ Webhook secret copied!</p>
                  <p className="text-green-600 text-sm">
                    Now go to the <strong>⚙️ Gear icon</strong> in the top-right corner →
                    <strong> Environment Variables</strong> → Add Variable:
                  </p>
                  <ul className="list-disc list-inside ml-4 mt-2 text-green-600 text-sm">
                    <li>
                      Name: <code>STRIPE_WEBHOOK_SECRET</code>
                    </li>
                    <li>Value: Paste (Ctrl+V or Cmd+V)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Webhook Setup Instructions */}
        <Card className="p-6 bg-white border-2 border-[#CC5500]">
          <h2 className="text-2xl font-bold text-[#CC5500] mb-4">🔧 Webhook Setup Required</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Step 1: Create Webhook in Stripe</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  Go to{" "}
                  <a
                    href="https://dashboard.stripe.com/test/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#008080] underline"
                  >
                    Stripe Dashboard → Webhooks
                  </a>
                </li>
                <li>Click "Add endpoint"</li>
                <li>Use this URL as your endpoint:</li>
              </ol>

              <div className="mt-3 p-3 bg-gray-100 rounded flex items-center justify-between">
                <code className="text-sm break-all">{webhookUrl}</code>
                <Button
                  onClick={() => copyToClipboard(webhookUrl)}
                  className="ml-2 bg-[#008080] hover:bg-[#006666]"
                  size="sm"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </Button>
              </div>

              <ol start={4} className="list-decimal list-inside space-y-2 text-gray-700 mt-3">
                <li>
                  Select these events:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>
                      <code>checkout.session.completed</code>
                    </li>
                    <li>
                      <code>customer.subscription.created</code>
                    </li>
                    <li>
                      <code>customer.subscription.updated</code>
                    </li>
                    <li>
                      <code>customer.subscription.deleted</code>
                    </li>
                  </ul>
                </li>
                <li>Click "Add endpoint"</li>
                <li>
                  Copy the <strong>Signing secret</strong> (starts with <code>whsec_...</code>)
                </li>
              </ol>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-bold text-lg mb-2">Step 2: Add Webhook Secret to v0</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  In the v0 chat window, click the <strong>⚙️ Gear icon</strong> in the top-right corner
                </li>
                <li>
                  Select <strong>"Environment Variables"</strong>
                </li>
                <li>
                  Click <strong>"Add Variable"</strong>
                </li>
                <li>
                  Enter:
                  <div className="ml-6 mt-2 space-y-2">
                    <div className="p-3 bg-gray-100 rounded">
                      <strong>Name:</strong> <code>STRIPE_WEBHOOK_SECRET</code>
                    </div>
                    <div className="p-3 bg-gray-100 rounded">
                      <strong>Value:</strong> Paste your <code>whsec_...</code> secret here
                    </div>
                  </div>
                </li>
                <li>
                  Click <strong>"Save"</strong>
                </li>
                <li>Redeploy your app for changes to take effect</li>
              </ol>
            </div>

            {/* Visual Guide */}
            <div className="border-t pt-6">
              <h3 className="font-bold text-lg mb-3">📍 Where to Find the Gear Icon</h3>
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded">
                <p className="text-gray-700 mb-2">
                  Look at the <strong>top-right corner</strong> of your v0 chat window (where you're talking to me right
                  now).
                </p>
                <p className="text-gray-700">
                  You'll see: <strong>⚙️ Gear Icon</strong> → Click it → Select "Environment Variables"
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Test Webhook Input (for reference only) */}
        <Card className="p-6 bg-white border-2 border-gray-300">
          <h2 className="text-xl font-bold text-gray-700 mb-4">📋 Reference: What Your Webhook Secret Looks Like</h2>
          <p className="text-gray-600 mb-4">Your webhook secret from Stripe will look like this:</p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="webhook-example">Example Format:</Label>
              <Input
                id="webhook-example"
                value="whsec_1234567890abcdefghijklmnopqrstuvwxyz"
                readOnly
                className="font-mono text-sm bg-gray-50"
              />
            </div>

            <p className="text-sm text-gray-500">
              ⚠️ Note: This is just an example. You need to get your actual webhook secret from the Stripe Dashboard and
              add it to v0's Environment Variables (not here).
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
