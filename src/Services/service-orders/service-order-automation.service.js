const RECEIVABLE_ORDER_TYPES = ['PREPAYMENT', 'INVOICE'];
const PAYABLE_ORDER_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS'];
const CONFIRMED_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED'];

class ServiceOrderAutomationService {
  normalizeText(value = '') {
    return String(value || '').trim();
  }

  normalizeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  roundMoney(value) {
    return Math.round((this.normalizeNumber(value) + Number.EPSILON) * 100) / 100;
  }

  normalizeDate(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  addDays(value, days = 0) {
    const parsed = this.normalizeDate(value);
    if (!parsed) return null;
    const next = new Date(parsed);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  daysBetween(from, to) {
    const start = this.normalizeDate(from);
    const end = this.normalizeDate(to);
    if (!start || !end) return null;
    return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  isReceivableOrder(type = '') {
    return RECEIVABLE_ORDER_TYPES.includes(String(type || '').toUpperCase());
  }

  isPayableOrder(type = '') {
    return PAYABLE_ORDER_TYPES.includes(String(type || '').toUpperCase());
  }

  resolveCurrency(order = {}) {
    return this.normalizeText(
      order?.financials?.currency
      || order?.sourceSnapshot?.currency
      || order?.sourceSnapshot?.totals?.currency
      || 'USD'
    ).toUpperCase() || 'USD';
  }

  resolveTravelStart(order = {}) {
    return this.normalizeDate(
      order?.sourceSnapshot?.travelDate?.start
      || order?.sourceSnapshot?.travel_date_start
      || order?.travel_date_start
      || null
    );
  }

  resolveLineDate(order = {}) {
    return this.normalizeDate(
      order?.sourceSnapshot?.date
      || order?.sourceSnapshot?.startDate
      || order?.sourceSnapshot?.travelDate?.start
      || order?.dueDate
      || null
    );
  }

  resolveSupplierName(order = {}) {
    const type = String(order?.type || '').toUpperCase();
    const category = String(order?.sourceSnapshot?.category || '').toLowerCase();

    if (type === 'HOTEL') {
      return this.normalizeText(order?.sourceSnapshot?.name || order?.sourceSnapshot?.name_hotel);
    }
    if (type === 'TRANSPORT' && category === 'flight') {
      return this.normalizeText(order?.sourceSnapshot?.route || order?.sourceSnapshot?.name);
    }
    if (type === 'TRANSPORT') {
      return this.normalizeText(order?.sourceSnapshot?.operator || order?.sourceSnapshot?.name);
    }
    if (type === 'TOUR' && category === 'operator') {
      return this.normalizeText(order?.sourceSnapshot?.name || order?.sourceSnapshot?.name_operator);
    }
    if (type === 'TOUR') {
      return this.normalizeText(order?.sourceSnapshot?.name || order?.sourceSnapshot?.name_service);
    }
    if (type === 'TICKETS') {
      return this.normalizeText(order?.sourceSnapshot?.operator || order?.sourceSnapshot?.name);
    }
    if (type === 'PREPAYMENT') {
      return this.normalizeText(order?.sourceSnapshot?.guest) || 'Client deposit';
    }
    if (type === 'INVOICE') {
      return this.normalizeText(order?.sourceSnapshot?.guest) || 'Client final balance';
    }
    return this.normalizeText(order?.sourceSnapshot?.name);
  }

  resolveExpectedCost(order = {}) {
    return this.roundMoney(
      this.normalizeNumber(order?.sourceSnapshot?.estimatedTotal)
      || this.normalizeNumber(order?.sourceSnapshot?.price)
      || this.normalizeNumber(order?.sourceSnapshot?.priceBase)
    );
  }

  resolveSupplierReference(order = {}) {
    return this.normalizeText(
      order?.financials?.supplierReference
      || order?.reservationControl?.supplierReference
      || order?.sourceSnapshot?.reference
      || order?.sourceSnapshot?.bookingCode
      || order?.sourceSnapshot?.route
      || ''
    );
  }

  deriveReceivableSplitRatio(travelStart = null, now = new Date()) {
    const daysToTravel = travelStart ? this.daysBetween(now, travelStart) : null;
    if (daysToTravel === null) return 0.4;
    if (daysToTravel > 120) return 0.2;
    if (daysToTravel > 60) return 0.3;
    if (daysToTravel > 30) return 0.5;
    if (daysToTravel > 14) return 0.8;
    return 1;
  }

  deriveReceivableExpectedCost(type = '', soldTotal = 0, travelStart = null, now = new Date()) {
    const safeSoldTotal = this.roundMoney(soldTotal);
    const depositRatio = this.deriveReceivableSplitRatio(travelStart, now);
    const depositAmount = this.roundMoney(safeSoldTotal * depositRatio);
    const finalBalanceAmount = this.roundMoney(Math.max(safeSoldTotal - depositAmount, 0));

    if (type === 'PREPAYMENT') {
      return depositAmount;
    }

    if (type === 'INVOICE') {
      return finalBalanceAmount;
    }

    return safeSoldTotal;
  }

  shouldReplaceLegacyReceivableExpected(existing = {}, order = {}, derivedExpectedCost = 0) {
    const type = String(order?.type || '').toUpperCase();
    if (!this.isReceivableOrder(type)) return false;

    const currentExpected = this.roundMoney(this.normalizeNumber(existing.expectedCost));
    const soldTotal = this.resolveExpectedCost(order);
    const hasManualSignals = !!(
      this.normalizeText(existing.invoiceNumber)
      || this.normalizeText(existing.supplierReference)
      || existing.invoiceDate
      || existing.paymentDate
    );
    const paidAmount = this.roundMoney(this.normalizeNumber(existing.paidAmount));

    if (hasManualSignals || paidAmount > 0) {
      return false;
    }

    if (currentExpected <= 0) {
      return true;
    }

    return Math.abs(currentExpected - soldTotal) < 0.01 && Math.abs(derivedExpectedCost - soldTotal) >= 0.01;
  }

  deriveReceivableDueDate(type = '', travelStart = null, now = new Date()) {
    const daysToTravel = travelStart ? this.daysBetween(now, travelStart) : null;

    if (type === 'PREPAYMENT') {
      if (daysToTravel === null) return this.addDays(now, 3);
      return daysToTravel > 45 ? this.addDays(now, 3) : now;
    }

    if (type === 'INVOICE') {
      if (daysToTravel === null) return this.addDays(now, 7);
      return daysToTravel > 21 ? this.addDays(travelStart, -14) : now;
    }

    return null;
  }

  derivePayableDueDate(order = {}, lineDate = null, travelStart = null, now = new Date()) {
    const targetDate = lineDate || travelStart || this.normalizeDate(order?.dueDate);
    if (!targetDate) return null;

    const daysToTarget = this.daysBetween(now, targetDate);
    if (daysToTarget === null) return targetDate;
    if (daysToTarget <= 7) return now;
    if (daysToTarget <= 21) return this.addDays(targetDate, -3);
    return this.addDays(targetDate, -7);
  }

  derivePaymentStatus(expectedCost = 0, paidAmount = 0) {
    const safeExpected = this.roundMoney(expectedCost);
    const safePaid = this.roundMoney(paidAmount);

    if (safeExpected <= 0) return 'NOT_REQUIRED';
    if (safePaid <= 0) return 'PENDING';
    if (safePaid >= safeExpected) return 'PAID';
    return 'PARTIAL';
  }

  buildAutoFinancials(order = {}, options = {}) {
    const now = this.normalizeDate(options.now) || new Date();
    const travelStart = this.resolveTravelStart(order);
    const lineDate = this.resolveLineDate(order);
    const paidAmount = this.normalizeNumber(order?.financials?.paidAmount);
    const type = String(order?.type || '').toUpperCase();
    const baseExpectedCost = this.resolveExpectedCost(order);
    const expectedCost = this.isReceivableOrder(type)
      ? this.deriveReceivableExpectedCost(type, baseExpectedCost, travelStart, now)
      : baseExpectedCost;
    const paymentDueDate = this.isReceivableOrder(type)
      ? this.deriveReceivableDueDate(type, travelStart, now)
      : this.isPayableOrder(type)
        ? this.derivePayableDueDate(order, lineDate, travelStart, now)
        : this.normalizeDate(order?.dueDate);

    return {
      supplierName: this.resolveSupplierName(order),
      supplierReference: this.resolveSupplierReference(order),
      currency: this.resolveCurrency(order),
      expectedCost,
      paidAmount: this.roundMoney(paidAmount),
      paymentStatus: this.derivePaymentStatus(expectedCost, paidAmount),
      paymentMethod: this.normalizeText(order?.financials?.paymentMethod).toUpperCase() || 'OTHER',
      paymentDueDate,
      paymentDate: this.normalizeDate(order?.financials?.paymentDate),
      invoiceNumber: this.normalizeText(order?.financials?.invoiceNumber),
      invoiceDate: this.normalizeDate(order?.financials?.invoiceDate),
    };
  }

  enrichOrder(order = {}, options = {}) {
    if (!order) return null;

    const existing = order?.financials?.toObject?.() || { ...(order?.financials || {}) };
    const derived = this.buildAutoFinancials(order, options);
    const expectedCost = this.normalizeNumber(existing.expectedCost);
    const paidAmount = this.normalizeNumber(
      Object.prototype.hasOwnProperty.call(existing, 'paidAmount') ? existing.paidAmount : derived.paidAmount
    );
    const mergedExpectedCost = this.shouldReplaceLegacyReceivableExpected(existing, order, derived.expectedCost)
      ? derived.expectedCost
      : expectedCost > 0
        ? expectedCost
        : derived.expectedCost;

    return {
      ...order,
      financials: {
        ...existing,
        supplierName: this.normalizeText(existing.supplierName) || derived.supplierName,
        supplierReference: this.normalizeText(existing.supplierReference) || derived.supplierReference,
        currency: this.normalizeText(existing.currency).toUpperCase() || derived.currency,
        expectedCost: this.roundMoney(mergedExpectedCost),
        paidAmount: this.roundMoney(paidAmount),
        paymentStatus: this.normalizeText(existing.paymentStatus).toUpperCase() || this.derivePaymentStatus(mergedExpectedCost, paidAmount),
        paymentMethod: this.normalizeText(existing.paymentMethod).toUpperCase() || derived.paymentMethod,
        paymentDueDate: existing.paymentDueDate || derived.paymentDueDate || null,
        paymentDate: existing.paymentDate || derived.paymentDate || null,
        invoiceNumber: this.normalizeText(existing.invoiceNumber) || derived.invoiceNumber,
        invoiceDate: existing.invoiceDate || derived.invoiceDate || null,
      },
    };
  }

  isReservationConfirmed(order = {}) {
    return CONFIRMED_RESERVATION_STATUSES.includes(String(order?.reservationControl?.status || '').toUpperCase());
  }
}

module.exports = new ServiceOrderAutomationService();
