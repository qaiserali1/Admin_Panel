# FMCG Order Booking App - Next.js 14 Admin Panel

Admin Panel & Backend API for FMCG Order Booking Mobile Application with **Hardware Device Binding** and **Admin Approval Governance**.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database ORM**: Prisma ORM (SQLite for instant local dev, ready for PostgreSQL migration on Coolify)
- **Authentication & Security**: bcryptjs & JWT

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the environment template:
```bash
cp .env.example .env
```

### 3. Initialize Prisma Database & Seed Data
```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Admin Dashboard.

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
