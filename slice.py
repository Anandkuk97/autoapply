import sys

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_content = """      {/* ═══════════════════════════════════════════════════════════ */}
      {/* STEP 2: SCORED JOB CARDS (Live JD Match + Recents)        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {scoredJobs.length > 0 && (
        <div className="space-y-8 max-w-xl mx-auto">
          
          {/* Top Job / Current JD Card */}
          {scoredJobs[0] && (() => {
            const job = scoredJobs[0];
            const prog = jobProgress[job.id];
            const isProcessing = prog && !['idle', 'done', 'error'].includes(prog.status);
            const isDone = prog?.status === 'done';

            return (
              <section className="relative overflow-hidden rounded-xl bg-[var(--color-surface-container-low)] p-1 group">
                <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-sm border border-[var(--color-outline-variant)]/30 p-6 space-y-6">
                  {/* Scan Overlay while processing */}
                  {isProcessing && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="scanner-line"></div>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-primary-container)]/20 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-wider rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
                        Top Match
                      </span>
                      <h3 className="text-2xl font-bold text-[var(--color-on-surface)] mt-3">{job.title}</h3>
                      <p className="text-[var(--color-primary)] font-medium">at {job.company}</p>
                    </div>
                    <div className="w-14 h-14 bg-[var(--color-surface-container)] flex items-center justify-center rounded-xl border border-[var(--color-outline-variant)]/20">
                      <Sparkles className="text-[var(--color-primary)] w-8 h-8" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="bg-[var(--color-surface-container-low)] rounded-xl p-4 border border-[var(--color-outline-variant)]/20">
                      <p className="text-[var(--color-secondary)] text-[11px] uppercase tracking-widest font-bold">Matching</p>
                      <p className="text-xl font-bold text-[var(--color-on-surface)]">{job.cvMatchScore}%</p>
                    </div>
                    <div className="bg-[var(--color-surface-container-low)] rounded-xl p-4 border border-[var(--color-outline-variant)]/20">
                      <p className="text-[var(--color-secondary)] text-[11px] uppercase tracking-widest font-bold">Projected</p>
                      <p className="text-xl font-bold text-[var(--color-on-surface)]">~{job.projectedScore}%</p>
                    </div>
                  </div>

                  {isDone && prog?.result?.application ? (
                    <button
                      onClick={() => router.push('/dashboard/apply/' + prog.result.application.id)}
                      className="w-full py-5 bg-[var(--color-surface-container)] text-[var(--color-primary)] rounded-xl font-bold active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 border border-[var(--color-outline-variant)]/20 hover:bg-[var(--color-surface-container-high)]"
                    >
                      View Generated Application <ArrowRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => generateForJob(job, 'auto')}
                      disabled={isAnyProcessRunning}
                      className="w-full py-5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-container)] text-[var(--color-on-primary)] rounded-xl font-bold shadow-[0_10px_25px_rgba(0,109,54,0.3)] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 hover:scale-[1.02]"
                    >
                      {isProcessing ? genStepLabel[prog!.status] : "Start Tailoring"}
                      {!isProcessing && <Sparkles className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Recently Detected list (rest of the top jobs) */}
          {scoredJobs.length > 1 && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-[var(--color-on-surface)]">Recently Detected</h3>
                <span className="text-[var(--color-primary)] text-sm font-semibold hover:underline cursor-pointer">{scoredJobs.length - 1} more jobs</span>
              </div>
              <div className="space-y-3">
                {scoredJobs.slice(1).map((job) => {
                  const prog = jobProgress[job.id];
                  const isDone = prog?.status === 'done';

                  return (
                    <div key={job.id} className="group flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-outline-variant)]/20 rounded-xl shadow-sm hover:bg-[var(--color-surface-container-low)] transition-colors duration-200">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-[var(--color-surface-container-highest)] rounded-xl flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-[var(--color-surface-container)] transition-colors">
                          <Building2 className="w-6 h-6 text-[var(--color-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-bold text-[var(--color-on-surface)] text-sm truncate">{job.title}</p>
                          <p className="text-xs text-[var(--color-secondary)] flex items-center gap-2 truncate">
                            {job.company} • {job.cvMatchScore}% Match
                            {isDone && <CheckCircle2 className="w-3 h-3 text-[var(--color-primary)] shrink-0" />}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => generateForJob(job, 'auto')}
                        disabled={isAnyProcessRunning}
                        className="w-10 h-10 flex items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] bg-[var(--color-surface-container)] hover:bg-[var(--color-primary-container)]/20 rounded-xl transition-all disabled:opacity-30 disabled:hover:text-[var(--color-secondary)] shrink-0 active:scale-95"
                      >
                        <Zap className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stats Bento */}
          <section className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-[var(--color-outline-variant)]/20">
            <div className="bg-[var(--color-surface-container-highest)]/40 backdrop-blur-md rounded-xl p-5 space-y-2 border border-[var(--color-outline-variant)]/30 group hover:border-[var(--color-primary)]/50 transition-colors">
              <BarChart2 className="w-6 h-6 text-[var(--color-tertiary)] group-hover:drop-shadow-md" />
              <p className="text-3xl font-extrabold text-[var(--color-on-surface)]">{totalJobsFound}</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-secondary)]">Jobs Detected</p>
            </div>
            <div className="bg-[var(--color-surface-container-highest)]/40 backdrop-blur-md rounded-xl p-5 space-y-2 border border-[var(--color-outline-variant)]/30 group hover:border-[var(--color-primary)]/50 transition-colors">
              <Zap className="w-6 h-6 text-[var(--color-primary)] group-hover:drop-shadow-md" />
              <p className="text-3xl font-extrabold text-[var(--color-on-surface)]">{applications.length}</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-secondary)]">Tailored Apps</p>
            </div>
          </section>

        </div>
      )}
"""

final_content = ''.join(lines[:807]) + new_content + ''.join(lines[1258:])
with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(final_content)
