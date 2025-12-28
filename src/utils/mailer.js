const nodemailer = require("nodemailer");

// Create transporter with EXPLICIT settings
// Simplified for Gmail - This is more reliable on Render/Cloud
const transporter = nodemailer.createTransport({
  service: 'gmail', // Let Nodemailer handle the host/port
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true, // Uses a pool of connections (better for many emails)
});

exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(`📧 Attempting to send email to: ${to}`);
    
    const mailOptions = {
      from: `"Dept Exec System" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || "You have been invited to the Department Executive System.",
    };
    
    console.log("📧 Mail options prepared");
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ Email sending failed!");
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Code: ${error.code}`);
    console.error(`❌ Stack: ${error.stack}`);
    
    // More detailed error info
    if (error.code === 'EAUTH') {
      console.error("❌ Authentication failed. Check email/password.");
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error("❌ Connection failed. Check network/firewall.");
      console.error("❌ Trying alternative configuration...");
      
      // Try alternative config
      await tryAlternativeConfig({ to, subject, text });
    }
    
    return null;
  }
};

// Alternative configuration if primary fails
async function tryAlternativeConfig({ to, subject, text }) {
  try {
    console.log("🔄 Trying alternative email configuration...");
    
    const altTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const info = await altTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text,
    });
    
    console.log(`✅ Email sent via alternative method to ${to}`);
    return info;
  } catch (altError) {
    console.error("❌ Alternative method also failed:", altError.message);
    return null;
  }
}