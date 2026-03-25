"use client";

import Link from "next/link";
import { FileText, Sparkles, Navigation, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] rounded-full bg-primary/10 blur-[150px]" />
      </div>

      <nav className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[var(--color-primary)] w-6 h-6" />
          <span className="font-heading text-xl font-bold tracking-tight text-white">AutoApply</span>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">
            Log in
          </Link>
          <Link href="/onboarding" className="text-sm font-bold bg-[var(--color-primary)] text-black px-4 py-2 rounded-full hover:bg-yellow-400 transition transform hover:scale-105">
            Start Free
          </Link>
        </div>
      </nav>

      <main className="relative z-10 flex-col items-center flex justify-center text-center px-6 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
            AI-Powered Job Applications
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold font-heading text-white leading-tight mb-6">
            Land your next job on <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5C518] to-[#ffda54]">Autopilot</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-sans font-light">
            Upload your CV once. Let our AI tailor your resume, draft perfect cover letters, and find the best matches for you instantly. Stop applying, start interviewing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/onboarding">
              <span className="px-8 py-4 bg-[var(--color-primary)] text-black font-bold rounded-full text-lg hover:bg-yellow-400 transition flex items-center gap-2 transform hover:scale-105 shadow-[0_0_20px_rgba(245,197,24,0.3)]">
                Start Onboarding
                <Navigation className="w-5 h-5" />
              </span>
            </Link>
            <Link href="#features">
              <span className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-full text-lg hover:bg-white/10 transition flex items-center gap-2 backdrop-blur-sm">
                See how it works
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full text-left"
        >
          {[
            { title: "One-Click Resume Gen", icon: FileText, desc: "We use Claude AI to rewrite your CV specific to each job description you target." },
            { title: "Hyper-Targeted Matches", icon: Navigation, desc: "Set your desired job titles and locations. We find only the perfect opportunities." },
            { title: "Review & Apply", icon: CheckCircle2, desc: "A clean dashboard to review tailored resources and approve applications." }
          ].map((feat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md hover:bg-white/10 transition group">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <feat.icon className="text-[var(--color-primary)] w-6 h-6" />
              </div>
              <h3 className="text-xl font-heading font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-gray-400 font-sans">{feat.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
