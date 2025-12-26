const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Invite = require("../models/invite.model");
const User = require("../models/user.model");
const { generateToken } = require("../utils/token");
const { sendEmail } = require("../utils/mailer");
const { EXECUTIVE_POSITIONS } = require("../models/user.model");

// ADMIN sends invite
exports.inviteUser = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { email, role, position } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: "Valid email required" });
    }

     // Validate position if provided
     if (position && !EXECUTIVE_POSITIONS.includes(position)) {
      return res.status(400).json({ 
        message: "Invalid position",
        validPositions: EXECUTIVE_POSITIONS
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        message: "User with this email already exists" 
      });
    }

    // Generate unique token
    const token = generateToken();

    // Create invite
    const invite = await Invite.create({
      email: email.toLowerCase(),
      role: role || "EXEC",
      position: position || "Executive Member",
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      invitedBy: req.user.id
    });

    // Send invitation email with position
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}`;

    await sendEmail({
      to: email,
      subject: "📋 You're Invited: Department of Industrial & Production Engineering Executive System",
      html: `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Executive Portal Invitation</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9fafb">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                      <tr>
                        <td bgcolor="#0d7c3d" style="padding: 40px 30px; text-align: center; background: linear-gradient(to right, #0d7c3d, #0a5a2d);">
                          <img src="https://i.postimg.cc/yNcXffw4/453375033-1725219728215199-3549774134662057941-n.jpg" 
                               alt="IPE Department Logo" 
                               width="80" height="80" 
                               style="border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); margin-bottom: 20px;">
                          <h1 style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 0 0 10px 0;">
                            Executive Portal Invitation
                          </h1>
                          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">
                            Department of Industrial & Production Engineering
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px 30px;">
                          <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">
                            Dear Executive,
                          </h2>
                          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                            You have been invited to join the <strong>Department Executive System</strong> as the ${position || "Executive Member"}. This system facilitates executive decision-making and departmental coordination.
                          </p>
                          
                          <!-- Role & Position Cards -->
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="50%" style="padding-right: 8px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="border: 1px solid #e5e7eb; border-radius: 8px;">
                                  <tr>
                                    <td style="padding: 16px;">
                                      <p style="color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">
                                        Your Role
                                      </p>
                                      <p style="color: #0d7c3d; font-size: 16px; font-weight: bold; margin: 0;">
                                        ${role === "ADMIN" ? "Administrator" : "Executive"}
                                      </p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                              <td width="50%" style="padding-left: 8px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f9ff" style="border: 1px solid #e0f2fe; border-radius: 8px;">
                                  <tr>
                                    <td style="padding: 16px;">
                                      <p style="color: #0369a1; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">
                                        Your Position
                                      </p>
                                      <p style="color: #0d7c3d; font-size: 16px; font-weight: bold; margin: 0;">
                                        ${position || "Executive Member"}
                                      </p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- Button -->
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 25px 0;">
                            <tr>
                              <td align="center">
                                <a href="${inviteLink}" 
                                   style="background: linear-gradient(to right, #0d7c3d, #0a5a2d); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(13, 124, 61, 0.25);">
                                  🎯 Complete Registration as ${position || "Executive"}
                                </a>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- Rest of email remains the same -->
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fef3c7" style="border: 1px solid #fbbf24; border-radius: 8px; margin: 25px 0;">
                            <tr>
                              <td style="padding: 16px;">
                                <p style="color: #92400e; margin: 0; font-size: 14px;">
                                  ⏰ <strong>Important:</strong> This invitation link will expire in <strong>24 hours</strong> for security purposes.
                                </p>
                              </td>
                            </tr>
                          </table>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="border-radius: 6px; margin: 25px 0;">
                            <tr>
                              <td style="padding: 16px;">
                                <p style="color: #374151; font-size: 13px; margin: 0 0 8px 0; font-weight: 600;">
                                  Direct Link:
                                </p>
                                <a href="${inviteLink}" 
                                   style="color: #2563eb; text-decoration: none; word-break: break-all; font-size: 14px;">
                                  ${inviteLink}
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `,
    });

    console.log(`📧 Invite sent to ${email} for position: ${position || "Executive Member"}`);

    res.json({ 
      message: "Invite sent successfully",
      expiresAt: invite.expiresAt,
      position: invite.position
    });

  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// User registration - UPDATED to save position
exports.registerWithInvite = async (req, res) => {
  try {
    const { token, name, password } = req.body;

    // Validate input
    if (!token || !name || !password) {
      return res.status(400).json({ 
        message: "Token, name, and password are required" 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }

    // Find valid invite
    const invite = await Invite.findOne({ 
      token, 
      used: false,
      expiresAt: { $gt: new Date() } // Not expired
    });

    if (!invite) {
      return res.status(400).json({ 
        message: "Invalid, expired, or already used invitation token" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      invite.used = true;
      await invite.save();
      return res.status(400).json({ 
        message: "User already registered with this email" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with position from invite
    const user = await User.create({
      name,
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
      position: invite.position, // Save position from invite
      isActive: true,
    });

    // Mark invite as used
    invite.used = true;
    await invite.save();

    console.log(`✅ User registered: ${invite.email} (${invite.role}, ${invite.position})`);

    res.status(201).json({ 
      message: "Registration complete. You can now login.",
      email: invite.email,
      position: invite.position
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login - UPDATED to include position in response
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password required" 
      });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      isActive: true 
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token with position
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        position: user.position, // Include position in token
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        algorithm: "HS256"
      }
    );

    console.log(`🔐 User logged in: ${user.email} (${user.role}, ${user.position})`);

    res.json({ 
      success: true,
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position, // Include in response
        department: user.department,
        lastLogin: user.lastLogin,
        bio: user.bio,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during login" 
    });
  }
};

// Validate invite token - UPDATED to return position
exports.validateInviteToken = async (req, res) => {
  try {
    const { token } = req.params;
    console.log('Validating token:', token);

    const invite = await Invite.findOne({ 
      token, 
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid, expired, or already used invitation token" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: invite.email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already registered with this email" 
      });
    }

    console.log('Token valid for email:', invite.email, 'position:', invite.position);
    res.json({ 
      success: true,
      email: invite.email,
      role: invite.role,
      position: invite.position, // Return position
      expiresAt: invite.expiresAt
    });

  } catch (error) {
    console.error("Token validation error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error validating token" 
    });
  }
};

// Export positions for frontend
exports.getExecutivePositions = async (req, res) => {
  try {
    res.json({
      success: true,
      positions: EXECUTIVE_POSITIONS
    });
  } catch (error) {
    console.error("Get positions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching executive positions"
    });
  }
};