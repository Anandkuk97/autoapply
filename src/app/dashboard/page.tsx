"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Copy, CheckCircle2, CircleDashed, Briefcase, FileText, Check, Loader2,
  Sparkles, Navigation, AlertCircle, Download, Search, Zap, PlayCircle,
  MapPin, Building2, ExternalLink, ChevronDown, ChevronUp, Eye,
  StopCircle, DollarSign, SkipForward, XCircle, Info, ArrowRight,
  Square, CheckSquare, TrendingUp, Mail, MoreVertical
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

interface ScoredJob extends JobListing {
  cvMatchScore: number;      // Current CV keyword match (0-100)
  projectedScore: number;    // Estimated after tailoring
}

type JobGenStatus = 'idle' | 'analyzing' | 'scoring' | 'tailoring' | 'writing' | 'done' | 'error';

interface JobGenProgress {
  status: JobGenStatus;
  error?: string;
  result?: any;          // The generation result (tailored_cv, cover_letter, etc.)
  originalScore: number; // The keyword score before tailoring
  actualScore?: number;  // The real match score after Claude analysis
}

const MAX_DISPLAY_JOBS = 15;

// ── Client-side keyword matching (no API call) ──
function extractKeywords(text: string): Set<string> {
  if (!text) return new Set();
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','as','is','was','are','were','been','be','have','has','had','do',
    'does','did','will','would','could','should','may','might','shall','can',
    'this','that','these','those','it','its','i','we','you','they','he','she',
    'my','our','your','their','his','her','not','no','all','each','every',
    'any','some','such','than','too','very','just','about','above','after',
    'also','into','over','under','between','through','during','before',
    'more','most','other','which','who','whom','what','when','where','how',
    'if','then','so','up','out','about','work','working','experience',
    'role','position','job','company','team','ability','strong','good',
    'well','new','year','years','including','etc','e.g','eg','ie',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.\-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

function calculateKeywordMatch(cvText: string, jdText: string): number {
  const cvKeywords = extractKeywords(cvText);
  const jdKeywords = extractKeywords(jdText);

  if (jdKeywords.size === 0) return 0;

  let matches = 0;
  for (const kw of jdKeywords) {
    if (cvKeywords.has(kw)) matches++;
  }

  // Raw overlap percentage
  const rawScore = Math.round((matches / jdKeywords.size) * 100);
  // Clamp to 0-100
  return Math.min(100, Math.max(0, rawScore));
}

function scoreColor(score: number): string {
  if (score >= 65) return 'text-[#81C784]';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 65) return 'bg-[#81C784]/20 text-[#81C784]';
  if (score >= 40) return 'bg-yellow-400/20 text-yellow-400';
  return 'bg-red-400/20 text-red-400';
}

function timeAgo(dateStr: string): string {
  const posted = new Date(dateStr).getTime();
  if (isNaN(posted)) return '';
  const days = Math.floor((Date.now() - posted) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 14) return 'Posted 1 week ago';
  if (days < 30) return `Posted ${Math.floor(days / 7)} weeks ago`;
  return `Posted ${Math.floor(days / 30)} month(s) ago`;
}

function scoreBorder(score: number): string {
  if (score >= 65) return 'border-[#81C784]/40';
  if (score >= 40) return 'border-yellow-400/40';
  return 'border-red-400/40';
}

