# app/meshtastic_service.py
"""Service to fetch and parse Meshtastic node information."""
import subprocess
import json
import re
from typing import Dict, Any, List, Optional


def discover_meshtastic_ports(min_port: int = 4403, use_wsl: bool = True) -> List[int]:
    """
    Discover active Meshtastic node ports using 'ss' command.
    This is much faster than port scanning.
    
    Args:
        min_port: Minimum port number to consider (default: 4403)
        use_wsl: If True, runs command through WSL (for Windows hosts)
    
    Returns:
        List of active Meshtastic port numbers
    """
    try:
        # Run ss command to list all TCP listening ports
        if use_wsl:
            # For Windows, run through WSL
            cmd = "wsl ss -tulnp"
        else:
            # For Linux/native
            cmd = "ss -tulnp"
        
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode != 0:
            print(f"Error running ss command: {result.stderr}")
            return []
        
        # Parse ss output to find Meshtastic ports
        ports = []
        lines = result.stdout.split('\n')
        
        for line in lines:
            # Look for TCP LISTEN lines with "program" process name
            if 'LISTEN' in line and 'program' in line:
                # Extract port number from "0.0.0.0:4403" or similar
                match = re.search(r':(\d+)\s+0\.0\.0\.0:\*', line)
                if match:
                    port = int(match.group(1))
                    if port >= min_port:
                        ports.append(port)
        
        ports.sort()
        print(f"Discovered {len(ports)} Meshtastic node(s) on ports: {ports}")
        return ports
        
    except subprocess.TimeoutExpired:
        print("Timeout running ss command")
        return []
    except Exception as e:
        print(f"Exception discovering ports: {e}")
        return []


def fetch_meshtastic_info(host: str = "127.0.0.1", port: int = 4403, retries: int = 2, timeout: int = 8) -> Optional[Dict[str, Any]]:
    """
    Fetch Meshtastic node information via CLI with retry logic.
    
    Args:
        host: TCP host address
        port: TCP port number
        retries: Number of retry attempts on failure (default: 2)
        timeout: Command timeout in seconds (default: 8)
    
    Returns:
        Parsed node information dictionary or None if failed
    """
    last_error = None
    
    for attempt in range(retries + 1):
        try:
            # Run meshtastic CLI command with shorter timeout to fail fast
            cmd = f"meshtastic --tcp {host}:{port} --info"
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.strip()
                # Check for connection-related errors
                if "Broken pipe" in error_msg or "Connection refused" in error_msg or "timed out" in error_msg:
                    last_error = f"Connection issue on {host}:{port}: {error_msg[:100]}"
                    if attempt < retries:
                        print(f"Attempt {attempt + 1}/{retries + 1} failed for {host}:{port}, retrying...")
                        continue
                else:
                    print(f"Error fetching from {host}:{port}: {error_msg}")
                    return None
            else:
                # Success - parse and return
                return parse_meshtastic_output(result.stdout)
        
        except subprocess.TimeoutExpired:
            last_error = f"Timeout connecting to {host}:{port}"
            if attempt < retries:
                print(f"Attempt {attempt + 1}/{retries + 1} timed out for {host}:{port}, retrying...")
                continue
        except BrokenPipeError:
            last_error = f"Broken pipe error connecting to {host}:{port}"
            if attempt < retries:
                print(f"Attempt {attempt + 1}/{retries + 1} broken pipe for {host}:{port}, retrying...")
                continue
        except Exception as e:
            last_error = f"Exception fetching Meshtastic data from {host}:{port}: {e}"
            if attempt < retries:
                print(f"Attempt {attempt + 1}/{retries + 1} failed with exception, retrying...")
                continue
    
    # All retries exhausted
    if last_error:
        print(f"Failed after {retries + 1} attempts: {last_error}")
    return None


