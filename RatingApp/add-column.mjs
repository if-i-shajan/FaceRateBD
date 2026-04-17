import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vvlfjmporhpotwngngsg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function addProfilePhotoColumn() {
    try {
        console.log('Adding profile_photo_url column to users table...');

        const { error } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;'
        });

        if (error) {
            console.error('Error:', error);
            // Try alternative method
            console.log('Trying alternative method...');
            const { data, error: altError } = await supabase.from('users').select('profile_photo_url').limit(1);
            if (altError?.message?.includes('does not exist')) {
                console.log('Column does not exist - you need to add it manually via Supabase dashboard');
            } else if (!altError) {
                console.log('Column already exists!');
            }
        } else {
            console.log('✓ Column added successfully!');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

addProfilePhotoColumn();
