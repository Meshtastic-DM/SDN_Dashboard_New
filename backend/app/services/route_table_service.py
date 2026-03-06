import sys
import time
from pathlib import Path

from pubsub import pub
from meshtastic.serial_interface import SerialInterface

PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_MESHTASTIC_DIR = PROJECT_ROOT / "meshtastic"

if str(LOCAL_MESHTASTIC_DIR) not in sys.path:
    sys.path.insert(0, str(LOCAL_MESHTASTIC_DIR))

import aodv_pb2  # noqa: E402

AODV_ROUTING_APP_PORTNUM = 75


def get_route_table_serial(
    port: str,
    timeout: int = 10,
    channel_index: int = 0,
    want_ack: bool = False,
) -> dict:
    request_id = int(time.time())
    result_routes = None

    def on_receive(packet, interface):
        nonlocal result_routes
        try:
            decoded = packet.get("decoded", {})
            portnum = decoded.get("portnum")
            if portnum not in ("AODV_ROUTING_APP", AODV_ROUTING_APP_PORTNUM):
                return

            payload = decoded.get("payload")
            if not payload:
                return

            msg = aodv_pb2.AODV()
            msg.ParseFromString(payload)

            if "rt_response" in msg.DESCRIPTOR.fields_by_name and msg.HasField("rt_response"):
                rt = msg.rt_response
                if rt.request_id == request_id:
                    result_routes = [
                        {
                            "destination": r.destination,
                            "next_hop": r.next_hop,
                            "hop_count": r.hop_count,
                            "destination_seq_num": r.destination_seq_num,
                            "lifetime": r.lifetime,
                            "valid": bool(getattr(r, "valid", False)),
                        }
                        for r in rt.routes
                    ]
        except Exception:
            return

    test_msg = aodv_pb2.AODV()
    if "rt_request" not in test_msg.DESCRIPTOR.fields_by_name:
        raise RuntimeError("aodv_pb2 has no rt_request. Regenerate proto with route table fields.")

    pub.subscribe(on_receive, "meshtastic.receive")
    iface = SerialInterface(devPath=port)

    try:
        node = iface.getMyNodeInfo() or {}
        node_num = node.get("num")
        if node_num is None:
            raise RuntimeError("Cannot read local node number from serial interface.")

        req = aodv_pb2.AODV()
        req.rt_request.request_id = request_id
        payload = req.SerializeToString()

        iface.sendData(
            data=payload,
            destinationId=f"!{node_num:08x}",
            portNum=AODV_ROUTING_APP_PORTNUM,
            wantAck=want_ack,
            channelIndex=channel_index,
        )

        start = time.time()
        while time.time() - start < timeout:
            if result_routes is not None:
                break
            time.sleep(0.2)

        return {
            "status": "ok",
            "request_id": request_id,
            "node_num": node_num,
            "routes": result_routes or [],
        }
    finally:
        try:
            pub.unsubscribe(on_receive, "meshtastic.receive")
        except Exception:
            pass
        iface.close()