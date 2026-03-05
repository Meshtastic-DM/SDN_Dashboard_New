#TODO: This need to be deleted when the Meshtastic client is fully integrated and tested, as the client will handle parsing internally and emit structured events instead of raw lines. @Tharoosha
import time
import serial

def iter_serial_lines(port: str, baud: int = 115200):
    with serial.Serial(port, baud, timeout=1) as ser:
        time.sleep(2)  # Arduino reset delay
        while True:
            raw = ser.readline()
            if not raw:
                continue
            yield raw.decode("utf-8", errors="ignore").strip()

def iter_fake_lines():
    i = 0
    while True:
        # simulate changing values
        yield f"[SDN_ROUTE_UPDATE] seq_no={i} reporting_node={i} destination={i+2} next_hop={i+1} expiring_time=2024-06-01T12:00:00Z"
        i += 1
        time.sleep(10000)
        if i == 25:
            i = 0