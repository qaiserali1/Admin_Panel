#!/bin/sh
set -e

echo ">>> Running Prisma migrations against external database..."
./node_modules/.bin/prisma migrate deploy

echo ">>> Starting Next.js server..."
exec node server.js
