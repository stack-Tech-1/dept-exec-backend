const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(`📧 Sending email via Resend to: ${to}`);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    console.log("✅ Email sent successfully");
    console.log("📨 Resend ID:", response.id);

    return response;
  } catch (error) {
    console.error("❌ Resend email failed");
    console.error("❌ Message:", error.message);

    if (error.response) {
      console.error("❌ Response:", error.response);
    }

    return null;
  }
};
