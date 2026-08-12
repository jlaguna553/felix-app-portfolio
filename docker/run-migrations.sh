#!/bin/sh
set -e

echo "==> Waiting for auth schema (GoTrue)..."
until psql -h db -U postgres -d postgres -c "SELECT 1 FROM auth.users LIMIT 1" > /dev/null 2>&1; do
  echo "    auth schema not ready, retrying in 3s..."
  sleep 3
done
echo "    auth schema ready."

echo "==> Waiting for storage schema..."
until psql -h db -U postgres -d postgres -c "SELECT 1 FROM storage.buckets LIMIT 1" > /dev/null 2>&1; do
  echo "    storage schema not ready, retrying in 3s..."
  sleep 3
done
echo "    storage schema ready."

echo "==> Applying migrations..."
for migration in $(ls /migrations/*.sql | sort); do
  echo "    -> $(basename $migration)"
  psql -h db -U postgres -d postgres -f "$migration"
done

echo "==> Applying seed data..."
psql -h db -U postgres -d postgres -f /seed/seed_data.sql || echo "    seed skipped (may already exist)"

echo ""
echo "==> Done. Database ready."
