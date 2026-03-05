#TODO: This worker need to be deleted when the Meshtastic client is fully integrated and tested, as the client will handle parsing internally and emit structured events instead of raw lines. @Tharoosha
import threading
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, get_db
from app.models import Node, Route
from app.serial.parser import parse_line

class SerialWorker:
    def __init__(self, line_iter, broadcaster):
        self.line_iter = line_iter
        self.broadcaster = broadcaster
        self._stop = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self._stop.set()
    
    def _ensure_node_exists(self, db: Session, node_id: bytes):
        """Create node if it doesn't exist"""
        existing_node = db.query(Node).filter(Node.id == node_id).first()
        if not existing_node:
            new_node = Node(
                id=node_id,
                gps_coordinates="",
                battery_level=0,
                status="unknown"
            )
            db.add(new_node)
            db.commit()
    
    def _save_route(self, db: Session = Depends(get_db), route_data=None):
        # Convert strings to bytes
        source_id = route_data['reporting_node'].encode('utf-8')[:4]
        destination_id = route_data['destination'].encode('utf-8')[:4]
        next_hop_id = route_data['next_hop'].encode('utf-8')[:1]
        
        # Ensure nodes exist before creating route
        self._ensure_node_exists(db, source_id)
        self._ensure_node_exists(db, destination_id)
        
        # Check if route already exists (upsert logic)
        existing_route = db.query(Route).filter(
            Route.sequence_number == route_data['seq_no']
        ).first()
        
        if existing_route:
            # Update existing route
            existing_route.source = source_id
            existing_route.destination = destination_id
            existing_route.next_hop = next_hop_id
            existing_route.expiring_time = route_data['expiring_time']
            route = existing_route
        else:
            # Create new route
            route = Route(
                sequence_number=route_data['seq_no'],
                source=source_id,
                destination=destination_id,
                next_hop=next_hop_id,
                expiring_time=route_data['expiring_time']
            )
            db.add(route)
        
        db.commit()
        db.refresh(route)
        return route
    
    def _run(self):
        db = SessionLocal()
        try:
            for line in self.line_iter:
                if self._stop.is_set():
                    break
                parsed = parse_line(line)
                if not parsed:
                    continue
                if parsed and parsed["type"] == "route_update":
                    self._save_route(db, parsed)
                    self.broadcaster.publish(parsed)
        finally:
            db.close()