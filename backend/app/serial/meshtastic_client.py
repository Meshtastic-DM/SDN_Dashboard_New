import base64

import meshtastic
import meshtastic.serial_interface
from pubsub import pub
from app.core.database import SessionLocal
from app.models.node import Node
from app.services.db_update_service import set_last_heard_now, update_nodes_db,update_message_db, get_messages_by_req_id_and_source
import asyncio
import os
import serial.tools.list_ports
import time
from datetime import datetime
from app.services.sdn_packet_handler import handle_SDN_route_update
# Protobuf imports for SDN and AODV packet parsing
from app.generated import sdn_pb2, aodv_pb2, portnums_pb2

# Try to import AdminMessage from meshtastic for admin packet handling
try:
    from meshtastic import admin_pb2
    HAS_ADMIN_PROTO = True
except ImportError:
    HAS_ADMIN_PROTO = False


def _extract_payload_bytes(decoded):
    payload = decoded.get("payload")
    if payload is None:
        return b""
    if isinstance(payload, str):
        return base64.b64decode(payload)
    return bytes(payload)


def publish_text_to_websocket(app, message:dict):
    """Utility function to publish text message updates to the frontend via WebSocket"""
    broadcaster = app.state.text_message_broadcaster  # Use separate broadcaster for texts
    broadcaster.publish(message)
    print(f"Published text message to WebSocket: {message}")

def publish_node_update_to_websocket(app, node_info:dict):
    """Utility function to publish node updates to the frontend via WebSocket"""
    broadcaster = app.state.node_update_broadcaster  # Use separate broadcaster for node updates
    broadcaster.publish(node_info)
    print(f"Published node update to WebSocket: {node_info}")


def refresh_nodes_db_and_publish(interface):
    """Sync iface.nodes into the DB and publish only changed node records."""
    changed_nodes = update_nodes_db(interface)
    if len(changed_nodes) > 0 and getattr(interface, "app", None):
        for node in changed_nodes:
            publish_node_update_to_websocket(interface.app, node)


def update_node_owner_from_admin(node_id, long_name):
    """Update one node's owner name from an admin get_owner_response."""
    db = SessionLocal()
    try:
        if isinstance(node_id, bytes):
            node_id_bytes = node_id
        elif isinstance(node_id, int):
            node_id_bytes = node_id.to_bytes(4, byteorder="big", signed=False)
        else:
            return None

        node = db.query(Node).filter(Node.id == node_id_bytes).first()
        if node:
            node.long_name = long_name
            node.last_heard = int(time.time())
            if node.status != "online":
                node.status = "online"
        else:
            node = Node(
                id=node_id_bytes,
                long_name=long_name,
                last_heard=int(time.time()),
                status="online",
            )
            db.add(node)

        db.commit()
        return {
            "id": node.id.hex(),
            "long_name": node.long_name,
            "hw_model": node.hw_model,
            "snr": node.snr,
            "battery_level": node.battery_level,
            "status": node.status,
            "hops_away": node.hops_away,
            "gps_coordinates": node.gps_coordinates,
            "role": node.role,
        }
    except Exception as e:
        db.rollback()
        print(f"Error updating node owner from admin response: {e}")
        return None
    finally:
        db.close()

def _set_connection_status(app, *, connected: bool, status: str, message: str, interface=None):
    """Update the Meshtastic connection status in app state"""
    app.state.meshtastic_status = {
        "connected": connected,
        "status": status,
        "message": message,
        "port": getattr(app.state, "meshtastic_port", None),
        "nodeId": None,
    }

    if connected and interface and getattr(interface, "myInfo", None):
        app.state.meshtastic_status["nodeId"] = hex(interface.myInfo.my_node_num)
        app.state.meshtastic_interface = interface
    elif not connected:
        app.state.meshtastic_interface = None

