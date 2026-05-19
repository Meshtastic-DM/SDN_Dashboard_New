from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from typing import Optional

from app.core.database import SessionLocal
from app.models.node import Node
from app.request_models.admin_models import (
    SetOwnerRequest,
    RebootRequest,
    ShutdownRequest,
    FactoryResetRequest,
    NodeDBResetRequest,
    SetFavoriteNodeRequest,
    RemoveFavoriteNodeRequest,
    SetIgnoredNodeRequest,
    RemoveIgnoredNodeRequest,
    SetFixedPositionRequest,
    RemoveFixedPositionRequest,
    SetTimeOnlyRequest,
    SetHamModeRequest,
    GetOwnerRequest,
    GetConfigRequest,
    GetLoRaConfigRequest,
    SetLoRaConfigRequest,
    GetChannelRequest,
    GetDeviceMetadataRequest,
    GetDeviceConnectionStatusRequest,
    AdminMessageResponse,
)
from app.services.admin_service import (
    send_set_owner,
    send_reboot,
    send_shutdown,
    send_factory_reset,
    send_nodedb_reset,
    send_set_favorite_node,
    send_remove_favorite_node,
    send_set_ignored_node,
    send_remove_ignored_node,
    send_set_fixed_position,
    send_remove_fixed_position,
    send_set_time_only,
    send_set_ham_mode,
    send_get_owner,
    send_get_config,
    get_lora_config,
    set_lora_config,
    send_get_channel,
    send_get_device_metadata,
    send_get_device_connection_status,
    refresh_session_key,
)
from app.services.node_id_utils import parse_hex_node_id

router = APIRouter(prefix="/api/admin", tags=["Admin"])

NODE_ROLES = {"Rescuer", "Fire Fighters", "Volunteers"}


class SetNodeRoleRequest(BaseModel):
    target_node: str = Field(..., description="Target node ID as 4-byte hex")
    role: Optional[str] = Field(None, description="Node role, or null to remove it")


def serialize_node(node: Node) -> dict:
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


@router.post("/node/role")
async def set_node_role(req: SetNodeRoleRequest, request: Request):
    """Update the dashboard role stored for a node in the local database."""
    if req.role is not None and req.role not in NODE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of: {', '.join(sorted(NODE_ROLES))}",
        )

    try:
        node_id = parse_hex_node_id(
            req.target_node,
            field_name="target_node",
            exact_hex_len=8,
        ).to_bytes(4, byteorder="big")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db = SessionLocal()
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")

        node.role = req.role
        db.commit()
        db.refresh(node)

        payload = serialize_node(node)
        broadcaster = getattr(request.app.state, "node_update_broadcaster", None)
        if broadcaster:
            broadcaster.publish(payload)

        return {"status": "ok", "node": payload}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        db.close()


# =====================================================================
# Owner Management Endpoints
# =====================================================================

@router.post("/owner/set", response_model=AdminMessageResponse)
async def set_owner(req: SetOwnerRequest, request: Request):
    """
    Set the owner information of a remote node.
    
    Args:
        req: SetOwnerRequest with target node and owner details
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_owner,
            request.app,
            req.target_node,
            req.owner.long_name,
            req.owner.short_name,
            req.owner.is_licensed,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/owner/get", response_model=AdminMessageResponse)
async def get_owner(req: GetOwnerRequest, request: Request):
    """
    Get the owner information from a remote node.
    
    Args:
        req: GetOwnerRequest with target node
        
    Returns:
        AdminMessageResponse with owner data
    """
    try:
        details = await run_in_threadpool(
            send_get_owner,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/session-key/refresh", response_model=AdminMessageResponse)
async def session_key_refresh(req: GetOwnerRequest, request: Request):
    """
    Force-refresh and validate session key for a remote node.

    This endpoint performs a GET owner flow internally and caches the
    returned session_passkey for subsequent SET operations.
    """
    try:
        details = await run_in_threadpool(
            refresh_session_key,
            request.app,
            req.target_node,
            req.channel_index,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Reboot and Shutdown Endpoints
# =====================================================================

@router.post("/reboot", response_model=AdminMessageResponse)
async def reboot_node(req: RebootRequest, request: Request):
    """
    Send a reboot command to a remote node.
    
    Args:
        req: RebootRequest with target node and delay
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_reboot,
            request.app,
            req.target_node,
            req.delay_seconds,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/shutdown", response_model=AdminMessageResponse)
