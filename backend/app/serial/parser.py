#TODO: This parser need to be deleted when the Meshtastic client is fully integrated and tested, as the client will handle parsing internally and emit structured events instead of raw lines. @Tharoosha
def parse_line(line: str):
    line = line.strip()
    if not line:
        return None  # skip empty lines
    parts = line.split()
    if parts[0] == "[SDN_ROUTE_UPDATE]":
        "The serial output of a route update should look like this:"
        "[SDN_ROUTE_UPDATE] seq_no=123 reporting_node=NodeA destination=NodeB next_hop=NodeC expiring_time=2024-06-01T12:00:00Z"
        "No spaces between = and the value, but spaces between different key=value pairs. @Raveen" 
        seq_no = None
        reporting_node = None
        destination = None
        next_hop = None
        expiring_time = None
        for part in parts[1:]:
            if "=" in part:
                key, value = part.split("=", 1)
                if key == "seq_no":
                    seq_no = int(value)
                elif key == "reporting_node":
                    reporting_node = value
                elif key == "destination":
                    destination = value
                elif key == "next_hop":
                    next_hop = value
                elif key == "expiring_time":
                    expiring_time = value
        return {
            "type": "route_update",
            "seq_no": seq_no,
            "reporting_node": reporting_node,
            "destination": destination,
            "next_hop": next_hop,
            "expiring_time": expiring_time
        }
    else:
        return None  # unrecognized line format