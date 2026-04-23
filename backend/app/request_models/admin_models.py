from pydantic import BaseModel, Field
from typing import Optional, List


# Owner Management
class OwnerInfo(BaseModel):
    long_name: str = Field("", description="Long name (callsign)")
    short_name: str = Field("", description="Short name")
    is_licensed: bool = Field(False, description="Is licensed user")
    is_unmessagable: bool = Field(False, description="User cannot receive messages")


class SetOwnerRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex, e.g. a1b2c3d4")
    owner: OwnerInfo
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# Device Configuration
class DeviceConfig(BaseModel):
    role: int = Field(1, description="Device role (1=CLIENT, 2=ROUTER, etc)")
    button_gpio: int = Field(-1, description="Button GPIO pin")
    buzzer_gpio: int = Field(-1, description="Buzzer GPIO pin")
    rebroadcast_mode: int = Field(0, description="Rebroadcast mode")
    led_heartbeat_disabled: bool = Field(False)
    node_info_broadcast_secs: int = Field(3600, ge=1)


class PositionConfig(BaseModel):
    gps_mode: int = Field(1, description="GPS mode (0=DISABLED, 1=ENABLED)")
    fixed_position: bool = Field(False)


class PowerConfig(BaseModel):
    device_battery_ina_address: int = Field(0)
    is_power_saving: bool = Field(False)
    ls_secs: int = Field(300)
    min_wake_secs: int = Field(10)
    on_battery_shutdown_after_secs: int = Field(0)
    sds_secs: int = Field(4 * 3600)
    wait_bluetooth_secs: int = Field(60)


class LoRaConfig(BaseModel):
    use_preset: bool = Field(True)
    region: int = Field(0, description="LoRa region code")
    modem_preset: int = Field(1)
    bandwidth: int = Field(250)
    spread_factor: int = Field(11)
    coding_rate: int = Field(5)
    tx_power: int = Field(17)
    frequency_offset: int = Field(0)
    override_frequency: int = Field(0)
    channel_num: int = Field(0)
    tx_enabled: bool = Field(True)


class SetConfigRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    config_type: int = Field(..., description="Config type (0=DEVICE, 1=POSITION, 2=POWER, 3=NETWORK, 4=DISPLAY, 5=LORA, 6=BT, 7=SECURITY)")
    device_config: Optional[DeviceConfig] = None
    position_config: Optional[PositionConfig] = None
    power_config: Optional[PowerConfig] = None
    lora_config: Optional[LoRaConfig] = None
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# Reboot/Shutdown
class RebootRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    delay_seconds: int = Field(0, ge=0, description="Delay before reboot in seconds")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


class ShutdownRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    delay_seconds: int = Field(0, ge=0, description="Delay before shutdown in seconds")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# Factory Reset
class FactoryResetRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    reset_type: int = Field(0, description="0=config_only, 1=full_device_reset")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# NodeDB Reset
class NodeDBResetRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    reset_nodedb_and_clear_favorites: bool = Field(False)
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# Channel Management
class ChannelSettings(BaseModel):
    name: str = Field("", description="Channel name")


class ChannelConfig(BaseModel):
    index: int = Field(..., ge=0, le=7, description="Channel index")
    settings: ChannelSettings
    role: int = Field(0, description="Channel role")
    downlink_enabled: bool = Field(False)
    uplink_enabled: bool = Field(True)


class SetChannelRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel: ChannelConfig
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


# Getter Requests
class GetOwnerRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


class GetConfigRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    config_type: int = Field(..., description="Config type to retrieve")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


class GetChannelRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel_index: int = Field(..., ge=0, le=7, description="Channel index to retrieve")
    want_ack: bool = True


class GetDeviceMetadataRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


class GetDeviceConnectionStatusRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = True


# Node Management
class RemoveFavoriteNodeRequest(BaseModel):
    target_node: str | int = Field(..., description="Node that removes favorite as hex")
    node_to_remove: str | int = Field(..., description="Node ID to remove from favorites as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class SetFavoriteNodeRequest(BaseModel):
    target_node: str | int = Field(..., description="Node that adds favorite as hex")
    node_to_favorite: str | int = Field(..., description="Node ID to favorite as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class SetIgnoredNodeRequest(BaseModel):
    target_node: str | int = Field(..., description="Node that ignores as hex")
    node_to_ignore: str | int = Field(..., description="Node ID to ignore as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class RemoveIgnoredNodeRequest(BaseModel):
    target_node: str | int = Field(..., description="Node that removes ignore as hex")
    node_to_unignore: str | int = Field(..., description="Node ID to unignore as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


# Ham Mode
class HamParameters(BaseModel):
    call_sign: str = Field(..., description="Amateur radio call sign")
    short_name: str = Field(..., description="Short name for ham mode")
    tx_power: int = Field(20, description="TX power in dBm")
    frequency: int = Field(0, description="Override frequency")


class SetHamModeRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    ham_params: HamParameters
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


# Position Management
class SetFixedPositionRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    latitude: float = Field(..., description="Latitude in degrees")
    longitude: float = Field(..., description="Longitude in degrees")
    altitude: int = Field(0, description="Altitude in meters")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


class RemoveFixedPositionRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


# Time Management
class SetTimeOnlyRequest(BaseModel):
    target_node: str | int = Field(..., description="Target node ID as hex")
    timestamp: int = Field(..., description="Unix timestamp in seconds")
    channel_index: int = Field(0, ge=0)
    want_ack: bool = False


# Generic Response
class AdminMessageResponse(BaseModel):
    status: str
    details: dict
    message: Optional[str] = None
