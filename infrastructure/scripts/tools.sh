#!/usr/bin/env bash
# Runs a one-off tools job against a deployed environment with the image of the
# last successful deploy (image.env), e.g. on the VPS:
#
#   tools.sh /home/konrad/docker/bsv/dev apply --dry-run
#   tools.sh /opt/bsv-sws/production apply --allow-destructive   # reviewed schema change only!
#   tools.sh /home/konrad/docker/bsv/dev migrate:joomla                    # report only
#   tools.sh /home/konrad/docker/bsv/dev migrate:joomla --apply
#
# IMAGE_TAG=<sha> tools.sh … uses the images of that commit instead (needed after a
# deploy stopped at a destructive schema diff: image.env still holds the previous
# release). Also used by .github/workflows/directus-apply.yml.
set -euo pipefail

ENV_DIR=${1:?usage: tools.sh <env-dir> <script> [args...]}
shift
[[ $# -ge 1 ]] || { echo "usage: tools.sh <env-dir> <script> [args...]" >&2; exit 1; }
cd "$ENV_DIR"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  IMAGE_ENV=$(mktemp)
  trap 'rm -f "$IMAGE_ENV"' EXIT
  printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG" > "$IMAGE_ENV"
else
  IMAGE_ENV=image.env
  [[ -f image.env ]] || { echo "ERROR: no successful deploy yet ($ENV_DIR/image.env missing)" >&2; exit 1; }
fi

FILES=(-f compose.yml -f compose.deploy.yml)
grep -qE '^PROXY_NETWORK=.+' .env && FILES+=(-f compose.proxy.yml)

docker compose -p "bsv-sws-$(basename "$ENV_DIR")" --env-file .env --env-file "$IMAGE_ENV" \
  "${FILES[@]}" --profile tools \
  run --rm tools "$@"
