"use client";

import { useState } from "react";
import { 
  PenLine, Sparkles, Zap, Loader2, FileText, 
  CheckCircle2, Copy, Download, ChevronRight,
  ShieldCheck, RefreshCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ForgePage() {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleForge = async () => {
    if (!jobDescription.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          job_description: jobDescription
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to forge document");
      }
      
      const data = await res.json();
      setResult(data);

      // PERSIST TO HISTORY
      await supabase.from("applications").insert({
        user_id: user.id,
        company: data.jd_analysis?.company || "Manual Entry",
        role: data.jd_analysis?.title || "Manual Forge",
        location: data.jd_analysis?.location || "Remote",
        match_score: data.match_assessment?.score || 0,
        status: "ready",
        tailored_cv: data.tailored_cv,
        cover_letter: data.cover_letter,
        jd_text: jobDescription,
        source_url: "manual-forge"
      });

    } catch (err: any) {
      setError(err.message || "An error occurred during forging.");
    } finally {
      setLoading(false);
    }
  };

  const downloadAsWord = (content: string, filename: string) => {
    const styles = `
      <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #333; }
        h1, h2, h3 { color: #000; margin-top: 20pt; margin-bottom: 10pt; }
        p { margin-bottom: 10pt; }
        .header { text-align: center; border-bottom: 1pt solid #ccc; padding-bottom: 10pt; margin-bottom: 20pt; }
      </style>
    `;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>${styles}<title>CV</title></head><body>`;
    const footer = "</body></html>";
    
    // Simple conversion of markdown-like syntax to HTML for Word
    let formattedContent = content
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    const sourceHTML = header + `<div class="document"><p>${formattedContent}</p></div>` + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${filename}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const downloadAsPDF = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 print:p-0 print:m-0">
      {/* HEADER */}
      <header className="space-y-2 text-center sm:text-left print:hidden">
        <h2 className="text-[4rem] font-black leading-[1] tracking-tighter text-[var(--color-on-surface)]">
          Forge.
        </h2>
        <p className="text-[var(--color-secondary)] text-[12px] tracking-[0.3em] uppercase font-bold opacity-60">
          Direct Material Synthesis
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* INPUT SECTION */}
        <section className="lg:col-span-4 space-y-6 print:hidden">
          <div className="bg-[var(--color-surface-container-lowest)] rounded-[2.5rem] border border-[var(--color-outline-variant)]/10 p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center text-[var(--color-primary)]">
                <PenLine className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black tracking-tight text-[var(--color-on-surface)]">Input Job Description</h3>
            </div>
            
            <textarea 
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full h-80 bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/20 rounded-[2rem] p-6 text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none placeholder:text-slate-300 text-[var(--color-on-surface)]"
            />

            <button 
              onClick={handleForge}
              disabled={loading || !jobDescription.trim()}
              className="w-full h-16 bg-[var(--color-primary)] text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 fill-current" />}
              Initialize Forge
            </button>
            {error && <p className="text-red-500 text-xs font-bold text-center mt-4">{error}</p>}
          </div>

          {result && (
            <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-6 border border-emerald-100 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Forge Insight</h4>
              <p className="text-xs font-bold text-slate-700">AI has synthesized a perfect match for this role based on your core CV.</p>
              <div className="flex flex-wrap gap-2">
                 <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md uppercase">ATS Optimized</span>
                 <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[9px] font-black rounded-md uppercase">Action Verbs Added</span>
              </div>
            </div>
          )}
        </section>

        {/* OUTPUT SECTION */}
        <section className="lg:col-span-8 relative min-h-[600px] print:col-span-12">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[600px] bg-[var(--color-surface-container-low)]/50 rounded-[2.5rem] border border-dashed border-[var(--color-outline-variant)]/30 flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-200 mb-6 shadow-inner">
                  <RefreshCcw className="w-10 h-10" />
                </div>
                <h4 className="font-bold text-slate-400">Awaiting Material</h4>
                <p className="text-xs text-slate-300 mt-2">Neural synthesis results (Full CV & Letters) will appear here.</p>
              </motion.div>
            )}

            {loading && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[600px] bg-[var(--color-surface-container-low)] rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center gap-4"
              >
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-[var(--color-primary)] animate-pulse" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--color-primary)]">Synthesizing Full Document...</p>
              </motion.div>
            )}

            {result && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                {/* TOOLBAR */}
                <div className="flex items-center justify-between px-4 print:hidden">
                   <div className="flex gap-2">
                      <button 
                        onClick={() => downloadAsWord(result.tailored_cv, `${result.jd_analysis?.company || 'Tailored'}_CV`)}
                        className="h-12 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Download Word
                      </button>
                      <button 
                        onClick={downloadAsPDF}
                        className="h-12 px-6 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                   </div>
                   <button className="h-12 w-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                      <Copy className="w-4 h-4" />
                   </button>
                </div>

                {/* THE MASTER DOCUMENT */}
                <div className="bg-white rounded-[1rem] shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-0">
                   <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex items-center justify-between print:hidden">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Tailored Document</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                   </div>
                   
                   {/* SCROLLABLE PAPER VIEW */}
                   <div className="p-12 sm:p-20 aspect-[1/1.414] overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm print:overflow-visible print:p-0 print:text-[12pt] shadow-inner">
                      <div className="max-w-[700px] mx-auto space-y-6">
                        {result.tailored_cv ? (
                          result.tailored_cv.split('\n\n').map((para: string, i: number) => {
                            if (para.startsWith('# ')) return <h1 key={i} className="text-3xl font-black border-b-2 border-slate-900 pb-2 mb-6 uppercase tracking-tight">{para.replace('# ', '')}</h1>;
                            if (para.startsWith('## ')) return <h2 key={i} className="text-xl font-black mt-8 mb-4 border-l-4 border-[var(--color-primary)] pl-4">{para.replace('## ', '')}</h2>;
                            if (para.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-6 mb-2">{para.replace('### ', '')}</h3>;
                            return <p key={i} className="mb-4 whitespace-pre-line">{para}</p>;
                          })
                        ) : (
                          <p className="text-center text-slate-400 py-20">Full tailored document not generated. Please retry.</p>
                        )}

                        <div className="my-16 h-px bg-slate-100 border-dashed border-b border-slate-300 print:hidden" />
                        
                        <div className="space-y-6">
                          <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-4">
                            <Zap className="w-5 h-5 text-[var(--color-primary)]" /> Cover Letter
                          </h2>
                          <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 italic text-slate-700 leading-loose">
                            {result.cover_letter?.split('\n').map((line: string, i: number) => (
                              <p key={i} className="mb-2">{line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="flex items-center justify-center gap-8 print:hidden">
                   <Link href="/dashboard/history" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--color-primary)] transition-colors flex items-center gap-2">
                      <ChevronRight className="w-4 h-4" /> View in Transmission Registry
                   </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
