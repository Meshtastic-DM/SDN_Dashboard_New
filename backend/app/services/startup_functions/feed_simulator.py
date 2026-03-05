# app/feed_simulator.py
import json
import asyncio
from pathlib import Path
from .state import append_entry

FEED_INTERVAL_SECONDS = 1.5  # simulate one entry every 1.5s

def load_entries_from_file(file_path: str):
    """Load routing entries from JSON file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Routing entries file not found: {file_path}")

    with open(path, "r") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("JSON must contain a list of routing entries")

    return data


async def feeder_loop(file_path: str):
    """Simulate feeding entries from a JSON file."""
    entries = load_entries_from_file(file_path)

    for entry in entries:
        append_entry(entry)
        await asyncio.sleep(FEED_INTERVAL_SECONDS)


async def start_simulated_feed():
    json_path = "app/data/routing_entries.json"
    asyncio.create_task(feeder_loop(json_path))
