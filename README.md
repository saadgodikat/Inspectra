# Product Quality Inspection & Defect Tracking System (QITS)

An end-to-end manufacturing decision-support platform designed to connect visual inspection evidence, human review, defect tracking, corrective actions, and separate batch hold/release workflows.

---

## Architecture & Technology Stack

- **Backend**: Python 3.12, Flask, Flask-SQLAlchemy, Alembic / Flask-Migrate, Flask-JWT-Extended, Bcrypt.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Axios, React Router.
- **Database**: SQLite (local development & testing) / PostgreSQL (production target).
- **Authentication & RBAC**: JWT access & refresh tokens with server-side permission checks across three roles:
  - `inspector`: Upload inspection evidence, record initial observations, confirm/challenge AI suggestions.
  - `supervisor`: Oversee assigned issues, record corrective work, submit follow-up repair evidence.
  - `quality_manager`: Resolve disputed cases, manage users, perform exclusive batch hold/release decisions.

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
| **Quality Manager** | `carol@example.com` | `qualitymgr123` | Full CRUD, user management, exclusive batch hold/release |
