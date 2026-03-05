from fastapi import APIRouter, Depends, FastAPI, Request
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

@router.post("/start-client")
def start_client(devPath: Optional[str] = None, app: FastAPI = Depends(get_app)):
    try:
        start_meshtastic_client(app, devPath=devPath)
        return {"status": "Meshtastic client started successfully"}
    except ValueError as e:
        return {"status": "error", "message": str(e)}