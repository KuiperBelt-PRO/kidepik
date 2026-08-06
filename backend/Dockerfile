FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml /app/pyproject.toml
COPY backend/app /app/app
COPY backend/skills /app/skills
COPY backend/agents /app/agents
COPY data/glossary /data/glossary
COPY data/waiting /data/waiting

RUN pip install --no-cache-dir -e ".[dev]"

ENV PYTHONUNBUFFERED=1
ENV MEDIA_ROOT=/var/www/html/media
ENV LOG_DIR=/var/www/html/logs
ENV MIGRATIONS_DIR=/var/www/supabase/migrations
ENV JOURNEY_DATA_DIR=/data/journey
ENV GLOSSARY_DATA_DIR=/data/glossary
ENV WAITING_DATA_DIR=/data/waiting

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