def _handle_connection_event(interface=None, topic=pub.AUTO_TOPIC):
    """Handle Meshtastic connection and disconnection events"""
    app = getattr(interface, "app", None)
    if not app:
        return

    topic_name = topic.getName() if topic else ""
    if topic_name.endswith("connection.established"):
        _set_connection_status(
            app,
            connected=True,
            status="connected",
            message="Meshtastic device connected",
            interface=interface,
        )
        print("✓ Meshtastic connection established")
    elif topic_name.endswith("connection.lost"):
        _set_connection_status(
            app,
            connected=False,
            status="disconnected",
            message="Meshtastic serial port disconnected. Reconnect the device to the selected COM port to continue.",
        )
        print("✗ Meshtastic connection lost")

def on_receive(packet, interface):
    """Callback function to handle incoming Meshtastic packets"""
    # print(f"Received packet: {packet}")
    # Extract relevant information from the packet
    if packet.get("decoded") is None:
        return  # Ignore packets that can't be decoded
    decoded = packet["decoded"]
    portnum = decoded.get('portnum', 'Unknown')
    
    # Use portnums_pb2 for robust port number matching
    try:
        portnum_val = int(portnum) if isinstance(portnum, int) else getattr(portnums_pb2.PortNum, str(portnum), None)
    except Exception:
        portnum_val = None
    
    # SDN packets
    if portnum_val == portnums_pb2.PortNum.SDN_APP:
        print(f"🌐 SDN PACKET:")
        payload = _extract_payload_bytes(decoded)
        try:
            sdn_msg = sdn_pb2.SDN()
            sdn_msg.ParseFromString(payload)
            # Display SDN message type
            if sdn_msg.HasField("announcement"):
                print("  Type: SDN Announcement")
                print(f"  Reporter: {hex(packet.get('from'))}")
                ann = sdn_msg.announcement
                print(f"  HMAC Hash: {ann.hmac_hash.hex() if ann.hmac_hash else 'N/A'}")
                print(f"  Public Key: {ann.public_key.hex() if ann.public_key else 'N/A'}")
                print(f"  Sequence Num: {ann.sequence_num}")
                print(f"  Timestamp: {ann.timestamp}")
            elif sdn_msg.HasField("route_update"):
                print("  Type: Route Update")
                print(f"  Reporter: {hex(packet.get('from'))}")
                set_last_heard_now(packet.get("from"))  # Update last heard timestamp for reporting node in database
                ru = sdn_msg.route_update
                reporter = hex(packet.get('from'))
                destination = hex(ru.destination) if isinstance(ru.destination, int) else ru.destination.hex()
                next_hop = ru.next_hop if isinstance(ru.next_hop, int) else int.from_bytes(ru.next_hop, 'big')
                hop_count = ru.hop_count
                timestamp = ru.timestamp
                dest_seq_num = ru.dest_seq_num
                # print(f"  Destination: {hex(ru.destination)}") 
                # print(f"  Next Hop: {hex(ru.next_hop)}")
                # print(f"  Hop Count: {ru.hop_count}")
                # print(f"  Dest Seq Num: {ru.dest_seq_num}")
                # print(f"  Timestamp: {ru.timestamp}")
                handle_SDN_route_update(reporter, destination, hop_count, next_hop, timestamp, dest_seq_num, interface.app)
            elif sdn_msg.HasField("route_command"):
                print("  Type: Route Command")
                print(f"  Reporter: {hex(packet.get('from'))}")
                rc = sdn_msg.route_command
                print(f"  Destination: {hex(rc.destination)}")
                print(f"  Next Hop: {hex(rc.next_hop)}")
            elif sdn_msg.HasField("route_install"):
                print("  Type: Route Install")
                print(f"  Reporter: {hex(packet.get('from'))}")
                ri = sdn_msg.route_install
                print(f"  Destination: {hex(ri.destination)}")
                print(f"  Hop Path: {hex(ri.hop_path)}")
                print(f"  Install ID: {ri.install_id}")
            elif sdn_msg.HasField("route_set"):
                print("  Type: Route Set")
                print(f"  Reporter: {hex(packet.get('from'))}")
                rs = sdn_msg.route_set
                print(f"  Destination: {hex(rs.destination)}")
                print(f"  Hop Path: {hex(rs.hop_path)}")
                print(f"  Install ID: {rs.install_id}")
            elif sdn_msg.HasField("route_set_confirm"):
                print("  Type: Route Set Confirm")
                print(f"  Reporter: {hex(packet.get('from'))}")
                rsc = sdn_msg.route_set_confirm
                print(f"  Destination: {hex(rsc.destination)}")
                print(f"  Install ID: {rsc.install_id}")
                print(f"  Success: {rsc.success}")
                print(f"  Error Message: {rsc.error_msg if rsc.error_msg else 'N/A'}")
            elif sdn_msg.HasField("link_quality"):
                print("  Type: Link Quality Report")
                print(f"  Reporter: {hex(packet.get('from'))}")
                set_last_heard_now(packet.get("from"))  # Update last heard timestamp for reporting node in database
                lq = sdn_msg.link_quality
                print(f"  Relay Nodes: {[hex(n) for n in lq.relay_node]}")
                print(f"  RX Good: {list(lq.rx_good)}")
                print(f"  RX Bad: {list(lq.rx_bad)}")
                print(f"  Channel Util: {getattr(lq, 'channel_utilization', 'N/A')}")
                print(f"  Air Util TX: {getattr(lq, 'air_util_tx', 'N/A')}")
                
                # Save link quality report to database
                try:
                    from app.services.link_quality_service import save_link_quality_report
                    reporter_bytes = packet.get('from').to_bytes(4, byteorder='big')
                    relay_nodes = [n.to_bytes(4, byteorder='big') for n in lq.relay_node]
                    save_link_quality_report(
                        reporter=reporter_bytes,
                        relay_nodes=relay_nodes,
                        rx_good=list(lq.rx_good),
                        rx_bad=list(lq.rx_bad),
                        channel_util=getattr(lq, 'channel_utilization', 0.0),
                        air_util_tx=getattr(lq, 'air_util_tx', 0.0)
                    )
                except Exception as e:
                    print(f" Failed to save link quality report: {e}")
            else:
                print("  Type: Unknown SDN message")
                print(f"  SDN Raw: {sdn_msg}")
        except Exception as e:
            print(f"  (SDN Parse error: {e})")
            print(f"  Raw payload length: {len(payload)} bytes")
    
    # AODV packets
    elif portnum_val == portnums_pb2.PortNum.AODV_ROUTING_APP:
        print(f"🗺️  AODV PACKET:")
        payload = _extract_payload_bytes(decoded)
        try:
            aodv_msg = aodv_pb2.AODV()
            aodv_msg.ParseFromString(payload)
            if aodv_msg.HasField("rreq"):
                print("  Type: Route Request (RREQ)")
                print(f"  RREQ: {aodv_msg.rreq}")
            elif aodv_msg.HasField("rrep"):
                print("  Type: Route Reply (RREP)")
                print(f"  RREP: {aodv_msg.rrep}")
            elif aodv_msg.HasField("rerr"):
                print("  Type: Route Error (RERR)")
                print(f"  RERR: {aodv_msg.rerr}")
            else:
                print("  Type: Unknown AODV message")
                print(f"  AODV Raw: {aodv_msg}")
        except Exception as e:
            print(f"  (AODV Parse error: {e})")
            print(f"  Raw payload length: {len(payload)} bytes")
    
    # Admin messages (request/response packets)
    elif portnum_val == portnums_pb2.PortNum.ADMIN_APP and HAS_ADMIN_PROTO:
        print(f"⚙️  ADMIN MESSAGE:")
        payload = _extract_payload_bytes(decoded)
        from_node = hex(packet.get('from'))
        to_node = hex(packet.get('to'))
        
        print(f"  From: {from_node}")
        print(f"  To: {to_node}")
        print(f"  Payload Size: {len(payload)} bytes")
        print(f"  Payload (hex): {payload.hex()}")
        
        try:
            admin_msg = admin_pb2.AdminMessage()
            admin_msg.ParseFromString(payload)
            
            # Debug: show all set fields in the admin message
            print(f"  [DEBUG] AdminMessage set fields: {[f.name for f, v in admin_msg.ListFields()]}")
            
            # Identify which field is set in the AdminMessage
            if admin_msg.HasField("get_owner_request"):
                print(f"  Type: Get Owner Request")
                print(f"  Value: {admin_msg.get_owner_request}")
            elif admin_msg.HasField("get_owner_response"):
                print(f"  Type: Get Owner Response")
                response = admin_msg.get_owner_response
                print(f"    long_name: '{response.long_name}'")
                print(f"    short_name: '{response.short_name}'")
                print(f"    is_licensed: {response.is_licensed}")
                updated_node = update_node_owner_from_admin(packet.get("from"), response.long_name)
                if updated_node and getattr(interface, "app", None):
                    publish_node_update_to_websocket(interface.app, updated_node)
                
                # Debug: Print all available fields in response
                print(f"    [DEBUG] Response object type: {type(response)}")
                print(f"    [DEBUG] Response fields: {response.ListFields()}")
                print(f"    [DEBUG] Response descriptor: {response.DESCRIPTOR}")
                if hasattr(response, 'DESCRIPTOR'):
                    print(f"    [DEBUG] Available fields in schema:")
                    for field in response.DESCRIPTOR.fields_by_name:
                        field_value = getattr(response, field, None)
                        print(f"      - {field}: {field_value} (type: {type(field_value).__name__})")
                
                # Extract and cache the session_passkey from the AdminMessage
                # Per firmware protocol: session_passkey is directly on AdminMessage, not nested in get_owner_response
                from_node = packet.get("from")
                try:
                    # session_passkey field is directly on the AdminMessage
                    session_key = bytes(admin_msg.session_passkey)
                    passkey_size = len(session_key)
                    if passkey_size == 8:
                        
                        print(f"    ✅ [SESSION] Found session_passkey: {session_key.hex()} (len={passkey_size})")
                        
                        # Cache the passkey bytes
                        from app.services.admin_service import SESSION_KEY_CACHE
                        SESSION_KEY_CACHE[from_node] = (session_key, time.time())
                        print(f"    ✅ [CACHE] Session passkey cached for node {hex(from_node)}")
                    else:
                        print(f"    ⚠️  [SESSION] No session_passkey field in AdminMessage")
                        print(f"    [DEBUG] AdminMessage fields: {[field.name for field, _ in admin_msg.ListFields()]}")
                except Exception as e:
                    import traceback
                    print(f"    ⚠️  [CACHE] Error extracting session passkey: {e}")
                    traceback.print_exc()
                        
                        
            elif admin_msg.HasField("set_owner"):
                print(f"  Type: Set Owner Response")
                owner = admin_msg.set_owner
                print(f"    long_name: '{owner.long_name}'")
                print(f"    short_name: '{owner.short_name}'")
                print(f"    is_licensed: {owner.is_licensed}")
            elif admin_msg.HasField("get_config_request"):
                print(f"  Type: Get Config Request")
                print(f"  Config Type: {admin_msg.get_config_request}")
            elif admin_msg.HasField("get_channel_request"):
                print(f"  Type: Get Channel Request")
                print(f"  Channel Num: {admin_msg.get_channel_request}")
            elif admin_msg.HasField("reboot_seconds"):
                print(f"  Type: Reboot Request")
                print(f"  Delay Seconds: {admin_msg.reboot_seconds}")
            elif admin_msg.HasField("shutdown_seconds"):
                print(f"  Type: Shutdown Request")
                print(f"  Delay Seconds: {admin_msg.shutdown_seconds}")
            else:
                print(f"  Type: Unknown Admin Message (not a known field)")
                print(f"  [DEBUG] Message type check:")
                print(f"    - HasField('get_owner_response'): {admin_msg.HasField('get_owner_response') if hasattr(admin_msg, 'HasField') else 'N/A'}")
                print(f"  [DEBUG] All set fields:")
                for field, value in admin_msg.ListFields():
                    print(f"    - {field.name}: {value}")
                print(f"  [DEBUG] Full message: {admin_msg}")
                
        except Exception as e:
            import traceback
            print(f"  (Admin Parse error: {e})")
            traceback.print_exc()
            print(f"  Raw payload length: {len(payload)} bytes")
    
    elif decoded.get("portnum") == "TEXT_MESSAGE_APP":
        source_int = packet.get("from")
        destination_int = packet.get("to")

        # Convert integers to bytes for database (4 bytes, big-endian)
        source_bytes = source_int.to_bytes(4, byteorder='big')
        destination_bytes = destination_int.to_bytes(4, byteorder='big')
        set_last_heard_now(source_bytes)  # Update last heard timestamp for source node in database
        # Convert to hex strings for display/conversation IDs
        source_hex = hex(source_int)
        destination_hex = hex(destination_int)
        text = decoded.get("text")  # Remove trailing comma - it was creating a tuple!
        rssi = packet.get("rxRssi")
        id = packet.get("id")
        channel = packet.get("channel")
        timestamp_now = time.time()
        
        # Determine conversation ID: broadcast vs 1:1
        if destination_hex == "0xffffffff":  # Broadcast message
            conversation = destination_hex
        else:
            conversation = source_hex  # Use source as conversation ID for 1:1 messages
        
        # Create a message dict for database (with bytes and datetime)
        message_db = {
            "source": source_bytes,
            "destination": destination_bytes,
            "text": text,
            "timestamp": datetime.fromtimestamp(timestamp_now),
            "rssi": rssi,
            "id": id,
            "channel": channel,
            "conversation": conversation,
            "sent_by_me": False
        }
        
        # Create a message dict for WebSocket (with hex strings and float timestamp)
        message_ws = {
            "source": source_hex,
            "destination": destination_hex,
            "text": text,
            "timestamp": timestamp_now,
            "rssi": rssi,
            "id": id,
            "channel": channel,
            "conversation": conversation,
            "sent_by_me": False,
        }
        
        update_message_db(interface, message_db)  # Update the database with the new message
        # Publish the message to the frontend via WebSocket
        publish_text_to_websocket(interface.app, message_ws)
    
    elif decoded.get("portnum") == "TELEMETRY_APP":
        print(f"Received telemetry packet: {decoded}")
            

    elif decoded.get("portnum") == "ROUTING_APP":
        #print(f"Received routing packet: {packet}")
        routing = decoded.get("routing") or {}

        # This is the ID of the original packet being ACKed/NAKed
        req_id = decoded.get("requestId") or routing.get("request_id")
        
        # Convert source to bytes for database lookup
        if interface and interface.myInfo:
            source_int = interface.myInfo.my_node_num
            source_bytes = source_int.to_bytes(4, byteorder='big')
        else:
            return
            
        message = get_messages_by_req_id_and_source(req_id, source_bytes)  # Fetch message from database to update ACK status and timestamp
        if message is None:
            return
        # If present => NAK (delivery failed / no route / timeout etc.)
        error_reason = routing.get("errorReason") or routing.get("error_reason")

        status = "NAKED" if error_reason != "NONE" else "ACKED"

        message.ack_status = status
        message.ack_timestamp = datetime.fromtimestamp(time.time())
        update_message_db(interface, message.__dict__)  # Update message in database with new ACK status and timestamp
        # Push receipt update to frontend
        publish_text_to_websocket(interface.app, {
            "id": message.mes_id,
            "source": hex(int.from_bytes(message.source_id, byteorder='big')),
            "destination": hex(int.from_bytes(message.destination_id, byteorder='big')),
            "text": message.text,
            "timestamp": message.timestamp.timestamp(),
            "rssi": message.rssi,
            "channel": message.channel,
            "conversation": message.conversation,
            "sent_by_me": message.sent_by_me,
            "ack_status": message.ack_status,
            "ack_timestamp": message.ack_timestamp.timestamp() if message.ack_timestamp else None
        }) 

    if getattr(interface, "nodes", None):
        refresh_nodes_db_and_publish(interface)


