"""Run hourly: python -m backend.cleanup. Deletion is idempotent."""
import time
from sqlalchemy import select
from .config import Settings
from .db import Feedback, Prediction, SessionRecord, Upload, database


def cleanup(settings: Settings):
    engine, sessions = database(settings.database_url)
    now = time.time()
    with sessions.begin() as db:
        for item in db.scalars(select(Upload).where(Upload.expires_at < now)):
            (settings.data_dir / "uploads" / item.object_key).unlink(missing_ok=True)
            db.delete(item)
        for prediction in db.scalars(select(Prediction).where(Prediction.created_at < now - 30 * 86400)):
            for feedback in db.scalars(select(Feedback).where(Feedback.prediction_id == prediction.id)):
                db.delete(feedback)
            db.delete(prediction)
        for session in db.scalars(select(SessionRecord).where(SessionRecord.expires_at < now)):
            db.delete(session)
    engine.dispose()


if __name__ == "__main__":
    cleanup(Settings())
