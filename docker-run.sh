#!/usr/bin/env bash
# docker-run.sh - Run bull-exporter container with environment variables from .env

docker run -d \
  --name bull-exporter \
  --env-file .env \
  -p 9538:9538 \
  --restart unless-stopped \
  bull-exporter

# Alternative: Run interactively (for debugging)
# docker run -it --rm \
#   --name bull-exporter \
#   --env-file .env \
#   -p 9538:9538 \
#   bull-exporter
