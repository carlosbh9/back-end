const bookingFileFinancialService = require('./booking-file-financial.service');

const CONFIRMED_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED'];
const TERMINAL_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED', 'CANCELLED'];
const DELIVERABLE_TYPES = ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS'];
const DELIVERABLE_ATTACHMENT_TYPES = ['VOUCHER', 'TICKET', 'RESERVATION_CONFIRMATION'];
const OPEN_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO'];

class BookingFilePretripReadinessService {
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

  isReservationManagedOrder(order = {}) {
    return order?.area === 'RESERVAS' || DELIVERABLE_TYPES.includes(order?.type);
  }

  normalizeReservationControl(order = {}) {
    const control = order?.reservationControl || {};
    const fallbackStatus = order?.status === 'DONE'
      ? 'CONFIRMED'
      : order?.status === 'CANCELLED'
        ? 'CANCELLED'
        : order?.status === 'WAITING_INFO'
          ? 'FAILED'
          : 'DRAFT';

    return {
      status: control.status || fallbackStatus,
      criticality: control.criticality || (order?.priority === 'URGENT' ? 'CRITICAL' : order?.priority || 'MEDIUM'),
      deadlineAt: control.deadlineAt || order?.dueDate || null,
      supplierName: control.supplierName || bookingFileFinancialService.resolveCounterparty(order) || 'Unassigned supplier',
    };
  }

  resolveOrderServiceDate(order = {}, file = {}) {
    return bookingFileFinancialService.resolveServiceDate(order, { file });
  }

  hasDeliverableEvidence(order = {}) {
    return (order.attachments || []).some((attachment) => DELIVERABLE_ATTACHMENT_TYPES.includes(attachment?.type));
  }

  deriveCheckStatus({ blocked = 0, watch = 0, ready = 0, total = 0 } = {}) {
    if (blocked > 0) return 'BLOCKED';
    if (watch > 0 || ready < total) return 'WATCH';
    return 'READY';
  }

  buildSupplierRows(orders = [], file = {}, now = new Date()) {
    const todayKey = this.toDateKey(now);
    const supplierMap = new Map();

    for (const order of orders.filter((item) => item?.status !== 'CANCELLED')) {
      const control = this.normalizeReservationControl(order);
      const supplierName = control.supplierName || 'Unassigned supplier';
      const key = supplierName.toLowerCase();
      const current = supplierMap.get(key) || {
        supplier_name: supplierName,
        orders_total: 0,
        confirmed_reservations: 0,
        unconfirmed_reservations: 0,
        blocked_orders: 0,
        overdue_orders: 0,
        pending_payments: 0,
        missing_deliverables: 0,
        status: 'READY',
      };

      const dueKey = this.toDateKey(order?.dueDate || control.deadlineAt);
      const isOpen = OPEN_ORDER_STATUSES.includes(order?.status);
      const isReservation = this.isReservationManagedOrder(order);
      const isConfirmed = CONFIRMED_RESERVATION_STATUSES.includes(control.status);
      const pendingAmount = Math.max(
        Number(order?.financials?.expectedCost || 0) - Number(order?.financials?.paidAmount || 0),
        0
      );
      const paymentPending = pendingAmount > 0 && order?.financials?.paymentStatus !== 'PAID';
      const missingDeliverable = DELIVERABLE_TYPES.includes(order?.type) && !this.hasDeliverableEvidence(order);

      current.orders_total += 1;
      current.confirmed_reservations += isReservation && isConfirmed ? 1 : 0;
      current.unconfirmed_reservations += isReservation && !TERMINAL_RESERVATION_STATUSES.includes(control.status) ? 1 : 0;
      current.blocked_orders += order?.status === 'WAITING_INFO' || control.status === 'FAILED' ? 1 : 0;
      current.overdue_orders += isOpen && dueKey && dueKey < todayKey ? 1 : 0;
      current.pending_payments += paymentPending ? 1 : 0;
      current.missing_deliverables += missingDeliverable ? 1 : 0;

      supplierMap.set(key, current);
    }

    return Array.from(supplierMap.values())
      .map((supplier) => ({
        ...supplier,
        status: supplier.blocked_orders > 0 || supplier.overdue_orders > 0
          ? 'BLOCKED'
          : supplier.unconfirmed_reservations > 0 || supplier.pending_payments > 0 || supplier.missing_deliverables > 0
            ? 'WATCH'
            : 'READY',
      }))
      .sort((left, right) => {
        const statusWeight = { BLOCKED: 0, WATCH: 1, READY: 2 };
        return statusWeight[left.status] - statusWeight[right.status]
          || right.blocked_orders - left.blocked_orders
          || right.overdue_orders - left.overdue_orders
          || left.supplier_name.localeCompare(right.supplier_name);
      });
  }

