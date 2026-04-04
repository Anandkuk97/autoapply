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
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      
      {/* HEADER SECTION */}
      <header className="space-y-1 text-center sm:text-left">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black leading-tight tracking-tighter text-slate-900"
        >
          {isSearching ? "Scanning." : "Detecting."}
        </motion.h2>

        <p className="text-[var(--color-secondary)] text-[10px] tracking-[0.4em] uppercase font-black opacity-40">
          {isSearching ? "Neural Network Active" : "Active Intelligence Engine"}
        </p>
      </header>


      {/* SEARCH CARD */}
      <section className="bg-white border border-black/5 p-6 rounded-[2rem] shadow-xl shadow-black/5 space-y-6 relative overflow-hidden group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm transition-transform group-hover:scale-110">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Market Radar</h3>
            <p className="text-sm text-slate-500 font-medium tracking-tight">Auto-scan 50+ job boards for your profile.</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest truncate max-w-[200px]">
              {userProfile?.target_roles?.join(", ") || "No roles defined"}
            </p>
          </div>
          <Link href="/dashboard/preferences" className="px-4 py-2 bg-white text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors shadow-sm">
            Configure
          </Link>
        </div>

        <button
          onClick={handleSearchJobs}
          disabled={isSearching || !userProfile?.target_roles?.length}
          className="w-full h-16 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-3 disabled:opacity-30 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10 flex items-center gap-3">
            {isSearching ? (
              <>INITIALIZING... <Loader2 className="w-6 h-6 animate-spin" /></>
            ) : (
              <>START SCANNING <Zap className="w-6 h-6 group-hover:fill-current" /></>
            )}
          </span>
        </button>
      </section>

      {/* QUICK STATS BENTO */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-black/5 hover:border-emerald-500/30 transition-colors group shadow-sm">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{applications.length}</p>
          <p className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-400 mt-1">Detections</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-black/5 hover:border-emerald-500/30 transition-colors group shadow-sm">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{hitRate}%</p>
          <p className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-400 mt-1">Avg Match</p>
        </div>
      </div>

      {/* WORKFLOW GUIDE (for new/incomplete users) */}
      {(!userProfile?.cv_text || !userProfile?.target_roles?.length) && (
        <section className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Checklist
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
