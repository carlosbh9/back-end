function buildListMasterQuotersV2QueryDto(query = {}) {
  return {
    q: query.q,
    type: query.type,
    status: query.status,
    active: query.active,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
}

module.exports = {
  buildListMasterQuotersV2QueryDto,
};
