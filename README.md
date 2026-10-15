# 🌍 SaHa Carbon Footprint Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![ORM](https://img.shields.io/badge/Drizzle-ORM-orange)](https://orm.drizzle.team/)
[![CI](https://github.com/samisqscore/SaHa-Carbon-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/samisqscore/SaHa-Carbon-Tracker/actions)

> **Empowering sustainable construction with whole-life carbon intelligence.**

SaHa is a modern, full-stack open-source platform designed for architects, structural engineers, sustainability consultants, and real estate developers to calculate, benchmark, and report upfront embodied and operational carbon across the building lifecycle.

---

## ✨ Key Features

- 🏢 **Multi-Tenant Organization Management**: Role-based access control (`admin`, `estimator`, `viewer`) with project isolation and team collaboration.
- 📐 **Universal Bill of Quantities (BOQ) Normalizer**: Upload multi-sheet Excel and CSV spreadsheets. Inspect, clean, map, and import construction line items into projects.
- 🔬 **Whole-Life Lifecycle Analytics**: Full support for standard lifecycle stages (**EN 15804** / **RICS**):
  - **A1–A3**: Cradle-to-Gate Product Stage
  - **A4–A5**: Construction Process (Transportation & Installation)
  - **B1–B7**: Use Stage (Operational Energy & Water)
  - **C1–C4**: End-of-Life Stage
  - **D**: Benefits & Loads beyond the system boundary (Circular reuse & recycling)
- 📊 **Dynamic Carbon Intelligence Dashboards**:
  - Carbon Intensity ($kgCO_2e/m^2$) benchmarked against **LETI** and **RIBA 2030** Climate Challenges.
  - Category drill-downs (Concrete, Steel, Masonry, Glazing, MEP).
  - Scope 1, Scope 2, and Scope 3 classification under the **GHG Protocol**.
- 🤖 **AI-Assisted Material Matching**: Intelligent recommendation agents powered by Gemini and DeepSeek to automatically match messy BOQ item descriptions with localized emission factors.
- 📚 **Comprehensive Emission Factor Library**: Out-of-the-box support for:
  - **India BEI 2024** (Bureau of Energy Efficiency)
  - **ICE v3** (Inventory of Carbon & Energy - University of Bath)
  - **EPD Mirroring**: Read-only synchronization with Environmental Product Declaration databases.
- 📑 **Audit-Grade PDF & CSV Reports**: Export server-side generated executive summaries and detailed line-item compliance reports.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI / Radix primitives |
| **Data Visualization** | Recharts, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express 4.x, TypeScript |
| **ORM & Database** | Drizzle ORM, PostgreSQL (local or serverless Neon) |
| **Validation** | Zod (shared schema contracts across client and server) |
| **Authentication** | Passport.js, Google OAuth 2.0, PostgreSQL session store |
| **Document Generation** | `@react-pdf/renderer`, PapaParse, SheetJS (`xlsx`) |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18.x or v20.x+
- [Docker](https://www.docker.com/) & Docker Compose (for local database)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/samisqscore/SaHa-Carbon-Tracker.git
cd SaHa-Carbon-Tracker
```

### 2. Configure Environment Variables
Copy the template to `.env`:
```bash
cp .env.example .env
```
*(The default `.env.example` is pre-configured to work with the Docker PostgreSQL container).*

### 3. Start PostgreSQL Database
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Push Schema & Seed Datasets
```bash
# Push database tables using Drizzle Kit
npm run db:push

# Seed default global emission datasets (India BEI, ICE v3)
npm run seed
```

### 6. Start the Development Server
```bash
npm run dev
```

Visit **[http://localhost:5001](http://localhost:5001)** in your browser!

---

## 🧪 Development & Testing

```bash
# Run TypeScript compilation check
npm run check

# Create production build
npm run build

# Start production server
npm start
```

---

## 📁 Repository Structure

```
├── client/                 # React 18 single-page application (Vite)
│   ├── src/
│   │   ├── components/     # UI components & feature widgets
│   │   │   ├── BOQNormalizer/ # Spreadsheet importer & parser
│   │   │   ├── Dashboard/  # Carbon charts & intensity metrics
│   │   │   └── Projects/   # Materials, phases, and emission tabs
│   │   ├── pages/          # App routes (Dashboard, Projects, Reports, Admin)
│   │   └── lib/            # Utilities and TanStack Query client
├── server/                 # Express REST API backend
│   ├── emissionCalculationService.ts # Core carbon math engine
│   ├── boqNormalizer.ts    # Multi-sheet spreadsheet parser
│   ├── epdSync.ts          # EPD database sync mirror
│   ├── googleAuth.ts       # OAuth session management
│   ├── reportPDF.ts        # Server-side PDF generation
│   └── routes.ts           # API endpoints
├── shared/                 # Shared types, Zod schemas, climate factors
│   ├── schema.ts           # Drizzle table definitions
│   └── climateFactors.ts   # Regional ASHRAE climate corrections
├── sample_data/            # Synthetic sample BOQs for testing
├── docs/                   # Architectural manifestos and guides
└── docker-compose.yml      # Local development database container
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for branch guidelines, coding standards, and pull request procedures.

Please also review our [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md).

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