  buildChecks(file = {}, orders = [], supplierRows = [], now = new Date()) {
    const todayKey = this.toDateKey(now);
    const reservationOrders = orders.filter((order) => order?.status !== 'CANCELLED' && this.isReservationManagedOrder(order));
    const reservationControls = reservationOrders.map((order) => this.normalizeReservationControl(order));
    const confirmedReservations = reservationControls.filter((control) => CONFIRMED_RESERVATION_STATUSES.includes(control.status)).length;
    const failedReservations = reservationControls.filter((control) => control.status === 'FAILED').length;
    const overdueReservations = reservationControls.filter((control) => {
      const deadlineKey = this.toDateKey(control.deadlineAt);
      return deadlineKey && deadlineKey < todayKey && !TERMINAL_RESERVATION_STATUSES.includes(control.status);
    }).length;

    const passengerStatus = file?.passenger_info_status || {};
    const passengerReady = ['COMPLETED', 'VALIDATED'].includes(passengerStatus.status) || Number(passengerStatus.completion_percentage || 0) >= 100;
    const passengerMissing = Array.isArray(passengerStatus.missing_required_fields) ? passengerStatus.missing_required_fields.length : 0;

    const payables = file?.financial_overview?.payables || {};
    const criticalPayments = Number(payables.critical_count || 0) + Number(payables.overdue_count || 0);
    const pendingPaymentItems = Array.isArray(payables.items)
      ? payables.items.filter((item) => item?.pending_amount > 0 && item?.payment_queue !== 'CLEARED').length
      : 0;

    const deliverableOrders = orders.filter((order) => order?.status !== 'CANCELLED' && DELIVERABLE_TYPES.includes(order?.type));
    const deliverableReady = deliverableOrders.filter((order) => this.hasDeliverableEvidence(order)).length;
    const missingDeliverables = Math.max(deliverableOrders.length - deliverableReady, 0);

    const operationalDays = Array.isArray(file?.operational_itinerary?.days) ? file.operational_itinerary.days : [];
    const firstDay = operationalDays
      .filter((day) => Array.isArray(day?.items) && day.items.length)
      .sort((left, right) => (left.day || 0) - (right.day || 0))[0];
    const dayOneItems = firstDay?.items || [];
    const dayOneReady = dayOneItems.filter((item) => item?.detail?.status === 'READY').length;
    const dayOnePending = Math.max(dayOneItems.length - dayOneReady, 0);

    const incidentOverview = file?.incident_overview || {};
    const highSeverityOpenIncidents = Number(incidentOverview.critical_open || 0) + Number(incidentOverview.high_open || 0);

    return [
      {
        key: 'passengers',
        label: 'Passengers',
        status: passengerReady && passengerMissing === 0 ? 'READY' : passengerMissing > 0 ? 'BLOCKED' : 'WATCH',
        ready: passengerReady ? 1 : 0,
        total: 1,
        value: passengerReady ? 'Ready' : `${Number(passengerStatus.completion_percentage || 0)}%`,
        detail: passengerMissing ? `${passengerMissing} missing required fields` : 'Passenger data complete or not required.',
      },
      {
        key: 'reservations',
        label: 'Reservations',
        status: this.deriveCheckStatus({
          blocked: failedReservations + overdueReservations,
          watch: Math.max(reservationOrders.length - confirmedReservations, 0),
          ready: confirmedReservations,
          total: reservationOrders.length,
        }),
        ready: confirmedReservations,
        total: reservationOrders.length,
        value: `${confirmedReservations}/${reservationOrders.length}`,
        detail: failedReservations || overdueReservations
          ? `${failedReservations + overdueReservations} blocked or overdue`
          : `${Math.max(reservationOrders.length - confirmedReservations, 0)} unconfirmed`,
      },
      {
        key: 'supplier_payments',
        label: 'Supplier Payments',
        status: criticalPayments > 0 ? 'BLOCKED' : pendingPaymentItems > 0 ? 'WATCH' : 'READY',
        ready: Math.max(pendingPaymentItems - criticalPayments, 0),
        total: pendingPaymentItems,
        value: String(pendingPaymentItems),
        detail: criticalPayments ? `${criticalPayments} critical or overdue` : `${pendingPaymentItems} pending commitments`,
      },
      {
        key: 'deliverables',
        label: 'Deliverables',
        status: this.deriveCheckStatus({
          blocked: 0,
          watch: missingDeliverables,
          ready: deliverableReady,
          total: deliverableOrders.length,
        }),
        ready: deliverableReady,
        total: deliverableOrders.length,
        value: `${deliverableReady}/${deliverableOrders.length}`,
        detail: `${missingDeliverables} missing voucher, ticket or confirmation evidence`,
      },
      {
        key: 'day_one',
        label: 'Day 1 Services',
        status: this.deriveCheckStatus({
          blocked: 0,
          watch: dayOnePending,
          ready: dayOneReady,
          total: dayOneItems.length,
        }),
        ready: dayOneReady,
        total: dayOneItems.length,
        value: `${dayOneReady}/${dayOneItems.length}`,
        detail: dayOneItems.length ? `${dayOnePending} pending day 1 items` : 'Operational itinerary not generated.',
      },
      {
        key: 'incidents',
        label: 'High Severity Incidents',
        status: highSeverityOpenIncidents > 0 ? 'BLOCKED' : 'READY',
        ready: highSeverityOpenIncidents > 0 ? 0 : 1,
        total: 1,
        value: String(highSeverityOpenIncidents),
        detail: highSeverityOpenIncidents
          ? `${highSeverityOpenIncidents} high severity open incidents`
          : 'No high severity incidents detected in current file data.',
      },
      {
        key: 'suppliers',
        label: 'Supplier Control',
        status: supplierRows.some((supplier) => supplier.status === 'BLOCKED')
          ? 'BLOCKED'
          : supplierRows.some((supplier) => supplier.status === 'WATCH')
            ? 'WATCH'
            : 'READY',
        ready: supplierRows.filter((supplier) => supplier.status === 'READY').length,
        total: supplierRows.length,
        value: `${supplierRows.filter((supplier) => supplier.status === 'READY').length}/${supplierRows.length}`,
        detail: `${supplierRows.filter((supplier) => supplier.status !== 'READY').length} suppliers with open status`,
      },
    ];
  }

