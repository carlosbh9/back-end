const BookingFile = require('../../models/booking_file.schema');
const ServiceOrder = require('../../models/service_order.schema');

class BookingFileBibliaService {
  normalizeDate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  isDateWithinTravel(file, date) {
    const start = this.normalizeDate(file?.travel_date_start);
    const end = this.normalizeDate(file?.travel_date_end);
    if (!start || !end || !date) return false;
    return date >= start && date <= end;
  }

  compareTime(a = '', b = '') {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return String(a).localeCompare(String(b));
  }

  mapDetailStatusToExecutionStatus(status = '') {
    if (status === 'READY') return 'READY';
    if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'PENDING';
  }

  normalizeCategory(section = '') {
    const value = String(section || '').toLowerCase();
    if (value === 'service' || value === 'experience') return 'service';
    if (value === 'hotel') return 'hotel';
    if (value === 'flight') return 'flight';
    if (value === 'operator') return 'operator';
    if (value === 'cruise') return 'cruise';
    return value;
  }

  normalizeReservationControl(order = {}) {
    const control = order?.reservationControl || {};
    return {
      status: control.status || (
        order?.status === 'DONE'
          ? 'CONFIRMED'
          : order?.status === 'CANCELLED'
            ? 'CANCELLED'
            : order?.status === 'WAITING_INFO'
              ? 'FAILED'
              : order?.status === 'IN_PROGRESS'
                ? 'REQUESTED'
                : 'DRAFT'
      ),
      criticality: control.criticality || (
        order?.priority === 'URGENT'
          ? 'CRITICAL'
          : order?.priority === 'HIGH'
            ? 'HIGH'
            : order?.priority === 'LOW'
              ? 'LOW'
              : 'MEDIUM'
      ),
      deadlineAt: control.deadlineAt || order?.dueDate || null,
      reconfirmBy: control.reconfirmBy || null,
      requiresReconfirmation: !!control.requiresReconfirmation,
      reconfirmedAt: control.reconfirmedAt || null,
      supplierName: control.supplierName || order?.financials?.supplierName || '',
      supplierContact: control.supplierContact || '',
      providerResponseNotes: control.providerResponseNotes || '',
    };
  }

  collectDailyItems(file, targetDate) {
    const operational = file?.operational_itinerary || {};
    const days = Array.isArray(operational.days) ? operational.days : [];
    const matchingDays = days.filter((day) => this.normalizeDate(day?.date) === targetDate);
    const rows = [];

    for (const day of matchingDays) {
      for (const item of day?.items || []) {
        const detail = item?.detail || {};
        const primaryTime = detail?.start_time || item?.sort_time || '';
        rows.push({
          item_id: item?.item_id || '',
          day: Number(day?.day) || 0,
          section: item?.item_type || 'SERVICE',
          execution_date: targetDate,
          time: primaryTime,
          end_time: detail?.end_time || '',
          pickup_time: detail?.pickup_time || '',
          meeting_point: detail?.meeting_point || '',
          title: item?.title || 'Unnamed itinerary item',
          detail: item?.subtitle || '',
          city: item?.city || day?.city || '',
          notes: detail?.notes || '',
          responsible: detail?.responsible_name || '',
          supplier_name: detail?.supplier_name || '',
          supplier_contact: detail?.supplier_contact || '',
          detail_status: detail?.status || 'PENDING',
          matchingKey: {
            category: this.normalizeCategory(item?.item_type),
            title: item?.title || '',
            date: targetDate,
          },
        });
      }
    }

    return rows.sort((left, right) =>
      this.compareTime(left.time, right.time)
      || left.day - right.day
      || String(left.title || '').localeCompare(String(right.title || ''))
    );
  }

