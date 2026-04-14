# FaceRate BD - Bangladeshi Celebrity Rating System

A React + Supabase web application for collecting ratings on Bangladeshi celebrity photos with user/admin flows, resumable sessions, cooldown logic, analytics, and CSV export.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8 |
| Database | Supabase PostgreSQL |
| Auth | Session storage + Supabase `users` table |
| Styling | Custom React styling + Google Fonts |
| Hosting | Firebase Hosting |

## Project Structure

```text
CelebrityRatingApp/
├── README.md
├── package.json
├── RatingApp/
│   ├── firebase.json
│   ├── package.json
│   ├── index.html
│   ├── public/
│   │   ├── icons.svg
│   │   └── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── celebrity-rating-app.jsx
│   │   ├── celebrity-rating-app-backup.jsx
│   │   ├── supabaseClient.js
│   │   ├── App.css
│   │   └── index.css
│   └── supabase/
│       └── rls_policies.sql
└── dataconnect/
    ├── dataconnect.yaml
    └── schema/
        └── schema.gql
```

## Setup Instructions

### Step 1 - Install Dependencies

```bash
cd RatingApp
npm install
```

### Step 2 - Configure Supabase

Create your Supabase project and tables:

- `users`
- `photos`
- `ratings`
- `user_progress`

Then run: `RatingApp/supabase/rls_policies.sql`

### Step 3 - Configure Frontend Supabase Access

Update `RatingApp/src/supabaseClient.js` with your Supabase project URL and anon key if needed.

### Step 4 - Run the App

```bash
cd RatingApp
npm run dev
```

Open: `http://localhost:5173`

### Step 5 - Deploy

```bash
cd RatingApp
npm run build
firebase deploy
```

Live app: `https://facerate-bd.web.app`

## Accounts and Roles

### User Account

1. Open the app.
2. Click `Create Account`.
3. Enter student ID, name, email, gender, password, and confirm password.
4. Submit.

Validation:

- Student ID format: `232-15-001`
- Email must contain `@`
- Password minimum length: 6

### Admin Access

1. Open login page.
2. Click `Admin Access`.
3. Enter admin password.

Current admin password in code: `adminbaby`

## Database Schema

### users

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Student ID |
| name | TEXT | User name |
| email | TEXT | User email |
| gender | TEXT | Gender value from signup |
| password | TEXT | Stored directly in current implementation |
| created_at | TIMESTAMP | Account created time |

### photos

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Photo ID |
| celebrity | TEXT | Celebrity name |
| gender | TEXT | Category |
| url | TEXT | Image URL |
| created_at | TIMESTAMP | Upload time |

### ratings

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | Generated with `crypto.randomUUID()` |
| photo_id | TEXT FK | References `photos.id` |
| user_id | TEXT FK | References `users.id` |
| rating | INTEGER | 1 to 10 |
| comment | TEXT | Stored as `null` currently |
| created_at | TIMESTAMP | Rating time |
| - | UNIQUE(photo_id, user_id) | One rating per user per photo |

### user_progress

| Column | Type | Notes |
| --- | --- | --- |
| user_id | TEXT PK FK | References `users.id` |
| rated_ids | JSON/TEXT | Already rated photo IDs |
| session_queue | JSON/TEXT | Saved queue |
| session_idx | INTEGER | Resume index |
| updated_at | TIMESTAMP | Last update |

## Business Rules

| Rule | Implementation |
| --- | --- |
| Student ID format enforced | Signup validation |
| Password min 6 chars | Signup validation |
| Rating range 1-10 | Client-side validation |
| One rating per user per photo | Insert fallback to update |
| Unrated photos shown randomly | `strongShuffle()` |
| Resume session after refresh/login | `user_progress` |
| Cooldown every 20 ratings | `COOL_AT = 20` |
| Cooldown duration 15 seconds | `COOL_SECS = 15` |
| Admin can add/delete photos | Admin tools |
| Admin can export CSV | Analytics/export tab |

## Feature Checklist

- [x] User sign-up and login
- [x] Student ID format validation
- [x] Separate admin access
- [x] Random unrated queue
- [x] Rating scale 1-10
- [x] Duplicate rating protection
- [x] Session resume and progress recovery
- [x] Cooldown after 20 ratings
- [x] User dashboard and history
- [x] Admin upload/delete photos
- [x] Admin analytics and CSV export
- [x] Firebase deployment

## Security Notes

- Passwords are currently stored directly in `users` table.
- Admin password is hardcoded (`adminbaby`).
- Supabase client values are in frontend source.

Recommended improvements:

1. Hash passwords.
2. Replace hardcoded admin secret with role-based auth.
3. Tighten RLS policies.
4. Move sensitive config to environment variables.

## Links

- Live app: `https://facerate-bd.web.app`
- GitHub: `https://github.com/if-i-shajan/FaceRateBD.git`
