# INSPECTRA — Industrial Quality Assurance & Telemetry Platform

An end-to-end manufacturing decision-support platform with a high-density dark-mode telemetry interface. Connects visual inspection evidence, AI-assisted defect detection, human review, CAPA corrective actions, SPC analytics, and 21 CFR Part 11 compliant batch hold/release workflows.

---

## Architecture & Technology Stack

- **Backend**: Python 3.12, Flask, Flask-SQLAlchemy, Alembic / Flask-Migrate, Flask-JWT-Extended, Bcrypt.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Material Symbols, Axios, React Router.
- **Database**: SQLite (local development & testing) / PostgreSQL (production target).
- **Design System**: Industrial dark-mode aesthetic — Hanken Grotesk + IBM Plex Sans/Mono, amber primary (`#ffb77d`/`#d97707`), blue tertiary (`#96ccff`), custom design tokens.
- **Authentication & RBAC**: JWT access & refresh tokens with server-side permission checks across three roles:
  - `inspector`: Upload inspection evidence, record initial observations, confirm/challenge AI suggestions.
  - `supervisor`: Oversee assigned issues, record corrective work, submit follow-up repair evidence.
  - `quality_manager`: Resolve disputed cases, manage users, perform exclusive batch hold/release decisions, access audit trail.

---

## Application Screens

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | **Command Center** | Real-time KPI dashboard with FPY gauge, station activity, batch pipeline, and recent inspections |
| `/inspections` | **Inspections & Runs Console** | Item-counted inspection runs, numbered bulk image upload, mock ML analysis, and per-item review |
| `/reviews` | **Defect Tracker & CAPA** | Defect registry, severity ribbon, microscopy viewer, interactive CAPA action plan checklist |
| `/batch-decisions` | **Batch Releases & Quality Gates** | 21 CFR Part 11 lot release, AQL defect density, AOI camera verification, e-signature sign-off |
| `/analytics` | **Quality Analytics & SPC Yield** | X-bar R chart with UCL/LCL, Western Electric run rules, Pareto failure modes, multi-line yield trends |
| `/products` | **Products & Batches Workspace** | Manufacturing catalog, batch traceability, lifecycle status management |
| `/audit` | **Audit Event Log** | 21 CFR Part 11 immutable event log with SHA-256 digital stamp verification |
| `/users` | **User & Role Management** | Account status, role assignment, permission controls |
| `/login` | **Terminal Login** | Industrial-themed login with one-click demo access |

### Item-level inspection workflow

When creating an inspection, choose a product and batch, then set the number of items to inspect (prefilled from the batch quantity when available; the selected quantity cannot exceed that quantity). Upload one image per item using a filename that contains its item number, such as `059.jpg` or `casting_059.png`. The page reports unmatched names, lets you run analysis on uploaded images, and displays each item's image and result. Supervisors and quality managers can override analyzed results with a decision and optional comment.

The current `backend/services/ml_service.py` implementation is a random mock, not a production defect classifier. Do not use its results to make actual quality or release decisions until the ML implementation has been replaced and validated.

---

## Quickstart & Execution Commands

### 1. Backend Setup & Startup

```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Install dependencies (if not already installed)
pip install -r backend/requirements.txt

# 3. Run database migrations
export FLASK_APP=backend.wsgi:app
flask db upgrade

# 4. Seed demo accounts (if fresh DB)
flask seed-users

# 5. Start Flask backend server
python3 backend/wsgi.py
# Server starts on http://localhost:5000
```

### 2. Frontend Setup & Startup

```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
# Frontend starts on http://localhost:5173 (proxies /api to http://localhost:5000)
```

### 3. Run Tests

```bash
# Run backend test suite (unit + integration + RBAC tests)
source .venv/bin/activate
PYTHONPATH=. pytest -v backend/tests
```

---

## Seed Accounts (For Testing & Evaluation)

| Role | Email | Password | Allowed Capabilities |
|------|-------|----------|----------------------|
| **Inspector** | `alice@example.com` | `inspector123` | Inspect products, submit images, human review queue |
| **Supervisor** | `bob@example.com` | `supervisor123` | Create/edit batches, corrective actions, repair evidence |
| **Quality Manager** | `carol@example.com` | `qualitymgr123` | Full CRUD, user management, exclusive batch hold/release, audit trail |

---

## Design System

The frontend implements the **Inspectra Industrial Design System** with:

- **Typography**: Hanken Grotesk (headlines), IBM Plex Sans (body), IBM Plex Mono (data/labels)
- **Color Palette**: Dark canvas `#131313`, amber primary accents, blue tertiary, emerald status indicators
- **Components**: Industrial-grade KPI cards, telemetry ribbons, data tables with monospace columns, status badges with severity-mapped colors
- **Micro-animations**: Pulse indicators, smooth transitions, loading spinners
- **Code-split Routes**: All pages are lazy-loaded via `React.lazy` + `Suspense` for optimal bundle performance
