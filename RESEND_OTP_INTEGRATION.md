# Resend OTP System - Frontend Integration Guide

## Overview

This guide shows how to integrate the new Resend OTP email system into your React app.

## Step 1: Update SignupWithOTPPage Component

Replace the existing SignupWithOTPPage with this:

```javascript
import { useState } from 'react';
import { sendOTP } from './resendOTPService';

export function SignupWithOTPPage({ onSignupSuccess, onPageChange }) {
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async () => {
    if (!studentId || !name || !email || !gender) {
      return setErr('All fields are required.');
    }

    setLoading(true);
    setErr('');
    setSuccess('');

    // Send OTP via Resend
    const result = await sendOTP(email, name);

    if (!result.ok) {
      setErr(result.error || 'Failed to send OTP');
      setLoading(false);
      return;
    }

    setSuccess('✅ OTP sent to your email!');
    
    // Store signup data for next step
    sessionStorage.setItem('signupData', JSON.stringify({
      studentId,
      name,
      email,
      gender,
    }));

    // Move to OTP verification
    setTimeout(() => {
      onPageChange('verify-otp');
    }, 1500);

    setLoading(false);
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#5ef2c2', marginBottom: '10px' }}>Create Account</h2>
      <p style={{ color: '#9bb1ad', marginBottom: '30px' }}>
        OTP will be sent to your email
      </p>

      {err && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {err}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(94, 242, 194, 0.1)',
          border: '1px solid #5ef2c2',
          color: '#5ef2c2',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#9bb1ad', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          Student ID
        </label>
        <input
          type="text"
          placeholder="e.g., 2020331089"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(94, 242, 194, 0.2)',
            background: '#1a2625',
            color: '#e0e8e7',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#9bb1ad', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          Full Name
        </label>
        <input
          type="text"
          placeholder="e.g., John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(94, 242, 194, 0.2)',
            background: '#1a2625',
            color: '#e0e8e7',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#9bb1ad', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          Email Address
        </label>
        <input
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(94, 242, 194, 0.2)',
            background: '#1a2625',
            color: '#e0e8e7',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ color: '#9bb1ad', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          Gender
        </label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid rgba(94, 242, 194, 0.2)',
            background: '#1a2625',
            color: '#e0e8e7',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      <button
        onClick={submit}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: loading ? '#9bb1ad' : '#5ef2c2',
          color: loading ? '#6b8985' : '#0f2e26',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '⏳ Sending OTP...' : '📧 Send OTP'}
      </button>

      <button
        onClick={() => onPageChange('login')}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '12px',
          background: 'transparent',
          color: '#5ef2c2',
          border: '1px solid #5ef2c2',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        ← Back to Login
      </button>
    </div>
  );
}
```

## Step 2: Update VerifyOTPPage Component

Replace the existing VerifyOTPPage with this:

