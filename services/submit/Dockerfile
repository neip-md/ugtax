# ERiC submission service
#
# IMPORTANT: This image does NOT include the ERiC library itself.
# Mount the extracted ERiC tree into /opt/eric/lib at runtime
# (see eric/README.md for staging instructions).
#
# The feldkennung_map.json baked into the image must be regenerated when
# the ERiC version bumps. Run:
#   PYTHONPATH=src python3 -m ug_steuer.feldkennung_extractor
#
# Build (from repo root, NOT from services/submit/):
#   docker build -f services/submit/Dockerfile -t ugtax-eric .
# Run:
#   docker run -v /opt/eric:/opt/eric:ro -p 8000:8000 \
#     -e ERIC_PATH=/opt/eric/lib \
#     -e SHARED_BEARER_TOKEN=<secret> \
#     ugtax-eric

FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn python-multipart

# Copy app + the generated feldkennung_map.json (lives in services/submit/)
COPY services/submit/ /app/services/submit/
COPY src/ /app/src/

ENV ERIC_PATH=/opt/eric/lib
ENV PYTHONPATH=/app/src

EXPOSE 8000

CMD ["uvicorn", "services.submit.main:app", "--host", "0.0.0.0", "--port", "8000"]
