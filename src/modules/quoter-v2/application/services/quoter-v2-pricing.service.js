const mongoose = require('mongoose');
const TariffItemV2 = require('../../../tariff-v2/infrastructure/mongoose/tariff-item-v2.schema');
const MasterQuoterV2 = require('../../../master-quoter-v2/infrastructure/mongoose/master-quoter-v2.schema');
const { DEFAULT_SEASON } = require('../../domain/quoter-v2.types');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateString(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function ensureDateWithinValidity(pricingDate, validity = {}) {
  const normalizedDate = normalizeDateString(pricingDate);
  if (!normalizedDate) return;
  const validityYear = String(validity.year || '').trim();
  if (validityYear && normalizedDate.slice(0, 4) !== validityYear) {
    throw new Error(`Tariff is only valid for year ${validityYear}`);
  }

  if (validity.dateFrom) {
    const from = normalizeDateString(validity.dateFrom);
    if (from && normalizedDate < from) {
      throw new Error(`Tariff is not valid before ${from}`);
    }
  }

  if (validity.dateTo) {
    const to = normalizeDateString(validity.dateTo);
    if (to && normalizedDate > to) {
      throw new Error(`Tariff is not valid after ${to}`);
    }
  }
}

function addDays(dateString, daysToAdd) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function countAdults(numberPaxs, childrenAges) {
  return Math.max(toNumber(numberPaxs) - (childrenAges || []).length, 0);
}

function findChildPolicyPrice(basePrice, age, childPolicies = []) {
  const policy = childPolicies.find((item) => {
    const minAge = item.minAge ?? null;
    const maxAge = item.maxAge ?? null;
    const minOk = minAge === null || age >= minAge;
    const maxOk = maxAge === null || age <= maxAge;
    return minOk && maxOk;
  });
  if (!policy) return basePrice;
  if (policy.priceType === 'FIXED') return toNumber(policy.value);
  if (policy.priceType === 'PER_PERSON') return toNumber(policy.value);
  if (policy.priceType === 'DISCOUNT_PERCENT') return Math.max(basePrice - (basePrice * toNumber(policy.value) / 100), 0);
  return basePrice;
}
function buildChildPricingSummary(basePrice, childrenAges = [], childPolicies = [], overrideChildUnit = null) {
  const details = childrenAges.map((age) => {
    const unitPrice = overrideChildUnit !== null && overrideChildUnit !== undefined
      ? toNumber(overrideChildUnit, 0)
      : findChildPolicyPrice(basePrice, age, childPolicies);
    return {
      age,
      unitPrice: Math.max(toNumber(unitPrice, 0), 0),
    };
  });
  return {
    details,
    count: details.filter((item) => item.unitPrice > 0).length,
    total: details.reduce((sum, item) => sum + item.unitPrice, 0),
  };
}
function shouldSplitKidsLine(tariffItem) {
  return tariffItem?.type === 'ENTRANCE' || tariffItem?.category === 'ENTRANCE';
}
function resolveSpecialDateAmount(baseAmount, pricingDate, validity = {}, alerts = []) {
  if (!pricingDate) return baseAmount;

  const normalizedDate = normalizeDateString(pricingDate);
  const closingRule = (validity.closingDates || []).find((item) => normalizeDateString(item.date) === normalizedDate);
  if (closingRule) {
    throw new Error(closingRule.note || `Tariff is closed for ${normalizedDate}`);
  }

  const specialRule = (validity.specialDates || []).find((item) => normalizeDateString(item.date) === normalizedDate);
  if (!specialRule) return baseAmount;

  if (specialRule.operation === 'CLOSE') {
    throw new Error(specialRule.note || `Tariff is closed for ${normalizedDate}`);
  }

  if (specialRule.note) {
    alerts.push(specialRule.note);
  }

  if (specialRule.operation === 'REPLACE') {
    return toNumber(specialRule.value, baseAmount);
  }

  if (specialRule.operation === 'ADD') {
    return baseAmount + toNumber(specialRule.value, 0);
  }

  return baseAmount;
}

function sortCandidateRanges(left, right, numberPaxs) {
  const leftOverflow = toNumber(left.maxPax) - numberPaxs;
  const rightOverflow = toNumber(right.maxPax) - numberPaxs;

  if (leftOverflow !== rightOverflow) {
    return leftOverflow - rightOverflow;
  }

  if (toNumber(left.maxPax) !== toNumber(right.maxPax)) {
    return toNumber(left.maxPax) - toNumber(right.maxPax);
  }

  if (toNumber(left.minPax) !== toNumber(right.minPax)) {
    return toNumber(right.minPax) - toNumber(left.minPax);
  }

  return toNumber(left.price) - toNumber(right.price);
}

function pickRange(pricing, numberPaxs, vehicleType) {
  const ranges = Array.isArray(pricing.ranges) ? pricing.ranges : [];
  const matchingRanges = ranges.filter((item) => numberPaxs >= item.minPax && numberPaxs <= item.maxPax);

  if (!matchingRanges.length) {
    return null;
  }

  if (vehicleType) {
    return matchingRanges.find((item) => item.vehicleType === vehicleType) || null;
  }

  const sortedCandidates = [...matchingRanges].sort((left, right) => sortCandidateRanges(left, right, numberPaxs));
  return sortedCandidates[0] || null;
}

function requiresVehicleSelection(pricing = {}) {
  const vehicleRates = Array.isArray(pricing.vehicleRates) ? pricing.vehicleRates : [];
  const distinctVehicleTypes = [...new Set(vehicleRates.map((item) => item.vehicleType).filter(Boolean))];
  return distinctVehicleTypes.length > 1;
}

function getOccupancyCapacity(occupancy) {
  if (occupancy === 'TRP') return 3;
  if (occupancy === 'DWB') return 2;
  return 1;
}

function calculateRoomPrice(pricing, numberPaxs, roomRateType) {
  const rooms = Array.isArray(pricing.rooms) ? pricing.rooms : [];
  const rates = rooms.flatMap((room) =>
    (room.occupancyRates || []).map((occupancyRate) => ({
      roomName: room.roomName,
      occupancy: occupancyRate.occupancy,
      rate: toNumber(occupancyRate[roomRateType] ?? occupancyRate.confidential),
      capacity: getOccupancyCapacity(occupancyRate.occupancy),
    }))
  );
  if (!rates.length) {
    throw new Error('No room rates configured');
  }

  const maxCapacity = Math.max(...rates.map((item) => item.capacity));
  const target = Math.max(numberPaxs, 1);
  const limit = target + maxCapacity;
  const dp = Array(limit + 1).fill(Number.POSITIVE_INFINITY);
  dp[0] = 0;

  for (let pax = 1; pax <= limit; pax++) {
    rates.forEach((rate) => {
      const previous = Math.max(pax - rate.capacity, 0);
      dp[pax] = Math.min(dp[pax], dp[previous] + rate.rate);
    });
  }

  const best = dp.slice(target).reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(best)) {
    throw new Error(`No room combination available for ${numberPaxs} pax`);
  }

  return best;
}

