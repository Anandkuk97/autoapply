import sys
import re

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We will replace from STEP 2 & 3: SCORED JOB CARDS down to the end of the Job Cards block.
# Finding the block
start_marker = "{/* STEP 2 & 3: SCORED JOB CARDS                              */}"
end_marker = "      {/* ═══════════════════════════════════════════════════════════ */}\n      {/* VIEW APPLICATION MODAL                                     */}"

if start_marker not in content:
    print("Start marker not found")
    sys.exit(1)

if end_marker not in content:
    print("End marker not found")
    sys.exit(1)

pre, rest = content.split(start_marker, 1)
middle, post = rest.split(end_marker, 1)

new_ui = """{/* STEP 2: SCORED JOB CARDS (Live JD Match + Recents) */}
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
              <section className="relative overflow-hidden rounded-xl bg-[var(--color-surface-container-low)] p-1 group shadow-sm border border-[var(--color-outline-variant)]/20">
                <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface-container-lowest)] p-6 space-y-6">
                  {/* Scan Overlay while processing */}
                  {isProcessing && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="scanner-line"></div>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-primary-container)]/20 text-[var(--color-primary-fixed-variant)] text-[10px] font-bold uppercase tracking-wider rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                        Live Detection
                      </span>
                      <h3 className="text-2xl font-bold text-[var(--color-on-surface)] mt-3">{job.title}</h3>
                      <p className="text-[var(--color-primary)] font-medium">at {job.company}</p>
                    </div>
                    <div className="w-14 h-14 bg-[var(--color-surface-container)] flex items-center justify-center rounded-xl text-[var(--color-primary)]">
                       <Terminal className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="bg-[var(--color-surface-container-low)] rounded-xl p-4 border border-[var(--color-outline-variant)]/30">
                      <p className="text-[var(--color-secondary)] text-[11px] uppercase tracking-widest font-bold">Matching</p>
                      <p className="text-xl font-bold text-[var(--color-on-surface)]">{job.cvMatchScore}%</p>
                    </div>
                    <div className="bg-[var(--color-surface-container-low)] rounded-xl p-4 border border-[var(--color-outline-variant)]/30">
                      <p className="text-[var(--color-secondary)] text-[11px] uppercase tracking-widest font-bold">Projected</p>
                      <p className="text-xl font-bold text-[var(--color-on-surface)]">~{job.projectedScore}%</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTailorSelected('auto')}
                    disabled={isProcessing || isGenerating}
                    className="w-full py-5 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-xl font-bold shadow-lg shadow-[var(--color-primary-fixed)]/20 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    Start Tailoring ({selectedJobs.size} Selected)
                    <Sparkles className="w-5 h-5" />
                  </button>
                </div>
              </section>
            );
          })()}

          {/* Recently Detected Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight text-[var(--color-on-surface)]">Recently Detected</h3>
              <button 
                onClick={toggleSelectAll} 
                className="text-[var(--color-primary)] text-sm font-semibold hover:underline"
              >
                {selectedJobs.size === scoredJobs.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-3">
              {scoredJobs.slice(1).map((job) => {
                 const isSelected = selectedJobs.has(job.id);
                 return (
                   <div key={job.id} onClick={() => toggleJobSelection(job.id)} className="group cursor-pointer flex items-center justify-between p-4 bg-[var(--color-surface-container-lowest)] rounded-xl shadow-sm border border-[var(--color-outline-variant)]/20 hover:bg-[var(--color-surface-container-low)] transition-colors duration-200">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-xl flex items-center justify-center text-[var(--color-primary)]">
                         {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                       </div>
                       <div>
                         <p className="font-bold text-[var(--color-on-surface)]">{job.title}</p>
                         <p className="text-sm text-[var(--color-secondary)]">{job.company} • {job.cvMatchScore}% Match</p>
                       </div>
                     </div>
                     <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[var(--color-primary)] transition-colors" />
                   </div>
                 );
              })}
            </div>
          </section>

          {/* Stats Bento Section */}
          <section className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-[var(--color-surface-container-highest)]/40 backdrop-blur-md rounded-xl p-5 space-y-2 border border-[var(--color-outline-variant)]/20">
              <BarChart2 className="w-6 h-6 text-[var(--color-tertiary)]" />
              <p className="text-3xl font-extrabold text-[var(--color-on-surface)]">{scoredJobs.length}</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-secondary)]">Jobs Detected</p>
            </div>
            <div className="bg-[var(--color-surface-container-highest)]/40 backdrop-blur-md rounded-xl p-5 space-y-2 border border-[var(--color-outline-variant)]/20">
              <Zap className="w-6 h-6 text-[var(--color-primary)]" />
              <p className="text-3xl font-extrabold text-[var(--color-on-surface)]">~1.2s</p>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-secondary)]">Avg Latency</p>
            </div>
          </section>
        </div>
      )}

"""

with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(pre + new_ui + end_marker + post)

print("Injected Phase 2 UI successfully!")