async def shutdown_node(req: ShutdownRequest, request: Request):
    """
    Send a shutdown command to a remote node.
    
    Args:
        req: ShutdownRequest with target node and delay
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_shutdown,
            request.app,
            req.target_node,
            req.delay_seconds,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Factory Reset Endpoints
# =====================================================================

@router.post("/factory-reset", response_model=AdminMessageResponse)
async def factory_reset(req: FactoryResetRequest, request: Request):
    """
    Send a factory reset command to a remote node.
    
    Args:
        req: FactoryResetRequest with target node and reset type
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_factory_reset,
            request.app,
            req.target_node,
            req.reset_type,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/nodedb-reset", response_model=AdminMessageResponse)
async def nodedb_reset(req: NodeDBResetRequest, request: Request):
    """
    Send a NodeDB reset command to a remote node.
    
    Args:
        req: NodeDBResetRequest with target node
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_nodedb_reset,
            request.app,
            req.target_node,
            req.reset_nodedb_and_clear_favorites,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Node Management Endpoints (Favorite/Ignored)
# =====================================================================

@router.post("/node/set-favorite", response_model=AdminMessageResponse)
async def set_favorite_node(req: SetFavoriteNodeRequest, request: Request):
    """
    Mark a node as favorite on a remote device.
    
    Args:
        req: SetFavoriteNodeRequest with target and node to favorite
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_favorite_node,
            request.app,
            req.target_node,
            req.node_to_favorite,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/node/remove-favorite", response_model=AdminMessageResponse)
async def remove_favorite_node(req: RemoveFavoriteNodeRequest, request: Request):
    """
    Remove a node from favorites on a remote device.
    
    Args:
        req: RemoveFavoriteNodeRequest with target and node to remove
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_remove_favorite_node,
            request.app,
            req.target_node,
            req.node_to_remove,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/node/set-ignored", response_model=AdminMessageResponse)
async def set_ignored_node(req: SetIgnoredNodeRequest, request: Request):
    """
    Mark a node as ignored on a remote device.
    
    Args:
        req: SetIgnoredNodeRequest with target and node to ignore
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_ignored_node,
            request.app,
            req.target_node,
            req.node_to_ignore,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/node/remove-ignored", response_model=AdminMessageResponse)
async def remove_ignored_node(req: RemoveIgnoredNodeRequest, request: Request):
    """
    Unignore a node on a remote device.
    
    Args:
        req: RemoveIgnoredNodeRequest with target and node to unignore
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_remove_ignored_node,
            request.app,
            req.target_node,
            req.node_to_unignore,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Position Management Endpoints
# =====================================================================

@router.post("/position/set-fixed", response_model=AdminMessageResponse)
async def set_fixed_position(req: SetFixedPositionRequest, request: Request):
    """
    Set a fixed position for a remote node.
    
    Args:
        req: SetFixedPositionRequest with target node and coordinates
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_fixed_position,
            request.app,
            req.target_node,
            req.latitude,
            req.longitude,
            req.altitude,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/position/remove-fixed", response_model=AdminMessageResponse)
async def remove_fixed_position(req: RemoveFixedPositionRequest, request: Request):
    """
    Remove the fixed position from a remote node.
    
    Args:
        req: RemoveFixedPositionRequest with target node
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_remove_fixed_position,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Time Management Endpoints
# =====================================================================

@router.post("/time/set", response_model=AdminMessageResponse)
async def set_time_only(req: SetTimeOnlyRequest, request: Request):
    """
    Set the time on a remote node.
    
    Args:
        req: SetTimeOnlyRequest with target node and timestamp
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_time_only,
            request.app,
            req.target_node,
            req.timestamp,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Ham Mode Endpoints
# =====================================================================