  deriveTravelMovement(file = {}, targetDate = '') {
    const start = this.normalizeDate(file?.travel_date_start);
    const end = this.normalizeDate(file?.travel_date_end);
    const isArrivalDay = !!start && start === targetDate;
    const isDepartureDay = !!end && end === targetDate;

    if (isArrivalDay && isDepartureDay) {
      return {
        travel_movement: 'ARRIVAL_DEPARTURE',
        is_arrival_day: true,
        is_departure_day: true,
      };
    }

    if (isArrivalDay) {
      return {
        travel_movement: 'ARRIVAL',
        is_arrival_day: true,
        is_departure_day: false,
      };
    }

    if (isDepartureDay) {
      return {
        travel_movement: 'DEPARTURE',
        is_arrival_day: false,
        is_departure_day: true,
      };
    }

    return {
      travel_movement: 'IN_HOUSE',
      is_arrival_day: false,
      is_departure_day: false,
    };
  }

  isReservationPending(status = '') {
    return !!status && !['CONFIRMED', 'RECONFIRMED', 'CANCELLED'].includes(status);
  }

  isDateDue(value, targetDate) {
    const normalized = this.normalizeDate(value);
    return !!normalized && normalized <= targetDate;
  }

  hasReservationAlert(item = {}, targetDate = '') {
    return this.isReservationPending(item.reservation_status)
      && (
        ['HIGH', 'CRITICAL'].includes(item.reservation_criticality || '')
        || this.isDateDue(item.reservation_deadline, targetDate)
        || !!item.has_immediate_operational_risk
      );
  }

  hasPassengerGap(item = {}) {
    return item.passenger_info_ready === false || Number(item.passenger_missing_count) > 0;
  }

  isBlockedRow(item = {}) {
    return !!item.order_blocked || item.execution_status === 'WAITING_INFO';
  }

  matchesAlertFilter(item = {}, alert = '', targetDate = '') {
    if (!alert) return true;

    if (alert === 'HIGH_RISK') {
      return ['HIGH', 'CRITICAL'].includes(item.risk_level || '');
    }
    if (alert === 'RESERVATION_ALERT') {
      return this.hasReservationAlert(item, targetDate);
    }
    if (alert === 'RECONFIRMATION') {
      return !!item.needs_reconfirmation;
    }
    if (alert === 'PASSENGER_GAP') {
      return this.hasPassengerGap(item);
    }
    if (alert === 'BLOCKED') {
      return this.isBlockedRow(item);
    }
    if (alert === 'ARRIVAL') {
      return !!item.is_arrival_day;
    }
    if (alert === 'DEPARTURE') {
      return !!item.is_departure_day;
    }

    return true;
  }

  buildSummary(items = [], targetDate = '') {
    const files = new Map();

    for (const item of items) {
      if (!files.has(item.file_id)) {
        files.set(item.file_id, item);
      }
    }

    const uniqueFiles = Array.from(files.values());

    return {
      total_files: uniqueFiles.length,
      total_rows: items.length,
      passengers_traveling: uniqueFiles.reduce((sum, item) => sum + (Number(item.pax_count) || 0), 0),
      arrivals: uniqueFiles.filter((item) => item.is_arrival_day).length,
      departures: uniqueFiles.filter((item) => item.is_departure_day).length,
      high_risk_files: uniqueFiles.filter((item) => ['HIGH', 'CRITICAL'].includes(item.risk_level || '')).length,
      reservation_alerts: items.filter((item) => this.hasReservationAlert(item, targetDate)).length,
      reconfirmations: items.filter((item) => item.needs_reconfirmation).length,
      passenger_gap_files: uniqueFiles.filter((item) => this.hasPassengerGap(item)).length,
      blocked_rows: items.filter((item) => this.isBlockedRow(item)).length,
    };
  }

