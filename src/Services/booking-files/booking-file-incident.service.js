const bookingFileFinancialService = require('./booking-file-financial.service');

const CONFIRMED_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED'];
const TERMINAL_RESERVATION_STATUSES = ['CONFIRMED', 'RECONFIRMED', 'CANCELLED'];

class BookingFileIncidentService {
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

  resolveOrderLabel(order = {}) {
    return bookingFileFinancialService.resolveOrderLabel(order);
  }

  resolveSupplier(order = {}) {
    return bookingFileFinancialService.resolveCounterparty(order) || order?.reservationControl?.supplierName || '';
  }

  normalizeReservationControl(order = {}) {
    const control = order?.reservationControl || {};
    const fallbackStatus = order?.status === 'DONE'
        ? 'CONFIRMED'
        : order?.status === 'CANCELLED'
          ? 'CANCELLED'
          : order?.status === 'IN_PROGRESS'
            ? 'REQUESTED'
            : 'DRAFT';

    return {
      status: control.status || fallbackStatus,
      criticality: control.criticality || (order?.priority === 'URGENT' ? 'CRITICAL' : order?.priority || 'MEDIUM'),
      deadlineAt: control.deadlineAt || order?.dueDate || null,
    };
  }

  isReservationManagedOrder(order = {}) {
    return order?.area === 'RESERVAS' || ['HOTEL', 'TRANSPORT', 'TOUR', 'TICKETS'].includes(order?.type);
  }

