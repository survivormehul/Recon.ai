# Recon.ai — Autonomous Multi-Source Payment Reconciliation Agent

> **Track 04: AI Agents for Finance, Risk & Operations — Razorpay AI Buildathon 2026**  
> *Closing the finance-operations reconciliation loop across Gateway, Bank, and Ledger records with deterministic truth, bounded AI reasoning, and verifiable audit trails.*

---

## Executive Overview

Modern internet enterprises process millions of transactions across fragmented systems: customer checkouts on payment gateways (e.g. Razorpay), batched settlement payouts in bank statements (UTR references), and double-entry book entries in ERP ledgers.

In production finance operations, these systems drift apart due to:
- **Timing Lags:** T+1 to T+3 settlement windows across clearing houses.
- **MDR Fee & Tax Deductions:** Dynamic Merchant Discount Rates (1.5%–3.0%) and GST deductions applied at payout.
- **Partial Settlements & Refunds:** Customer refunds and chargeback debits aggregated into lump-sum net transfers.
- **Silent Failures:** Missing bank credits, duplicate merchant charges, and gateway drop-offs.

**Recon.ai** is an autonomous, production-grade financial reconciliation agent designed to solve this crisis. It combines **deterministic high-throughput matching** for clear cases, **bounded LLM exception investigation** for ambiguous breaks, and **segregated ground-truth evaluation** to prove accuracy objectively.

---

## Architectural Tenets & Invariants

```
               MULTI-SOURCE FINANCIAL INGESTION
   [Gateway Records]     [Bank UTR Statements]     [Internal Ledger]
           │                      │                        │
           └──────────────────────┼────────────────────────┘
                                  ▼
           ┌──────────────────────────────────────────────┐
           │     STAGE 1: Deterministic Engine            │
           │     • Integer Minor-Unit Math (Paise)        │
           │     • Exact Order & UTR Matching             │
           │     • 1-to-Many Batched Settlement Resolvers │
           │     • Timing Lag Window Tolerances (±3 Days) │
           │     Throughput: >2,500 records/sec           │
           └──────────────────────┬───────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
         [High-Confidence Match]         [Ambiguous Discrepancy]
         (Auto-Committed: ~80%)                   │
                                                  ▼
                               ┌─────────────────────────────────────┐
                               │  STAGE 2: Bounded AI Investigator   │
                               │  • Google Gemini 3.6 Flash          │
                               │  • Strict Zod Schema Validation     │
                               │  • Zero Hallucinated IDs (Guardrail)│
                               │  • Verifiable Evidence Citations    │
                               │  • Air-Gapped Offline Fallback      │
                               └──────────────────┬──────────────────┘
                                                  │
                  ┌───────────────────────────────┴───────────────┐
                  ▼                                               ▼
         [Validated AI Resolution]                     [Honest Exception Queue]
         (Verified Supporting Proof)                   (Human Review Sign-Off)
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          ▼
           ┌──────────────────────────────────────────────┐
           │     STAGE 3: Objective Evaluation & Leakage  │
           │     • Isolated Hidden Ground Truth           │
           │     • Precision, Recall, F1, Match Rate      │
           │     • Detected vs Prevented Leakage (Paise)  │
           │     • Actionable Recoverable Funds Breakdown │
           └──────────────────────┬───────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[Financial Audit Trail]                         [Ask the Controller]
Non-Repudiation JSON Export                     Grounded Conversational Agent
```

1. **Deterministic Mathematical Truth:**
   All monetary calculations use strict **integer minor-units (paise)**. Floating-point arithmetic is strictly prohibited to prevent decimal drift. The LLM is **never** the financial calculation source of truth.
2. **Hybrid Multi-Tier Architecture:**
   The deterministic engine processes 80%+ of transactions instantly (>2,500 records/second). Only genuinely ambiguous exceptions (timing lags, fee variance, fee adjustments) are routed to the bounded AI layer.
3. **Anti-Hallucination Guardrails:**
   The AI operates exclusively via application-owned bounded tools and context. An independent runtime validator rejects any response containing hallucinated Order IDs, unverified bank UTRs, or fabricated monetary figures.
4. **Isolated Ground Truth Evaluation:**
   Evaluation harness isolates ground-truth test data from the matching and AI stages. Metrics (Precision, Recall, F1, Resolution Rate, False Resolution Rate) are calculated objectively with zero hardcoded values.
5. **Honest Exception Handling:**
   Unresolvable breaks are escalated to an interactive **Honest Exception Center** with recommended actions and monetary severity tiers (Critical, High, Medium, Low), rather than guessed.
6. **Immutable Financial Audit Trail:**
   Every ingestion, matching decision, AI tool execution, and state change is committed to an append-only audit trail with one-click JSON compliance export.
