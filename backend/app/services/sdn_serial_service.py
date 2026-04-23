import sys
import time
from pathlib import Path

# from meshtastic import portnums_pb2

# Add local protobuf module paths (absolute, based on this file location)
PROTO_DIR = Path(__file__).resolve().parents[1] / "generated"


    
sys.path.insert(0, str(PROTO_DIR))

import app.generated.sdn_pb2 as sdn_pb2  # noqa: E402
import app.generated.portnums_pb2 as portnums_pb2
import app.generated.aodv_pb2 as aodv_pb2
import app.generated.nanopb_pb2 as nanopb_pb2

from app.services.node_id_utils import format_hex_node_id, parse_hex_node_id



def pack_hop_path(hops: list[int]) -> int:
    if not hops:
        raise ValueError("Path cannot be empty")
    if len(hops) > 8:
        raise ValueError("Maximum 8 hops allowed")
    hop_path = 0
    for i, hop in enumerate(hops):
        hop_id = parse_hex_node_id(hop, field_name=f"path[{i}]", max_value=0xFF)
        hop_path |= (hop_id << (i * 8))
    return hop_path


def send_route_install_serial(
    app,
    destination: str | int,
    path: list[str | int],
    install_id: int = 1,
    start_node: str | int | None = None,
    channel_index: int = 0,
    want_ack: bool = False,
) -> dict:
    if start_node is None:
        raise ValueError("start_node is required and must be a 4-byte hex node ID")

    destination_id = parse_hex_node_id(destination, field_name="destination")
    start_node_id = parse_hex_node_id(start_node, field_name="start_node", exact_hex_len=8)

    route_install = sdn_pb2.SDNRouteInstall()
    route_install.destination = destination_id
    route_install.hop_path = pack_hop_path(path)
    route_install.install_id = install_id & 0xFF

    sdn_msg = sdn_pb2.SDN()
    sdn_msg.route_install.CopyFrom(route_install)
    payload = sdn_msg.SerializeToString()

    iface = app.state.meshtastic_interface
    time.sleep(0.4)
    iface.sendData(
        data=payload,
        destinationId=f"!{start_node_id:08x}",
        portNum=portnums_pb2.PortNum.SDN_APP,
        wantAck=want_ack,
        channelIndex=channel_index,
    )
    return {
        "start_node": format_hex_node_id(start_node_id),
        "destination": format_hex_node_id(destination_id),
        "install_id": route_install.install_id,
        "path": [format_hex_node_id(parse_hex_node_id(hop, field_name="path", max_value=0xFF), width=2) for hop in path],
        "hop_path": route_install.hop_path,
        "channel_index": channel_index,
        "want_ack": want_ack,
    }


def send_route_switch_serial(
    app,
    target_node: str | int,
    destination: str | int,
    next_hop: str | int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> dict:
    target_node_id = parse_hex_node_id(target_node, field_name="target_node")
    destination_id = parse_hex_node_id(destination, field_name="destination")
    next_hop_id = parse_hex_node_id(next_hop, field_name="next_hop", max_value=0xFF)

    route_cmd = sdn_pb2.SDNRouteCommand()
    route_cmd.destination = destination_id
    route_cmd.next_hop = next_hop_id

    sdn_msg = sdn_pb2.SDN()
    sdn_msg.route_command.CopyFrom(route_cmd)
    payload = sdn_msg.SerializeToString()

    iface = app.state.meshtastic_interface
    time.sleep(0.4)
    iface.sendData(
        data=payload,
        destinationId=f"!{target_node_id:08x}",
        portNum=portnums_pb2.PortNum.SDN_APP,
        wantAck=want_ack,
        channelIndex=channel_index,
    )
    return {
        "target_node": format_hex_node_id(target_node_id),
        "destination": format_hex_node_id(destination_id),
        "next_hop": format_hex_node_id(next_hop_id, width=2),
        "channel_index": channel_index,
        "want_ack": want_ack,
    }