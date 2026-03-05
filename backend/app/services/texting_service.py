from app.serial.meshtastic_client import send_text_message_client

def send_text_message(app, destination:str, text:str):
    """Function to send a text message via the Meshtastic interface"""
    interface = app.state.meshtastic_interface
    if not interface:
        raise ValueError("Meshtastic interface not initialized. Cannot send message.")
    try:
        # Send text message using the Meshtastic interface
        sent_id  = send_text_message_client(interface, destination, text)
        return sent_id
    except Exception as e:
        print(f"Error sending text message: {e}")
        raise ValueError(f"Failed to send text message: {e}")