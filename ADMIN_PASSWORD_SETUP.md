# Admin Password Security Setup

## What Changed

The admin password is now **secured with bcrypt hashing** instead of being hardcoded as plain text.

### Before (Insecure ❌)
```javascript
const ADMIN_PASS = "adminbaby"; // Plain text in code!
```

### After (Secure ✅)
```javascript
const ADMIN_PASS_HASH = import.meta.env.VITE_ADMIN_PASS_HASH;
// Password verified with bcrypt.compare()
```

---

## Setup Instructions

### 1. Generate a Bcrypt Hash for Your Admin Password

Run the hash generator:
```bash
npm run hash-password
```

This will:
- Prompt you to enter your admin password
- Generate a secure bcrypt hash
- Display the hash to copy

### 2. Update `.env.local`

Copy the generated hash into `.env.local`:

```env
VITE_ADMIN_PASS_HASH=$2b$10$5cJdVYVRq5IYdHxMlbBTHeNKQm3kKKBz5gZx2Xq9JKKzY9QfDwJW2
```

**Default setup:** The `.env.local` file already contains the hash for password `"adminbaby"`. You can use this for testing or generate your own.

### 3. Build and Deploy

```bash
npm run build
firebase deploy
```

---

## Security Best Practices

✅ **DO:**
- Keep `.env.local` private (never commit to Git)
- Generate a strong admin password (8+ characters)
- Store `.env.local` in your `.gitignore` (already set up)
- Regenerate the hash if you change the admin password

❌ **DON'T:**
- Hardcode passwords in source code
- Share `.env.local` publicly
- Use weak passwords like "admin" or "password"

---

## Troubleshooting

### Q: Admin login not working
**A:** 
- Verify the hash is correctly copied to `.env.local`
- Check that you're using the correct password that matches the hash
- Restart the dev server after updating `.env.local`

### Q: How do I change the admin password?
**A:**
1. Run `npm run hash-password`
2. Enter the new password
3. Copy the new hash to `.env.local`
4. Rebuild and redeploy

### Q: Can I use the old password "adminbaby"?
**A:** Yes! The default hash is already set to "adminbaby". You can use it as-is or generate your own.

---

## User Password Security

User passwords are also now secured:
- **New signups:** Hashed with bcrypt
- **Old users:** Automatically handled on login (backward compatible)
- **Migration available:** See `migrate-passwords.mjs` to hash all old passwords

---

## Files Modified

- `src/celebrity-rating-app.jsx` - Admin login now uses bcrypt
- `package.json` - Added `hash-password` script
- `.env.local` - Stores the admin password hash
- `.env.example` - Template for configuration
- `hash-password.mjs` - Password hash generator utility
