const User = require('../src/models/user.schema');
const Contact = require('../src/models/contact.schema');

// script de migración
const users = await User.find({ contacts: { $exists: true, $ne: [] } });

for (const u of users) {
  for (const contactId of u.contacts) {
    await Contact.findByIdAndUpdate(contactId, { owner: u._id });
  }
}

await User.updateMany({}, { $unset: { contacts: '' } }); // opcional
