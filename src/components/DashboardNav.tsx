"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, Sparkles, BarChart2, PenLine, Zap } from "lucide-react";

export function DashboardNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Detect", href: "/dashboard", icon: Target },
    { label: "Tailor", href: "/dashboard/tailor", icon: Sparkles },
    { label: "Forge", href: "/dashboard/forge", icon: PenLine },
    { label: "Scores", href: "/dashboard/scores", icon: BarChart2 },
    { label: "Apply", href: "/dashboard/history", icon: Zap },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-black/60 backdrop-blur-3xl rounded-t-[3.5rem] shadow-[0_-10px_80px_rgba(0,0,0,0.8)] border-t border-white/5 flex justify-around items-center px-4 pb-12 pt-6">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.label}
            href={item.href} 
            className={`flex flex-col items-center justify-center rounded-2xl px-6 py-2 transition-all active:scale-95 duration-300 group ${
              isActive 
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" 
                : "text-zinc-400 hover:text-[var(--color-primary)]"
            }`}
          >
            <Icon className={`mb-1 w-6 h-6 ${isActive ? "fill-current" : "group-hover:drop-shadow-md"}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