def get_meshtastic_port():
    ports: meshtastic.serial_interface.List[str] = meshtastic.util.findPorts(True)
    return ports


def start_meshtastic_client(app, devPath=None):
    """Function to start the Meshtastic client and listen for packets"""
    app.state.meshtastic_port = devPath
    _set_connection_status(
        app,
        connected=False,
        status="connecting",
        message="Connecting to Meshtastic device...",
    )

    # Unsubscribe any existing handlers before subscribing new ones
    try:
        pub.unsubscribe(_handle_connection_event, "meshtastic.connection.established")
    except Exception:
        pass
    try:
        pub.unsubscribe(_handle_connection_event, "meshtastic.connection.lost")
    except Exception:
        pass
    
    # Subscribe to connection events
    pub.subscribe(_handle_connection_event, "meshtastic.connection.established")
    pub.subscribe(_handle_connection_event, "meshtastic.connection.lost")

    # If no port specified, try to detect it
    if not devPath:
        ports = get_meshtastic_port()
        if len(ports) == 0:
            raise ValueError("No Meshtastic-compatible serial ports found. Please connect a device or specify the port using the MESHTASTIC_PORT environment variable.")
            return
        elif len(ports) > 1:
            print(f"Multiple potential Meshtastic ports found: {ports}")
            return
    try:
        # Create interface with specified port
        if devPath:
            interface = meshtastic.serial_interface.SerialInterface(devPath=devPath)
        else:
            interface = meshtastic.serial_interface.SerialInterface()
        
        app.state.meshtastic_interface = interface  # Store interface in app state for access in callbacks
        interface.app = app  # Attach app reference for WebSocket publishing
        pub.subscribe(on_receive, "meshtastic.receive")
        print(f"✓ Meshtastic client started on {devPath} and listening for packets...")
        _set_connection_status(
            app,
            connected=True,
            status="connected",
            message="Meshtastic device connected",
            interface=interface,
        )
        update_nodes_db(interface)  # Initial fetch of nodes to populate database
    except SystemExit as e:
        # Catch sys.exit() calls from Meshtastic library
        print(f"⚠️  Meshtastic client failed to start (SystemExit: {e})")
        print(f"   Check that {devPath} is the correct port and device is connected.")
        _set_connection_status(
            app,
            connected=False,
            status="error",
            message=f"Meshtastic client failed to start: {e}",
        )
        raise ValueError(f"Meshtastic client failed to start: {e}")
    except Exception as e:
        print(f"⚠️  Error starting Meshtastic client: {e}")
        print(f"   Application will continue without Meshtastic integration.")
        _set_connection_status(
            app,
            connected=False,
            status="error",
            message=f"Meshtastic client failed to start: {e}",
        )
        raise ValueError(f"Meshtastic client failed to start: {e}")



