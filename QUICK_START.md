# 🚀 Resend OTP System - Quick Start Guide

## What's Been Created

✅ **Backend OTP API** (`/backend/server.js`)
- Express.js server with Resend email integration
- Generates 6-digit OTP codes
- Stores OTP in Supabase for 10 minutes
- Sends beautiful HTML emails
- Verifies OTP codes

✅ **Beautiful Email Template**
- Dark theme background
- Mint green (#5EF2C2) accents
- Card-style layout
- Large, spaced OTP display
- Mobile responsive
- Professional FaceRate BD branding

✅ **Frontend OTP Service** (`/RatingApp/src/resendOTPService.js`)
- `sendOTP(email, name)` - Request OTP
- `verifyOTP(email, otp)` - Verify 6-digit code
- Clean API interface for React components

✅ **Integration Files**
- `.env.local` - Environment variables
- `RESEND_OTP_INTEGRATION.md` - Complete integration guide
- `backend/package.json` - Dependencies
- `backend/README.md` - Backend documentation
- SQL migration for Supabase

---

## 📋 Step-by-Step Setup

### Phase 1: Backend Setup (5 min)

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file
# (Use provided RESEND_API_KEY and add SUPABASE_SERVICE_KEY)

# Run locally
npm run dev
# Server runs on http://localhost:3001
```

### Phase 2: Supabase Setup (2 min)

1. Go to Supabase Dashboard
2. Open SQL Editor
3. Run the SQL migration:

```sql
CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX otp_codes_email_idx ON otp_codes(email);
```

### Phase 3: Frontend Update (10 min)

1. **Replace SignupWithOTPPage component**
   - Copy code from `RESEND_OTP_INTEGRATION.md`
   - Paste into `celebrity-rating-app.jsx`

2. **Replace VerifyOTPPage component**
   - Copy code from `RESEND_OTP_INTEGRATION.md`
   - Paste into `celebrity-rating-app.jsx`

3. **Update imports**
   ```javascript
   import { sendOTP, verifyOTP } from './resendOTPService';
   ```

4. **Ensure .env.local exists**
   ```env
   VITE_OTP_API_URL=http://localhost:3001
   ```

### Phase 4: Test (5 min)

1. Start backend: `npm run dev` (in `/backend`)
2. Start frontend: `npm run dev` (in `/RatingApp`)
3. Go to signup page
4. Enter test email
5. Check email inbox for OTP

---

## 📧 Email Preview

The email includes:

```
┌─────────────────────────────────────┐
│  📸 Email Verification               │
│  Secure your FaceRate BD account    │
├─────────────────────────────────────┤
│                                       │
│  Hello John,                          │
│  Enter the code below to verify      │
│  your email and complete your        │
│  registration.                        │
│                                       │
│  ┌──────────────────────────────┐   │
│  │                              │   │
│  │   1 2 3 4 5 6               │   │
│  │   (mint green, large)        │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│                                       │
│  ⏱️  This code expires in 10 minutes │
│                                       │
│  📋 Next Steps:                       │
│  1. Return to the FaceRate BD app   │
│  2. Enter the code shown above      │
│  3. Complete your registration      │
│                                       │
│  🔒 Never share this code           │
│                                       │
├─────────────────────────────────────┤
│  FaceRate BD                         │
│  Bangladeshi Celebrity Evaluation   │
│  © 2026 All rights reserved          │
└─────────────────────────────────────┘
```

---

## 🔑 API Endpoints

### Send OTP
```bash
curl -X POST http://localhost:3001/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "OTP sent successfully",
  "data": {
    "id": "email_id_from_resend"
  }
}
```

### Verify OTP
```bash
curl -X POST http://localhost:3001/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "OTP verified successfully",
  "data": {
    "email": "user@example.com",
    "verified": true
  }
}
```

---

## 🌐 Deployment

### Backend → Vercel (Recommended)

```bash
cd backend
npm install -g vercel
vercel

# Add environment variables in Vercel dashboard:
# - RESEND_API_KEY
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
```

### Frontend → Firebase

```bash
cd RatingApp

