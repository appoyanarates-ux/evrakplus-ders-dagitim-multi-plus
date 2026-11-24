FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-21-jre-headless curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY solver/requirements.txt /app/solver/requirements.txt
RUN pip install --no-cache-dir -r /app/solver/requirements.txt

COPY solver/ /app/solver/
COPY engines/ /app/engines/
COPY resources/models/ /app/resources/models/
COPY solver-server/server.py /app/solver-server/server.py

ENV PORT=8787
EXPOSE 8787
CMD ["python", "/app/solver-server/server.py"]
