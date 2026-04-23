import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

# Add local protobuf module paths
PROTO_DIR = Path(__file__).resolve().parents[1] / "generated"
sys.path.insert(0, str(PROTO_DIR))

import app.generated.portnums_pb2 as portnums_pb2

from app.services.node_id_utils import format_hex_node_id, parse_hex_node_id

# Try to import AdminMessage from meshtastic or create a fallback
try:
    from meshtastic import admin_pb2
    HAS_ADMIN_PROTO = True
except ImportError:
    HAS_ADMIN_PROTO = False

# Session key cache: {node_id: (session_key_bytes, timestamp)}
# Session keys are valid for ~300 seconds
SESSION_KEY_CACHE: Dict[int, tuple] = {}
SESSION_KEY_TIMEOUT = 300  # seconds
SESSION_KEY_RESPONSE_TIMEOUT = 10.0  # seconds
SESSION_KEY_FETCH_ATTEMPTS = 3


def _coerce_session_passkey(session_passkey: Any) -> bytes:
    """Return a firmware-compatible 8-byte session passkey."""
    passkey = bytes(session_passkey or b"")
    if len(passkey) != 8:
        raise RuntimeError(f"Invalid session_passkey length; expected 8, got {len(passkey)}")
    return passkey


def get_or_refresh_session_key(
    app,
    target_node: str | int,
    force_refresh: bool = False,
    channel_index: int = 0,
) -> bytes:
    """
    Get a valid session key for the target node.
    If cached and not expired, return cached key.
    Otherwise, send a GET_OWNER request to obtain a fresh session key.
    
    Args:
        app: FastAPI application instance
        target_node: Target node ID as hex string or int
        
    Returns:
        Session key bytes (8 bytes)
    """
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    current_time = time.time()
    
    # Allow caller to force a fresh key fetch by clearing cache first.
    if force_refresh and target_node_id in SESSION_KEY_CACHE:
        del SESSION_KEY_CACHE[target_node_id]
        print(f"   [SESSION] Forced refresh: cleared cached key for {format_hex_node_id(target_node_id)}")

    # Check if we have a cached, non-expired session key
    if target_node_id in SESSION_KEY_CACHE:
        cached_key, cached_time = SESSION_KEY_CACHE[target_node_id]
        if current_time - cached_time < SESSION_KEY_TIMEOUT:
            print(f"   [SESSION] Using cached session key (age: {current_time - cached_time:.1f}s)")
            return _coerce_session_passkey(cached_key)
        else:
            print(f"   [SESSION] Cached session key expired (age: {current_time - cached_time:.1f}s)")
    
    # Need to fetch a fresh session key via get_owner
    print(f"   [SESSION] Fetching fresh session key from {format_hex_node_id(target_node_id)}...")
    
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    # Send get_owner request to obtain session_passkey
    msg = admin_pb2.AdminMessage()
    msg.get_owner_request = True
    payload = msg.SerializeToString()
    
    iface = app.state.meshtastic_interface
    if not iface:
        raise RuntimeError("Meshtastic interface not available")
    
    # Send the get_owner request with wantAck=True to request response with session key
    try:
        print(f"   📤 [SESSION] Sending get_owner_request to fetch session key...")
        time.sleep(0.2)
        iface.sendData(
            data=payload,
            destinationId=f"!{target_node_id:08x}",
            portNum=portnums_pb2.PortNum.ADMIN_APP,
            wantAck=True,  # Request ACK/response from firmware with session passkey
            wantResponse=True,  # Required so firmware sends get_owner_response
            channelIndex=channel_index,
        )
        
        # Wait for the response to be cached by on_receive callback
        # The on_receive handler will populate SESSION_KEY_CACHE when it receives get_owner_response
        wait_time = 0
        max_wait = SESSION_KEY_RESPONSE_TIMEOUT
        check_interval = 0.1  # Check every 100ms
        
        print(f"   ⏳ [SESSION] Polling for response (max {max_wait}s)...")
        
        while wait_time < max_wait:
            if target_node_id in SESSION_KEY_CACHE:
                cached_passkey, cached_time = SESSION_KEY_CACHE[target_node_id]
                # Session key must be 8 bytes for firmware validation.
                passkey_size = 0
                if hasattr(cached_passkey, 'size'):
                    passkey_size = cached_passkey.size
                    print(f"   [SESSION] Got passkey with size field: {passkey_size}")
                elif isinstance(cached_passkey, bytes):
                    passkey_size = len(cached_passkey)
                    print(f"   [SESSION] Got passkey as raw bytes, length: {passkey_size}")
                else:
                    print(f"   [DEBUG] Cached passkey type: {type(cached_passkey)}")
                
                if passkey_size == 8:
                    print(f"   [SESSION] Session passkey obtained and cached (size={passkey_size})")
                    return cached_passkey
                elif passkey_size > 0:
                    print(f"   [SESSION] Cached passkey has invalid size {passkey_size}, waiting for valid key...")
            else:
                # Log progress every 0.5 seconds
                if int(wait_time * 10) % 5 == 0:
                    print(f"   [SESSION] Still waiting... ({wait_time:.1f}s)")
            
            time.sleep(check_interval)
            wait_time += check_interval
        
        # If we timeout, check if we have any cached key and report exact size.
        if target_node_id in SESSION_KEY_CACHE:
            cached_passkey, cached_time = SESSION_KEY_CACHE[target_node_id]
            cached_len = len(cached_passkey) if isinstance(cached_passkey, (bytes, bytearray)) else 0
            raise RuntimeError(f"Session key timeout: cached key length is {cached_len}, expected 8")
        
        # Last resort: fail explicitly (no passkey available)
        print(f"   [SESSION] Timeout: No passkey response received within {max_wait}s")
        print(f"   [SESSION] SESSION_KEY_CACHE is empty for node {hex(target_node_id)}")
        raise RuntimeError(f"Session key timeout: no get_owner_response received within {max_wait}s")
        
    except Exception as e:
        print(f"   ❌ [SESSION] Failed to obtain session key: {str(e)}")
        raise


