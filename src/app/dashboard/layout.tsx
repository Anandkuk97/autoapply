import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { DashboardNav } from "@/components/DashboardNav";
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
    <div className="obsidian-glass min-h-[100dvh] font-sans antialiased text-[var(--color-on-surface)] pb-32">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="flex justify-between items-center px-6 h-20 w-full max-w-7xl mx-auto">

          <Link href="/dashboard" className="flex items-center gap-3 active:scale-95 transition-transform">
            <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center text-[var(--color-primary)]">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <span className="text-xl font-black tracking-tighter text-[var(--color-on-surface)]">
              AutoApply.
            </span>
          </Link>

          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end text-right mr-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-secondary)] opacity-50">Authorized</span>
               <span className="text-sm font-bold text-[var(--color-on-surface)] leading-tight">{profile?.name || user.email?.split('@')[0]}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-[var(--color-surface-container-highest)] flex items-center justify-center overflow-hidden border border-[var(--color-outline-variant)]/30 group shadow-inner">
                <Link href="/dashboard/profile" className="w-full h-full flex items-center justify-center hover:bg-[var(--color-primary)]/10 transition-colors">
                  <User className="w-5 h-5 text-[var(--color-primary)]" />
                </Link>
             </div>
             <div className="h-6 w-px bg-[var(--color-outline-variant)]/50 mx-2" />
             <SignOutButton />
          </div>
        </div>
      </header>

      <main className="pt-32 px-6 max-w-7xl mx-auto">
        {children}
      </main>

      <DashboardNav />
    </div>
  );
}

