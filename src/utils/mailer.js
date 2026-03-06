const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.FROM_EMAIL || 'IESA Portal <noreply@ipeexecs.page>';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.sendEmail = async ({ to, subject, text, html }, retries = 3) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — skipping email');
    return { success: false, error: 'No API key' };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || `<p style="font-family:Arial,sans-serif;color:#374151;">${text}</p>`,
        text: text || '',
      });

      if (error) {
        // Rate limited — wait and retry
        if (error.statusCode === 429 || error.message?.includes('Too many requests')) {
          const wait = attempt * 1500;
          console.warn(`⏳ Rate limited, retrying in ${wait}ms (attempt ${attempt}/${retries})`);
          await sleep(wait);
          continue;
        }
        console.error('❌ Resend error:', error.message);
        return { success: false, error: error.message };
      }

      console.log(`📧 Email sent to ${to} — ID: ${data?.id}`);
      return { success: true, id: data?.id };

    } catch (err) {
      if (attempt < retries) {
        await sleep(attempt * 1500);
        continue;
      }
      console.error('❌ Email failed after retries:', err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
};
