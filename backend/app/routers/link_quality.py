from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.services.link_quality_service import (
    get_all_link_quality_reports,
    get_link_quality_by_reporter,
    format_link_quality_for_api
)

router = APIRouter(prefix="/api/link-quality", tags=["link-quality"])

@router.get("/reports")
def get_link_quality_reports(
    limit: int = Query(100, description="Maximum number of reports to return"),
    reporter: Optional[str] = Query(None, description="Filter by reporter node ID (hex format, e.g., '0x6d8c490' or '6d8c490')"),
    db: Session = Depends(get_db)
):
    """
    Get link quality reports from the database.
    
    Args:
        limit: Maximum number of reports to return (default: 100)
        reporter: Optional filter by reporter node ID in hex format
        db: Database session
    
    Returns:
        List of link quality reports with statistics
    
    Examples:
        /api/link-quality/reports - Get all reports (limited to 100)
        /api/link-quality/reports?limit=50 - Get 50 most recent reports
        /api/link-quality/reports?reporter=0x6d8c490 - Get reports from specific reporter
    """
    if reporter:
        # Parse hex reporter ID
        reporter_hex = reporter.lower().strip()
        if reporter_hex.startswith("0x"):
            reporter_hex = reporter_hex[2:]
        
        # Pad to 8 characters (4 bytes)
        reporter_hex = reporter_hex.zfill(8)
        
        try:
            reporter_bytes = bytes.fromhex(reporter_hex)
            reports = get_link_quality_by_reporter(db, reporter_bytes, limit)
        except ValueError:
            return {"error": "Invalid reporter ID format", "reports": []}
    else:
        reports = get_all_link_quality_reports(db, limit)
    
    # Format reports for API response
    formatted_reports = [format_link_quality_for_api(report) for report in reports]
    
    # Calculate statistics
    total_reports = len(formatted_reports)
    if total_reports > 0:
        total_quality = 0
        unique_relay_nodes = set()
        total_channel_util = 0
        total_air_util_tx = 0
        measurement_count = 0
        
        for report in formatted_reports:
            for i in range(len(report["rx_good"])):
                good = report["rx_good"][i]
                bad = report["rx_bad"][i]
                total = good + bad
                if total > 0:
                    total_quality += (good / total) * 100
                    measurement_count += 1
                    # Track unique relay node IDs
                    unique_relay_nodes.add(report["relay_nodes"][i])
            
            total_channel_util += report["channel_util"]
            total_air_util_tx += report["air_util_tx"]
        
        total_relays = len(unique_relay_nodes)
        stats = {
            "avg_quality": total_quality / measurement_count if measurement_count > 0 else 0,
            "total_relays": total_relays,
            "avg_channel_util": (total_channel_util / total_reports) * 100,
            "avg_air_util_tx": (total_air_util_tx / total_reports) * 100,
            "reports_count": total_reports
        }
    else:
        stats = {
            "avg_quality": 0,
            "total_relays": 0,
            "avg_channel_util": 0,
            "avg_air_util_tx": 0,
            "reports_count": 0
        }
    
    return {
        "stats": stats,
        "reports": formatted_reports
    }


@router.get("/stats")
def get_network_quality_stats(
    db: Session = Depends(get_db)
):
    """
    Get aggregated network quality statistics.
    
    Returns:
        Network-wide quality statistics
    """
    reports = get_all_link_quality_reports(db, limit=100)
    formatted_reports = [format_link_quality_for_api(report) for report in reports]
    
    total_reports = len(formatted_reports)
    if total_reports > 0:
        total_quality = 0
        unique_relay_nodes = set()
        total_channel_util = 0
        total_air_util_tx = 0
        
        for report in formatted_reports:
            for i in range(len(report["rx_good"])):
                good = report["rx_good"][i]
                bad = report["rx_bad"][i]
                total = good + bad
                if total > 0:
                    total_quality += (good / total) * 100
                    # Track unique relay node IDs
                    unique_relay_nodes.add(report["relay_nodes"][i])
            
            total_channel_util += report["channel_util"]
            total_air_util_tx += report["air_util_tx"]
        
        total_relays = len(unique_relay_nodes)
        return {
            "avg_quality": total_quality / total_relays if total_relays > 0 else 0,
            "total_relays": total_relays,
            "avg_channel_util": (total_channel_util / total_reports) * 100,
            "avg_air_util_tx": (total_air_util_tx / total_reports) * 100,
            "reports_count": total_reports
        }
    else:
        return {
            "avg_quality": 0,
            "total_relays": 0,
            "avg_channel_util": 0,
            "avg_air_util_tx": 0,
            "reports_count": 0
        }
