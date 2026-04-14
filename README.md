# FaceRate BD — Bangladeshi Celebrity Rating System

A full-stack React + Supabase web application for collecting ratings on Bangladeshi celebrity photos, with user and admin flows, resumable rating sessions, cooldown logic, analytics, CSV export, and optional OTP email verification.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8 |
| Backend | Node.js, Express |
| Database | Supabase PostgreSQL |
| Auth | Session storage + Supabase `users` table |
| Email/OTP | Resend API |
| Styling | Custom React styling + Google Fonts |
| Hosting | Firebase Hosting (frontend), Vercel-ready backend |

## Project Structure

```text
CelebrityRatingApp/
├── README.md                           # Main project documentation
├── QUICK_START.md                      # OTP setup quick guide
├── RESEND_OTP_INTEGRATION.md           # OTP integration walkthrough
├── package.json
├── RatingApp/
│   ├── firebase.json                   # Firebase hosting config
│   ├── package.json                    # Frontend dependencies
│   ├── index.html
│   ├── public/
│   │   ├── icons.svg
│   │   └── index.html
│   ├── src/
│   │   ├── main.jsx                    # React entry point
│   │   ├── App.jsx
│   │   ├── celebrity-rating-app.jsx    # Main app UI and logic
│   │   ├── celebrity-rating-app-backup.jsx
│   │   ├── supabaseClient.js           # Supabase client setup
│   │   ├── resendOTPService.js         # Frontend OTP API client
│   │   ├── App.css
│   │   └── index.css
│   └── supabase/
│       └── rls_policies.sql            # Supabase RLS and helper SQL
├── backend/
│   ├── server.js                       # OTP email API
│   ├── package.json                    # Backend dependencies
│   ├── .env.example                    # Backend env template
│   ├── vercel.json                     # Vercel deployment config
│   └── README.md
└── dataconnect/
    ├── dataconnect.yaml
    ├── migrations/
    │   └── 001_create_otp_table.sql    # OTP table migration
    └── schema/
        └── schema.gql
```

## Setup Instructions

### Step 1 — Install Dependencies

Install frontend and backend dependencies separately:

```bash
cd RatingApp
npm install

cd ../backend
npm install
```

### Step 2 — Create the Supabase Database

Create a Supabase project and create the tables used by the app:

- `users`
- `photos`
- `ratings`
- `user_progress`
- `otp_codes` (optional, only if using OTP email verification)

Then run:

- `RatingApp/supabase/rls_policies.sql`
- `dataconnect/migrations/001_create_otp_table.sql` if you want OTP support

### Step 3 — Configure Frontend Supabase Access

The frontend Supabase client lives in `RatingApp/src/supabaseClient.js`.

If you want to use a different Supabase project, update that file with your own project URL and anon key.

### Step 4 — Configure the Optional OTP Backend

Create `backend/.env` from `backend/.env.example` and set:

```env
RESEND_API_KEY=your_resend_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=3001
```

### Step 5 — Run the App

Frontend:

```bash
cd RatingApp
npm run dev
```

Backend OTP API:

```bash
cd backend
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- OTP API: `http://localhost:3001`

### Step 6 — Deploy the App

Frontend:

```bash
cd RatingApp
npm run build
firebase deploy
```

Backend:

```bash
cd backend
vercel
```

Current frontend deployment: `https://facerate-bd.web.app`

## Accounts & Roles

### Creating a User Account

To create a user account:

1. Open the app.
2. Click `Create Account`.
3. Enter student ID, full name, email, gender, password, and confirm password.
4. Submit the form.

Current validation rules:

- Student ID must match `232-15-001` format.
- Email must contain `@`.
- Password must be at least 6 characters.

### Accessing the Admin Panel

To access the admin panel:

1. Open the login page.
2. Click `Admin Access`.
3. Enter the admin password.

Current admin password in code: `adminbaby`

## Database Schema

### users

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Student ID, e.g. `232-15-001` |
| name | TEXT | User full name |
| email | TEXT | User email |
| gender | TEXT | Current UI stores values like `Male` / `Female` |
| password | TEXT | Stored directly in the current implementation |
| created_at | TIMESTAMP | Account creation time |

### photos

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Photo identifier |
| celebrity | TEXT | Celebrity display name |
| gender | TEXT | Photo gender/category |
| url | TEXT | Image URL |
| created_at | TIMESTAMP | Upload time |

