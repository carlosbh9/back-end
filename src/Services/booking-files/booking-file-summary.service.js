const BookingFile = require('../../models/booking_file.schema');
const ServiceOrder = require('../../models/service_order.schema');

const OPEN_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO'];
const DONE_ORDER_STATUSES = ['DONE'];

class BookingFileSummaryService {
  normalizeStatusList(values = []) {
    return Array.isArray(values) ? values.filter(Boolean) : [];
  }

  normalizeDate(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  daysBetween(from, to) {
    const start = this.normalizeDate(from);
    const end = this.normalizeDate(to);
    if (!start || !end) return null;
    return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  mapAreaStatus(orders = []) {
    if (!orders.length) return 'NOT_STARTED';
    const active = orders.filter((order) => !['CANCELLED'].includes(order.status));
    if (!active.length) return 'CANCELLED';

    const total = active.length;
    const done = active.filter((order) => DONE_ORDER_STATUSES.includes(order.status)).length;
    const waiting = active.filter((order) => order.status === 'WAITING_INFO').length;
    const inProgress = active.filter((order) => order.status === 'IN_PROGRESS').length;
    const pending = active.filter((order) => order.status === 'PENDING').length;

    if (done === total) return 'COMPLETED';
    if (waiting > 0) return 'BLOCKED';
    if (done > 0 && done < total) return 'PARTIAL';
    if (inProgress > 0) return 'IN_PROGRESS';
    if (pending === total) return 'PENDING';
    return 'PENDING';
  }

  mapPaymentsStatus(orders = []) {
    if (!orders.length) return 'NOT_REQUIRED';

    const financialOrders = orders.filter((order) => ['PREPAYMENT', 'INVOICE'].includes(order.type) || ['PAGOS', 'CONTABILIDAD'].includes(order.area));
    if (!financialOrders.length) return 'NOT_REQUIRED';

    const paymentStatuses = financialOrders.map((order) => order.financials?.paymentStatus || 'NOT_REQUIRED');
    if (paymentStatuses.every((status) => status === 'NOT_REQUIRED')) return 'NOT_REQUIRED';
    if (paymentStatuses.every((status) => status === 'PAID' || status === 'NOT_REQUIRED')) return 'COMPLETED';
    if (paymentStatuses.some((status) => status === 'REFUNDED' || status === 'PARTIAL')) return 'PARTIAL';
    if (financialOrders.some((order) => order.status === 'WAITING_INFO')) return 'BLOCKED';
    if (financialOrders.some((order) => order.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
    return 'PENDING';
  }

  mapDeliverablesStatus(orders = []) {
    if (!orders.length) return 'NOT_STARTED';

    const deliverableOrders = orders.filter((order) => ['HOTEL', 'TICKETS', 'TOUR', 'TRANSPORT'].includes(order.type));
    if (!deliverableOrders.length) return 'NOT_REQUIRED';

    const withDeliverables = deliverableOrders.filter((order) => Array.isArray(order.attachments) && order.attachments.length > 0);
    const withVoucherLike = deliverableOrders.filter((order) => (order.attachments || []).some((attachment) => ['VOUCHER', 'TICKET', 'RESERVATION_CONFIRMATION'].includes(attachment.type)));

    if (withVoucherLike.length === deliverableOrders.length) return 'COMPLETED';
    if (withVoucherLike.length > 0 || withDeliverables.length > 0) return 'PARTIAL';
    if (deliverableOrders.some((order) => order.status === 'WAITING_INFO')) return 'BLOCKED';
    if (deliverableOrders.some((order) => order.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
    return 'PENDING';
  }

  buildOperationalCounters(orders = [], now = new Date()) {
    const openOrders = orders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status));
    const completedOrders = orders.filter((order) => DONE_ORDER_STATUSES.includes(order.status));
    const blockedOrders = orders.filter((order) => order.status === 'WAITING_INFO');
    const overdueOrders = openOrders.filter((order) => order.dueDate && this.normalizeDate(order.dueDate) && this.normalizeDate(order.dueDate) < now);
    const todayKey = now.toISOString().slice(0, 10);
    const dueTodayOrders = openOrders.filter((order) => {
      const dueDate = this.normalizeDate(order.dueDate);
      return dueDate ? dueDate.toISOString().slice(0, 10) === todayKey : false;
    });

    return {
      orders_total: orders.length,
      open_orders: openOrders.length,
      completed_orders: completedOrders.length,
      blocked_orders: blockedOrders.length,
      overdue_orders: overdueOrders.length,
      due_today_orders: dueTodayOrders.length,
    };
  }

  buildPassengerInfoStatus(existingStatus = {}, file = {}) {
    const current = {
      status: existingStatus?.status || 'NOT_SENT',
      completion_percentage: Number(existingStatus?.completion_percentage) || 0,
      missing_required_fields: Array.isArray(existingStatus?.missing_required_fields) ? existingStatus.missing_required_fields : [],
      last_reminder_at: existingStatus?.last_reminder_at || null,
      reminder_count: Number(existingStatus?.reminder_count) || 0,
      validated_at: existingStatus?.validated_at || null,
      validated_by: existingStatus?.validated_by || null,
      notes: existingStatus?.notes || ''
    };

    if (current.validated_at) {
      current.status = 'VALIDATED';
      current.completion_percentage = 100;
      current.missing_required_fields = [];
      return current;
    }

    if (current.completion_percentage >= 100 && !current.missing_required_fields.length) {
      current.status = 'COMPLETED';
      current.completion_percentage = 100;
      return current;
    }

    const daysToTravel = this.daysBetween(new Date(), file.travel_date_start);
    if (daysToTravel !== null && daysToTravel <= 7 && current.completion_percentage < 100) {
      current.status = 'INCOMPLETE';
      return current;
    }

    if (current.reminder_count > 0 && current.completion_percentage === 0) {
      current.status = 'SENT';
      return current;
    }

    if (current.completion_percentage > 0) {
      current.status = 'IN_PROGRESS';
      return current;
    }

    return current;
  }

  deriveOverallStatus({ file, reservationsStatus, operationsStatus, paymentsStatus, deliverablesStatus, passengerInfoStatus, riskLevel, counters }) {
    if (file?.is_cancelled) {
      return {
        overall_status: 'CANCELLED',
        all_required_areas_completed: false,
        passenger_info_ready: false,
        overall_reason: 'The file is cancelled, so operational progress is no longer active.',
      };
    }

    const summaryStatuses = this.normalizeStatusList([reservationsStatus, operationsStatus, paymentsStatus, deliverablesStatus]);
    const requiredStatuses = summaryStatuses.filter((value) => !['NOT_REQUIRED', 'NOT_STARTED', 'CANCELLED'].includes(value));
    const allRequiredAreasCompleted = requiredStatuses.length > 0 && requiredStatuses.every((value) => value === 'COMPLETED');
    const passengerInfoReady = ['COMPLETED', 'VALIDATED'].includes(passengerInfoStatus.status);
    const hasBlockedArea = summaryStatuses.includes('BLOCKED');
    const hasActiveWork = summaryStatuses.some((value) => ['IN_PROGRESS', 'PARTIAL'].includes(value));
    const hasPendingArea = summaryStatuses.some((value) => value === 'PENDING');

    if (riskLevel === 'CRITICAL' || hasBlockedArea) {
      return {
        overall_status: 'AT_RISK',
        all_required_areas_completed: allRequiredAreasCompleted,
        passenger_info_ready: passengerInfoReady,
        overall_reason: hasBlockedArea
          ? 'At least one operational area is blocked and requires intervention.'
          : 'The file has critical operational risk and must be prioritized.',
      };
    }

    if (allRequiredAreasCompleted && counters.open_orders === 0 && passengerInfoReady) {
      return {
        overall_status: 'COMPLETED',
        all_required_areas_completed: true,
        passenger_info_ready: true,
        overall_reason: 'All required operational areas are completed and passenger information is ready.',
      };
    }

    if (allRequiredAreasCompleted && counters.open_orders === 0) {
      return {
        overall_status: 'READY',
        all_required_areas_completed: true,
        passenger_info_ready: passengerInfoReady,
        overall_reason: 'All required operational areas are completed. Passenger information is the remaining follow-up.',
      };
    }

    if (hasActiveWork) {
      return {
        overall_status: 'ACTIVE',
        all_required_areas_completed: allRequiredAreasCompleted,
        passenger_info_ready: passengerInfoReady,
        overall_reason: 'The file has active work in progress across one or more operational areas.',
      };
    }

    if (hasPendingArea || counters.open_orders > 0 || !passengerInfoReady) {
      return {
        overall_status: 'PENDING',
        all_required_areas_completed: allRequiredAreasCompleted,
        passenger_info_ready: passengerInfoReady,
        overall_reason: counters.open_orders > 0
          ? 'There are still open service orders pending execution.'
          : 'The file is still waiting for the first operational milestones.',
      };
    }

    return {
      overall_status: 'READY',
      all_required_areas_completed: allRequiredAreasCompleted,
      passenger_info_ready: passengerInfoReady,
      overall_reason: 'The file is operationally ready for the next handoff.',
    };
  }

  deriveRiskLevel({ file, lastActivityAt, counters }) {
    if (file?.is_cancelled) {
      return {
        risk_level: 'LOW',
        risk_reason: 'Cancelled files do not carry active delivery risk.',
      };
    }

    const now = new Date();
    const daysToTravel = this.daysBetween(now, file.travel_date_start);
    const recentActivityDays = lastActivityAt ? this.daysBetween(lastActivityAt, now) : null;

    if (
      counters.overdue_orders >= 2
      || (counters.blocked_orders > 0 && daysToTravel !== null && daysToTravel <= 3)
      || (daysToTravel !== null && daysToTravel <= 2 && counters.open_orders > 0)
    ) {
      return {
        risk_level: 'CRITICAL',
        risk_reason: 'The file has urgent operational pressure due to blocked, overdue, or imminent travel work.',
      };
    }

    if (
      counters.blocked_orders > 0
      || counters.overdue_orders === 1
      || (daysToTravel !== null && daysToTravel <= 7 && counters.open_orders > 0)
    ) {
      return {
        risk_level: 'HIGH',
        risk_reason: 'The file needs close follow-up because there is blocked or time-sensitive open work.',
      };
    }

    if (
      counters.due_today_orders > 0
      || (counters.open_orders > 0 && recentActivityDays !== null && recentActivityDays > 7)
    ) {
      return {
        risk_level: 'MEDIUM',
        risk_reason: 'The file is stable, but it has open work that should be reviewed soon.',
      };
    }

    return {
      risk_level: 'LOW',
      risk_reason: counters.open_orders > 0
        ? 'The file has open work, but no immediate blockers or deadlines.'
        : 'The file has no immediate operational warning signs.',
    };
  }

  deriveNextAction(orders = []) {
    const openOrders = orders
      .filter((order) => OPEN_ORDER_STATUSES.includes(order.status))
      .sort((a, b) => {
        const dateA = this.normalizeDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const dateB = this.normalizeDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });

    const nextOrder = openOrders[0];
    if (!nextOrder) {
      return { next_action: '', next_action_due_at: null };
    }

    const label = nextOrder.currentStageLabel || nextOrder.currentStageCode || nextOrder.status;
    const subject = nextOrder.sourceSnapshot?.name || nextOrder.sourceSnapshot?.route || nextOrder.type;
    return {
      next_action: `${label}: ${subject}`,
      next_action_due_at: nextOrder.dueDate ? new Date(nextOrder.dueDate) : null
    };
  }

  extractLastActivityAt(file, orders = []) {
    const candidates = [file?.updatedAt, file?.createdAt];
    for (const order of orders) {
      candidates.push(order.updatedAt, order.createdAt);
      for (const audit of order.auditLogs || []) {
        candidates.push(audit?.at);
      }
    }
    const normalized = candidates
      .map((value) => this.normalizeDate(value))
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime());
    return normalized[0] || null;
  }

  async getOrdersForFile(fileId, fallbackIds = []) {
    const byFile = await ServiceOrder.find({ file_id: fileId }).sort({ dueDate: 1, createdAt: -1 }).lean();
    if (byFile.length) return byFile;
    if (!Array.isArray(fallbackIds) || !fallbackIds.length) return [];
    return ServiceOrder.find({ _id: { $in: fallbackIds } }).sort({ dueDate: 1, createdAt: -1 }).lean();
  }

  async recalculateFileSummary(fileId, { updatedBy = null } = {}) {
    const file = await BookingFile.findById(fileId);
    if (!file) {
      throw new Error(`Booking file not found: ${fileId}`);
    }

    const orders = await this.getOrdersForFile(file._id, file.service_order_ids);
    const reservationsStatus = this.mapAreaStatus(orders.filter((order) => order.area === 'RESERVAS' || order.type === 'HOTEL'));
    const operationsStatus = this.mapAreaStatus(orders.filter((order) => order.area === 'OPERACIONES' || ['TOUR', 'TRANSPORT', 'TICKETS'].includes(order.type)));
    const paymentsStatus = this.mapPaymentsStatus(orders);
    const deliverablesStatus = this.mapDeliverablesStatus(orders);
    const passengerInfoStatus = this.buildPassengerInfoStatus(file.passenger_info_status, file);
    const lastActivityAt = this.extractLastActivityAt(file, orders);
    const counters = this.buildOperationalCounters(orders);
    const riskSummary = this.deriveRiskLevel({ file, lastActivityAt, counters });
    const nextAction = this.deriveNextAction(orders);
    const overallSummary = this.deriveOverallStatus({
      file,
      reservationsStatus,
      operationsStatus,
      paymentsStatus,
      deliverablesStatus,
      passengerInfoStatus,
      riskLevel: riskSummary.risk_level,
      counters,
    });

    file.service_order_ids = orders.map((order) => order._id);
    file.reservations_status = reservationsStatus;
    file.operations_status = operationsStatus;
    file.payments_status = paymentsStatus;
    file.deliverables_status = deliverablesStatus;
    file.passenger_info_status = passengerInfoStatus;
    file.overall_status = overallSummary.overall_status;
    file.risk_level = riskSummary.risk_level;
    file.last_activity_at = lastActivityAt;
    file.next_action = nextAction.next_action;
    file.next_action_due_at = nextAction.next_action_due_at;
    file.summary_context = {
      ...counters,
      passenger_info_ready: overallSummary.passenger_info_ready,
      all_required_areas_completed: overallSummary.all_required_areas_completed,
      overall_reason: overallSummary.overall_reason,
      risk_reason: riskSummary.risk_reason,
    };
    if (updatedBy) {
      file.updatedBy = updatedBy;
    }

    await file.save();
    return file.toObject({ virtuals: true });
  }
}

module.exports = new BookingFileSummaryService();
