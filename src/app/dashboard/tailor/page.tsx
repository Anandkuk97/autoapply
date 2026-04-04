"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, Zap, Loader2, CheckCircle2, ChevronRight, Terminal, 
  Square, CheckSquare, BarChart2, Check 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TailorPage() {
  const router = useRouter();
  const [groupedJobs, setGroupedJobs] = useState<any>({ today: [], week: [], older: [] });
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  const fetchActiveJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-jobs", { method: "POST" });
      const data = await res.json();
      if (data.grouped_jobs) {
        // Client-side deduplication to be safe
        const seenUrls = new Set();
        const deduplicate = (jobs: any[]) => jobs.filter(j => {
          if (seenUrls.has(j.source_url)) return false;
          seenUrls.add(j.source_url);
          return true;
        });

        setGroupedJobs({
          today: deduplicate(data.grouped_jobs.today || []),
          week: deduplicate(data.grouped_jobs.week || []),
          older: deduplicate(data.grouped_jobs.older || [])
        });
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const allJobs = useMemo(() => [
    ...groupedJobs.today, 
    ...groupedJobs.week, 
    ...groupedJobs.older
  ], [groupedJobs]);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === allJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(allJobs.map(j => j.id || j.source_url)));
    }
  };

  const handleProcessSelection = async () => {
    setProcessing(true);
    // Mock processing delay
    await new Promise(r => setTimeout(r, 1500));
    router.push("/dashboard/history");
  };

  const renderJobCard = (job: any, groupName: string, index: number) => {
    const id = job.id || job.source_url;
    // Use a truly unique key combining group, index, and ID
    const reactKey = `${groupName}-${id}-${index}`;
    
    return (
      <motion.div 
        key={reactKey} 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => toggleJobSelection(id)}
        className="group cursor-pointer flex items-center justify-between p-8 bg-[var(--color-surface-container-lowest)] rounded-[2.5rem] border border-[var(--color-outline-variant)]/10 shadow-sm hover:shadow-2xl hover:bg-[var(--color-surface-container-low)] transition-all duration-500 overflow-hidden relative"
      >
        <div className="flex items-center gap-6 relative z-10">
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
            selectedJobs.has(id) 
              ? "bg-[var(--color-primary)] border-transparent text-white shadow-xl shadow-[var(--color-primary)]/30" 
              : "bg-white border-slate-200 text-slate-300 shadow-sm"
          }`}>
            {selectedJobs.has(id) ? (
              <Check className="w-8 h-8 stroke-[4px] animate-in zoom-in-50 duration-300" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 group-hover:border-[var(--color-primary)] transition-colors" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="font-black text-slate-900 text-xl leading-tight tracking-tight">{job.title}</p>
              {job.is_sponsorship && (
                <span className="px-2 py-0.5 bg-[var(--color-tertiary-container)] text-[var(--color-on-tertiary-fixed-variant)] text-[9px] font-black uppercase rounded-md tracking-widest animate-pulse shadow-sm border border-[var(--color-tertiary-container)]">
                  Sponsorship Available
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-sm text-[var(--color-primary)] font-black">{job.company}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <p className="text-sm text-slate-700 font-bold">{job.location}</p>
            </div>
          </div>
        </div>
        <ChevronRight className="w-8 h-8 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-2 transition-all duration-500" />
      </motion.div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      
      {/* HEADER SECTION */}
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="text-[4rem] font-black leading-[1] tracking-tighter text-[var(--color-on-surface)]">
          Queue.
        </h2>
        <p className="text-[var(--color-secondary)] text-[12px] tracking-[0.3em] uppercase font-bold">
          Neural Selection Results
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)]" />
          <p className="text-sm font-bold text-[var(--color-secondary)] uppercase tracking-widest">Optimizing Matrix...</p>
        </div>
      ) : allJobs.length > 0 ? (
        <div className="space-y-16">
          
          {/* SECTION: TODAY / 24H */}
          {groupedJobs.today.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-end justify-between px-4 border-l-4 border-[var(--color-primary)] pl-6">
                <div>
                  <h3 className="text-2xl font-black text-[var(--color-on-surface)] tracking-tighter">Last 24 Hours.</h3>
                  <p className="text-[var(--color-secondary)] text-[10px] uppercase font-black tracking-widest opacity-80">High-Priority Fresh Signals</p>
                </div>
                {selectedJobs.size === 0 && (
                  <button 
                    onClick={toggleSelectAll} 
                    className="text-[var(--color-primary)] text-xs font-black tracking-widest uppercase hover:opacity-70 transition-opacity bg-[var(--color-primary)]/10 px-4 py-2 rounded-lg"
                  >
                    Select All
                  </button>
                )}
              </div>
              <div className="grid gap-4">
                {groupedJobs.today.map((j: any, i: number) => renderJobCard(j, "today", i))}
              </div>
            </section>
          )}

          {/* SECTION: THIS WEEK */}
          {groupedJobs.week.length > 0 && (
            <section className="space-y-8">
              <div className="flex items-end justify-between px-4 border-l-4 border-[var(--color-secondary)] pl-6 opacity-80">
                <div>
                  <h3 className="text-2xl font-black text-[var(--color-on-surface)] tracking-tighter">Within a Week.</h3>
                  <p className="text-[var(--color-secondary)] text-[10px] uppercase font-black tracking-widest opacity-60">Active Opportunities</p>
                </div>
              </div>
              <div className="grid gap-4 opacity-90">
                {groupedJobs.week.map((j: any, i: number) => renderJobCard(j, "week", i))}
              </div>
            </section>
          )}

          {/* SECTION: OLDER */}
          {groupedJobs.older.length > 0 && (
            <section className="space-y-8 opacity-60">
              <div className="flex items-end justify-between px-4 border-l-4 border-zinc-300 pl-6">
                <div>
                  <h3 className="text-xl font-black text-[var(--color-on-surface)] tracking-tighter">Older Signals.</h3>
                </div>
              </div>
              <div className="grid gap-4 grayscale-[0.5]">
                {groupedJobs.older.map((j: any, i: number) => renderJobCard(j, "older", i))}
              </div>
            </section>
          )}

          {/* BULK ACTION BAR */}
          <AnimatePresence>
            {selectedJobs.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[60] w-full max-w-lg px-6"
              >
                <div className="bg-[var(--color-on-surface)] border border-white/10 rounded-[2rem] p-6 shadow-2xl flex items-center justify-between gap-6">
                  <div className="flex flex-col">
                    <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">Bulk Action</span>
                    <span className="text-white font-bold">{selectedJobs.size} Jobs Ready</span>
                  </div>
                  <button 
                    onClick={handleProcessSelection}
                    disabled={processing}
                    className="h-14 bg-[var(--color-primary)] text-white px-8 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-[var(--color-primary)]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {processing ? <Loader2 className="animate-spin w-5 h-5" /> : "Process Selection"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 space-y-6">
          <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-300">
            <Zap className="w-12 h-12" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-zinc-400">Radar Empty.</h3>
            <p className="text-zinc-400 font-medium">No relevance matches detected.</p>
          </div>
          <Link href="/dashboard" className="inline-flex px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-colors">
            Trigger Rescan
          </Link>
        </div>
      )}
    </div>
  );
}

function Target(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
  )
}
