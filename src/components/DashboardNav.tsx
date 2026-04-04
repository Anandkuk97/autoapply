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
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-50 bg-white/70 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_10px_50px_rgba(0,0,0,0.1)] border border-white/50 flex justify-around items-center px-4 py-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.label}
            href={item.href} 
            className={`flex flex-col items-center justify-center rounded-2xl px-5 py-2 transition-all active:scale-95 duration-300 group ${
              isActive 
                ? "text-[var(--color-primary)]" 
                : "text-slate-400 hover:text-slate-900"
            }`}
          >
            <Icon className={`mb-1 w-5 h-5 ${isActive ? "fill-current" : ""}`} />
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${isActive ? "text-[var(--color-primary)]" : "text-slate-400"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>

  );
}
