"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, Zap, BarChart2, TrendingUp, Target, 
  CheckCircle2, ArrowRight, ShieldCheck, ZapOff,
  Briefcase, GraduationCap, Cpu, Layers
} from "lucide-react";
import { motion } from "framer-motion";

export default function ScoresPage() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Animate score from 0 to 92
    const timer = setTimeout(() => setScore(92), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      
      {/* HEADER SECTION */}
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="text-[4rem] font-black leading-[1] tracking-tighter text-slate-900">
          Scores.
        </h2>
        <p className="text-slate-500 text-[12px] tracking-[0.3em] uppercase font-black opacity-60">
          Real-time Optimization Analysis
        </p>
      </header>

      {/* HERO SCORE SECTION */}
      <section className="flex flex-col items-center justify-center space-y-10 py-10">
        <div className="relative group">
          <div className="absolute -inset-12 bg-emerald-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          
          <div className="relative w-64 h-64 rounded-full bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200 group-hover:scale-105 transition-transform duration-700 overflow-hidden border-4 border-white">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "16px 16px" }}></div>
            <div className="flex flex-col items-center z-10">
               <motion.span 
                 className="text-7xl font-black text-white tracking-tighter"
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
               >
                 {score}%
               </motion.span>
               <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mt-2">Tailored Score</span>
            </div>
            
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle 
                cx="128" cy="128" r="120" 
                fill="none" stroke="white" strokeWidth="2" 
                className="opacity-10" 
              />
              <motion.circle 
                cx="128" cy="128" r="120" 
                fill="none" stroke="white" strokeWidth="8"
                strokeDasharray="753.6"
                strokeDashoffset={753.6 * (1 - score / 100)}
                strokeLinecap="round"
                className="score-progress-ring shadow-lg"
              />
            </svg>
          </div>

          <motion.div 
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-3 -right-3 bg-white p-4 rounded-2xl shadow-xl text-emerald-600 border border-emerald-50"
          >
            <Sparkles className="w-8 h-8 fill-current" />
          </motion.div>
        </div>

        <div className="text-center max-w-sm">
          <h3 className="text-2xl font-black text-slate-900 leading-tight">Optimization Peak.</h3>
          <p className="text-slate-600 font-bold mt-2 leading-relaxed opacity-80">Your profile has been architected to reach the top 5% of candidate compatibility.</p>
        </div>
      </section>

      {/* RECALIBRATION Breakdown BENTO */}
      <section className="space-y-8">
        <div className="px-2">
          <h3 className="text-xl font-black text-slate-950 tracking-tighter uppercase">Recalibration.</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Narrative Enhancements</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 group hover:border-emerald-200 transition-all">
            <div className="w-14 h-14 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-900 border border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
              <Layers className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-slate-950">Experience Map</h4>
              <p className="text-sm text-slate-600 font-bold leading-relaxed">12 keywords integrated across 4 legacy roles for maximum SEO relevancy.</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 fill-current" />
              Impact Verified
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 group hover:border-emerald-200 transition-all">
            <div className="w-14 h-14 bg-slate-50 rounded-3xl flex items-center justify-center text-emerald-600 border border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
              <Cpu className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-slate-950">Skills Matrix</h4>
              <p className="text-sm text-slate-600 font-bold leading-relaxed">92% match on hard skills, with suggest 3 soft-skill bridges for this specific role.</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
              <Zap className="w-4 h-4 fill-current" />
              AI Synthesized
            </div>
          </div>
        </div>
      </section>

      {/* CTA ACTIONS */}
      <section className="pt-10">
        <Link 
          href="/dashboard/history"
          className="w-full h-20 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200"
        >
          VIEW STATUS QUEUE <ArrowRight className="w-6 h-6" />
        </Link>
      </section>

    </div>
  );
}
