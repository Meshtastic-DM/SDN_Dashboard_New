from sqlalchemy import Boolean, Column, Integer, BigInteger, LargeBinary, String, Float, DateTime
from app.core.database import Base

class Message(Base):
    __tablename__ = "messages"

    mes_id = Column(BigInteger, primary_key=True, index=True)
    source_id = Column(LargeBinary(4), primary_key=True)
    destination_id = Column(LargeBinary(4))
    text = Column(String)
    timestamp = Column(DateTime)
    rssi = Column(Float)
    channel = Column(Integer)
    conversation = Column(String)  # Optional: to group messages into conversations
    sent_by_me = Column(Boolean)  # 1 if sent by this node, 0 if received
    ack_status = Column(String)  # "pending", "ACKED", "NAKED"
    ack_timestamp = Column(DateTime)  # When ACK/NAK was received