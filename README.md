# KuhGungGeng

A Philippine crab identification assistant: React/TypeScript, FastAPI, SQLAlchemy, and an optional ONNX classifier. **A trained experimental classifier is bundled at `runs/classify/crabs-yolov8n-2/weights/best.pt`. No training dataset or retraining is needed to run predictions on another machine.** Species entries and classifier results are provisional; this model is not approved for production.

## Run locally

Requires Python 3.11+ (3.12 recommended) and Node 24+.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -c requirements-dev.lock -e ".[test,training]"
Copy-Item .env.example .env
.venv\Scripts\python -m uvicorn backend.main:app --reload
```

In another terminal:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**. Vite proxies `/api` to FastAPI; use one hostname consistently for session cookies. Linux/macOS use `.venv/bin/python` and `cp` instead.

The copied `.env.example` enables the bundled checkpoint. Install dependencies once per machine; subsequent pulls reuse the checkpoint and require no training. If you already have a `.env`, set `EXPERIMENTAL_CLASSIFIER=runs/classify/crabs-yolov8n-2/weights/best.pt` and restart the backend. Predictions run on CPU; a GPU is not required. The `Crabs/` training photos, generated splits, and annotations are intentionally excluded from Git. Clear `EXPERIMENTAL_CLASSIFIER` for no-model mode or to use an approved `MODEL_MANIFEST` bundle instead.

Alternatively: `docker compose up --build`, then open **http://localhost:8080**. This Compose configuration is a local development deployment with PostgreSQL and hourly cleanup; it is not configured for public exposure.

## What works

- Responsive photo upload/camera selection, field guide, private observation history, corrections, and reviewer queues.
- Server-side content decoding, size/pixel bounds, approximate image-quality checks, EXIF removal, private sanitized image storage, and optional ClamAV scanning.
- Cookie sessions, CSRF validation, origin checks, reviewer-key authorization, bounded inference concurrency, and rate limits.
- Species knowledge separated from inference, source citations, explicit unknown safety fields, and provisional review dates.
- Optional checksummed ONNX bundles with temperature scaling, energy rejection, confidence/margin thresholds, and quality-based abstention.
- Reviewed dataset metadata intake, audited review decisions, leakage-resistant split tooling, and an offline baseline training/export command.

All species illustrations are generic drawings, not diagnostic photographs. English names are provisional; Tagalog/Cebuano names are deliberately absent until region-specific evidence is reviewed. No species-level food-safety certification is made.

## Tests

```powershell
.venv\Scripts\python -m pytest --cov=backend --cov-report=term-missing
npm test
npm run build
```

`python scripts/smoke.py` additionally starts temporary local API/frontend processes, verifies the real HTTP upload/history/delete flow through the frontend proxy, and stops those processes. Ports 8000 and 5173 must be free. The Python constraint file targets Python 3.12 across platforms; optional ML/training dependencies need a separate environment lock after hardware selection.

## Reviewer access

Set `ADMIN_API_KEY` to a randomly generated secret in `.env` and restart the API. Open **Reviewer workspace** in the footer. The browser holds the key only in component memory, never local storage. This single-reviewer credential is for the MVP; replace it with individual OIDC identities/MFA before a multi-reviewer production launch.

Dataset registration uses `POST /api/admin/dataset` with `X-Admin-Key` and the session CSRF token. See OpenAPI for the typed request. This endpoint records metadata; it does not download arbitrary URLs or grant reuse rights. Reviewer acceptance does not assign a split or promote feedback into training.

## Retention

Images become inaccessible after 24 hours; prediction history expires after 30 days. Run `python -m backend.cleanup` hourly to physically remove expired records and images. Compose includes this worker. Explicit observation deletion also deletes its image and feedback. No user photos enter training. Local standalone development requires scheduling cleanup yourself.

## Model development

1. Obtain licensed, expert-reviewed photographs and create a provenance JSONL manifest as described in [the production plan](docs/production-plan.md).
2. `python -m ml.split curated.jsonl split.jsonl` creates grouped splits. Freeze and audit these assignments; ensure all classes occur in train/validation/calibration/test.
3. Install optional training dependencies: `pip install -e ".[training]"`.
4. `python -m ml.train split.jsonl path/to/images models/candidate --epochs 10` trains the legacy EfficientNet-B0 classifier. For the planned detector, add expert-reviewed normalized `bbox_xywh` values to each manifest row and run `python -m ml.train_yolov8 split.jsonl path/to/images models/yolov8-candidate --epochs 50`. This downloads pretrained weights; review their provenance, terms, and Ultralytics licensing before deployment.
5. Tune abstention on a separate policy-development set containing unknown species. Evaluate against sealed test and OOD sets, verify PyTorch/ONNX parity, and obtain expert sign-off. The candidate's placeholder rejection thresholds intentionally reject everything and `approved_for_release` is false.
6. After completing those gates, put the approved bundle path in `MODEL_MANIFEST` and install `.[ml]`. The API validates labels, checksum, approval marker, and output shape at startup.

### YOLOv8 preparation checklist

#### Image classification without bounding boxes

For an experimental whole-image species classifier, use the class folders in `Crabs`:

```powershell
.venv-training\Scripts\python -m ml.train_classification Crabs data/crabs-classification --prepare-only
.venv-training\Scripts\python -m ml.train_classification Crabs data/crabs-classification --reuse-data --epochs 30 --batch 32
```

Preparation decodes images, removes exact duplicates, excludes conflicting duplicate labels,
and keeps connected perceptual near-duplicates together across deterministic 70/15/15 splits.
It copies normalized JPEGs into `data/crabs-classification`; source photos and annotations remain intact.
Inspect `preparation-report.json` and the frozen `split.jsonl` there. Folder names are provisional labels;
source/photographer grouping and rights still require review. Test images stay out of training validation.
Training uses `yolov8n-cls.pt`, 224-pixel inputs, GPU 0, and zero loader workers on Windows.
Weights and metrics appear under `runs/classify/crabs-yolov8n` (or a numbered directory on later runs).
Use `weights/best.pt` for experimental predictions with the Ultralytics classification API.
This classifier is not a release-approved API bundle; app integration needs matching preprocessing
and output handling, species registration, evaluation, and rejection calibration.

For local app testing with the trained classifier, set this in `.env` and restart the backend:

```dotenv
EXPERIMENTAL_CLASSIFIER=runs/classify/crabs-yolov8n-2/weights/best.pt
```

The backend uses Ultralytics' native classification preprocessing on CPU and returns its
probabilities directly. It registers provisional catalog entries for all eight model classes
and labels predictions experimental. Confidence 0.70 and margin 0.15 are provisional abstention
thresholds; unknown-species rejection is not calibrated. This path is refused in production
and does not change the approval requirements for ONNX bundles. Clear this setting to return
to `MODEL_MANIFEST` or the no-model behavior. Install `.[training]` in the backend environment
when enabling this checkpoint path.

#### Windows RTX 5060 training setup

Run `powershell -ExecutionPolicy Bypass -File scripts/setup-training.ps1` from the repository root.
This uses `uv` to install project-local Python 3.12.10 and an isolated `.venv-training`,
installs PyTorch 2.7.1 / torchvision 0.22.1 with CUDA 12.8 for RTX 50-series GPUs,
installs the training extras, checks GPU NMS and a YOLOv8 forward/backward pass,
and saves the installed versions in `requirements-training.lock`.
The initial download includes approximately 3 GB for PyTorch. No separate CUDA toolkit is required.
Select `.venv-training\Scripts\python.exe` as the interpreter in VS Code.

After preparing a reviewed split manifest with bounding boxes, run:

```powershell
.venv-training\Scripts\python -m ml.train_yolov8 split.jsonl Crabs models/yolov8-candidate --model yolov8n.pt --epochs 50 --device 0 --batch 8 --workers 0
```

Start with batch 8 at 640 pixels for the 8 GB GPU; reduce to 4 if GPU memory is exhausted.
The command downloads pretrained weights on first use and exports a candidate ONNX bundle.
Recheck the environment with `.venv-training\Scripts\python scripts/check_training.py`.
The `Crabs` class folders alone are insufficient for detection: supply real bounding-box annotations,
image checksums, rights/review metadata, and frozen split assignments first. See `ml/train_yolov8.py`
for the manifest fields. The setup check uses random tensors and does not train on these photos.

Before a detector can be approved:

- Annotate every crab with a bounding box in normalized `x_center, y_center, width, height` format; annotate multi-crab images separately.
- Keep observation, photographer, exact-image, near-duplicate, geographic, and temporal groups together across splits.
- Preserve a sealed test set and separate unknown taxa/non-crab set; do not use user uploads as training data.
- Evaluate detection mAP/IoU as well as species top-1/top-3 accuracy after cropping detections, accepted-prediction accuracy, coverage, no-crab rejection, and false detections.
- Tune confidence and IoU thresholds on policy-development data only. The generated manifest is deliberately unapproved.
- Verify PyTorch/ONNX parity, CPU latency, memory use, licensing, model checksum, expert review, and production rollback.

The detector path currently expects the Ultralytics ONNX output shape `[1, 4 + class_count, detection_count]` with `xywh` box coordinates in the model input pixel space. It intentionally does not claim accuracy or perform release approval.

The approval marker is an operator assertion, not a cryptographic approval system. Production must control bundle write access and preserve evaluation artifacts. The optional GPU training/export path has no real dataset bundled and must be validated on your training machine. Never enable a candidate just to make the UI show predictions.

## Deployment boundary

`APP_ENV=production` refuses startup without a model bundle, HTTPS origins, a 32-character reviewer key, and a ClamAV host. Before public deployment, also complete TLS/ingress configuration, decoder process isolation, schema migrations, per-reviewer identity, distributed rate limiting, backups/deletion verification, accessibility/mobile browser QA, real model evaluation, and species expert review. These are tracked in [the implementation-ready production plan](docs/production-plan.md).

No external site was published, no photos were downloaded for training, and no model accuracy is claimed.
