import sys

with open('d:/autoapply/src/app/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I want to add a "History" section inside the scoredJobs.length === 0 block
target = """            </div>
          </div>
        )}"""

history_section = """            </div>
          </div>
        )}

        {/* HISTORICAL DETECTIONS (Visible when no active search results) */}
        {scoredJobs.length === 0 && applications.length > 0 && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
            <div className="flex items-end justify-between px-2">
              <h3 className="text-2xl font-black text-[var(--color-on-surface)] tracking-tighter">History.</h3>
              <p className="text-xs font-bold text-[var(--color-secondary)] uppercase tracking-widest opacity-50">{applications.length} Saved</p>
            </div>

            <div className="grid gap-4">
              {applications.slice(0, 5).map((app) => (
                <Link 
                  key={app.id} 
                  href={`/dashboard/apply/${app.id}`}
                  className="group flex items-center justify-between p-6 bg-[var(--color-surface-container-lowest)] rounded-[2rem] border border-[var(--color-outline-variant)]/10 shadow-sm hover:shadow-2xl hover:bg-[var(--color-surface-container-low)] transition-all duration-500"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/10 flex items-center justify-center text-[var(--color-primary)] transition-transform group-hover:scale-110">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-[var(--color-on-surface)] text-lg leading-tight">{app.role}</p>
                      <p className="text-sm text-[var(--color-secondary)] font-bold tracking-tight mt-1">{app.company} <span className="opacity-30 mx-2">|</span> {app.status}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-[var(--color-secondary)] opacity-10 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </section>
        )}"""

if target in content:
    content = content.replace(target, history_section)
    with open('d:/autoapply/src/app/dashboard/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected History section successfully!")
else:
    print("Target not found for history injection.")
