from pydantic import BaseModel, Field


class RouteInstallRequest(BaseModel):
    port: str = Field(..., examples=["/dev/ttyUSB0"])
    destination: int = Field(..., description="Destination node number (int)")
    path: list[int] = Field(..., description="Hop list, each 0..255, max 8")
    install_id: int = Field(1, ge=0, le=255)
    start_node: int | None = Field(None, description="If omitted, first hop in path is used")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class RouteSwitchRequest(BaseModel):
    port: str = Field(..., examples=["/dev/ttyUSB0"])
    target_node: int = Field(..., description="Node that applies route switch")
    destination: int = Field(..., description="Destination node number (int)")
    next_hop: int = Field(..., ge=0, le=255)
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class GenericSendResponse(BaseModel):
    status: str
    details: dict