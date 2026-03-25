"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { TagInput } from "@/components/TagInput";
import { Briefcase, MapPin, PoundSterling, Building, Loader2, Save, CheckCircle2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function PreferencesPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error: fetchError } = await supabase
          .from("users")
          .select("target_roles, target_locations, salary_min, salary_max, work_type, excluded_companies")
          .eq("id", user.id)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setTargetRoles(data.target_roles || []);
          setTargetLocations(data.target_locations || []);
          setSalaryMin(data.salary_min ? data.salary_min.toString() : "");
          setSalaryMax(data.salary_max ? data.salary_max.toString() : "");
          setWorkTypes(data.work_type ? data.work_type.split(", ").filter(Boolean) : []);
          setExcludedCompanies(data.excluded_companies || []);
        }
      } catch (err: any) {
        console.error("Error loading preferences:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, []);

  const handleWorkTypeToggle = (type: string) => {
    setWorkTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("users")
        .update({
          target_roles: targetRoles,
          target_locations: targetLocations,
          salary_min: salaryMin ? parseInt(salaryMin) : null,
          salary_max: salaryMax ? parseInt(salaryMax) : null,
          work_type: workTypes.join(", "),
          excluded_companies: excludedCompanies
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto mt-12 bg-white/5 border border-white/10 rounded-3xl p-12 text-center"
      >
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-3xl font-heading font-bold text-white mb-4">Preferences Saved!</h2>
        <p className="text-gray-400 mb-8">
          Your job search criteria have been successfully updated. Our AI will use these targets to find your perfect matches.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl inline-flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-105"
        >
          Go to Dashboard <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div>
        <h1 className="text-3xl font-heading font-bold text-white mb-2">Job Preferences</h1>
        <p className="text-gray-400">Set your targets so our AI can find the perfect matches for you.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white/5 border border-white/10 p-8 rounded-3xl space-y-8">
        {/* Target Roles */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
            Target Job Titles
          </label>
          <p className="text-xs text-gray-500 mb-3">Type a title and press Enter (e.g. "Software Engineer")</p>
          <TagInput 
            tags={targetRoles} 
            setTags={setTargetRoles} 
            placeholder="Add job title..." 
          />
        </div>

        {/* Target Locations */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
            Target Locations
          </label>
          <p className="text-xs text-gray-500 mb-3">Type a location and press Enter (e.g. "London", "Remote UK")</p>
          <TagInput 
            tags={targetLocations} 
            setTags={setTargetLocations} 
            placeholder="Add location..." 
          />
        </div>

        {/* Salary Range */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <PoundSterling className="w-4 h-4 text-[var(--color-primary)]" />
            Salary Expectation (GBP)
          </label>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
              <input 
                type="number" 
                value={salaryMin}
                onChange={e => setSalaryMin(e.target.value)}
                placeholder="Min Salary"
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
                placeholder="Max Salary"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:border-[var(--color-primary)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Work Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Work Environment
          </label>
          <div className="flex flex-wrap gap-4">
            {["Remote", "Hybrid", "On-site"].map((type) => (
              <label key={type} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  workTypes.includes(type) ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "border-gray-500 group-hover:border-[var(--color-primary)]"
                }`}>
                  {workTypes.includes(type) && <CheckCircle2 className="w-3 h-3 text-black" />}
                </div>
                <span className="text-gray-300 group-hover:text-white transition">{type}</span>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={workTypes.includes(type)}
                  onChange={() => handleWorkTypeToggle(type)}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Excluded Companies */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-[var(--color-primary)]" />
            Excluded Companies
          </label>
          <p className="text-xs text-gray-500 mb-3">Skip roles from these companies</p>
          <TagInput 
            tags={excludedCompanies} 
            setTags={setExcludedCompanies} 
            placeholder="Add company to block..." 
          />
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <> <Save className="w-4 h-4" /> Save Preferences</>}
          </button>
        </div>
      </form>
    </div>
  );
}
