import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.models.job import Job
from app.services.job_queue import job_queue

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info("WebSocket connected, total: %d", len(self.active))

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
            logger.info("WebSocket disconnected, total: %d", len(self.active))

    async def broadcast(self, jobs: list[Job]):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json([job.to_dict() for job in jobs])
            except Exception as e:
                logger.debug("Broadcast failed for client, removing: %s", e)
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)
        if dead:
            logger.debug("Cleaned %d dead WebSocket connections", len(dead))


manager = ConnectionManager()


async def ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        jobs = await job_queue.list_all()
        logger.info("WS client received %d jobs on connect", len(jobs))
        await websocket.send_json([job.to_dict() for job in jobs])
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        manager.disconnect(websocket)


async def broadcast_loop():
    last_sent = None
    while True:
        try:
            jobs = await job_queue.list_all()
            if jobs != last_sent:
                await manager.broadcast(jobs)
                last_sent = jobs
        except Exception as e:
            logger.error("Broadcast loop error: %s", e)
        await asyncio.sleep(0.5)
