"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  Search, Sparkles, Zap, Loader2, AlertCircle, 
  CheckCircle2, FileText, TrendingUp, Check 
} from "lucide-react";
import { motion } from "framer-motion";

export default function DetectPage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hitRate, setHitRate] = useState(0);

  useEffect(() => {
    fetchProfileAndData();
  }, []);

  const fetchProfileAndData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      setUserProfile(profile);

      const { data: apps } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setApplications(apps || []);

      // Calculate simple hit rate
      if (apps && apps.length > 0) {
        const withScores = apps.filter(a => a.match_score > 0);
        const avg = withScores.reduce((acc, a) => acc + (a.match_score || 0), 0) / (withScores.length || 1);
        setHitRate(Math.round(avg));
      }
    }
  };

  const handleSearchJobs = () => {
    setIsSearching(true);
    // Simulate search for now, real logic would involve the API
    setTimeout(() => {
      setIsSearching(false);
      window.location.href = "/dashboard/tailor"; // Redirect to tailor view after search
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      
      {/* HEADER SECTION */}
      <header className="space-y-2 text-center sm:text-left">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[4.5rem] font-black leading-[0.9] tracking-tighter text-[var(--color-on-surface)]"
        >
          {isSearching ? "Scanning." : "Detecting."}
        </motion.h2>
        <p className="text-[var(--color-secondary)] text-[12px] tracking-[0.3em] uppercase font-bold opacity-80">
          {isSearching ? "Neural Network Active" : "Active Intelligence Engine"}
        </p>
      </header>

      {/* SEARCH CARD */}
      <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/20 p-8 rounded-[3rem] shadow-2xl shadow-[var(--color-primary)]/5 space-y-8 relative overflow-hidden group">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[2rem] bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0 border border-[var(--color-primary)]/20 transition-transform group-hover:scale-105 duration-500">
            <Search className="text-[var(--color-primary)] w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[var(--color-on-surface)] tracking-tight">Market Radar</h2>
            <p className="text-[var(--color-secondary)] font-medium">Auto-scan 50+ job boards for your profile.</p>
          </div>
        </div>

        {/* Preferences bar */}
        <div className="bg-[var(--color-surface-container-low)] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[var(--color-outline-variant)]/10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
            <span className="text-sm font-bold text-[var(--color-on-surface)]">
              {userProfile?.target_roles?.length 
                ? userProfile.target_roles.join(", ")
                : "Initialize preferences to start"}
            </span>
          </div>
          <Link href="/dashboard/preferences" className="text-xs font-black text-[var(--color-primary)] hover:underline uppercase tracking-widest bg-[var(--color-primary)]/10 px-4 py-2 rounded-lg transition-colors">
            Configure
          </Link>
        </div>

        <button
          onClick={handleSearchJobs}
          disabled={isSearching || !userProfile?.target_roles?.length}
          className="w-full h-24 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] text-[var(--color-on-primary)] rounded-[2rem] font-black text-2xl shadow-2xl shadow-[var(--color-primary)]/40 active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-4 disabled:opacity-30 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10 flex items-center gap-4">
            {isSearching ? (
              <>INITIALIZING... <Loader2 className="w-8 h-8 animate-spin" /></>
            ) : (
              <>START SCANNING <Zap className="w-8 h-8 group-hover:fill-current" /></>
            )}
          </span>
        </button>
      </section>

      {/* QUICK STATS BENTO */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface-container-low)] p-8 rounded-[2.5rem] border border-[var(--color-outline-variant)]/10 hover:border-[var(--color-primary)]/30 transition-colors group">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <p className="text-4xl font-black text-[var(--color-on-surface)]">{applications.length}</p>
          <p className="text-[11px] uppercase font-black tracking-[0.2em] text-[var(--color-secondary)] opacity-50 mt-1">Detections</p>
        </div>
        <div className="bg-[var(--color-surface-container-low)] p-8 rounded-[2.5rem] border border-[var(--color-outline-variant)]/10 hover:border-[var(--color-cta)]/30 transition-colors group">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <p className="text-4xl font-black text-[var(--color-on-surface)]">{hitRate}%</p>
          <p className="text-[11px] uppercase font-black tracking-[0.2em] text-[var(--color-secondary)] opacity-50 mt-1">Avg Match</p>
        </div>
      </div>

      {/* WORKFLOW GUIDE (for new/incomplete users) */}
      {(!userProfile?.cv_text || !userProfile?.target_roles?.length) && (
        <section className="bg-[var(--color-primary)]/[0.03] border border-[var(--color-primary)]/10 p-8 rounded-[2.5rem] space-y-6">
          <h3 className="text-lg font-black text-[var(--color-on-surface)] flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
            Onboarding Checklist
          </h3>
          <div className="space-y-4">
            {[
              { label: "Upload Master CV", done: !!userProfile?.cv_text, href: "/dashboard/profile" },
              { label: "Define Target Roles", done: !!userProfile?.target_roles?.length, href: "/dashboard/preferences" },
            ].map((step, i) => (
              <Link key={i} href={step.href} className="flex items-center justify-between p-6 bg-white/[0.02] rounded-3xl border border-white/5 hover:bg-white/[0.05] hover:shadow-2xl transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${step.done ? "bg-[var(--color-primary)] text-black shadow-lg shadow-[var(--color-primary)]/20" : "bg-white/5 text-white/30 border border-white/5"}`}>
                    {step.done ? <Check className="w-5 h-5 font-black" /> : i + 1}
                  </div>
                  <span className={`font-bold tracking-tight ${step.done ? "text-white/20 line-through" : "text-white"}`}>{step.label}</span>
                </div>
                <ArrowRight className="w-6 h-6 text-white/20 group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all" />
              </Link>

            ))}
          </div>
        </section>
      )}

    </div>
  );
}

function ArrowRight(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
  )
}
