const QuoterV2 = require('../../infrastructure/mongoose/quoter-v2.schema');

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || 'gpt-4.1-mini';
const OPENAI_REVIEW_TIMEOUT_MS = Number(process.env.OPENAI_REVIEW_TIMEOUT_MS || 25000);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const normalized = normalizeDate(value);
  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
}

function getDayFromDate(dateValue, startDateValue) {
  const date = parseDate(dateValue);
  const startDate = parseDate(startDateValue);
  if (!date || !startDate) return null;
  const diffMs = date.getTime() - startDate.getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function includesKeyword(sourceText, keywords) {
  const haystack = normalizeString(sourceText).toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function inferServiceKind(service = {}) {
  const type = normalizeString(service.type).toLowerCase();
  const text = [service.name_service, service.notes, service.city, type].map((value) => normalizeString(value).toLowerCase()).join(' ');

  if (includesKeyword(type, ['transport', 'train']) || includesKeyword(text, ['transfer', 'pickup', 'drop off', 'dropoff', 'rail', 'train station', 'airport-hotel', 'hotel-airport'])) {
    return 'transport';
  }

  if (includesKeyword(type, ['restaurant']) || includesKeyword(text, ['lunch', 'dinner', 'breakfast', 'meal', 'restaurant'])) {
    return 'meal';
  }

  return 'service';
}

function createEmptyDay(dayNumber, dateValue = '') {
  return {
    day: dayNumber,
    date: normalizeDate(dateValue),
    cities: [],
    events: [],
    dayPax: null,
    dayChildren: [],
  };
}

function pushCity(day, city) {
  const normalized = normalizeString(city);
  if (normalized) {
    day.cities.push(normalized);
  }
}

function buildTimeline(quoter) {
  const startDate = quoter?.travelDate?.start || '';
  const dayMap = new Map();

  const ensureDay = (dayNumber, dateValue = '') => {
    const normalizedDay = Math.max(toNumber(dayNumber, 1), 1);
    if (!dayMap.has(normalizedDay)) {
      dayMap.set(normalizedDay, createEmptyDay(normalizedDay, dateValue));
    }

    const day = dayMap.get(normalizedDay);
    if (!day.date && dateValue) {
      day.date = normalizeDate(dateValue);
    }
    return day;
  };

  (quoter?.services || []).forEach((serviceDay) => {
    const day = ensureDay(serviceDay?.day, serviceDay?.date);
    day.dayPax = toNumber(serviceDay?.number_paxs, 0);
    day.dayChildren = Array.isArray(serviceDay?.children_ages) ? serviceDay.children_ages.map((value) => toNumber(value, 0)).sort((a, b) => a - b) : [];

    (serviceDay?.services || []).forEach((service) => {
      const kind = inferServiceKind(service);
      const city = normalizeString(service?.city);
      pushCity(day, city);
      day.events.push({
        kind,
        city,
        label: normalizeString(service?.name_service) || 'Service',
        notes: normalizeString(service?.notes),
      });
    });
  });

  (quoter?.hotels || []).forEach((hotel) => {
    const day = ensureDay(hotel?.day, hotel?.date);
    const city = normalizeString(hotel?.city);
    pushCity(day, city);
    day.events.push({
      kind: 'hotel',
      city,
      label: normalizeString(hotel?.name_hotel) || 'Hotel',
      notes: normalizeString(hotel?.notes),
    });
  });

  (quoter?.flights || []).forEach((flight) => {
    const derivedDay = getDayFromDate(flight?.date, startDate) || 1;
    const day = ensureDay(derivedDay, flight?.date);
    day.events.push({
      kind: 'flight',
      city: '',
      label: normalizeString(flight?.route) || 'Flight',
      notes: normalizeString(flight?.notes),
    });
  });

  (quoter?.operators || []).forEach((operator) => {
    const day = ensureDay(operator?.day || 1, operator?.date);
    const city = normalizeString(operator?.city || operator?.country);
    pushCity(day, city);
    day.events.push({
      kind: includesKeyword([operator?.name_operator, operator?.notes, city].join(' '), ['transfer', 'pickup', 'dropoff', 'drop off']) ? 'transport' : 'operator',
      city,
      label: normalizeString(operator?.name_operator) || 'Operator service',
      notes: normalizeString(operator?.notes),
    });
  });

  (quoter?.cruises || []).forEach((cruise) => {
    const day = ensureDay(cruise?.day || 1, cruise?.date);
    const city = normalizeString(cruise?.operator);
    pushCity(day, city);
    day.events.push({
      kind: 'cruise',
      city,
      label: normalizeString(cruise?.name) || 'Cruise',
      notes: normalizeString(cruise?.notes),
    });
  });

  return [...dayMap.values()]
    .sort((left, right) => left.day - right.day)
    .map((day) => ({
      ...day,
      cities: unique(day.cities),
      city_context: unique(day.cities)[0] || '',
    }));
}

function buildOpenAIReviewSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: {
        type: 'object',
        additionalProperties: false,
        properties: {
          overall_assessment: { type: 'string' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['overall_assessment', 'risk_level'],
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            title: { type: 'string' },
            description: { type: 'string' },
            evidence: {
              type: 'array',
              items: { type: 'string' },
            },
            affected_days: {
              type: 'array',
              items: { type: 'integer' },
            },
            suggestion: { type: 'string' },
          },
          required: ['id', 'type', 'severity', 'confidence', 'title', 'description', 'evidence', 'affected_days', 'suggestion'],
        },
      },
    },
    required: ['summary', 'findings'],
  };
}

