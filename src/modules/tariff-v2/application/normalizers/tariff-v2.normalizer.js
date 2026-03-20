function cleanString(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullableString(value) {
  if (value === null) return null;
  return cleanString(value);
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const cleaned = [...new Set(value.map((item) => cleanString(item)).filter(Boolean))];
  return cleaned.length ? cleaned : [];
}

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entries = Object.entries(value)
    .map(([key, currentValue]) => [key, normalizeAny(currentValue)])
    .filter(([, currentValue]) => currentValue !== undefined);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function cleanArray(value) {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.map((item) => normalizeAny(item)).filter((item) => item !== undefined);
  return cleaned.length ? cleaned : [];
}

function normalizeAny(value) {
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return cleanArray(value);
  if (value && typeof value === 'object') return cleanObject(value);
  return value;
}

function normalizePricing(pricing) {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) {
    return pricing;
  }

  return {
    mode: pricing.mode,
    currency: cleanString(pricing.currency) || 'USD',
    pricePerson: typeof pricing.pricePerson === 'boolean' ? pricing.pricePerson : pricing.pricePerson ?? null,
    basePrice: pricing.basePrice ?? null,
    soloTravelerPrice: pricing.soloTravelerPrice ?? null,
    guidePrice: pricing.guidePrice ?? null,
    ranges: cleanArray(pricing.ranges),
    rooms: cleanArray(pricing.rooms),
    seasons: cleanArray(pricing.seasons),
    vehicleRates: cleanArray(pricing.vehicleRates),
    custom: pricing.custom === null ? null : cleanObject(pricing.custom),
  };
}

function normalizeTariffItemPayload(payload = {}) {
  return {
    code: cleanString(payload.code),
    name: cleanString(payload.name),
    provider: cleanString(payload.provider),
    type: payload.type,
    category: payload.category,
    subtype: cleanString(payload.subtype),
    city: cleanString(payload.city),
    location: cleanString(payload.location),
    active: typeof payload.active === 'boolean' ? payload.active : payload.active,
    status: payload.status,
    tags: cleanStringArray(payload.tags),
    content: cleanObject(payload.content),
    pricing: normalizePricing(payload.pricing),
    childPolicies: cleanArray(payload.childPolicies),
    validity: cleanObject(payload.validity),
    notes: cleanString(payload.notes),
    metadata: cleanObject(payload.metadata),
  };
}

module.exports = {
  normalizeTariffItemPayload,
};
