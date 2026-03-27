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

  collectDailyItems(file, targetDate) {
    const itinerary = file?.itinerary_snapshot || {};
    const rows = [];

    for (const group of itinerary.services || []) {
      if (this.normalizeDate(group?.date) !== targetDate) continue;
      for (const service of group?.services || []) {
        rows.push({
          section: 'SERVICE',
          execution_date: targetDate,
          title: service?.name_service || 'Unnamed service',
          detail: [service?.placement, service?.type, service?.notes].filter(Boolean).join(' | '),
          city: service?.city || group?.city || '',
          notes: service?.notes || '',
          matchingKey: {
            category: 'service',
            title: service?.name_service || '',
            date: targetDate
          }
        });
      }
    }

    for (const hotel of itinerary.hotels || []) {
      if (this.normalizeDate(hotel?.date) !== targetDate) continue;
      rows.push({
        section: 'HOTEL',
        execution_date: targetDate,
        title: hotel?.name_hotel || 'Unnamed hotel',
        detail: [hotel?.accomodatios_category, hotel?.notes].filter(Boolean).join(' | '),
        city: hotel?.city || '',
        notes: hotel?.notes || '',
        matchingKey: {
          category: 'hotel',
          title: hotel?.name_hotel || '',
          date: targetDate
        }
      });
    }

    for (const flight of itinerary.flights || []) {
      if (this.normalizeDate(flight?.date) !== targetDate) continue;
      rows.push({
        section: 'FLIGHT',
        execution_date: targetDate,
        title: flight?.route || 'Unnamed flight',
        detail: flight?.notes || '',
        city: '',
        notes: flight?.notes || '',
        matchingKey: {
          category: 'flight',
          title: flight?.route || '',
          date: targetDate
        }
      });
    }

    for (const operator of itinerary.operators || []) {
      if (this.normalizeDate(operator?.date) !== targetDate) continue;
      rows.push({
        section: 'OPERATOR',
        execution_date: targetDate,
        title: operator?.name_operator || 'Unnamed operator',
        detail: [operator?.city, operator?.country, operator?.notes].filter(Boolean).join(' | '),
        city: operator?.city || '',
        notes: operator?.notes || '',
        matchingKey: {
          category: 'operator',
          title: operator?.name_operator || '',
          date: targetDate
        }
      });
    }

    for (const cruise of itinerary.cruises || []) {
      if (this.normalizeDate(cruise?.date) !== targetDate) continue;
      rows.push({
        section: 'CRUISE',
        execution_date: targetDate,
        title: cruise?.name || 'Unnamed cruise',
        detail: [cruise?.operator, cruise?.notes].filter(Boolean).join(' | '),
        city: '',
        notes: cruise?.notes || '',
        matchingKey: {
          category: 'cruise',
          title: cruise?.name || '',
          date: targetDate
        }
      });
    }

    return rows;
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
          section: row.section,
          title: row.title,
          detail: row.detail,
          city: row.city,
          notes: row.notes,
          service_order_ids: matchingOrders.map((order) => String(order._id)),
          execution_status: primaryOrder?.status || 'PENDING',
          area: primaryOrder?.area || '',
          responsible: primaryOrder?.assigneeId || file.owner_user_id || null,
          observations: [row.notes, ...(matchingOrders.map((order) => order.auditLogs?.[order.auditLogs.length - 1]?.message).filter(Boolean))].filter(Boolean).join(' | ')
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
          section: 'TRAVEL_DAY',
          title: 'Travel day in progress',
          detail: file.destinations?.join(' | ') || 'No dated services in itinerary snapshot',
          city: file.destinations?.[0] || '',
          notes: file.notes || '',
          service_order_ids: [],
          execution_status: file.operations_status || 'PENDING',
          area: '',
          responsible: file.owner_user_id || null,
          observations: file.notes || ''
        });
      }

      items.push(...rows);
    }

    const filteredItems = items.filter((item) => {
      const matchesArea = !area || item.area === area;
      const matchesStatus = !status || item.execution_status === status;
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
