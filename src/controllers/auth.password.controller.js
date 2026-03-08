const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { sendEmail } = require('../utils/mailer');

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success even if user not found (security)
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpiry = expiry;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    sendEmail({
      to: user.email,
      subject: 'IESA Portal — Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0a0f0d;font-family:Arial,sans-serif;">
          <div style="max-width:520px;margin:40px auto;background:#0d1f15;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#0a5a2d,#10b981);padding:32px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">IESA Exec Portal</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">Industrial Engineering Students' Association</p>
            </div>
            <div style="padding:32px;">
              <h2 style="color:white;margin:0 0 12px;">Reset Your Password</h2>
              <p style="color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 24px;">
                Hi ${user.name}, we received a request to reset your IESA Portal password.
                Click the button below to set a new password. This link expires in <strong style="color:#10b981;">1 hour</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}"
                  style="background:linear-gradient(135deg,#10b981,#0a5a2d);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:24px 0 0;line-height:1.6;">
                If you didn't request this, you can safely ignore this email. Your password will not change.<br><br>
                Or copy this link: <a href="${resetUrl}" style="color:#10b981;">${resetUrl}</a>
              </p>
            </div>
            <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
                © ${new Date().getFullYear()} IESA — University of Ibadan. This is an automated message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    }).catch(err => console.error('Reset email error:', err));

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ valid: false, message: 'Link is invalid or expired.' });
    }
    res.json({ valid: true, name: user.name });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Server error' });
  }
};
