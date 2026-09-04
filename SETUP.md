# Recon.ai — Setup & Installation Guide

> **Track 04: AI Agents for Finance, Risk & Operations — Razorpay AI Buildathon 2026**

This document provides complete instructions for configuring, running, and verifying Recon.ai locally.

---

## 1. Prerequisites

Before installing Recon.ai, ensure your system meets the following requirements:
- **Node.js:** v18.18.0 or v20.x+ (v22.x also supported)
- **npm:** v9.x or v10.x+
- **Docker & Docker Compose:** Required to run the local PostgreSQL database container.
- **Git:** Required for version control.
- **Operating System:** Windows, macOS, or Linux.

---

## 2. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/survivormehul/Recon.ai.git
cd Recon.ai

# Install dependencies
npm install
```

---

## 3. Environment Configuration

Recon.ai ships with a `.env.example` template:

```bash
# Copy example environment configuration
cp .env.example .env
```

Open `.env` and verify the settings:

```env
# PostgreSQL Database Connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recon_ai?schema=public"

# AI Provider Configuration
AI_PROVIDER="gemini"
AI_MODEL="gemini-3.6-flash"

# Google Gemini API Key (Required for live Gemini 3.6 Flash investigations)
# If left blank, Recon.ai automatically falls back to its deterministic offline reasoner
GEMINI_API_KEY="your-gemini-api-key-here"

# Application Environment
NODE_ENV="development"
PORT=3000
```

> **Security Note:** The `.env` file is gitignored and will never be committed. Never commit API keys or database credentials to version control.

---

## 4. Database Setup

Recon.ai uses PostgreSQL for persisting source datasets, reconciliation runs, decisions, evidence items, open exceptions, evaluation results, and immutable audit trails.

### Start the PostgreSQL Container
```bash
# Launch PostgreSQL via Docker Compose
npm run db:up
# Or alternatively:
docker compose up -d
```

### Push the Prisma Schema
```bash
# Synchronize schema directly to the database
npm run db:push
```

### Generate Prisma Client
```bash
# Generate the latest typed client
npm run db:generate
```

*(Optional)* To inspect the database using a browser GUI:
```bash
npm run db:studio
```

---

## 5. Automated Testing & Verification

Run the test suite to verify that all modules are functioning properly:

```bash
# Run all unit and integration tests
npm test
```

Expected output:
```
 ✓ tests/unit/money.test.ts (5 tests)
 ✓ tests/unit/generator.test.ts (6 tests)
 ✓ tests/unit/ai-investigation.test.ts (12 tests)
 ✓ tests/unit/evaluation.test.ts (5 tests)
 ✓ tests/unit/orchestrator.test.ts (4 tests)
 ✓ tests/unit/phase7-audit-and-assistant.test.ts (9 tests)
 ✓ tests/unit/reconciliation.test.ts (8 tests)

Test Files  7 passed (7)
     Tests  49 passed (49)
```

---

## 6. Standalone CLI Benchmark Runner

You can execute full end-to-end reconciliation benchmarks directly from your terminal without opening a browser:

```bash
# Run standard 500-record benchmark (Seed 2026)
npm run benchmark

# Run custom batch sizes
npm run benchmark 50 2026
npm run benchmark 500 2026
npm run benchmark 1000 2026
npm run benchmark 2500 2026

# Run explicitly with offline deterministic reasoner
npm run benchmark 500 2026 offline_fallback
```

The benchmark runner outputs:
- Deterministic, AI, and Evaluation stage timings.
- Processing throughput (records/sec).
- Minor-unit financial exposure (Total Volume, Reconciled Funds, Detected Leakage, Prevented Leakage, Recoverable Funds).
- Decision breakdown (Matched, Resolved, Review, Unresolved, Duplicate, Missing, Conflict).
- Objective ground-truth evaluation metrics (Precision, Recall, F1 Score, Adversarial Robustness).

---

## 7. Launching the Web Dashboard

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Launch
To test the optimized production build:
```bash
# Compile and build Next.js production bundle
npm run build

# Start production server
npm start
```

---

## 8. Troubleshooting

### Port 5432 Already in Use
If another PostgreSQL instance is already running locally:
1. Stop the conflicting service, or
2. Change the host port in `docker-compose.yml` (e.g. `"5433:5432"`), and update `DATABASE_URL` in `.env` to match the new port (`localhost:5433`).

### Database Unavailable or Docker Offline
Recon.ai features an in-memory fallback architecture (`runHistoryStore` and `auditMemoryStore`). If PostgreSQL is unreachable, the orchestrator and dashboard will continue operating smoothly using in-memory state.

### Gemini API Rate Limits or Network Issues
If Gemini API encounters a network timeout, HTTP 429, or HTTP 500, Recon.ai automatically switches to its offline deterministic reasoner with zero downtime.
