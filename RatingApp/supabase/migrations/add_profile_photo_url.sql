-- Migration to add profile_photo_url column
BEGIN;

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
    RAISE NOTICE 'Column profile_photo_url added successfully';
  ELSE
    RAISE NOTICE 'Column profile_photo_url already exists';
  END IF;
END $$;

COMMIT;
