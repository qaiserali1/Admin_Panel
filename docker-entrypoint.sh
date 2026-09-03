#!/bin/sh
set -e

echo ">>> Running Prisma migrations against external database..."
node ./node_modules/prisma/build/index.js migrate deploy

echo ">>> Starting Next.js server..."
exec node server.js
