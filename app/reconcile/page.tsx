"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, PlayCircle, ArrowRight } from "lucide-react";

export default function ReconcileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Forward seamlessly to the unified Command Center on the Dashboard
    router.replace("/?action=run");
  }, [router]);

  return (
    <div className="max-w-xl mx-auto mt-16 p-8 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-4 shadow-xl">
      <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 mx-auto flex items-center justify-center text-indigo-400">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-white tracking-tight">
        Redirecting to Unified Command Center
      </h2>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">
        Recon.ai has unified batch reconciliation directly into the primary Dashboard for a faster, guided workflow.
      </p>
      <div className="pt-2">
        <Link
          href="/?action=run"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-xs font-semibold hover:from-indigo-600 hover:to-cyan-600 transition-all shadow-md"
        >
          <PlayCircle className="h-4 w-4" />
          <span>Continue to Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
