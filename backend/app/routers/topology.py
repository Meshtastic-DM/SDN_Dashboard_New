from fastapi import APIRouter, WebSocket, Request
from app.services.startup_functions.state import get_visible_entries, build_graph, reset_state
from app.services.startup_functions.feed_simulator import start_simulated_feed
from app.core.database import SessionLocal, get_db
from app.models.route import Route
from app.services.broadcaster import Broadcaster

router = APIRouter(prefix="/api/routeview", tags=["topology"])

def get_broadcaster(request: Request) -> Broadcaster:
    """Dependency to get broadcaster from app state"""
    return request.app.state.broadcaster

@router.get("/topology")
def get_topology():
    entries = get_visible_entries()
    return build_graph(entries)

@router.get("/entries")
def api_get_entries():
    entries = get_visible_entries()
    return {"count": len(entries), "entries": entries}

@router.post("/reset")
async def reset_simulation():
    reset_state()
    await start_simulated_feed()
    return {"status": "reset"}


#"This api is used to load all routes from the database on initial page load."
@router.get("/loadall/routes")
def load_all_routes():
    db = SessionLocal()
    try:
        routes = db.query(Route).all()
        return[{ "sequence_number": route.sequence_number, "source": route.source, "destination": route.destination,
                 "next_hop": route.next_hop, "expiring_time": route.expiring_time} for route in routes]
    finally:
        db.close()

#"This websocket endpoint is used to push real-time route updates to the frontend."
@router.websocket("/ws/routes")
async def ws_readings(ws: WebSocket):
    await ws.accept()
    broadcaster = ws.app.state.broadcaster
    broadcaster.register(ws)
    try:
        while True:
            await ws.receive_text()  # Keep connection open, ignore incoming messages
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        broadcaster.unregister(ws)
    
    