### ratings

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Generated with `crypto.randomUUID()` |
| photo_id | TEXT FK | References `photos.id` |
| user_id | TEXT FK | References `users.id` |
| rating | INTEGER | Rating from 1 to 10 |
| comment | TEXT | Currently stored as `null` |
| created_at | TIMESTAMP | Rating timestamp |
| — | UNIQUE(photo_id, user_id) | One rating per user per photo |

### user_progress

| Column | Type | Notes |
| --- | --- | --- |
| user_id | TEXT PK FK | References `users.id` |
| rated_ids | JSON / TEXT | IDs already rated by the user |
| session_queue | JSON / TEXT | Saved randomized queue |
| session_idx | INTEGER | Resume position in the queue |
| updated_at | TIMESTAMP | Last update timestamp |

### otp_codes

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGSERIAL PK | Auto-generated |
| email | TEXT | OTP recipient |
| otp | TEXT | 6-digit verification code |
| used | BOOLEAN | Marks verified codes |
| expires_at | TIMESTAMP | Expiration timestamp |
| created_at | TIMESTAMP | Creation timestamp |

## Business Rules

| Rule | Implementation |
| --- | --- |
| Student ID must follow `232-15-001` format | Signup validation in frontend |
| Password must be at least 6 characters | Signup validation in frontend |
| Rating must be 1–10 | Client-side validation before save |
| One rating per user per photo | Duplicate insert falls back to update |
| Unrated images are shown in shuffled order | `strongShuffle()` on remaining photos |
| Progress survives refresh and re-login | `user_progress` table |
| Rating queue resumes where the user stopped | `session_queue` + `session_idx` |
| Cooldown starts every 20 ratings | `COOL_AT = 20` |
| Cooldown duration is 15 seconds | `COOL_SECS = 15` |
| Admin can add and delete photos | Admin tools in frontend |
| Admin can export ratings as CSV | Admin analytics/export section |

## OTP API Endpoints

### Send OTP

```http
POST /api/send-otp
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

### Verify OTP

```http
POST /api/verify-otp
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

### Health Check

```http
GET /api/health
```

## Brand Colors

| Role | Hex |
| --- | --- |
| Primary brand | `#359971` |
| Dark brand | `#1F7155` |
| Accent mint | `#63C59E` |
| Page background | `#FFDEAD` |
| Panel/card background | `#FFFFFF` |
| Border | `#E4DDD2` |
| Error/danger | `#DC5B5B` |

## Feature Checklist

- [x] User sign-up and login
- [x] Student ID format validation
- [x] Separate admin access page
- [x] Random unrated image queue
- [x] Rating scale from 1 to 10
- [x] Duplicate rating protection
- [x] Session queue and progress recovery
- [x] Cooldown after every 20 ratings
- [x] User dashboard with progress overview
- [x] Personal ratings/history page
- [x] Admin photo upload by URL
- [x] Admin photo deletion
- [x] Admin user list
- [x] Admin analytics dashboard
- [x] Gender comparison analytics
- [x] Ratings CSV export
- [x] Terms and Conditions page
- [x] Optional Resend OTP backend
- [x] Firebase Hosting deployment
- [x] Vercel-ready backend configuration

## Security Notes

This project works well as an academic/prototype system, but there are important production limitations:

- User passwords are currently stored directly in the `users` table.
- Admin access uses a hardcoded frontend password (`adminbaby`).
- Frontend configuration currently includes Supabase connection details in source.
- Most authorization is handled in the frontend and through Supabase policy configuration.
- The OTP backend keeps the Resend API key on the server side, which is the safer part of the current design.

Recommended production improvements:

1. Move authentication to Supabase Auth or a secure backend.
2. Hash passwords before storing them.
3. Replace the hardcoded admin password with role-based authorization.
4. Tighten RLS policies for user-specific access.
5. Move sensitive configuration fully into environment variables.

## Live Demo

- Frontend: `https://facerate-bd.web.app`
- GitHub repository: `https://github.com/if-i-shajan/FaceRateBD.git`

## Notes

- Main frontend logic lives in `RatingApp/src/celebrity-rating-app.jsx`.
- Supabase access is configured in `RatingApp/src/supabaseClient.js`.
- OTP email logic lives in `backend/server.js`.
- Rating-related Supabase SQL is in `RatingApp/supabase/rls_policies.sql`.
- OTP migration SQL is in `dataconnect/migrations/001_create_otp_table.sql`.
