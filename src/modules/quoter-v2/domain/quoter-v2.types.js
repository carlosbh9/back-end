const QUOTE_V2_STATUSES = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  APPROVED: 'APPROVED',
  SOLD: 'SOLD',
  CANCELLED: 'CANCELLED',
};

const QUOTER_V2_SORT_FIELDS = ['createdAt', 'updatedAt', 'guest', 'name_quoter', 'status'];
const HOTEL_RATE_TYPES = ['confidential', 'rack'];
const DEFAULT_SEASON = 'Regular';

module.exports = {
  QUOTE_V2_STATUSES,
  QUOTER_V2_SORT_FIELDS,
  HOTEL_RATE_TYPES,
  DEFAULT_SEASON,
};
