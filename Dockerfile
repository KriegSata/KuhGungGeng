FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/app/data
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml requirements-dev.lock ./
COPY backend ./backend
COPY runs/classify/crabs-yolov8n-2/weights/best.pt ./runs/classify/crabs-yolov8n-2/weights/best.pt
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -c requirements-dev.lock '.[training]' && useradd --uid 10001 --create-home crab && mkdir /app/data && chown crab:crab /app/data
USER crab
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
