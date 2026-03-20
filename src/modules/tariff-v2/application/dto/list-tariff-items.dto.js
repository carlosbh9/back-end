function buildListTariffItemsV2QueryDto(query = {}) {
  return {
    type: query.type,
    category: query.category,
    status: query.status,
    provider: query.provider,
    city: query.city,
    active: query.active,
    year: query.year,
    q: query.q,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
}

module.exports = {
  buildListTariffItemsV2QueryDto,
};