function findExplicitRoomRate(pricing, roomName, occupancy, roomRateType) {
  const room = (pricing.rooms || []).find((item) => item.roomName === roomName);
  if (!room) {
    throw new Error(`Room ${roomName} is not configured`);
  }

  const occupancyRate = (room.occupancyRates || []).find((item) => item.occupancy === occupancy);
  if (!occupancyRate) {
    throw new Error(`Occupancy ${occupancy} is not configured for room ${roomName}`);
  }

  return {
    roomName,
    occupancy,
    capacity: getOccupancyCapacity(occupancy),
    rate: toNumber(occupancyRate[roomRateType] ?? occupancyRate.confidential),
  };
}

function calculateTariffPricing(tariffItem, context) {
  const alerts = [];
  const pricingMeta = {
    auto_vehicle_type: '',
    alerts: [],
    child_pricing: {
      has_children: false,
      split_kids_line: false,
      child_count: 0,
      child_total: 0,
    },
  };
  const numberPaxs = Math.max(toNumber(context.number_paxs), 0);
  const childrenAges = Array.isArray(context.children_ages) ? context.children_ages.map((age) => toNumber(age, 0)) : [];
  const adults = countAdults(numberPaxs, childrenAges);
  const pricingDate = context.date || '';
  const roomRateType = context.roomRateType === 'rack' ? 'rack' : 'confidential';
  const vehicleType = context.vehicleType || '';
  const guideCount = Math.max(toNumber(context.guideCount, context.includeGuide ? 1 : 0), 0);
  const pricing = tariffItem.pricing || {};

  let priceBase = toNumber(pricing.basePrice, 0);
  let price = 0;
  let childPricing = { count: 0, total: 0, details: [] };

  ensureDateWithinValidity(pricingDate, tariffItem.validity);

  if (pricing.mode === 'PER_PERSON') {
    const baseUnit = numberPaxs === 1 && pricing.soloTravelerPrice !== null && pricing.soloTravelerPrice !== undefined
      ? toNumber(pricing.soloTravelerPrice, 0)
      : toNumber(pricing.basePrice, 0);
    priceBase = resolveSpecialDateAmount(baseUnit, pricingDate, tariffItem.validity, alerts);
    childPricing = buildChildPricingSummary(priceBase, childrenAges, tariffItem.childPolicies);
    price = adults * priceBase + childPricing.total;
  } else if (pricing.mode === 'PER_GROUP') {
    const baseGroupPrice = numberPaxs === 1 && pricing.soloTravelerPrice !== null && pricing.soloTravelerPrice !== undefined
      ? toNumber(pricing.soloTravelerPrice, 0)
      : toNumber(pricing.basePrice, 0);
    priceBase = resolveSpecialDateAmount(baseGroupPrice, pricingDate, tariffItem.validity, alerts);
    price = priceBase;
  } else if (pricing.mode === 'PER_PAX_RANGE') {
    const range = pickRange(pricing, numberPaxs, vehicleType);
    if (!range) {
      throw new Error(`No pax range configured for ${tariffItem.name} and ${numberPaxs} pax`);
    }
    priceBase = resolveSpecialDateAmount(toNumber(range.price, 0), pricingDate, tariffItem.validity, alerts);
    if (range.vehicleType) {
      pricingMeta.auto_vehicle_type = range.vehicleType;
      alerts.push(`Vehicle selected automatically: ${range.vehicleType}`);
    }
    price = pricing.pricePerson ? priceBase * numberPaxs : priceBase;
  } else if (pricing.mode === 'PER_ROOM') {
    if (context.roomName || context.occupancy) {
      if (!context.roomName || !context.occupancy) {
        throw new Error('roomName and occupancy are required together for explicit hotel pricing');
      }
      const explicitRate = findExplicitRoomRate(pricing, context.roomName, context.occupancy, roomRateType);
      const roomCount = Math.max(toNumber(context.roomCount, 1), 1);
      priceBase = explicitRate.rate;
      price = explicitRate.rate * roomCount;
    } else {
      priceBase = calculateRoomPrice(pricing, 1, roomRateType);
      price = calculateRoomPrice(pricing, numberPaxs, roomRateType);
    }
  } else if (pricing.mode === 'PER_SEASON') {
    const requestedSeason = context.season || DEFAULT_SEASON;
    const season = (pricing.seasons || []).find((item) => item.season === requestedSeason) || pricing.seasons?.[0];
    if (!season) {
      throw new Error(`No season rates configured for ${tariffItem.name}`);
    }
    priceBase = resolveSpecialDateAmount(toNumber(season.adultPrice, 0), pricingDate, tariffItem.validity, alerts);
    const childUnit = season.childPrice ?? null;
    childPricing = buildChildPricingSummary(priceBase, childrenAges, tariffItem.childPolicies, childUnit);
    const guideTotal = guideCount > 0 ? toNumber(season.guidePrice, 0) * guideCount : 0;
    price = adults * priceBase + childPricing.total + guideTotal;
  } else if (pricing.mode === 'CUSTOM') {
    if (Array.isArray(pricing.vehicleRates) && pricing.vehicleRates.length > 0) {
      if (!vehicleType && requiresVehicleSelection(pricing)) {
        throw new Error(`vehicleType is required for ${tariffItem.name}`);
      }
      const vehicleRate = pricing.vehicleRates.find((item) => !vehicleType || item.vehicleType === vehicleType);
      if (!vehicleRate) {
        throw new Error(`No vehicle rate configured for ${tariffItem.name}${vehicleType ? ` and ${vehicleType}` : ''}`);
      }
      priceBase = resolveSpecialDateAmount(toNumber(vehicleRate.price, 0), pricingDate, tariffItem.validity, alerts);
      price = priceBase;
    } else {
      const customBase = pricing.custom?.basePrice ?? pricing.custom?.price ?? pricing.basePrice;
      priceBase = resolveSpecialDateAmount(toNumber(customBase, 0), pricingDate, tariffItem.validity, alerts);
      price = priceBase;
    }
  } else {
    throw new Error(`Unsupported pricing mode ${pricing.mode}`);
  }

  const splitKidsLine = shouldSplitKidsLine(tariffItem) && childPricing.total > 0;
  if (splitKidsLine) {
    price = Math.max(price - childPricing.total, 0);
    alerts.push('Child pricing moved to separate ' + tariffItem.name + ' KIDS line');
  }
  pricingMeta.alerts = [...alerts];
  pricingMeta.child_pricing = {
    has_children: childrenAges.length > 0,
    split_kids_line: splitKidsLine,
    child_count: childPricing.count,
    child_total: childPricing.total,
  };
  return {
    price_base: priceBase,
    price,
    alerts,
    pricing_meta: pricingMeta,
    child_line: splitKidsLine
      ? {
          price_base: childPricing.total,
          price: childPricing.total,
          child_count: childPricing.count,
        }
      : null,
  };
}

