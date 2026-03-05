
from app.core.database import SessionLocal
from app.models.node import Node
from app.models.message import Message


def update_nodes_db(iface):
    """Function to fetch all nodes from the Meshtastic network and update the database"""
    nodes = iface.nodes
    db = SessionLocal()
    changed_nodes = []
    try:
        for node_id, node_data in nodes.items():
            node_id_bytes = bytes.fromhex(node_id.strip('!'))
            existing_node = db.query(Node).filter(Node.id == node_id_bytes).first()
            
            user_info = node_data.get('user', {})
            device_metrics = node_data.get('deviceMetrics', {})
            position_info = node_data.get('position', {})
            
            gps_coords = None
            if position_info.get('latitude') is not None and position_info.get('longitude') is not None:
                lat = position_info.get('latitude')
                lon = position_info.get('longitude')
                alt = position_info.get('altitude', 0)
                gps_coords = f"{lat},{lon},{alt}"
            
            last_heard = node_data.get('lastHeard')
            status = 'online' if last_heard else 'offline'
            
            node_changed = False
            if existing_node:
                # Check for changes before updating
                if (existing_node.long_name != user_info.get('longName') or
                    existing_node.battery_level != device_metrics.get('batteryLevel') or
                    existing_node.status != status or
                    existing_node.snr != node_data.get('snr')):
                    node_changed = True
                
                existing_node.long_name = user_info.get('longName')
                existing_node.hw_model = user_info.get('hwModel')
                existing_node.public_key = user_info.get('publicKey')
                existing_node.snr = node_data.get('snr')
                existing_node.battery_level = device_metrics.get('batteryLevel')
                existing_node.status = status
                existing_node.hops_away = node_data.get('hopsAway')
                if gps_coords:
                    existing_node.gps_coordinates = gps_coords
                node = existing_node
                print(f"Updated node: {node_id}")
            else:
                node_changed = True
                new_node = Node(
                    id=node_id_bytes,
                    long_name=user_info.get('longName'),
                    hw_model=user_info.get('hwModel'),
                    public_key=user_info.get('publicKey'),
                    snr=node_data.get('snr'),
                    battery_level=device_metrics.get('batteryLevel'),
                    status=status,
                    hops_away=node_data.get('hopsAway'),
                    gps_coordinates=gps_coords
                )
                db.add(new_node)
                node = new_node
                print(f"Created new node: {node_id}")
            
            if node_changed:
                # Convert node to dictionary before session closes
                node_dict = {
                    "id": node.id.hex(),
                    "long_name": node.long_name,
                    "hw_model": node.hw_model,
                    "snr": node.snr,
                    "battery_level": node.battery_level,
                    "status": node.status,
                    "hops_away": node.hops_away,
                    "gps_coordinates": node.gps_coordinates,
                    "role": node.role
                }
                changed_nodes.append(node_dict)
        
        db.commit()
        print(f"Successfully processed {len(nodes)} nodes")
        return changed_nodes
    except Exception as e:
        db.rollback()
        print(f"Error updating nodes database: {e}")
        return []
    finally:
        db.close()

def update_message_db(iface, message):
    """Function to update the database with a new message"""
    db = SessionLocal()
    try:
        # Get values first to avoid SQLAlchemy confusion with Python's 'or'
        mes_id = message.get('id') or message.get('mes_id')
        source_id = message.get('source') or message.get('source_id')
        
        # Query with both primary keys
        existing_message = db.query(Message).filter(
            Message.mes_id == mes_id,
            Message.source_id == source_id
        ).first()
        
        if not existing_message:
            # Create new Message object and add to database
            new_message = Message(
            mes_id=int(message.get('id') or message.get('mes_id')),
            source_id=message.get('source') or message.get('source_id'),
            destination_id=message.get('destination') or message.get('destination_id'),
            text=message.get('text'),
            timestamp=message.get('timestamp'),
            rssi=message.get('rssi'),
            channel=message.get('channel'),
            conversation=message.get('conversation'),
            sent_by_me = message.get('sent_by_me', False),
            ack_status = message.get('ack_status', 'pending'),
            ack_timestamp = message.get('ack_timestamp')
        )
            db.add(new_message)
            db.commit()
            print(f"Added new message from {new_message.source_id} to {new_message.destination_id} at {new_message.timestamp}")
        else:
            # Update existing message (if needed)
            # Only update non-None values to avoid overwriting existing data
            if message.get('destination') or message.get('destination_id'):
                existing_message.destination_id = message.get('destination') or message.get('destination_id')
            if message.get('text') is not None:
                existing_message.text = message.get('text')
            if message.get('rssi') is not None:
                existing_message.rssi = message.get('rssi')
            if message.get('channel') is not None:
                existing_message.channel = message.get('channel')
            if message.get('conversation') is not None:
                existing_message.conversation = message.get('conversation')
            if message.get('sent_by_me') is not None:
                existing_message.sent_by_me = message.get('sent_by_me')
            if message.get('ack_status') is not None:
                existing_message.ack_status = message.get('ack_status')
            if message.get('ack_timestamp') is not None:
                existing_message.ack_timestamp = message.get('ack_timestamp')
            db.commit()
            print(f"Updated existing message {existing_message.mes_id} with ack_status: {existing_message.ack_status}")
    except Exception as e:
        db.rollback()
        print(f"Error updating messages database: {e}")
    finally:
        db.close()


def get_messages_by_req_id_and_source(req_id, source_id):
    """Function to retrieve messages from the database based on request ID and source ID"""
    db = SessionLocal()
    try:
        message = db.query(Message).filter(
            Message.mes_id == req_id,
            Message.source_id == source_id
        ).first()
        return message
    except Exception as e:
        print(f"Error retrieving message: {e}")
        return None
    finally:
        db.close()

def get_messages_by_conversation(conversation):
    """Function to retrieve messages from the database based on conversation ID"""
    db = SessionLocal()
    try:
        messages = db.query(Message).filter(
            Message.conversation == conversation
        ).order_by(Message.timestamp).limit(1000).all()  # Limit to last 1000 messages for performance
        return messages
    except Exception as e:
        print(f"Error retrieving messages by conversation: {e}")
        return []
    finally:
        db.close() 