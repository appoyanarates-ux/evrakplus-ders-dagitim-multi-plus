# EvrakPlus Ders Dagitim Multi Plus — Linux Optimizasyon Sunucusu (6 Motorlu)
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# OpenJDK 21 (Timefold + Choco) + temel araclar
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/solver-server/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY engines /app/engines
COPY resources/engines /app/resources/engines
COPY apps/solver-server /app/apps/solver-server

EXPOSE 8080

CMD ["uvicorn", "apps.solver-server.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
