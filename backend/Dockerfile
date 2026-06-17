# =============================================================================
# Collaborative Steering Pipeline — Multi-stage Docker Build
# =============================================================================

FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends     gcc     libpq-dev     && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# =============================================================================
# Production stage
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Ensure executables are in PATH
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./alembic.ini 2>/dev/null || true

# Non-root user for security (optional, commented out for simplicity)
# RUN useradd -m -u 1000 pipeline && chown -R pipeline:pipeline /app
# USER pipeline

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
