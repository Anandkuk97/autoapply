import sys
import re

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the entire chunk from {/* STATS BAR */} down to {/* STEP 1: JOB SEARCH */}'s end.
start_marker = "      {/* STATS BAR */}"
end_marker = "      {/* ═══════════════════════════════════════════════════════════ */}\n      {/* STEP 2: SCORED JOB CARDS"

if start_marker not in content or end_marker not in content:
    print("Markers not found!")
    sys.exit(1)

pre, rest = content.split(start_marker, 1)
middle, post = rest.split(end_marker, 1)

new_ui = """      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HEADER & SEARCH BENTO                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Only show header if we haven't found jobs yet */}
        {scoredJobs.length === 0 && (
          <header className="space-y-1">
            <h2 className="text-[3.5rem] font-extrabold leading-[1.1] tracking-tighter text-[var(--color-on-surface)]">Detecting.</h2>
            <p className="text-[var(--color-secondary)] text-[11px] tracking-widest uppercase font-semibold">Active Intelligence Engine</p>
          </header>
        )}

        {/* WORKFLOW GUIDE (for new/incomplete users) */}
        {(!loadingApps && applications.length < 3 && scoredJobs.length === 0) && (
          <div className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/20 p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-heading font-bold text-[var(--color-on-surface)] mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
              How AutoApply Works
            </h3>
            <div className="space-y-4">
              {[
                { num: 1, text: "Upload your CV", done: !!userProfile?.cv_text, action: !userProfile?.cv_text ? "/dashboard/profile" : null, actionLabel: "Upload CV" },
                { num: 2, text: "Set preference (roles, locations)", done: !!(userProfile?.target_roles?.length && userProfile?.target_locations?.length), action: !(userProfile?.target_roles?.length && userProfile?.target_locations?.length) ? "/dashboard/preferences" : null, actionLabel: "Set Preferences" },
              ].map((item) => (
                <div key={item.num} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    item.done ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface-container-highest)] text-[var(--color-secondary)]"
                  }`}>
                    {item.done ? <Check className="w-4 h-4" /> : item.num}
                  </div>
                  <span className={`text-sm flex-1 ${item.done ? "text-[var(--color-secondary)] line-through" : "text-[var(--color-on-surface)] font-medium"}`}>
                    {item.text}
                  </span>
                  {item.action && (
                    <a href={item.action} className="px-3 py-1.5 bg-[var(--color-primary-container)]/30 text-[var(--color-primary)] rounded-lg text-xs font-bold hover:bg-[var(--color-primary-container)]/50 transition">
                      {item.actionLabel} &rarr;
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEARCH TRIGGER */}
        {scoredJobs.length === 0 && (
          <div className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/20 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-container-low)] flex items-center justify-center shrink-0">
                <Search className="text-[var(--color-primary)] w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-[var(--color-on-surface)]">Job Radar</h2>
                <p className="text-sm text-[var(--color-secondary)] mt-1">Scan markets for roles matching your exact CV profile.</p>
              </div>
            </div>

            {/* Preferences indicator */}
            {userProfile?.target_roles?.length ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--color-surface-container-low)] rounded-xl p-4 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-[var(--color-secondary)]">
                    Target: <span className="text-[var(--color-on-surface)] font-bold">{userProfile.target_roles.join(", ")}</span>
                  </span>
                </div>
                <a href="/dashboard/preferences" className="text-xs text-[var(--color-primary)] font-bold hover:underline">Edit Params</a>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-[var(--color-error-container)]/50 rounded-xl p-4">
                <span className="text-sm text-[var(--color-error)] font-medium">Define target roles to begin.</span>
                <a href="/dashboard/preferences" className="text-xs font-bold shrink-0 text-[var(--color-error)] hover:underline">Setup &rarr;</a>
              </div>
            )}

            {searchError && (
              <div className="bg-[var(--color-error-container)] text-[var(--color-error)] px-4 py-3 rounded-xl text-sm flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4" /> {searchError}
              </div>
            )}

            {/* Search button */}
            <button
               onClick={handleSearchJobs}
               disabled={isAnyProcessRunning || !userProfile?.target_roles?.length}
               className="w-full py-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] text-[var(--color-on-primary)] rounded-xl font-bold shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
             >
               {isSearching ? (
                 <>Initializing Radar <Loader2 className="w-5 h-5 animate-spin" /></>
               ) : (
                 <>Start Scanning <Search className="w-5 h-5" /></>
               )}
            </button>
            
            {/* Search progress */}
            {isSearching && (
              <div className="animate-pulse bg-[var(--color-primary-container)]/20 px-4 py-3 rounded-xl flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                <span className="text-[var(--color-primary)] font-medium text-sm">Matching job boards against CV matrix...</span>
              </div>
            )}
          </div>
        )}
      </div>

"""

with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(pre + new_ui + end_marker + post)

print("Injected Phase 4 fix successfully!")
