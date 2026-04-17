/**
 * PASSWORD HASH GENERATOR
 * 
 * Use this to generate bcrypt hashes for the admin password.
 * 
 * Usage:
 *   npm run hash-password
 * 
 * Then paste the generated hash into .env.local as VITE_ADMIN_PASS_HASH
 */

import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function generateHash() {
    console.log('\n🔐 Admin Password Hash Generator\n');

    const password = await prompt('Enter your admin password: ');

    if (!password || password.length < 4) {
        console.error('❌ Password must be at least 4 characters');
        rl.close();
        process.exit(1);
    }

    try {
        console.log('\n⏳ Generating hash (this may take a moment)...\n');
        const hash = await bcrypt.hash(password, 10);

        console.log('✅ Hash generated successfully!\n');
        console.log('📋 Copy this hash to .env.local:\n');
        console.log(`VITE_ADMIN_PASS_HASH=${hash}\n`);
        console.log('⚠️  Keep .env.local private - DO NOT commit to Git!\n');

    } catch (error) {
        console.error('❌ Error generating hash:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

generateHash();
