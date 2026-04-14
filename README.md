# README

## FaceRate BD - Bangladeshi Celebrity Rating System

A full-stack React + Supabase image rating platform for collecting student ratings on Bangladeshi celebrity photos, with separate user and admin flows, progress tracking, cooldown logic, analytics, CSV export, and an optional OTP email service.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Vite 8 |
| Backend | Node.js + Express (OTP email service) |
| Database | Supabase PostgreSQL |
| Auth | Session storage + Supabase `users` table |
| Email | Resend API |
| Styling | Custom React styling + Google Fonts |
| Hosting | Firebase Hosting (frontend), Vercel-ready backend |

## Project Structure

```text
CelebrityRatingApp/
├── README.md
├── QUICK_START.md
├── RESEND_OTP_INTEGRATION.md
├── package.json
├── package-lock.json
├── RatingApp/
│   ├── .firebaserc
│   ├── firebase.json
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   └── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── celebrity-rating-app.jsx
│   │   ├── celebrity-rating-app-backup.jsx
│   │   ├── supabaseClient.js
│   │   ├── resendOTPService.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── assets/
│   │       ├── hero.png
│   │       ├── react.svg
│   │       └── vite.svg
│   └── supabase/
│       └── rls_policies.sql
├── backend/
│   ├── .env.example
│   ├── README.md
│   ├── package.json
│   ├── server.js
│   └── vercel.json
└── dataconnect/
    ├── dataconnect.yaml
    ├── migrations/
    │   └── 001_create_otp_table.sql
    └── schema/
        └── schema.gql
```

## Setup Instructions

### Step 1 - Install Dependencies

Install the frontend and backend separately:

```bash
cd RatingApp
npm install

cd ../backend
npm install
```

### Step 2 - Create the Supabase Project

Create a Supabase project, then create the required tables listed in the Database Schema section below.

After the tables exist, run:

- `RatingApp/supabase/rls_policies.sql`
- `dataconnect/migrations/001_create_otp_table.sql` if you want OTP email verification

### Step 3 - Configure Frontend Supabase Access

The current frontend reads Supabase from:

`RatingApp/src/supabaseClient.js`

Update this file if you want to point the app at a different Supabase project:

```js
const SUPABASE_URL = 'your_supabase_project_url';
const SUPABASE_ANON_KEY = 'your_supabase_anon_key';
```

### Step 4 - Configure Optional OTP Backend

Create `backend/.env` from `backend/.env.example`:

```env
RESEND_API_KEY=your_resend_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=3001
```

### Step 5 - Run the App Locally

Frontend:

```bash
cd RatingApp
npm run dev
```

Backend OTP service:

```bash
cd backend
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- OTP API: `http://localhost:3001`

### Step 6 - Build and Deploy

Frontend:

```bash
cd RatingApp
npm run build
firebase deploy --only hosting
```

Backend:

```bash
cd backend
vercel
```

Current frontend deployment:

- `https://facerate-bd.web.app`

## Accounts & Roles

### Creating a User Account

To create a regular rater account:

1. Open the main app
2. Click `Create Account`
3. Enter student ID, full name, email, gender, password, and confirmation
4. Submit the form

Current validation rules:

- Student ID must match `232-15-001` style formatting
- Email must include `@`
- Password must be at least 6 characters

### Accessing the Admin Panel

To access the admin dashboard:

1. Open the login page
2. Click `Admin Access`
3. Enter the admin password

Current admin password in code:

- `adminbaby`

Note:

- Admin access is currently a separate password gate in the frontend
- It is not tied to a Supabase admin user row yet

## Database Schema

### users

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Student ID, e.g. `232-15-001` |
| name | TEXT | User full name |
| email | TEXT | User email |
| gender | TEXT | `Male` or `Female` in current UI |
| password | TEXT | Stored directly in current implementation |
| created_at | TIMESTAMP | Account creation time |

