"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  PlayCircle, 
  ArrowLeftRight, 
  AlertTriangle, 
  Database, 
  ShieldCheck, 
  History, 
  MessageSquareCode, 
  TrendingDown,
  Cpu
} from "lucide-react";

interface NavItem {
  name: string;
  subtext: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: "ai" | "honest" | "live" | "eval";
}

const navItems: NavItem[] = [
  { 
    name: "Dashboard & Engine", 
    subtext: "Unified Command Center", 
    href: "/", 
    icon: LayoutDashboard,
    badge: "Primary",
    badgeColor: "live"
  },
  { 
    name: "Transactions", 
    subtext: "3-Way Multi-Source Ledger", 
    href: "/transactions", 
    icon: ArrowLeftRight 
  },
  { 
    name: "Exception Center", 
    subtext: "Honest Discrepancy Escalations", 
    href: "/exceptions", 
    icon: AlertTriangle, 
    badge: "Honest",
    badgeColor: "honest"
  },
  { 
    name: "Financial Leakage", 
    subtext: "Variance & Recovery Claims", 
    href: "/leakage", 
    icon: TrendingDown 
  },
  { 
    name: "Data Sources", 
    subtext: "Synthetic Batch Generator", 
    href: "/datasets", 
    icon: Database 
  },
  { 
    name: "Evaluation & Truth", 
    subtext: "Isolated Ground-Truth Score", 
    href: "/evaluation", 
    icon: ShieldCheck,
    badge: "Objective",
    badgeColor: "eval"
  },
  { 
    name: "Audit Trail", 
    subtext: "Immutable Operations Log", 
    href: "/audit", 
    icon: History 
  },
  { 
    name: "Ask the Controller", 
    subtext: "Grounded FinOps AI Assistant", 
    href: "/ask", 
    icon: MessageSquareCode, 
    badge: "Grounded",
    badgeColor: "ai"
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0B0F17] border-r border-slate-800/80 flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-lg group-hover:text-cyan-300 transition-colors">Recon.ai</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">AI Finance Controller</p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>Reconciliation Ops</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-start justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-slate-800/90 text-cyan-300 shadow-sm border border-slate-700/80"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold leading-tight text-slate-200">
                    {item.name}
                  </div>
                  <div className="truncate text-[10px] text-slate-400 leading-snug mt-0.5">
                    {item.subtext}
                  </div>
                </div>
              </div>
              {item.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ml-1.5 ${
                  item.badgeColor === "ai"
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                    : item.badgeColor === "honest"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                    : item.badgeColor === "eval"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                    : "bg-indigo-950/80 text-indigo-300 border border-indigo-800/60"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Controller Integrity Footnote */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-300">Deterministic Truth</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-mono">
              PAISE
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            All arithmetic is integer-bounded. AI acts as an evidence-citing investigator, not an unconstrained decision-maker.
          </p>
        </div>
      </div>
    </aside>
  );
}