7. **Grounded Controller Intelligence:**
   Controllers can query the batch in natural language via **"Ask the Controller"**, receiving verified numbers, cited records, and anti-hallucination badges.

---

## Verified Benchmark Results

The reconciliation engine was evaluated across varying batch sizes using seeded synthetic data benchmarks with isolated ground truth:

| Dataset Size | Wall Time | Throughput | Match Rate | Precision | Recall | F1 Score | Resolution Rate | False Resolution Rate | Adversarial Robustness |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **50 Records** | 42 ms | 1,315 rec/s | 82.00% | 100.00% | 97.83% | **98.90%** | 90.00% | 0.00% | 100.00% |
| **500 Records** | 213 ms | 2,369 rec/s | 82.20% | 100.00% | 97.44% | **98.70%** | 91.20% | 0.00% | 100.00% |
| **1,000 Records** | 368 ms | 2,732 rec/s | 79.94% | 99.89% | 96.50% | **98.17%** | 89.01% | 0.11% | 94.74% |
| **2,500 Records** | 1,890 ms | 1,324 rec/s | 78.46% | 99.72% | 94.77% | **97.18%** | 88.80% | 0.28% | 91.89% |

*Benchmark command:* `npm run benchmark 500 2026`

---

## Core Application Modules

| Module | Route | Functionality |
|---|---|---|
| **Executive Dashboard** | `/` | Real-time reconciliation KPIs, batch status, financial volume breakdown, and quick actions. |
| **Run Reconciliation** | `/reconcile` | Interactive run orchestrator supporting 50, 500, 1000, 2500 records with live terminal streaming. |
| **Transactions Explorer** | `/transactions` | Multi-source side-by-side view (Gateway vs. Bank vs. Ledger) with search and status filters. |
| **Honest Exception Center** | `/exceptions` | Graded exception queue (Missing Credit, Duplicate, Fee Variance) with resolution workflows. |
| **Financial Leakage Engine** | `/leakage` | Identifies detected vs. prevented financial leakage and calculates actionable recoverable funds. |
| **Data Benchmark Generator** | `/datasets` | Seedable multi-source generator creating realistic payment datasets with segregated ground truth. |
| **Ground Truth Evaluation** | `/evaluation` | Independent verification against ground truth (Precision, Recall, F1, False Resolution Rate). |
| **Compliance Audit Trail** | `/audit` | Chronological non-repudiation event ledger with search and JSON export. |
| **Ask the Controller** | `/ask` | Grounded conversational Q&A agent backed by Gemini 3.6 Flash with verifiable citations. |

---

## Technology Stack

- **Framework:** Next.js 14 (App Router, Server Actions, API Routes)
- **Language:** TypeScript 5.6 (Strict typing, integer paise representation)
- **Styling:** Tailwind CSS (Dark-mode financial operations design system)
- **Database & ORM:** PostgreSQL 16, Prisma ORM 5.22
- **AI / LLM Layer:** Google Gemini 3.6 Flash (`@google/genai` compatible REST), Zod Schema Validation
- **Testing:** Vitest (49 unit tests, 100% pass rate)
- **Containerization:** Docker Compose for PostgreSQL

---

## Quick Start

### 1. Prerequisites
- Node.js 18.x or 20.x+
- Docker & Docker Compose (for PostgreSQL)
- npm or pnpm

### 2. Installation
```bash
git clone https://github.com/survivormehul/Recon.ai.git
cd Recon.ai
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```
Configure your environment in `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recon_ai?schema=public"
AI_PROVIDER="gemini"
AI_MODEL="gemini-3.6-flash"
GEMINI_API_KEY="your-gemini-api-key"
```
*(Note: Recon.ai includes an offline deterministic reasoner if running air-gapped without an API key).*

### 4. Database Setup
```bash
npm run db:up     # Start PostgreSQL in Docker
npm run db:push   # Synchronize Prisma schema
```

### 5. Run Verification & Benchmarks
```bash
npm test                      # Run all 49 unit tests
npm run benchmark 500 2026    # Execute 500-record benchmark CLI
```

### 6. Launch Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Evaluation Guide

For detailed testing scenarios, judge walkthroughs, and step-by-step verification instructions, refer to:
- [`SETUP.md`](file:///c:/Users/Mehul/OneDrive/Desktop/Codes/Recon.ai/SETUP.md) — Comprehensive environment setup and configuration guide.
- [`DEMO.md`](file:///c:/Users/Mehul/OneDrive/Desktop/Codes/Recon.ai/DEMO.md) — Interactive step-by-step evaluation script for judges.

---

## License

This project was developed for the **Razorpay AI Buildathon 2026** under Track 04 (Finance, Risk & Operations).
