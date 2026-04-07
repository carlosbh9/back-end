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
            date: targetDate
          }
        });
      }
    }

    return rows.sort((left, right) =>
      this.compareTime(left.time, right.time)
      || left.day - right.day
      || String(left.title || '').localeCompare(String(right.title || ''))
    );
  }

  async getDailyView({ date, area = '', status = '' }) {
    const targetDate = this.normalizeDate(date || new Date());
    const candidateFiles = await BookingFile.find({
      travel_date_start: { $lte: targetDate },
      travel_date_end: { $gte: targetDate },
      is_cancelled: { $ne: true }
    })
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
        return {
          file_id: String(file._id),
          contact_id: file.contact_id?._id ? String(file.contact_id._id) : '',
          fileCode: file.fileCode,
          guest: file.guest || file.contact_id?.name || '',
          travel_date_start: file.travel_date_start || '',
          travel_date_end: file.travel_date_end || '',
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
          observations: [row.notes, row.meeting_point ? `Meeting point: ${row.meeting_point}` : '', ...(matchingOrders.map((order) => order.auditLogs?.[order.auditLogs.length - 1]?.message).filter(Boolean))].filter(Boolean).join(' | ')
        };
      });

      if (!rows.length && this.isDateWithinTravel(file, targetDate)) {
        rows.push({
          file_id: String(file._id),
          contact_id: file.contact_id?._id ? String(file.contact_id._id) : '',
          fileCode: file.fileCode,
          guest: file.guest || file.contact_id?.name || '',
          travel_date_start: file.travel_date_start || '',
          travel_date_end: file.travel_date_end || '',
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
          observations: file.notes || ''
        });
      }

      items.push(...rows);
    }

    const filteredItems = items.filter((item) => {
      const matchesArea = !area || item.area === area;
      const matchesStatus = !status || item.execution_status === status || item.detail_status === status;
      return matchesArea && matchesStatus;
    });

    return {
      date: targetDate,
      items: filteredItems,
      total: filteredItems.length
    };
  }
}

module.exports = new BookingFileBibliaService();