function buildEmptyQuotePayload(context) {
  return {
    guest: context.guest || '',
    name_quoter: context.name_quoter || '',
    travelDate: {
      start: context.travelDateStart || '',
      end: context.travelDateEnd || '',
    },
    destinations: context.destinations || [],
    accomodations: context.accomodations || '',
    totalNights: context.totalNights || '',
    number_paxs: Math.max(toNumber(context.number_paxs), 0),
    children_ages: Array.isArray(context.children_ages) ? context.children_ages.map((age) => toNumber(age, 0)) : [],
    travel_agent: context.travel_agent || '',
    exchange_rate: context.exchange_rate || '',
    services: [],
    hotels: [],
    flights: [],
    operators: [],
    cruises: [],
    total_prices: {
      total_cost: 0,
      external_utility: 0,
      cost_external_taxes: 0,
      total_cost_external: 0,
      total_hoteles: 0,
      total_services: 0,
      total_ext_operator: 0,
      total_ext_cruises: 0,
      total_flights: 0,
      subtotal: 0,
      cost_transfers: 0,
      final_cost: 0,
      price_pp: 0,
      porcentajeTD: toNumber(context.porcentajeTD, 0),
    },
    alerts: [],
  };
}

function ensureServiceDay(payload, dayNumber, date, numberPaxs, childrenAges) {
  let day = payload.services.find((item) => item.day === dayNumber);
  if (!day) {
    day = {
      day: dayNumber,
      date: date || '',
      number_paxs: numberPaxs,
      children_ages: childrenAges,
      isFixedLast: false,
      services: [],
    };
    payload.services.push(day);
  }
  return day;
}

