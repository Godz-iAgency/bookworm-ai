"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  if (loading) return <div className="min-h-dvh bg-[#080808]" />;

  return (
    <div className="min-h-dvh bg-[#080808] flex flex-col items-center justify-center px-6 selection:bg-[#ff2d78]/30">
      <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        <div className="text-center mb-12">
          <h1 className="font-playfair text-4xl md:text-5xl text-white mb-4 tracking-tight">
            Welcome back, Reader.
          </h1>
          <p className="font-dm-sans text-gray-400 text-lg leading-relaxed">
            Your 7-day journey into the heart of <br className="hidden md:block"/> 
            great books continues here.
          </p>
        </div>

        <div className="space-y-6">
          {/* Google Button - Forced White Background */}
          <button
            onClick={signInWithGoogle}
            className="w-full h-[56px] flex items-center justify-center gap-3 bg-white text-black font-dm-sans font-bold rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all shadow-xl"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google Logo" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="relative py-2 flex items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-gray-500 text-xs font-dm-sans uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-dm-sans text-xs text-gray-500 ml-1 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full h-[56px] bg-[#111111] border border-white/10 rounded-xl px-4 text-white font-dm-sans text-base focus:border-[#00d4ff] outline-none transition-all placeholder:text-gray-700"
                style={{ fontSize: '16px' }} 
              />
            </div>
            
            {/* Primary Action Button - Brand Gradient */}
            <button
              className="w-full h-[56px] bg-gradient-to-r from-[#00d4ff] to-[#ff2d78] text-white font-dm-sans font-bold rounded-xl shadow-[0_0_20px_rgba(255,45,120,0.15)] hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>

        <p className="mt-16 text-center text-[11px] text-gray-600 font-dm-sans leading-relaxed max-w-[280px] mx-auto">
          By continuing, you agree to Bookworm.AI's <br/>
          <span className="underline decoration-white/10">Terms of Service</span> and <span className="underline decoration-white/10">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
