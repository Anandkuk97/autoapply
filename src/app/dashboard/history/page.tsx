"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  CheckCircle2, Briefcase, FileText, ChevronRight, 
  MapPin, Clock, Calendar, ExternalLink, Sparkles,
  ArrowUpRight, Target, Zap
} from "lucide-react";
import { motion } from "framer-motion";

export default function HistoryPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: apps } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setApplications(apps || []);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'applied': return 'bg-emerald-500 text-white';
      case 'ready': return 'bg-blue-500 text-white';
      case 'rejected': return 'bg-red-500 text-white';
      default: return 'bg-zinc-200 text-zinc-600';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
      
      {/* HEADER SECTION */}
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="text-[4rem] font-black leading-[1] tracking-tighter text-[var(--color-on-surface)]">
          Apply.
        </h2>
        <p className="text-[var(--color-secondary)] text-[12px] tracking-[0.3em] uppercase font-bold opacity-60">
          Transmission Status & Tracking
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Clock className="w-12 h-12 text-zinc-300 animate-pulse" />
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Retrieving Log...</p>
        </div>
      ) : applications.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-black text-[var(--color-on-surface)] tracking-tighter">Transmission Registry.</h3>
            <span className="text-[10px] font-black uppercase text-[var(--color-secondary)] opacity-50 tracking-widest">{applications.length} Records Detected</span>
          </div>

          <div className="grid gap-6">
            {applications.map((app) => (
              <div 
                key={app.id} 
                className="group relative flex items-center justify-between p-8 bg-white/80 backdrop-blur-xl rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:bg-white transition-all duration-500 overflow-hidden"
              >
                {/* Status Dot */}
                <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(app.status)}`} />
                
                <div className="flex items-center gap-6 relative z-10 w-full">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-[var(--color-primary)] transition-transform group-hover:scale-110 shadow-inner">
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${getStatusColor(app.status)} mb-1 inline-block`}>
                        {app.status}
                      </span>
                      {app.source_url === 'manual-forge' && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 mb-1 inline-block">
                          Neural Forge
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-slate-900 text-xl leading-tight tracking-tight">{app.role || app.job_title}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-[var(--color-primary)]">{app.company || app.company_name}</p>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                      <p className="text-sm text-slate-600 font-bold">Match: {app.match_score || 0}%</p>
                    </div>
                  </div>

                  <Link 
                    href={`/dashboard/history/${app.id}`}
                    className="h-12 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                  >
                    View Document <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-[var(--color-surface-container-low)] rounded-[3rem] p-16 text-center space-y-8 border border-[var(--color-outline-variant)]/10">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-zinc-300">
            <ZapOff className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-black text-[var(--color-on-surface)] tracking-tighter">History Empty.</h3>
            <p className="text-[var(--color-secondary)] font-medium max-w-xs mx-auto">Neural Radar has not detected any manual or automated transmissions yet.</p>
          </div>
          <Link href="/dashboard" className="inline-flex h-16 px-10 items-center justify-center bg-[var(--color-primary)] text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-[var(--color-primary)]/20 active:scale-95 transition-all">
             Start Engine <Zap className="ml-3 w-5 h-5 fill-current" />
          </Link>
        </section>
      )}

    </div>
  );
}

function ZapOff(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 4.5 3-3V9l4.5 1h-2M2 2l20 20"></path><path d="m13 18.5-3 3V15L5.5 14l6.5-1.5"></path></svg>
  )
}