def send_admin_message(
    app,
    target_node: str | int,
    admin_message_bytes: bytes,
    channel_index: int = 0,
    want_ack: bool = False,
    want_response: bool = False,
) -> Dict[str, Any]:
    """
    Send a raw admin message to a target node.
    
    Args:
        app: FastAPI application instance
        target_node: Target node ID as hex string or int
        admin_message_bytes: Serialized AdminMessage protobuf bytes
        channel_index: Channel index to use
        want_ack: Whether to request acknowledgment
        
    Returns:
        Dictionary with send details
    """
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    # Get locally connected node info
    iface = app.state.meshtastic_interface
    local_node_id = None
    local_node_hex = None
    
    if iface and hasattr(iface, 'myInfo') and iface.myInfo:
        local_node_id = iface.myInfo.my_node_num
        local_node_hex = format_hex_node_id(local_node_id)
    
    is_local_node = (local_node_id == target_node_id) if local_node_id else False
    
    # Detailed console output
    print(f"📨 [ADMIN MESSAGE] Target: {target_hex}")
    print(f"   Local Node: {local_node_hex if local_node_hex else 'UNKNOWN'}")
    print(f"   Routing: {'SERIAL (direct)' if is_local_node else 'LORA (mesh network)'}")
    print(f"   Target ID (int): {target_node_id}")
    print(f"   Payload Size: {len(admin_message_bytes)} bytes")
    print(f"   Payload (hex): {admin_message_bytes.hex()}")
    print(f"   Channel: {channel_index}, Want ACK: {want_ack}")
    
    if not iface:
        print("❌ [ADMIN] Meshtastic interface is None - connection lost!")
        raise RuntimeError("Meshtastic interface not available")
    
    try:
        print(f"📤 [SEND] Sending admin packet via {'SERIAL' if is_local_node else 'LORA'} to {target_hex}")
        print(f"   Want ACK: {want_ack}")
        time.sleep(0.4)
        iface.sendData(
            data=admin_message_bytes,
            destinationId=f"!{target_node_id:08x}",
            portNum=portnums_pb2.PortNum.ADMIN_APP,
            wantAck=want_ack,
            wantResponse=want_response,
            channelIndex=channel_index,
        )
        print(f"✅ [ADMIN] Message sent successfully to {target_hex} via {'SERIAL' if is_local_node else 'LORA'}")
    except Exception as e:
        print(f"❌ [ADMIN SEND FAILED] Failed to send to {target_hex}: {str(e)}")
        raise
    
    return {
        "target_node": target_hex,
        "channel_index": channel_index,
        "want_ack": want_ack,
        "message_type": "admin",
        "payload_size": len(admin_message_bytes),
        "local_node": local_node_hex,
        "is_local_target": is_local_node,
        "delivery_type": "serial" if is_local_node else "lora",
        "want_response": want_response,
    }


