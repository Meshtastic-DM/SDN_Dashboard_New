from app.core.database import SessionLocal
from app.models.full_route import FullRoute
from app.models.link_quality import LinkQuality
from app.models.route import Route


def clear_network_session_data():
    """Clear network-derived data that should not survive a fresh backend start."""
    db = SessionLocal()
    try:
        full_routes_deleted = db.query(FullRoute).delete(synchronize_session=False)
        routes_deleted = db.query(Route).delete(synchronize_session=False)
        link_quality_deleted = db.query(LinkQuality).delete(synchronize_session=False)
        db.commit()

        print(
            "Cleared stale network session data on startup: "
            f"{routes_deleted} routes, "
            f"{full_routes_deleted} full routes, "
            f"{link_quality_deleted} link quality reports"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
