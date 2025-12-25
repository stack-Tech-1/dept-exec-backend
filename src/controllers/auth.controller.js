const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Invite = require("../models/invite.model");
const User = require("../models/user.model");
const { generateToken } = require("../utils/token");
const { sendEmail } = require("../utils/mailer");

// ADMIN sends invite
exports.inviteUser = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { email, role } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: "Valid email required" });
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
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      invitedBy: req.user.id
    });

    // Send invitation email
    const inviteLink = `http://localhost:3000/register?token=${token}`;
    
    await sendEmail({
      to: email,
      subject: "Invitation to Department Executive System",
      text: `
Dear Executive,

You have been invited to join the Department of Industrial & Production Engineering Executive System.

Please click the link below to complete your registration:
${inviteLink}

Role: ${role || "EXEC"}
Link expires in: 24 hours

This is a secure, invite-only system for department leadership.

Best regards,
Department Executive System
`,
    });

    console.log(`📧 Invite sent to ${email} by user ${req.user.id}`);

    res.json({ 
      message: "Invite sent successfully",
      expiresAt: invite.expiresAt
    });

  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// User completes registration
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

    // Check if user already exists (double-check)
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

    // Create user
    const user = await User.create({
      name,
      email: invite.email,
      password: hashedPassword,
      role: invite.role,
      isActive: true,
    });

    // Mark invite as used
    invite.used = true;
    await invite.save();

    console.log(`✅ User registered: ${email} (${invite.role})`);

    res.status(201).json({ 
      message: "Registration complete. You can now login.",
      email: invite.email
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login
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

    // Generate secure JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        algorithm: "HS256" // Explicit algorithm
      }
    );

    console.log(`🔐 User logged in: ${user.email} (${user.role})`);

    res.json({ 
      success: true,
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        lastLogin: user.lastLogin
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