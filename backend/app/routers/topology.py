from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, Request, Query
from app.services.startup_functions.state import get_visible_entries, build_graph, load_entries, reset_state
from app.services.startup_functions.feed_simulator import start_simulated_feed
from app.core.database import SessionLocal, get_db
from app.models.route import Route
from app.models.full_route import FullRoute
from app.services.broadcaster import Broadcaster
from app.services.sdn_packet_handler import rebuild_full_routes
from  app.models.node import Node

router = APIRouter(prefix="/api/routeview", tags=["topology"])


def _parse_hex_node_id(value: str):
    normalized = value.lower().strip()
    if normalized.startswith("0x"):
        normalized = normalized[2:]
    if len(normalized) != 8:
        raise ValueError("destination must be a 4-byte hex value (8 hex chars), e.g. a1b2c3d4")
    return bytes.fromhex(normalized)

def get_broadcaster(request: Request) -> Broadcaster:
    """Dependency to get broadcaster from app state"""
    return request.app.state.broadcaster

@router.get("/topology")
def get_topology():
    entries = load_entries()
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

@router.get("/loadall/nodes")
def load_all_nodes():
    db = SessionLocal()
    try:
        nodes = db.query(Node).all()
        return[{ "id": node.id.hex(), "long_name": node.long_name, "hw_model": node.hw_model, "snr": node.snr, "battery_level": node.battery_level,
                 "status": node.status, "hops_away": node.hops_away, "gps_coordinates": node.gps_coordinates,"role": node.role} for node in nodes]
    finally:
        db.close()


#"This api is used to load all routes from the database on initial page load."
@router.get("/loadall/routes")
def load_all_routes():
    db = SessionLocal()
    try:
        routes = db.query(Route).all()
        return [{
            "route_id": route.route_id,
            "reporter": route.reporter.hex() if route.reporter else None,
            "destination": route.destination.hex() if route.destination else None,
            "next_hop": route.next_hop.hex() if route.next_hop else None,
            "hop_count": route.hop_count,
            "dest_seq_num": route.dest_seq_num,
            "timestamp": route.timestamp,
            "expiring_time": route.expiring_time,
        } for route in routes]
    finally:
        db.close()


@router.get("/loadall/full-routes")
def load_all_full_routes():
    db = SessionLocal()
    try:
        full_routes = db.query(FullRoute).all()
        return [{
            "full_route_id": route.full_route_id,
            "source": route.source.hex() if route.source else None,
            "destination": route.destination.hex() if route.destination else None,
            "dest_seq_num": route.dest_seq_num,
            "path": route.path.split(",") if route.path else [],
            "hop_count": route.hop_count,
            "is_complete": route.is_complete,
            "updated_at": route.updated_at,
        } for route in full_routes]
    finally:
        db.close()


@router.get("/full-routes/rebuild-targets")
def full_route_rebuild_targets():
    """List destination + dest_seq_num pairs currently present in routes table."""
    db = SessionLocal()
    try:
        targets = (
            db.query(Route.destination, Route.dest_seq_num)
            .filter(Route.destination.isnot(None), Route.dest_seq_num.isnot(None))
            .distinct()
            .all()
        )
        return {
            "count": len(targets),
            "targets": [
                {
                    "destination": destination.hex() if destination else None,
                    "dest_seq_num": dest_seq_num,
                }
                for destination, dest_seq_num in targets
            ],
        }
    finally:
        db.close()


@router.post("/full-routes/rebuild")
def rebuild_full_routes_from_routes_table(
    destination: str | None = Query(default=None, description="Optional 4-byte destination hex, e.g. a1b2c3d4 or 0xa1b2c3d4"),
    dest_seq_num: int | None = Query(default=None, description="Optional destination sequence number"),
    clear_existing: bool = Query(default=False, description="Delete existing full_routes before rebuilding"),
):
    """
    Rebuild full_routes from data that already exists in routes.

    - No query params: rebuild for every (destination, dest_seq_num) pair in routes.
    - destination + dest_seq_num: rebuild only for that specific pair.
    """
    if (destination is None) != (dest_seq_num is None):
        return {
            "status": "error",
            "message": "Provide both destination and dest_seq_num together, or leave both empty.",
        }

    db = SessionLocal()
    try:
        if clear_existing:
            db.query(FullRoute).delete()

        if destination is not None and dest_seq_num is not None:
            try:
                destination_bytes = _parse_hex_node_id(destination)
            except ValueError as exc:
                return {"status": "error", "message": str(exc)}

            rebuild_pairs = [(destination_bytes, dest_seq_num)]
        else:
            rebuild_pairs = (
                db.query(Route.destination, Route.dest_seq_num)
                .filter(Route.destination.isnot(None), Route.dest_seq_num.isnot(None))
                .distinct()
                .all()
            )

        now = datetime.now(timezone.utc).isoformat()
        for destination_bytes, seq in rebuild_pairs:
            rebuild_full_routes(destination_bytes, seq, now, db)

        db.commit()

        return {
            "status": "ok",
            "targets_processed": len(rebuild_pairs),
            "targets": [
                {
                    "destination": destination_bytes.hex() if destination_bytes else None,
                    "dest_seq_num": seq,
                }
                for destination_bytes, seq in rebuild_pairs
            ],
        }
    except Exception as exc:
        db.rollback()
        return {"status": "error", "message": str(exc)}
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

@router.websocket("/ws/nodes")
async def ws_nodes(ws: WebSocket):
    await ws.accept()
    broadcaster = ws.app.state.node_update_broadcaster  # Use separate broadcaster for node updates
    broadcaster.register(ws)
    try:
        while True:
            await ws.receive_text()  # Keep connection open, ignore incoming messages
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        broadcaster.unregister(ws) 
    
    