# GarageClick backend — production image
FROM python:3.13-slim

# Don't write .pyc, unbuffered logs (good for container logs)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

EXPOSE 8000

# start.sh runs migrations + catalog seed (idempotent), then serves the API.
# Single worker on purpose: the logout token denylist is in-memory (see DEPLOY.md).
RUN chmod +x start.sh
CMD ["./start.sh"]
