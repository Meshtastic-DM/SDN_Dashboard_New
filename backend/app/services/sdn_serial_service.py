import sys
import time
from pathlib import Path

from meshtastic.serial_interface import SerialInterface
# from meshtastic import portnums_pb2

# Add local protobuf module paths (absolute, based on this file location)
PROTO_DIR = Path(__file__).resolve().parents[1] / "generated"


    
sys.path.insert(0, str(PROTO_DIR))

import sdn_pb2
import portnums_pb2
import aodv_pb2
import nanopb_pb2



def pack_hop_path(hops: list[int]) -> int:
    if not hops:
        raise ValueError("Path cannot be empty")
    if len(hops) > 8:
        raise ValueError("Maximum 8 hops allowed")
    hop_path = 0
    for i, hop in enumerate(hops):
        if hop < 0 or hop > 0xFF:
            raise ValueError(f"Hop {i} out of range: {hop}")
        hop_path |= (hop << (i * 8))
    return hop_path


def send_route_install_serial(
    port: str,
    destination: int,
    path: list[int],
    install_id: int = 1,
    start_node: int | None = None,
    channel_index: int = 0,
    want_ack: bool = False,
) -> dict:
    if start_node is None:
        start_node = path[0]

    route_install = sdn_pb2.SDNRouteInstall()
    route_install.destination = destination
    route_install.hop_path = pack_hop_path(path)
    route_install.install_id = install_id & 0xFF

    sdn_msg = sdn_pb2.SDN()
    sdn_msg.route_install.CopyFrom(route_install)
    payload = sdn_msg.SerializeToString()

    iface = SerialInterface(devPath=port)
    try:
        time.sleep(0.4)
        iface.sendData(
            data=payload,
            destinationId=f"!{start_node:08x}",
            portNum=portnums_pb2.PortNum.SDN_APP,
            wantAck=want_ack,
            channelIndex=channel_index,
        )
        return {
            "serial_port": port,
            "start_node": start_node,
            "destination": destination,
            "install_id": route_install.install_id,
            "path": path,
            "hop_path": route_install.hop_path,
            "channel_index": channel_index,
            "want_ack": want_ack,
        }
    finally:
        iface.close()


def send_route_switch_serial(
    port: str,
    target_node: int,
    destination: int,
    next_hop: int,
    channel_index: int = 0,
    want_ack: bool = False,
) -> dict:
    if next_hop < 0 or next_hop > 0xFF:
        raise ValueError("next_hop must be in range 0..255")

    route_cmd = sdn_pb2.SDNRouteCommand()
    route_cmd.destination = destination
    route_cmd.next_hop = next_hop

    sdn_msg = sdn_pb2.SDN()
    sdn_msg.route_command.CopyFrom(route_cmd)
    payload = sdn_msg.SerializeToString()

    iface = SerialInterface(devPath=port)
    try:
        time.sleep(0.4)
        iface.sendData(
            data=payload,
            destinationId=f"!{target_node:08x}",
            portNum=portnums_pb2.PortNum.SDN_APP,
            wantAck=want_ack,
            channelIndex=channel_index,
        )
        return {
            "serial_port": port,
            "target_node": target_node,
            "destination": destination,
            "next_hop": next_hop,
            "channel_index": channel_index,
            "want_ack": want_ack,
        }
    finally:
        iface.close()