def get_or_refresh_session_key_with_retry(
    app,
    target_node: str | int,
    force_refresh: bool = False,
    channel_index: int = 0,
    attempts: int = SESSION_KEY_FETCH_ATTEMPTS,
) -> bytes:
    """Retry session-key fetch to tolerate transient mesh/admin response loss."""
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            print(
                f"   [SESSION] Fetch attempt {attempt}/{attempts} "
                f"for {format_hex_node_id(parse_hex_node_id(target_node, field_name='target_node'))} "
                f"on channel {channel_index}"
            )
            return get_or_refresh_session_key(
                app,
                target_node,
                force_refresh=force_refresh if attempt == 1 else True,
                channel_index=channel_index,
            )
        except Exception as e:
            last_error = e
            print(f"   [SESSION] Attempt {attempt} failed: {e}")
            if attempt < attempts:
                time.sleep(0.5)
    raise RuntimeError(str(last_error))


def refresh_session_key(
    app,
    target_node: str | int,
    channel_index: int = 0,
) -> Dict[str, Any]:
    """Force-refresh session key for a target node and return key metadata."""
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)

    print(f"🔐 [SESSION_REFRESH] Target: {target_hex}")
    key = get_or_refresh_session_key_with_retry(
        app,
        target_node_id,
        force_refresh=True,
        channel_index=channel_index,
    )
    if not key:
        raise RuntimeError("Session key refresh failed: no key returned")

    key_len = len(key) if isinstance(key, (bytes, bytearray)) else 0
    if key_len != 8:
        raise RuntimeError(f"Session key refresh failed: expected 8 bytes, got {key_len}")

    _, cached_time = SESSION_KEY_CACHE.get(target_node_id, (None, time.time()))
    age_seconds = max(0.0, time.time() - cached_time)

    return {
        "operation": "session_key_refresh",
        "target_node": target_hex,
        "session_key_len": key_len,
        "session_key_hex": key.hex(),
        "cache_age_seconds": round(age_seconds, 3),
        "cache_timeout_seconds": SESSION_KEY_TIMEOUT,
    }


