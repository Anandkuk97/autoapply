"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, FileText, Download, Copy, ShieldCheck, 
  Loader2, Briefcase, MapPin, Target, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplication();
  }, [params.id]);

  const fetchApplication = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", params.id)
      .single();

    if (data) setApp(data);
    setLoading(false);
  };

  const downloadAsWord = (content: string, filename: string) => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>CV</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + content.replace(/\n/g, '<br>') + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${filename}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)]" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retrieving Neural Record...</p>
    </div>
  );

  if (!app) return (
    <div className="text-center py-20 space-y-6">
      <h3 className="text-2xl font-black text-slate-900">Record Not Found.</h3>
      <Link href="/dashboard/history" className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-widest">Back to Registry</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 print:p-0">
      {/* NAVIGATION & ACTIONS */}
      <nav className="flex items-center justify-between print:hidden">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to History
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => downloadAsWord(app.tailored_cv, `${app.company}_Tailored_CV`)}
            className="h-12 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-lg"
          >
            <FileText className="w-4 h-4" /> Word
          </button>
          <button 
            onClick={() => window.print()}
            className="h-12 px-6 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* METADATA SIDEBAR */}
        <aside className="lg:col-span-4 space-y-6 print:hidden">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
            <div className="space-y-4">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-widest">
                Transmission Record
              </span>
              <h1 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">
                {app.role || "Untitled Position"}
              </h1>
              <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                <p className="text-[var(--color-primary)]">{app.company}</p>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <p>{app.location}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Match Score</span>
                  <p className="text-2xl font-black text-slate-900">{app.match_score}%</p>
               </div>
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                  <p className="text-xl font-black text-emerald-600 capitalize">{app.status}</p>
               </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Insight</h4>
               <p className="text-xs text-slate-700 leading-relaxed font-medium italic">
                  "This document was synthesized on {new Date(app.created_at).toLocaleDateString()} using neural ATS optimization patterns."
               </p>
            </div>
          </div>
        </aside>

        {/* DOCUMENT VIEW */}
        <main className="lg:col-span-8 print:col-span-12">
           <div className="bg-white rounded-[1rem] shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-0 hover:border-emerald-200 transition-colors">
              <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex items-center justify-between print:hidden">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-sans">Tailored Master Document</span>
                 <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              
              <div className="p-12 sm:p-20 aspect-[1/1.414] overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm print:overflow-visible print:p-0">
                 <pre className="whitespace-pre-wrap font-serif text-slate-950 selection:bg-emerald-100">
                    {app.tailored_cv}
                 </pre>

                 {app.cover_letter && (
                   <>
                     <div className="my-16 h-px bg-slate-100 border-dashed border-b border-slate-300" />
                     <h4 className="font-black text-slate-950 uppercase tracking-widest mb-8 font-sans">Cover Letter</h4>
                     <pre className="whitespace-pre-wrap font-serif text-slate-900 selection:bg-emerald-100 italic">
                        {app.cover_letter}
                     </pre>
                   </>
                 )}
              </div>
           </div>
        </main>
      </div>
    </div>
  );
}
