"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Copy, CheckCircle2, CircleDashed, Briefcase, FileText, Check, Loader2, Sparkles, Navigation, AlertCircle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadAsPdf, downloadAsDocx } from "@/lib/doc-export";

export default function DashboardPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Generator States
  const [jobDescription, setJobDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 0: none, 1: Analyzing, 2: Scoring, 3: CV, 4: Cover Letter, 5: Done
  const [results, setResults] = useState<any>(null);
  const [atsScore, setAtsScore] = useState<any>(null);
  const [cvCopied, setCvCopied] = useState(false);
  const [clCopied, setClCopied] = useState(false);
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);

  const steps = [
    "Analyzing JD",
    "Scoring Match",
    "Tailoring CV",
    "Writing Cover Letter"
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingApps(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) setUser(authUser);

    if (authUser) {
      const [appsResult, profileResult] = await Promise.all([
        supabase
          .from("applications")
          .select("*")
          .eq("user_id", authUser.id)
          .order("applied_date", { ascending: false }),
        supabase
          .from("users")
          .select("name, cv_text, cv_parsed_json")
          .eq("id", authUser.id)
          .single()
      ]);

      if (!appsResult.error && appsResult.data) {
        setApplications(appsResult.data);
      }
      if (!profileResult.error && profileResult.data) {
        setUserProfile(profileResult.data);
      }
    }
    setLoadingApps(false);
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim() || !user) return;
    setIsGenerating(true);
    setResults(null);
    setAtsScore(null);
    setError("");
    setProgressStep(1);

    // Simulate progress visual steps
    const intervals = [
      setTimeout(() => setProgressStep(2), 3000),
      setTimeout(() => setProgressStep(3), 6000),
      setTimeout(() => setProgressStep(4), 9000),
    ];

    try {
      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jobDescription, user_id: user.id })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      
      // Stop fake progress, snap to End
      intervals.forEach(clearTimeout);
      setProgressStep(5);
      setResults(data);

      // Save to database
      const { data: insertedData, error: dbError } = await supabase.from("applications").insert({
        user_id: user.id,
        company: data.jd_analysis.company,
        role: data.jd_analysis.title,
        location: data.jd_analysis.location,
        match_score: data.match_assessment.score,
        status: "Applied", // Default
        tailored_cv: data.tailored_cv,
        cover_letter: data.cover_letter,
        jd_text: jobDescription
      }).select().single();

      if (!dbError && insertedData) {
        setApplications(prev => [insertedData, ...prev]);
      }

      // Calculate ATS Score After (Tailored CV vs JD)
      const atsRes = await fetch("/api/score-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_text: data.tailored_cv, jd_analysis: data.jd_analysis })
      });
      if (atsRes.ok) {
        const atsData = await atsRes.json();
        setAtsScore(atsData);
      }

    } catch (err: any) {
      intervals.forEach(clearTimeout);
      setProgressStep(0);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (!error) {
      setApplications(prev => prev.map(app => app.id === id ? { ...app, status: newStatus } : app));
    }
  };

  // Stats calc
  const totalApplied = applications.length;
  const callbacks = applications.filter(a => a.status === "Callback" || a.status === "Interview").length;
  const interviews = applications.filter(a => a.status === "Interview").length;
  const hitRate = totalApplied > 0 ? Math.round((callbacks / totalApplied) * 100) : 0;

  const copyToClipboard = (text: string, type: 'cv' | 'cl') => {
    navigator.clipboard.writeText(text);
    if (type === 'cv') {
      setCvCopied(true);
      setTimeout(() => setCvCopied(false), 2000);
    } else {
      setClCopied(true);
      setTimeout(() => setClCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-12">
      
      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Total Applied", value: totalApplied, icon: Briefcase },
          { label: "Callbacks", value: callbacks, icon: Navigation },
          { label: "Interviews", value: interviews, icon: CheckCircle2 },
          { label: "Hit Rate", value: `${hitRate}%`, icon: Sparkles }
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col gap-2">
            <div className="flex justify-between items-center text-gray-400 mb-2">
              <span className="text-sm font-medium">{stat.label}</span>
              <stat.icon className="w-4 h-4" />
            </div>
            <h3 className="text-3xl font-heading font-bold text-white">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* JOB INPUT SECTION */}
      <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
          <Sparkles className="text-[var(--color-primary)] w-6 h-6" />
          AI Application Generator
        </h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* CV Status Indicator */}
        {userProfile?.cv_text ? (
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-[#81C784]" />
              <span className="text-gray-300">Your CV: <span className="text-white font-semibold">{userProfile.name || "Uploaded"}</span></span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#81C784]" />
            </div>
            <a href="/dashboard/profile" className="text-xs text-[var(--color-primary)] hover:underline">Change CV</a>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
            <span className="text-sm text-red-400">No CV uploaded yet. Upload your CV first to generate applications.</span>
            <a href="/dashboard/profile" className="text-xs text-[var(--color-primary)] hover:underline font-semibold">Upload CV</a>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Paste Job Description</label>
          <textarea
            rows={5}
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition resize-y"
          />
        </div>

        {/* PIPELINE PROGRESS */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                {steps.map((step, idx) => {
                  const stepNum = idx + 1;
                  const isActive = progressStep === stepNum;
                  const isCompleted = progressStep > stepNum || progressStep === 5;
                  
                  return (
                    <div key={idx} className="flex flex-col gap-2 items-center text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted ? "bg-[#81C784] text-black" :
                        isActive ? "bg-[var(--color-primary)] text-black animate-pulse" :
                        "bg-white/5 border border-white/10 text-gray-500"
                      }`}>
                        {isCompleted ? <Check className="w-4 h-4" /> : <span className="font-bold text-sm">{stepNum}</span>}
                      </div>
                      <span className={`text-xs font-semibold ${
                        isCompleted ? "text-[#81C784]" : isActive ? "text-[var(--color-primary)]" : "text-gray-500"
                      }`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end">
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !jobDescription.trim()}
            className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="w-5 h-5" /> Generate Tailored Application</>
            )}
          </button>
        </div>
      </div>

      {/* RESULTS DISPLAY */}
      {results && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Match Score Card */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 font-heading mb-4">Match Score</h3>
              <div className={`w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 ${
                results.match_assessment.score >= 70 ? 'border-[#81C784] text-[#81C784]' :
                results.match_assessment.score >= 50 ? 'border-yellow-400 text-yellow-400' :
                'border-red-400 text-red-400'
              }`}>
                <span className="text-4xl font-extrabold">{results.match_assessment.score}%</span>
              </div>
              <div className={`px-4 py-1 rounded-full font-bold text-sm ${
                results.match_assessment.verdict === 'APPLY' ? 'bg-[#81C784]/20 text-[#81C784]' :
                results.match_assessment.verdict === 'REVIEW' ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-red-400/20 text-red-400'
              }`}>
                {results.match_assessment.verdict}
              </div>
            </div>

            {/* Assessment Details */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-heading font-bold text-white mb-3">Strong Matches</h3>
                <ul className="space-y-2">
                  {results.match_assessment.strong_matches?.map((match: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-[#81C784] mt-0.5 shrink-0" />
                      {match}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-xl font-heading font-bold text-white mb-3">Identified Gaps</h3>
                <ul className="space-y-2">
                  {results.match_assessment.gaps?.map((gap: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
                      <CircleDashed className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Docs row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tailored CV */}
            <div className="bg-white rounded-2xl overflow-hidden flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center text-black">
                <h3 className="font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Tailored CV
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(results.tailored_cv, 'cv')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700" title="Copy"
                  >
                    {cvCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => downloadAsPdf(results.tailored_cv, 'Tailored_CV')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download PDF"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() => downloadAsDocx(results.tailored_cv, 'Tailored_CV')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download DOCX"
                  >
                    <Download className="w-4 h-4" /> DOCX
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[600px] text-black text-sm font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace]">
                <FormattedCV text={results.tailored_cv} />
              </div>
            </div>

            {/* Cover Letter */}
            <div className="bg-white rounded-2xl overflow-hidden flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center text-black">
                <h3 className="font-bold flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-[var(--color-primary)]" />
                  Cover Letter
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(results.cover_letter, 'cl')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700" title="Copy"
                  >
                    {clCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => downloadAsPdf(results.cover_letter, 'Cover_Letter')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download PDF"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() => downloadAsDocx(results.cover_letter, 'Cover_Letter')}
                    className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download DOCX"
                  >
                    <Download className="w-4 h-4" /> DOCX
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[600px] text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {results.cover_letter}
              </div>
            </div>
          </div>

          {/* ATS Score */}
          {atsScore && (
            <div className="bg-[#81C784]/10 border border-[#81C784]/30 p-6 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-[#81C784] text-black font-extrabold rounded-2xl flex items-center justify-center text-2xl">
                  {atsScore.score}
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">ATS Compatibility Score</h4>
                  <p className="text-[#81C784] text-sm">After tailoring, your CV matches <strong>{atsScore.keywords_found?.length || 0}</strong> critical JD keywords.</p>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      )}

      {/* APPLICATION TRACKER */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
            <Navigation className="text-[var(--color-primary)] w-5 h-5" />
            Application Tracker
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300 min-w-[600px]">
            <thead className="bg-white/5 text-gray-400 font-heading">
              <tr>
                <th className="px-6 py-4">Company & Role</th>
                <th className="px-6 py-4">Match Score</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {applications.length === 0 && !loadingApps ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No applications generated yet. Paste a JD above to get started!
                  </td>
                </tr>
              ) : applications.map((app) => (
                 <tr key={app.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{app.company}</div>
                    <div className="text-xs text-gray-500">{app.role}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      app.match_score >= 70 ? 'bg-[#81C784]/20 text-[#81C784]' :
                      app.match_score >= 50 ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-red-400/20 text-red-400'
                    }`}>
                      {app.match_score}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)] text-gray-300"
                    >
                      <option value="Applied">Applied</option>
                      <option value="Callback">Callback</option>
                      <option value="Interview">Interview</option>
                      <option value="Rejected">Rejected</option>
                      <option value="No Response">No Response</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-sans">
                    {new Date(app.applied_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    
    </div>
  );
}

// ── Styled CV renderer ──
const CV_HEADERS = [
  'PROFESSIONAL SUMMARY',
  'CORE COMPETENCIES',
  'PROFESSIONAL EXPERIENCE',
  'KEY ACHIEVEMENTS',
  'SELECTED PROJECT',
  'EDUCATION',
  'CERTIFICATIONS & TECHNICAL SKILLS',
  'CERTIFICATIONS',
  'TECHNICAL SKILLS',
];
const DIVIDER_RE = /^[━─\-=]{5,}$/;
const DATE_RE = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*-\s*Present\b)/i;

function FormattedCV({ text }: { text: string }) {
  const lines = text.split('\n');
  let currentSection = '';
  let competencyBullets: string[] = [];
  const elements: React.ReactNode[] = [];
  let headerIdx = 0;

  const flushCompetencies = () => {
    if (competencyBullets.length > 0) {
      const half = Math.ceil(competencyBullets.length / 2);
      const col1 = competencyBullets.slice(0, half);
      const col2 = competencyBullets.slice(half);
      elements.push(
        <div key={`comp-${elements.length}`} className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 mb-1">
          {col1.map((c, j) => (
            <div key={`c1-${j}`} className="text-gray-800 text-[11px] leading-relaxed">{'\u2022'} {c}</div>
          ))}
          {col2.map((c, j) => (
            <div key={`c2-${j}`} className="text-gray-800 text-[11px] leading-relaxed">{'\u2022'} {c}</div>
          ))}
        </div>
      );
      competencyBullets = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const key = `line-${i}`;

    if (!trimmed) {
      if (currentSection === 'CORE COMPETENCIES') continue;
      flushCompetencies();
      elements.push(<div key={key} className="h-1.5" />);
      continue;
    }

    if (DIVIDER_RE.test(trimmed)) {
      flushCompetencies();
      // Skip explicit dividers — we draw borders under headers
      continue;
    }

    if (CV_HEADERS.some(h => trimmed === h || trimmed.startsWith(h))) {
      flushCompetencies();
      currentSection = trimmed;
      elements.push(
        <div key={key} className="font-bold text-[11.5px] tracking-[2px] text-gray-900 pt-3 pb-1 border-b-[1.5px] border-gray-800 font-sans">
          {trimmed}
        </div>
      );
      continue;
    }

    // Before first header: name/subtitle/contact
    if (!currentSection) {
      if (headerIdx === 0 && trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes('|')) {
        elements.push(
          <div key={key} className="text-center font-bold text-[18px] tracking-[3px] text-gray-900 font-sans mb-0">
            {trimmed}
          </div>
        );
        headerIdx++;
        continue;
      }
      if (trimmed.includes('|')) {
        const isContact = trimmed.includes('@') || /\d{5,}/.test(trimmed.replace(/[\s\-+()]/g, ''));
        elements.push(
          <div key={key} className={`text-center text-[10px] leading-relaxed ${isContact ? 'text-gray-500 mb-2' : 'text-gray-600 mb-0'}`}>
            {trimmed}
          </div>
        );
        headerIdx++;
        continue;
      }
      headerIdx++;
    }

    // CORE COMPETENCIES: collect bullets for 2-column
    if (currentSection === 'CORE COMPETENCIES' && trimmed.startsWith('\u2022')) {
      competencyBullets.push(trimmed.replace(/^\u2022\s*/, ''));
      continue;
    }

    // Date line — left text / right-aligned date
    const dateMatch = trimmed.match(DATE_RE);
    if (dateMatch) {
      flushCompetencies();
      const idx = trimmed.indexOf(dateMatch[0]);
      const left = trimmed.slice(0, idx).trim();
      const right = dateMatch[0].trim();
      elements.push(
        <div key={key} className="flex justify-between items-baseline gap-4 mt-2 mb-0.5">
          <span className="font-bold text-[11px] text-gray-900">{left}</span>
          <span className="text-gray-500 whitespace-nowrap text-[10px] shrink-0">{right}</span>
        </div>
      );
      continue;
    }

    // Bullet
    if (trimmed.startsWith('\u2022')) {
      flushCompetencies();
      elements.push(
        <div key={key} className="pl-3.5 -indent-3 leading-relaxed text-gray-800 text-[10.5px]">
          {trimmed}
        </div>
      );
      continue;
    }

    // Default text
    flushCompetencies();
    elements.push(
      <div key={key} className="leading-relaxed text-gray-800 text-[10.5px]">
        {trimmed}
      </div>
    );
  }

  flushCompetencies();

  return <div className="space-y-0">{elements}</div>;
}