  calculateScore(checks = []) {
    if (!checks.length) return 0;
    const value = checks.reduce((sum, check) => {
      if (check.status === 'READY') return sum + 100;
      if (check.status === 'WATCH') return sum + 60;
      return sum + 20;
    }, 0);
    return Math.round(value / checks.length);
  }

  deriveStatus(checks = []) {
    if (checks.some((check) => check.status === 'BLOCKED')) return 'BLOCKED';
    if (checks.some((check) => check.status === 'WATCH')) return 'WATCH';
    return 'READY';
  }

  buildPretripReadiness(file = {}, serviceOrders = []) {
    const now = new Date();
    const orders = Array.isArray(serviceOrders) ? serviceOrders : [];
    const supplierRows = this.buildSupplierRows(orders, file, now);
    const checks = this.buildChecks(file, orders, supplierRows, now);
    const status = this.deriveStatus(checks);

    return {
      generated_at: now.toISOString(),
      status,
      score: this.calculateScore(checks),
      summary: {
        checks_ready: checks.filter((check) => check.status === 'READY').length,
        checks_total: checks.length,
        blocked_checks: checks.filter((check) => check.status === 'BLOCKED').length,
        watch_checks: checks.filter((check) => check.status === 'WATCH').length,
        suppliers_total: supplierRows.length,
        suppliers_blocked: supplierRows.filter((supplier) => supplier.status === 'BLOCKED').length,
        suppliers_watch: supplierRows.filter((supplier) => supplier.status === 'WATCH').length,
        open_high_severity_incidents: Number(file?.incident_overview?.critical_open || 0) + Number(file?.incident_overview?.high_open || 0),
      },
      checks,
      suppliers: supplierRows,
    };
  }

  enrichBookingFile(file = {}, serviceOrders = []) {
    if (!file) return file;
    return {
      ...file,
      pretrip_readiness: this.buildPretripReadiness(file, serviceOrders),
    };
  }
}

module.exports = new BookingFilePretripReadinessService();