def send_text_message_client(interface, destination, text):
    """Function to send a text message via the Meshtastic interface"""
    if not interface:
        print("⚠️  Cannot send message: Meshtastic interface not initialized.")
        return
    try:
        # Convert destination from string format (!6c7438c8) to integer
        if isinstance(destination, str):
            destination_int = int(destination.strip('!'), 16)
        else:
            destination_int = destination
            
        sent= interface.sendText(text, destinationId=destination_int, wantAck=True)
        interface.app.state.pending[sent.id] = {
            "destination": destination,
            "text": text,
            "status": "pending",
            "timestamp": time.time()
        }
        
        # Convert IDs to bytes for database
        source_bytes = interface.myInfo.my_node_num.to_bytes(4, byteorder='big')
        destination_bytes = destination_int.to_bytes(4, byteorder='big')
        
        message = {
            "id": sent.id,
            "source": source_bytes,
            "destination": destination_bytes,
            "text": text,
            "timestamp": datetime.fromtimestamp(time.time()),
            "conversation": hex(destination_int),
            "sent_by_me": True,
            "ack_status": "pending",
            "ack_timestamp": None
        }
        update_message_db(interface, message)  # Add sent message to database immediately
        
        # Publish to WebSocket immediately so UI shows the pending message
        publish_text_to_websocket(interface.app, {
            "id": sent.id,
            "source": hex(interface.myInfo.my_node_num),
            "destination": hex(destination_int),
            "text": text,
            "timestamp": time.time(),
            "conversation": hex(destination_int),
            "sent_by_me": True,
            "ack_status": "pending",
            "ack_timestamp": None,
            "rssi": None,
            "channel": None
        })
        
        print(f"✓ Sent message to {destination}: {text}")
        return sent.id
    except Exception as e:
        print(f"⚠️  Error sending message: {e}")
        raise ValueError(f"Failed to send text message: {e}")
    
