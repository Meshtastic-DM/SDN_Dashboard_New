from app.core.database import SessionLocal
    
def handle_SDN_route_update(source, destination,hop_count, next_hop, timestamp, dest_seq_num, app):
    """Function to handle incoming SDN route updates and broadcast them to connected clients"""
    broadcaster = app.state.broadcaster
    db = SessionLocal()
    route_update = {
        "source": source,
        "destination": destination,
        "hop_count": hop_count,
        "next_hop": next_hop,
        "timestamp": timestamp,
        "dest_seq_num": dest_seq_num
    }
    
    broadcaster.publish(route_update)
    print(f"Published SDN route update: {route_update}")