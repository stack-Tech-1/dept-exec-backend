const nodemailer = require("nodemailer");

// Create transporter - Matching your working ERP configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false, // Use false for 587, true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Increase timeout to give Render more time to negotiate with Google
  connectionTimeout: 30000, 
  greetingTimeout: 30000,
});

exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 HTML length: ${html?.length || 0}`);    
    console.log(`📧 Using email: ${process.env.EMAIL_USER}`);
        
    const mailOptions = {
      from: `"Dept Exec System" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || "You have been invited to the Department Executive System.",
    }
    
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