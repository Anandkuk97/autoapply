"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, MapPin, Briefcase, CheckCircle2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { extractTextFromPdf } from "@/lib/pdf-extract";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleComplete = async () => {
    setIsUploading(true);
    try {
      if (file) {
        const cvText = await extractTextFromPdf(file);
        if (cvText && cvText.trim().length > 0) {
          await fetch("/api/parse-cv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cvText }),
          });
        }
      }
    } catch (err) {
      console.warn("CV upload during onboarding failed, user can re-upload on profile page:", err);
    } finally {
      setIsUploading(false);
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col justify-center items-center p-6 relative">
      <div className="absolute top-0 left-0 w-full p-6 flex justify-start z-50">
        <Link href="/" className="text-gray-400 hover:text-white transition font-heading">
          &larr; Back to home
        </Link>
      </div>

      <div className="w-full max-w-2xl bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">
        {/* Progress Bar */}
        <div className="flex justify-between items-center mb-10 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full z-0" />
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[var(--color-primary)] rounded-full z-0 transition-all duration-500 ease-in-out" 
            style={{ width: `${((step - 1) / 2) * 100}%` }} 
          />
          
          {[1, 2, 3].map((num) => (
            <div 
              key={num} 
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold z-10 transition-colors duration-300 ${
                step >= num ? "bg-[var(--color-primary)] text-black shadow-[0_0_15px_rgba(245,197,24,0.5)]" : "bg-gray-800 text-gray-500 border border-white/10"
              }`}
            >
              {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <h2 className="text-3xl font-heading font-bold text-white">Upload your CV</h2>
              <p className="text-gray-400">PDF format works best for accurate parsing.</p>
              
              <div className="w-full relative border-2 border-dashed border-white/20 rounded-2xl p-12 hover:bg-white/5 hover:border-[var(--color-primary)] transition-colors cursor-pointer group flex flex-col items-center justify-center">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                />
                <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <UploadCloud className="w-8 h-8 text-[var(--color-primary)]" />
                </div>
                <span className="text-white font-medium text-lg">
                  {file ? file.name : "Click or drag file to upload"}
                </span>
                {!file && <span className="text-gray-500 text-sm mt-2">Max file size 5MB</span>}
              </div>

              <div className="w-full flex justify-end mt-8">
                <button 
                  onClick={nextStep}
                  disabled={!file}
                  className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-yellow-400 transition"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col space-y-6"
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-heading font-bold text-white mb-2">Target Preferences</h2>
                <p className="text-gray-400">What kind of roles are you looking for?</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
                    Job Titles
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Software Engineer, Frontend Developer" 
                    value={jobTitles}
                    onChange={(e) => setJobTitles(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
                    Locations
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. London, Remote, New York" 
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition"
                  />
                </div>
              </div>

              <div className="w-full flex justify-between mt-8">
                <button 
                  onClick={prevStep}
                  className="px-6 py-3 bg-white/5 text-white font-medium rounded-full flex items-center gap-2 hover:bg-white/10 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button 
                  onClick={nextStep}
                  disabled={!jobTitles.length || !locations.length}
                  className="px-6 py-3 bg-[var(--color-primary)] text-black font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-yellow-400 transition"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-[var(--color-primary)]" />
              </div>
              
              <h2 className="text-3xl font-heading font-bold text-white">All Set!</h2>
              <p className="text-gray-400 max-w-sm">
                We'll parse your CV and start finding top matches tailored for exactly what you're looking for.
              </p>

              <div className="bg-black/30 rounded-2xl p-6 w-full text-left space-y-3 border border-white/5 mt-6">
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-gray-500">CV File</span>
                  <span className="text-white font-medium truncate max-w-[200px]">{file?.name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-gray-500">Targets</span>
                  <span className="text-white font-medium truncate max-w-[200px]">{jobTitles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Locations</span>
                  <span className="text-white font-medium truncate max-w-[200px]">{locations}</span>
                </div>
              </div>

              <div className="w-full flex justify-between mt-8">
                <button 
                  onClick={prevStep}
                  className="px-6 py-3 bg-white/5 text-white font-medium rounded-full flex items-center gap-2 hover:bg-white/10 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button 
                  onClick={handleComplete}
                  disabled={isUploading}
                  className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-full disabled:opacity-50 flex items-center gap-2 hover:bg-yellow-400 transition"
                >
                  {isUploading ? "Setting up..." : "Complete Setup"} 
                  {!isUploading && <CheckCircle2 className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
