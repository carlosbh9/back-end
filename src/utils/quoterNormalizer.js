function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sumNumberArray(values) {
  if (!Array.isArray(values)) return toNumber(values, 0);
  return values.reduce((acc, value) => acc + toNumber(value, 0), 0);
}

function normalizeNumberPaxs(numberPaxs) {
  if (Array.isArray(numberPaxs)) {
    return numberPaxs.reduce((acc, value) => acc + toNumber(value, 0), 0);
  }
  return toNumber(numberPaxs, 0);
}

function normalizeServices(services = [], rootNumberPaxs = 0) {
  if (!Array.isArray(services)) return [];
  return services.map((day) => ({
    day: toNumber(day?.day, 0),
    date: day?.date || '',
    number_paxs: normalizeNumberPaxs(day?.number_paxs ?? rootNumberPaxs),
    children_ages: Array.isArray(day?.children_ages) ? day.children_ages.map((age) => toNumber(age, 0)) : [],
    isFixedLast: !!day?.isFixedLast,
    services: Array.isArray(day?.services)
      ? day.services.map((service) => ({
          city: service?.city || '',
          name_service: service?.name_service || '',
          type: service?.type || '',
          price_base: toNumber(service?.price_base, 0),
          price: sumNumberArray(service?.prices ?? service?.price),
          notes: service?.notes || '',
          service_id: service?.service_id,
          service_type: service?.service_type,
          type_service: service?.type_service,
          operator_service_id: service?.operator_service_id,
          train_service_id: service?.train_service_id
        }))
      : []
  }));
}

function normalizeHotels(hotels = []) {
  if (!Array.isArray(hotels)) return [];
  return hotels.map((hotel) => ({
    day: toNumber(hotel?.day, 0),
    date: hotel?.date || '',
    city: hotel?.city || '',
    name_hotel: hotel?.name_hotel || '',
    price_base: toNumber(hotel?.price_base, 0),
    price: sumNumberArray(hotel?.prices ?? hotel?.price),
    accomodatios_category: hotel?.accomodatios_category || '',
    notes: hotel?.notes || ''
  }));
}

function normalizeFlights(flights = []) {
  if (!Array.isArray(flights)) return [];
  return flights.map((flight) => ({
    date: flight?.date || '',
    route: flight?.route || '',
    price_conf: toNumber(flight?.price_conf, 0),
    price: sumNumberArray(flight?.prices ?? flight?.price),
    notes: flight?.notes || ''
  }));
}

function normalizeOperators(operators = []) {
  if (!Array.isArray(operators)) return [];
  return operators.map((operator) => ({
    country: operator?.country || '',
    name_operator: operator?.name_operator || '',
    city: operator?.city || '',
    price: sumNumberArray(operator?.prices ?? operator?.price),
    notes: operator?.notes || ''
  }));
}

function normalizeCruises(cruises = []) {
  if (!Array.isArray(cruises)) return [];
  return cruises.map((cruise) => ({
    name: cruise?.name || '',
    operator: cruise?.operator || '',
    price_conf: toNumber(cruise?.price_conf, 0),
    price: sumNumberArray(cruise?.prices ?? cruise?.price),
    notes: cruise?.notes || ''
  }));
}

function normalizeTotalPrices(totalPrices = {}) {
  return {
    total_hoteles: sumNumberArray(totalPrices?.total_hoteles),
    total_services: sumNumberArray(totalPrices?.total_services),
    total_cost: sumNumberArray(totalPrices?.total_cost),
    external_utility: sumNumberArray(totalPrices?.external_utility),
    cost_external_taxes: sumNumberArray(totalPrices?.cost_external_taxes),
    total_cost_external: sumNumberArray(totalPrices?.total_cost_external),
    total_ext_operator: sumNumberArray(totalPrices?.total_ext_operator),
    total_ext_cruises: sumNumberArray(totalPrices?.total_ext_cruises),
    total_flights: sumNumberArray(totalPrices?.total_flights),
    subtotal: sumNumberArray(totalPrices?.subtotal),
    cost_transfers: sumNumberArray(totalPrices?.cost_transfers),
    final_cost: sumNumberArray(totalPrices?.final_cost),
    price_pp: sumNumberArray(totalPrices?.price_pp),
    porcentajeTD: toNumber(totalPrices?.porcentajeTD, 0)
  };
}

function normalizeQuoterPayload(payload = {}) {
  const number_paxs = normalizeNumberPaxs(payload?.number_paxs);
  return {
    ...payload,
    number_paxs,
    children_ages: Array.isArray(payload?.children_ages) ? payload.children_ages.map((age) => toNumber(age, 0)) : [],
    services: normalizeServices(payload?.services, number_paxs),
    hotels: normalizeHotels(payload?.hotels),
    flights: normalizeFlights(payload?.flights),
    operators: normalizeOperators(payload?.operators),
    cruises: normalizeCruises(payload?.cruises),
    total_prices: normalizeTotalPrices(payload?.total_prices)
  };
}

module.exports = {
  normalizeQuoterPayload,
  normalizeNumberPaxs,
  normalizeTotalPrices,
  toNumber,
  sumNumberArray
};
