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
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Run Reconciliation", href: "/reconcile", icon: PlayCircle },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Exception Center", href: "/exceptions", icon: AlertTriangle, badge: "Honest" },
  { name: "Financial Leakage", href: "/leakage", icon: TrendingDown },
  { name: "Data Sources", href: "/datasets", icon: Database },
  { name: "Evaluation & Ground Truth", href: "/evaluation", icon: ShieldCheck },
  { name: "Audit Trail", href: "/audit", icon: History },
  { name: "Ask the Controller", href: "/ask", icon: MessageSquareCode, badge: "AI" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0B0F17] border-r border-slate-800/80 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-lg">Recon.ai</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                PROTOTYPE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">AI Finance Controller</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Reconciliation Ops
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-slate-800/90 text-cyan-400 shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  item.badge === "AI" 
                    ? "bg-cyan-900/40 text-cyan-300 border border-cyan-700/40" 
                    : "bg-amber-900/40 text-amber-300 border border-amber-700/40"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Controller Mode Badge */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400">Deterministic Truth</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            All monetary arithmetic is strictly integer-bounded. AI reasons over verified evidence only.
          </p>
        </div>
      </div>
    </aside>
  );
}
