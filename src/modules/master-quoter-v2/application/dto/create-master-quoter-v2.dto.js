function buildCreateMasterQuoterV2Dto(payload = {}) {
  return {
    name: payload.name,
    type: payload.type,
    destinations: payload.destinations,
    totalDays: payload.totalDays,
    status: payload.status,
    active: payload.active,
    notes: payload.notes,
    metadata: payload.metadata,
    days: payload.days,
  };
}

module.exports = {
  buildCreateMasterQuoterV2Dto,
};
