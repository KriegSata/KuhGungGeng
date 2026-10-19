FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/app/data
WORKDIR /app
COPY pyproject.toml requirements-dev.lock ./
COPY backend ./backend
RUN pip install --no-cache-dir -c requirements-dev.lock . && useradd --uid 10001 --create-home crab && mkdir /app/data && chown crab:crab /app/data
USER crab
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
