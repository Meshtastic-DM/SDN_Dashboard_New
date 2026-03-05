# SDN Dashboard

A real-time Software-Defined Networking (SDN) topology visualization dashboard built with React and FastAPI.

## Overview

This dashboard provides real-time visualization of SDN network topology, displaying nodes, links, and routing entries. The system consists of:
- **Backend**: FastAPI server that simulates SDN routing data feeds
- **Frontend**: React application with interactive network topology visualization

## Prerequisites

Before running the dashboard, ensure you have the following installed:

- **Python 3.8+** (for backend)
- **Node.js 16+** and **npm** (for frontend)

## Project Structure

```
SDN_Dashboard/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI application
│       ├── state.py             # State management
│       ├── feed_simulator.py    # Data feed simulator
│       └── data/                # JSON data files
├── frontend/
│   └── sdn-dashboard/
│       ├── src/                 # React source code
│       ├── package.json         # Frontend dependencies
│       └── vite.config.js       # Vite configuration
└── README.md
```

## Installation & Setup

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **Linux/Mac**:
     ```bash
     source venv/bin/activate
     ```

4. Install required dependencies:
   ```bash
   pip install fastapi uvicorn
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend/sdn-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Dashboard

### Step 1: Start the Backend Server

1. From the project root, navigate to backend:
   ```bash
   cd backend
   ```

2. Ensure your virtual environment is activated (if you created one)

3. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --reload
   ```

   The backend server will start at: **http://localhost:8000**

   You can verify it's running by visiting: **http://localhost:8000/docs** (FastAPI Swagger UI)

### Step 2: Start the Frontend Development Server

1. Open a new terminal window

2. Navigate to the frontend directory:
   ```bash
   cd frontend/sdn-dashboard
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will start at: **http://localhost:5173**

### Step 3: Access the Dashboard

Open your web browser and navigate to:
```
http://localhost:5173
```

You should see the SDN topology visualization with real-time updates.

## API Endpoints

The backend provides the following API endpoints:

- `GET /api/topology` - Returns current network topology data (nodes and links)
- `GET /api/entries` - Returns routing entries

## Features

-  Real-time topology updates
-  Interactive network graph visualization
-  Dynamic node and link rendering
-  Simulated SDN routing data feed
-  RESTful API backend

## Development

### Backend Development

The backend uses FastAPI and includes:
- CORS middleware configured for frontend ports (5173, 3000)
- Simulated data feed from JSON files
- State management for routing entries

To modify the simulated data, edit files in `backend/app/data/`

### Frontend Development

The frontend is built with:
- React 19
- Vite for fast development
- react-force-graph-2d for visualization

To modify the UI, edit components in `frontend/sdn-dashboard/src/components/`

## Building for Production

### Frontend Production Build

```bash
cd frontend/sdn-dashboard
npm run build
```

The production-ready files will be in `frontend/sdn-dashboard/dist/`

### Backend Production

For production deployment, use a production ASGI server:

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Troubleshooting

### Backend Issues

- **Port already in use**: Change the port with `--port` flag:
  ```bash
  uvicorn app.main:app --reload --port 8001
  ```

- **Import errors**: Ensure you're running from the `backend` directory

### Frontend Issues

- **Port 5173 in use**: Vite will automatically try the next available port

- **API connection errors**: Verify the backend is running at http://localhost:8000

- **Dependencies issues**: Try removing `node_modules` and reinstalling:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

## License

This project is part of a Final Year Project (FYP).

## Support

For issues or questions, please create an issue in the project repository.