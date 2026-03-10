const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp.office365.com
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER, // no-reply@tudominio.com
    pass: process.env.SMTP_PASS  // ideal: app password / o credencial segura
  },
  tls: { ciphers: 'SSLv3' }
});

async function sendBookingNotification({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html
  });
}

module.exports = { sendBookingNotification };
