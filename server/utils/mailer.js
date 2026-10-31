// Sends real email when SMTP_HOST is set and the nodemailer package is installed.
// Otherwise the message is printed in the server terminal, so development still works.
//   npm install nodemailer
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (true/false), MAIL_FROM
let transporter = null;
if (process.env.SMTP_HOST) {
  try {
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } catch (e) {
    console.warn("SMTP_HOST is set but nodemailer is not installed. Run: npm install nodemailer");
  }
}

async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.log(`\n[MAIL to ${to}] ${subject}\n${text}\n`);
    return { sent: false };
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || "Brightloop <no-reply@brightloop.local>",
    to,
    subject,
    text,
  });
  return { sent: true };
}

module.exports = { sendMail };