export default function DashboardPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Generator States (manual JD)
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
  const [scoredJobs, setScoredJobs] = useState<ScoredJob[]>([]);
  const [totalJobsFound, setTotalJobsFound] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchCriteria, setSearchCriteria] = useState<any>(null);

  // Per-job generation tracking
  const [jobProgress, setJobProgress] = useState<Record<string, JobGenProgress>>({});
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const bulkAbortRef = useRef(false);

  // Job cards expanded state
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [viewingApp, setViewingApp] = useState<any>(null);

  // Approval confirmation
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvedApp, setApprovedApp] = useState<any>(null);

  // Action menu state
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Email apply modal
  const [emailApplyApp, setEmailApplyApp] = useState<any>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentFor, setEmailSentFor] = useState<string | null>(null);

  // Bulk operations
  const [bulkEmailProgress, setBulkEmailProgress] = useState("");
  const [bulkOpenProgress, setBulkOpenProgress] = useState("");

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

      if (profileRes.profile) {
        setUserProfile(profileRes.profile);
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
        status: "ready",
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

  // ── Job Search with client-side scoring ──
  const handleSearchJobs = async () => {
    setIsSearching(true);
    setSearchError("");
    setScoredJobs([]);
    setTotalJobsFound(0);
    setJobProgress({});
    setSelectedJobs(new Set());

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
      const allJobs: JobListing[] = data.jobs || [];
      setSearchCriteria(data.search_criteria);
      setTotalJobsFound(allJobs.length);

      const cvText = userProfile?.cv_text || "";

      // Score each job by keyword overlap, sort descending, take top 15
      const scored: ScoredJob[] = allJobs.map(job => {
        const jdText = [job.title, job.description, job.company].join(' ');
        const cvMatchScore = calculateKeywordMatch(cvText, jdText);
        let projectedScore: number;
        if (cvMatchScore < 30) {
          projectedScore = cvMatchScore + 35;
        } else if (cvMatchScore < 50) {
          projectedScore = cvMatchScore + 30 + Math.round(cvMatchScore * 0.3);
        } else if (cvMatchScore < 70) {
          projectedScore = cvMatchScore + 20 + Math.round(cvMatchScore * 0.2);
        } else {
          projectedScore = cvMatchScore + 15;
        }
        projectedScore = Math.min(95, projectedScore);
        return { ...job, cvMatchScore, projectedScore };
      });

      scored.sort((a, b) => b.cvMatchScore - a.cvMatchScore);
      const top = scored.slice(0, MAX_DISPLAY_JOBS);
      setScoredJobs(top);

    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Generate for a single job ──
  const generateForJob = async (job: ScoredJob, mode: 'manual' | 'auto') => {
    if (!user) return;

    setJobProgress(prev => ({
      ...prev,
      [job.id]: { status: 'analyzing', originalScore: job.cvMatchScore }
    }));

    // Build synthetic JD
    const syntheticJD = [
      `Job Title: ${job.title}`,
      `Company: ${job.company}`,
      `Location: ${job.location}`,
      job.salary !== 'Not specified' ? `Salary: ${job.salary}` : '',
      '',
      'Job Description:',
      job.description,
    ].filter(Boolean).join('\n');

    try {
      // Step-by-step progress simulation + real API call
      setJobProgress(prev => ({
        ...prev,
        [job.id]: { ...prev[job.id], status: 'analyzing' }
      }));

      const stepTimers = [
        setTimeout(() => setJobProgress(prev => ({
          ...prev,
          [job.id]: { ...prev[job.id], status: 'scoring' }
        })), 3000),
        setTimeout(() => setJobProgress(prev => ({
          ...prev,
          [job.id]: { ...prev[job.id], status: 'tailoring' }
        })), 6000),
        setTimeout(() => setJobProgress(prev => ({
          ...prev,
          [job.id]: { ...prev[job.id], status: 'writing' }
        })), 9000),
      ];

      const res = await fetch("/api/generate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: syntheticJD, user_id: user.id })
      });

      stepTimers.forEach(clearTimeout);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody.slice(0, 200) || "Generation failed");
      }

      const data = await res.json();
      const actualScore = data.match_assessment?.score || 0;

      // Save to DB
      const { data: inserted, error: dbError } = await supabase.from("applications").insert({
        user_id: user.id,
        company: data.jd_analysis?.company || job.company,
        role: data.jd_analysis?.title || job.title,
        location: data.jd_analysis?.location || job.location,
        salary: job.salary,
        match_score: actualScore,
        status: "ready",
        tailored_cv: data.tailored_cv,
        cover_letter: data.cover_letter,
        jd_text: syntheticJD,
        source_url: job.source_url,
      }).select().single();

      if (!dbError && inserted) {
        setApplications(prev => [inserted, ...prev]);
      }

      setJobProgress(prev => ({
        ...prev,
        [job.id]: {
          status: 'done',
          originalScore: job.cvMatchScore,
          actualScore,
          result: {
            ...data,
            application: inserted,
            mode,
          }
        }
      }));

      // Auto-expand the completed job
      setExpandedJob(job.id);

    } catch (err: any) {
      setJobProgress(prev => ({
        ...prev,
        [job.id]: {
          status: 'error',
          originalScore: job.cvMatchScore,
          error: err.message
        }
      }));
    }
  };

  // ── Bulk: Tailor All Top Jobs ──
  const handleTailorAll = async (mode: 'manual' | 'auto') => {
    const jobsToProcess = scoredJobs.filter(j => {
      const prog = jobProgress[j.id];
      return !prog || prog.status === 'idle' || prog.status === 'error';
    });
    if (jobsToProcess.length === 0) return;

    setIsBulkProcessing(true);
    bulkAbortRef.current = false;

    for (const job of jobsToProcess) {
      if (bulkAbortRef.current) break;
      await generateForJob(job, mode);
      // 3s delay between API calls to avoid rate limiting
      if (!bulkAbortRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setIsBulkProcessing(false);
  };

  // ── Bulk: Tailor Selected ──
  const handleTailorSelected = async (mode: 'manual' | 'auto') => {
    const jobsToProcess = scoredJobs.filter(j => {
      const prog = jobProgress[j.id];
      return selectedJobs.has(j.id) && (!prog || prog.status === 'idle' || prog.status === 'error');
    });
    if (jobsToProcess.length === 0) return;

    setIsBulkProcessing(true);
    bulkAbortRef.current = false;

    for (const job of jobsToProcess) {
      if (bulkAbortRef.current) break;
      await generateForJob(job, mode);
      if (!bulkAbortRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setIsBulkProcessing(false);
    setSelectedJobs(new Set());
  };

  const handleStopBulk = () => {
    bulkAbortRef.current = true;
  };

  // ── Selection helpers ──
  const toggleJobSelection = (jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobs.size === scoredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(scoredJobs.map(j => j.id)));
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
      const app = applications.find(a => a.id === id);
      if (app) {
        setApprovedApp({ ...app, status: "Applied" });
      }
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
    setApprovalMessage(`${readyApps.length} applications marked as reviewed. Download your tailored documents and submit them manually to each employer.`);
    setTimeout(() => setApprovalMessage(""), 8000);
  };

  // ── Email Apply (single) ──
  const handleEmailApply = async (appId: string, recipientEmail: string) => {
    setSendingEmail(true);
    try {
      const res = await fetch("/api/apply-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: appId, recipient_email: recipientEmail }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send email");
      }
      const data = await res.json();
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: "Applied" } : a));
      setEmailSentFor(appId);
      setApprovalMessage(`Email sent to ${recipientEmail} with your tailored CV for ${emailApplyApp?.role || 'this role'}.`);
      setTimeout(() => setApprovalMessage(""), 8000);
      setEmailApplyApp(null);
      setEmailRecipient("");
    } catch (err: any) {
      setApprovalMessage(`Failed to send email: ${err.message}`);
      setTimeout(() => setApprovalMessage(""), 8000);
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Mark as Applied (manual) ──
  const handleMarkApplied = async (id: string) => {
    const { error } = await supabase
      .from("applications")
      .update({ status: "Applied", applied_date: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "Applied" } : a));
      setApprovalMessage("Marked as applied.");
      setTimeout(() => setApprovalMessage(""), 5000);
    }
    setActionMenuOpen(null);
  };

  // ── Bulk: Open All Job Links ──
  const handleOpenAllLinks = () => {
    const readyApps = applications.filter(a => (a.status === "ready" || a.status === "Applied") && a.source_url);
    const toOpen = readyApps.slice(0, 10);
    setBulkOpenProgress(`Opening ${toOpen.length} job links...`);
    toOpen.forEach((app, i) => {
      setTimeout(() => {
        window.open(app.source_url, '_blank');
        setBulkOpenProgress(`Opened ${i + 1} of ${toOpen.length} links`);
        if (i === toOpen.length - 1) {
          setTimeout(() => setBulkOpenProgress(""), 3000);
        }
      }, i * 500);
    });
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

  // Stats
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

  const isAnyProcessRunning = isSearching || isGenerating || isBulkProcessing;

  // ── Status label mappings ──
  const statusLabels: Record<string, string> = {
    "ready": "Ready to Review",
    "Applied": "Applied \u2713",
    "Callback": "Callback Received",
    "Interview": "Interview Scheduled",
    "Rejected": "Not Selected",
    "No Response": "Awaiting Response",
  };
  const statusColors: Record<string, string> = {
    "ready": "text-blue-400 border-blue-400/30",
    "Applied": "text-[#81C784] border-[#81C784]/30",
    "Callback": "text-emerald-400 border-emerald-400/30",
    "Interview": "text-yellow-400 border-yellow-400/30",
    "Rejected": "text-gray-500 border-gray-500/30",
    "No Response": "text-gray-500 border-gray-500/30",
  };

  // Count processing jobs
  const processingCount = Object.values(jobProgress).filter(
    p => p.status !== 'idle' && p.status !== 'done' && p.status !== 'error'
  ).length;
  const completedCount = Object.values(jobProgress).filter(p => p.status === 'done').length;

  // Status label for generation step
  const genStepLabel: Record<JobGenStatus, string> = {
    idle: '',
    analyzing: 'Analyzing job description...',
    scoring: 'Scoring your match...',
    tailoring: 'Tailoring your CV...',
    writing: 'Writing cover letter...',
    done: 'Complete!',
    error: 'Failed',
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-12">

      {/* STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
        {[
          { label: "Total Applied", value: totalApplied, icon: Briefcase },
          { label: "Ready to Review", value: readyCount, icon: FileText },
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

      {/* APPROVAL CONFIRMATION TOAST */}
      <AnimatePresence>
        {approvalMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-[#81C784]/15 border border-[#81C784]/40 px-5 py-4 rounded-xl flex items-start gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-[#81C784] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[#81C784] font-medium text-sm">{approvalMessage}</p>
              <p className="text-gray-500 text-xs mt-1">Download your documents and submit them on the employer&apos;s website.</p>
            </div>
            <button onClick={() => setApprovalMessage("")} className="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORKFLOW GUIDE (for new/incomplete users) */}
      {(!loadingApps && applications.length < 3) && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
          <h3 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
            How AutoApply Works
          </h3>
          <div className="space-y-3">
            {[
              { num: 1, text: "Upload your CV", done: !!userProfile?.cv_text, action: !userProfile?.cv_text ? "/dashboard/profile" : null, actionLabel: "Upload CV" },
              { num: 2, text: "Set your job preferences (roles, locations)", done: !!(userProfile?.target_roles?.length && userProfile?.target_locations?.length), action: !(userProfile?.target_roles?.length && userProfile?.target_locations?.length) ? "/dashboard/preferences" : null, actionLabel: "Set Preferences" },
              { num: 3, text: "Click 'Find Jobs' — we show the top 15 most relevant matches with scores", done: scoredJobs.length > 0, action: null, actionLabel: null },
              { num: 4, text: "Review each job's match score and choose which to tailor for", done: scoredJobs.length > 0, action: null, actionLabel: null },
              { num: 5, text: "Click 'Tailor & Download' to generate a custom CV and cover letter", done: completedCount > 0, action: null, actionLabel: null },
              { num: 6, text: "Download your tailored documents and submit applications manually", done: applications.some(a => a.status === "Applied"), action: null, actionLabel: null },
            ].map((item) => (
              <div key={item.num} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.done ? "bg-[#81C784] text-black" : "bg-white/10 text-gray-500"
                }`}>
                  {item.done ? <Check className="w-3.5 h-3.5" /> : item.num}
                </div>
                <span className={`text-sm flex-1 ${item.done ? "text-gray-400 line-through" : "text-gray-300"}`}>
                  {item.text}
                </span>
                {item.action && (
                  <a href={item.action} className="px-3 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-lg text-xs font-bold hover:bg-[var(--color-primary)]/30 transition">
                    {item.actionLabel} &rarr;
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* STEP 1: JOB SEARCH                                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
          <Search className="text-[var(--color-primary)] w-6 h-6" />
          Find &amp; Tailor Jobs
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

        {/* Search button */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSearchJobs}
            disabled={isAnyProcessRunning || !userProfile?.target_roles?.length}
            className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Find Jobs
          </button>
        </div>

        {/* Search progress */}
        {isSearching && (
          <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 px-4 py-3 rounded-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
            <span className="text-[var(--color-primary)] font-medium text-sm">Searching job boards and scoring matches against your CV...</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* STEP 2 & 3: SCORED JOB CARDS                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {scoredJobs.length > 0 && (
        <div className="space-y-4">
          {/* Header with count message and bulk actions */}
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                    <Briefcase className="text-[var(--color-primary)] w-5 h-5" />
                    Top Matches
                    {searchCriteria && (
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        {searchCriteria.roles?.join(", ")} in {searchCriteria.locations?.join(", ")}
                      </span>
                    )}
                  </h2>
                  {totalJobsFound > MAX_DISPLAY_JOBS && (
                    <p className="text-sm text-gray-400 mt-1">
                      Showing top {MAX_DISPLAY_JOBS} most aligned roles out of {totalJobsFound} found.
                    </p>
                  )}
                  {totalJobsFound > 0 && totalJobsFound <= MAX_DISPLAY_JOBS && (
                    <p className="text-sm text-gray-400 mt-1">
                      Found {totalJobsFound} matching jobs, sorted by CV relevance.
                    </p>
                  )}
                </div>

                {/* Bulk progress indicator */}
                {isBulkProcessing && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-primary)]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing {completedCount}/{scoredJobs.length}...
                    </div>
                    <button
                      onClick={handleStopBulk}
                      className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-500/30 transition"
                    >
                      <StopCircle className="w-3.5 h-3.5" /> Stop
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk action bar */}
              <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
                >
                  {selectedJobs.size === scoredJobs.length ?
                    <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" /> :
                    <Square className="w-4 h-4" />
                  }
                  {selectedJobs.size === scoredJobs.length ? 'Deselect All' : 'Select All'}
                </button>

                {selectedJobs.size > 0 && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="text-xs text-gray-400">{selectedJobs.size} selected</span>
                    <button
                      onClick={() => handleTailorSelected('manual')}
                      disabled={isBulkProcessing || isGenerating}
                      className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm flex items-center gap-1 hover:bg-blue-500 transition disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" /> Tailor Selected
                    </button>
                    <button
                      onClick={() => handleTailorSelected('auto')}
                      disabled={isBulkProcessing || isGenerating}
                      className="px-4 py-2 bg-[var(--color-primary)] text-black font-bold rounded-lg text-sm flex items-center gap-1 hover:bg-yellow-400 transition disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" /> Tailor &amp; Apply Selected
                    </button>
                  </>
                )}

                <div className="flex-1" />

                <button
                  onClick={() => handleTailorAll('manual')}
                  disabled={isBulkProcessing || isGenerating || !userProfile?.cv_text}
                  className="px-4 py-2 bg-white/10 border border-white/20 text-white font-bold rounded-lg text-sm flex items-center gap-1 hover:bg-white/20 transition disabled:opacity-50"
                >
                  {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Tailor All Top Jobs
                </button>
              </div>
            </div>

            {/* Job cards */}
            <div className="divide-y divide-white/5">
              {scoredJobs.map((job, idx) => {
                const prog = jobProgress[job.id];
                const isProcessing = prog && !['idle', 'done', 'error'].includes(prog.status);
                const isDone = prog?.status === 'done';
                const isError = prog?.status === 'error';
                const isExpanded = expandedJob === job.id;
                const isSelected = selectedJobs.has(job.id);

                return (
                  <div key={job.id} className={`transition ${isDone ? 'bg-[#81C784]/5' : isError ? 'bg-red-500/5' : 'hover:bg-white/5'}`}>
                    {/* Main row */}
                    <div className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleJobSelection(job.id)}
                          className="mt-1 shrink-0 text-gray-400 hover:text-white transition"
                        >
                          {isSelected ?
                            <CheckSquare className="w-5 h-5 text-[var(--color-primary)]" /> :
                            <Square className="w-5 h-5" />
                          }
                        </button>

                        {/* Rank number */}
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 mt-0.5">
                          {idx + 1}
                        </div>

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white">{job.title}</h3>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              job.source === 'adzuna' ? 'bg-blue-500/20 text-blue-400' : 'bg-sky-500/20 text-sky-400'
                            }`}>
                              {job.source}
                            </span>
                            {isDone && (
                              <span className="px-2 py-0.5 rounded bg-[#81C784]/20 text-[#81C784] text-[10px] font-bold">
                                TAILORED
                              </span>
                            )}
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
                            {job.posted_date && timeAgo(job.posted_date) && (
                              <span className="text-gray-500 text-xs">{timeAgo(job.posted_date)}</span>
                            )}
                          </div>

                          {/* STEP 2: Dual scores */}
                          <div className="flex items-center gap-6 mt-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Current CV Match:</span>
                              <span className={`text-sm font-bold ${scoreColor(job.cvMatchScore)}`}>
                                {job.cvMatchScore}%
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-xs text-gray-500">Projected After Tailoring:</span>
                                <span className={`text-sm font-bold ${scoreColor(job.projectedScore)}`}>
                                  ~{job.projectedScore}%
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-600 ml-5.5">Estimated based on keyword tailoring</span>
                            </div>
                            {isDone && prog.actualScore !== undefined && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#81C784]" />
                                <span className="text-xs text-gray-500">Actual:</span>
                                <span className={`text-sm font-bold ${scoreColor(prog.actualScore)}`}>
                                  {prog.actualScore}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Score bar */}
                          <div className="mt-2 w-full max-w-xs">
                            <div className="w-full bg-white/10 rounded-full h-1.5 relative">
                              {/* Current score bar */}
                              <div
                                className={`h-1.5 rounded-full absolute left-0 top-0 ${
                                  job.cvMatchScore >= 65 ? 'bg-[#81C784]/40' :
                                  job.cvMatchScore >= 40 ? 'bg-yellow-400/40' :
                                  'bg-red-400/40'
                                }`}
                                style={{ width: `${job.cvMatchScore}%` }}
                              />
                              {/* Projected overlay */}
                              <div
                                className={`h-1.5 rounded-full absolute left-0 top-0 opacity-30 ${
                                  job.projectedScore >= 65 ? 'bg-[#81C784]' :
                                  job.projectedScore >= 40 ? 'bg-yellow-400' :
                                  'bg-red-400'
                                }`}
                                style={{ width: `${isDone && prog.actualScore ? prog.actualScore : job.projectedScore}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* STEP 3: Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isDone && !isProcessing && (
                            <>
                              <button
                                onClick={() => generateForJob(job, 'manual')}
                                disabled={isAnyProcessRunning && !isBulkProcessing}
                                className="px-3 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Generate tailored CV + cover letter for manual submission"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Tailor &amp; Download
                              </button>
                              <button
                                onClick={() => generateForJob(job, 'auto')}
                                disabled={isAnyProcessRunning && !isBulkProcessing}
                                className="px-3 py-2 bg-[var(--color-primary)] text-black font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Generate + prepare for auto-apply (coming soon)"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Tailor &amp; Auto-Apply
                              </button>
                            </>
                          )}

                          {/* Processing indicator */}
                          {isProcessing && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg">
                              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                              <span className="text-xs text-[var(--color-primary)] font-medium">
                                {genStepLabel[prog!.status]}
                              </span>
                            </div>
                          )}

                          {/* Done indicator */}
                          {isDone && (
                            <button
                              onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                              className="px-3 py-2 bg-[#81C784]/20 text-[#81C784] font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-[#81C784]/30 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {prog.originalScore}% → {prog.actualScore}%
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Error indicator */}
                          {isError && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-400 max-w-[150px] truncate">{prog!.error}</span>
                              <button
                                onClick={() => generateForJob(job, 'manual')}
                                className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold hover:bg-red-500/30 transition"
                              >
                                Retry
                              </button>
                            </div>
                          )}

                          {/* External link */}
                          {job.source_url && (
                            <a
                              href={job.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                              title="View original posting"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* STEP 4: Expanded section — generation progress or results */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 space-y-4">
                            {/* Job description preview */}
                            <div className="bg-black/30 rounded-xl p-4">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Job Description</h4>
                              <p className="text-sm text-gray-400 leading-relaxed">
                                {job.description.slice(0, 600)}{job.description.length > 600 ? '...' : ''}
                              </p>
                            </div>

                            {/* Generation progress steps */}
                            {isProcessing && prog && (
                              <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-4">
                                <div className="grid grid-cols-4 gap-3">
                                  {(['analyzing', 'scoring', 'tailoring', 'writing'] as JobGenStatus[]).map((step, si) => {
                                    const stepLabels = ['Analyzing JD', 'Scoring Match', 'Tailoring CV', 'Writing Cover Letter'];
                                    const stepOrder: Record<string, number> = { analyzing: 0, scoring: 1, tailoring: 2, writing: 3, done: 4, error: -1, idle: -1 };
                                    const currentIdx = stepOrder[prog.status] ?? -1;
                                    const isActive = currentIdx === si;
                                    const isComplete = currentIdx > si;

                                    return (
                                      <div key={step} className="flex flex-col items-center gap-2 text-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                          isComplete ? "bg-[#81C784] text-black" :
                                          isActive ? "bg-[var(--color-primary)] text-black animate-pulse" :
                                          "bg-white/5 border border-white/10 text-gray-500"
                                        }`}>
                                          {isComplete ? <Check className="w-4 h-4" /> : <span className="font-bold text-sm">{si + 1}</span>}
                                        </div>
                                        <span className={`text-xs font-semibold ${
                                          isComplete ? "text-[#81C784]" : isActive ? "text-[var(--color-primary)]" : "text-gray-500"
                                        }`}>
                                          {stepLabels[si]}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Done: show results */}
                            {isDone && prog.result && (
                              <div className="space-y-4">
                                {/* Score improvement banner */}
                                <div className="bg-[#81C784]/10 border border-[#81C784]/30 px-4 py-3 rounded-xl flex items-center gap-3">
                                  <TrendingUp className="w-5 h-5 text-[#81C784]" />
                                  <span className="text-sm text-[#81C784] font-medium">
                                    Match improved from {prog.originalScore}% to {prog.actualScore}%
                                    {prog.result.mode === 'auto' && (
                                      <span className="ml-2 text-yellow-400">(Auto-apply coming soon — download and submit manually for now)</span>
                                    )}
                                  </span>
                                </div>

                                {/* Documents */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {/* Tailored CV */}
                                  <div className="bg-white rounded-xl overflow-hidden">
                                    <div className="bg-gray-100 p-3 flex justify-between items-center text-black">
                                      <h4 className="font-bold text-sm flex items-center gap-1">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        Tailored CV
                                      </h4>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => copyToClipboard(prog.result.tailored_cv, 'cv')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs" title="Copy">
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => downloadAsPdf(prog.result.tailored_cv, `CV_${job.company}_${job.title}`)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-0.5 text-xs font-semibold">
                                          <Download className="w-3.5 h-3.5" /> PDF
                                        </button>
                                        <button onClick={() => downloadAsDocx(prog.result.tailored_cv, `CV_${job.company}_${job.title}`)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-0.5 text-xs font-semibold">
                                          <Download className="w-3.5 h-3.5" /> DOCX
                                        </button>
                                      </div>
                                    </div>
                                    <div className="p-4 max-h-[400px] overflow-y-auto text-black text-xs font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace]">
                                      <FormattedCV text={prog.result.tailored_cv} />
                                    </div>
                                  </div>

                                  {/* Cover Letter */}
                                  <div className="bg-white rounded-xl overflow-hidden">
                                    <div className="bg-gray-100 p-3 flex justify-between items-center text-black">
                                      <h4 className="font-bold text-sm flex items-center gap-1">
                                        <Navigation className="w-4 h-4 text-amber-600" />
                                        Cover Letter
                                      </h4>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => copyToClipboard(prog.result.cover_letter, 'cl')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs" title="Copy">
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => downloadAsPdf(prog.result.cover_letter, `CL_${job.company}_${job.title}`)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-0.5 text-xs font-semibold">
                                          <Download className="w-3.5 h-3.5" /> PDF
                                        </button>
                                        <button onClick={() => downloadAsDocx(prog.result.cover_letter, `CL_${job.company}_${job.title}`)} className="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-0.5 text-xs font-semibold">
                                          <Download className="w-3.5 h-3.5" /> DOCX
                                        </button>
                                      </div>
                                    </div>
                                    <div className="p-4 max-h-[400px] overflow-y-auto text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
                                      {prog.result.cover_letter}
                                    </div>
                                  </div>
                                </div>

                                {/* Action row */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">
                                    Application saved to tracker with {prog.actualScore}% match score.
                                  </span>
                                  {job.source_url && (
                                    <a
                                      href={job.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-4 py-2 bg-[var(--color-primary)] text-black font-bold rounded-lg text-sm flex items-center gap-1.5 hover:bg-yellow-400 transition"
                                    >
                                      Apply Now <ArrowRight className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Error state */}
                            {isError && (
                              <div className="bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-red-400">
                                  <AlertCircle className="w-4 h-4" />
                                  {prog!.error}
                                </div>
                                <button
                                  onClick={() => generateForJob(job, 'manual')}
                                  className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition"
                                >
                                  Retry
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* AI APPLICATION GENERATOR (Manual JD Paste)                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl space-y-6">
        <h2 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
          <Sparkles className="text-[var(--color-primary)] w-6 h-6" />
          AI Application Generator
          <span className="text-sm font-normal text-gray-400 ml-2">Paste a single JD</span>
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

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

      {/* RESULTS DISPLAY (for manual JD) */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl overflow-hidden flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center text-black">
                <h3 className="font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Tailored CV
                </h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyToClipboard(results.tailored_cv, 'cv')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700" title="Copy">
                    {cvCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button onClick={() => downloadAsPdf(results.tailored_cv, 'Tailored_CV')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download PDF">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={() => downloadAsDocx(results.tailored_cv, 'Tailored_CV')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download DOCX">
                    <Download className="w-4 h-4" /> DOCX
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[600px] text-black text-sm font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace]">
                <FormattedCV text={results.tailored_cv} />
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden flex flex-col">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center text-black">
                <h3 className="font-bold flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-[var(--color-primary)]" />
                  Cover Letter
                </h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyToClipboard(results.cover_letter, 'cl')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700" title="Copy">
                    {clCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                  <button onClick={() => downloadAsPdf(results.cover_letter, 'Cover_Letter')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download PDF">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button onClick={() => downloadAsDocx(results.cover_letter, 'Cover_Letter')} className="p-2 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-1 text-xs font-semibold" title="Download DOCX">
                    <Download className="w-4 h-4" /> DOCX
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[600px] text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {results.cover_letter}
              </div>
            </div>
          </div>

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
        {/* Honest status banner */}
        <div className="mx-6 mt-6 mb-0 bg-blue-500/10 border border-blue-500/30 px-4 py-3 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300">
            <strong>How it works:</strong> AutoApply generates tailored CVs and cover letters for each job.
            You still need to <strong>submit applications manually</strong> — download your documents and apply on the employer&apos;s website or job board.
            Automated submission is planned for a future update.
          </div>
        </div>

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
          <div className="flex items-center gap-2 flex-wrap">
            {approveAllCount > 0 && (
              <button
                onClick={handleApproveAll}
                className="px-3 py-1.5 bg-[#81C784] text-black font-bold rounded-lg text-xs flex items-center gap-1 hover:bg-[#66BB6A] transition"
              >
                <Check className="w-3.5 h-3.5" />
                Approve All 70%+ ({approveAllCount})
              </button>
            )}
            {applications.filter(a => a.source_url && (a.status === 'ready' || a.status === 'Applied')).length > 0 && (
              <button
                onClick={handleOpenAllLinks}
                className="px-3 py-1.5 bg-white/10 border border-white/20 text-white font-bold rounded-lg text-xs flex items-center gap-1 hover:bg-white/20 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open All Job Links
              </button>
            )}
            {bulkOpenProgress && (
              <span className="text-xs text-[var(--color-primary)]">{bulkOpenProgress}</span>
            )}
          </div>
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
                    No applications generated yet. Use &quot;Find Jobs&quot; above or paste a JD to get started!
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
                      className={`bg-black/50 border rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--color-primary)] ${
                        statusColors[app.status] || 'text-gray-300 border-white/10'
                      }`}
                    >
                      <option value="ready">Ready to Review</option>
                      <option value="Applied">Applied ✓</option>
                      <option value="Callback">Callback Received</option>
                      <option value="Interview">Interview Scheduled</option>
                      <option value="Rejected">Not Selected</option>
                      <option value="No Response">Awaiting Response</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-sans">
                    {new Date(app.applied_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 relative">
                      {app.tailored_cv && (
                        <button
                          onClick={() => setViewingApp(viewingApp?.id === app.id ? null : app)}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                          title="View Application"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {/* Action dropdown trigger */}
                      {app.tailored_cv && (
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === app.id ? null : app.id)}
                            className="px-2 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded text-xs font-bold hover:bg-[var(--color-primary)]/30 transition flex items-center gap-1"
                          >
                            Apply <ChevronDown className="w-3 h-3" />
                          </button>
                          {actionMenuOpen === app.id && (
                            <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/20 rounded-xl shadow-2xl z-20 w-52 py-1 overflow-hidden">
                              <button
                                onClick={() => { setEmailApplyApp(app); setActionMenuOpen(null); }}
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2 transition"
                              >
                                <Mail className="w-4 h-4 text-blue-400" /> Apply via Email
                              </button>
                              <button
                                onClick={() => { router.push(`/dashboard/apply/${app.id}`); setActionMenuOpen(null); }}
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2 transition"
                              >
                                <ExternalLink className="w-4 h-4 text-[var(--color-primary)]" /> Open &amp; Apply Manually
                              </button>
                              <button
                                onClick={() => handleMarkApplied(app.id)}
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2 transition"
                              >
                                <CheckCircle2 className="w-4 h-4 text-[#81C784]" /> Mark as Applied
                              </button>
                            </div>
                          )}
                        </div>
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
            className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto"
            onClick={() => setViewingApp(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-3xl max-w-6xl w-full mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">{viewingApp.role}</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {viewingApp.company} {viewingApp.location && `\u2022 ${viewingApp.location}`}
                      {viewingApp.salary && viewingApp.salary !== 'Not specified' && ` \u2022 ${viewingApp.salary}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusColors[viewingApp.status] || 'text-gray-300 border-white/10'} bg-white/5 border`}>
                      {statusLabels[viewingApp.status] || viewingApp.status}
                    </span>
                    <button onClick={() => setViewingApp(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-2xl ${scoreBg(viewingApp.match_score)}`}>
                    {viewingApp.match_score}%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-300 font-medium mb-1">Match Score</div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${
                        viewingApp.match_score >= 70 ? 'bg-[#81C784]' :
                        viewingApp.match_score >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                      }`} style={{ width: `${viewingApp.match_score}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {viewingApp.match_score >= 70 ? 'Strong match — recommended to apply' :
                       viewingApp.match_score >= 50 ? 'Moderate match — review before applying' :
                       'Low match — consider carefully'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 px-4 py-2 rounded-lg flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-[var(--color-primary)] text-sm font-medium">
                    Below are the documents tailored for this role — this is what you would send to the employer.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> Tailored CV
                    </h4>
                    <div className="flex gap-1">
                      <button onClick={() => downloadAsPdf(viewingApp.tailored_cv, `CV_${viewingApp.company}_${viewingApp.role}`)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Download className="w-3 h-3" /> PDF</button>
                      <button onClick={() => downloadAsDocx(viewingApp.tailored_cv, `CV_${viewingApp.company}_${viewingApp.role}`)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Download className="w-3 h-3" /> DOCX</button>
                      <button onClick={() => navigator.clipboard.writeText(viewingApp.tailored_cv)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Copy className="w-3 h-3" /> Copy</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 max-h-[500px] overflow-y-auto text-black text-xs font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace]">
                    <FormattedCV text={viewingApp.tailored_cv} />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-[var(--color-primary)]" /> Cover Letter
                    </h4>
                    <div className="flex gap-1">
                      <button onClick={() => downloadAsPdf(viewingApp.cover_letter, `CL_${viewingApp.company}_${viewingApp.role}`)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Download className="w-3 h-3" /> PDF</button>
                      <button onClick={() => downloadAsDocx(viewingApp.cover_letter, `CL_${viewingApp.company}_${viewingApp.role}`)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Download className="w-3 h-3" /> DOCX</button>
                      <button onClick={() => navigator.clipboard.writeText(viewingApp.cover_letter)} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"><Copy className="w-3 h-3" /> Copy</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 max-h-[500px] overflow-y-auto text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {viewingApp.cover_letter}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex items-center justify-between gap-4">
                <div className="text-xs text-gray-500">
                  Generated on {new Date(viewingApp.applied_date).toLocaleDateString()}
                  {viewingApp.source_url && ' \u2022 '}
                  {viewingApp.source_url && (
                    <a href={viewingApp.source_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                      View original job posting <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  {viewingApp.status === 'ready' && (
                    <button
                      onClick={() => { handleApprove(viewingApp.id); setViewingApp(null); }}
                      className="px-4 py-2 bg-[#81C784] text-black font-bold rounded-lg text-sm flex items-center gap-1 hover:bg-[#66BB6A] transition"
                    >
                      <Check className="w-4 h-4" /> Approve & Prepare to Apply
                    </button>
                  )}
                  <button onClick={() => setViewingApp(null)} className="px-4 py-2 bg-white/10 text-gray-300 font-medium rounded-lg text-sm hover:bg-white/20 transition">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POST-APPROVAL POPUP */}
      <AnimatePresence>
        {approvedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            onClick={() => setApprovedApp(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-3xl max-w-lg w-full mx-4 p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-[#81C784]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#81C784]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Application Approved!</h3>
              <p className="text-gray-400 text-sm mb-1">
                <strong className="text-white">{approvedApp.role}</strong> at <strong className="text-white">{approvedApp.company}</strong>
              </p>
              <p className="text-gray-500 text-xs mb-6">Your tailored CV and cover letter are ready to submit.</p>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-3 mb-6">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" /> Next Steps
                </h4>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Download your tailored CV and cover letter using the buttons below</li>
                  <li>Visit the job posting on the employer&apos;s website</li>
                  <li>Submit your application with the downloaded documents</li>
                  <li>Update the status in the tracker once you&apos;ve applied</li>
                </ol>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-2 justify-center">
                  <button onClick={() => downloadAsPdf(approvedApp.tailored_cv, `CV_${approvedApp.company}_${approvedApp.role}`)} className="px-4 py-2 bg-white/10 text-gray-300 rounded-lg text-sm flex items-center gap-1 hover:bg-white/20 transition">
                    <Download className="w-4 h-4" /> Download CV
                  </button>
                  <button onClick={() => downloadAsPdf(approvedApp.cover_letter, `CL_${approvedApp.company}_${approvedApp.role}`)} className="px-4 py-2 bg-white/10 text-gray-300 rounded-lg text-sm flex items-center gap-1 hover:bg-white/20 transition">
                    <Download className="w-4 h-4" /> Download Cover Letter
                  </button>
                </div>
                {approvedApp.source_url ? (
                  <a href={approvedApp.source_url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95">
                    Apply Now <ArrowRight className="w-5 h-5" />
                  </a>
                ) : (
                  <button onClick={() => setApprovedApp(null)} className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition">
                    Got It <Check className="w-5 h-5" />
                  </button>
                )}
                <button onClick={() => setApprovedApp(null)} className="text-gray-500 text-sm hover:text-gray-300 transition">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EMAIL APPLY MODAL */}
      <AnimatePresence>
        {emailApplyApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
            onClick={() => { setEmailApplyApp(null); setEmailRecipient(""); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a2e] border border-white/10 rounded-3xl max-w-md w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" /> Apply via Email
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                {emailApplyApp.role} at {emailApplyApp.company}
              </p>

              {emailSentFor === emailApplyApp.id ? (
                <div className="bg-[#81C784]/10 border border-[#81C784]/30 px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-[#81C784]" />
                  <span className="text-[#81C784] text-sm font-medium">Email sent successfully!</span>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-300 mb-1">Recipient Email (HR / Hiring Manager)</label>
                    <input
                      type="email"
                      value={emailRecipient}
                      onChange={e => setEmailRecipient(e.target.value)}
                      placeholder="hr@company.com"
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mb-4">
                    Your cover letter will be sent as the email body, with your tailored CV details included. Reply-to will be set to your email address.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEmailApply(emailApplyApp.id, emailRecipient)}
                      disabled={sendingEmail || !emailRecipient.trim()}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Send Application
                    </button>
                    <button
                      onClick={() => { setEmailApplyApp(null); setEmailRecipient(""); }}
                      className="px-4 py-2.5 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
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

    if (trimmed.startsWith('\u2022')) {
      flushCompetencies();
      elements.push(
        <div key={key} className="pl-3.5 -indent-3 leading-relaxed text-gray-800 text-[10.5px]">
          {trimmed}
        </div>
      );
      continue;
    }

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
