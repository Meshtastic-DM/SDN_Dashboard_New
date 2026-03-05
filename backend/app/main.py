# app/main.py
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from app.routers import topology, meshtastic,texting

from app.services.startup_functions.state import (
  get_visible_entries,
  build_graph,
  reset_state,
)
from app.services.startup_functions.feed_simulator import start_simulated_feed
from app.services.meshtastic_service import (
    fetch_all_nodes, 
    format_node_for_display, 
    discover_meshtastic_ports
)

from app.services.broadcaster import Broadcaster
from app.serial.worker import SerialWorker
from app.serial.serial_source import iter_fake_lines, iter_serial_lines
from app.serial.meshtastic_client import start_meshtastic_client

app = FastAPI()

# Store broadcaster in app.state for access across routers
app.state.broadcaster = Broadcaster()
app.state.text_message_broadcaster = Broadcaster()  # Separate broadcaster for DM updates
app.state.node_update_broadcaster = Broadcaster()  # Separate broadcaster for node updates
worker = None
app.state.pending ={}

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Include routers
app.include_router(topology.router)
app.include_router(meshtastic.router)
app.include_router(texting.router)

@app.on_event("startup")
async def startup_event():
  # start simulated SDN feed
  reset_state()
  await start_simulated_feed()

  # Start Serial Worker and Line Iterator
  # store event loop reference for thread -> websocket
  app.state.broadcaster.set_loop(asyncio.get_running_loop())
  app.state.text_message_broadcaster.set_loop(asyncio.get_running_loop())
  app.state.node_update_broadcaster.set_loop(asyncio.get_running_loop())
  #line_iter = iter_serial_lines(port="COM3", baud=9600)  # Update with your serial port and baudrate
  # line_iter = iter_fake_lines()
  # global worker
  # worker = SerialWorker(line_iter, app.state.broadcaster)
  # worker.start()

  # Start Meshtastic client
  try:
    start_meshtastic_client(app)
  except ValueError as e:
    print(f"Meshtastic client not started: {e}")
    print("Set MESHTASTIC_PORT environment variable to specify which port to use (e.g., COM14 or COM17)")

@app.on_event("shutdown")
def shutdown_event():
  if worker:
    worker.stop()