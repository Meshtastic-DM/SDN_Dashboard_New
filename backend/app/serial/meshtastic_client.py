import meshtastic
import meshtastic.serial_interface
from pubsub import pub
from app.services.db_update_service import update_nodes_db,update_message_db, get_messages_by_req_id_and_source
import asyncio
import os
import serial.tools.list_ports
import time
from datetime import datetime
from app.services.sdn_packet_handler import handle_SDN_route_update
# Protobuf imports for SDN and AODV packet parsing
from app.generated import sdn_pb2, aodv_pb2, portnums_pb2

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
        payload = decoded.get('payload', b'')
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
                ru = sdn_msg.route_update
                source = hex(packet.get('from'))
                destination = hex(ru.destination)
                next_hop = hex(ru.next_hop)
                hop_count = ru.hop_count
                timestamp = ru.timestamp
                dest_seq_num = ru.dest_seq_num
                # print(f"  Destination: {hex(ru.destination)}")
                # print(f"  Next Hop: {hex(ru.next_hop)}")
                # print(f"  Hop Count: {ru.hop_count}")
                # print(f"  Dest Seq Num: {ru.dest_seq_num}")
                # print(f"  Timestamp: {ru.timestamp}")
                handle_SDN_route_update(source, destination, hop_count, next_hop, timestamp, dest_seq_num, interface.app)
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
                lq = sdn_msg.link_quality
                print(f"  Relay Nodes: {[hex(n) for n in lq.relay_node]}")
                print(f"  RX Good: {list(lq.rx_good)}")
                print(f"  RX Bad: {list(lq.rx_bad)}")
                print(f"  Channel Util: {getattr(lq, 'channel_utilization', 'N/A')}")
                print(f"  Air Util TX: {getattr(lq, 'air_util_tx', 'N/A')}")
            else:
                print("  Type: Unknown SDN message")
                print(f"  SDN Raw: {sdn_msg}")
        except Exception as e:
            print(f"  (SDN Parse error: {e})")
            print(f"  Raw payload length: {len(payload)} bytes")
    
    # AODV packets
    elif portnum_val == portnums_pb2.PortNum.AODV_ROUTING_APP:
        print(f"🗺️  AODV PACKET:")
        payload = decoded.get('payload', b'')
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
    
    elif decoded.get("portnum") == "TEXT_MESSAGE_APP":
        source_hex = hex(packet.get("from"))
        destination_hex = hex(packet.get("to"))
        # Convert hex to bytes for database (strip '0x' prefix)
        source_bytes = bytes.fromhex(source_hex[2:])
        destination_bytes = bytes.fromhex(destination_hex[2:])
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
        #print(f"Received telemetry packet: {decoded}")
        changed_nodes = update_nodes_db(interface)
        if (len(changed_nodes) > 0):
            for node in changed_nodes:
                publish_node_update_to_websocket(interface.app, node)
            

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


def get_meshtastic_port():
    ports: meshtastic.serial_interface.List[str] = meshtastic.util.findPorts(True)
    return ports


def start_meshtastic_client(app, devPath=None):
    """Function to start the Meshtastic client and listen for packets"""
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
        update_nodes_db(interface)  # Initial fetch of nodes to populate database
    except SystemExit as e:
        # Catch sys.exit() calls from Meshtastic library
        print(f"⚠️  Meshtastic client failed to start (SystemExit: {e})")
        print(f"   Check that {devPath} is the correct port and device is connected.")
        raise ValueError(f"Meshtastic client failed to start: {e}")
    except Exception as e:
        print(f"⚠️  Error starting Meshtastic client: {e}")
        print(f"   Application will continue without Meshtastic integration.")
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
        print(f"✓ Sent message to {destination}: {text}")
        return sent.id
    except Exception as e:
        print(f"⚠️  Error sending message: {e}")
        raise ValueError(f"Failed to send text message: {e}")
    