#!/usr/bin/env bash
set -euo pipefail
smoke_dir="$(mktemp -d)"
trap 'rm -rf "$smoke_dir"' EXIT
export XDG_CACHE_HOME="$smoke_dir/cache"
export XDG_CONFIG_HOME="$smoke_dir/config"
node tests/browser-fixture.cjs "$smoke_dir"
python tests/browser-smoke.py "$smoke_dir"