def send_set_owner(
    app,
    target_node: str | int,
    long_name: str = "",
    short_name: str = "",
    is_licensed: bool = False,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_owner admin message with session key authentication."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    print(f"📝 [SET_OWNER] Target: {target_hex}")
    print(f"   long_name: '{long_name}'")
    print(f"   short_name: '{short_name}'")
    print(f"   is_licensed: {is_licensed}")
    
    # Get or refresh session key for this node
    print(f"   🔐 [AUTH] Obtaining session key...")
    session_passkey = None
    try:
        # Force fresh key fetch before SET operation (GET first, then SET)
        session_passkey = _coerce_session_passkey(
            get_or_refresh_session_key_with_retry(
                app,
                target_node_id,
                force_refresh=True,
                channel_index=channel_index,
            )
        )
    except Exception as e:
        print(f"   ⚠️  [AUTH] Session key fetch failed: {str(e)}")
    
    try:
        msg = admin_pb2.AdminMessage()
        msg.set_owner.long_name = long_name
        msg.set_owner.short_name = short_name
        msg.set_owner.is_licensed = is_licensed
        
        # Set the session passkey directly on the AdminMessage (per firmware protocol)
        if session_passkey:
            msg.session_passkey = session_passkey
            print(f"   🔑 [PASSKEY] session_passkey set ({len(session_passkey)} bytes: {session_passkey.hex()})")
        else:
            raise RuntimeError("No valid session key available for set_owner")
        
        payload = msg.SerializeToString()
        print(f"   📦 [PACKET] Serialized - payload size: {len(payload)} bytes")
        print(f"   📦 [PACKET] Payload (hex): {payload.hex()}")
        
        result = send_admin_message(app, target_node_id, payload, channel_index, True, True)
        try:
            from app.serial.meshtastic_client import update_node_owner_from_admin

            updated_node = update_node_owner_from_admin(target_node_id, long_name)
            broadcaster = getattr(app.state, "node_update_broadcaster", None)
            if updated_node and broadcaster:
                broadcaster.publish(updated_node)
        except Exception as local_update_error:
            print(f"   [SET_OWNER] Local dashboard update failed: {local_update_error}")

        time.sleep(2.0)
        try:
            refresh_result = send_get_owner(app, target_node_id, channel_index, True)
        except Exception as refresh_error:
            print(f"   ⚠️  [SET_OWNER] Follow-up get_owner failed: {refresh_error}")
            refresh_result = {"status": "failed", "error": str(refresh_error)}
        result.update({
            "operation": "set_owner",
            "long_name": long_name,
            "short_name": short_name,
            "is_licensed": is_licensed,
            "auth_method": "session_key",
            "requested_want_ack": want_ack,
            "follow_up_get_owner": refresh_result,
        })
        return result
    except Exception as e:
        print(f"   ❌ [SET_OWNER] Error: {str(e)}")
        raise


def send_reboot(
    app,
    target_node: str | int,
    delay_seconds: int = 0,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send reboot admin message with session key authentication."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    print(f"🔄 [REBOOT] Target: {target_hex}")
    print(f"   delay_seconds: {delay_seconds}")
    
    # Get or refresh session key for this node
    print(f"   🔐 [AUTH] Obtaining session key...")
    session_passkey = None
    try:
        # Force fresh key fetch before SET operation (GET first, then SET)
        session_passkey = get_or_refresh_session_key_with_retry(
            app,
            target_node_id,
            force_refresh=True,
            channel_index=channel_index,
        )
    except Exception as e:
        print(f"   ⚠️  [AUTH] Session key fetch failed: {str(e)}")
    
    try:
        msg = admin_pb2.AdminMessage()
        msg.reboot_seconds = delay_seconds
        
        # Set the session passkey directly on the AdminMessage (per firmware protocol)
        if session_passkey:
            msg.session_passkey = session_passkey
            print(f"   🔑 [PASSKEY] session_passkey set ({len(session_passkey)} bytes: {session_passkey.hex()})")
        else:
            raise RuntimeError("No valid session key available for reboot")
        
        payload = msg.SerializeToString()
        print(f"   📋 [PACKET] Serialized - payload size: {len(payload)} bytes")
        print(f"   📋 [PACKET] Payload (hex): {payload.hex()}")
        
        result = send_admin_message(app, target_node_id, payload, channel_index, want_ack)
        result.update({
            "operation": "reboot",
            "delay_seconds": delay_seconds,
            "auth_method": "session_key",
        })
        return result
    except Exception as e:
        print(f"   ❌ [REBOOT] Error: {str(e)}")
        raise


def send_shutdown(
    app,
    target_node: str | int,
    delay_seconds: int = 0,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send shutdown admin message with session key authentication."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    print(f"⚠️  [SHUTDOWN] Target: {target_hex}")
    print(f"   delay_seconds: {delay_seconds}")
    
    # Get or refresh session key for this node
    print(f"   🔐 [AUTH] Obtaining session key...")
    session_passkey = None
    try:
        # Force fresh key fetch before SET operation (GET first, then SET)
        session_passkey = get_or_refresh_session_key_with_retry(
            app,
            target_node_id,
            force_refresh=True,
            channel_index=channel_index,
        )
    except Exception as e:
        print(f"   ⚠️  [AUTH] Session key fetch failed: {str(e)}")
    
    try:
        msg = admin_pb2.AdminMessage()
        msg.shutdown_seconds = delay_seconds
        
        # Set the session passkey directly on the AdminMessage (per firmware protocol)
        if session_passkey:
            msg.session_passkey = session_passkey
            print(f"   🔑 [PASSKEY] session_passkey set ({len(session_passkey)} bytes: {session_passkey.hex()})")
        else:
            raise RuntimeError("No valid session key available for shutdown")
        
        payload = msg.SerializeToString()
        print(f"   📋 [PACKET] Serialized - payload size: {len(payload)} bytes")
        print(f"   📋 [PACKET] Payload (hex): {payload.hex()}")
        
        result = send_admin_message(app, target_node_id, payload, channel_index, want_ack)
        result.update({
            "operation": "shutdown",
            "delay_seconds": delay_seconds,
            "auth_method": "session_key",
        })
        return result
    except Exception as e:
        print(f"   ❌ [SHUTDOWN] Error: {str(e)}")
        raise


def send_factory_reset(
    app,
    target_node: str | int,
    reset_type: int = 0,  # 0=config_only, 1=full_device
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send factory reset admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    if reset_type == 1:
        msg.factory_reset_device = True
    else:
        msg.factory_reset_config = True
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "factory_reset",
        "reset_type": "full_device" if reset_type == 1 else "config_only",
    })
    return result


def send_nodedb_reset(
    app,
    target_node: str | int,
    reset_nodedb_and_clear_favorites: bool = False,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send NodeDB reset admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.nodedb_reset = reset_nodedb_and_clear_favorites
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "nodedb_reset",
        "clear_favorites": reset_nodedb_and_clear_favorites,
    })
    return result


def send_set_favorite_node(
    app,
    target_node: str | int,
    node_to_favorite: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_favorite_node admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    node_id = parse_hex_node_id(node_to_favorite, field_name="node_to_favorite")
    
    msg = admin_pb2.AdminMessage()
    msg.set_favorite_node = node_id
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "set_favorite_node",
        "node_id": format_hex_node_id(node_id),
    })
    return result


