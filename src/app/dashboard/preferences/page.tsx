"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { TagInput } from "@/components/TagInput";
import {
  Briefcase, MapPin, PoundSterling, Building, Loader2, Save,
  CheckCircle2, ArrowRight, Trash2, Pencil, FolderOpen, Plus,
  Clock, X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface PreferenceProfile {
  id: string;
  name: string;
  target_roles: string[];
  target_locations: string[];
  salary_min: number | null;
  salary_max: number | null;
  work_type: string;
  excluded_companies: string[];
  created_at: string;
}

export default function PreferencesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);

  // Current preferences form
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetLocations, setTargetLocations] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);

  // Saved profiles
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Recent/suggestion values
  const [recentRoles, setRecentRoles] = useState<string[]>([]);
  const [recentLocations, setRecentLocations] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const [profileRes, profilesResult] = await Promise.all([
        fetch("/api/get-profile").then(r => r.json()),
        supabase
          .from("preference_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false })
      ]);

      if (profileRes.profile) {
        const data = profileRes.profile;
        setTargetRoles(data.target_roles || []);
        setTargetLocations(data.target_locations || []);
        setSalaryMin(data.salary_min ? data.salary_min.toString() : "");
        setSalaryMax(data.salary_max ? data.salary_max.toString() : "");
        setWorkTypes(data.work_type ? data.work_type.split(", ").filter(Boolean) : []);
        setExcludedCompanies(data.excluded_companies || []);
      }

      if (!profilesResult.error && profilesResult.data) {
        setProfiles(profilesResult.data);
      }

      buildRecentSuggestions(profileRes.profile, profilesResult.data || []);
    } catch (err: any) {
      console.error("Error loading preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildRecentSuggestions = (currentPrefs: any, savedProfiles: PreferenceProfile[]) => {
    const rolesSet = new Set<string>();
    const locsSet = new Set<string>();

    if (currentPrefs?.target_roles) currentPrefs.target_roles.forEach((r: string) => rolesSet.add(r));
    if (currentPrefs?.target_locations) currentPrefs.target_locations.forEach((l: string) => locsSet.add(l));

    for (const p of savedProfiles) {
      if (p.target_roles) p.target_roles.forEach(r => rolesSet.add(r));
      if (p.target_locations) p.target_locations.forEach(l => locsSet.add(l));
    }

    setRecentRoles(Array.from(rolesSet));
    setRecentLocations(Array.from(locsSet));
  };

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
      const payload = {
        target_roles: targetRoles,
        target_locations: targetLocations,
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        work_type: workTypes.join(", "),
        excluded_companies: excludedCompanies
      };

      const res = await fetch("/api/save-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save preferences");

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsProfile = async () => {
    if (!user) return;
    setSavingProfile(true);

    try {
      const profileName = `Profile ${profiles.length + 1}`;
      const { data, error: insertError } = await supabase
        .from("preference_profiles")
        .insert({
          user_id: user.id,
          name: profileName,
          target_roles: targetRoles,
          target_locations: targetLocations,
          salary_min: salaryMin ? parseInt(salaryMin) : null,
          salary_max: salaryMax ? parseInt(salaryMax) : null,
          work_type: workTypes.join(", "),
          excluded_companies: excludedCompanies
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (data) {
        setProfiles(prev => [data, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLoadProfile = (profile: PreferenceProfile) => {
    setTargetRoles(profile.target_roles || []);
    setTargetLocations(profile.target_locations || []);
    setSalaryMin(profile.salary_min ? profile.salary_min.toString() : "");
    setSalaryMax(profile.salary_max ? profile.salary_max.toString() : "");
    setWorkTypes(profile.work_type ? profile.work_type.split(", ").filter(Boolean) : []);
    setExcludedCompanies(profile.excluded_companies || []);
    setSuccess(false);
  };

  const handleRenameProfile = async (profileId: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("preference_profiles").update({ name: renameValue.trim() }).eq("id", profileId);
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, name: renameValue.trim() } : p));
    }
    setRenamingProfile(null);
  };

  const handleDeleteProfile = async (profileId: string) => {
    const { error } = await supabase.from("preference_profiles").delete().eq("id", profileId);
    if (!error) setProfiles(prev => prev.filter(p => p.id !== profileId));
  };

  const addRoleSuggestion = (role: string) => {
    setTargetRoles(prev => prev.includes(role) ? prev : [...prev, role]);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
    </div>
  );

  if (success) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto mt-12 bg-white border border-emerald-100 rounded-[2.5rem] p-12 text-center shadow-xl"
    >
      <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
        <CheckCircle2 className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Preferences Saved!</h2>
      <p className="text-slate-600 font-medium mb-8 leading-relaxed">Your job search criteria have been successfully updated. Our neural engine will now prioritize matches reflecting your targets.</p>
      <div className="flex gap-4 justify-center">
        <button onClick={() => setSuccess(false)} className="px-6 py-3 bg-slate-100 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition">Edit Again</button>
        <button onClick={() => router.push("/dashboard")} className="px-10 py-3 bg-[var(--color-primary)] text-white font-black text-[10px] uppercase tracking-widest rounded-xl inline-flex items-center justify-center gap-2 hover:bg-emerald-700 transition hover:scale-105 shadow-xl shadow-emerald-200">Go to Dashboard <ArrowRight className="w-5 h-5" /></button>
      </div>
    </motion.div>
  );

  const availableRoleSuggestions = recentRoles.filter(r => !targetRoles.includes(r));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="space-y-1">
        <h2 className="text-5xl font-black leading-tight tracking-tighter text-slate-900">Targets.</h2>
        <p className="text-slate-500 text-[10px] tracking-[0.4em] uppercase font-black opacity-40">Neural Matching Calibration</p>
      </header>


      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-2xl text-sm font-black flex items-center gap-3">
          <X className="w-5 h-5 cursor-pointer" onClick={() => setError("")} />
          {error}
        </div>
      )}

      {profiles.length > 0 && (
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] space-y-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 uppercase tracking-widest">
            <FolderOpen className="w-5 h-5 text-[var(--color-primary)]" />
            Registry Profiles
          </h3>
          <div className="space-y-3">
            {profiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 group hover:border-[var(--color-primary)] transition-all">
                <div className="flex-1 min-w-0">
                  {renamingProfile === profile.id ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRenameProfile(profile.id)} autoFocus className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 text-sm outline-none focus:border-[var(--color-primary)]" />
                      <button onClick={() => handleRenameProfile(profile.id)} className="text-emerald-600 text-xs font-black uppercase tracking-widest hover:underline">Save</button>
                    </div>
                  ) : (
                    <div>
                      <span className="text-slate-900 font-black text-sm uppercase tracking-tight">{profile.name}</span>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">{profile.target_roles?.join(" • ") || "Global Target"}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button onClick={() => handleLoadProfile(profile)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Activate</button>
                  <button onClick={() => { setRenamingProfile(profile.id); setRenameValue(profile.name); }} className="p-2 hover:bg-white rounded-lg transition text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDeleteProfile(profile.id)} className="p-2 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 p-10 rounded-[2.5rem] space-y-10 shadow-sm">
        <div>
          <label className="block text-sm font-black text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-widest">
            <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
            Target Job Titles
          </label>
          <p className="text-[10px] text-slate-400 uppercase font-bold mb-4 tracking-wider">Type a title and press Enter (e.g. "Operations Manager")</p>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <TagInput tags={targetRoles} setTags={setTargetRoles} placeholder="Add job title..." />
          </div>
          {availableRoleSuggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mr-2">Suggestions:</span>
              {availableRoleSuggestions.map(role => (
                <button key={role} type="button" onClick={() => addRoleSuggestion(role)} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-600 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all shadow-sm">+ {role}</button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-black text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-widest">
            <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
            Target Locations
          </label>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <TagInput tags={targetLocations} setTags={setTargetLocations} placeholder="Add location..." />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <PoundSterling className="w-4 h-4 text-[var(--color-primary)]" />
              Minimum Salary
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">£</span>
              <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-slate-900 font-black focus:border-[var(--color-primary)] outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <PoundSterling className="w-4 h-4 text-[var(--color-primary)]" />
              Maximum Salary
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black">£</span>
              <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="150,000" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-slate-900 font-black focus:border-[var(--color-primary)] outline-none transition-all" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-black text-slate-800 uppercase tracking-widest">Work Environment</label>
          <div className="flex flex-wrap gap-4">
            {["Remote", "Hybrid", "On-site"].map((type) => (
              <label key={type} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                  workTypes.includes(type) ? "bg-[var(--color-primary)] border-transparent shadow-lg shadow-emerald-200" : "border-slate-200 bg-white"
                }`}>
                  {workTypes.includes(type) && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <span className="text-slate-700 font-bold group-hover:text-slate-900 transition">{type}</span>
                <input type="checkbox" className="hidden" checked={workTypes.includes(type)} onChange={() => handleWorkTypeToggle(type)} />
              </label>
            ))}
          </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex flex-wrap gap-4 justify-between items-center">
          <button type="button" onClick={handleSaveAsProfile} disabled={savingProfile || (!targetRoles.length && !targetLocations.length)} className="h-16 px-8 bg-white border border-slate-200 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-slate-50 transition shadow-sm disabled:opacity-40">
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Save current config to Registry
          </button>
          <button type="submit" disabled={saving} className="h-16 px-12 bg-slate-900 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-200">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Update Core Targets</>}
          </button>
        </div>
      </form>
    </div>
  );
}