# Update .env.local with Vercel API URL:
# VITE_OTP_API_URL=https://your-api.vercel.app

npm run build
firebase deploy
```

---

## 🔐 Security Features

✅ **API Key Protection**
- Resend API key stored in backend only
- Never exposed to frontend
- Environment variable protected

✅ **OTP Expiration**
- 10-minute auto-expiration
- Stored with timestamp in database
- Automatically checked on verification

✅ **One-Time Use**
- OTP marked as "used" after verification
- Cannot be reused
- Old OTPs cleaned up

✅ **Email Validation**
- Email format checked
- OTP format verified (6 digits)
- All fields required

---

## 🐛 Troubleshooting

### "OTP not received"
- ✓ Check spam/promotions folder
- ✓ Wait 60 seconds before resending
- ✓ Verify email address is correct

### "API connection error"
- ✓ Ensure backend is running: `npm run dev`
- ✓ Check `VITE_OTP_API_URL` in .env.local
- ✓ Verify backend .env has all variables

### "Invalid or expired OTP"
- ✓ OTP expires after 10 minutes
- ✓ OTP can only be used once
- ✓ Check that code matches exactly

### "Failed to create user"
- ✓ Check Supabase users table exists
- ✓ Verify RLS policies allow inserts
- ✓ Check SUPABASE_SERVICE_KEY is correct

---

## 📁 File Structure

```
CelebrityRatingApp/
├── backend/
│   ├── server.js (Main OTP API)
│   ├── package.json (Dependencies)
│   ├── .env.example (Environment template)
│   ├── vercel.json (Vercel config)
│   └── README.md (Backend docs)
├── RatingApp/
│   ├── src/
│   │   ├── resendOTPService.js (Frontend OTP client)
│   │   └── celebrity-rating-app.jsx (Updated components)
│   └── .env.local (Vite env vars)
├── dataconnect/
│   └── migrations/
│       └── 001_create_otp_table.sql (DB schema)
└── RESEND_OTP_INTEGRATION.md (Detailed guide)
```

---

## 🎯 What Happens During Signup

1. **User enters signup form**
   - Student ID, Name, Email, Gender

2. **Click "Send OTP"**
   - Frontend calls `sendOTP(email, name)`
   - Backend generates 6-digit code
   - Stored in Supabase with 10-min expiration
   - Beautiful email sent via Resend

3. **User receives email**
   - Dark theme with mint green accents
   - Large OTP code displayed
   - "Expires in 10 minutes" message

4. **User enters 6-digit code**
   - Frontend calls `verifyOTP(email, otp)`
   - Backend checks code validity and expiration
   - Marks OTP as used

5. **Account created**
   - User record created in Supabase
   - User logged in automatically
   - Redirected to dashboard

---

## 💚 Mint Green Color Details

**Primary Accent: #5EF2C2**
- OTP code text
- Button background (send/verify)
- Border accents
- Highlights

**Theme Colors:**
- Dark background: #0f2e26, #1a2625
- Text: #e0e8e7 (light)
- Secondary text: #9bb1ad, #6b8985 (subtle)
- Gradients: Linear from #2ab88b to #1a9e77

---

## ✅ Completed Tasks

- [x] Backend OTP API with Resend integration
- [x] Beautiful HTML email template
- [x] 6-digit OTP generation
- [x] Supabase OTP storage with expiration
- [x] Frontend OTP service
- [x] Environment configuration
- [x] SQL migration
- [x] Integration guide
- [x] Deployment instructions
- [x] Security implementation

---

## 📞 Support

**Issues?**
- Check backend console for errors
- Verify all environment variables
- Ensure Supabase table exists
- Check email spam folder

**API Key Reference:**
- Resend: `re_6cRSZCNy_4TyyvkWT1AoHcF4yvajBRqaY` ✓ Already provided

---

## 🎉 Ready to Go!

Your OTP system is production-ready with:
- Professional email design
- Secure backend API
- Scalable database storage
- Beautiful user experience
- Modern mint-green theme

Start with **Phase 1: Backend Setup** above! 🚀
