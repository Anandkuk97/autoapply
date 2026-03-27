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
  const [loadingProfiles, setLoadingProfiles] = useState(false);
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

      // Load current preferences via server API (bypasses RLS) + profiles in parallel
      const [profileRes, profilesResult] = await Promise.all([
        fetch("/api/get-profile").then(r => r.json()),
        supabase
          .from("preference_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .order("created_at", { ascending: false })
      ]);

      console.log("[preferences] Profile API result:", profileRes);

      // Load current preferences from API response
      if (profileRes.profile) {
        const data = profileRes.profile;
        setTargetRoles(data.target_roles || []);
        setTargetLocations(data.target_locations || []);
        setSalaryMin(data.salary_min ? data.salary_min.toString() : "");
        setSalaryMax(data.salary_max ? data.salary_max.toString() : "");
        setWorkTypes(data.work_type ? data.work_type.split(", ").filter(Boolean) : []);
        setExcludedCompanies(data.excluded_companies || []);
      }

      // Load saved profiles
      if (!profilesResult.error && profilesResult.data) {
        setProfiles(profilesResult.data);
      }

      // Build recent suggestions from saved profiles + current prefs
      buildRecentSuggestions(
        profileRes.profile,
        profilesResult.data || []
      );
    } catch (err: any) {
      console.error("Error loading preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildRecentSuggestions = (currentPrefs: any, savedProfiles: PreferenceProfile[]) => {
    const rolesSet = new Set<string>();
    const locsSet = new Set<string>();

    // From current preferences
    if (currentPrefs?.target_roles) {
      currentPrefs.target_roles.forEach((r: string) => rolesSet.add(r));
    }
    if (currentPrefs?.target_locations) {
      currentPrefs.target_locations.forEach((l: string) => locsSet.add(l));
    }

    // From all saved profiles
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

  // Keep refs in sync so handleSave always reads latest values
  const rolesRef = useRef(targetRoles);
  const locsRef = useRef(targetLocations);
  useEffect(() => { rolesRef.current = targetRoles; }, [targetRoles]);
  useEffect(() => { locsRef.current = targetLocations; }, [targetLocations]);

  // Log every state change for debugging
  useEffect(() => {
    console.log("[preferences] State changed -> targetRoles:", targetRoles);
  }, [targetRoles]);
  useEffect(() => {
    console.log("[preferences] State changed -> targetLocations:", targetLocations);
  }, [targetLocations]);

  // ── Save current preferences via server API (bypasses RLS) ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Read from both state and ref to diagnose any stale closure issue
      console.log("[preferences] handleSave called");
      console.log("[preferences] targetRoles (state):", targetRoles);
      console.log("[preferences] targetRoles (ref):", rolesRef.current);
      console.log("[preferences] targetLocations (state):", targetLocations);
      console.log("[preferences] targetLocations (ref):", locsRef.current);

      // Use ref values as they are guaranteed fresh
      const roles = rolesRef.current;
      const locs = locsRef.current;

      const payload = {
        target_roles: roles,
        target_locations: locs,
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        work_type: workTypes.join(", "),
        excluded_companies: excludedCompanies
      };

      console.log("[preferences] Saving via API:", JSON.stringify(payload, null, 2));

      const res = await fetch("/api/save-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      console.log("[preferences] API response:", result);

      if (!res.ok) {
        throw new Error(result.error || "Failed to save preferences");
      }

      // Update recent suggestions
      buildRecentSuggestions(
        { target_roles: roles, target_locations: locs },
        profiles
      );

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  // ── Save as Profile ──
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
        buildRecentSuggestions(
          { target_roles: targetRoles, target_locations: targetLocations },
          [data, ...profiles]
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Load Profile ──
  const handleLoadProfile = (profile: PreferenceProfile) => {
    setTargetRoles(profile.target_roles || []);
    setTargetLocations(profile.target_locations || []);
    setSalaryMin(profile.salary_min ? profile.salary_min.toString() : "");
    setSalaryMax(profile.salary_max ? profile.salary_max.toString() : "");
    setWorkTypes(profile.work_type ? profile.work_type.split(", ").filter(Boolean) : []);
    setExcludedCompanies(profile.excluded_companies || []);
    setSuccess(false); // Reset success state since form changed
  };

  // ── Rename Profile ──
  const handleRenameProfile = async (profileId: string) => {
    if (!renameValue.trim()) return;

    const { error: renameError } = await supabase
      .from("preference_profiles")
      .update({ name: renameValue.trim() })
      .eq("id", profileId);

    if (!renameError) {
      setProfiles(prev =>
        prev.map(p => p.id === profileId ? { ...p, name: renameValue.trim() } : p)
      );
    }
    setRenamingProfile(null);
    setRenameValue("");
  };

  // ── Delete Profile ──
  const handleDeleteProfile = async (profileId: string) => {
    const { error: deleteError } = await supabase
      .from("preference_profiles")
      .delete()
      .eq("id", profileId);

    if (!deleteError) {
      setProfiles(prev => prev.filter(p => p.id !== profileId));
    }
  };

  // ── Add suggestion tag (use functional update for safety) ──
  const addRoleSuggestion = (role: string) => {
    setTargetRoles(prev => {
      if (prev.includes(role)) return prev;
      console.log("[preferences] Added role suggestion:", role);
      return [...prev, role];
    });
  };

  const addLocationSuggestion = (loc: string) => {
    setTargetLocations(prev => {
      if (prev.includes(loc)) return prev;
      console.log("[preferences] Added location suggestion:", loc);
      return [...prev, loc];
    });
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
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setSuccess(false)}
            className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl flex items-center gap-2 hover:bg-white/20 transition"
          >
            Edit Again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl inline-flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-105"
          >
            Go to Dashboard <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Filter suggestions to only show values NOT already in the current list
  const availableRoleSuggestions = recentRoles.filter(r => !targetRoles.includes(r));
  const availableLocationSuggestions = recentLocations.filter(l => !targetLocations.includes(l));

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div>
        <h1 className="text-3xl font-heading font-bold text-white mb-2">Job Preferences</h1>
        <p className="text-gray-400">Set your targets so our AI can find the perfect matches for you.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <X className="w-4 h-4 cursor-pointer hover:text-red-300" onClick={() => setError("")} />
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SAVED PROFILES                              */}
      {/* ═══════════════════════════════════════════ */}
      {profiles.length > 0 && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
          <h3 className="text-lg font-heading font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[var(--color-primary)]" />
            Saved Profiles
          </h3>
          <div className="space-y-2">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-4 py-3 group hover:border-white/15 transition"
              >
                <div className="flex-1 min-w-0">
                  {renamingProfile === profile.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleRenameProfile(profile.id)}
                        autoFocus
                        className="bg-black/50 border border-white/20 rounded-lg px-3 py-1 text-white text-sm outline-none focus:border-[var(--color-primary)]"
                      />
                      <button
                        onClick={() => handleRenameProfile(profile.id)}
                        className="text-[#81C784] text-xs font-bold hover:underline"
                      >Save</button>
                      <button
                        onClick={() => { setRenamingProfile(null); setRenameValue(""); }}
                        className="text-gray-500 text-xs hover:underline"
                      >Cancel</button>
                    </div>
                  ) : (
                    <div>
                      <span className="text-white font-semibold text-sm">{profile.name}</span>
                      <span className="text-gray-500 text-xs ml-3">
                        {profile.target_roles?.join(", ").slice(0, 50) || "No roles"}
                        {" · "}
                        {profile.target_locations?.join(", ").slice(0, 40) || "No locations"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button
                    onClick={() => handleLoadProfile(profile)}
                    className="px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg text-xs font-bold hover:bg-[var(--color-primary)]/20 transition"
                    title="Load this profile"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => { setRenamingProfile(profile.id); setRenameValue(profile.name); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition text-gray-400 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* PREFERENCES FORM                            */}
      {/* ═══════════════════════════════════════════ */}
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
          {/* Recent suggestions */}
          {availableRoleSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] text-gray-500 mr-1">Recent:</span>
              {availableRoleSuggestions.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => addRoleSuggestion(role)}
                  className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] text-gray-400 hover:text-white hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition cursor-pointer"
                >
                  + {role}
                </button>
              ))}
            </div>
          )}
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
          {/* Recent suggestions */}
          {availableLocationSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] text-gray-500 mr-1">Recent:</span>
              {availableLocationSuggestions.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => addLocationSuggestion(loc)}
                  className="px-2.5 py-0.5 bg-white/5 border border-white/10 rounded-full text-[11px] text-gray-400 hover:text-white hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition cursor-pointer"
                >
                  + {loc}
                </button>
              ))}
            </div>
          )}
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

        {/* Action buttons */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap gap-3 justify-between items-center">
          <button
            type="button"
            onClick={handleSaveAsProfile}
            disabled={savingProfile || (!targetRoles.length && !targetLocations.length)}
            className="px-5 py-2.5 bg-white/10 border border-white/20 text-white font-medium rounded-xl flex items-center gap-2 hover:bg-white/20 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Save as Profile
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-400 transition hover:scale-[1.02] active:scale-95"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Save Preferences</>}
          </button>
        </div>
      </form>
    </div>
  );
}
