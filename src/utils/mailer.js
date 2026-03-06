const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.FROM_EMAIL || 'IESA Portal <noreply@ipeexecs.page>';

exports.sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not set — skipping email');
      return { success: false, error: 'No API key' };
    }

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || `<p style="font-family:Arial,sans-serif;color:#374151;">${text}</p>`,
      text: text || '',
    });

    if (error) {
      console.error('❌ Resend error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`📧 Email sent to ${to} — ID: ${data?.id}`);
    return { success: true, id: data?.id };

  } catch (err) {
    console.error('❌ Email failed:', err.message);
    return { success: false, error: err.message };
  }
};