  deriveSeverity({ order = {}, dueDate = null, travelStart = null, criticality = '' } = {}) {
    const daysToDue = dueDate ? this.daysBetween(new Date(), dueDate) : null;
    const daysToTravel = travelStart ? this.daysBetween(new Date(), travelStart) : null;
    const priority = String(order?.priority || '').toUpperCase();
    const normalizedCriticality = String(criticality || '').toUpperCase();

    if (
      priority === 'URGENT'
      || normalizedCriticality === 'CRITICAL'
      || (daysToDue !== null && daysToDue < 0)
      || (daysToTravel !== null && daysToTravel <= 2)
    ) {
      return 'CRITICAL';
    }

    if (
      priority === 'HIGH'
      || normalizedCriticality === 'HIGH'
      || (daysToDue !== null && daysToDue <= 1)
      || (daysToTravel !== null && daysToTravel <= 7)
    ) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  buildIncident({
    file = {},
    order = {},
    type,
    severity,
    impactType,
    title,
    description,
    detectedAt = null,
    sourceStatus = '',
  }) {
    const createdAt = this.normalizeDate(detectedAt || order?.updatedAt || order?.createdAt || new Date()) || new Date();
    const incidentId = `AUTO:${type}:${String(order?._id || title || '').replace(/\s+/g, '_')}`;

    return {
      incident_id: incidentId,
      source: 'AUTOMATIC',
      incident: title,
      description,
      severity,
      impact_type: impactType,
      file_id: String(file?._id || order?.file_id || ''),
      file_code: file?.fileCode || '',
      service_order_id: order?._id ? String(order._id) : '',
      passenger_ref: '',
      supplier_name: this.resolveSupplier(order),
      internal_owner_id: order?.assigneeId ? String(order.assigneeId) : '',
      action_taken: '',
      associated_cost: 0,
      currency: order?.financials?.currency || file?.financial_overview?.currency || 'USD',
      resolution_status: 'OPEN',
      detected_at: createdAt.toISOString(),
      closed_at: null,
      source_status: sourceStatus || order?.status || '',
      age_days: Math.max(this.daysBetween(createdAt, new Date()) || 0, 0),
    };
  }

  buildOrderBlockIncidents(file = {}, orders = []) {
    return orders
      .filter((order) => order?.status === 'WAITING_INFO')
      .map((order) => this.buildIncident({
        file,
        order,
        type: 'ORDER_BLOCKED',
        severity: this.deriveSeverity({ order, dueDate: order?.dueDate, travelStart: file?.travel_date_start }),
        impactType: 'SERVICE_EXECUTION',
        title: `Blocked order: ${this.resolveOrderLabel(order)}`,
        description: 'Service order is waiting for information and cannot progress with current status.',
        detectedAt: order?.lastStatusChangeAt || order?.updatedAt,
        sourceStatus: order?.status,
      }));
  }

  buildReservationIncidents(file = {}, orders = []) {
    const todayKey = this.toDateKey(new Date());
    const incidents = [];

    for (const order of orders.filter((item) => item?.status !== 'CANCELLED' && this.isReservationManagedOrder(item))) {
      const control = this.normalizeReservationControl(order);
      const deadlineKey = this.toDateKey(control.deadlineAt);
      const isOverdue = order?.status !== 'WAITING_INFO'
        && deadlineKey
        && deadlineKey < todayKey
        && !TERMINAL_RESERVATION_STATUSES.includes(control.status);
      const isFailed = order?.reservationControl?.status === 'FAILED';

      if (!isOverdue && !isFailed) continue;

      incidents.push(this.buildIncident({
        file,
        order,
        type: isFailed ? 'RESERVATION_FAILED' : 'SUPPLIER_RESPONSE_DELAY',
        severity: this.deriveSeverity({
          order,
          dueDate: control.deadlineAt,
          travelStart: file?.travel_date_start,
          criticality: control.criticality,
        }),
        impactType: 'SUPPLIER_CONFIRMATION',
        title: `${isFailed ? 'Failed reservation' : 'Reservation overdue'}: ${this.resolveOrderLabel(order)}`,
        description: `${control.status} reservation status detected for supplier-controlled service.`,
        detectedAt: control.deadlineAt || order?.updatedAt,
        sourceStatus: control.status,
      }));
    }

    return incidents;
  }

  buildPaymentIncidents(file = {}) {
    const payables = file?.financial_overview?.payables?.items || [];
    return payables
      .filter((item) => item?.payment_queue === 'PAY_NOW' || item?.overdue)
      .map((item) => {
        const pseudoOrder = {
          _id: item.order_id,
          type: item.type,
          priority: item.payment_priority === 'CRITICAL' ? 'URGENT' : item.payment_priority || 'MEDIUM',
          dueDate: item.due_date,
          financials: {
            supplierName: item.supplier_name,
            currency: file?.financial_overview?.currency || 'USD',
          },
          sourceSnapshot: { name: item.label },
          status: item.source_status,
        };

        return this.buildIncident({
          file,
          order: pseudoOrder,
          type: 'SUPPLIER_PAYMENT_RISK',
          severity: item?.overdue || item?.payment_priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          impactType: 'SUPPLIER_PAYMENT',
          title: `Supplier payment status: ${item.label}`,
          description: `${item.payment_queue || 'PAY_NOW'} status with pending amount ${Number(item.pending_amount || 0).toFixed(2)}.`,
          detectedAt: item.due_date || new Date(),
          sourceStatus: item.payment_queue || '',
        });
      });
  }

  buildDayOneIncidents(file = {}) {
    const days = Array.isArray(file?.operational_itinerary?.days) ? file.operational_itinerary.days : [];
    const firstDay = days
      .filter((day) => Array.isArray(day?.items) && day.items.length)
      .sort((left, right) => (left.day || 0) - (right.day || 0))[0];

    if (!firstDay) return [];

    return (firstDay.items || [])
      .filter((item) => item?.detail?.status !== 'READY')
      .map((item) => this.buildIncident({
        file,
        order: {
          _id: item.item_id,
          type: item.item_type,
          dueDate: firstDay.date || file?.travel_date_start,
          priority: 'HIGH',
          sourceSnapshot: { name: item.title },
          financials: { supplierName: item?.detail?.supplier_name || '' },
          status: item?.detail?.status,
        },
        type: 'DAY_ONE_READINESS_GAP',
        severity: this.deriveSeverity({
          order: { priority: 'HIGH' },
          dueDate: firstDay.date || file?.travel_date_start,
          travelStart: file?.travel_date_start,
        }),
        impactType: 'DAY_ONE_OPERATION',
        title: `Day 1 not ready: ${item.title}`,
        description: `${item?.detail?.status || 'PENDING'} status detected in first operational day.`,
        detectedAt: firstDay.date || file?.travel_date_start || new Date(),
        sourceStatus: item?.detail?.status || '',
      }));
  }

  buildIncidentOverview(file = {}, serviceOrders = []) {
    const orders = Array.isArray(serviceOrders) ? serviceOrders : [];
    const incidents = [
      ...this.buildOrderBlockIncidents(file, orders),
      ...this.buildReservationIncidents(file, orders),
      ...this.buildPaymentIncidents(file),
      ...this.buildDayOneIncidents(file),
    ].sort((left, right) => {
      const severityWeight = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityWeight[left.severity] - severityWeight[right.severity]
        || new Date(right.detected_at).getTime() - new Date(left.detected_at).getTime();
    });

    return {
      generated_at: new Date().toISOString(),
      total_open: incidents.length,
      critical_open: incidents.filter((incident) => incident.severity === 'CRITICAL').length,
      high_open: incidents.filter((incident) => incident.severity === 'HIGH').length,
      medium_open: incidents.filter((incident) => incident.severity === 'MEDIUM').length,
      by_impact_type: incidents.reduce((acc, incident) => {
        acc[incident.impact_type] = (acc[incident.impact_type] || 0) + 1;
        return acc;
      }, {}),
      items: incidents,
    };
  }

  enrichBookingFile(file = {}, serviceOrders = []) {
    if (!file) return file;
    return {
      ...file,
      incident_overview: this.buildIncidentOverview(file, serviceOrders),
    };
  }
}

module.exports = new BookingFileIncidentService();
