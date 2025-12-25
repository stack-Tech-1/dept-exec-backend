require('dotenv').config();
const nodemailer = require('nodemailer');

console.log("=== COMPREHENSIVE EMAIL DEBUG ===");
console.log("Time:", new Date().toISOString());
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS Length:", process.env.EMAIL_PASS?.length || 0);

// Test each configuration with timeout
async function testConfig(name, config, timeout = 10000) {
  console.log(`\n🔧 Testing: ${name}`);
  console.log("Configuration:", JSON.stringify(config, null, 2));
  
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.log(`⏰ ${name} - TIMEOUT after ${timeout}ms`);
      resolve(false);
    }, timeout);
    
    try {
      console.log("Creating transporter...");
      const transporter = nodemailer.createTransport(config);
      
      console.log("Verifying connection...");
      await transporter.verify();
      clearTimeout(timer);
      console.log(`✅ ${name} - Connection verified!`);
      
      console.log("Attempting to send test email...");
      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Test from ${name} at ${new Date().toLocaleTimeString()}`,
        text: 'This is a test email from debug script.'
      });
      
      console.log(`📧 ${name} - Email sent successfully!`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);
      resolve(true);
      
    } catch (error) {
      clearTimeout(timer);
      console.log(`❌ ${name} - FAILED`);
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Command: ${error.command}`);
      
      if (error.responseCode) {
        console.log(`   Response Code: ${error.responseCode}`);
      }
      if (error.response) {
        console.log(`   Full Response: ${error.response}`);
      }
      resolve(false);
    }
  });
}

async function runTests() {
  console.log("\n=== RUNNING TESTS ===\n");
  
  const tests = [
    {
      name: "TEST 1: Simple Gmail Service",
      config: { 
        service: 'gmail', 
        auth: { 
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS 
        }
      }
    },
    {
      name: "TEST 2: Port 587 with TLS",
      config: { 
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { 
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS 
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false
        }
      }
    },
    {
      name: "TEST 3: Port 465 with SSL",
      config: { 
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { 
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS 
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: "TEST 4: Alternative Approach",
      config: { 
        service: 'gmail',
        auth: { 
          user: process.env.EMAIL_USER, 
          pass: process.env.EMAIL_PASS 
        },
        pool: true,
        maxConnections: 1,
        rateDelta: 1000,
        rateLimit: 1
      }
    }
  ];
  
  let success = false;
  for (const test of tests) {
    const result = await testConfig(test.name, test.config);
    if (result) {
      success = true;
      break;
    }
  }
  
  if (!success) {
    console.log("\n❌ ALL TESTS FAILED!");
    console.log("\n=== TROUBLESHOOTING STEPS ===");
    console.log("1. Check if 2-Factor Authentication is enabled on your Google account");
    console.log("2. Generate a NEW App Password (delete old one)");
    console.log("3. Try from a different network (mobile hotspot)");
    console.log("4. Check if your ISP/network blocks SMTP ports");
    console.log("5. Temporarily disable firewall/antivirus");
    console.log("6. Try with a different Gmail account");
  } else {
    console.log("\n✅ EMAIL IS WORKING!");
  }
}

runTests();