/**
 * Resend OTP Service
 * Handles OTP generation and verification via backend API
 */

const API_BASE_URL = import.meta.env.VITE_OTP_API_URL || 'http://localhost:3001';

/**
 * Send OTP to email
 * @param {string} email - User email
 * @param {string} name - User full name
 * @returns {Promise<{ok: boolean, error?: string, data?: object}>}
 */
export async function sendOTP(email, name) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, name }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                ok: false,
                error: data.error || 'Failed to send OTP',
            };
        }

        return {
            ok: true,
            data,
        };
    } catch (error) {
        console.error('Send OTP error:', error);
        return {
            ok: false,
            error: error.message || 'Failed to send OTP',
        };
    }
}

/**
 * Verify OTP code
 * @param {string} email - User email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{ok: boolean, error?: string, data?: object}>}
 */
export async function verifyOTP(email, otp) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, otp }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                ok: false,
                error: data.error || 'Invalid or expired OTP',
            };
        }

        return {
            ok: true,
            data,
        };
    } catch (error) {
        console.error('Verify OTP error:', error);
        return {
            ok: false,
            error: error.message || 'Failed to verify OTP',
        };
    }
}

/**
 * Check API health
 * @returns {Promise<{ok: boolean}>}
 */
export async function checkOTPAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        return response.ok;
    } catch (error) {
        console.error('API health check failed:', error);
        return false;
    }
}
