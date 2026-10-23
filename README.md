# Inspectra

Inspectra is a manufacturing quality-assurance prototype for inspection evidence, AI-assisted defect detection, human review, corrective actions, quality analytics, and batch hold/release workflows. It combines a Flask API with a React dashboard.

> Inspectra is a software prototype, not a validated or certified quality-management system. Model predictions are advisory and must not replace qualified human review or established release procedures.

## What's included

- **Item-level inspections:** Create an inspection with a defined quantity, upload images mapped to item numbers, analyze them, and review individual results.
- **Defect review and CAPA:** Track defects and corrective actions, including repair evidence and human decisions.
- **Batch quality gates:** Review batch quality information and record attributed hold/release decisions with a documented reason and evidence snapshot. This prototype does not provide verified electronic signatures.
- **Analytics and audit history:** Explore quality trends and SPC charts, and review recorded audit events.
- **Inspectra Assistant:** Ask questions about accessible project records through a local Ollama model. It is read-only and does not save conversations.
- **Role-based access:** Inspector, supervisor, and quality-manager permissions are enforced by the backend.

## Application screens

| Route | Screen | Description |
| --- | --- | --- |
| `/` | Command Center | Quality KPIs, station activity, batch pipeline, and recent inspections |
| `/inspections` | Inspections & Runs | Inspection runs, bulk image upload, analysis, and item-level review |
| `/reviews` | Defect Tracker & CAPA | Defect registry, severity, and corrective-action tracking |
| `/batch-decisions` | Batch Releases & Quality Gates | Batch hold/release review, advisory acknowledgement, and decision history |
| `/analytics` | Quality Analytics & SPC | Yield trends, SPC charts, and defect analysis |
| `/chatbot` | Inspectra Assistant | Read-only, role-filtered answers with source citations |
| `/products` | Products & Batches | Product catalog and batch traceability |
| `/audit` | Audit Event Log | Recorded events and digital-stamp verification |
| `/users` | User & Role Management | User accounts and role assignment |
| `/login` | Login | Sign in to the application |

The audit and batch workflows support traceability; their presence does not by itself establish regulatory compliance.

## Inspection workflow

When starting a new inspection, select a product and enter the production date, batch quantity, production line, and supplier. Inspectra creates a new batch with a generated batch number and an initial `under_inspection` status, then allocates the same quantity of item slots for that inspection. Inspectors can create batches through this combined workflow; standalone batch registration remains restricted to supervisors and quality managers. A follow-up reinspection is a separate inspection linked to its original and reuses the original batch. Upload one image per item with a filename containing its item number, for example `059.jpg` or `casting_059.png`. Inspectra reports filenames that cannot be matched to an item. After analysis, each item's image and result are available for review. Supervisors and quality managers can override an analyzed result with a decision and optional comment.

## Machine-learning inference

The backend integrates the trained EfficientNet-B0 binary casting classifier in `ml/src/inspectra_ml`. It predicts `good` or `defective`; it does not make human decisions, create final defect records, or release batches.

The checkpoint is not included in this repository. For inference, provide the trained checkpoint at `ml/artifacts/best_model.pth` (the default path) and install the ML dependencies:

```bash
pip install -r ml/requirements.txt
```

Without the checkpoint or ML runtime dependencies, image inference will fail explicitly; the application does not substitute mock predictions. See [ml/README.md](ml/README.md) for ML setup, training, and evaluation details.

## Local project-data assistant

The assistant uses Ollama on the backend machine. The defaults are `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=gemma2:2b`, and `OLLAMA_REQUEST_TIMEOUT_SECONDS=300`; these can be changed through environment variables. The timeout controls how long the backend waits for Ollama to respond. The 2B default is intended to reduce memory pressure on local CPU-only setups and is compatible with the Ollama version used during development.

```bash
ollama pull gemma2:2b
ollama serve
```

The assistant supports batch summaries and current holds, pending human reviews, confirmed defects, open corrective actions, and linked reinspection/follow-up questions. Exact counts and status breakdowns are computed by database queries, not estimated by the model. Retrieval uses only records permitted by the signed-in user's backend role and considers up to the 250 newest records per data area, plus explicitly referenced record IDs; older individual records may not be included in general searches. The model receives matching source records as untrusted context, and only citations matching records actually retrieved are returned. If no relevant authorized record is found, or the model cannot provide a valid citation, the assistant says the evidence is insufficient. AI predictions are kept distinct from human-confirmed defects; matching defect categories across linked, reviewed reinspections are reported as a record comparison, not a root-cause conclusion. Conversations are not persisted. The assistant is read-only and cannot replace human review or execute corrective actions or batch decisions.

## Technology

- **Backend:** Python 3.12, Flask, Flask-SQLAlchemy, Flask-Migrate/Alembic, Flask-JWT-Extended, bcrypt
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Axios, Lucide
- **Database:** SQLite by default; PostgreSQL can be configured with `DATABASE_URL`
- **ML:** PyTorch, torchvision, and EfficientNet-B0; inference requires a separately supplied checkpoint
- **Assistant:** Local Ollama service (optional)
- **Authentication:** JWT access/refresh tokens and backend permission checks

## Quickstart

### Requirements

- Python 3.12
- Node.js and npm
- Ollama and its configured model if using the assistant
- The ML dependencies and trained checkpoint if using image inference

### Backend

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

export FLASK_APP=backend.wsgi:app
flask db upgrade
flask seed-users
python backend/wsgi.py
```

The API starts at `http://localhost:5000`. For sample products, batches, and inspection data, run `flask seed-all` instead of `flask seed-users`; `seed-all` also creates the demo users.

If an API request fails with `no such table: users`, check that the running backend uses the intended `DATABASE_URL` and that `flask db upgrade` has run against that same database. If Alembic reports the database is already at `head` but the SQLite file contains only `alembic_version` and no application tables, back up the file and confirm it contains no application data before repairing its migration marker:

```bash
cp instance/qits.db /tmp/qits.db.backup
flask db stamp base
flask db upgrade
```

Do not stamp an existing database back to `base` if it contains application tables or data; restore a consistent backup or repair its migration state with a database-specific plan instead.

To use PostgreSQL or change other settings, configure the environment variables in `.env.example` in a local `.env` file. Do not commit secrets from `.env`.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:5000`.

### Demo accounts

`flask seed-users` creates these local development accounts:

| Role | Email | Password |
| --- | --- | --- |
| Inspector | `alice@example.com` | `inspector123` |
| Supervisor | `bob@example.com` | `supervisor123` |
| Quality manager | `carol@example.com` | `qualitymgr123` |

These are public demo credentials. Do not use them outside a local development environment.

## Tests

Run the backend tests from the repository root with the virtual environment active:

```bash
PYTHONPATH=. pytest -v backend/tests
```

Run ML tests separately after installing `ml/requirements.txt`:

```bash
pytest -v ml/tests
```

## Design system

The frontend uses a dark industrial visual theme with Hanken Grotesk and IBM Plex typography, amber accents, blue tertiary colors, and emerald status indicators. Routes are lazy-loaded with React `Suspense`.
