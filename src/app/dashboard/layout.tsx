import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="w-full px-6 py-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-center bg-white/5 backdrop-blur-md sticky top-0 z-50 gap-4 md:gap-0">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[var(--color-primary)] w-5 h-5" />
            <Link href="/" className="font-heading text-xl font-bold text-white">
              AutoApply
            </Link>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-gray-300 hover:text-white transition">Dashboard</Link>
            <Link href="/dashboard/profile" className="text-gray-300 hover:text-white transition">CV & Profile</Link>
            <Link href="/dashboard/preferences" className="text-gray-300 hover:text-white transition">Preferences</Link>
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-gray-400 text-sm hidden sm:inline">
            Hello, <strong className="text-white font-medium">{profile?.name || user.email}</strong>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