function buildTotals(payload) {
  payload.total_prices.total_hoteles = payload.hotels.reduce((sum, item) => sum + toNumber(item.price), 0);
  payload.total_prices.total_services = payload.services.reduce(
    (sum, day) => sum + day.services.reduce((daySum, item) => daySum + toNumber(item.price), 0),
    0,
  );
  payload.total_prices.total_ext_operator = payload.operators.reduce((sum, item) => sum + toNumber(item.price), 0);
  payload.total_prices.total_ext_cruises = payload.cruises.reduce((sum, item) => sum + toNumber(item.price), 0);
  payload.total_prices.total_flights = payload.flights.reduce((sum, item) => sum + toNumber(item.price), 0);

  payload.total_prices.total_cost = payload.total_prices.total_hoteles + payload.total_prices.total_services;
  payload.total_prices.external_utility = payload.total_prices.external_utility || 0;
  payload.total_prices.cost_external_taxes = (payload.total_prices.total_cost + payload.total_prices.external_utility) * 0.15;
  payload.total_prices.total_cost_external =
    payload.total_prices.total_cost + payload.total_prices.external_utility + payload.total_prices.cost_external_taxes;
  payload.total_prices.subtotal =
    payload.total_prices.total_cost_external +
    payload.total_prices.total_ext_operator +
    payload.total_prices.total_ext_cruises +
    payload.total_prices.total_flights;
  payload.total_prices.cost_transfers = payload.total_prices.subtotal * 0.04;
  payload.total_prices.final_cost = payload.total_prices.subtotal + payload.total_prices.cost_transfers;
  payload.total_prices.price_pp = payload.number_paxs > 0 ? payload.total_prices.final_cost / payload.number_paxs : 0;

  payload.services.sort((left, right) => left.day - right.day);
  payload.hotels.sort((left, right) => left.day - right.day);
  return payload;
}

