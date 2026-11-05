#!/usr/bin/env bash
# Smoke-test an already-built image on an automatically assigned loopback port.
set -euo pipefail

image_name="${1:-agent-wiki:local}"
container_id="$(docker run -d --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1::8080 "$image_name")"
trap 'docker stop "$container_id" >/dev/null' EXIT

site_path="$(docker exec "$container_id" cat /etc/wiki-path)"
host_address="$(docker port "$container_id" 8080/tcp)"
base_url="http://${host_address}${site_path}"
for attempt in {1..30}; do
  if curl --fail --silent "$base_url" >/dev/null; then
    break
  fi
  sleep 1
done
for asset in '' search.json llms.txt api/articles.json api/changes.json; do
  curl --fail --silent "${base_url}${asset}" >/dev/null
done
if curl --fail --silent "${base_url}missing-article/" >/dev/null; then
  echo 'Missing article unexpectedly returned success.' >&2
  exit 1
fi
docker exec "$container_id" sh -c 'test ! -d /app && test ! -d /usr/share/nginx/html/.git && ! command -v node && ! command -v git'
printf 'Container passed: %s (HTML, search, agent exports, 404, static runtime).\n' "$base_url"
