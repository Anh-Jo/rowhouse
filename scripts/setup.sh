#!/usr/bin/env bash
set -euo pipefail

echo "=== nest-starter-pack setup ==="
echo ""

# Portable in-place sed (GNU sed has no -i '' form, BSD/macOS requires it).
sed_i() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@" # GNU
  else
    sed -i '' "$@" # BSD/macOS
  fi
}

# Capitalize first letter without relying on bash 4+ (${var^}).
capitalize() {
  printf '%s' "$(printf '%s' "${1:0:1}" | tr '[:lower:]' '[:upper:]')${1:1}"
}

# 1. Ask for project name
read -rp "Project name (kebab-case, e.g. my-saas): " PROJECT_NAME

if [[ -z "$PROJECT_NAME" ]]; then
  echo "Error: project name is required"
  exit 1
fi

if [[ ! "$PROJECT_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "Error: project name must be kebab-case (lowercase, hyphens, starts with letter)"
  exit 1
fi

PROJECT_NAME_CAP="$(capitalize "$PROJECT_NAME")"

echo ""
echo "Renaming project to: $PROJECT_NAME"

# 2. Create local env files from the tracked examples (.env is gitignored, so a
#    fresh clone/template has only the examples — the app needs the real files).
if [[ -f "apps/backend/.env.example" && ! -f "apps/backend/.env" ]]; then
  cp "apps/backend/.env.example" "apps/backend/.env"
  echo "Created apps/backend/.env"
fi
if [[ -f "infra/.env.prod.example" && ! -f "infra/.env" ]]; then
  cp "infra/.env.prod.example" "infra/.env"
  echo "Created infra/.env"
fi

# 3. Replace references in config files. Order matters: the fully-qualified
#    "nest-starter-pack" is replaced before the bare "starter" token.
FILES_TO_RENAME=(
  "package.json"
  "apps/backend/.env"
  "apps/backend/.env.test"
  "infra/.env"
  "infra/compose.dev.yml"
  "infra/compose.test.yml"
  "infra/compose.monitoring.yml"
  "infra/compose.prod.yml"
  "infra/.env.prod.example"
  "infra/monitoring/prometheus/prometheus.yml"
  "infra/monitoring/prometheus/prometheus.prod.yml"
  "infra/monitoring/grafana/dashboards/api-dashboard.json"
  "infra/monitoring/grafana/dashboards/logs-dashboard.json"
  "infra/monitoring/grafana/provisioning/dashboards/dashboards.yml"
)

for file in "${FILES_TO_RENAME[@]}"; do
  if [[ -f "$file" ]]; then
    sed_i "s/nest-starter-pack/$PROJECT_NAME/g" "$file"
    sed_i "s/starter/$PROJECT_NAME/g" "$file"
    sed_i "s/Starter/$PROJECT_NAME_CAP/g" "$file"
  fi
done

# Update HTML title
if [[ -f "apps/webapp/index.html" ]]; then
  sed_i "s/<title>Starter<\/title>/<title>${PROJECT_NAME_CAP}<\/title>/g" "apps/webapp/index.html"
fi

# Update Swagger title
if [[ -f "apps/backend/src/main.ts" ]]; then
  sed_i "s/Starter API/${PROJECT_NAME_CAP} API/g" "apps/backend/src/main.ts"
fi
if [[ -f "apps/backend/scripts/generate-contracts.ts" ]]; then
  sed_i "s/Starter API/${PROJECT_NAME_CAP} API/g" "apps/backend/scripts/generate-contracts.ts"
fi

echo "Done renaming."

# 4. One-shot bootstrap: install deps, start dev Docker (blocks until Postgres
#    is healthy), apply migrations, generate the Prisma client, run codegen.
#    Idempotent — safe to re-run any time via `pnpm run setup`.
echo ""
echo "Bootstrapping (install → docker → migrate → generate → codegen)..."
pnpm run setup

# 5. Reinitialize git history for the new project (optional).
echo ""
read -rp "Reinitialize git history (removes the starter's history)? [y/N] " REINIT_GIT
if [[ "$REINIT_GIT" =~ ^[Yy]$ ]]; then
  rm -rf .git
  git init -q
  git add -A
  git commit -q -m "chore: initial commit from nest-starter-pack"
  echo "Fresh git history created."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Add models to apps/backend/prisma/schema.prisma"
echo "  2. Run: pnpm --filter backend run database:generate-migration init"
echo "  3. Start dev: pnpm dev"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  API docs:  http://localhost:3000/api-docs"
echo "  Mailpit:   http://localhost:3021"
