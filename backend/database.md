# SDN Dashboard Backend

FastAPI backend using PostgreSQL (Docker) and Alembic for schema migrations.

---

## Tech Stack

- FastAPI
- PostgreSQL (Docker)
- SQLAlchemy
- Alembic
- Psycopg

---

# Getting Started

## 1. Start the Database

From the `backend/` directory:

```bash
docker compose up -d
```

Check if running:

```bash
docker ps
```

Default credentials:

* User: app
* Password: app
* Database: appdb
* Host: localhost
* Port: 5433 (or 5432 if not changed)

---

## 2. Install Dependencies

Activate virtual environment and run:

```bash
pip install -r requirements.txt
```

---

## 3. Apply Database Migrations

```bash
alembic upgrade head
```

Check current migration:

```bash
alembic current
```

---

# Making Schema Changes

## Step 1 – Modify Models

Edit or create models inside:

```
app/models/
```

## Step 2 – Generate Migration

```bash
alembic revision --autogenerate -m "describe change"
```

This creates a migration file in:

```
alembic/versions/
```

## Step 3 – Review Migration File

Open the generated file and confirm:

* No accidental table drops
* Correct columns and constraints

## Step 4 – Apply Migration

```bash
alembic upgrade head
```

## Step 5 – Commit Changes

Commit:

* Updated models
* The new migration file

---

# Reset Local Database (Development Only)

Deletes all local DB data:

```bash
docker compose down -v
docker compose up -d
alembic upgrade head
```

---

# Project Structure

```
backend/
│
├── app/
│   ├── core/
│   │   └── database.py
│   ├── models/
│   └── main.py
│
├── alembic/
│   └── versions/
│
├── alembic.ini
├── docker-compose.yml
└── requirements.txt
```

---

# Common Issues

## Password authentication failed

* Ensure Docker DB is running
* Ensure port matches docker-compose
* Ensure DATABASE_URL matches credentials

## Port already in use

Change docker port mapping:

```yaml
ports:
  - "5433:5432"
```

Then update DATABASE_URL accordingly.

---

# Useful Commands

Start DB:

```bash
docker compose up -d
```

Stop DB:

```bash
docker compose down
```

Generate migration:

```bash
alembic revision --autogenerate -m "message"
```

Apply migrations:

```bash
alembic upgrade head
```

View migration history:

```bash
alembic history
```

---

# Deployment

On a new server:

1. Start PostgreSQL
2. Set DATABASE_URL
3. Run:

```bash
alembic upgrade head
```

The database schema will be created automatically.
