const User = require('../../models/user.schema');
const { sendBookingNotification } = require('../mailer');

function parseCsvList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function dedupeEmails(values = []) {
  return Array.from(new Set(values.map(normalizeEmail).filter(Boolean)));
}

function buildBookingFileUrl(fileId) {
  const baseUrl = String(process.env.FRONTEND_BOOKING_FILE_URL || process.env.FRONTEND_APP_URL || '').trim().replace(/\/$/, '');
  if (!baseUrl || !fileId) {
    return '';
  }

  if (baseUrl.includes('{id}')) {
    return baseUrl.replace('{id}', String(fileId));
  }

  return `${baseUrl}/${fileId}`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveRecipients({ notifyUserIds = [], notifyEmails = [] } = {}) {
  const roleFilters = parseCsvList(process.env.BOOKING_FILE_NOTIFICATION_ROLES);
  const envEmails = parseCsvList(process.env.BOOKING_FILE_NOTIFICATION_EMAILS);
  const userIds = Array.isArray(notifyUserIds)
    ? notifyUserIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const recipientEmails = [...notifyEmails, ...envEmails];

  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } }).select('username');
    recipientEmails.push(...users.map((user) => user?.username));
  }

  if (roleFilters.length > 0) {
    const usersByRole = await User.find({ role: { $in: roleFilters } }).select('username');
    recipientEmails.push(...usersByRole.map((user) => user?.username));
  }

  return dedupeEmails(recipientEmails);
}

function buildEmailHtml({ bookingFile, contact, quoter, changedByName }) {
  const bookingFileUrl = buildBookingFileUrl(bookingFile?._id);
  const guest = bookingFile?.guest || quoter?.guest || contact?.name || 'N/A';
  const fileCode = bookingFile?.fileCode || 'N/A';
  const travelStart = bookingFile?.travel_date_start || quoter?.travelDate?.start || 'N/A';
  const travelEnd = bookingFile?.travel_date_end || quoter?.travelDate?.end || 'N/A';
  const destinations = Array.isArray(bookingFile?.destinations) && bookingFile.destinations.length > 0
    ? bookingFile.destinations.join(', ')
    : 'N/A';

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">New sold booking file assigned</h2>
      <p>A quote was marked as sold and a booking file is now available for follow-up.</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>File code</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(fileCode)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>Guest</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(guest)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>Contact</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(contact?.name || 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>Travel dates</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(`${travelStart} - ${travelEnd}`)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>Destinations</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(destinations)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0;"><strong>Confirmed by</strong></td>
          <td style="padding: 6px 0;">${escapeHtml(changedByName || 'System')}</td>
        </tr>
      </table>
      ${bookingFileUrl ? `<p><a href="${escapeHtml(bookingFileUrl)}">Open booking file</a></p>` : ''}
    </div>
  `;
}

async function notifySaleConfirmed({ bookingFile, contact, quoter, changedByUser, notifyUserIds = [], notifyEmails = [] } = {}) {
  const recipients = await resolveRecipients({ notifyUserIds, notifyEmails });
  if (recipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      reason: 'No recipients configured'
    };
  }

  const changedByName = changedByUser?.name || changedByUser?.username || '';
  const subject = `Booking file assigned: ${bookingFile?.fileCode || 'N/A'} - ${bookingFile?.guest || contact?.name || 'Guest'}`;
  const html = buildEmailHtml({ bookingFile, contact, quoter, changedByName });

  await sendBookingNotification({
    to: recipients.join(','),
    subject,
    html
  });

  return {
    sent: true,
    skipped: false,
    recipients
  };
}

module.exports = {
  notifySaleConfirmed
};
