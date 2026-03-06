from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.models.route_table_models import RouteTableRequest, RouteTableResponse
from app.services.route_table_service import get_route_table_serial

router = APIRouter(prefix="/aodv", tags=["AODV Serial"])


@router.post("/route-table/serial", response_model=RouteTableResponse)
async def route_table_serial(req: RouteTableRequest):
    try:
        result = await run_in_threadpool(
            get_route_table_serial,
            req.port,
            req.timeout,
            req.channel_index,
            req.want_ack,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))