  async getDailyView({ date, area = '', status = '', alert = '', destination = '' }) {
    const targetDate = this.normalizeDate(date || new Date());
    const fileQuery = {
      travel_date_start: { $lte: targetDate },
      travel_date_end: { $gte: targetDate },
      is_cancelled: { $ne: true },
    };
    if (destination) {
      fileQuery.destinations = { $regex: destination, $options: 'i' };
    }
    const candidateFiles = await BookingFile.find(fileQuery)
      .populate('contact_id', '_id name email phone status')
      .populate('quoter_id', '_id guest status soldAt booking_file_id')
      .sort({ travel_date_start: 1, fileCode: 1 })
      .lean({ virtuals: true });

    const fileIds = candidateFiles.map((file) => file._id);
    const orders = await ServiceOrder.find({ file_id: { $in: fileIds } }).lean();
    const ordersByFileId = new Map();

    for (const order of orders) {
      const key = String(order.file_id);
      const current = ordersByFileId.get(key) || [];
      current.push(order);
      ordersByFileId.set(key, current);
    }

    const items = [];
    for (const file of candidateFiles) {
      const fileOrders = ordersByFileId.get(String(file._id)) || [];
      const travelMovement = this.deriveTravelMovement(file, targetDate);
      const paxCount = Number(file?.pax_summary?.number_paxs) || 0;
      const passengerInfoStatus = file.passenger_info_status || {};
      const passengerMissingCount = Array.isArray(passengerInfoStatus?.missing_required_fields)
        ? passengerInfoStatus.missing_required_fields.length
        : 0;

      const rows = this.collectDailyItems(file, targetDate).map((row) => {
        const matchingOrders = fileOrders.filter((order) => {
          const snapshot = order?.sourceSnapshot || {};
          const snapshotDate = this.normalizeDate(snapshot?.date || snapshot?.travelDate?.start || order?.dueDate);
          const snapshotName = String(snapshot?.name || snapshot?.route || '').trim().toLowerCase();
          const rowName = String(row.matchingKey.title || '').trim().toLowerCase();
          return snapshotDate === row.matchingKey.date
            && snapshotName === rowName
            && String(snapshot?.category || '').toLowerCase() === String(row.matchingKey.category || '').toLowerCase();
        });

        const primaryOrder = matchingOrders[0] || null;
        const reservationControl = primaryOrder ? this.normalizeReservationControl(primaryOrder) : null;
        const needsReconfirmation = !!(
          reservationControl?.requiresReconfirmation
          && reservationControl?.status !== 'RECONFIRMED'
          && !reservationControl?.reconfirmedAt
        );
        const lastAuditMessage = matchingOrders
          .map((order) => order.auditLogs?.[order.auditLogs.length - 1]?.message)
          .filter(Boolean)[0] || '';
        const orderBlocked = primaryOrder?.status === 'WAITING_INFO' || reservationControl?.status === 'FAILED';
        const orderBlockReason = primaryOrder?.status === 'WAITING_INFO'
          ? (lastAuditMessage || 'Order is blocked waiting for missing information.')
          : reservationControl?.status === 'FAILED'
            ? (reservationControl?.providerResponseNotes || 'Reservation failed and requires intervention.')
            : '';

        return {
          file_id: String(file._id),
          contact_id: file.contact_id?._id ? String(file.contact_id._id) : '',
          fileCode: file.fileCode,
          guest: file.guest || file.contact_id?.name || '',
          pax_count: paxCount,
          travel_date_start: file.travel_date_start || '',
          travel_date_end: file.travel_date_end || '',
          travel_movement: travelMovement.travel_movement,
          is_arrival_day: travelMovement.is_arrival_day,
          is_departure_day: travelMovement.is_departure_day,
          overall_status: file.overall_status || 'PENDING',
          risk_level: file.risk_level || 'LOW',
          next_action: file.next_action || '',
          execution_date: targetDate,
          day: row.day,
          item_id: row.item_id,
          section: row.section,
          time: row.time,
          end_time: row.end_time,
          pickup_time: row.pickup_time,
          meeting_point: row.meeting_point,
          title: row.title,
          detail: row.detail,
          city: row.city,
          notes: row.notes,
          service_order_ids: matchingOrders.map((order) => String(order._id)),
          execution_status: primaryOrder?.status || this.mapDetailStatusToExecutionStatus(row.detail_status),
          detail_status: row.detail_status,
          area: primaryOrder?.area || '',
          responsible: row.responsible || primaryOrder?.assigneeId || file.owner_user_id || null,
          supplier_name: row.supplier_name,
          supplier_contact: row.supplier_contact,
          has_service_order: Boolean(primaryOrder),
          observations: [
            row.notes,
            row.meeting_point ? `Meeting point: ${row.meeting_point}` : '',
            reservationControl?.providerResponseNotes || '',
            passengerMissingCount > 0 ? `${passengerMissingCount} passenger info gaps` : '',
            lastAuditMessage,
          ].filter(Boolean).join(' | '),
          file_reservations_status: file.reservations_status || 'NOT_STARTED',
          passenger_info_ready: !!file.summary_context?.passenger_info_ready,
          passenger_info_status: passengerInfoStatus?.status || 'NOT_SENT',
          passenger_missing_count: passengerMissingCount,
          reservation_status: reservationControl?.status || '',
          reservation_criticality: reservationControl?.criticality || 'MEDIUM',
          reservation_deadline: this.normalizeDate(reservationControl?.deadlineAt),
          reconfirmation_due_at: this.normalizeDate(reservationControl?.reconfirmBy),
          needs_reconfirmation: needsReconfirmation,
          has_immediate_operational_risk: file.risk_level === 'CRITICAL'
            || (needsReconfirmation && !!this.normalizeDate(reservationControl?.reconfirmBy)),
          order_blocked: orderBlocked,
          order_block_reason: orderBlockReason,
        };
      });

      if (!rows.length && this.isDateWithinTravel(file, targetDate)) {
        rows.push({
          file_id: String(file._id),
          contact_id: file.contact_id?._id ? String(file.contact_id._id) : '',
          fileCode: file.fileCode,
          guest: file.guest || file.contact_id?.name || '',
          pax_count: paxCount,
          travel_date_start: file.travel_date_start || '',
          travel_date_end: file.travel_date_end || '',
          travel_movement: travelMovement.travel_movement,
          is_arrival_day: travelMovement.is_arrival_day,
          is_departure_day: travelMovement.is_departure_day,
          overall_status: file.overall_status || 'PENDING',
          risk_level: file.risk_level || 'LOW',
          next_action: file.next_action || '',
          execution_date: targetDate,
          day: 0,
          item_id: '',
          section: 'TRAVEL_DAY',
          time: '',
          end_time: '',
          pickup_time: '',
          meeting_point: '',
          title: 'Travel day in progress',
          detail: file.destinations?.join(' | ') || 'No dated services in itinerary snapshot',
          city: file.destinations?.[0] || '',
          notes: file.notes || '',
          service_order_ids: [],
          execution_status: file.operations_status || 'PENDING',
          detail_status: 'PENDING',
          area: '',
          responsible: file.owner_user_id || null,
          supplier_name: '',
          supplier_contact: '',
          has_service_order: false,
          observations: file.notes || '',
          file_reservations_status: file.reservations_status || 'NOT_STARTED',
          passenger_info_ready: !!file.summary_context?.passenger_info_ready,
          passenger_info_status: passengerInfoStatus?.status || 'NOT_SENT',
          passenger_missing_count: passengerMissingCount,
          reservation_status: '',
          reservation_criticality: 'MEDIUM',
          reservation_deadline: '',
          reconfirmation_due_at: '',
          needs_reconfirmation: false,
          has_immediate_operational_risk: file.risk_level === 'CRITICAL',
          order_blocked: false,
          order_block_reason: '',
        });
      }

      items.push(...rows);
    }

    const filteredItems = items.filter((item) => {
      const matchesArea = !area || item.area === area;
      const matchesStatus = !status || item.execution_status === status || item.detail_status === status;
      const matchesAlert = this.matchesAlertFilter(item, alert, targetDate);
      return matchesArea && matchesStatus && matchesAlert;
    });

    return {
      date: targetDate,
      items: filteredItems,
      total: filteredItems.length,
      summary: this.buildSummary(filteredItems, targetDate),
    };
  }
}

module.exports = new BookingFileBibliaService();
