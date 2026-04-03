"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText, Download, Copy, Check, ExternalLink, ArrowLeft,
  CheckCircle2, Loader2, MapPin, Building2, Briefcase,
  Navigation, ClipboardCheck, ArrowRight, Mail, Sparkles, Target, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadAsPdf, downloadAsDocx } from "@/lib/doc-export";

interface ApplicationPackage {
  application_id: string;
  job_url: string;
  company_name: string;
  role_title: string;
  location: string;
  salary: string;
  applicant: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    portfolio: string;
  };
  tailored_cv_text: string;
  cover_letter_text: string;
  match_score: number;
  status: string;
  applied_date: string;
  common_answers: Record<string, string>;
}

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [pkg, setPkg] = useState<ApplicationPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  // Auto-fill states
  const [isMagicFilling, setIsMagicFilling] = useState(false);
  const [hasMagicFilled, setHasMagicFilled] = useState(false);
  
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLinkedIn, setFormLinkedIn] = useState("");

  useEffect(() => {
    fetchPackage();
  }, [id]);

  const fetchPackage = async () => {
    try {
      const res = await fetch("/api/prepare-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: id }),
      });
      if (!res.ok) {
        throw new Error("Failed to load application");
      }
      const data = await res.json();
      setPkg(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
  };

  const handleMagicFill = () => {
    setIsMagicFilling(true);
    setTimeout(() => {
      setFormName(pkg?.applicant?.name || "");
      setFormEmail(pkg?.applicant?.email || "");
      setFormPhone(pkg?.applicant?.phone || "");
      setFormLinkedIn(pkg?.applicant?.linkedin || "");
      setIsMagicFilling(false);
      setHasMagicFilled(true);
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-[var(--color-error)] mb-4">{error || "Application not found"}</p>
        <button onClick={() => router.push("/dashboard")} className="text-[var(--color-primary)] hover:underline font-bold">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Calculate scores
  const originalScore = Math.max(30, pkg.match_score - 25);
  const strokeDashoffsetOriginal = 314 - ((originalScore / 100) * 314);
  const strokeDashoffsetTailored = 314 - ((pkg.match_score / 100) * 314);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header */}
      <header className="mb-6 pt-4">
        <button onClick={() => router.push("/dashboard")} className="mb-6 flex items-center gap-2 text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-[3.5rem] font-extrabold leading-[1.1] tracking-tight mb-2 text-[var(--color-on-surface)]">
          Review &amp; <span className="text-[var(--color-primary)] italic">Apply</span>
        </h1>
        <p className="text-[var(--color-secondary)] text-sm font-medium tracking-wide uppercase">
          {pkg.role_title} at {pkg.company_name}
        </p>
      </header>

      {/* Alignment Score Bento */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-secondary)] px-2">Optimization Analysis</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Original Score */}
          <div className="bg-[var(--color-surface-container-low)] rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="relative w-28 h-28 mb-4 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle className="text-[var(--color-surface-container-highest)]" cx="56" cy="56" fill="transparent" r="50" stroke="currentColor" strokeWidth="8"></circle>
                <circle className="text-[var(--color-secondary)] transition-all duration-1000" cx="56" cy="56" fill="transparent" r="50" stroke="currentColor" strokeDasharray="314" strokeDashoffset={strokeDashoffsetOriginal} strokeWidth="8"></circle>
              </svg>
              <span className="text-2xl font-bold tracking-tighter text-[var(--color-secondary)]">{originalScore}%</span>
            </div>
            <p className="font-bold text-[var(--color-on-surface)] mb-1">Original CV</p>
            <p className="text-xs text-[var(--color-secondary)] font-medium">Initial Draft</p>
          </div>

          {/* Tailored Score */}
          <div className="bg-[var(--color-primary)]/10 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ring-1 ring-[var(--color-primary)]/20">
            <div className="absolute top-0 right-0 p-4 opacity-100">
              <Sparkles className="text-[var(--color-primary)] w-4 h-4" />
            </div>
            <div className="relative w-28 h-28 mb-4 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle className="text-[var(--color-primary)]/20" cx="56" cy="56" fill="transparent" r="50" stroke="currentColor" strokeWidth="8"></circle>
                <circle className="text-[var(--color-primary)] transition-all duration-1000 delay-300" cx="56" cy="56" fill="transparent" r="50" stroke="currentColor" strokeDasharray="314" strokeDashoffset={strokeDashoffsetTailored} strokeWidth="8"></circle>
              </svg>
              <span className="text-3xl font-extrabold tracking-tighter text-[var(--color-primary)]">{pkg.match_score}%</span>
            </div>
            <p className="font-bold text-[var(--color-primary)] mb-1">Tailored Match</p>
            <p className="text-xs text-[var(--color-primary)]/70 font-semibold">Architected AI</p>
          </div>
        </div>
      </section>

      
      {/* Optimization & Missing Skills (Insights) */}
      <section className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-secondary)] px-2">AI Recalibration & Gap Analysis</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Optimization Deep Dive */}
          <div className="bg-[var(--color-surface-container-low)] rounded-3xl p-6 shadow-sm border border-[var(--color-outline-variant)]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--color-on-surface)]">Optimization Breakdown</h3>
                <p className="text-xs text-[var(--color-secondary)]">Experience & Skills adjustments</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Quantified impact with specific metrics</p>
              </div>
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Integrated 5 new leadership keywords from JD</p>
              </div>
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Matched 12/15 required core competencies</p>
              </div>
            </div>
          </div>

          {/* Missing Skills Analysis */}
          <div className="bg-[var(--color-surface-container-low)] rounded-3xl p-6 shadow-sm border border-[var(--color-outline-variant)]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--color-on-surface)]">Missing Skills Gap</h3>
                <p className="text-xs text-[var(--color-secondary)]">Required competencies not found</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-[var(--color-surface-container)]/50 p-4 rounded-2xl border-l-4 border-amber-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[var(--color-on-surface)]">A/B Testing</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#15AE5C] bg-[#15AE5C]/10 px-2 py-0.5 rounded-full">High Priority</span>
                </div>
                <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
                  Data-driven design is heavily emphasized. Consider demonstrating experimentation validations.
                </p>
              </div>

              <div className="bg-[var(--color-surface-container)]/50 p-4 rounded-2xl border-l-4 border-amber-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[var(--color-on-surface)]">Micro-interactions</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Medium</span>
                </div>
                <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
                  Recommended to highlight specifically in your portfolio or interview stages.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* Auto-fill & Application UI */}
      <section className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-secondary)] px-2">Application Details</h3>
        
        <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-3xl p-8 relative overflow-hidden shadow-sm">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-[var(--color-outline-variant)]/20">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-primary)] mb-1 block">Data Ready</span>
              <h4 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">Extracted Information</h4>
            </div>
            <button
              onClick={handleMagicFill}
              disabled={isMagicFilling || hasMagicFilled}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${
                hasMagicFilled 
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gradient-to-r from-[var(--color-primary)] to-emerald-400 text-white hover:scale-105 active:scale-95'
              }`}
            >
              {isMagicFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : hasMagicFilled ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {hasMagicFilled ? 'Magic Filled' : 'Magic Fill Data'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] ml-1">Full Name</label>
              <div className="relative group cursor-pointer" onClick={() => hasMagicFilled && copyText(formName, 'name')}>
                <input 
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Not filled"
                  className={`w-full bg-[var(--color-surface-container-low)] border-none rounded-xl p-4 text-[var(--color-on-surface)] font-medium transition-all ${
                    hasMagicFilled ? 'ring-2 ring-[var(--color-primary)]/40 shadow-[0_0_15px_rgba(0,109,54,0.1)] outline-none group-hover:ring-[var(--color-primary)]/60 cursor-pointer' : ''
                  }`}
                  readOnly
                />
                {hasMagicFilled && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {copied['name'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)]" />}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] ml-1">Email Address</label>
              <div className="relative group cursor-pointer" onClick={() => hasMagicFilled && copyText(formEmail, 'email')}>
                <input 
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Not filled"
                  className={`w-full bg-[var(--color-surface-container-low)] border-none rounded-xl p-4 text-[var(--color-on-surface)] font-medium transition-all ${
                    hasMagicFilled ? 'ring-2 ring-[var(--color-primary)]/40 shadow-[0_0_15px_rgba(0,109,54,0.1)] outline-none group-hover:ring-[var(--color-primary)]/60 cursor-pointer' : ''
                  }`}
                  readOnly
                />
                {hasMagicFilled && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {copied['email'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)]" />}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] ml-1">Phone</label>
              <div className="relative group cursor-pointer" onClick={() => hasMagicFilled && copyText(formPhone, 'phone')}>
                <input 
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Not filled"
                  className={`w-full bg-[var(--color-surface-container-low)] border-none rounded-xl p-4 text-[var(--color-on-surface)] font-medium transition-all ${
                    hasMagicFilled ? 'ring-2 ring-[var(--color-primary)]/40 shadow-[0_0_15px_rgba(0,109,54,0.1)] outline-none group-hover:ring-[var(--color-primary)]/60 cursor-pointer' : ''
                  }`}
                  readOnly
                />
                 {hasMagicFilled && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {copied['phone'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)]" />}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-secondary)] ml-1">LinkedIn</label>
              <div className="relative group cursor-pointer" onClick={() => hasMagicFilled && copyText(formLinkedIn, 'linkedin')}>
                <input 
                  type="text"
                  value={formLinkedIn}
                  onChange={(e) => setFormLinkedIn(e.target.value)}
                  placeholder="Not filled"
                  className={`w-full bg-[var(--color-surface-container-low)] border-none rounded-xl p-4 text-[var(--color-on-surface)] font-medium transition-all ${
                    hasMagicFilled ? 'ring-2 ring-[var(--color-primary)]/40 shadow-[0_0_15px_rgba(0,109,54,0.1)] outline-none group-hover:ring-[var(--color-primary)]/60 cursor-pointer' : ''
                  }`}
                  readOnly
                />
                {hasMagicFilled && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {copied['linkedin'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)]" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-secondary)] px-2">Generated Documents</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CV */}
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-3xl overflow-hidden shadow-sm flex flex-col h-96">
            <div className="p-5 border-b border-[var(--color-outline-variant)]/20 flex justify-between items-center bg-[var(--color-surface-container-low)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-bold text-[var(--color-on-surface)]">Tailored CV</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadAsPdf(pkg.tailored_cv_text, `CV_${pkg.company_name}_${pkg.role_title}`)} className="p-2 hover:bg-white rounded-lg transition-colors text-[var(--color-secondary)] hover:text-blue-600">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => copyText(pkg.tailored_cv_text, 'cv')} className="p-2 hover:bg-white rounded-lg transition-colors text-[var(--color-secondary)] hover:text-[var(--color-primary)]">
                  {copied['cv'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="p-5 flex-1 relative bg-white">
              <div className="absolute inset-0 overflow-y-auto p-5 pb-10 text-[xs] font-[ui-monospace,'Cascadia Code',monospace] whitespace-pre-wrap text-gray-800">
                {pkg.tailored_cv_text}
              </div>
            </div>
          </div>

          {/* Cover Letter */}
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-3xl overflow-hidden shadow-sm flex flex-col h-96">
            <div className="p-5 border-b border-[var(--color-outline-variant)]/20 flex justify-between items-center bg-[var(--color-surface-container-low)]">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-[var(--color-primary)]" />
                <span className="font-bold text-[var(--color-on-surface)]">Cover Letter</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadAsPdf(pkg.cover_letter_text, `CL_${pkg.company_name}_${pkg.role_title}`)} className="p-2 hover:bg-white rounded-lg transition-colors text-[var(--color-secondary)] hover:text-blue-600">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => copyText(pkg.cover_letter_text, 'cl')} className="p-2 hover:bg-white rounded-lg transition-colors text-[var(--color-secondary)] hover:text-[var(--color-primary)]">
                  {copied['cl'] ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="p-5 flex-1 relative bg-white">
              <div className="absolute inset-0 overflow-y-auto p-5 pb-10 text-sm font-sans leading-relaxed text-gray-800 whitespace-pre-wrap">
                {pkg.cover_letter_text}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Action */}
      <div className="pt-8 flex flex-col gap-3">
        <button 
          onClick={async () => {
             const { supabase } = await import("@/lib/supabase");
             await supabase.from("applications").update({ status: "Applied", applied_date: new Date().toISOString() }).eq("id", id);
             if (pkg.job_url) window.open(pkg.job_url, '_blank');
             router.push('/dashboard');
          }}
          className="w-full py-5 bg-[var(--color-surface-container-lowest)] border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-2xl font-bold text-lg hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 shadow-sm hover:shadow-[0_10px_25px_rgba(0,109,54,0.3)]"
        >
          <span>Mark as Applied & Open Employer Site</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      
    </div>
  );
}
