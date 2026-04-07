const PERMISSIONS = Object.freeze({
  TARIFF_CREATE: 'create_tariff',
  TARIFF_ACTIONS: 'actions_tariff',
  QUOTER_CREATE: 'create_quoter',
  QUOTER_UPDATE: 'update_quoter',
  QUOTER_ACTIONS: 'actions_quoter',
  QUOTER_DELETE: 'delete_quoter',
  CONTACTS_PRINT_INFO_PAX: 'print_info_pax',
  CONTACTS_INFO_PAX_FILTERS: 'info_pax_filters',
  CONTACTS_INFO_PAX_TABLE: 'info_pax_table',
  CONTACTS_READ_ALL: 'contacts.read_all',
  CONTACTS_MANAGE_ALL: 'contacts.manage_all',
  SERVICE_ORDER_CANCEL: 'service_orders.cancel',
  SERVICE_ORDER_ASSIGN: 'service_orders.assign',
  SERVICE_ORDER_CHECKLIST_UPDATE: 'service_orders.checklist.update',
  SERVICE_ORDER_STAGE_UPDATE: 'service_orders.stage.update',
  SERVICE_ORDER_FINANCIALS_MANAGE: 'service_orders.financials.manage',
  SERVICE_ORDER_ATTACHMENTS_MANAGE: 'service_orders.attachments.manage',
  SERVICE_ORDER_TEMPLATES_MANAGE: 'service_order_templates.manage',
  VIEW_USERS: 'view_users',
  VIEW_TARIFF: 'view_tariff',
  VIEW_QUOTER: 'view_quoter'
});

const PERMISSION_TREE = Object.freeze([
  {
    id: 'tariff',
    label: 'Tariff',
    expanded: true,
    children: [
      { label: 'Create tariff', value: PERMISSIONS.TARIFF_CREATE },
      { label: 'Edit and Delete tariff', value: PERMISSIONS.TARIFF_ACTIONS },
    ]
  },
  {
    id: 'quoter',
    label: 'Quoter',
    expanded: true,
    children: [
      { label: 'Create Quoter', value: PERMISSIONS.QUOTER_CREATE },
      { label: 'Update Quoter', value: PERMISSIONS.QUOTER_UPDATE },
      { label: 'Edit and Delete Quoter', value: PERMISSIONS.QUOTER_ACTIONS },
      { label: 'Delete Quoter', value: PERMISSIONS.QUOTER_DELETE },
    ]
  },
  {
    id: 'contacts',
    label: 'Contacts',
    expanded: true,
    children: [
      { label: 'Print infoPax', value: PERMISSIONS.CONTACTS_PRINT_INFO_PAX },
      { label: 'Info pax filters', value: PERMISSIONS.CONTACTS_INFO_PAX_FILTERS },
      { label: 'Info pax Table', value: PERMISSIONS.CONTACTS_INFO_PAX_TABLE },
      { label: 'View all contacts', value: PERMISSIONS.CONTACTS_READ_ALL },
      { label: 'Manage all contacts', value: PERMISSIONS.CONTACTS_MANAGE_ALL },
    ]
  },
  {
    id: 'service-orders',
    label: 'Service Orders',
    expanded: true,
    children: [
      { label: 'Cancel service orders', value: PERMISSIONS.SERVICE_ORDER_CANCEL },
      { label: 'Assign service orders', value: PERMISSIONS.SERVICE_ORDER_ASSIGN },
      { label: 'Update service order checklist', value: PERMISSIONS.SERVICE_ORDER_CHECKLIST_UPDATE },
      { label: 'Update service order stages', value: PERMISSIONS.SERVICE_ORDER_STAGE_UPDATE },
      { label: 'Manage service order financials', value: PERMISSIONS.SERVICE_ORDER_FINANCIALS_MANAGE },
      { label: 'Manage service order attachments', value: PERMISSIONS.SERVICE_ORDER_ATTACHMENTS_MANAGE },
      { label: 'Manage order templates', value: PERMISSIONS.SERVICE_ORDER_TEMPLATES_MANAGE },
    ]
  },
  {
    id: 'view',
    label: 'View',
    expanded: true,
    children: [
      { label: 'Users', value: PERMISSIONS.VIEW_USERS },
      { label: 'Tariff', value: PERMISSIONS.VIEW_TARIFF },
      { label: 'Quoter', value: PERMISSIONS.VIEW_QUOTER },
    ]
  },
]);

function normalizePermissions(permissions = []) {
  if (!Array.isArray(permissions)) return [];

  return [...new Set(
    permissions
      .map((permission) => String(permission || '').trim())
      .filter(Boolean)
  )];
}

function hasPermission(user = {}, permission = '') {
  if (!permission) return false;
  const permissions = normalizePermissions(user.permissions);
  return permissions.includes(permission);
}

function hasAnyPermission(user = {}, permissions = []) {
  const normalized = normalizePermissions(permissions);
  return normalized.some((permission) => hasPermission(user, permission));
}

module.exports = {
  PERMISSIONS,
  PERMISSION_TREE,
  normalizePermissions,
  hasPermission,
  hasAnyPermission
};