def send_remove_favorite_node(
    app,
    target_node: str | int,
    node_to_remove: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send remove_favorite_node admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    node_id = parse_hex_node_id(node_to_remove, field_name="node_to_remove")
    
    msg = admin_pb2.AdminMessage()
    msg.remove_favorite_node = node_id
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "remove_favorite_node",
        "node_id": format_hex_node_id(node_id),
    })
    return result


def send_set_ignored_node(
    app,
    target_node: str | int,
    node_to_ignore: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_ignored_node admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    node_id = parse_hex_node_id(node_to_ignore, field_name="node_to_ignore")
    
    msg = admin_pb2.AdminMessage()
    msg.set_ignored_node = node_id
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "set_ignored_node",
        "node_id": format_hex_node_id(node_id),
    })
    return result


def send_remove_ignored_node(
    app,
    target_node: str | int,
    node_to_unignore: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send remove_ignored_node admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    node_id = parse_hex_node_id(node_to_unignore, field_name="node_to_unignore")
    
    msg = admin_pb2.AdminMessage()
    msg.remove_ignored_node = node_id
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "remove_ignored_node",
        "node_id": format_hex_node_id(node_id),
    })
    return result


def send_set_fixed_position(
    app,
    target_node: str | int,
    latitude: float,
    longitude: float,
    altitude: int = 0,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_fixed_position admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.set_fixed_position.latitude_i = int(latitude * 1e7)
    msg.set_fixed_position.longitude_i = int(longitude * 1e7)
    msg.set_fixed_position.altitude = altitude
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "set_fixed_position",
        "latitude": latitude,
        "longitude": longitude,
        "altitude": altitude,
    })
    return result


