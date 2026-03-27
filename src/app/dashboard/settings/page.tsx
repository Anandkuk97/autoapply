"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle,
  Trash2, KeyRound, Briefcase, Info, Lock
} from "lucide-react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // LinkedIn credentials state
  const [linkedinConfigured, setLinkedinConfigured] = useState(false);
  const [linkedinMaskedEmail, setLinkedinMaskedEmail] = useState("");
  const [linkedinEmail, setLinkedinEmail] = useState("");
  const [linkedinPassword, setLinkedinPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) router.push("/login");
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/linkedin-credentials");
      const data = await res.json();
      if (data.configured) {
        setLinkedinConfigured(true);
        setLinkedinMaskedEmail(data.maskedEmail || "");
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!linkedinEmail || !linkedinPassword) {
      setMessage({ type: "error", text: "Both email and password are required" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/linkedin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkedinEmail, password: linkedinPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "LinkedIn credentials saved securely" });
        setLinkedinConfigured(true);
        setLinkedinMaskedEmail(linkedinEmail.replace(/(.{2}).*(@.*)/, "$1***$2"));
        setLinkedinEmail("");
        setLinkedinPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCredentials() {
    if (!confirm("Remove your LinkedIn credentials? You'll need to re-enter them to use auto-submit.")) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/linkedin-credentials", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setLinkedinConfigured(false);
        setLinkedinMaskedEmail("");
        setMessage({ type: "success", text: "LinkedIn credentials removed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[var(--color-bg)]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Status message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
          </motion.div>
        )}

        {/* LinkedIn Credentials Section */}
        <div className="bg-[var(--color-card)] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold">LinkedIn Auto-Submit</h2>
            </div>
            <p className="text-sm text-gray-400 ml-12">
              Save your LinkedIn credentials to enable automatic Easy Apply submissions.
            </p>
          </div>

          <div className="p-6">
            {/* Security notice */}
            <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl mb-6">
              <Shield className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300 space-y-1">
                <p className="font-medium text-yellow-400">Security Information</p>
                <ul className="list-disc list-inside text-gray-400 space-y-0.5">
                  <li>Credentials are encrypted with AES-256-GCM before storage</li>
                  <li>Encryption keys are derived from your server environment</li>
                  <li>Credentials are never exposed to the browser</li>
                  <li>You can delete them at any time</li>
                </ul>
              </div>
            </div>

            {/* Current status */}
            {linkedinConfigured && (
              <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Credentials Configured</p>
                    <p className="text-xs text-gray-400">Logged in as: {linkedinMaskedEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleDeleteCredentials}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Remove
                </button>
              </div>
            )}

            {/* Credential form */}
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  LinkedIn Email
                </label>
                <input
                  type="email"
                  value={linkedinEmail}
                  onChange={e => setLinkedinEmail(e.target.value)}
                  placeholder={linkedinConfigured ? "Enter new email to update" : "your-email@example.com"}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  LinkedIn Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={linkedinPassword}
                    onChange={e => setLinkedinPassword(e.target.value)}
                    placeholder={linkedinConfigured ? "Enter new password to update" : "Your LinkedIn password"}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || (!linkedinEmail && !linkedinPassword)}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Encrypting & Saving...</>
                ) : (
                  <><Lock className="w-4 h-4" /> {linkedinConfigured ? "Update Credentials" : "Save Credentials"}</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Auto-Submit Info */}
        <div className="bg-[var(--color-card)] border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Info className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold">How Auto-Submit Works</h2>
          </div>

          <div className="space-y-4 text-sm text-gray-400">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">1</div>
              <p>Select jobs with LinkedIn Easy Apply in your Application Tracker</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">2</div>
              <p>Click "Auto-Submit (LinkedIn)" from the Apply dropdown</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">3</div>
              <p>A headless browser logs into LinkedIn using your encrypted credentials</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">4</div>
              <p>The system fills out Easy Apply forms with your profile data and cover letter</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">5</div>
              <p>Applications are submitted with human-like timing (random delays between actions)</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
            <p className="text-sm text-orange-400 font-medium mb-1">Safety Limits</p>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Maximum 10 applications per session</li>
              <li>Random 2-15 second delays between actions</li>
              <li>Automatic CAPTCHA detection — stops immediately if detected</li>
              <li>Security challenge detection — pauses for manual intervention</li>
              <li>Screenshots captured at each step for transparency</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
