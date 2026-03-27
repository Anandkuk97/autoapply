"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Copy, CheckCircle2, CircleDashed, Briefcase, FileText, Check, Loader2,
  Sparkles, Navigation, AlertCircle, Download, Search, Zap, PlayCircle,
  MapPin, Building2, ExternalLink, ChevronDown, ChevronUp, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { downloadAsPdf, downloadAsDocx } from "@/lib/doc-export";

// ── Types ──
interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  source: string;
  source_url: string;
  posted_date: string;
  match_score?: number;
  status?: string;
}

export default function DashboardPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Generator States
  const [jobDescription, setJobDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [atsScore, setAtsScore] = useState<any>(null);
  const [cvCopied, setCvCopied] = useState(false);
  const [clCopied, setClCopied] = useState(false);
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);

  // Job Search States
  const [foundJobs, setFoundJobs] = useState<JobListing[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchCriteria, setSearchCriteria] = useState<any>(null);

  // Auto-Apply States
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [autoProgress, setAutoProgress] = useState("");
  const [autoResults, setAutoResults] = useState<any>(null);

  // Automation (full pipeline) States
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationStep, setAutomationStep] = useState("");

  // Job cards expanded state
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [viewingApp, setViewingApp] = useState<any>(null);

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
      // Fetch applications (client-side) and profile (server-side to bypass RLS) in parallel
      const [appsResult, profileRes] = await Promise.all([
        supabase
          .from("applications")
          .select("*")
          .eq("user_id", authUser.id)
          .order("applied_date", { ascending: false }),
        fetch("/api/get-profile").then(r => r.json())
      ]);

      if (!appsResult.error && appsResult.data) {
        setApplications(appsResult.data);
      }

      console.log("[dashboard] Profile API result:", profileRes);
      if (profileRes.profile) {
        setUserProfile(profileRes.profile);
        console.log("[dashboard] Profile loaded:", {
          name: profileRes.profile.name,
          hasCv: !!profileRes.profile.cv_text,
          target_roles: profileRes.profile.target_roles,
          target_locations: profileRes.profile.target_locations
        });
      } else {
        console.warn("[dashboard] No profile found for user:", authUser.id);
      }
    }
    setLoadingApps(false);
  };

  // ── Single JD Generator ──
  const handleGenerate = async () => {
    if (!jobDescription.trim() || !user) return;
    setIsGenerating(true);
    setResults(null);
    setAtsScore(null);
    setError("");
    setProgressStep(1);

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
      intervals.forEach(clearTimeout);
      setProgressStep(5);
      setResults(data);

      const { data: insertedData, error: dbError } = await supabase.from("applications").insert({
        user_id: user.id,
        company: data.jd_analysis.company,
        role: data.jd_analysis.title,
        location: data.jd_analysis.location,
        match_score: data.match_assessment.score,
        status: "Applied",
        tailored_cv: data.tailored_cv,
        cover_letter: data.cover_letter,
        jd_text: jobDescription
      }).select().single();

      if (!dbError && insertedData) {
        setApplications(prev => [insertedData, ...prev]);
      }

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

  // ── Job Search ──
  const handleSearchJobs = async () => {
    setIsSearching(true);
    setSearchError("");
    setFoundJobs([]);
    setAutoResults(null);

    try {
      const res = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search failed");
      }

      const data = await res.json();
      setFoundJobs(data.jobs || []);
      setSearchCriteria(data.search_criteria);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Auto-Generate All ──
  const handleAutoGenerate = async () => {
    setIsAutoApplying(true);
    setAutoProgress("Starting auto-generation pipeline...");
    setAutoResults(null);

    try {
      const res = await fetch("/api/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Auto-apply failed");
      }

      const data = await res.json();
      setAutoResults(data);
      setAutoProgress("");

      // Refresh applications list
      await fetchData();
    } catch (err: any) {
      setSearchError(err.message);
      setAutoProgress("");
    } finally {
      setIsAutoApplying(false);
    }
  };

  // ── Full Automation Pipeline ──
  const handleFullAutomation = async () => {
    setIsAutomating(true);
    setSearchError("");
    setAutomationStep("Searching for matching jobs...");

    try {
      // Step 1: Search
      const searchRes = await fetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error || "Search failed");
      }

      const searchData = await searchRes.json();
      setFoundJobs(searchData.jobs || []);
      setSearchCriteria(searchData.search_criteria);

      if (searchData.jobs.length === 0) {
        setAutomationStep("No matching jobs found. Adjust your preferences.");
        setIsAutomating(false);
        return;
      }

      setAutomationStep(`Found ${searchData.jobs.length} jobs. Generating applications...`);

      // Step 2: Auto-apply
      const applyRes = await fetch("/api/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!applyRes.ok) {
        const err = await applyRes.json();
        throw new Error(err.error || "Auto-apply failed");
      }

      const applyData = await applyRes.json();
      setAutoResults(applyData);
      setAutomationStep(
        `Done! Generated ${applyData.total_generated} applications from ${applyData.total_found} jobs (${applyData.total_qualified} qualified).`
      );

      await fetchData();
    } catch (err: any) {
      setAutomationStep("");
      setSearchError(err.message);
    } finally {
      setIsAutomating(false);
    }
  };

  // ── Approve Application ──
  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ status: "Applied" })
      .eq("id", id);

    if (!error) {
      setApplications(prev => prev.map(app => app.id === id ? { ...app, status: "Applied" } : app));
    }
  };

  // ── Approve All (70%+) ──
  const handleApproveAll = async () => {
    const readyApps = applications.filter(a => a.status === "ready" && a.match_score >= 70);
    for (const app of readyApps) {
      await supabase.from("applications").update({ status: "Applied" }).eq("id", app.id);
    }
    setApplications(prev =>
      prev.map(app =>
        app.status === "ready" && app.match_score >= 70
          ? { ...app, status: "Applied" }
          : app
      )
    );
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
  const readyCount = applications.filter(a => a.status === "ready").length;
  const approveAllCount = applications.filter(a => a.status === "ready" && a.match_score >= 70).length;

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

  const isAnyProcessRunning = isSearching || isAutoApplying || isAutomating || isGenerating;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-12">

      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
        {[
          { label: "Total Applied", value: totalApplied, icon: Briefcase },
          { label: "Ready to Send", value: readyCount, icon: FileText },
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* AUTOMATED JOB SEARCH & APPLY SECTION                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
          <Zap className="text-[var(--color-primary)] w-6 h-6" />
          Automated Job Search & Apply
        </h2>

        {/* Preferences indicator */}
        {userProfile?.target_roles?.length ? (
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-[#81C784]" />
              <span className="text-gray-300">
                Searching: <span className="text-white font-semibold">{userProfile.target_roles.join(", ")}</span>
                {" in "}
                <span className="text-white font-semibold">{userProfile.target_locations?.join(", ") || "Any location"}</span>
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#81C784]" />
            </div>
            <a href="/dashboard/preferences" className="text-xs text-[var(--color-primary)] hover:underline">Edit Preferences</a>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
            <span className="text-sm text-red-400">Set your target roles and locations in Preferences to use automated search.</span>
            <a href="/dashboard/preferences" className="text-xs text-[var(--color-primary)] hover:underline font-semibold">Set Preferences</a>
          </div>
        )}

        {searchError && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {searchError}
          </div>
        )}

        {/* Progress indicator */}
        {(isSearching || isAutoApplying || isAutomating) && (
          <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 px-4 py-3 rounded-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
            <span className="text-[var(--color-primary)] font-medium text-sm">
              {isSearching && "Searching for matching jobs..."}
              {isAutoApplying && (autoProgress || "Generating applications for matching jobs...")}
              {isAutomating && (automationStep || "Running full automation pipeline...")}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSearchJobs}
            disabled={isAnyProcessRunning || !userProfile?.target_roles?.length}
            className="px-6 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-white/20 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Find Jobs
          </button>

          <button
            onClick={handleAutoGenerate}
            disabled={isAnyProcessRunning || !userProfile?.cv_text}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-500 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoApplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            Auto-Generate All
          </button>

          <button
            onClick={handleFullAutomation}
            disabled={isAnyProcessRunning || !userProfile?.cv_text || !userProfile?.target_roles?.length}
            className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutomating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            Start Automation
          </button>
        </div>

        {/* Auto-apply results summary */}
        {autoResults && (
          <div className="bg-[#81C784]/10 border border-[#81C784]/30 p-4 rounded-xl space-y-2">
            <h4 className="text-white font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#81C784]" />
              Automation Complete
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{autoResults.total_found}</div>
                <div className="text-xs text-gray-400">Jobs Found</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-primary)]">{autoResults.total_qualified}</div>
                <div className="text-xs text-gray-400">Qualified (65%+)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#81C784]">{autoResults.total_generated}</div>
                <div className="text-xs text-gray-400">Applications Ready</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOUND JOBS LIST                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {foundJobs.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
              <Search className="text-[var(--color-primary)] w-5 h-5" />
              Found Jobs ({foundJobs.length})
              {searchCriteria && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {searchCriteria.roles?.join(", ")} in {searchCriteria.locations?.join(", ")}
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {foundJobs.map((job) => (
              <div key={job.id} className="hover:bg-white/5 transition">
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white truncate">{job.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        job.source === 'adzuna' ? 'bg-blue-500/20 text-blue-400' : 'bg-sky-500/20 text-sky-400'
                      }`}>
                        {job.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {job.location}
                      </span>
                      {job.salary !== 'Not specified' && (
                        <span className="text-[#81C784]">{job.salary}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.source_url && (
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                        title="View original"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400"
                    >
                      {expandedJob === job.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedJob === job.id && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-400 leading-relaxed">{job.description.slice(0, 500)}{job.description.length > 500 ? '...' : ''}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* AI APPLICATION GENERATOR (Manual)                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* APPLICATION TRACKER                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
            <Navigation className="text-[var(--color-primary)] w-5 h-5" />
            Application Tracker
            {readyCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-full text-xs font-bold">
                {readyCount} ready
              </span>
            )}
          </h2>
          {approveAllCount > 0 && (
            <button
              onClick={handleApproveAll}
              className="px-4 py-2 bg-[#81C784] text-black font-bold rounded-lg text-sm flex items-center gap-1 hover:bg-[#66BB6A] transition"
            >
              <Check className="w-4 h-4" />
              Approve All 70%+ ({approveAllCount})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300 min-w-[700px]">
            <thead className="bg-white/5 text-gray-400 font-heading">
              <tr>
                <th className="px-6 py-4">Company & Role</th>
                <th className="px-6 py-4">Match Score</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {applications.length === 0 && !loadingApps ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No applications generated yet. Paste a JD above or use automated search to get started!
                  </td>
                </tr>
              ) : applications.map((app) => (
                <tr key={app.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{app.company}</div>
                    <div className="text-xs text-gray-500">{app.role}</div>
                    {app.location && <div className="text-xs text-gray-600 mt-0.5">{app.location}</div>}
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
                      className={`bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)] ${
                        app.status === 'ready' ? 'text-[var(--color-primary)] border-[var(--color-primary)]/30' : 'text-gray-300'
                      }`}
                    >
                      <option value="ready">Ready</option>
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
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {app.tailored_cv && (
                        <button
                          onClick={() => setViewingApp(viewingApp?.id === app.id ? null : app)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                          title="View Application"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {app.status === 'ready' && (
                        <button
                          onClick={() => handleApprove(app.id)}
                          className="px-2 py-1 bg-[#81C784]/20 text-[#81C784] rounded text-xs font-bold hover:bg-[#81C784]/30 transition"
                        >
                          Approve
                        </button>
                      )}
                      {app.source_url && (
                        <a
                          href={app.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                          title="View Job Posting"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VIEW APPLICATION MODAL                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewingApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto"
            onClick={() => setViewingApp(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-3xl max-w-5xl w-full mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingApp.role}</h3>
                  <p className="text-gray-400 text-sm">{viewingApp.company} - {viewingApp.location}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    viewingApp.match_score >= 70 ? 'bg-[#81C784]/20 text-[#81C784]' :
                    viewingApp.match_score >= 50 ? 'bg-yellow-400/20 text-yellow-400' :
                    'bg-red-400/20 text-red-400'
                  }`}>
                    {viewingApp.match_score}%
                  </span>
                  <button
                    onClick={() => setViewingApp(null)}
                    className="text-gray-400 hover:text-white text-2xl leading-none"
                  >&times;</button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                {/* CV */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white">Tailored CV</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => downloadAsPdf(viewingApp.tailored_cv, `CV_${viewingApp.company}`)}
                        className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 hover:bg-white/20"
                      >PDF</button>
                      <button
                        onClick={() => downloadAsDocx(viewingApp.tailored_cv, `CV_${viewingApp.company}`)}
                        className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 hover:bg-white/20"
                      >DOCX</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 max-h-[500px] overflow-y-auto text-black text-xs font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace]">
                    <FormattedCV text={viewingApp.tailored_cv} />
                  </div>
                </div>
                {/* Cover Letter */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white">Cover Letter</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => downloadAsPdf(viewingApp.cover_letter, `CL_${viewingApp.company}`)}
                        className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 hover:bg-white/20"
                      >PDF</button>
                      <button
                        onClick={() => downloadAsDocx(viewingApp.cover_letter, `CL_${viewingApp.company}`)}
                        className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 hover:bg-white/20"
                      >DOCX</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 max-h-[500px] overflow-y-auto text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {viewingApp.cover_letter}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
const YEAR_RANGE_RE_DASH = /(\b\d{4}\s*-\s*\d{4})\s*$/;
const SINGLE_DATE_RE_DASH = /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s*$/i;

function FormattedCV({ text }: { text: string }) {
  const lines = text.split('\n');
  let currentSection = '';
  let competencyBullets: string[] = [];
  const elements: React.ReactNode[] = [];
  let headerIdx = 0;

  const flushCompetencies = () => {
    if (competencyBullets.length > 0) {
      const third = Math.ceil(competencyBullets.length / 3);
      const col1 = competencyBullets.slice(0, third);
      const col2 = competencyBullets.slice(third, third * 2);
      const col3 = competencyBullets.slice(third * 2);
      elements.push(
        <div key={`comp-${elements.length}`} className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-1.5 mb-1">
          {col1.map((c, j) => (
            <div key={`c1-${j}`} className="text-gray-800 text-[10px] leading-relaxed">{'\u2022'} {c}</div>
          ))}
          {col2.map((c, j) => (
            <div key={`c2-${j}`} className="text-gray-800 text-[10px] leading-relaxed">{'\u2022'} {c}</div>
          ))}
          {col3.map((c, j) => (
            <div key={`c3-${j}`} className="text-gray-800 text-[10px] leading-relaxed">{'\u2022'} {c}</div>
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
          <div key={key} className={`text-center text-[10px] leading-relaxed ${isContact ? 'text-gray-500 mb-2 pb-2 border-b border-gray-800' : 'text-gray-600 italic mb-0'}`}>
            {trimmed}
          </div>
        );
        headerIdx++;
        continue;
      }
      headerIdx++;
    }

    // CORE COMPETENCIES: collect bullets
    if (currentSection === 'CORE COMPETENCIES') {
      if (trimmed.includes('\u2022')) {
        const parts = trimmed.split('\u2022').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        for (const part of parts) competencyBullets.push(part);
        continue;
      }
      if (!CV_HEADERS.some(h => trimmed === h) && trimmed.length > 2) {
        const commaParts = trimmed.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        if (commaParts.length > 1) {
          for (const cp of commaParts) competencyBullets.push(cp);
          continue;
        }
      }
    }

    // Date line
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

    // Year range or single dates
    if (!trimmed.startsWith('\u2022')) {
      const yrMatch = trimmed.match(YEAR_RANGE_RE_DASH);
      const sdMatch = !yrMatch ? trimmed.match(SINGLE_DATE_RE_DASH) : null;
      const anyDateEnd = yrMatch || sdMatch;
      if (anyDateEnd) {
        const matched = yrMatch ? yrMatch[1] : sdMatch![1];
        const leftPart = trimmed.slice(0, trimmed.indexOf(matched)).trim();
        if (leftPart.length > 3) {
          flushCompetencies();
          elements.push(
            <div key={key} className="flex justify-between items-baseline gap-4 mt-2 mb-0.5">
              <span className="font-bold text-[11px] text-gray-900">{leftPart}</span>
              <span className="text-gray-500 whitespace-nowrap text-[10px] shrink-0">{matched}</span>
            </div>
          );
          continue;
        }
      }
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
