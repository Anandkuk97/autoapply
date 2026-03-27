"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileText, Download, Copy, Check, ExternalLink, ArrowLeft,
  CheckCircle2, Loader2, MapPin, Building2, Briefcase,
  Navigation, ClipboardCheck, ArrowRight, Mail
} from "lucide-react";
import { motion } from "framer-motion";
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
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Email apply
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

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
        const err = await res.json();
        throw new Error(err.error || "Failed to load application");
      }
      const data = await res.json();
      setPkg(data);
      if (data.status === "Applied") setMarked(true);
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

  const markStep = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  };

  const handleMarkApplied = async () => {
    setMarking(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      await supabase
        .from("applications")
        .update({ status: "Applied", applied_date: new Date().toISOString() })
        .eq("id", id);
      setMarked(true);

      // Send confirmation email
      try {
        await fetch("/api/apply-email-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ application_id: id }),
        });
      } catch {}
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarking(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail.trim()) {
      setEmailError("Please enter the recipient email address.");
      return;
    }
    setSendingEmail(true);
    setEmailError("");
    try {
      const res = await fetch("/api/apply-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: id, recipient_email: recipientEmail }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send email");
      }
      const data = await res.json();
      setEmailSent(true);
      setMarked(true);
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-red-400 mb-4">{error || "Application not found"}</p>
        <button onClick={() => router.push("/dashboard")} className="text-[var(--color-primary)] hover:underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const applySteps = [
    { num: 1, text: "Click \"Open Job Posting\" below to view the job on the employer's website" },
    { num: 2, text: "Fill in the application form using your details below" },
    { num: 3, text: "Upload the tailored CV (download it using the button below)" },
    { num: 4, text: "Paste the cover letter when asked" },
    { num: 5, text: "Submit the application on their website" },
    { num: 6, text: "Come back here and click \"Mark as Applied\"" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[var(--color-primary)]" />
            Apply: {pkg.role_title}
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {pkg.company_name}</span>
            {pkg.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {pkg.location}</span>}
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              pkg.match_score >= 70 ? 'bg-[#81C784]/20 text-[#81C784]' :
              pkg.match_score >= 50 ? 'bg-yellow-400/20 text-yellow-400' :
              'bg-red-400/20 text-red-400'
            }`}>{pkg.match_score}% match</span>
          </p>
        </div>
        {marked && (
          <div className="px-4 py-2 bg-[#81C784]/20 text-[#81C784] rounded-xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Applied
          </div>
        )}
      </div>

      {/* Two columns: Apply Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Method A: Email Apply */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Option A: Apply via Email
          </h2>
          <p className="text-sm text-gray-400">
            Send your tailored CV and cover letter directly to the hiring manager or HR team.
          </p>

          {emailSent ? (
            <div className="bg-[#81C784]/10 border border-[#81C784]/30 px-4 py-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#81C784]" />
              <span className="text-[#81C784] text-sm font-medium">Email sent to {recipientEmail}</span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Recipient Email (HR / Hiring Manager)</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="hr@company.com"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition"
                />
              </div>
              {emailError && <p className="text-red-400 text-xs">{emailError}</p>}
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail || !recipientEmail.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                Send Application Email
              </button>
            </>
          )}
          <p className="text-[11px] text-gray-600">
            Sends cover letter as email body with reply-to set to your email. CV text included. PDF attachment available in future update.
          </p>
        </div>

        {/* Method B: Manual Apply Steps */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-[var(--color-primary)]" />
            Option B: Apply Manually
          </h2>
          <p className="text-sm text-gray-400">
            Open the job posting and submit your application using the tailored documents below.
          </p>

          <div className="space-y-2">
            {applySteps.map(step => (
              <div
                key={step.num}
                onClick={() => markStep(step.num)}
                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition ${
                  completedSteps.has(step.num) ? 'bg-[#81C784]/10' : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  completedSteps.has(step.num) ? "bg-[#81C784] text-black" : "bg-white/10 text-gray-500"
                }`}>
                  {completedSteps.has(step.num) ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <span className={`text-sm ${completedSteps.has(step.num) ? 'text-gray-400 line-through' : 'text-gray-300'}`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>

          {pkg.job_url ? (
            <a
              href={pkg.job_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markStep(1)}
              className="w-full px-4 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition"
            >
              Open Job Posting <ExternalLink className="w-5 h-5" />
            </a>
          ) : (
            <p className="text-gray-500 text-sm text-center">No job URL available. Search for this role manually.</p>
          )}

          {!marked && (
            <button
              onClick={handleMarkApplied}
              disabled={marking}
              className="w-full px-4 py-3 bg-[#81C784] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#66BB6A] transition disabled:opacity-50"
            >
              {marking ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Mark as Applied
            </button>
          )}
        </div>
      </div>

      {/* Your Details (copyable) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[var(--color-primary)]" />
          Your Details
          <span className="text-xs text-gray-500 font-normal ml-2">Click any field to copy</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Full Name", value: pkg.applicant.name },
            { label: "Email", value: pkg.applicant.email },
            { label: "Phone", value: pkg.applicant.phone },
            { label: "Location", value: pkg.applicant.location },
            ...(pkg.applicant.linkedin ? [{ label: "LinkedIn", value: pkg.applicant.linkedin }] : []),
          ].filter(f => f.value).map(field => (
            <button
              key={field.label}
              onClick={() => copyText(field.value, field.label)}
              className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-left hover:bg-white/5 transition group"
            >
              <div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">{field.label}</div>
                <div className="text-sm text-white font-medium mt-0.5">{field.value}</div>
              </div>
              {copied[field.label] ? (
                <Check className="w-4 h-4 text-[#81C784] shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0 transition" />
              )}
            </button>
          ))}
        </div>

        {/* Common Answers */}
        {Object.entries(pkg.common_answers).some(([, v]) => v) && (
          <>
            <h3 className="text-sm font-bold text-gray-300 mt-4">Common Application Answers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(pkg.common_answers)
                .filter(([, v]) => v)
                .map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => copyText(value, key)}
                    className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-left hover:bg-white/5 transition group"
                  >
                    <div>
                      <div className="text-[11px] text-gray-500 uppercase tracking-wider">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-white font-medium mt-0.5">{value}</div>
                    </div>
                    {copied[key] ? (
                      <Check className="w-4 h-4 text-[#81C784] shrink-0" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0 transition" />
                    )}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tailored CV */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> Tailored CV
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => copyText(pkg.tailored_cv_text, 'cv')}
                className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"
              >
                {copied['cv'] ? <Check className="w-3 h-3 text-[#81C784]" /> : <Copy className="w-3 h-3" />} Copy
              </button>
              <button
                onClick={() => downloadAsPdf(pkg.tailored_cv_text, `CV_${pkg.company_name}_${pkg.role_title}`)}
                className="px-3 py-1.5 bg-blue-600 rounded-lg text-xs text-white hover:bg-blue-500 flex items-center gap-1 transition font-bold"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => downloadAsDocx(pkg.tailored_cv_text, `CV_${pkg.company_name}_${pkg.role_title}`)}
                className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"
              >
                <Download className="w-3 h-3" /> DOCX
              </button>
            </div>
          </div>
          <div className="bg-white p-4 max-h-[600px] overflow-y-auto text-black text-xs font-[ui-monospace,'Cascadia Code','Segoe UI Mono',monospace] whitespace-pre-wrap">
            {pkg.tailored_cv_text}
          </div>
        </div>

        {/* Cover Letter */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[var(--color-primary)]" /> Cover Letter
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => copyText(pkg.cover_letter_text, 'cl')}
                className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"
              >
                {copied['cl'] ? <Check className="w-3 h-3 text-[#81C784]" /> : <Copy className="w-3 h-3" />} Copy
              </button>
              <button
                onClick={() => downloadAsPdf(pkg.cover_letter_text, `CL_${pkg.company_name}_${pkg.role_title}`)}
                className="px-3 py-1.5 bg-blue-600 rounded-lg text-xs text-white hover:bg-blue-500 flex items-center gap-1 transition font-bold"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => downloadAsDocx(pkg.cover_letter_text, `CL_${pkg.company_name}_${pkg.role_title}`)}
                className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-gray-300 hover:bg-white/20 flex items-center gap-1 transition"
              >
                <Download className="w-3 h-3" /> DOCX
              </button>
            </div>
          </div>
          <div className="bg-white p-4 max-h-[600px] overflow-y-auto text-black text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {pkg.cover_letter_text}
          </div>
        </div>
      </div>
    </div>
  );
}
