const Contact = require('../../models/contact.schema');
const { PERMISSIONS, hasPermission } = require('../../security/permissions');
const { isAdminRole } = require('../../security/access-policies');

function canReadAllContacts(user = {}) {
  return isAdminRole(user?.role)
    || hasPermission(user, PERMISSIONS.CONTACTS_READ_ALL)
    || hasPermission(user, PERMISSIONS.CONTACTS_MANAGE_ALL);
}

function canManageAllContacts(user = {}) {
  return isAdminRole(user?.role) || hasPermission(user, PERMISSIONS.CONTACTS_MANAGE_ALL);
}

function buildContactAccessFilter(user = {}, baseFilter = {}) {
  if (canReadAllContacts(user)) {
    return { ...baseFilter };
  }

  return {
    ...baseFilter,
    owner: user?.id || null
  };
}

async function findAccessibleContactById(contactId, user = {}, projection = null) {
  if (!contactId) return null;

  let query = Contact.findOne(buildContactAccessFilter(user, { _id: contactId }));
  if (projection) {
    query = query.select(projection);
  }

  return query;
}

module.exports = {
  canReadAllContacts,
  canManageAllContacts,
  buildContactAccessFilter,
  findAccessibleContactById
};
