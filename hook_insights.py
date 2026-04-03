import sys

with open('d:/autoapply/src/app/dashboard/apply/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

insights_ui = """
      {/* Optimization & Missing Skills (Insights) */}
      <section className="space-y-4 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-secondary)] px-2">AI Recalibration & Gap Analysis</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Optimization Deep Dive */}
          <div className="bg-[var(--color-surface-container-low)] rounded-3xl p-6 shadow-sm border border-[var(--color-outline-variant)]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--color-on-surface)]">Optimization Breakdown</h3>
                <p className="text-xs text-[var(--color-secondary)]">Experience & Skills adjustments</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Quantified impact with specific metrics</p>
              </div>
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Integrated 5 new leadership keywords from JD</p>
              </div>
              <div className="flex gap-3 items-start bg-[var(--color-surface-container)]/50 p-4 rounded-2xl">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)] mt-0.5" />
                <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">Matched 12/15 required core competencies</p>
              </div>
            </div>
          </div>

          {/* Missing Skills Analysis */}
          <div className="bg-[var(--color-surface-container-low)] rounded-3xl p-6 shadow-sm border border-[var(--color-outline-variant)]/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--color-on-surface)]">Missing Skills Gap</h3>
                <p className="text-xs text-[var(--color-secondary)]">Required competencies not found</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-[var(--color-surface-container)]/50 p-4 rounded-2xl border-l-4 border-amber-500">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[var(--color-on-surface)]">A/B Testing</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#15AE5C] bg-[#15AE5C]/10 px-2 py-0.5 rounded-full">High Priority</span>
                </div>
                <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
                  Data-driven design is heavily emphasized. Consider demonstrating experimentation validations.
                </p>
              </div>

              <div className="bg-[var(--color-surface-container)]/50 p-4 rounded-2xl border-l-4 border-amber-300">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[var(--color-on-surface)]">Micro-interactions</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Medium</span>
                </div>
                <p className="text-xs text-[var(--color-secondary)] leading-relaxed">
                  Recommended to highlight specifically in your portfolio or interview stages.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>
"""

if 'Optimization & Missing Skills (Insights)' not in content:
    content = content.replace('{/* Auto-fill & Application UI */}', insights_ui + '\n\n      {/* Auto-fill & Application UI */}')

with open('d:/autoapply/src/app/dashboard/apply/[id]/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Insights UI")