def send_remove_fixed_position(
    app,
    target_node: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send remove_fixed_position admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.remove_fixed_position = True
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "remove_fixed_position",
    })
    return result


def send_set_time_only(
    app,
    target_node: str | int,
    timestamp: int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_time_only admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.set_time_only = timestamp
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "set_time_only",
        "timestamp": timestamp,
    })
    return result


def send_set_ham_mode(
    app,
    target_node: str | int,
    call_sign: str,
    short_name: str,
    tx_power: int = 20,
    frequency: int = 0,
    channel_index: int = 0,
    want_ack: bool = False,
) -> Dict[str, Any]:
    """Send set_ham_mode admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.set_ham_mode.call_sign = call_sign
    msg.set_ham_mode.short_name = short_name
    msg.set_ham_mode.tx_power = tx_power
    msg.set_ham_mode.frequency = frequency
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack)
    result.update({
        "operation": "set_ham_mode",
        "call_sign": call_sign,
        "short_name": short_name,
        "tx_power": tx_power,
    })
    return result


# Configuration setters (more complex, require building Config protobuf)
def send_get_owner(
    app,
    target_node: str | int,
    channel_index: int = 0,
    want_ack: bool = True,
) -> Dict[str, Any]:
    """Send get_owner admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    print(f"🔍 [GET_OWNER] Target: {target_hex}")
    
    msg = admin_pb2.AdminMessage()
    msg.get_owner_request = True
    
    payload = msg.SerializeToString()
    print(f"   Serialized payload: {len(payload)} bytes - {payload.hex()}")
    
    result = send_admin_message(app, target_node_id, payload, channel_index, want_ack, True)
    result.update({
        "operation": "get_owner",
    })
    return result


def send_get_config(
    app,
    target_node: str | int,
    config_type: int,
    channel_index: int = 0,
    want_ack: bool = True,
) -> Dict[str, Any]:
    """Send get_config admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    target_hex = format_hex_node_id(target_node_id)
    
    print(f"🔍 [GET_CONFIG] Target: {target_hex}")
    print(f"   config_type: {config_type}")
    
    msg = admin_pb2.AdminMessage()
    msg.get_config_request = config_type
    
    payload = msg.SerializeToString()
    print(f"   Serialized payload: {len(payload)} bytes - {payload.hex()}")
    
    result = send_admin_message(app, target_node_id, payload, channel_index, want_ack, True)
    result.update({
        "operation": "get_config",
        "config_type": config_type,
    })
    return result


def send_get_channel(
    app,
    target_node: str | int,
    channel_num: int,
    want_ack: bool = True,
) -> Dict[str, Any]:
    """Send get_channel admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.get_channel_request = channel_num
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), 0, want_ack, True)
    result.update({
        "operation": "get_channel",
        "channel_num": channel_num,
    })
    return result


def send_get_device_metadata(
    app,
    target_node: str | int,
    channel_index: int = 0,
    want_ack: bool = True,
) -> Dict[str, Any]:
    """Send get_device_metadata admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.get_device_metadata_request = True
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack, True)
    result.update({
        "operation": "get_device_metadata",
    })
    return result


def send_get_device_connection_status(
    app,
    target_node: str | int,
    channel_index: int = 0,
    want_ack: bool = True,
) -> Dict[str, Any]:
    """Send get_device_connection_status admin message."""
    if not HAS_ADMIN_PROTO:
        raise RuntimeError("AdminMessage protobuf not available")
    
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    
    msg = admin_pb2.AdminMessage()
    msg.get_device_connection_status_request = True
    
    result = send_admin_message(app, target_node_id, msg.SerializeToString(), channel_index, want_ack, True)
    result.update({
        "operation": "get_device_connection_status",
    })
    return result
