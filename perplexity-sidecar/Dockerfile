FROM python:3.12-slim

WORKDIR /app

# curl_cffi needs these system deps for TLS fingerprinting
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8766

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8766/health || exit 1

CMD ["python", "app.py"]
