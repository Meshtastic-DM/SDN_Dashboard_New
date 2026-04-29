from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.link_quality import LinkQuality
from app.core.database import SessionLocal


def save_link_quality_report(
    reporter: bytes,
    relay_nodes: list,
    rx_good: list,
    rx_bad: list,
    channel_util: float,
    air_util_tx: float
):
    """
    Save link quality report to database.
    
    Args:
        reporter: Reporter node ID as bytes (4 bytes)
        relay_nodes: List of relay node IDs (up to 3)
        rx_good: List of RX good counts
        rx_bad: List of RX bad counts
        channel_util: Channel utilization (0-1)
        air_util_tx: Air utilization TX (0-1)
    """
    db = SessionLocal()
    try:
        # Create new link quality entry
        link_quality = LinkQuality(
            reporter=reporter,
            relay_node1=relay_nodes[0] if len(relay_nodes) > 0 else None,
            relay_node2=relay_nodes[1] if len(relay_nodes) > 1 else None,
            relay_node3=relay_nodes[2] if len(relay_nodes) > 2 else None,
            relay_node1_rxgood=rx_good[0] if len(rx_good) > 0 else None,
            relay_node1_rxbad=rx_bad[0] if len(rx_bad) > 0 else None,
            relay_node2_rxgood=rx_good[1] if len(rx_good) > 1 else None,
            relay_node2_rxbad=rx_bad[1] if len(rx_bad) > 1 else None,
            relay_node3_rxgood=rx_good[2] if len(rx_good) > 2 else None,
            relay_node3_rxbad=rx_bad[2] if len(rx_bad) > 2 else None,
            channel_util=channel_util,
            air_util_tx=air_util_tx,
            last_heard=datetime.now()
        )
        
        db.add(link_quality)
        db.commit()
        db.refresh(link_quality)
        
        print(f"Saved link quality report from {reporter.hex()} to database (ID: {link_quality.id})")
        return link_quality
        
    except Exception as e:
        db.rollback()
        print(f"Error saving link quality report: {e}")
        raise
    finally:
        db.close()


def get_all_link_quality_reports(db: Session, limit: int = 100):
    """
    Fetch all link quality reports from database.
    
    Args:
        db: Database session
        limit: Maximum number of reports to return
    
    Returns:
        List of LinkQuality objects
    """
    return db.query(LinkQuality).order_by(LinkQuality.last_heard.desc()).limit(limit).all()


def get_link_quality_by_reporter(db: Session, reporter: bytes, limit: int = 50):
    """
    Fetch link quality reports for a specific reporter node.
    
    Args:
        db: Database session
        reporter: Reporter node ID as bytes
        limit: Maximum number of reports to return
    
    Returns:
        List of LinkQuality objects
    """
    return db.query(LinkQuality).filter(
        LinkQuality.reporter == reporter
    ).order_by(LinkQuality.last_heard.desc()).limit(limit).all()


def format_link_quality_for_api(lq: LinkQuality) -> dict:
    """
    Format LinkQuality database object for API response.
    
    Args:
        lq: LinkQuality database object
    
    Returns:
        Formatted dictionary for API response
    """
    # Build relay nodes list
    relay_nodes = []
    rx_good = []
    rx_bad = []
    
    if lq.relay_node1:
        relay_nodes.append(f"0x{lq.relay_node1.hex()}")
        rx_good.append(lq.relay_node1_rxgood or 0)
        rx_bad.append(lq.relay_node1_rxbad or 0)
    
    if lq.relay_node2:
        relay_nodes.append(f"0x{lq.relay_node2.hex()}")
        rx_good.append(lq.relay_node2_rxgood or 0)
        rx_bad.append(lq.relay_node2_rxbad or 0)
    
    if lq.relay_node3:
        relay_nodes.append(f"0x{lq.relay_node3.hex()}")
        rx_good.append(lq.relay_node3_rxgood or 0)
        rx_bad.append(lq.relay_node3_rxbad or 0)
    
    return {
        "report_id": lq.id,
        "reporter": f"0x{lq.reporter.hex()}",
        "reporter_node_id": int.from_bytes(lq.reporter, byteorder='big'),
        "relay_nodes": relay_nodes,
        "rx_good": rx_good,
        "rx_bad": rx_bad,
        "channel_util": lq.channel_util or 0.0,
        "air_util_tx": lq.air_util_tx or 0.0,
        "timestamp": lq.last_heard.isoformat() if lq.last_heard else None,
        "last_heard": int(lq.last_heard.timestamp()) if lq.last_heard else None
    }
