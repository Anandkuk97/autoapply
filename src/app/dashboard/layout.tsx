import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { Grid, Target, Sparkles, BarChart2, PenLine, User } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  return (
    <div className="obsidian-glass min-h-[100dvh] bg-[var(--color-background)] font-sans antialiased text-[var(--color-on-surface)] pb-32">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[var(--color-surface)]/70 backdrop-blur-xl shadow-sm border-b border-[var(--color-surface-dim)]/50">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-3 active:scale-95 transition-transform">
            <Sparkles className="text-[var(--color-primary)] w-6 h-6" />
            <span className="text-xl font-extrabold tracking-tighter text-[var(--color-on-surface)]">
              AutoApply
            </span>
          </Link>

          <div className="flex items-center gap-4">
             <span className="text-[var(--color-secondary)] text-sm hidden sm:inline font-medium tracking-tight">
               Hello, {profile?.name || user.email}
             </span>
             <div className="w-10 h-10 rounded-full bg-[var(--color-surface-container-highest)] flex items-center justify-center overflow-hidden border border-[var(--color-outline-variant)]/30 group">
                <Link href="/dashboard/profile" className="w-full h-full flex items-center justify-center hover:bg-[var(--color-primary)]/10 transition-colors">
                  <User className="w-5 h-5 text-[var(--color-primary)]" />
                </Link>
             </div>
             <SignOutButton />
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-7xl mx-auto">
        {children}
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[var(--color-surface)]/80 backdrop-blur-2xl shadow-[0_-10px_40px_rgba(21,28,39,0.06)] z-50 rounded-t-[2rem] border-t border-[var(--color-surface-dim)]/50">
        <Link href="/dashboard" className="flex flex-col items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-all active:scale-90 duration-300 ease-out group">
          <Target className="mb-1 w-6 h-6 group-hover:drop-shadow-md" />
          <span className="text-[11px] font-medium uppercase tracking-widest">Detect</span>
        </Link>
        <Link href="/dashboard/apply" className="flex flex-col items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] px-5 py-2 active:scale-90 transition-transform duration-300 ease-out group">
          <Sparkles className="mb-1 w-6 h-6 group-hover:drop-shadow-md" />
          <span className="text-[11px] font-medium uppercase tracking-widest">Tailor</span>
        </Link>
        <div className="flex flex-col items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] px-5 py-2 active:scale-90 transition-transform duration-300 ease-out group opacity-50 cursor-not-allowed cursor-help" title="Coming Soon">
          <BarChart2 className="mb-1 w-6 h-6" />
          <span className="text-[11px] font-medium uppercase tracking-widest">Scores</span>
        </div>
        <div className="flex flex-col items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-primary)] px-5 py-2 active:scale-90 transition-transform duration-300 ease-out group opacity-50 cursor-not-allowed cursor-help" title="Coming Soon">
          <PenLine className="mb-1 w-6 h-6" />
          <span className="text-[11px] font-medium uppercase tracking-widest">Apply</span>
        </div>
      </nav>
    </div>
  );
}
