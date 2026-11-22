import hashlib
import json
import secrets
import threading
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select, text
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings
from .db import Audit, Base, DatasetItem, Feedback, Prediction, SessionRecord, Species, Upload, database
from .images import sanitize, scan
from .inference import Inference
from .species_facts import enrich
from .schemas import DatasetSubmission, FeedbackRequest, PredictRequest, ReviewRequest, SAFETY_WARNING


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir = settings.data_dir / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    engine, sessions = database(settings.database_url)
    limiter = defaultdict(deque)
    limiter_lock = threading.Lock()
    inference_lock = threading.BoundedSemaphore(2)

    @asynccontextmanager
    async def lifespan(app):
        if settings.app_env == "production":
            if settings.experimental_classifier:
                raise RuntimeError("Experimental classifiers are for local development only")
            if not settings.clamav_host or len(settings.admin_api_key) < 32 or not settings.model_manifest:
                raise RuntimeError("Production requires ClamAV, a 32+ character admin key, and a validated model bundle")
            if any(not origin.startswith("https://") for origin in settings.origins):
                raise RuntimeError("Production origins must use HTTPS")
        Base.metadata.create_all(engine)
        with sessions.begin() as db:
            documents = json.loads((Path(__file__).parent / "seed" / "species.json").read_text(encoding="utf-8"))
            if settings.experimental_classifier:
                from .classifier_catalog import documents as classifier_documents
                documents.extend(classifier_documents())
            for document in documents:
                record = db.get(Species, document["id"])
                if record:
                    record.document = enrich(record.document)
                else:
                    db.add(Species(id=document["id"], document=enrich(document)))
        with sessions() as db:
            ids = set(db.scalars(select(Species.id)).all())
        if settings.experimental_classifier:
            from .classifier import ExperimentalClassifier
            app.state.inference = ExperimentalClassifier(settings.experimental_classifier, ids)
        else:
            app.state.inference = Inference(settings.model_manifest, ids)
        if settings.app_env == "production":
            with sessions() as db:
                for identity in app.state.inference.info()["species_ids"]:
                    document = db.get(Species, identity).document
                    if document.get("identification_status") not in {"verified", "expert_reviewed"} or not document.get("last_reviewed") or not document.get("accepted_taxon_id"):
                        raise RuntimeError("Every released class requires reviewed knowledge and an accepted taxon identifier")
        app.state.sessions = sessions
        yield
        engine.dispose()

    app = FastAPI(title="Shellfie API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token", "X-Admin-Key"])

    @app.middleware("http")
    async def headers(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        # Bound the entire streamed request, including chunked multipart bodies.
        received = 0
        receive = request._receive

        async def bounded_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > settings.max_upload_bytes + 65536:
                raise HTTPException(413, "Upload exceeds 10 MiB")
            return message

        request._receive = bounded_receive
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and origin not in settings.origins:
                return JSONResponse({"error": {"code": "origin_denied", "message": "Origin not permitted"}, "request_id": request.state.request_id}, 403)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return JSONResponse({"request_id": request.state.request_id, "error": {"code": str(exc.status_code), "message": exc.detail}}, exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse({"request_id": request.state.request_id, "error": {"code": "validation_error", "message": "Request validation failed", "fields": [{"path": list(e["loc"]), "message": e["msg"]} for e in exc.errors()]}}, 422)

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        return JSONResponse({"request_id": getattr(request.state, "request_id", None), "error": {"code": "internal_error", "message": "Processing failed. Please retry or contact support with the request ID."}}, 500)

    def rate(request: Request):
        # Do not trust caller-supplied X-Forwarded-For. Production ingress limits also required.
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        with limiter_lock:
            for stale in [k for k, q in limiter.items() if not q or q[-1] < now - 60]:
                del limiter[stale]
            queue = limiter[key]
            while queue and queue[0] < now - 60:
                queue.popleft()
            if len(queue) >= settings.rate_limit:
                raise HTTPException(429, "Too many requests; try again in a minute", headers={"Retry-After": "60"})
            queue.append(now)

    def owner(request: Request):
        token = request.cookies.get("crab_session", "")
        token_hash = digest(token)
        with sessions() as db:
            record = db.get(SessionRecord, token_hash)
            if not record or record.expires_at < time.time():
                raise HTTPException(401, "Start a session before continuing")
        if request.method not in {"GET", "HEAD"}:
            if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), digest(token + ":csrf")):
                raise HTTPException(403, "Invalid CSRF token")
        return token_hash

    def admin(request: Request):
        if not settings.admin_api_key or not secrets.compare_digest(request.headers.get("x-admin-key", ""), settings.admin_api_key):
            raise HTTPException(403, "Reviewer access required")
        return "reviewer:" + digest(settings.admin_api_key)[:12]

    def owned(db, model, identity, user):
        item = db.get(model, identity)
        if item is None or item.owner != user:
            raise HTTPException(404, "Record not found")
        return item

    @app.get("/api/session", dependencies=[Depends(rate)])
    def session(request: Request, response: Response):
        token = request.cookies.get("crab_session", "")
        with sessions.begin() as db:
            record = db.get(SessionRecord, digest(token))
            if not record or record.expires_at < time.time():
                token = secrets.token_urlsafe(32)
                db.add(SessionRecord(token_hash=digest(token), expires_at=time.time() + 30 * 86400))
        response.set_cookie("crab_session", token, httponly=True, secure=settings.app_env == "production", samesite="lax", max_age=30 * 86400)
        return {"csrf_token": digest(token + ":csrf"), "history_retention_days": 30, "image_retention_hours": 24}

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/ready")
    def ready():
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ready", "inference_available": app.state.inference.info()["available"]}

    @app.get("/api/model")
    def model():
        return app.state.inference.info()

    @app.get("/api/species")
    def species():
        with sessions() as db:
            return {"items": [s.document for s in db.scalars(select(Species).order_by(Species.id))]}

    @app.get("/api/species/{species_id}")
    def species_detail(species_id: str):
        with sessions() as db:
            record = db.get(Species, species_id)
            if not record:
                raise HTTPException(404, "Species not found")
            return record.document

    @app.post("/api/uploads", status_code=201, dependencies=[Depends(rate)])
    async def upload(file: UploadFile = File(...), user: str = Depends(owner)):
        if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(415, "Use JPEG, PNG, or WebP")
        content = await file.read(settings.max_upload_bytes + 1)
        await file.close()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(413, "Image exceeds 10 MiB")
        if not content:
            raise HTTPException(422, "Image is empty")
        identity = str(uuid.uuid4())
        destination = uploads_dir / f"{identity}.jpg"
        try:
            await run_in_threadpool(scan, content, settings)
            details = await run_in_threadpool(sanitize, content, destination, settings)
            expiry = time.time() + 86400
            with sessions.begin() as db:
                db.add(Upload(id=identity, owner=user, object_key=destination.name, expires_at=expiry, **details))
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        return {"id": identity, **details, "expires_at": expiry, "training_consent": False}

    @app.get("/api/uploads/{upload_id}/image")
    def uploaded_image(upload_id: str, user: str = Depends(owner)):
        with sessions() as db:
            item = owned(db, Upload, upload_id, user)
            path = uploads_dir / item.object_key
            if item.expires_at < time.time() or not path.exists():
                raise HTTPException(410, "Image has expired")
        return FileResponse(path, media_type="image/jpeg")

    @app.post("/api/predictions", status_code=201, dependencies=[Depends(rate)])
    def predict(body: PredictRequest, request: Request, user: str = Depends(owner)):
        if not inference_lock.acquire(blocking=False):
            raise HTTPException(503, "Inference is busy; retry shortly", headers={"Retry-After": "2"})
        try:
            with sessions.begin() as db:
                item = owned(db, Upload, body.upload_id, user)
                path = uploads_dir / item.object_key
                if item.expires_at < time.time() or not path.exists():
                    raise HTTPException(410, "Image expired; upload it again")
                result = app.state.inference.predict(path, item.warnings, body.top_k)
                for candidate in result["candidates"]:
                    document = db.get(Species, candidate["species_id"]).document
                    candidate.update({"scientific_name": document["scientific_name"], "english_name": document["english_name"], "names": document["names"],
                                      "knowledge_revision": document["revision"], "sources": document["sources"], "last_reviewed": document["last_reviewed"]})
                identity = str(uuid.uuid4())
                result.update({"id": identity, "request_id": request.state.request_id, "upload_id": item.id,
                               "model_version": app.state.inference.info()["version"], "created_at": time.time(),
                               "quality_warnings": item.warnings, "safety_disclaimer": SAFETY_WARNING,
                               "confidence_explanation": result.get("confidence_explanation", "Scores are calibrated relative to supported species, not the probability that a crab is safe or that all other species are excluded."),
                               "suggested_photos": ["dorsal", "side", "claw", "legs", "carapace", "ventral_if_safely_visible"],
                               "photo_guidance": "Photograph without touching or turning the animal. Juveniles and partial views may need expert examination."})
                db.add(Prediction(id=identity, owner=user, upload_id=item.id, result=result))
            return result
        finally:
            inference_lock.release()

    @app.get("/api/predictions")
    def history(limit: int = 20, offset: int = 0, user: str = Depends(owner)):
        if not 1 <= limit <= 100 or offset < 0:
            raise HTTPException(422, "Invalid pagination")
        with sessions() as db:
            records = db.scalars(select(Prediction).where(Prediction.owner == user, Prediction.created_at > time.time() - 30 * 86400).order_by(Prediction.created_at.desc()).limit(limit).offset(offset))
            return {"items": [r.result for r in records], "limit": limit, "offset": offset}

    @app.get("/api/predictions/{prediction_id}")
    def prediction(prediction_id: str, user: str = Depends(owner)):
        with sessions() as db:
            record = owned(db, Prediction, prediction_id, user)
            if record.created_at < time.time() - 30 * 86400:
                raise HTTPException(410, "Prediction expired")
            return record.result

    @app.delete("/api/predictions/{prediction_id}", status_code=204)
    def delete_prediction(prediction_id: str, user: str = Depends(owner)):
        with sessions.begin() as db:
            record = owned(db, Prediction, prediction_id, user)
            for feedback in db.scalars(select(Feedback).where(Feedback.prediction_id == record.id)):
                db.delete(feedback)
            item = db.get(Upload, record.upload_id)
            if item:
                (uploads_dir / item.object_key).unlink(missing_ok=True)
                db.delete(item)
            db.delete(record)
        return Response(status_code=204)

    @app.post("/api/feedback", status_code=201, dependencies=[Depends(rate)])
    def feedback(body: FeedbackRequest, user: str = Depends(owner)):
        with sessions.begin() as db:
            owned(db, Prediction, body.prediction_id, user)
            if body.suggested_species_id and not db.get(Species, body.suggested_species_id):
                raise HTTPException(422, "Unknown species identifier")
            identity = str(uuid.uuid4())
            db.add(Feedback(id=identity, **body.model_dump()))
        return {"id": identity, "status": "pending", "training_eligible": False}

    @app.get("/api/admin/reviews")
    def reviews(actor: str = Depends(admin)):
        with sessions() as db:
            return {"items": [{"id": f.id, "prediction_id": f.prediction_id, "note": f.note, "suggested_species_id": f.suggested_species_id, "status": f.status} for f in db.scalars(select(Feedback).where(Feedback.status == "pending").limit(100))]}

    @app.post("/api/admin/reviews/{review_id}")
    def review(review_id: str, body: ReviewRequest, actor: str = Depends(admin), user: str = Depends(owner)):
        with sessions.begin() as db:
            item = db.get(Feedback, review_id)
            if not item:
                raise HTTPException(404, "Review not found")
            if item.status != "pending":
                raise HTTPException(409, "Review already resolved")
            item.status, item.review_note = body.decision, body.note
            db.add(Audit(id=str(uuid.uuid4()), actor=actor, action="feedback_review", target=review_id, details=body.model_dump()))
        return {"id": review_id, "status": body.decision, "training_eligible": False}

    @app.get("/api/admin/dataset")
    def dataset(actor: str = Depends(admin)):
        with sessions() as db:
            return {"items": [{"id": i.id, "status": i.status, **i.document} for i in db.scalars(select(DatasetItem).limit(100))]}

    @app.post("/api/admin/dataset", status_code=201)
    def add_dataset(body: DatasetSubmission, actor: str = Depends(admin), user: str = Depends(owner)):
        if ".." in body.object_key.split("/") or body.object_key.startswith("/"):
            raise HTTPException(422, "Object key must be relative")
        if not body.training_rights:
            raise HTTPException(422, "Training rights must be documented")
        identity = str(uuid.uuid4())
        with sessions.begin() as db:
            document = body.model_dump(mode="json")
            document["collected_at"] = time.time()
            db.add(DatasetItem(id=identity, document=document))
            db.add(Audit(id=str(uuid.uuid4()), actor=actor, action="dataset_import", target=identity, details={"provider": body.provider}))
        return {"id": identity, "status": "pending"}

    @app.post("/api/admin/dataset/{item_id}/review")
    def dataset_review(item_id: str, body: ReviewRequest, actor: str = Depends(admin), user: str = Depends(owner)):
        with sessions.begin() as db:
            item = db.get(DatasetItem, item_id)
            if not item:
                raise HTTPException(404, "Dataset item not found")
            if item.status != "pending":
                raise HTTPException(409, "Dataset review already resolved")
            item.status = body.decision
            item.document = {**item.document, "review_note": body.note, "reviewed_by": actor, "reviewed_at": time.time()}
            db.add(Audit(id=str(uuid.uuid4()), actor=actor, action="dataset_review", target=item_id, details=body.model_dump()))
        return {"id": item_id, "status": body.decision, "split": "unassigned"}

    return app


app = create_app()
