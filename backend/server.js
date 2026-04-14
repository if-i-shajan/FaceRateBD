import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email HTML Template with Mint Green Theme
function getOTPEmailHTML(name, otp) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - FaceRate BD</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #0f2e26 0%, #1a4d42 100%);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .email-container {
            max-width: 600px;
            width: 100%;
            background: #1a2625;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(94, 242, 194, 0.2);
        }
        .header {
            background: linear-gradient(135deg, #2ab88b 0%, #1a9e77 100%);
            padding: 40px 30px;
            text-align: center;
        }
        .header-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
            letter-spacing: 0.5px;
        }
        .header p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 500;
        }
        .content {
            padding: 50px 30px;
            text-align: center;
        }
        .greeting {
            color: #e0e8e7;
            font-size: 16px;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .greeting strong {
            color: #5ef2c2;
            font-weight: 600;
        }
        .otp-section {
            margin: 40px 0;
        }
        .otp-label {
            color: #9bb1ad;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 20px;
            font-weight: 600;
            display: block;
        }
        .otp-box {
            background: linear-gradient(135deg, rgba(94, 242, 194, 0.1), rgba(42, 184, 139, 0.1));
            border: 2px solid #5ef2c2;
            border-radius: 16px;
            padding: 30px;
            margin: 20px 0;
            display: inline-block;
            min-width: 280px;
        }
        .otp-code {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #5ef2c2;
            font-family: 'Monaco', 'Courier New', monospace;
            word-break: break-all;
            text-shadow: 0 2px 4px rgba(94, 242, 194, 0.3);
        }
        .expiry-message {
            color: #9bb1ad;
            font-size: 13px;
            margin-top: 20px;
            font-weight: 500;
        }
        .expiry-message strong {
            color: #5ef2c2;
        }
        .instructions {
            background: rgba(94, 242, 194, 0.05);
            border-left: 4px solid #5ef2c2;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
        }
        .instructions p {
            color: #c5d3d1;
            font-size: 14px;
            margin: 8px 0;
            line-height: 1.6;
        }
        .instructions strong {
            color: #5ef2c2;
        }
        .security-note {
            color: #9bb1ad;
            font-size: 12px;
            margin-top: 20px;
            line-height: 1.6;
        }
        .footer {
            background: rgba(0, 0, 0, 0.3);
            padding: 30px;
            text-align: center;
            border-top: 1px solid rgba(94, 242, 194, 0.1);
        }
        .footer-logo {
            font-size: 20px;
            color: #5ef2c2;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
        }
        .footer p {
            color: #6b8985;
            font-size: 12px;
            margin: 5px 0;
            line-height: 1.6;
        }
        .footer-link {
            color: #5ef2c2;
            text-decoration: none;
            font-weight: 600;
        }
        .footer-link:hover {
            text-decoration: underline;
        }
        @media (max-width: 600px) {
            .email-container {
                border-radius: 12px;
            }
            .header {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .content {
                padding: 30px 20px;
            }
            .otp-code {
                font-size: 36px;
                letter-spacing: 6px;
            }
            .otp-box {
                min-width: 240px;
                padding: 24px;
            }
            .footer {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="header-icon">📸</div>
            <h1>Email Verification</h1>
            <p>Secure your FaceRate BD account</p>
        </div>

        <div class="content">
            <div class="greeting">
                Hello <strong>${name}</strong>,<br>
                Enter the code below to verify your email and complete your registration.
            </div>

            <div class="otp-section">
                <span class="otp-label">Your Verification Code</span>
                <div class="otp-box">
                    <div class="otp-code">${otp.replace(/(\d)/g, '$1 ').trim()}</div>
                </div>
                <div class="expiry-message">
                    ⏱️ This code expires in <strong>10 minutes</strong>
                </div>
            </div>

            <div class="instructions">
                <p><strong>📋 Next Steps:</strong></p>
                <p>1. Return to the FaceRate BD app</p>
                <p>2. Enter the code shown above</p>
                <p>3. Complete your registration</p>
            </div>

            <div class="security-note">
                🔒 For security, never share this code with anyone. FaceRate BD will never ask for this code via email or phone.
            </div>
        </div>

        <div class="footer">
            <div class="footer-logo">FaceRate BD</div>
            <p>Bangladeshi Celebrity Evaluation System</p>
            <p>© 2026 FaceRate BD. All rights reserved.</p>
            <p>If you didn't request this code, please <a href="mailto:support@facerate-bd.com" class="footer-link">contact support</a></p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Send OTP Email
 * POST /api/send-otp
 */
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({
                ok: false,
                error: 'Email and name are required',
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP in Supabase
        const { error: insertError } = await supabase.from('otp_codes').insert([
            {
                email,
                otp,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString(),
            },
        ]);

        if (insertError) {
            console.error('Supabase insert error:', insertError);
            return res.status(500).json({
                ok: false,
                error: 'Failed to generate OTP',
            });
        }

        // Send email via Resend
        const emailResponse = await resend.emails.send({
            from: 'noreply@facerate-bd.com',
            to: email,
            subject: '🔐 Your OTP Code - FaceRate BD',
            html: getOTPEmailHTML(name, otp),
        });

        if (emailResponse.error) {
            console.error('Resend error:', emailResponse.error);
            return res.status(500).json({
                ok: false,
                error: 'Failed to send email',
            });
        }

        res.json({
            ok: true,
            message: 'OTP sent successfully',
            data: {
                id: emailResponse.data?.id,
            },
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            ok: false,
            error: error.message || 'Failed to send OTP',
        });
    }
});

/**
 * Verify OTP
 * POST /api/verify-otp
 */
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                ok: false,
                error: 'Email and OTP are required',
            });
        }

        // Check if OTP exists and is not expired
        const { data: otpRecord, error: queryError } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('email', email)
            .eq('otp', otp)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (queryError || !otpRecord) {
            return res.status(400).json({
                ok: false,
                error: 'Invalid or expired OTP',
            });
        }

        // Mark OTP as used (soft delete)
        await supabase
            .from('otp_codes')
            .update({ used: true })
            .eq('id', otpRecord.id);

        res.json({
            ok: true,
            message: 'OTP verified successfully',
            data: {
                email,
                verified: true,
            },
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            ok: false,
            error: error.message || 'Failed to verify OTP',
        });
    }
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        message: 'OTP API is running',
        timestamp: new Date().toISOString(),
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 OTP API server running on port ${PORT}`);
    console.log(`📧 Resend API configured`);
    console.log(`🗄️ Supabase configured`);
});
