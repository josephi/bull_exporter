#!/usr/bin/env bash
# docker-run.sh - Run tipalti-bull-exporter container with environment variables from .env

docker run -d \
  --name tipalti-bull-exporter \
  --env-file .env \
  -p 9538:9538 \
  --restart unless-stopped \
  tipalti-bull-exporter

# Alternative: Run interactively (for debugging)
# docker run -it --rm \
#   --name tipalti-bull-exporter \
#   --env-file .env \
#   -p 9538:9538 \
#   tipalti-bull-exporter