### photos

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Generated photo identifier |
| celebrity | TEXT | Celebrity display name |
| gender | TEXT | Currently saved as `unspecified` by admin upload flow |
| url | TEXT | Direct image URL |
| created_at | TIMESTAMP | Upload time |

### ratings

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Generated with `crypto.randomUUID()` |
| photo_id | TEXT FK | References `photos.id` |
| user_id | TEXT FK | References `users.id` |
| rating | INTEGER | Must be between 1 and 10 |
| comment | TEXT | Currently stored as `null` |
| created_at | TIMESTAMP | Rating timestamp |
| - | UNIQUE(photo_id, user_id) | One rating per user per photo |

### user_progress

| Column | Type | Notes |
| --- | --- | --- |
| user_id | TEXT PK FK | References `users.id` |
| rated_ids | JSON / TEXT | List of rated photo IDs |
| session_queue | JSON / TEXT | Saved randomized queue |
| session_idx | INTEGER | Resume position in queue |
| updated_at | TIMESTAMP | Last progress update |

### otp_codes

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGSERIAL PK | Auto-generated |
| email | TEXT | OTP target email |
| otp | TEXT | 6-digit code |
| used | BOOLEAN | Marks verified codes |
| expires_at | TIMESTAMP | 10-minute validity |
| created_at | TIMESTAMP | OTP creation time |

## Business Rules

| Rule | Implementation |
| --- | --- |
| Student ID must follow `232-15-001` format | Frontend signup validation |
| Password must be at least 6 characters | Frontend signup validation |
| Ratings must be between 1 and 10 | Frontend validation before insert |
| One rating per user per image | Duplicate insert updates existing row |
| Unrated images are shown in random order | `strongShuffle()` on available photos |
| Progress survives refresh/re-login | `user_progress` table |
| Queue resumes where the user left off | `session_queue` + `session_idx` |
| Short break every 20 ratings | `COOL_AT = 20` |
| Cooldown length is 15 seconds | `COOL_SECS = 15` |
| Admin can add and delete photos | Admin panel photo tools |
| Admin can export ratings as CSV | Admin export tab |

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
- [x] Duplicate rating protection via upsert-style logic
- [x] Saved session queue and progress recovery
- [x] Cooldown break after every 20 ratings
- [x] User dashboard with progress overview
- [x] My Ratings page with personal history
- [x] Admin photo upload by direct URL
- [x] Admin photo deletion
- [x] Admin user list
- [x] Admin analytics dashboard
- [x] Gender comparison analytics
- [x] Ratings CSV export
- [x] Terms and Conditions page
- [x] Optional Resend OTP backend service
- [x] Firebase Hosting frontend deployment
- [x] Vercel-ready backend configuration

## Security Notes

This project currently works well as an academic/prototype system, but there are important security limitations to know before production use:

- User passwords are currently stored directly in the `users` table
- Admin access uses a hardcoded frontend password (`adminbaby`)
- The frontend contains the Supabase URL and anon key in source code
- Most access control is enforced in the frontend and via permissive RLS policies
- The OTP backend correctly keeps the Resend API key on the server side

Recommended production improvements:

1. Move authentication to Supabase Auth or a secure backend
2. Hash passwords before storing them
3. Replace the hardcoded admin password with role-based backend authorization
4. Tighten RLS policies to user-specific access instead of public access
5. Move all sensitive configuration to environment variables

## Notes for Contributors

- Main frontend logic lives in `RatingApp/src/celebrity-rating-app.jsx`
- Supabase access is centralized in `RatingApp/src/supabaseClient.js`
- OTP email logic lives in `backend/server.js`
- Rating-related RLS helpers are in `RatingApp/supabase/rls_policies.sql`
- OTP table migration lives in `dataconnect/migrations/001_create_otp_table.sql`

## License / Usage

This project appears to be intended for course or research use. If you plan to publish or reuse it publicly, review the image sources, authentication flow, and security model before production deployment.
