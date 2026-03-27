"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user row via server API (bypasses RLS)
        try {
          const createRes = await fetch("/api/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: authData.user.id,
              name,
              email
            }),
          });
          const createResult = await createRes.json();
          console.log("[signup] Create user result:", createResult);
          if (!createRes.ok) {
            console.error("[signup] Failed to create user row:", createResult.error);
          }
        } catch (err) {
          console.error("[signup] Error creating user row:", err);
          // Don't block navigation
        }

        router.push("/onboarding");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center items-center p-6 relative">
      <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10">
        <h2 className="text-3xl font-heading font-bold text-white mb-2 text-center">Create an Account</h2>
        <p className="text-gray-400 text-center mb-8">Join AutoApply to automate your job search</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input 
              required
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-4 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign Up <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <p className="text-gray-400 text-center mt-6 text-sm">
          Already have an account? <Link href="/login" className="text-white hover:text-[var(--color-primary)] font-medium transition">Log in</Link>
        </p>
      </div>
    </div>
  );
}
