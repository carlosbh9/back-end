function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDay(value) {
  const number = toNumber(value);
  return number >= 0 ? number : 0;
}

function normalizeDate(value = '') {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function compareTime(a = '', b = '') {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function buildDetail() {
  return {
    status: 'PENDING',
    start_time: '',
    end_time: '',
    pickup_time: '',
    meeting_point: '',
    responsible_name: '',
    supplier_name: '',
    supplier_contact: '',
    applies_to_mode: 'ALL_PAX',
    applies_to_refs: [],
    notes: '',
    completed_at: null,
    completed_by: null,
    updated_at: null
  };
}

function pushItem(dayBuckets, day, date, city, item) {
  const key = `${day}::${date || ''}`;
  const current = dayBuckets.get(key) || {
    day,
    date: date || '',
    city: city || '',
    status: 'PENDING',
    items: []
  };

  if (!current.city && city) {
    current.city = city;
  }

  current.items.push(item);
  dayBuckets.set(key, current);
}

function buildFromServices(snapshot = {}, dayBuckets) {
  (snapshot.services || []).forEach((group, groupIndex) => {
    const day = normalizeDay(group?.day);
    const date = normalizeDate(group?.date || '');
    const groupCity = group?.city || '';

    (group?.services || []).forEach((service, lineIndex) => {
      pushItem(dayBuckets, day, date, service?.city || groupCity, {
        item_id: `service-${groupIndex}-${lineIndex}`,
        source_section: 'services',
        source_ref_id: String(service?.tariff_item_id || ''),
        item_type: service?.type === 'EXPEDITION' || service?.type === 'EXPERIENCE' ? 'EXPERIENCE' : 'SERVICE',
        title: service?.name_service || 'Unnamed service',
        subtitle: [service?.placement, service?.type].filter(Boolean).join(' | '),
        city: service?.city || groupCity || '',
        sort_time: '',
        detail: buildDetail()
      });
    });
  });
}

function buildFromHotels(snapshot = {}, dayBuckets) {
  (snapshot.hotels || []).forEach((hotel, index) => {
    const day = normalizeDay(hotel?.day);
    const date = normalizeDate(hotel?.date || '');
    pushItem(dayBuckets, day, date, hotel?.city || '', {
      item_id: `hotel-${index}`,
      source_section: 'hotels',
      source_ref_id: String(hotel?.tariff_item_id || ''),
      item_type: 'HOTEL',
      title: hotel?.name_hotel || 'Unnamed hotel',
      subtitle: hotel?.accomodatios_category || '',
      city: hotel?.city || '',
      sort_time: '',
      detail: buildDetail()
    });
  });
}

function buildFromFlights(snapshot = {}, dayBuckets) {
  (snapshot.flights || []).forEach((flight, index) => {
    const date = normalizeDate(flight?.date || '');
    pushItem(dayBuckets, 0, date, '', {
      item_id: `flight-${index}`,
      source_section: 'flights',
      source_ref_id: String(flight?._id || ''),
      item_type: 'FLIGHT',
      title: flight?.route || 'Unnamed flight',
      subtitle: flight?.notes || '',
      city: '',
      sort_time: String(flight?.hour || ''),
      detail: {
        ...buildDetail(),
        start_time: String(flight?.hour || '')
      }
    });
  });
}

function buildFromOperators(snapshot = {}, dayBuckets) {
  (snapshot.operators || []).forEach((operator, index) => {
    const day = normalizeDay(operator?.day);
    const date = normalizeDate(operator?.date || '');
    pushItem(dayBuckets, day, date, operator?.city || '', {
      item_id: `operator-${index}`,
      source_section: 'operators',
      source_ref_id: String(operator?._id || ''),
      item_type: 'OPERATOR',
      title: operator?.name_operator || 'Unnamed operator',
      subtitle: [operator?.country, operator?.notes].filter(Boolean).join(' | '),
      city: operator?.city || '',
      sort_time: '',
      detail: buildDetail()
    });
  });
}

function buildFromCruises(snapshot = {}, dayBuckets) {
  (snapshot.cruises || []).forEach((cruise, index) => {
    const day = normalizeDay(cruise?.day);
    const date = normalizeDate(cruise?.date || '');
    pushItem(dayBuckets, day, date, '', {
      item_id: `cruise-${index}`,
      source_section: 'cruises',
      source_ref_id: String(cruise?._id || ''),
      item_type: 'CRUISE',
      title: cruise?.name || 'Unnamed cruise',
      subtitle: [cruise?.operator, cruise?.notes].filter(Boolean).join(' | '),
      city: '',
      sort_time: '',
      detail: buildDetail()
    });
  });
}

function summarizeDay(day) {
  const total = day.items.length;
  const ready = day.items.filter((item) => item.detail?.status === 'READY').length;
  const inProgress = day.items.filter((item) => item.detail?.status === 'IN_PROGRESS').length;
  if (!total) return { ...day, status: 'PENDING' };
  if (ready === total) return { ...day, status: 'READY' };
  if (ready > 0 || inProgress > 0) return { ...day, status: 'IN_PROGRESS' };
  return { ...day, status: 'PENDING' };
}

function summarizeOperationalItinerary(itinerary = {}, updatedBy = null) {
  const days = Array.isArray(itinerary.days) ? itinerary.days.map((day) => {
    const items = Array.isArray(day.items) ? [...day.items].sort((left, right) => compareTime(left.sort_time || left.detail?.start_time || '', right.sort_time || right.detail?.start_time || '') || left.title.localeCompare(right.title)) : [];
    return summarizeDay({
      ...day,
      items
    });
  }) : [];

  const totalItems = days.reduce((sum, day) => sum + day.items.length, 0);
  const readyItems = days.reduce((sum, day) => sum + day.items.filter((item) => item.detail?.status === 'READY').length, 0);

  return {
    generated_from_snapshot_at: itinerary.generated_from_snapshot_at || new Date(),
    updated_at: new Date(),
    updated_by: updatedBy || itinerary.updated_by || null,
    completion_percentage: totalItems ? Math.round((readyItems / totalItems) * 100) : 0,
    days
  };
}

function buildOperationalItineraryFromSnapshot(snapshot = {}, updatedBy = null) {
  const dayBuckets = new Map();

  buildFromServices(snapshot, dayBuckets);
  buildFromHotels(snapshot, dayBuckets);
  buildFromFlights(snapshot, dayBuckets);
  buildFromOperators(snapshot, dayBuckets);
  buildFromCruises(snapshot, dayBuckets);

  const days = Array.from(dayBuckets.values())
    .map((day) => ({
      ...day,
      items: [...day.items].sort((left, right) => compareTime(left.sort_time, right.sort_time) || left.title.localeCompare(right.title))
    }))
    .sort((left, right) => {
      if (left.day !== right.day) return left.day - right.day;
      return (left.date || '').localeCompare(right.date || '');
    })
    .map((day) => summarizeDay(day));

  return summarizeOperationalItinerary({
    generated_from_snapshot_at: new Date(),
    updated_at: new Date(),
    updated_by: updatedBy || null,
    days
  }, updatedBy);
}

function updateOperationalItineraryItem(itinerary = {}, itemId, payload = {}, updatedBy = null) {
  if (!itemId) {
    throw new Error('itemId is required');
  }

  let found = false;
  const days = Array.isArray(itinerary.days) ? itinerary.days.map((day) => {
    const items = Array.isArray(day.items) ? day.items.map((item) => {
      if (item.item_id !== itemId) {
        return item;
      }

      found = true;
      const nextDetail = {
        ...(item.detail || buildDetail()),
        ...(payload.detail || {})
      };

      if (payload.sort_time !== undefined) {
        item.sort_time = String(payload.sort_time || '');
      } else if (nextDetail.start_time !== undefined) {
        item.sort_time = String(nextDetail.start_time || '');
      }

      if (payload.city !== undefined) {
        item.city = String(payload.city || '');
      }
      if (payload.title !== undefined) {
        item.title = String(payload.title || item.title || '');
      }
      if (payload.subtitle !== undefined) {
        item.subtitle = String(payload.subtitle || '');
      }

      nextDetail.updated_at = new Date();
      if (nextDetail.status === 'READY' && !nextDetail.completed_at) {
        nextDetail.completed_at = new Date();
      }
      if (nextDetail.status !== 'READY') {
        nextDetail.completed_at = null;
        nextDetail.completed_by = null;
      } else if (updatedBy) {
        nextDetail.completed_by = updatedBy;
      }

      return {
        ...item,
        detail: nextDetail
      };
    }) : [];

    return {
      ...day,
      items
    };
  }) : [];

  if (!found) {
    throw new Error(`Operational itinerary item not found: ${itemId}`);
  }

  return summarizeOperationalItinerary({
    ...itinerary,
    days
  }, updatedBy);
}

module.exports = {
  buildOperationalItineraryFromSnapshot,
  summarizeOperationalItinerary,
  updateOperationalItineraryItem
};
