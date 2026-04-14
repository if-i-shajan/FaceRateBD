# FaceRate BD - OTP Email Service

Complete OTP email system using Resend API with beautiful mint-green themed emails.

## Features

✅ Generate 6-digit OTP codes  
✅ Store OTP with 10-minute expiration in Supabase  
✅ Send beautiful HTML emails via Resend  
✅ Verify OTP codes  
✅ Mobile-responsive email design  
✅ Dark theme with mint-green accents  

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` file:

```env
RESEND_API_KEY=re_6cRSZCNy_4TyyvkWT1AoHcF4yvajBRqaY
SUPABASE_URL=https://vvlfjmporhpotwngngsg.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=3001
```

### 3. Create Supabase Table

```sql
CREATE TABLE otp_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX otp_codes_email_idx ON otp_codes(email);
CREATE INDEX otp_codes_expires_at_idx ON otp_codes(expires_at);
```

### 4. Run Locally

```bash
npm run dev
```

Server runs on `http://localhost:3001`

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard.

## API Endpoints

### Send OTP Email

```
POST /api/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe"
}
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

```
POST /api/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
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

### Health Check

```
GET /api/health
```

## Email Design

- 📧 Dark theme background
- 🎨 Mint green (#5EF2C2) primary accent
- 📱 Mobile responsive
- 🔐 Security-focused messaging
- ⏱️ 10-minute expiration timer
- 📸 FaceRate BD branding

## Security

✅ OTP stored securely in Supabase  
✅ 10-minute auto-expiration  
✅ One-time use only  
✅ API key never exposed in frontend  
✅ CORS configured  
✅ Email validation  

## Frontend Integration

```javascript
// Send OTP
const response = await fetch('https://your-api.com/api/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    name: 'John Doe'
  })
});

// Verify OTP
const verify = await fetch('https://your-api.com/api/verify-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    otp: '123456'
  })
});
```

## Support

For issues, email: support@facerate-bd.com
