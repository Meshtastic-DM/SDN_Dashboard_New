from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, String
from app.core.database import Base

class Route(Base):
    __tablename__ = "routes"

    sequence_number = Column(Integer, primary_key=True, index=True)
    source = Column(LargeBinary(4),ForeignKey('nodes.id'))
    destination = Column(LargeBinary(4),ForeignKey('nodes.id'))
    next_hop = Column(LargeBinary(1))
    expiring_time = Column(String)