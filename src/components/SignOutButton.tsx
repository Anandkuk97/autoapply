"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button 
      onClick={handleSignOut}
      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  );
}
