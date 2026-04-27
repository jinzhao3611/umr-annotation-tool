# UMR Writer

## Introduction

UMR Writer is an extension to AMR Editor that allows annotators to annotate both sentence level and document level annotation across multiple languages with added features.

## Prerequisites

- Python 3.7+
- PostgreSQL

## Setup Instructions

### 1. Install Dependencies

**Recommended**: Use a conda environment to manage dependencies:

```bash
conda create -n umr-writer python=3.9
conda activate umr-writer
pip install -r requirements.txt
```

Alternatively, use a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Setup PostgreSQL Database

First, ensure PostgreSQL is installed and running on your system.

Create a new PostgreSQL database:

```bash
createdb umr_annotation_db
```

Or connect to PostgreSQL and create the database:

```sql
CREATE DATABASE umr_annotation_db;
```

### 3. Configure Environment Variables

Set the following environment variables:

```bash
export DATABASE_URL='postgresql://username@localhost/umr_annotation_db'
export SECRET_KEY='your-secret-key-here'
```

Replace `username` with your PostgreSQL username and `umr_annotation_db` with your database name.

Optional email configuration (for password reset functionality):

```bash
export MAIL_PASSWORD='your-sendgrid-api-key'
export MAIL_DEFAULT_SENDER='your-email@example.com'
```

### 4. Initialize Database Tables

Apply the database migrations to create all required tables:

```bash
export FLASK_APP=run.py
flask db upgrade
```

This is the preferred path for both fresh installs and ongoing schema updates. See `migrations/README` for details on authoring new migrations and stamping an existing (pre-migration) production database.

`python create_db.py` remains as a legacy fallback that calls `db.create_all()` directly without recording an alembic revision.

### 5. Run the Application

Start the Flask development server:

```bash
python run.py
```

The application will be available at `http://localhost:3000`

## Database Schema

The application uses the following main tables:
- `app_user` - User accounts
- `project` - Annotation projects
- `projectuser` - Project permissions
- `doc` - Documents
- `sent` - Sentences
- `doc_version` - Document versions
- `annotation` - Sentence and document annotations
- `lexicon`, `lattice`, `partialgraph` - Project-specific data