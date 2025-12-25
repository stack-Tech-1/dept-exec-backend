require('dotenv').config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/user.model");
const connectDB = require("../src/config/db");

async function seedAdmin() {
  try {
    await connectDB();
    
    const adminEmail = "admin@dept.com";
    const adminPassword = "admin123";
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log("⚠️  Admin user already exists");
      process.exit(0);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create admin user
    const admin = await User.create({
      name: "System Administrator",
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      department: "Industrial & Production Engineering"
    });
    
    console.log("✅ Admin user created successfully!");
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log("⚠️  Change this password immediately after first login!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

seedAdmin();