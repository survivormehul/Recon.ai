import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Recon.ai — Autonomous Multi-Source Payment Reconciliation Agent",
  description: "Closes the finance-operations reconciliation loop across gateway, bank, and ledger records with deterministic truth and AI investigation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0F17] text-slate-100 min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-[#0B0F17] to-[#080C13]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
