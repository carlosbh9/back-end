const { randomUUID } = require('crypto');

function normalizeDestinations(input) {
  if (Array.isArray(input)) {
    const list = input.map((x) => String(x || '').trim()).filter(Boolean);
    return list.length ? list : ['Destination'];
  }

  if (typeof input === 'string') {
    const list = input.split(',').map((x) => x.trim()).filter(Boolean);
    return list.length ? list : ['Destination'];
  }

  return ['Destination'];
}

function buildPriceDescription(base, price) {
  const values = [];
  if (typeof base === 'number') values.push(`Base: $${base}`);
  if (typeof price === 'number') values.push(`Quote: $${price}`);
  return values.join(' · ');
}

function defaultImage(type) {
  const images = {
    activity: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=700&fit=crop',
    hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=700&fit=crop',
    transfer: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&h=700&fit=crop',
    flight: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&h=700&fit=crop',
  };

  return images[type] || images.activity;
}

function dateFromDayNumber(startDate, dayNumber, dateValue) {
  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const value = new Date(startDate);
  value.setDate(value.getDate() + Math.max(0, dayNumber - 1));
  return value;
}

function getDayNumberFromDate(dateValue, startDate) {
  if (!dateValue) return null;

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.floor((parsed.getTime() - startDate.getTime()) / msPerDay) + 1);
}

function ensureDay(dayMap, dayNumber, dateValue, destinations, startDate) {
  if (dayMap.has(dayNumber)) {
    return dayMap.get(dayNumber);
  }

  const dayDate = dateFromDayNumber(startDate, dayNumber, dateValue);
  const location = destinations[Math.min(dayNumber - 1, destinations.length - 1)] || 'Destination';

  const day = {
    dayNumber,
    location,
    date: dayDate,
    items: [],
  };

  dayMap.set(dayNumber, day);
  return day;
}

function buildLockedItem(seed, type, data) {
  return {
    id: `${seed}-${randomUUID().slice(0, 8)}`,
    type,
    title: data.title,
    description: data.description || '',
    location: data.location || '',
    image: data.image || defaultImage(type),
    time: data.time || '',
    notes: data.notes || '',
    order: data.order || 0,
    status: 'confirmed',
    isOptional: false,
    isLocked: true,
  };
}

function mapQuoterToItinerary(quoter) {
  const startDate = new Date(quoter?.travelDate?.start || new Date());
  const endDate = new Date(quoter?.travelDate?.end || quoter?.travelDate?.start || new Date());
  const destinations = normalizeDestinations(quoter?.destinations);

  const dayMap = new Map();

  (quoter?.services || []).forEach((block) => {
    const dayNumber = Number(block?.day) || 1;
    const day = ensureDay(dayMap, dayNumber, block?.date, destinations, startDate);

    (block?.services || []).forEach((service) => {
      const item = buildLockedItem(`svc-${dayNumber}`, 'activity', {
        title: service?.name_service || 'Service',
        description: buildPriceDescription(service?.price_base, service?.price),
        location: service?.city || day.location,
        notes: service?.notes || '',
        order: day.items.length,
      });

      day.items.push(item);
    });
  });

  (quoter?.hotels || []).forEach((hotel) => {
    const dayNumber = Number(hotel?.day) || 1;
    const day = ensureDay(dayMap, dayNumber, hotel?.date, destinations, startDate);

    const item = buildLockedItem(`hotel-${dayNumber}`, 'hotel', {
      title: hotel?.name_hotel || 'Hotel',
      location: hotel?.city || day.location,
      notes: hotel?.notes || '',
      order: day.items.length,
    });

    day.items.push(item);
  });

  (quoter?.flights || []).forEach((flight) => {
    const dayNumber = Number(flight?.day) || getDayNumberFromDate(flight?.date, startDate) || 1;
    const day = ensureDay(dayMap, dayNumber, flight?.date, destinations, startDate);

    const item = buildLockedItem(`flight-${dayNumber}`, 'flight', {
      title: flight?.route || 'Flight',
      description: buildPriceDescription(flight?.price_base ?? flight?.price_conf, flight?.price),
      location: flight?.route || day.location,
      notes: flight?.notes || '',
      order: day.items.length,
    });

    day.items.push(item);
  });

  (quoter?.operators || []).forEach((operator) => {
    const dayNumber = Number(operator?.day) || 1;
    const day = ensureDay(dayMap, dayNumber, undefined, destinations, startDate);

    const item = buildLockedItem(`operator-${dayNumber}`, 'activity', {
      title: operator?.name_operator || 'Operator Service',
      description: buildPriceDescription(undefined, operator?.price),
      location: operator?.city || operator?.country || day.location,
      notes: operator?.notes || '',
      order: day.items.length,
    });

    day.items.push(item);
  });

  (quoter?.cruises || []).forEach((cruise) => {
    const dayNumber = Number(cruise?.day) || 1;
    const day = ensureDay(dayMap, dayNumber, undefined, destinations, startDate);

    const item = buildLockedItem(`cruise-${dayNumber}`, 'activity', {
      title: cruise?.name || 'Cruise',
      description: buildPriceDescription(cruise?.price_base ?? cruise?.price_conf, cruise?.price),
      location: cruise?.operator || day.location,
      notes: cruise?.notes || '',
      order: day.items.length,
    });

    day.items.push(item);
  });

  const days = [...dayMap.values()].sort((a, b) => a.dayNumber - b.dayNumber);

  return {
    tripName: quoter?.name_quoter || 'Travel Itinerary',
    client: quoter?.guest || 'Guest',
    startDate,
    endDate,
    destinations,
    days,
    status: 'draft',
    versions: [],
    currentVersion: 'v1',
  };
}

module.exports = {
  mapQuoterToItinerary,
};
