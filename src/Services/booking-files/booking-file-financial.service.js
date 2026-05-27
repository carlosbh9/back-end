const RECEIVABLE_ORDER_TYPES = ['PREPAYMENT', 'INVOICE'];
const PAYABLE_ORDER_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS'];
const CONFIRMED_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED'];
const SOON_WINDOW_DAYS = 7;
const serviceOrderAutomationService = require('../service-orders/service-order-automation.service');
const PAYABLE_QUEUE_ORDER = ['PAY_NOW', 'READY_TO_PAY', 'WAIT_CONFIRMATION', 'MONITOR', 'CLEARED'];

class BookingFileFinancialService {
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

  toDateKey(value) {
    const parsed = this.normalizeDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : '';
  }

  daysBetween(from, to) {
    const start = this.normalizeDate(from);
    const end = this.normalizeDate(to);
    if (!start || !end) return null;
    return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  pickFirstNumber(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 0;
  }

  resolveCurrency(file = {}, orders = []) {
    const orderCurrency = orders.find((order) => String(order?.financials?.currency || '').trim())?.financials?.currency;
    return String(
      orderCurrency
      || file?.sales_snapshot?.currency
      || file?.itinerary_snapshot?.currency
      || 'USD'
    ).trim().toUpperCase();
  }

  getSoldTotal(file = {}) {
    return this.roundMoney(this.pickFirstNumber(
      file?.sales_snapshot?.total_prices?.final_cost,
      file?.sales_snapshot?.final_cost,
      file?.itinerary_snapshot?.total_prices?.final_cost
    ));
  }

  getPricePerPerson(file = {}) {
    return this.roundMoney(this.pickFirstNumber(
      file?.sales_snapshot?.total_prices?.price_pp,
      file?.sales_snapshot?.price_pp,
      file?.itinerary_snapshot?.total_prices?.price_pp
    ));
  }

  resolvePayableProjectedAmount(order = {}) {
    return this.roundMoney(this.pickFirstNumber(
      order?.financials?.expectedCost,
      order?.sourceSnapshot?.estimatedTotal,
      order?.sourceSnapshot?.price,
      order?.sourceSnapshot?.price_base
    ));
  }

  resolveOriginalAmount(order = {}) {
    return this.roundMoney(this.pickFirstNumber(
      order?.sourceSnapshot?.estimatedTotal,
      order?.sourceSnapshot?.price,
      order?.sourceSnapshot?.price_base
    ));
  }

  resolvePaidAmount(order = {}) {
    return this.roundMoney(this.normalizeNumber(order?.financials?.paidAmount));
  }

  resolveOrderLabel(order = {}) {
    return String(
      order?.sourceSnapshot?.name
      || order?.sourceSnapshot?.name_service
      || order?.sourceSnapshot?.name_hotel
      || order?.sourceSnapshot?.name_operator
      || order?.sourceSnapshot?.route
      || order?.workflowTemplateName
      || order?.type
      || 'Order'
    ).trim();
  }

  resolveCounterparty(order = {}) {
    return String(
      order?.financials?.supplierName
      || order?.reservationControl?.supplierName
      || order?.sourceSnapshot?.operator
      || order?.sourceSnapshot?.name_operator
      || order?.sourceSnapshot?.supplier
      || order?.sourceSnapshot?.name_hotel
      || ''
    ).trim();
  }

  resolveReference(order = {}) {
    return String(
      order?.financials?.invoiceNumber
      || order?.financials?.supplierReference
      || order?.reservationControl?.supplierReference
      || order?.sourceSnapshot?.reference
      || order?.sourceSnapshot?.bookingCode
      || ''
    ).trim();
  }

  resolveDueDate(order = {}) {
    return order?.financials?.paymentDueDate || order?.dueDate || null;
  }

  resolveAuditActor(audit = {}) {
    if (!audit?.by) return '';
    if (typeof audit.by === 'string') return audit.by;
    return String(audit.by?._id || audit.by || '').trim();
  }

  resolveServiceDate(order = {}, context = {}) {
    return order?.sourceSnapshot?.date
      || order?.sourceSnapshot?.travelDate?.start
      || context.file?.travel_date_start
      || null;
  }

  isReceivableOrder(order = {}) {
    return RECEIVABLE_ORDER_TYPES.includes(order?.type);
  }

  isPayableOrder(order = {}) {
    return PAYABLE_ORDER_TYPES.includes(order?.type);
  }

  allocateReceivableExpectedAmounts(orders = [], soldTotal = 0) {
    const allocations = new Map();
    let remaining = this.roundMoney(soldTotal);
    const unspecified = [];

    for (const order of orders) {
      const explicitAmount = this.roundMoney(this.normalizeNumber(order?.financials?.expectedCost));
      if (explicitAmount > 0) {
        allocations.set(String(order?._id || ''), explicitAmount);
        remaining = this.roundMoney(Math.max(remaining - explicitAmount, 0));
      } else {
        unspecified.push(order);
      }
    }

    for (const order of unspecified) {
      const orderId = String(order?._id || '');
      const paidAmount = this.resolvePaidAmount(order);
      if (paidAmount > 0 && remaining > 0) {
        const assigned = Math.min(remaining, paidAmount);
        allocations.set(orderId, this.roundMoney(assigned));
        remaining = this.roundMoney(Math.max(remaining - assigned, 0));
      }
    }

    const primaryFallback = unspecified.find((order) => order?.type === 'INVOICE') || unspecified[0] || null;
    if (primaryFallback && remaining > 0) {
      const orderId = String(primaryFallback?._id || '');
      allocations.set(orderId, this.roundMoney((allocations.get(orderId) || 0) + remaining));
      remaining = 0;
    }

    for (const order of unspecified) {
      const orderId = String(order?._id || '');
      if (!allocations.has(orderId)) {
        allocations.set(orderId, 0);
      }
    }

    return allocations;
  }

  isCommittedPayable(order = {}) {
    const paymentStatus = order?.financials?.paymentStatus;
    const accountingStatus = order?.accountingStatus;
    const reservationStatus = order?.reservationControl?.status;

    return order?.status === 'DONE'
      || paymentStatus === 'PARTIAL'
      || paymentStatus === 'PAID'
      || ['INVOICED', 'PARTIALLY_PAID', 'PAID'].includes(accountingStatus)
      || CONFIRMED_RESERVATION_STATUSES.includes(reservationStatus);
  }

  buildReceivableItem(order = {}, expectedAmount = 0, context = {}) {
    const collectedAmount = this.resolvePaidAmount(order);
    const pendingAmount = this.roundMoney(Math.max(expectedAmount - collectedAmount, 0));
    const dueDate = this.resolveDueDate(order);
    const dueDateKey = this.toDateKey(dueDate);
    const isOverdue = !!(pendingAmount > 0 && dueDateKey && dueDateKey < context.todayKey);
    const daysToDue = dueDate ? this.daysBetween(context.now, dueDate) : null;

    return {
      order_id: String(order?._id || ''),
      type: order?.type || 'INVOICE',
      label: this.resolveOrderLabel(order),
      customer_label: String(context.file?.guest || context.file?.contact_id?.name || '').trim(),
      expected_amount: expectedAmount,
      collected_amount: collectedAmount,
      pending_amount: pendingAmount,
      due_date: dueDate,
      payment_date: order?.financials?.paymentDate || null,
      payment_status: order?.financials?.paymentStatus || 'NOT_REQUIRED',
      accounting_status: order?.accountingStatus || 'NOT_REQUIRED',
      reference: this.resolveReference(order),
      overdue: isOverdue,
      due_soon: !!(pendingAmount > 0 && daysToDue !== null && daysToDue >= 0 && daysToDue <= SOON_WINDOW_DAYS),
      days_to_due: daysToDue,
      source_status: order?.status || 'PENDING',
    };
  }

  buildPayableItem(order = {}, context = {}) {
    const projectedAmount = this.resolvePayableProjectedAmount(order);
    const paidAmount = this.resolvePaidAmount(order);
    const pendingAmount = this.roundMoney(Math.max(projectedAmount - paidAmount, 0));
    const dueDate = this.resolveDueDate(order);
    const serviceDate = this.resolveServiceDate(order, context);
    const dueDateKey = this.toDateKey(dueDate);
    const isCommitted = this.isCommittedPayable(order);
    const isOverdue = !!(pendingAmount > 0 && dueDateKey && dueDateKey < context.todayKey);
    const daysToDue = dueDate ? this.daysBetween(context.now, dueDate) : null;
    const daysToService = serviceDate ? this.daysBetween(context.now, serviceDate) : null;
    const daysToTravel = context.travelStart ? this.daysBetween(context.now, context.travelStart) : null;
    const prepaymentRequired = !!(
      pendingAmount > 0
      && dueDateKey
      && context.travelStartKey
      && dueDateKey <= context.travelStartKey
      && (daysToTravel === null || daysToTravel <= 30)
    );
    const paymentQueue = this.derivePayableQueue({
      pendingAmount,
      isOverdue,
      isCommitted,
      prepaymentRequired,
      daysToDue,
      daysToService,
      order,
    });
    const paymentPriority = this.derivePayablePriority({
      paymentQueue,
      daysToDue,
      daysToService,
      prepaymentRequired,
    });
    const automationReason = this.derivePayableAutomationReason({
      paymentQueue,
      order,
      isOverdue,
      isCommitted,
      prepaymentRequired,
      daysToDue,
      daysToService,
    });

    return {
      order_id: String(order?._id || ''),
      type: order?.type || 'OTHER',
      label: this.resolveOrderLabel(order),
      supplier_name: this.resolveCounterparty(order),
      projected_amount: projectedAmount,
      confirmed_amount: isCommitted ? projectedAmount : 0,
      paid_amount: paidAmount,
      pending_amount: pendingAmount,
      due_date: dueDate,
      service_date: serviceDate,
      payment_date: order?.financials?.paymentDate || null,
      payment_status: order?.financials?.paymentStatus || 'NOT_REQUIRED',
      accounting_status: order?.accountingStatus || 'NOT_REQUIRED',
      reservation_status: order?.reservationControl?.status || '',
      reference: this.resolveReference(order),
      overdue: isOverdue,
      due_soon: !!(pendingAmount > 0 && daysToDue !== null && daysToDue >= 0 && daysToDue <= SOON_WINDOW_DAYS),
      days_to_due: daysToDue,
      days_to_service: daysToService,
      is_committed: isCommitted,
      prepayment_required: prepaymentRequired,
      payment_queue: paymentQueue,
      payment_priority: paymentPriority,
      automation_reason: automationReason,
      source_status: order?.status || 'PENDING',
    };
  }

  derivePayableQueue({ pendingAmount = 0, isOverdue = false, isCommitted = false, prepaymentRequired = false, daysToDue = null, daysToService = null, order = {} } = {}) {
    if (pendingAmount <= 0) return 'CLEARED';
    if (isOverdue) return 'PAY_NOW';
    if (prepaymentRequired && (daysToDue === null || daysToDue <= 1)) return 'PAY_NOW';
    if (isCommitted && daysToService !== null && daysToService <= 2) return 'PAY_NOW';
    if (isCommitted && (prepaymentRequired || (daysToDue !== null && daysToDue <= 3) || (daysToService !== null && daysToService <= 7))) {
      return 'READY_TO_PAY';
    }
    if (!isCommitted && ((daysToDue !== null && daysToDue <= 3) || (daysToService !== null && daysToService <= 7) || String(order?.reservationControl?.status || '').toUpperCase() === 'OPTIONED')) {
      return 'WAIT_CONFIRMATION';
    }
    return 'MONITOR';
  }

  derivePayablePriority({ paymentQueue = 'MONITOR', daysToDue = null, daysToService = null, prepaymentRequired = false } = {}) {
    if (paymentQueue === 'PAY_NOW') return 'CRITICAL';
    if (paymentQueue === 'READY_TO_PAY' && (prepaymentRequired || (daysToDue !== null && daysToDue <= 1) || (daysToService !== null && daysToService <= 3))) {
      return 'HIGH';
    }
    if (paymentQueue === 'READY_TO_PAY' || paymentQueue === 'WAIT_CONFIRMATION') return 'MEDIUM';
    if (paymentQueue === 'CLEARED') return 'LOW';
    return 'LOW';
  }

  derivePayableAutomationReason({ paymentQueue = 'MONITOR', order = {}, isOverdue = false, isCommitted = false, prepaymentRequired = false, daysToDue = null, daysToService = null } = {}) {
    if (paymentQueue === 'CLEARED') {
      return 'Supplier commitment is already fully paid.';
    }
    if (isOverdue) {
      return 'Payment due date already passed and the supplier balance is still open.';
    }
    if (paymentQueue === 'PAY_NOW' && prepaymentRequired) {
      return 'Supplier prepayment is now critical based on due date and travel proximity.';
    }
    if (paymentQueue === 'PAY_NOW' && isCommitted && daysToService !== null && daysToService <= 2) {
      return 'Supplier cost is committed and the service date is imminent.';
    }
    if (paymentQueue === 'READY_TO_PAY' && isCommitted) {
      return 'Reservation or workflow is sufficiently committed, so payment can move without waiting for extra input.';
    }
    if (paymentQueue === 'WAIT_CONFIRMATION') {
      const reservationStatus = String(order?.reservationControl?.status || '').toUpperCase() || 'PENDING';
      return `Keep this under follow-up first because supplier confirmation is still not solid enough (${reservationStatus}).`;
    }
    if (daysToDue !== null && daysToDue > 3) {
      return 'Supplier payment is still under monitoring and does not require immediate action.';
    }
    return 'Supplier payment is tracked automatically and should be reviewed as the trip gets closer.';
  }

  buildDeviationItem(order = {}) {
    const originalAmount = this.resolveOriginalAmount(order);
    const currentAmount = this.resolvePayableProjectedAmount(order);
    const delta = this.roundMoney(currentAmount - originalAmount);
    const percentDelta = originalAmount > 0
      ? this.roundMoney((delta / originalAmount) * 100)
      : 0;

    return {
      order_id: String(order?._id || ''),
      type: order?.type || 'OTHER',
      label: this.resolveOrderLabel(order),
      supplier_name: this.resolveCounterparty(order),
      original_amount: originalAmount,
      current_amount: currentAmount,
      delta_amount: delta,
      delta_percentage: percentDelta,
      source_status: order?.status || 'PENDING',
      reference: this.resolveReference(order),
      has_deviation: Math.abs(delta) >= 0.01,
    };
  }

  buildAdjustmentItem(order = {}, audit = {}) {
    const summary = audit?.payload?.summary || {};
    const previous = audit?.payload?.previous || {};
    const next = audit?.payload?.next || {};
    const type = String(summary.adjustmentType || 'FINANCIAL_UPDATE').toUpperCase();
    const deltaAmount = this.roundMoney(
      this.normalizeNumber(summary.expectedCostDelta)
      || (this.normalizeNumber(next.expectedCost) - this.normalizeNumber(previous.expectedCost))
    );
    const paidDelta = this.roundMoney(
      this.normalizeNumber(summary.paidAmountDelta)
      || (this.normalizeNumber(next.paidAmount) - this.normalizeNumber(previous.paidAmount))
    );
    const marginImpact = this.roundMoney(
      this.normalizeNumber(summary.marginImpactDelta)
      || (deltaAmount * -1)
    );

    return {
      adjustment_id: `${String(order?._id || 'order')}-${String(audit?.at || Date.now())}-${type}`,
      order_id: String(order?._id || ''),
      type,
      label: this.resolveOrderLabel(order),
      supplier_name: this.resolveCounterparty(order),
      previous_amount: this.roundMoney(this.normalizeNumber(previous.expectedCost)),
      next_amount: this.roundMoney(this.normalizeNumber(next.expectedCost)),
      delta_amount: deltaAmount,
      paid_delta_amount: paidDelta,
      margin_impact: marginImpact,
      changed_fields: Array.isArray(summary.changedFields) ? summary.changedFields : [],
      reference: this.resolveReference(order),
      occurred_at: audit?.at || null,
      actor_id: this.resolveAuditActor(audit),
      notes: audit?.message || '',
    };
  }

  buildAdjustments(orders = []) {
    const items = [];

    for (const order of orders) {
      for (const audit of order.auditLogs || []) {
        if (audit?.action !== 'FINANCIALS_UPDATED') continue;
        items.push(this.buildAdjustmentItem(order, audit));
      }
    }

    const sortedItems = items
      .filter((item) => item.changed_fields.length || item.delta_amount !== 0 || item.paid_delta_amount !== 0 || item.notes)
      .sort((left, right) => {
        const dateLeft = this.normalizeDate(left.occurred_at)?.getTime() || 0;
        const dateRight = this.normalizeDate(right.occurred_at)?.getTime() || 0;
        return dateRight - dateLeft;
      });

    return {
      total_events: sortedItems.length,
      overcost_total: this.roundMoney(sortedItems.filter((item) => item.type === 'OVERCOST').reduce((sum, item) => sum + Math.max(item.delta_amount, 0), 0)),
      discount_total: this.roundMoney(sortedItems.filter((item) => item.type === 'DISCOUNT').reduce((sum, item) => sum + Math.abs(item.delta_amount), 0)),
      net_margin_impact: this.roundMoney(sortedItems.reduce((sum, item) => sum + item.margin_impact, 0)),
      items: sortedItems,
    };
  }

  buildAlerts({ totals, receivables, payables, deviations, now, travelStart }) {
    const alerts = [];
    const daysToTravel = travelStart ? this.daysBetween(now, travelStart) : null;
    const marginDrop = this.roundMoney(totals.estimated_margin - totals.updated_margin);

    if (receivables.overdue_count > 0) {
      alerts.push({
        code: 'receivable_overdue',
        tone: 'rose',
        label: 'Overdue collections',
        message: `${receivables.overdue_count} receivable item(s) are overdue and still pending collection.`,
      });
    }

    if (payables.overdue_count > 0) {
      alerts.push({
        code: 'payable_overdue',
        tone: 'amber',
        label: 'Overdue supplier payments',
        message: `${payables.overdue_count} payable commitment(s) are overdue and still pending payment.`,
      });
    }

    if (payables.critical_count > 0) {
      alerts.push({
        code: 'payable_critical_queue',
        tone: 'rose',
        label: 'Critical supplier payment queue',
        message: `${payables.critical_count} supplier payment(s) should move now based on urgency, commitment, and service timing.`,
      });
    }

    if (payables.wait_confirmation_count > 0 && daysToTravel !== null && daysToTravel <= 10) {
      alerts.push({
        code: 'payable_waiting_confirmation_close_to_travel',
        tone: 'amber',
        label: 'Supplier payments still waiting for confirmation',
        message: `${payables.wait_confirmation_count} payable item(s) are close enough to travel that confirmation should be resolved soon.`,
      });
    }

    if (totals.updated_margin < 0) {
      alerts.push({
        code: 'negative_margin',
        tone: 'rose',
        label: 'Negative updated margin',
        message: 'Current confirmed supplier cost is already above the sold total for this file.',
      });
    } else if (marginDrop > 0 && totals.sold_total > 0 && marginDrop / totals.sold_total >= 0.1) {
      alerts.push({
        code: 'margin_deviation',
        tone: 'amber',
        label: 'Margin deviation detected',
        message: 'Updated margin dropped materially versus the estimated margin and needs review.',
      });
    }

    if (totals.client_balance > 0 && daysToTravel !== null && daysToTravel <= SOON_WINDOW_DAYS) {
      alerts.push({
        code: 'client_balance_close_to_travel',
        tone: 'blue',
        label: 'Open client balance close to travel',
        message: 'The file still has pending collections even though travel is near.',
      });
    }

    if (totals.supplier_balance > 0 && daysToTravel !== null && daysToTravel <= SOON_WINDOW_DAYS) {
      alerts.push({
        code: 'supplier_balance_close_to_travel',
        tone: 'amber',
        label: 'Open supplier balance close to travel',
        message: 'Critical supplier commitments are still pending close to travel date.',
      });
    }

    if (deviations.total_items > 0 && deviations.net_delta > 0) {
      alerts.push({
        code: 'cost_deviation',
        tone: 'violet',
        label: 'Cost deviations vs sold snapshot',
        message: `${deviations.total_items} payable item(s) moved away from the sold snapshot, impacting margin visibility.`,
      });
    }

    return alerts;
  }

  buildEmptyOverview(file = {}, currency = 'USD') {
    const soldTotal = this.getSoldTotal(file);
    const pricePerPerson = this.getPricePerPerson(file);

    return {
      generated_at: new Date(),
      currency,
      quote: {
        sold_total: soldTotal,
        price_per_person: pricePerPerson,
        passenger_count: this.normalizeNumber(file?.pax_summary?.number_paxs),
        travel_date_start: file?.travel_date_start || null,
        travel_date_end: file?.travel_date_end || null,
      },
      totals: {
        sold_total: soldTotal,
        projected_cost_total: 0,
        confirmed_cost_total: 0,
        collected_total: 0,
        paid_total: 0,
        client_balance: soldTotal,
        supplier_balance: 0,
        estimated_margin: soldTotal,
        updated_margin: soldTotal,
        estimated_margin_pct: soldTotal > 0 ? 100 : 0,
        updated_margin_pct: soldTotal > 0 ? 100 : 0,
      },
      receivables: {
        total_expected: 0,
        total_collected: 0,
        total_pending: 0,
        overdue_count: 0,
        due_soon_count: 0,
        items: [],
      },
      payables: {
        total_projected: 0,
        total_confirmed: 0,
        total_paid: 0,
        total_pending: 0,
        overdue_count: 0,
        due_soon_count: 0,
        prepayment_required_count: 0,
        critical_count: 0,
        ready_to_pay_count: 0,
        wait_confirmation_count: 0,
        monitor_count: 0,
        items: [],
      },
      deviations: {
        total_items: 0,
        positive_delta_total: 0,
        negative_delta_total: 0,
        net_delta: 0,
        items: [],
      },
      adjustments: {
        total_events: 0,
        overcost_total: 0,
        discount_total: 0,
        net_margin_impact: 0,
        items: [],
      },
      alerts: soldTotal > 0 ? [{
        code: 'financial_orders_missing',
        tone: 'slate',
        label: 'Financial control still thin',
        message: 'The sold amount exists, but there are no financial service orders to track collections or supplier commitments yet.',
      }] : [],
    };
  }

  async buildFinancialOverview(file = {}, orders = []) {
    const now = new Date();
    const normalizedOrders = Array.isArray(orders)
      ? orders.map((order) => serviceOrderAutomationService.enrichOrder(order, { now }))
      : [];
    const travelStart = this.normalizeDate(file?.travel_date_start);
    const context = {
      now,
      todayKey: this.toDateKey(now),
      travelStart,
      travelStartKey: this.toDateKey(travelStart),
      file,
    };
    const currency = this.resolveCurrency(file, normalizedOrders);
    const soldTotal = this.getSoldTotal(file);
    const pricePerPerson = this.getPricePerPerson(file);

    if (!normalizedOrders.length) {
      return this.buildEmptyOverview(file, currency);
    }

    const receivableItems = normalizedOrders
      .filter((order) => this.isReceivableOrder(order));
    const receivableAllocations = this.allocateReceivableExpectedAmounts(receivableItems, soldTotal);
    const receivableLines = receivableItems
      .map((order) => this.buildReceivableItem(order, receivableAllocations.get(String(order?._id || '')) || 0, context));

    const payableItems = normalizedOrders
      .filter((order) => this.isPayableOrder(order))
      .map((order) => this.buildPayableItem(order, context));

    const deviationItems = payableItems
      .map((item) => {
        const order = normalizedOrders.find((candidate) => String(candidate?._id || '') === item.order_id);
        return this.buildDeviationItem(order);
      })
      .filter((item) => item.has_deviation);

    const totals = {
      sold_total: soldTotal,
      projected_cost_total: this.roundMoney(payableItems.reduce((sum, item) => sum + item.projected_amount, 0)),
      confirmed_cost_total: this.roundMoney(payableItems.reduce((sum, item) => sum + item.confirmed_amount, 0)),
      collected_total: this.roundMoney(receivableLines.reduce((sum, item) => sum + item.collected_amount, 0)),
      paid_total: this.roundMoney(payableItems.reduce((sum, item) => sum + item.paid_amount, 0)),
    };

    totals.client_balance = this.roundMoney(Math.max(totals.sold_total - totals.collected_total, 0));
    totals.supplier_balance = this.roundMoney(Math.max(totals.projected_cost_total - totals.paid_total, 0));
    totals.estimated_margin = this.roundMoney(totals.sold_total - totals.projected_cost_total);
    totals.updated_margin = this.roundMoney(totals.sold_total - totals.confirmed_cost_total);
    totals.estimated_margin_pct = totals.sold_total > 0
      ? this.roundMoney((totals.estimated_margin / totals.sold_total) * 100)
      : 0;
    totals.updated_margin_pct = totals.sold_total > 0
      ? this.roundMoney((totals.updated_margin / totals.sold_total) * 100)
      : 0;

    const receivables = {
      total_expected: this.roundMoney(receivableLines.reduce((sum, item) => sum + item.expected_amount, 0)),
      total_collected: totals.collected_total,
      total_pending: this.roundMoney(receivableLines.reduce((sum, item) => sum + item.pending_amount, 0)),
      overdue_count: receivableLines.filter((item) => item.overdue).length,
      due_soon_count: receivableLines.filter((item) => item.due_soon).length,
      items: receivableLines,
    };

    const payables = {
      total_projected: totals.projected_cost_total,
      total_confirmed: totals.confirmed_cost_total,
      total_paid: totals.paid_total,
      total_pending: this.roundMoney(payableItems.reduce((sum, item) => sum + item.pending_amount, 0)),
      overdue_count: payableItems.filter((item) => item.overdue).length,
      due_soon_count: payableItems.filter((item) => item.due_soon).length,
      prepayment_required_count: payableItems.filter((item) => item.prepayment_required).length,
      critical_count: payableItems.filter((item) => item.payment_queue === 'PAY_NOW').length,
      ready_to_pay_count: payableItems.filter((item) => item.payment_queue === 'READY_TO_PAY').length,
      wait_confirmation_count: payableItems.filter((item) => item.payment_queue === 'WAIT_CONFIRMATION').length,
      monitor_count: payableItems.filter((item) => item.payment_queue === 'MONITOR').length,
      items: payableItems.sort((left, right) => {
        const queueDelta = PAYABLE_QUEUE_ORDER.indexOf(left.payment_queue) - PAYABLE_QUEUE_ORDER.indexOf(right.payment_queue);
        if (queueDelta !== 0) return queueDelta;
        const dueLeft = this.normalizeDate(left.due_date)?.getTime() || Number.MAX_SAFE_INTEGER;
        const dueRight = this.normalizeDate(right.due_date)?.getTime() || Number.MAX_SAFE_INTEGER;
        return dueLeft - dueRight;
      }),
    };

    const deviations = {
      total_items: deviationItems.length,
      positive_delta_total: this.roundMoney(deviationItems.filter((item) => item.delta_amount > 0).reduce((sum, item) => sum + item.delta_amount, 0)),
      negative_delta_total: this.roundMoney(deviationItems.filter((item) => item.delta_amount < 0).reduce((sum, item) => sum + item.delta_amount, 0)),
      net_delta: this.roundMoney(deviationItems.reduce((sum, item) => sum + item.delta_amount, 0)),
      items: deviationItems,
    };
    const adjustments = this.buildAdjustments(normalizedOrders);

    return {
      generated_at: now,
      currency,
      quote: {
        sold_total: soldTotal,
        price_per_person: pricePerPerson,
        passenger_count: this.normalizeNumber(file?.pax_summary?.number_paxs),
        travel_date_start: file?.travel_date_start || null,
        travel_date_end: file?.travel_date_end || null,
      },
      totals,
      receivables,
      payables,
      deviations,
      adjustments,
      alerts: this.buildAlerts({ totals, receivables, payables, deviations, now, travelStart }),
    };
  }

  async enrichBookingFile(file = {}, orders = []) {
    if (!file) {
      return null;
    }

    return {
      ...file,
      financial_overview: await this.buildFinancialOverview(file, orders),
    };
  }
}

module.exports = new BookingFileFinancialService();