function mapTariffItemToQuoteSection(payload, source, tariffItem, pricingResult, context) {
  const commonDate = context.itemDate || '';
  const commonNotes = source.notes || tariffItem.notes || '';
  if (tariffItem.type === 'HOTEL') {
    payload.hotels.push({
      day: source.dayNumber,
      date: commonDate,
      city: source.city || tariffItem.city || '',
      name_hotel: source.title || tariffItem.name,
      price_base: pricingResult.price_base,
      price: pricingResult.price,
      accomodatios_category: tariffItem.subtype || tariffItem.category || '',
      notes: commonNotes,
      tariff_item_id: tariffItem._id,
      placement: source.placement,
    });
    return;
  }
  const day = ensureServiceDay(payload, source.dayNumber, commonDate, payload.number_paxs, payload.children_ages);
  const serviceCity = source.city || tariffItem.city || '';
  const serviceName = source.title || tariffItem.name;
  const defaultPricingMeta = {
    auto_vehicle_type: '',
    alerts: [],
    child_pricing: {
      has_children: false,
      split_kids_line: false,
      child_count: 0,
      child_total: 0,
    },
  };
  if (pricingResult.price > 0 || !pricingResult.child_line) {
    day.services.push({
      city: serviceCity,
      name_service: serviceName,
      type: tariffItem.type,
      price_base: pricingResult.price_base,
      price: pricingResult.price,
      notes: commonNotes,
      tariff_item_id: tariffItem._id,
      placement: source.placement,
      pricing_meta: pricingResult.pricing_meta || defaultPricingMeta,
    });
  }
  if (pricingResult.child_line) {
    day.services.push({
      city: serviceCity,
      name_service: serviceName + ' KIDS',
      type: tariffItem.type,
      price_base: pricingResult.child_line.price_base,
      price: pricingResult.child_line.price,
      notes: commonNotes,
      tariff_item_id: tariffItem._id,
      placement: source.placement,
      pricing_meta: {
        ...(pricingResult.pricing_meta || defaultPricingMeta),
        child_pricing: {
          ...((pricingResult.pricing_meta || defaultPricingMeta).child_pricing || {}),
          generated_kids_line: true,
        },
      },
    });
  }
}
class QuoterV2PricingService {
  async calculatePrices(payload = {}) {
    const quotePayload = buildEmptyQuotePayload(payload);
    const items = await this.resolveItems(payload);

    for (const sourceItem of items) {
      const pricingResult = calculateTariffPricing(sourceItem.tariffItem, {
        number_paxs: quotePayload.number_paxs,
        children_ages: quotePayload.children_ages,
        date: sourceItem.itemDate,
        roomRateType: payload.roomRateType,
        vehicleType: payload.vehicleType,
        season: payload.season,
      });

      quotePayload.alerts.push(...pricingResult.alerts);
      mapTariffItemToQuoteSection(quotePayload, sourceItem, sourceItem.tariffItem, pricingResult, { itemDate: sourceItem.itemDate });
    }

    return buildTotals(quotePayload);
  }

