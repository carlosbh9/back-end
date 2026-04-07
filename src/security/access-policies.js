const SERVICE_ORDER_AREAS = Object.freeze(['RESERVAS', 'OPERACIONES', 'CONTABILIDAD', 'PAGOS']);

const ROLE_SCOPE_CATALOG = Object.freeze([
  {
    role: 'admin',
    label: 'Administrador',
    description: 'Acceso total al sistema y bypass operativo.',
    serviceOrderAreas: SERVICE_ORDER_AREAS,
    isAdmin: true,
  },
  {
    role: 'ventas',
    label: 'Ventas',
    description: 'Operacion comercial sobre reservas y seguimiento comercial.',
    serviceOrderAreas: ['RESERVAS', 'OPERACIONES'],
    isAdmin: false,
  },
  {
    role: 'reservas',
    label: 'Reservas',
    description: 'Gestion principal del area de reservas.',
    serviceOrderAreas: ['RESERVAS'],
    isAdmin: false,
  },
  {
    role: 'operaciones',
    label: 'Operaciones',
    description: 'Seguimiento operativo y soporte sobre reservas activas.',
    serviceOrderAreas: ['OPERACIONES', 'RESERVAS'],
    isAdmin: false,
  },
  {
    role: 'contabilidad',
    label: 'Contabilidad',
    description: 'Gestion financiera y conciliacion con pagos.',
    serviceOrderAreas: ['CONTABILIDAD', 'PAGOS'],
    isAdmin: false,
  },
  {
    role: 'pagos',
    label: 'Pagos',
    description: 'Seguimiento de cobros, pagos y coordinacion con contabilidad.',
    serviceOrderAreas: ['PAGOS', 'CONTABILIDAD'],
    isAdmin: false,
  },
]);

const ROLE_SCOPE_MAP = Object.freeze(
  ROLE_SCOPE_CATALOG.reduce((acc, item) => {
    acc[item.role] = item;
    return acc;
  }, {})
);

function normalizeRoleName(role = '') {
  return String(role || '').trim().toLowerCase();
}

function getRoleScope(role = '') {
  const normalizedRole = normalizeRoleName(role);
  return ROLE_SCOPE_MAP[normalizedRole] || {
    role: normalizedRole,
    label: normalizedRole || 'custom',
    description: 'Rol personalizado sin alcance base definido en backend.',
    serviceOrderAreas: [],
    isAdmin: false,
  };
}

function isAdminRole(role = '') {
  return getRoleScope(role).isAdmin === true;
}

function getServiceOrderAreasForRole(role = '') {
  return [...(getRoleScope(role).serviceOrderAreas || [])];
}

function canAccessServiceOrderArea(role = '', area = '') {
  const normalizedArea = String(area || '').trim().toUpperCase();
  if (!normalizedArea) return false;
  return getServiceOrderAreasForRole(role).includes(normalizedArea);
}

module.exports = {
  ROLE_SCOPE_CATALOG,
  SERVICE_ORDER_AREAS,
  normalizeRoleName,
  getRoleScope,
  isAdminRole,
  getServiceOrderAreasForRole,
  canAccessServiceOrderArea,
};
