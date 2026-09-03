#!/bin/sh

echo ">>> Attempting Prisma migrations..."
if node ./node_modules/prisma/build/index.js migrate deploy; then
  echo ">>> Migrations applied successfully."
else
  echo ">>> WARNING: Migration failed (DATABASE_URL may not be set). Continuing startup..."
fi

echo ">>> Starting Next.js server..."
exec node server.js