```javascript
import { useState, useEffect } from 'react';
import { verifyOTP, sendOTP } from './resendOTPService';

export function VerifyOTPPage({ onVerifySuccess, onPageChange }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState('');

  // Get signup data from session
  const signupData = JSON.parse(sessionStorage.getItem('signupData') || '{}');

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const verify = async () => {
    if (!otp || otp.length !== 6) {
      return setErr('Please enter a valid 6-digit OTP');
    }

    setLoading(true);
    setErr('');

    const result = await verifyOTP(signupData.email, otp);

    if (!result.ok) {
      setErr(result.error);
      setLoading(false);
      return;
    }

    setSuccess('✅ Email verified successfully!');
    
    // Create user record in Supabase
    try {
      const { data: user, error: insertError } = await supabase
        .from('users')
        .insert([{
          id: supabase.auth.user()?.id, // Auto-generated
          name: signupData.name,
          email: signupData.email,
          gender: signupData.gender,
          student_id: signupData.studentId,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Clear session and move to dashboard
      sessionStorage.removeItem('signupData');
      setTimeout(() => {
        onVerifySuccess(user);
        onPageChange('dashboard');
      }, 1500);
    } catch (error) {
      console.error('User creation error:', error);
      setErr('Failed to create user account');
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (resendCooldown > 0) return;

    const result = await sendOTP(signupData.email, signupData.name);
    
    if (result.ok) {
      setResendCooldown(60);
      setErr('');
      setSuccess('✅ OTP resent successfully');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setErr('Failed to resend OTP');
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#5ef2c2', marginBottom: '10px' }}>Verify Your Email</h2>
      <p style={{ color: '#9bb1ad', marginBottom: '30px' }}>
        Enter the 6-digit code sent to {signupData.email}
      </p>

      {err && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {err}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(94, 242, 194, 0.1)',
          border: '1px solid #5ef2c2',
          color: '#5ef2c2',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#9bb1ad', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
          Verification Code
        </label>
        <input
          type="text"
          placeholder="000000"
          maxLength="6"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '8px',
            border: '2px solid #5ef2c2',
            background: '#1a2625',
            color: '#5ef2c2',
            fontSize: '32px',
            textAlign: 'center',
            letterSpacing: '8px',
            fontWeight: '600',
            fontFamily: 'monospace',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <button
        onClick={verify}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px',
          background: loading ? '#9bb1ad' : '#5ef2c2',
          color: loading ? '#6b8985' : '#0f2e26',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '⏳ Verifying...' : '✓ Verify'}
      </button>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p style={{ color: '#9bb1ad', fontSize: '13px', marginBottom: '10px' }}>
          Didn't receive the code?
        </p>
        <button
          onClick={resendEmail}
          disabled={resendCooldown > 0}
          style={{
            background: 'transparent',
            color: resendCooldown > 0 ? '#6b8985' : '#5ef2c2',
            border: 'none',
            cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            opacity: resendCooldown > 0 ? 0.5 : 1,
          }}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '🔄 Resend OTP'}
        </button>
      </div>

      <button
        onClick={() => onPageChange('signup')}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '20px',
          background: 'transparent',
          color: '#5ef2c2',
          border: '1px solid #5ef2c2',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        ← Change Email
      </button>
    </div>
  );
}
```

## Step 3: Update .env file

In RatingApp/.env.local, add:

```env
VITE_OTP_API_URL=http://localhost:3001  # For development
# For production: VITE_OTP_API_URL=https://your-vercel-api.vercel.app
```

## Step 4: Update App.jsx imports

Add at the top:

```javascript
import { sendOTP, verifyOTP } from './resendOTPService';
```

## Step 5: Backend Setup

1. Install dependencies in backend folder:
   ```bash
   cd backend
   npm install
   ```

2. Create `.env` file with:
   ```env
   RESEND_API_KEY=re_6cRSZCNy_4TyyvkWT1AoHcF4yvajBRqaY
   SUPABASE_URL=https://vvlfjmporhpotwngngsg.supabase.co
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   PORT=3001
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

## Step 6: Deploy Backend

### Option A: Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard.

### Option B: Render.com

1. Connect GitHub repo
2. Create New → Web Service
3. Select backend folder
4. Add environment variables
5. Deploy

## Step 7: Create Supabase Table

Run SQL migration:

```sql
CREATE TABLE otp_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT otp_codes_email_otp_unique UNIQUE(email, otp)
);

CREATE INDEX otp_codes_email_idx ON otp_codes(email);
CREATE INDEX otp_codes_expires_at_idx ON otp_codes(expires_at);
```

## Email Features

✅ Mint green theme (#5EF2C2)  
✅ Dark background  
✅ Card-style layout  
✅ Large OTP display  
✅ 10-minute expiration  
✅ Mobile responsive  
✅ Professional branding  
✅ Security messaging  

## API Endpoints

**Send OTP:**
```
POST /api/send-otp
{ "email": "user@example.com", "name": "John Doe" }
```

**Verify OTP:**
```
POST /api/verify-otp
{ "email": "user@example.com", "otp": "123456" }
```

## Security Notes

🔒 API key never exposed in frontend  
🔒 OTP expires after 10 minutes  
🔒 OTP stored only for verification  
🔒 One-time use only  
🔒 Email validation required  
🔒 Rate limiting recommended (add to backend)  

## Troubleshooting

**OTP not received?**
- Check spam folder
- Verify email is correct
- Resend after 60 seconds

**API connection error?**
- Ensure backend is running
- Check VITE_OTP_API_URL in .env.local
- Verify CORS is enabled

**Supabase connection error?**
- Check SUPABASE_SERVICE_KEY in backend .env
- Verify table exists (run migration)
- Check RLS policies
