# SDN Dashboard - Meshtastic Network Management

A full-stack application for managing and monitoring Software-Defined Networking (SDN) in Meshtastic mesh networks. The project consists of a FastAPI backend and a React/TypeScript frontend with real-time network topology visualization.

## Project Structure

```
SDN_Dashboard_New/
├── backend/          # FastAPI backend server
└── frontend/         # React + Vite frontend application
```

## Getting Started

### Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 18+** and **Bun** or **npm** (for frontend)
- **Docker** and **Docker Compose** (for PostgreSQL database)
- **Git** (for version control)

---

## Backend Setup

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Create Python Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start PostgreSQL Database
```bash
docker-compose up -d
```

This will start a PostgreSQL database on port **5433** with:
- **User:** `app`
- **Password:** `app`
- **Database:** `appdb`

### 5. Run Database Migrations
```bash
alembic upgrade head
```

### 6. Start the Backend Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at: **http://localhost:8000**

API documentation (Swagger UI): **http://localhost:8000/docs**

### Backend Environment Variables (Optional)
Create a `.env` file in the `backend/` directory if you need custom configuration:
```env
DATABASE_URL=postgresql://app:app@localhost:5433/appdb
```

---

## Frontend Setup

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Install Dependencies

**Using Bun (recommended):**
```bash
bun install
```

**Or using npm:**
```bash
npm install
```

### 3. Start Development Server

**Using Bun:**
```bash
bun run dev
```

**Or using npm:**
```bash
npm run dev
```

The frontend will be available at: **http://localhost:8080** (or the port shown in the terminal)
### Frontend Build Commands

- **Development build:** `bun run build:dev` or `npm run build:dev`
- **Production build:** `bun run build` or `npm run build`
- **Preview build:** `bun run preview` or `npm run preview`
- **Run tests:** `bun run test` or `npm run test`
- **Lint code:** `bun run lint` or `npm run lint`

---

## Running Both Services

### Separate Terminals

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # On Windows
# source venv/bin/activate  # On Linux/macOS
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
bun run dev  # or npm run dev
```

---

## Database Management

### View Database Logs
```bash
cd backend
docker-compose logs -f db
```

### Stop Database
```bash
cd backend
docker-compose down
```

### Reset Database (Delete all data)
```bash
cd backend
docker-compose down -v
docker-compose up -d
alembic upgrade head
```

### Create New Migration
```bash
cd backend
alembic revision --autogenerate -m "description of changes"
alembic upgrade head
```

---

## Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **Alembic** - Database migration tool
- **PostgreSQL** - Relational database
- **Uvicorn** - ASGI server
- **Meshtastic** - Mesh network communication
- **PySerial** - Serial port communication

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **TanStack Query** - Data fetching and caching
- **Shadcn/UI** - UI component library
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interactive maps

---

## Features

- **Real-time Network Topology Visualization** - View mesh network structure
- **Node Management** - Monitor and manage Meshtastic nodes
- **Route Analysis** - Analyze network routing paths
- **Messaging System** - Send and receive messages through the mesh network
- **Map View** - Geographic visualization of nodes
- **WebSocket Support** - Real-time updates via Server-Sent Events

---

## Troubleshooting

### Backend Issues

**Database connection error:**
- Ensure Docker is running: `docker ps`
- Check if database container is up: `docker-compose ps`
- Verify port 5433 is not in use

**Import errors:**
- Make sure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

**Migration errors:**
- Reset migrations: `alembic downgrade base` then `alembic upgrade head`

### Frontend Issues

**Module not found errors:**
- Delete `node_modules` and reinstall: `rm -rf node_modules && bun install`

**Port already in use:**
- Vite will auto-increment port or you can specify: `vite --port 3000`

**Build errors:**
- Clear cache: `rm -rf dist .vite`

---

## Development Workflow

1. **Start Database:** `cd backend && docker-compose up -d`
2. **Start Backend:** Activate venv and run FastAPI server
3. **Start Frontend:** Run Vite dev server
4. **Make Changes:** Edit code with hot-reload enabled
5. **Test:** Run backend/frontend tests
6. **Commit:** Commit changes to git

---

## License

This project is part of a Final Year Project (FYP) for SDN implementation in Meshtastic mesh networks.

---

## Contributing

This is an academic project. For questions or contributions, please contact the project maintainers.
