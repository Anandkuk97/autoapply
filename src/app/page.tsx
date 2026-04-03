"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Utility helpers ───────────────────────────────────────────────────────────

const easeOut = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: easeOut },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({
  target,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) motionVal.set(target);
  }, [inView, motionVal, target]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      setDisplay(
        decimals > 0
          ? v.toFixed(decimals)
          : Math.round(v).toLocaleString()
      );
    });
    return unsub;
  }, [spring, decimals]);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

// ─── Section wrapper with scroll reveal ────────────────────────────────────────

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ─── NAV ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Detect session without touching it — never signs the user out
  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        setLoggedIn(!!data.session?.user);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setLoggedIn(!!session?.user);
      });
      return () => listener.subscription.unsubscribe();
    });
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#08080A]/90 backdrop-blur-md border-b border-white/5" : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-[#F5C518] rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L8 4l6 8H2z" fill="#08080A" />
            </svg>
          </div>
          <span className="font-bold text-white text-[15px] tracking-tight">AutoApply</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {["Features", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold bg-[#F5C518] text-[#08080A] px-4 py-2 rounded-full hover:bg-[#f5c518]/90 transition-all hover:scale-[1.03] active:scale-95"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold bg-[#F5C518] text-[#08080A] px-4 py-2 rounded-full hover:bg-[#f5c518]/90 transition-all hover:scale-[1.03] active:scale-95"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button
          className="md:hidden text-white/70 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <div className="w-6 h-4 flex flex-col justify-between">
            <span className={`h-0.5 bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
            <span className={`h-0.5 bg-current transition-all ${mobileOpen ? "opacity-0 scale-x-0" : ""}`} />
            <span className={`h-0.5 bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2.5" : ""}`} />
          </div>
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0e0e10] border-t border-white/5 px-6 pb-6 space-y-4"
          >
            {["Features", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className="block text-white/70 hover:text-white py-2"
              >
                {item}
              </a>
            ))}
            {loggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block text-center font-semibold bg-[#F5C518] text-[#08080A] px-4 py-2.5 rounded-full"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <Link
                href="/signup"
                className="block text-center font-semibold bg-[#F5C518] text-[#08080A] px-4 py-2.5 rounded-full"
              >
                Get Started Free
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center pt-20 pb-16 px-6 overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[#F5C518]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-[#F5C518]/10 border border-[#F5C518]/20 rounded-full px-4 py-1.5 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
          <span className="text-xs font-medium text-[#F5C518]">10,000+ job seekers automated their search</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.1] tracking-tight mb-4"
        >
          Stop applying manually.
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-normal italic leading-[1.1] tracking-tight mb-8"
          style={{ fontFamily: "var(--font-instrument-serif)", color: "#F5C518" }}
        >
          Start waking up to interviews.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-base sm:text-lg text-white/50 mb-10 max-w-lg mx-auto"
        >
          Join 10,000+ job seekers automating their search with AutoApply.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            id="hero-cta"
            className="group inline-flex items-center gap-2 bg-[#F5C518] text-[#08080A] font-semibold text-base px-7 py-3.5 rounded-full hover:bg-[#f5c518]/90 transition-all hover:scale-[1.03] active:scale-95 shadow-lg shadow-[#F5C518]/20"
          >
            Start Applying Free — No Card Required
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent animate-pulse" />
      </motion.div>
    </section>
  );
}

// ─── METRICS ───────────────────────────────────────────────────────────────────

function MetricCard({
  value,
  suffix,
  prefix,
  label,
  decimals = 0,
  delay,
}: {
  value: number;
  suffix: string;
  prefix: string;
  label: string;
  decimals?: number;
  delay: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start lg:items-center text-left lg:text-center px-0 lg:px-10"
    >
      <div className="text-4xl sm:text-5xl font-black text-[#F5C518] tracking-tight leading-none mb-2">
        <AnimatedNumber target={value} suffix={suffix} prefix={prefix} decimals={decimals} />
      </div>
      <p className="text-sm text-white/40 font-medium">{label}</p>
    </motion.div>
  );
}

function Metrics() {
  const metrics = [
    { value: 142000, suffix: "+", label: "Applications submitted", prefix: "" },
    { value: 94, suffix: "%", label: "ATS pass rate", prefix: "" },
    { value: 3.2, suffix: "x", label: "More interviews", prefix: "", decimals: 1 },
    { value: 8, suffix: " min", label: "Average setup time", prefix: "" },
  ];

  return (
    <section className="py-20 border-y border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-white/10">
          {metrics.map((m, i) => (
            <MetricCard
              key={m.label}
              value={m.value}
              suffix={m.suffix}
              prefix={m.prefix}
              label={m.label}
              decimals={m.decimals ?? 0}
              delay={i * 0.12}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SOCIAL PROOF ──────────────────────────────────────────────────────────────

function SocialProof() {
  const platforms = ["LinkedIn", "Indeed", "Reed", "Glassdoor", "Totaljobs", "CV-Library"];
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="py-20">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold tracking-[0.2em] text-white/30 uppercase mb-8"
        >
          Works on every major job platform
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {platforms.map((p, i) => (
            <motion.span
              key={p}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-white/25 hover:text-white/50 transition-colors text-sm font-medium cursor-default"
            >
              {p}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FEATURES ──────────────────────────────────────────────────────────────────

const featureIcons = [
  // AI CV Tailoring
  <svg key="ai" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#F5C518]">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // Match Scoring
  <svg key="match" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#00E676]">
    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // Auto-Apply
  <svg key="auto" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#F5C518]">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // Cover Letters
  <svg key="cover" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#00E676]">
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // Dashboard Analytics
  <svg key="dash" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#F5C518]">
    <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  // Interview Prep AI
  <svg key="interview" width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#00E676]">
    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
];

function Features() {
  const features = [
    {
      title: "AI CV Tailoring",
      desc: "Every CV is rewritten for the specific role — matching keywords, reordering achievements, adjusting tone. Not a template swap. A real rewrite.",
    },
    {
      title: "Match Scoring",
      desc: "See your match score before and after tailoring. Only applies to roles above 70% — quality over quantity, every time.",
    },
    {
      title: "Auto-Apply",
      desc: "Set your preferences, go to sleep. AutoApply finds matching roles, tailors your CV, writes a cover letter, and submits — overnight.",
    },
    {
      title: "AI Cover Letters",
      desc: "Every application gets a bespoke cover letter — grounded in the job description, written in your voice, not a generic template.",
    },
    {
      title: "Dashboard Analytics",
      desc: "Track every application, see open rates, monitor interview conversions, and understand what's working — all in one place.",
    },
    {
      title: "Interview Prep AI",
      desc: "Get role-specific interview questions, model answers based on your CV, and coaching tips — the night before your interview.",
    },
  ];

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <Section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16">
          <motion.p variants={fadeUp} className="text-xs font-semibold tracking-[0.2em] text-[#F5C518] uppercase mb-4">
            How it works
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            Your AI job application{" "}
            <span
              className="italic font-normal block"
              style={{ fontFamily: "var(--font-instrument-serif)", color: "white" }}
            >
              team, working overnight
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-white/40 max-w-lg text-base">
            Three intelligent systems working together — so you spend 10 minutes setting up and wake up to results.
          </motion.p>
        </div>

        {/* Cards */}
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
              className="group relative bg-[#111113] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 hover:bg-[#141416] transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#1a1a1e] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                {featureIcons[i]}
              </div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── TESTIMONIALS ──────────────────────────────────────────────────────────────

function Testimonials() {
  const testimonials = [
    {
      quote: (
        <>
          "I applied to 43 roles in one night. Got 6 interview requests in 3 days. I'd been applying manually for 2 months and got{" "}
          <strong className="text-white">nothing</strong>."
        </>
      ),
      name: "Sarah R.",
      role: "Marketing Manager, London",
      initials: "SR",
      color: "#F5C518",
    },
    {
      quote: (
        <>
          "The CV tailoring is genuinely impressive. It's not just keyword stuffing — it{" "}
          <strong className="text-white">restructures your entire CV</strong> for the role. Completely different quality."
        </>
      ),
      name: "James K.",
      role: "Software Engineer, Manchester",
      initials: "JK",
      color: "#00E676",
    },
    {
      quote: (
        <>
          "Set it up on Sunday night. By Tuesday morning I had 4 interviews booked. I haven't manually written a cover letter since.{" "}
          <strong className="text-white">Never going back.</strong>"
        </>
      ),
      name: "Anika P.",
      role: "Finance Analyst, Birmingham",
      initials: "AP",
      color: "#7C3AED",
    },
  ];

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <Section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.p variants={fadeUp} className="text-xs font-semibold tracking-[0.2em] text-[#F5C518] uppercase mb-4">
            What job seekers say
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-white">
            Results people are seeing
          </motion.h2>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="bg-[#111113] border border-white/[0.06] rounded-2xl p-7 flex flex-col gap-6 hover:border-white/10 transition-all duration-300"
            >
              {/* Quote */}
              <p className="text-sm text-white/60 leading-relaxed flex-1">{t.quote}</p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#08080A] shrink-0"
                  style={{ backgroundColor: t.color }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/30">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── PRICING ───────────────────────────────────────────────────────────────────

function Pricing() {
  const tiers = [
    {
      name: "Free",
      tagline: "Try it out, see the quality",
      price: "0",
      period: "/month",
      features: [
        "5 applications per month",
        "Basic CV tailoring",
        "Job match scoring",
        "Email support",
      ],
      cta: "Get Started",
      ctaStyle: "outline",
      popular: false,
    },
    {
      name: "Pro",
      tagline: "For active job seekers",
      price: "7.99",
      period: "/month",
      features: [
        "50 applications per month",
        "Advanced CV tailoring",
        "Cover letter generation",
        "Priority matching",
        "Dashboard analytics",
      ],
      cta: "Start Pro",
      ctaStyle: "gold",
      popular: false,
    },
    {
      name: "Premium",
      tagline: "Maximum job search velocity",
      price: "16.99",
      period: "/month",
      features: [
        "Unlimited applications",
        "AI cover letters",
        "LinkedIn auto-submit",
        "Real-time tracking",
        "Interview prep AI",
        "Priority support",
      ],
      cta: "Go Premium",
      ctaStyle: "green",
      popular: true,
    },
    {
      name: "Enterprise",
      tagline: "For recruitment teams",
      price: "39.99",
      period: "/user/mo",
      features: [
        "Everything in Premium",
        "Team accounts (5 seats)",
        "API access",
        "Custom integrations",
        "Dedicated account manager",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      ctaStyle: "outline",
      popular: false,
    },
  ];

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <Section id="pricing" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.p variants={fadeUp} className="text-xs font-semibold tracking-[0.2em] text-[#F5C518] uppercase mb-4">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-black text-white mb-2">
            Simple, honest pricing.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-4xl sm:text-5xl italic font-normal mb-6"
            style={{ fontFamily: "var(--font-instrument-serif)", color: "white" }}
          >
            Cancel anytime.
          </motion.p>
          <motion.p variants={fadeUp} custom={3} className="text-sm text-white/40">
            No credit card required to start. Upgrade when you're ready.
          </motion.p>
        </div>

        {/* Cards */}
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-2xl p-6 border transition-all duration-300 ${
                tier.popular
                  ? "bg-[#0f1a13] border-[#00E676]/30 ring-1 ring-[#00E676]/20"
                  : "bg-[#111113] border-white/[0.06] hover:border-white/10"
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#00E676] text-[#08080A] text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <p className="text-sm font-bold text-white mb-0.5">{tier.name}</p>
                <p className="text-xs text-white/30">{tier.tagline}</p>
              </div>

              {/* Price */}
              <div className="flex items-end gap-1 mb-6">
                <span className="text-2xl font-bold text-white">£</span>
                <span className="text-5xl font-black text-white leading-none">{tier.price}</span>
                <span className="text-xs text-white/30 mb-1">{tier.period}</span>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg
                      className="w-3.5 h-3.5 mt-0.5 shrink-0"
                      viewBox="0 0 14 14"
                      fill="none"
                      style={{ color: tier.popular ? "#00E676" : "#F5C518" }}
                    >
                      <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-xs text-white/50">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={tier.name === "Enterprise" ? "/contact" : "/signup"}
                id={`pricing-cta-${tier.name.toLowerCase()}`}
                className={`block text-center text-sm font-bold py-2.5 px-4 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  tier.ctaStyle === "green"
                    ? "bg-[#00E676] text-[#08080A] hover:bg-[#00E676]/90 shadow-lg shadow-[#00E676]/20"
                    : tier.ctaStyle === "gold"
                    ? "bg-[#F5C518] text-[#08080A] hover:bg-[#F5C518]/90 shadow-lg shadow-[#F5C518]/20"
                    : "bg-transparent border border-white/15 text-white hover:border-white/30 hover:bg-white/5"
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── FINAL CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="py-28 px-6 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#F5C518]/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold tracking-[0.2em] text-[#F5C518] uppercase mb-5"
        >
          Ready to automate your job search?
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-4"
        >
          Start tonight. Wake up to interviews.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, delay: 0.2 }}
          className="text-white/40 mb-10 text-base"
        >
          Join 10,000+ job seekers who stopped applying manually.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Link
            href="/signup"
            id="final-cta-button"
            className="group inline-flex items-center gap-2 bg-[#F5C518] text-[#08080A] font-bold text-base px-8 py-4 rounded-full hover:bg-[#f5c518]/90 transition-all hover:scale-[1.04] active:scale-95 shadow-xl shadow-[#F5C518]/20"
          >
            Start Applying Free — No Card Required
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FOOTER ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#F5C518] rounded-md flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L8 4l6 8H2z" fill="#08080A" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">AutoApply</span>
        </Link>

        {/* Links */}
        <nav className="flex items-center gap-6">
          {["Features", "Pricing", "Privacy", "Terms", "Contact"].map((l) => (
            <a
              key={l}
              href={l === "Features" || l === "Pricing" ? `#${l.toLowerCase()}` : "#"}
              className="text-xs text-white/25 hover:text-white/60 transition-colors"
            >
              {l}
            </a>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-xs text-white/20">© 2026 AutoApply. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#08080A] text-white overflow-x-hidden">
      <Nav />
      <Hero />
      <Metrics />
      <SocialProof />
      <Features />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </main>
  );
}
