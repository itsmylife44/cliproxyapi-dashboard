FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tini && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with specific UID/GID
RUN groupadd --gid 1001 --system appgroup && \
    useradd --system --uid 1001 --gid 1001 --no-create-home appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup entrypoint.sh app.py ./
RUN chmod +x entrypoint.sh

USER appuser

EXPOSE 8766

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
    CMD curl -f http://localhost:8766/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./entrypoint.sh"]
