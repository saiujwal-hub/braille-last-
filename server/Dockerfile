# Braille Bridge server container (CPU-first, hackathon friendly).
# For a GPU build, swap the base image and install torch CUDA wheels instead.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BB_PRELOAD=true \
    BB_HOST=0.0.0.0 \
    BB_PORT=8000

WORKDIR /srv

# System deps for OpenCV / PyTorch wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install core first (boots without GPU). ML extras are opt-in via extras file.
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY .env.example ./

RUN mkdir -p weights logs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status==200 else 1)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
