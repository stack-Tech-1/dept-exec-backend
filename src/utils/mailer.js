const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.FROM_EMAIL || 'IESA Portal <noreply@ipeexecs.page>';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Single email with retry
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
        if (attempt < retries) { await sleep(attempt * 1500); continue; }
        console.error('❌ Resend error:', error.message);
        return { success: false, error: error.message };
      }
      console.log(`📧 Email sent to ${to} — ID: ${data?.id}`);
      return { success: true, id: data?.id };
    } catch (err) {
      if (attempt < retries) { await sleep(attempt * 1500); continue; }
      console.error('❌ Email failed:', err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Max retries exceeded' };
};

// Bulk email — sends to many recipients in batches of 100 (Resend's max per batch call)
exports.sendBulkEmail = async ({ recipients, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set — skipping bulk email');
    return { success: false, sent: 0, failed: 0 };
  }

  const BATCH_SIZE = 100; // Resend batch API max
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    try {
      const payload = batch.map(r => ({
        from: FROM_ADDRESS,
        to: [r.email],
        subject,
        html: html || `<p style="font-family:Arial,sans-serif;color:#374151;">${text}</p>`,
        text: text || '',
      }));

      const { data, error } = await resend.batch.send(payload);

      if (error) {
        console.error(`❌ Batch send error:`, error.message);
        failed += batch.length;
      } else {
        console.log(`📧 Batch sent: ${batch.length} emails (${i + batch.length}/${recipients.length})`);
        sent += batch.length;
      }
    } catch (err) {
      console.error(`❌ Batch failed:`, err.message);
      failed += batch.length;
    }

    // 1 second between batches to be safe
    if (i + BATCH_SIZE < recipients.length) {
      await sleep(1000);
    }
  }

  return { success: failed === 0, sent, failed };
};
