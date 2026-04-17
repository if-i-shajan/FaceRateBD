-- Add profile_photo_url column to users table
ALTER TABLE users ADD COLUMN profile_photo_url TEXT;

-- Optional: Add comment describing the column
COMMENT ON COLUMN users.profile_photo_url IS 'Base64 encoded profile photo URL or image data';
