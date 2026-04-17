/**
 * PASSWORD MIGRATION SCRIPT
 * Run this once to hash all plain-text passwords in the database
 * 
 * Usage: node migrate-passwords.mjs
 * 
 * This script:
 * 1. Fetches all users from the database
 * 2. Identifies plain-text passwords (not starting with $2a$, $2b$, etc.)
 * 3. Hashes them using bcrypt
 * 4. Updates the database with the hashed passwords
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://vvlfjmporhpotwngngsg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.error('Set it like this: export SUPABASE_SERVICE_ROLE_KEY="your-key"');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migratePasswords() {
    console.log('🔄 Starting password migration...\n');

    try {
        // Fetch all users
        const { data: users, error: fetchError } = await supabase
            .from('users')
            .select('id, password, name');

        if (fetchError) {
            console.error('❌ Error fetching users:', fetchError);
            process.exit(1);
        }

        if (!users || users.length === 0) {
            console.log('✅ No users found in database');
            return;
        }

        console.log(`Found ${users.length} users\n`);

        let plainTextCount = 0;
        let alreadyHashedCount = 0;
        const updates = [];

        // Identify plain-text vs hashed passwords
        for (const user of users) {
            const storedPassword = user.password;

            // Check if it's already a bcrypt hash
            const isBcryptHash = storedPassword && /^\$2[aby]\$/.test(storedPassword);

            if (isBcryptHash) {
                alreadyHashedCount++;
                console.log(`✅ ${user.id} (${user.name}): Already hashed`);
            } else {
                plainTextCount++;
                console.log(`⏳ ${user.id} (${user.name}): Plain text - will hash`);
                updates.push(user);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Already hashed: ${alreadyHashedCount}`);
        console.log(`   Need hashing: ${plainTextCount}`);

        if (plainTextCount === 0) {
            console.log('\n✅ All passwords are already hashed!');
            return;
        }

        // Hash and update plain-text passwords
        console.log(`\n🔐 Hashing ${plainTextCount} plain-text passwords...\n`);

        for (const user of updates) {
            try {
                const hashedPassword = await bcrypt.hash(user.password, 10);

                const { error: updateError } = await supabase
                    .from('users')
                    .update({ password: hashedPassword })
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`   ❌ ${user.id}: Update failed - ${updateError.message}`);
                } else {
                    console.log(`   ✅ ${user.id}: Password hashed and updated`);
                }
            } catch (err) {
                console.error(`   ❌ ${user.id}: Hashing error - ${err.message}`);
            }
        }

        console.log('\n✅ Password migration complete!');
        console.log('All users can now log in with their passwords.');

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    }
}

migratePasswords();
