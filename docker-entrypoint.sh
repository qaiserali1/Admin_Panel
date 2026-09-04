#!/bin/sh

echo "========================================================"
echo ">>> FMCG Admin Panel - Starting Container"
echo ">>> Hostname: ${HOSTNAME:-0.0.0.0} | Port: ${PORT:-3000}"
echo "========================================================"

# Determine whether DATABASE_URL is provided and not a placeholder
IS_DB_CONFIGURED=1
if [ -z "$DATABASE_URL" ]; then
  IS_DB_CONFIGURED=0
elif echo "$DATABASE_URL" | grep -q "USER:PASSWORD@HOST"; then
  IS_DB_CONFIGURED=0
fi

if [ "$IS_DB_CONFIGURED" -eq 0 ]; then
  echo ">>> [INFO] DATABASE_URL is not set or contains default placeholder values."
  echo ">>> Skipping migrations. Container will proceed to start Next.js."
  echo ">>> (To connect to a database, set DATABASE_URL in your Coolify Environment Variables)"
else
  echo ">>> DATABASE_URL is configured. Attempting database migrations..."
  
  # Retry loop to wait for database readiness if database container starts concurrently
  MAX_RETRIES=6
  RETRY_DELAY=4
  ATTEMPT=1
  MIGRATION_OK=0

  while [ $ATTEMPT -le $MAX_RETRIES ]; do
    echo ">>> [Migration Attempt $ATTEMPT/$MAX_RETRIES] Running 'prisma migrate deploy'..."
    if node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma; then
      echo ">>> Prisma migrations applied successfully."
      MIGRATION_OK=1
      break
    else
      echo ">>> Migration attempt $ATTEMPT failed."
      if [ $ATTEMPT -lt $MAX_RETRIES ]; then
        echo ">>> Database may still be initializing. Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
      fi
    fi
    ATTEMPT=$((ATTEMPT + 1))
  done

  # Fallback to db push if migrate deploy encounters schema drift or un-baselined database
  if [ "$MIGRATION_OK" -eq 0 ]; then
    echo ">>> [FALLBACK] Attempting 'prisma db push' to synchronize database schema..."
    if node ./node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma --skip-generate; then
      echo ">>> Database schema synchronized successfully via 'prisma db push'."
    else
      echo ">>> [WARNING] Database migration and schema synchronization both failed."
      echo ">>> Please verify your DATABASE_URL, network reachability, and database credentials."
      echo ">>> Continuing container startup so the container remains in a running state..."
    fi
  fi
fi

echo "========================================================"
echo ">>> Launching Next.js standalone server on port ${PORT:-3000}..."
echo "========================================================"
exec node server.js
