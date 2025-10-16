export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#008080] mb-2">Unlock Unlimited Learning</h1>
          <p className="text-gray-700">Start your 7-day free trial, then $19.99/month</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-[#008080]">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-[#008080] mb-2">
              $19.99
              <span className="text-xl text-gray-600">/month</span>
            </div>
            <p className="text-sm text-gray-600">7-day free trial included</p>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">Unlimited AI-powered courses from any book</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">7-day structured learning journeys</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">Interactive quizzes and flashcards</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">AI chat assistant for questions</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">Text-to-speech read-aloud feature</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#008080] text-xl">✓</span>
              <span className="text-gray-700">Daily streak tracking and rewards</span>
            </li>
          </ul>

          <form action="/api/stripe/checkout" method="POST">
            <button
              type="submit"
              className="w-full bg-[#CC5500] hover:bg-[#B34D00] text-white font-semibold py-4 rounded-lg transition-colors shadow-md"
            >
              Start Free Trial
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">Cancel anytime. No commitment required.</p>
        </div>
      </div>
    </div>
  )
}
