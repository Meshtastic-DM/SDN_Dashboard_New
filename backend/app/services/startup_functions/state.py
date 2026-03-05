from typing import List, Dict, Any

VISIBLE_ENTRIES: List[Dict[str, Any]] = []


def append_entry(entry: Dict[str, Any]) -> None:
    VISIBLE_ENTRIES.append(entry)


def reset_state() -> None:
    global VISIBLE_ENTRIES
    VISIBLE_ENTRIES = []


def get_visible_entries() -> List[Dict[str, Any]]:
    return list(VISIBLE_ENTRIES)


def build_graph(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build topology graph from routing entries.

    Rules:
    - Skip malformed / blank entries ({} etc.).
    - Links are ONLY selfId -> nextHop.
    - Nodes are ONLY those that appear as source or target of some link.
      => no node can exist without at least one edge.
    """
    node_map: Dict[int, Dict[str, Any]] = {}
    links: List[Dict[str, Any]] = []

    for r in entries:
        if not isinstance(r, dict):
            continue

        self_id = r.get("selfId")
        next_hop = r.get("nextHop")
        dest_id = r.get("destId")

        # must have core fields
        if self_id is None or next_hop is None or dest_id is None:
            continue

        try:
            self_id = int(self_id)
            next_hop = int(next_hop)
            dest_id = int(dest_id)
        except (TypeError, ValueError):
            continue

        hop_count = r.get("hopCount", 1)
        dest_seq_num = r.get("destSeqNum", 0)

        # ONLY self and nextHop create nodes (not dest-only nodes)
        for nid in (self_id, next_hop):
            if nid not in node_map:
                node_map[nid] = {
                    "id": nid,
                    "name": f"Node {nid}",
                }

        links.append({
            "source": self_id,
            "target": next_hop,
            "hopCount": int(hop_count) if hop_count is not None else 1,
            "destId": dest_id,
            "destSeqNum": int(dest_seq_num) if dest_seq_num is not None else 0,
        })

    # dedupe links by (source, target, destId)
    seen = set()
    unique_links: List[Dict[str, Any]] = []
    for l in links:
        key = (l["source"], l["target"], l["destId"])
        if key in seen:
            continue
        seen.add(key)
        unique_links.append(l)

    # KEEP ONLY NODES THAT ARE IN SOME LINK (source or target)
    linked_nodes = set()
    for l in unique_links:
        linked_nodes.add(l["source"])
        linked_nodes.add(l["target"])

    filtered_nodes = [n for n in node_map.values() if n["id"] in linked_nodes]

    return {
        "nodes": filtered_nodes,
        "links": unique_links,
    }
