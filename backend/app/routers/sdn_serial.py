from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.models.sdn_serial_models import (
    RouteInstallRequest,
    RouteSwitchRequest,
    GenericSendResponse,
)
from app.services.sdn_serial_service import (
    send_route_install_serial,
    send_route_switch_serial,
)

router = APIRouter(prefix="/sdn", tags=["SDN Serial"])


@router.post("/route-install/serial", response_model=GenericSendResponse)
async def route_install_serial(req: RouteInstallRequest):
    try:
        details = await run_in_threadpool(
            send_route_install_serial,
            req.port,
            req.destination,
            req.path,
            req.install_id,
            req.start_node,
            req.channel_index,
            req.want_ack,
        )
        return {"status": "ok", "details": details}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/route-switch/serial", response_model=GenericSendResponse)
async def route_switch_serial(req: RouteSwitchRequest):
    try:
        details = await run_in_threadpool(
            send_route_switch_serial,
            req.port,
            req.target_node,
            req.destination,
            req.next_hop,
            req.channel_index,
            req.want_ack,
        )
        return {"status": "ok", "details": details}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))