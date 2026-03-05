
from fastapi import WebSocket
import asyncio

class Broadcaster:
    def __init__(self):
        self.clients = set()
        self.loop = None

    def set_loop(self, loop):
        self.loop = loop

    def register(self, ws: WebSocket):
        self.clients.add(ws)

    def unregister(self, ws: WebSocket):
        self.clients.discard(ws)

    def publish(self, payload: dict):
        if not self.loop:
            return
        # schedule async sends from a thread
        #print(f"[DEBUG]Scheduling broadcast to {len(self.clients)} clients: {payload}")
        asyncio.run_coroutine_threadsafe(self._broadcast(payload), self.loop)

    async def _broadcast(self, payload: dict):
        dead = []
        for ws in self.clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unregister(ws)