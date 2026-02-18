#!/usr/bin/env bash
set -euo pipefail

RC_ID=""
ENVIRONMENT="staging"
AUTHOR="${USER:-unknown}"
DATE_STR="$(date +%F)"
TIME_STR="$(date +%H%M)"
TEMPLATE_PATH="docs/RELEASE_EVIDENCE.md"
OUT_DIR="docs/releases"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rc)
      RC_ID="${2:-}"
      shift 2
      ;;
    --env)
      ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --author)
      AUTHOR="${2:-}"
      shift 2
      ;;
    --help)
      cat <<'USAGE'
Usage:
  bash scripts/new-release-evidence.sh --rc <RC_ID> [--env <environment>] [--author <name>]

Examples:
  bash scripts/new-release-evidence.sh --rc RC-2026-02-18-01
  bash scripts/new-release-evidence.sh --rc RC-42 --env staging --author "Platform Team"
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$RC_ID" ]]; then
  echo "--rc is required"
  exit 1
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Template not found: $TEMPLATE_PATH"
  exit 1
fi

mkdir -p "$OUT_DIR"

SAFE_RC="$(echo "$RC_ID" | tr ' ' '_' | tr -cd '[:alnum:]_.-')"
OUT_PATH="${OUT_DIR}/${DATE_STR}-${TIME_STR}-${SAFE_RC}.md"

if [[ -e "$OUT_PATH" ]]; then
  echo "File already exists: $OUT_PATH"
  exit 1
fi

cp "$TEMPLATE_PATH" "$OUT_PATH"

sed -i \
  -e "s/^Date:.*/Date: ${DATE_STR}/" \
  -e "s/^Release Candidate:.*/Release Candidate: ${RC_ID}/" \
  -e "s/^Environment:.*/Environment: ${ENVIRONMENT}/" \
  -e "s/^Prepared by:.*/Prepared by: ${AUTHOR}/" \
  "$OUT_PATH"

echo "Created release evidence file:"
echo "$OUT_PATH"