function buildOpenAIInput(quoter, timeline) {
  return {
    quote: {
      guest: normalizeString(quoter?.guest),
      start_date: normalizeDate(quoter?.travelDate?.start),
      end_date: normalizeDate(quoter?.travelDate?.end),
      total_nights: normalizeString(quoter?.totalNights),
      number_paxs: toNumber(quoter?.number_paxs, 0),
      children_ages: Array.isArray(quoter?.children_ages) ? quoter.children_ages.map((value) => toNumber(value, 0)) : [],
      destinations: Array.isArray(quoter?.destinations) ? quoter.destinations.map((value) => normalizeString(value)).filter(Boolean) : [],
    },
    timeline: timeline.map((day) => ({
      day: day.day,
      date: day.date,
      city_context: day.city_context,
      cities: day.cities,
      day_pax: day.dayPax,
      day_children: day.dayChildren,
      events: day.events.map((event) => ({
        kind: event.kind,
        city: event.city,
        label: event.label,
        notes: event.notes,
      })),
    })),
    raw_sections: {
      services: quoter?.services || [],
      hotels: quoter?.hotels || [],
      flights: quoter?.flights || [],
      operators: quoter?.operators || [],
      cruises: quoter?.cruises || [],
    },
  };
}

function getResponseText(responsePayload = {}) {
  if (typeof responsePayload.output_text === 'string' && responsePayload.output_text.trim()) {
    return responsePayload.output_text;
  }

  const outputs = Array.isArray(responsePayload.output) ? responsePayload.output : [];
  const textParts = [];

  outputs.forEach((item) => {
    if (Array.isArray(item?.content)) {
      item.content.forEach((contentItem) => {
        if (contentItem?.type === 'output_text' && typeof contentItem?.text === 'string') {
          textParts.push(contentItem.text);
        }
      });
    }
  });

  return textParts.join('\n').trim();
}

function normalizeAiFindings(aiFindings = []) {
  if (!Array.isArray(aiFindings)) return [];
  return aiFindings.map((finding, index) => ({
    id: normalizeString(finding?.id) || `openai-finding-${index + 1}`,
    type: normalizeString(finding?.type) || 'ai_suggestion',
    severity: ['low', 'medium', 'high'].includes(String(finding?.severity || '').toLowerCase()) ? String(finding.severity).toLowerCase() : 'medium',
    confidence: ['low', 'medium', 'high'].includes(String(finding?.confidence || '').toLowerCase()) ? String(finding.confidence).toLowerCase() : 'medium',
    title: normalizeString(finding?.title) || 'AI review suggestion',
    description: normalizeString(finding?.description),
    evidence: Array.isArray(finding?.evidence) ? finding.evidence.map((item) => normalizeString(item)).filter(Boolean) : [],
    affected_days: Array.isArray(finding?.affected_days) ? finding.affected_days.map((day) => toNumber(day, 0)).filter((day) => day > 0) : [],
    suggestion: normalizeString(finding?.suggestion) || 'Review this area manually.',
    source: 'openai',
  }));
}

async function requestOpenAIReview(quoter, timeline) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_REVIEW_TIMEOUT_MS);
  const reviewInput = buildOpenAIInput(quoter, timeline);

  const instructions = [
    'You are a travel quote review agent.',
    'Your task is to review the quote and identify likely human omissions, logical inconsistencies, and operational gaps.',
    'Do not calculate prices and do not invent unavailable data.',
    'Use judgment to suggest probable missing transfers, suspicious city changes, night inconsistencies, child-related omissions, or missing logistical links.',
    'When evidence is incomplete, present the issue as a suggestion or probable omission, not as a confirmed error.',
    'Return only the structured JSON that matches the schema.',
  ].join(' ');

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_REVIEW_MODEL,
        instructions,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Review this travel quote context and return JSON only:\n${JSON.stringify(reviewInput)}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'quote_review_result',
            strict: true,
            schema: buildOpenAIReviewSchema(),
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.message || 'OpenAI review request failed');
      error.code = 'OPENAI_REQUEST_FAILED';
      throw error;
    }

    const outputText = getResponseText(payload);
    if (!outputText) {
      const error = new Error('OpenAI returned no output text');
      error.code = 'OPENAI_EMPTY_RESPONSE';
      throw error;
    }

    const parsed = JSON.parse(outputText);
    return {
      enabled: true,
      used: true,
      findings: normalizeAiFindings(parsed?.findings || []),
      summary: parsed?.summary || {
        overall_assessment: 'Quote reviewed by OpenAI agent.',
        risk_level: 'medium',
      },
      error: null,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('OpenAI review timed out');
      timeoutError.code = 'OPENAI_TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class QuoterV2ReviewService {
  async reviewQuote(quoterId) {
    const quoter = await QuoterV2.findById(quoterId).lean();
    if (!quoter) {
      throw new Error('QUOTER_V2_NOT_FOUND');
    }

    const timeline = buildTimeline(quoter);
    const aiReview = await requestOpenAIReview(quoter, timeline);

    return {
      quote_id: String(quoter._id),
      summary: aiReview.summary,
      findings: aiReview.findings,
      review_context: {
        timeline,
        stats: {
          services_days: Array.isArray(quoter.services) ? quoter.services.length : 0,
          hotels: Array.isArray(quoter.hotels) ? quoter.hotels.length : 0,
          flights: Array.isArray(quoter.flights) ? quoter.flights.length : 0,
          operators: Array.isArray(quoter.operators) ? quoter.operators.length : 0,
          cruises: Array.isArray(quoter.cruises) ? quoter.cruises.length : 0,
        },
        ai_review: {
          enabled: true,
          used: aiReview.used,
          model: OPENAI_REVIEW_MODEL,
          error: aiReview.error,
          summary: aiReview.summary,
        },
      },
    };
  }
}

module.exports = new QuoterV2ReviewService();
