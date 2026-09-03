# FMCG Order Booking App - Next.js 14 Admin Panel

Admin Panel & Backend API for FMCG Order Booking Mobile Application with **Hardware Device Binding** and **Admin Approval Governance**.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database ORM**: Prisma ORM (Persistent PostgreSQL - Supabase / Neon / Railway / Self-hosted)
- **Authentication & Security**: bcryptjs & JWT

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the environment template and configure your external PostgreSQL `DATABASE_URL`:
```bash
cp .env.example .env
```

Edit `.env` and replace `DATABASE_URL` with your external PostgreSQL connection string:
```
# Neon
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"

# Supabase
DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?sslmode=require"

# Railway
DATABASE_URL="postgresql://postgres:pass@host:port/railway"
```

### 3. Apply Migrations & Generate Prisma Client
```bash
npx prisma generate
npm run db:migrate     # applies prisma/migrations to your external DB
npm run db:seed        # optional: seed 4 test booker accounts
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Admin Dashboard.

---

## 🐳 Production Docker Deployment

> **Data persists across all redeploys** — migrations run automatically on every container start via `docker-entrypoint.sh`.

**Required environment variable on your deployment platform:**
```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
JWT_SECRET=your-secret-here
```

The container start sequence is:
1. `prisma migrate deploy` → applies any pending schema migrations
2. `node server.js` → starts the Next.js server

### Database Scripts
| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply pending migrations (production-safe) |
| `npm run db:seed` | Seed 4 test booker accounts |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:studio` | Open Prisma Studio (local GUI) |

---

## 📱 Mobile App API Documentation

### Booker Login & Registration
`POST /api/mobile/login`

**Request Body:**
```json
{
  "username": "booker_01",
  "password": "password123",
  "deviceId": "DEVICE_IMEI_9988771122"
}
```

**Responses:**
1. **New User Registration:**
   - Status: `201 Created`
   - Body: `{"success": false, "status": "pending", "message": "Account created. Waiting for Admin Approval."}`

2. **Pending Approval:**
   - Status: `403 Forbidden`
   - Body: `{"success": false, "status": "pending", "message": "Approval Pending."}`

3. **Blocked Booker:**
   - Status: `403 Forbidden`
   - Body: `{"success": false, "status": "blocked", "message": "Access Denied."}`

4. **Active Booker (Device Mismatch):**
   - Status: `403 Forbidden`
   - Body: `{"success": false, "status": "device_mismatch", "message": "Device mismatch. This account is bound to another device."}`

5. **Active Booker (Success):**
   - Status: `200 OK`
   - Body: `{"success": true, "status": "active", "message": "Login successful", "token": "<JWT_TOKEN>", "user": {...}}`

---

## 💻 Admin API Routes

- `GET /api/admin/users`: Fetch bookers list with status counts and filtering (`?status=pending|active|blocked&search=...`).
- `PATCH /api/admin/users`: Update user status (`active`, `blocked`, `pending`) or reset device binding (`{ id, status, resetDevice }`).
- `POST /api/admin/users`: Manually create pre-approved bookers.
- `DELETE /api/admin/users?id=...`: Remove a booker account.
