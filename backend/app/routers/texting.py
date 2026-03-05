from fastapi import APIRouter, WebSocket, Request, HTTPException
from app.services.texting_service import send_text_message
from app.services.db_update_service import get_messages_by_conversation

router = APIRouter(prefix="/api/texting", tags=["texting"])

@router.websocket("/ws/texts")
async def ws_texts(ws: WebSocket):
    await ws.accept()
    broadcaster = ws.app.state.text_message_broadcaster  # Use separate broadcaster for texts
    broadcaster.register(ws)
    try:
        while True:
            await ws.receive_text()  # Keep connection open, ignore incoming messages
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        broadcaster.unregister(ws)

@router.post("/send")
async def send_text(request: Request, destination: str, text: str):
    """API endpoint to send a text message via the Meshtastic interface"""
    try:
        mes_id = send_text_message(request.app, destination, text)
        return {"status": "success", "message": f"Text message sent to {destination}", "mes_id": mes_id}
    except Exception as e:
        print(f"Error in send_text endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/all_messages")
async def get_all_messages(request: Request, conversation: str = None):
    """API endpoint to retrieve all text messages, optionally filtered by conversation"""
    messages = get_messages_by_conversation(conversation)
    
    # Convert Message objects to JSON-serializable dicts
    messages_serialized = []
    for message in messages:
        msg_dict = {
            "mes_id": message.mes_id,
            "source_id": message.source_id.hex() if message.source_id else None,
            "destination_id": message.destination_id.hex() if message.destination_id else None,
            "text": message.text,
            "timestamp": message.timestamp.isoformat() if message.timestamp else None,
            "rssi": message.rssi,
            "channel": message.channel,
            "conversation": message.conversation,
            "sent_by_me": message.sent_by_me,
            "ack_status": message.ack_status,
            "ack_timestamp": message.ack_timestamp.isoformat() if message.ack_timestamp else None
        }
        messages_serialized.append(msg_dict)
    
    return {"status": "success", "messages": messages_serialized}