def parse_meshtastic_output(output: str) -> Dict[str, Any]:
    """
    Parse the meshtastic --info output into structured data.
    
    Args:
        output: Raw CLI output string
    
    Returns:
        Structured dictionary with parsed information
    """
    data = {
        "owner": None,
        "myInfo": {},
        "metadata": {},
        "nodes": {},
        "preferences": {},
        "modulePreferences": {},
        "channels": [],
        "primaryChannelUrl": None
    }
    
    lines = output.split('\n')
    current_section = None
    buffer = ""
    
    for line in lines:
        # Skip connection messages and warnings
        if line.startswith("Connected to") or line.startswith("***"):
            continue
            
        # Detect sections
        if line.startswith("Owner:"):
            data["owner"] = line.replace("Owner:", "").strip()
        elif line.startswith("My info:"):
            current_section = "myInfo"
            buffer = line.replace("My info:", "").strip()
        elif line.startswith("Metadata:"):
            if current_section == "myInfo" and buffer:
                data["myInfo"] = safe_parse_json(buffer)
            current_section = "metadata"
            buffer = line.replace("Metadata:", "").strip()
        elif line.startswith("Nodes in mesh:"):
            if current_section == "metadata" and buffer:
                data["metadata"] = safe_parse_json(buffer)
            current_section = "nodes"
            buffer = ""
        elif line.startswith("Preferences:"):
            if current_section == "nodes" and buffer:
                data["nodes"] = safe_parse_json(buffer)
            current_section = "preferences"
            buffer = ""
        elif line.startswith("Module preferences:"):
            if current_section == "preferences" and buffer:
                data["preferences"] = safe_parse_json(buffer)
            current_section = "modulePreferences"
            buffer = ""
        elif line.startswith("Channels:"):
            if current_section == "modulePreferences" and buffer:
                data["modulePreferences"] = safe_parse_json(buffer)
            current_section = "channels"
            buffer = ""
        elif line.startswith("Primary channel URL:"):
            if current_section == "channels":
                # Process any buffered channel data
                pass
            data["primaryChannelUrl"] = line.replace("Primary channel URL:", "").strip()
            current_section = None
        elif line.strip().startswith("Index"):
            # Parse channel info
            channel_match = re.search(r'Index (\d+): (\w+) (.+)', line)
            if channel_match:
                idx, name, rest = channel_match.groups()
                channel_data = safe_parse_json("{" + rest.split("{", 1)[1] if "{" in rest else "{}")
                data["channels"].append({
                    "index": int(idx),
                    "name": name,
                    **channel_data
                })
        else:
            # Accumulate JSON data
            if current_section and line.strip():
                buffer += line.strip()
    
    # Process any remaining buffer
    if current_section == "modulePreferences" and buffer:
        data["modulePreferences"] = safe_parse_json(buffer)
    
    return data


def safe_parse_json(json_str: str) -> Dict[str, Any]:
    """Safely parse JSON string, return empty dict on failure."""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {}


def fetch_all_nodes(node_ports: Optional[List[int]] = None, 
                    auto_discover: bool = True,
                    min_port: int = 4403,
                    use_wsl: bool = True,
                    timeout: int = 8,
                    retries: int = 2) -> List[Dict[str, Any]]:
    """
    Fetch information from multiple Meshtastic nodes.
    
    Args:
        node_ports: Optional list of specific TCP ports to query.
                   If None and auto_discover=True, will use 'ss' to find active ports.
        auto_discover: If True, automatically discover ports using 'ss' command
        min_port: Minimum port number to consider (default: 4403)
        use_wsl: If True, runs discovery through WSL (for Windows hosts)
        timeout: Timeout per node query in seconds (default: 8)
        retries: Number of retry attempts per node (default: 2)
    
    Returns:
        List of node information dictionaries
    """
    all_nodes = []
    
    # Determine which ports to query
    if node_ports is None and auto_discover:
        # Auto-discover using ss command
        ports_to_query = discover_meshtastic_ports(min_port=min_port, use_wsl=use_wsl)
    elif node_ports:
        # Use provided ports
        ports_to_query = node_ports
    else:
        # No ports specified and auto_discover is False
        print("No ports specified and auto_discover=False. Returning empty list.")
        return []
    
    if not ports_to_query:
        print("No active Meshtastic ports found.")
        return []
    
    print(f"Fetching data from {len(ports_to_query)} node(s)...")
    
    successful_queries = 0
    failed_queries = 0
    
    for port in ports_to_query:
        node_data = fetch_meshtastic_info(port=port, timeout=timeout, retries=retries)
        if node_data:
            node_data["port"] = port
            all_nodes.append(node_data)
            successful_queries += 1
        else:
            failed_queries += 1
            print(f"Warning: Port {port} is listening but connection failed or returned invalid data")
    
    print(f"Query complete: {successful_queries} successful, {failed_queries} failed")
    return all_nodes


def format_node_for_display(node_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format node data for frontend display with human-readable values.
    
    Args:
        node_data: Raw node data from parse_meshtastic_output
    
    Returns:
        Formatted data for display
    """
    my_info = node_data.get("myInfo", {})
    metadata = node_data.get("metadata", {})
    nodes = node_data.get("nodes", {})
    
    # Extract owner node info
    my_node_num = my_info.get("myNodeNum")
    owner_node = None
    mesh_nodes = []
    
    for node_id, node_info in nodes.items():
        formatted_node = {
            "id": node_id,
            "num": node_info.get("num"),
            "user": node_info.get("user", {}),
            "position": node_info.get("position", {}),
            "deviceMetrics": node_info.get("deviceMetrics", {}),
            "snr": node_info.get("snr"),
            "hopsAway": node_info.get("hopsAway"),
            "isFavorite": node_info.get("isFavorite", False)
        }
        
        if node_info.get("num") == my_node_num:
            owner_node = formatted_node
        else:
            mesh_nodes.append(formatted_node)
    
    return {
        "port": node_data.get("port"),
        "owner": node_data.get("owner"),
        "myInfo": my_info,
        "metadata": metadata,
        "ownerNode": owner_node,
        "meshNodes": mesh_nodes,
        "nodeCount": len(nodes),
        "preferences": node_data.get("preferences", {}),
        "modulePreferences": node_data.get("modulePreferences", {}),
        "channels": node_data.get("channels", []),
        "primaryChannelUrl": node_data.get("primaryChannelUrl")
    }
