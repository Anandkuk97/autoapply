"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, MapPin, Briefcase, CheckCircle2, ArrowRight, ArrowLeft,
  Sparkles, Loader2, FileText, PoundSterling, Building
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { TagInput } from "@/components/TagInput";

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // Step 1: CV
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [cvParsed, setCvParsed] = useState(false);
  const [parsedName, setParsedName] = useState("");
  const [cvError, setCvError] = useState("");

  // Step 2: Preferences
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);

  // Step 3: Confirmation
  const [isCompleting, setIsCompleting] = useState(false);

  // Check if user already completed onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/get-profile");
        const data = await res.json();

        if (data.profile?.cv_text && data.profile?.target_roles?.length > 0) {
          // Already onboarded — go to dashboard
          router.replace("/dashboard");
          return;
        }

        // Pre-fill any existing data
        if (data.profile) {
          if (data.profile.cv_text) {
            setCvParsed(true);
            setParsedName(data.profile.name || "CV uploaded");
            setStep(2); // Skip to preferences
          }
          if (data.profile.target_roles?.length) {
            setTargetRoles(data.profile.target_roles);
          }
          if (data.profile.target_locations?.length) {
            setTargetLocations(data.profile.target_locations);
          }
        }
      } catch {
        // Continue with onboarding
      } finally {
        setLoading(false);
      }
    }
    checkOnboarding();
  }, [router]);

  // ── Step 1: Upload & parse CV ──
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setCvError("");
    setIsParsing(true);

    try {
      const cvText = await extractTextFromPdf(selectedFile);
      if (!cvText || cvText.trim().length === 0) {
        throw new Error("Could not extract text from PDF. The file may be scanned or image-based.");
      }

      // Parse with Claude
      const parseRes = await fetch("/api/parse-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cvText }),
      });

      if (!parseRes.ok) throw new Error("Failed to parse CV");

      const { text, parsedData } = await parseRes.json();

      // Save profile via API
      const saveRes = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsedData?.fullName || "",
          cv_text: text,
          cv_parsed_json: parsedData,
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save profile");

      setCvParsed(true);
      setParsedName(parsedData?.fullName || selectedFile.name);
    } catch (err: any) {
      setCvError(err.message || "Error processing CV");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]?.type === "application/pdf") {
      handleFileSelect(e.dataTransfer.files[0]);
    } else {
      setCvError("Please upload a PDF file.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  // ── Step 2: Save preferences ──
  const handleSavePreferences = async () => {
    try {
      const res = await fetch("/api/save-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_roles: targetRoles,
          target_locations: targetLocations,
          salary_min: salaryMin ? parseInt(salaryMin) : null,
          salary_max: salaryMax ? parseInt(salaryMax) : null,
          work_type: workTypes.join(", "),
          excluded_companies: excludedCompanies,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  // ── Step 3: Complete ──
  const handleComplete = async () => {
    setIsCompleting(true);
    await handleSavePreferences();
    router.push("/dashboard");
  };

  const handleWorkTypeToggle = (type: string) => {
    setWorkTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const canProceedStep1 = cvParsed;
  const canProceedStep2 = targetRoles.length > 0 && targetLocations.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center items-center p-6 relative">
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50">
        <Link href="/" className="text-gray-400 hover:text-white transition font-heading">
          &larr; Back to home
        </Link>
        <span className="text-gray-500 text-sm font-heading">Step {step} of 3</span>
      </div>

      <div className="w-full max-w-2xl bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">
        {/* Progress Bar */}
        <div className="flex justify-between items-center mb-10 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[var(--color-primary)] rounded-full z-0 transition-all duration-500 ease-in-out"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          />
          {[
            { num: 1, label: "Upload CV" },
            { num: 2, label: "Preferences" },
            { num: 3, label: "Confirm" },
          ].map(({ num, label }) => (
            <div key={num} className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors duration-300 ${
                step >= num
                  ? "bg-[var(--color-primary)] text-black shadow-[0_0_15px_rgba(245,197,24,0.5)]"
                  : "bg-gray-800 text-gray-500 border border-white/10"
              }`}>
                {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium ${step >= num ? "text-[var(--color-primary)]" : "text-gray-500"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ═══ STEP 1: Upload CV ═══ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <h2 className="text-3xl font-heading font-bold text-white">Upload your CV</h2>
              <p className="text-gray-400">We&apos;ll use AI to extract your experience, skills, and qualifications.</p>

              {cvError && (
                <div className="w-full bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {cvError}
                </div>
              )}

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full relative border-2 border-dashed rounded-2xl p-12 transition-colors cursor-pointer group flex flex-col items-center justify-center ${
                  cvParsed
                    ? "border-[#81C784]/50 bg-[#81C784]/5"
                    : isParsing
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                    : "border-white/20 hover:bg-white/5 hover:border-[var(--color-primary)]"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {isParsing ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-[var(--color-primary)] animate-spin" />
                    <p className="text-white font-medium text-lg">Parsing your CV with AI...</p>
                    <p className="text-gray-500 text-sm">Extracting skills, experience, and qualifications</p>
                  </div>
                ) : cvParsed ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-[#81C784]/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-[#81C784]" />
                    </div>
                    <p className="text-white font-bold text-lg">{parsedName}</p>
                    <p className="text-[#81C784] text-sm">CV parsed successfully</p>
                    <p className="text-gray-500 text-xs">Click to upload a different CV</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 group">
                    <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center group-hover:scale-110 transition">
                      <UploadCloud className="w-8 h-8 text-[var(--color-primary)]" />
                    </div>
                    <span className="text-white font-medium text-lg">Click or drag your PDF here</span>
                    <span className="text-gray-500 text-sm">PDF format, max 5MB</span>
                  </div>
                )}
              </div>

              <div className="w-full flex justify-end mt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02]"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Preferences ═══ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-4">
                <h2 className="text-3xl font-heading font-bold text-white mb-2">Set Your Preferences</h2>
                <p className="text-gray-400">Tell us what you&apos;re looking for so we can find the best matches.</p>
              </div>

              {/* Target Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
                  Target Job Titles <span className="text-red-400">*</span>
                </label>
                <TagInput
                  tags={targetRoles}
                  setTags={setTargetRoles}
                  placeholder="Type and press Enter or click +"
                />
              </div>

              {/* Target Locations */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
                  Target Locations <span className="text-red-400">*</span>
                </label>
                <TagInput
                  tags={targetLocations}
                  setTags={setTargetLocations}
                  placeholder="Type and press Enter or click +"
                />
              </div>

              {/* Salary */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <PoundSterling className="w-4 h-4 text-[var(--color-primary)]" />
                  Salary Range (optional, GBP)
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                    <input
                      type="number"
                      value={salaryMin}
                      onChange={e => setSalaryMin(e.target.value)}
                      placeholder="Min"
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-[var(--color-primary)] outline-none"
                    />
                  </div>
                  <span className="text-gray-500">to</span>
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                    <input
                      type="number"
                      value={salaryMax}
                      onChange={e => setSalaryMax(e.target.value)}
                      placeholder="Max"
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-[var(--color-primary)] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Work Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Work Environment</label>
                <div className="flex flex-wrap gap-3">
                  {["Remote", "Hybrid", "On-site"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleWorkTypeToggle(type)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
                        workTypes.includes(type)
                          ? "bg-[var(--color-primary)]/20 border-[var(--color-primary)]/50 text-[var(--color-primary)]"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/30"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-white/5 text-white font-medium rounded-xl flex items-center gap-2 hover:bg-white/10 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={async () => {
                    await handleSavePreferences();
                    setStep(3);
                  }}
                  disabled={!canProceedStep2}
                  className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02]"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Review & Confirm ═══ */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-[var(--color-primary)]" />
              </div>

              <h2 className="text-3xl font-heading font-bold text-white">Review & Confirm</h2>
              <p className="text-gray-400 max-w-sm">
                Everything looks good? Let&apos;s start finding your perfect roles.
              </p>

              {/* Summary card */}
              <div className="bg-black/30 rounded-2xl p-6 w-full text-left space-y-4 border border-white/5">
                <div className="flex items-start gap-3 border-b border-white/5 pb-3">
                  <FileText className="w-5 h-5 text-[#81C784] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">CV</div>
                    <div className="text-white font-medium">{parsedName || file?.name || "Uploaded"}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#81C784] mt-0.5" />
                </div>
                <div className="flex items-start gap-3 border-b border-white/5 pb-3">
                  <Briefcase className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">Target Roles</div>
                    <div className="flex flex-wrap gap-1.5">
                      {targetRoles.map(r => (
                        <span key={r} className="px-2 py-0.5 bg-white/10 rounded-full text-sm text-white">{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-b border-white/5 pb-3">
                  <MapPin className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 mb-0.5">Locations</div>
                    <div className="flex flex-wrap gap-1.5">
                      {targetLocations.map(l => (
                        <span key={l} className="px-2 py-0.5 bg-white/10 rounded-full text-sm text-white">{l}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {(salaryMin || salaryMax) && (
                  <div className="flex items-start gap-3 border-b border-white/5 pb-3">
                    <PoundSterling className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">Salary</div>
                      <div className="text-white">
                        £{salaryMin || "0"} — £{salaryMax || "any"}
                      </div>
                    </div>
                  </div>
                )}
                {workTypes.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Building className="w-5 h-5 text-[var(--color-primary)] mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-0.5">Work Type</div>
                      <div className="text-white">{workTypes.join(", ")}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-white/5 text-white font-medium rounded-xl flex items-center gap-2 hover:bg-white/10 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isCompleting}
                  className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02]"
                >
                  {isCompleting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Setting up...</>
                  ) : (
                    <>Launch Dashboard <Sparkles className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