  async resolveItems(payload = {}) {
    if (payload.masterQuoterId) {
      return this.resolveItemsFromMasterQuoter(payload);
    }

    if (Array.isArray(payload.items) && payload.items.length > 0) {
      return this.resolveAdhocItems(payload.items, payload.travelDateStart);
    }

    throw new Error('masterQuoterId or items is required');
  }

  async resolveItemsFromMasterQuoter(payload = {}) {
    if (!mongoose.Types.ObjectId.isValid(payload.masterQuoterId)) {
      throw new Error('masterQuoterId is invalid');
    }

    const master = await MasterQuoterV2.findById(payload.masterQuoterId).lean();
    if (!master) {
      throw new Error('Master Quoter V2 not found');
    }

    const selectedDays = Array.isArray(payload.dayNumbers) && payload.dayNumbers.length > 0
      ? new Set(payload.dayNumbers.map((value) => toNumber(value)))
      : null;
    const selectedPlacements = Array.isArray(payload.placements) && payload.placements.length > 0
      ? new Set(payload.placements)
      : null;

    const tariffIds = master.days.flatMap((day) =>
      (day.items || [])
        .filter((item) => (!selectedDays || selectedDays.has(day.dayNumber)) && (!selectedPlacements || selectedPlacements.has(item.placement)))
        .map((item) => String(item.tariffItemId))
    );

    const tariffs = await TariffItemV2.find({ _id: { $in: tariffIds } }).lean();
    const tariffsMap = new Map(tariffs.map((item) => [String(item._id), item]));

    return master.days
      .filter((day) => !selectedDays || selectedDays.has(day.dayNumber))
      .sort((left, right) => left.dayNumber - right.dayNumber)
      .flatMap((day) =>
        (day.items || [])
          .filter((item) => !selectedPlacements || selectedPlacements.has(item.placement))
          .sort((left, right) => toNumber(left.itemOrder) - toNumber(right.itemOrder))
          .map((item) => {
            const tariffItem = tariffsMap.get(String(item.tariffItemId));
            if (!tariffItem) {
              throw new Error(`Tariff item ${item.tariffItemId} not found`);
            }

            return {
              placement: item.placement,
              title: item.title,
              notes: item.notes,
              city: day.city || tariffItem.city || '',
              dayNumber: day.dayNumber,
              itemDate: addDays(payload.travelDateStart, day.dayNumber - 1),
              tariffItem,
            };
          })
      );
  }

  async resolveAdhocItems(items = [], travelDateStart = '') {
    const validIds = items
      .map((item) => item.tariffItemId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const tariffs = await TariffItemV2.find({ _id: { $in: validIds } }).lean();
    const tariffsMap = new Map(tariffs.map((item) => [String(item._id), item]));

    return items.map((item) => {
      const tariffItem = tariffsMap.get(String(item.tariffItemId));
      if (!tariffItem) {
        throw new Error(`Tariff item ${item.tariffItemId} not found`);
      }

      return {
        placement: item.placement || 'services',
        title: item.title,
        notes: item.notes,
        city: item.city || tariffItem.city || '',
        dayNumber: toNumber(item.dayNumber, 1),
        itemDate: item.date || addDays(travelDateStart, toNumber(item.dayNumber, 1) - 1),
        tariffItem,
      };
    });
  }
}

module.exports = new QuoterV2PricingService();