@router.post("/ham-mode/set", response_model=AdminMessageResponse)
async def set_ham_mode(req: SetHamModeRequest, request: Request):
    """
    Set ham mode parameters on a remote node.
    
    Args:
        req: SetHamModeRequest with target node and ham parameters
        
    Returns:
        AdminMessageResponse with operation details
    """
    try:
        details = await run_in_threadpool(
            send_set_ham_mode,
            request.app,
            req.target_node,
            req.ham_params.call_sign,
            req.ham_params.short_name,
            req.ham_params.tx_power,
            req.ham_params.frequency,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Configuration Getter Endpoints
# =====================================================================

@router.post("/config/get", response_model=AdminMessageResponse)
async def get_config(req: GetConfigRequest, request: Request):
    """
    Get a configuration section from a remote node.
    
    Config types:
    - 0: DEVICE_CONFIG
    - 1: POSITION_CONFIG
    - 2: POWER_CONFIG
    - 3: NETWORK_CONFIG
    - 4: DISPLAY_CONFIG
    - 5: LORA_CONFIG
    - 6: BLUETOOTH_CONFIG
    - 7: SECURITY_CONFIG
    
    Args:
        req: GetConfigRequest with target node and config type
        
    Returns:
        AdminMessageResponse with config data
    """
    try:
        details = await run_in_threadpool(
            send_get_config,
            request.app,
            req.target_node,
            req.config_type,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/config/lora/get", response_model=AdminMessageResponse)
async def get_lora_config_endpoint(req: GetLoRaConfigRequest, request: Request):
    """Get LoRa configuration from a remote node and wait for the response."""
    try:
        details = await run_in_threadpool(
            get_lora_config,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
            req.timeout_s,
        )
        return AdminMessageResponse(status="ok", details=details)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/config/lora/set", response_model=AdminMessageResponse)
async def set_lora_config_endpoint(req: SetLoRaConfigRequest, request: Request):
    """Update LoRa configuration on a remote node using the get-then-set admin flow."""
    try:
        details = await run_in_threadpool(
            set_lora_config,
            request.app,
            req.target_node,
            req.lora_config.model_dump(exclude_none=True),
            req.channel_index,
            req.want_ack,
            req.verify_after_set,
            req.timeout_s,
        )
        return AdminMessageResponse(status="ok", details=details)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/channel/get", response_model=AdminMessageResponse)
async def get_channel(req: GetChannelRequest, request: Request):
    """
    Get channel configuration from a remote node.
    
    Args:
        req: GetChannelRequest with target node and channel index
        
    Returns:
        AdminMessageResponse with channel data
    """
    try:
        details = await run_in_threadpool(
            send_get_channel,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/metadata/get", response_model=AdminMessageResponse)
async def get_device_metadata(req: GetDeviceMetadataRequest, request: Request):
    """
    Get device metadata from a remote node.
    
    Args:
        req: GetDeviceMetadataRequest with target node
        
    Returns:
        AdminMessageResponse with device metadata
    """
    try:
        details = await run_in_threadpool(
            send_get_device_metadata,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/connection-status/get", response_model=AdminMessageResponse)
async def get_device_connection_status(req: GetDeviceConnectionStatusRequest, request: Request):
    """
    Get connection status from a remote node.
    
    Args:
        req: GetDeviceConnectionStatusRequest with target node
        
    Returns:
        AdminMessageResponse with connection status
    """
    try:
        details = await run_in_threadpool(
            send_get_device_connection_status,
            request.app,
            req.target_node,
            req.channel_index,
            req.want_ack,
        )
        return AdminMessageResponse(status="ok", details=details)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================================
# Utility Endpoints
# =====================================================================

@router.get("/config-types", response_model=dict)
async def get_config_types():
    """
    Get available configuration types with their IDs.
    
    Returns:
        Dictionary mapping config type names to their numeric IDs
    """
    return {
        "DEVICE_CONFIG": 0,
        "POSITION_CONFIG": 1,
        "POWER_CONFIG": 2,
        "NETWORK_CONFIG": 3,
        "DISPLAY_CONFIG": 4,
        "LORA_CONFIG": 5,
        "BLUETOOTH_CONFIG": 6,
        "SECURITY_CONFIG": 7,
    }


@router.get("/operations", response_model=dict)
async def get_operations():
    """
    Get list of available remote administration operations.
    
    Returns:
        Dictionary with operation categories and endpoints
    """
    return {
        "owner_management": [
            "POST /api/admin/owner/set - Set owner info",
            "POST /api/admin/owner/get - Get owner info",
            "POST /api/admin/session-key/refresh - Force refresh session key",
        ],
        "device_control": [
            "POST /api/admin/reboot - Reboot device",
            "POST /api/admin/shutdown - Shutdown device",
            "POST /api/admin/factory-reset - Factory reset",
            "POST /api/admin/nodedb-reset - Reset NodeDB",
        ],
        "node_management": [
            "POST /api/admin/node/set-favorite - Mark as favorite",
            "POST /api/admin/node/remove-favorite - Remove from favorites",
            "POST /api/admin/node/set-ignored - Mark as ignored",
            "POST /api/admin/node/remove-ignored - Remove from ignored",
        ],
        "position_management": [
            "POST /api/admin/position/set-fixed - Set fixed position",
            "POST /api/admin/position/remove-fixed - Remove fixed position",
        ],
        "time_management": [
            "POST /api/admin/time/set - Set device time",
        ],
        "ham_mode": [
            "POST /api/admin/ham-mode/set - Set ham mode parameters",
        ],
        "configuration": [
            "POST /api/admin/config/get - Get config section",
            "POST /api/admin/config/lora/get - Get LoRa config with parsed response",
            "POST /api/admin/config/lora/set - Set LoRa config with verification",
            "POST /api/admin/channel/get - Get channel config",
            "POST /api/admin/metadata/get - Get device metadata",
            "POST /api/admin/connection-status/get - Get connection status",
        ],
    }
