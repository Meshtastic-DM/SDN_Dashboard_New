from fastapi import APIRouter, Depends, FastAPI, Request, WebSocket
from typing import List, Optional
from app.serial.meshtastic_client import get_meshtastic_port, start_meshtastic_client
from ..services.meshtastic_service import fetch_all_nodes, format_node_for_display, discover_meshtastic_ports
router = APIRouter(prefix="/api/meshtastic", tags=["meshtastic"])

@router.get("/nodes")
def get_meshtastic_nodes(
    ports: Optional[str] = None,
    min_port: int = 4403,
    use_wsl: bool = True
):
  """
  Fetch Meshtastic node information with automatic discovery using 'ss' command.
  
  Args:
      ports: Optional comma-separated list of specific ports (e.g., "4403,4404,4405")
             If provided, auto-discovery is skipped.
      min_port: Minimum port number to consider for discovery (default: 4403)
      use_wsl: Use WSL for port discovery on Windows (default: True)
  
  Returns:
      List of formatted node data from discovered or specified ports
  
  Examples:
      /api/meshtastic/nodes - Auto-discover using 'ss' command
      /api/meshtastic/nodes?ports=4403,4404 - Query specific ports only
      /api/meshtastic/nodes?min_port=5000 - Discover nodes on ports >= 5000
  """
  if ports:
    # Use specific ports provided (manual mode)
    port_list = [int(p.strip()) for p in ports.split(",")]
    nodes_data = fetch_all_nodes(node_ports=port_list, auto_discover=False)
    discovery_mode = "manual"
  else:
    # Auto-discover using ss command
    nodes_data = fetch_all_nodes(
      auto_discover=True,
      min_port=min_port,
      use_wsl=use_wsl
    )
    discovery_mode = "auto"
  
  formatted_nodes = [format_node_for_display(node) for node in nodes_data]
  
  return {
    "count": len(formatted_nodes),
    "nodes": formatted_nodes,
    "discoveryMode": discovery_mode
  }

@router.get("/discover")
def discover_ports(min_port: int = 4403, use_wsl: bool = True):
  """
  Discover active Meshtastic node ports using 'ss' command (fast, no data fetch).
  
  Args:
      min_port: Minimum port number to consider (default: 4403)
      use_wsl: Use WSL for discovery on Windows (default: True)
  
  Returns:
      List of active Meshtastic port numbers
  """
  active_ports = discover_meshtastic_ports(min_port=min_port, use_wsl=use_wsl)
  
  return {
    "activePorts": active_ports,
    "count": len(active_ports),
    "method": "ss command"
  }

@router.get("/nodes/{port}")
def get_meshtastic_node(port: int):
  """
  Fetch Meshtastic node information from a specific port.
  
  Args:
      port: TCP port number
  
  Returns:
      Formatted node data
  """
  from ..services.meshtastic_service import fetch_meshtastic_info
  
  node_data = fetch_meshtastic_info(port=port)
  if node_data:
    node_data["port"] = port
    return format_node_for_display(node_data)
  
  return {"error": f"Failed to fetch data from port {port}"}

############################################################################
# These are endpoints related to starting/stopping the Meshtastic client
############################################################################

def get_app(request: Request):
    return request.app

@router.get("/comports")
def get_comports():
    ports = get_meshtastic_port()
    return {"comports": ports, "count": len(ports)}

@router.get("/status")
def get_status(app: FastAPI = Depends(get_app)):
    """Get the current Meshtastic connection status"""
    status = getattr(app.state, "meshtastic_status", None)
    if not status:
        status = {
            "connected": False,
            "status": "disconnected",
            "message": "Meshtastic device is not connected.",
            "port": getattr(app.state, "meshtastic_port", None),
            "nodeId": None,
        }

    return status

@router.websocket("/ws/status")
async def ws_status(ws: WebSocket):
    await ws.accept()
    broadcaster = ws.app.state.meshtastic_status_broadcaster
    broadcaster.register(ws)
    try:
        await ws.send_json(getattr(ws.app.state, "meshtastic_status", None) or {
            "connected": False,
            "status": "disconnected",
            "message": "Meshtastic device is not connected.",
            "port": getattr(ws.app.state, "meshtastic_port", None),
            "nodeId": None,
        })
        while True:
            await ws.receive_text()  # Keep connection open, ignore incoming messages
    except Exception as e:
        print(f"Meshtastic status WebSocket error: {e}")
    finally:
        broadcaster.unregister(ws)


@router.post("/start-client")
def start_client(devPath: Optional[str] = None, app: FastAPI = Depends(get_app)):
    try:
        start_meshtastic_client(app, devPath=devPath)
        
        interface = app.state.meshtastic_interface
        node_id = None
        
        if interface and hasattr(interface, 'myInfo') and interface.myInfo:
            node_id = hex(interface.myInfo.my_node_num)
        
        return {
            "status": "Meshtastic client started successfully",
            "nodeId": node_id,
            "port": devPath
        }
    except ValueError as e:
        print(f"ValueError: {e}")
        return {"status": "error", "message": str(e)}
