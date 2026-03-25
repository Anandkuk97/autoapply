"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Invalid login credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center items-center p-6 relative">
      <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10">
        <h2 className="text-3xl font-heading font-bold text-white mb-2 text-center">Welcome Back</h2>
        <p className="text-gray-400 text-center mb-8">Log in to manage your automated applications</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-4 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Log In <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <p className="text-gray-400 text-center mt-6 text-sm">
          Don't have an account? <Link href="/signup" className="text-white hover:text-[var(--color-primary)] font-medium transition">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
