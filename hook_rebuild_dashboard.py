import sys

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Target the entire return block for a complete rewrite to handle the 'History' state better
start_marker = "  return ("
end_marker = "      {/* TAILORING OPTIONS MODAL */}"

if start_marker not in content or end_marker not in content:
    print("Markers not found!")
    sys.exit(1)

pre, rest = content.split(start_marker, 1)
middle, post = rest.split(end_marker, 1)

new_return = """  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">

      <div className="max-w-2xl mx-auto space-y-10">
        
        {/* HEADER SECTION */}
        <header className="space-y-2 text-center sm:text-left">
          <h2 className="text-[4rem] font-extrabold leading-[1] tracking-tighter text-[var(--color-on-surface)]">
            {isSearching ? "Scanning." : scoredJobs.length > 0 ? "Detected." : "Monitor."}
          </h2>
          <p className="text-[var(--color-secondary)] text-[12px] tracking-[0.2em] uppercase font-bold opacity-70">
            {isSearching ? "Neural Network Active" : "Universal Job Detection Engine"}
          </p>
        </header>

        {/* SEARCH & EMPTY STATE BENTO */}
        {scoredJobs.length === 0 && (
          <div className="grid grid-cols-1 gap-6">
            <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/20 p-8 rounded-[2.5rem] shadow-xl shadow-[var(--color-primary)]/5 space-y-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-3xl bg-[var(--color-surface-container-low)] flex items-center justify-center shrink-0 border border-[var(--color-outline-variant)]/10">
                  <Search className="text-[var(--color-primary)] w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-on-surface)] tracking-tight">Market Radar</h2>
                  <p className="text-sm text-[var(--color-secondary)] font-medium">Scanning local and global boards for {userProfile?.target_roles?.[0] || "your role"}.</p>
                </div>
              </div>

              {/* Preferences bar */}
              <div className="bg-[var(--color-surface-container-low)] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[var(--color-outline-variant)]/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-cta)] animate-pulse" />
                  <span className="text-sm font-semibold text-[var(--color-on-surface-variant)]">
                    {userProfile?.target_roles?.length 
                      ? `${userProfile.target_roles.join(", ")}`
                      : "No preferences set"}
                  </span>
                </div>
                <Link href="/dashboard/preferences" className="text-xs font-bold text-[var(--color-primary)] hover:underline uppercase tracking-widest">
                  Configure Params
                </Link>
              </div>

              <button
                onClick={handleSearchJobs}
                disabled={isAnyProcessRunning || !userProfile?.target_roles?.length}
                className="w-full h-20 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] text-[var(--color-on-primary)] rounded-3xl font-black text-xl shadow-2xl shadow-[var(--color-primary)]/30 active:scale-95 transition-all duration-500 flex items-center justify-center gap-4 disabled:opacity-30 group"
              >
                {isSearching ? (
                  <>SCANNIG... <Loader2 className="w-6 h-6 animate-spin" /></>
                ) : (
                  <>START ENGINE <Zap className="w-6 h-6 group-hover:fill-current" /></>
                )}
              </button>
            </section>

            {/* Quick Stats Bento */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[var(--color-surface-container-low)] p-6 rounded-[2rem] border border-[var(--color-outline-variant)]/10">
                <FileText className="w-6 h-6 text-[var(--color-primary)] mb-3" />
                <p className="text-3xl font-black text-[var(--color-on-surface)]">{applications.length}</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-secondary)]">Historical Matches</p>
              </div>
              <div className="bg-[var(--color-surface-container-low)] p-6 rounded-[2rem] border border-[var(--color-outline-variant)]/10">
                <TrendingUp className="w-6 h-6 text-[var(--color-cta)] mb-3" />
                <p className="text-3xl font-black text-[var(--color-on-surface)]">{hitRate}%</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-secondary)]">Alignment Score</p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS: LIVE DETECTION CARD */}
        {scoredJobs.length > 0 && (
          <div className="space-y-12">
            <section className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-cta)] rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-[var(--color-surface-container-lowest)] rounded-[2.5rem] border border-[var(--color-outline-variant)]/20 p-8 shadow-2xl space-y-8 overflow-hidden">
                {/* SCANNER OVERLAY */}
                {isSearching && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-[var(--color-primary)] animate-[scan_2s_infinite] shadow-[0_0_15px_var(--color-primary)]" />
                )}

                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-[var(--color-primary)]/20">
                      Live Stream
                    </span>
                    <h3 className="text-3xl font-black text-[var(--color-on-surface)] leading-tight">{scoredJobs[0].title}</h3>
                    <p className="text-xl font-bold text-[var(--color-primary)] opacity-80">{scoredJobs[0].company}</p>
                  </div>
                  <div className="w-16 h-16 bg-[var(--color-surface-container-low)] rounded-3xl flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-outline-variant)]/10">
                    <Terminal className="w-8 h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-[var(--color-surface-container-low)] rounded-2xl p-6 border border-[var(--color-outline-variant)]/10">
                    <p className="text-[var(--color-secondary)] text-[10px] uppercase font-black tracking-widest mb-1">Match Index</p>
                    <p className="text-4xl font-black text-[var(--color-on-surface)]">{scoredJobs[0].cvMatchScore}%</p>
                  </div>
                  <div className="bg-[var(--color-surface-container-low)] rounded-2xl p-6 border border-[var(--color-outline-variant)]/10">
                    <p className="text-[var(--color-secondary)] text-[10px] uppercase font-black tracking-widest mb-1">Projected</p>
                    <p className="text-4xl font-black text-[var(--color-on-surface)]">~{scoredJobs[0].projectedScore}%</p>
                  </div>
                </div>

                <button
                  onClick={() => generateForJob(scoredJobs[0], 'auto')}
                  className="w-full h-20 bg-[var(--color-on-surface)] text-[var(--color-surface)] rounded-3xl font-black text-lg flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all duration-300"
                >
                  INITIALIZE TAILORING <Sparkles className="w-6 h-6" />
                </button>
              </div>
            </section>

            {/* RECENTLY DETECTED LIST */}
            <section className="space-y-8">
              <div className="flex items-end justify-between px-2">
                <h3 className="text-2xl font-black text-[var(--color-on-surface)] tracking-tighter">Queue.</h3>
                <button onClick={toggleSelectAll} className="text-[var(--color-primary)] text-sm font-bold tracking-widest uppercase hover:opacity-70 transition">
                  {selectedJobs.size === scoredJobs.length ? "Deselect" : "Select All"}
                </button>
              </div>

              <div className="grid gap-4">
                {scoredJobs.slice(1, 5).map((job) => (
                  <div 
                    key={job.id} 
                    onClick={() => toggleJobSelection(job.id)}
                    className="group cursor-pointer flex items-center justify-between p-6 bg-[var(--color-surface-container-lowest)] rounded-[2rem] border border-[var(--color-outline-variant)]/10 shadow-sm hover:shadow-xl hover:bg-[var(--color-surface-container-low)] transition-all duration-500"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                        selectedJobs.has(job.id) ? "bg-[var(--color-primary)] border-transparent" : "bg-[var(--color-surface-container-low)] border-[var(--color-outline-variant)]/20"
                      }`}>
                        {selectedJobs.has(job.id) ? (
                          <Check className="w-7 h-7 text-[var(--color-on-primary)] stroke-[4px]" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border-2 border-[var(--color-secondary)] opacity-30" />
                        )}
                      </div>
                      <div>
                        <p className="font-black text-[var(--color-on-surface)] text-lg leading-tight">{job.title}</p>
                        <p className="text-sm text-[var(--color-secondary)] font-bold tracking-tight mt-1">{job.company} <span className="opacity-30 mx-2">|</span> {job.cvMatchScore}% Match</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-[var(--color-secondary)] opacity-10 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

      </div>
"""

with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(pre + new_return + end_marker + post)

print("Full Obsidian Glass Dashboard Reconstruction Complete!")
