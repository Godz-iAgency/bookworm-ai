export default function SetupGuide() {
  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-cyan-400">Supabase Free Tier Setup Guide</h1>

        <div className="space-y-6">
          <section className="bg-[#1a1f3a] p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Step 1: Create Supabase Project (Free)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>
                Go to{" "}
                <a href="https://supabase.com" className="text-cyan-400 underline">
                  supabase.com
                </a>
              </li>
              <li>Click "Start your project" (FREE - no credit card required)</li>
              <li>Create a new organization (if you don't have one)</li>
              <li>
                Create a new project:
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li>Choose a project name (e.g., "bookworm-ai")</li>
                  <li>Create a strong database password (save this!)</li>
                  <li>Select a region close to you</li>
                  <li>
                    <strong className="text-yellow-400">IMPORTANT: Select "Free" plan</strong>
                  </li>
                </ul>
              </li>
              <li>Wait 2-3 minutes for project to be created</li>
            </ol>
          </section>

          <section className="bg-[#1a1f3a] p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Step 2: Get Your API Keys</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>In your Supabase project, go to Settings → API</li>
              <li>
                Copy these values:
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li>
                    <strong>Project URL</strong> (starts with https://...supabase.co)
                  </li>
                  <li>
                    <strong>anon public</strong> key (starts with eyJ...)
                  </li>
                </ul>
              </li>
              <li>
                Add them to v0 environment variables:
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li>
                    <code className="bg-black px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> = Your Project URL
                  </li>
                  <li>
                    <code className="bg-black px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> = Your anon key
                  </li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="bg-[#1a1f3a] p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Step 3: Enable Email Authentication (Free)</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Go to Authentication → Providers</li>
              <li>Enable "Email" provider (it's enabled by default)</li>
              <li>
                <strong className="text-yellow-400">DO NOT enable:</strong>
                <ul className="list-disc list-inside ml-6 mt-2">
                  <li>Phone authentication (requires paid plan)</li>
                  <li>Advanced security features</li>
                  <li>Custom SMTP (use default for free tier)</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="bg-[#1a1f3a] p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Step 4: Run the SQL Script</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Go to SQL Editor in your Supabase dashboard</li>
              <li>Click "New query"</li>
              <li>
                Copy the contents of{" "}
                <code className="bg-black px-2 py-1 rounded">scripts/001-create-tables-free-tier.sql</code>
              </li>
              <li>Paste into the SQL editor</li>
              <li>Click "Run" to create your tables</li>
            </ol>
          </section>

          <section className="bg-[#1a1f3a] p-6 rounded-lg border-2 border-yellow-500">
            <h2 className="text-2xl font-semibold mb-4 text-yellow-400">⚠️ What to AVOID (These Require Paid Plan)</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Point-in-time recovery</li>
              <li>Custom domains</li>
              <li>Phone authentication</li>
              <li>Advanced security features</li>
              <li>Database backups beyond 7 days</li>
              <li>Priority support</li>
              <li>Compute add-ons</li>
            </ul>
          </section>

          <section className="bg-green-900/20 border border-green-500 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4 text-green-400">✓ What's Included in Free Tier</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>500MB database storage</li>
              <li>50,000 monthly active users</li>
              <li>Unlimited API requests</li>
              <li>Email authentication</li>
              <li>Row Level Security (RLS)</li>
              <li>Real-time subscriptions (limited)</li>
              <li>7-day database backups</li>
              <li>2GB bandwidth</li>
            </ul>
          </section>
        </div>

        <div className="mt-8 p-6 bg-cyan-900/20 border border-cyan-500 rounded-lg">
          <h3 className="text-xl font-semibold mb-2 text-cyan-300">Need Help?</h3>
          <p className="text-gray-300">If you're still seeing upgrade prompts, make sure you:</p>
          <ul className="list-disc list-inside mt-2 text-gray-300">
            <li>Selected the FREE plan when creating your project</li>
            <li>Are not trying to enable paid features in the dashboard</li>
            <li>Are using the simplified SQL script provided</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
