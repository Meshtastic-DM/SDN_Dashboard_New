from sqlalchemy import Column, ForeignKey, Integer, LargeBinary, Float, DateTime
from app.core.database import Base

class LinkQuality(Base):
    __tablename__ = "link_quality"

    id = Column(Integer, primary_key=True, index=True)

    reporter = Column(LargeBinary(4), ForeignKey("nodes.id"), nullable=False)

    relay_node1 = Column(LargeBinary(4), nullable=True)
    relay_node2 = Column(LargeBinary(4), nullable=True)
    relay_node3 = Column(LargeBinary(4), nullable=True)

    relay_node1_rxgood = Column(Integer, nullable=True)
    relay_node1_rxbad = Column(Integer, nullable=True)

    relay_node2_rxgood = Column(Integer, nullable=True)
    relay_node2_rxbad = Column(Integer, nullable=True)

    relay_node3_rxgood = Column(Integer, nullable=True)
    relay_node3_rxbad = Column(Integer, nullable=True)

    channel_util = Column(Float, nullable=True)
    air_util_tx = Column(Float, nullable=True)

    last_heard = Column(DateTime, nullable=True)