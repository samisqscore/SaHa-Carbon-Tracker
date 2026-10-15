# Contributing to SaHa Carbon Footprint Tracker

Thank you for your interest in contributing to the **SaHa Carbon Footprint Tracker**! We welcome contributions from developers, sustainability professionals, architects, and data engineers worldwide.

---

## 🌟 Code of Conduct

This project adheres to the [Contributor Covenant (v2.1)](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.x or v20.x+
- **npm**: v9.x+
- **Docker**: (Recommended) for local PostgreSQL container

### 2. Fork and Clone
```bash
git clone https://github.com/<your-username>/SaHa-Carbon-Tracker.git
cd SaHa-Carbon-Tracker
```

### 3. Setup Environment
```bash
cp .env.example .env
```

### 4. Start Local Database
```bash
docker compose up -d
```

### 5. Install Dependencies and Seed
```bash
npm install
npm run db:push
npm run seed
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5001](http://localhost:5001) in your browser.

---

## 🌿 Branching & Git Workflow

1. Always branch off the `open-source` (or main default) branch:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. Commit your changes using conventional commit messages:
   - `feat: add lifecycle stage filter in portfolio view`
   - `fix: correct density calculation for structural timber`
   - `docs: update EPD synchronization documentation`
3. Push to your fork and submit a Pull Request against the default branch.

---

## 🧪 Code Quality Standards

Before submitting a Pull Request, make sure your code passes all checks:

```bash
# Type check TypeScript codebase
npm run check

# Verify production build passes
npm run build
```

---

## 📝 Submitting a Pull Request (PR)

- Fill out the provided [Pull Request Template](.github/pull_request_template.md).
- Clearly explain the problem being solved or the feature added.
- Include screenshots or GIFs for any UI changes.
- Ensure no sensitive information, credentials, or personal data are included.

Thank you for helping accelerate sustainable, low-carbon construction!
