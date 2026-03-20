function buildCreateTariffItemV2Dto(payload = {}) {
  return {
    code: payload.code,
    name: payload.name,
    provider: payload.provider,
    type: payload.type,
    category: payload.category,
    subtype: payload.subtype,
    city: payload.city,
    location: payload.location,
    active: payload.active,
    status: payload.status,
    tags: payload.tags,
    content: payload.content,
    pricing: payload.pricing,
    childPolicies: payload.childPolicies,
    validity: payload.validity,
    notes: payload.notes,
    legacy: payload.legacy,
    metadata: payload.metadata,
  };
}

module.exports = {
  buildCreateTariffItemV2Dto,
};
