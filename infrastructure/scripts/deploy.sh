#!/usr/bin/env bash
# Deploys one environment on the VPS. Called by GitHub Actions over SSH
# (.github/workflows/deploy.yml), can also be run by hand:
#
#   deploy.sh <env-dir> <image-tag>        e.g. deploy.sh /home/konrad/docker/bsv/dev 3f2a1c9
#
# <env-dir> contains the environment's .env (secrets, never in git) and the
# compose files copied by the workflow. Steps:
#   1. pull the images of <image-tag>
#   2. start postgres + directus, wait until healthy
#   3. apply Directus settings/schema/permissions (non-destructive only – a
#      destructive diff makes `apply` fail and the deploy stop, spec §14.3)
#   4. start api + web, wait until healthy, record the deployed tag
# On failure the previous api/web containers keep running (step 4 not reached).
set -euo pipefail

ENV_DIR=${1:?usage: deploy.sh <env-dir> <image-tag>}
TAG=${2:?usage: deploy.sh <env-dir> <image-tag>}
ENV_NAME=$(basename "$ENV_DIR")
PROJECT="bsv-sws-${ENV_NAME}"

cd "$ENV_DIR"
[[ -f .env ]] || { echo "ERROR: $ENV_DIR/.env missing (see infrastructure/deployment/env.example)" >&2; exit 1; }
[[ $(stat -c %a .env 2>/dev/null || stat -f %Lp .env) == 600 ]] || echo "WARNING: $ENV_DIR/.env should be chmod 600" >&2

# The tag of this run; image.env keeps the last successful one for manual restarts.
printf 'IMAGE_TAG=%s\n' "$TAG" > image.next.env

# nginx in Docker (PROXY_NETWORK in .env): join its network instead of publishing ports.
FILES=(-f compose.yml -f compose.deploy.yml)
grep -qE '^PROXY_NETWORK=.+' .env && FILES+=(-f compose.proxy.yml)

compose() {
  docker compose -p "$PROJECT" --env-file .env --env-file "$IMAGE_ENV" \
    "${FILES[@]}" --profile app --profile tools "$@"
}

IMAGE_ENV=image.next.env
if [[ "${DEPLOY_SKIP_PULL:-}" == 1 ]]; then
  echo "==> [$PROJECT] using local images $TAG (DEPLOY_SKIP_PULL=1, rehearsal only)"
else
  echo "==> [$PROJECT] pulling images $TAG"
  compose pull --quiet directus api web tools
fi

echo "==> [$PROJECT] starting database and Directus"
compose up -d --wait --wait-timeout 180 postgres directus

echo "==> [$PROJECT] applying Directus configuration (non-destructive)"
compose run --rm tools apply

echo "==> [$PROJECT] starting api and web"
compose up -d --wait --wait-timeout 180 --remove-orphans api web

mv image.next.env image.env
IMAGE_ENV=image.env
echo "==> [$PROJECT] deployed $TAG"
compose ps --format 'table {{.Service}}\t{{.Status}}'

# Keep the disk tidy: remove images no container uses any more.
docker image prune -f >/dev/null
