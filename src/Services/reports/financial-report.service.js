const QuoterV2 = require('../../modules/quoter-v2/infrastructure/mongoose/quoter-v2.schema');
const BookingFile = require('../../models/booking_file.schema');
const ServiceOrder = require('../../models/service_order.schema');

class FinancialReportService {
  async getReport({ year, month, travelDesignerId, destination, page = 1, pageSize = 100 } = {}) {
    const quoterFilter = { status: 'SOLD' };

    if (year) {
      const y = parseInt(year, 10);
      const startMonth = month ? parseInt(month, 10) - 1 : 0;
      const endMonth = month ? parseInt(month, 10) : 12;
      quoterFilter.soldAt = {
        $gte: new Date(y, startMonth, 1),
        $lt: new Date(y, endMonth, 1),
      };
    }

    if (travelDesignerId) {
      quoterFilter.soldBy = travelDesignerId;
    }

    if (destination) {
      quoterFilter.destinations = { $regex: destination, $options: 'i' };
    }

    const quoters = await QuoterV2.find(quoterFilter)
      .populate('soldBy', '_id username email')
      .lean();

    if (!quoters.length) {
      return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), summary: this._emptySummary() };
    }

    const bookingFileIds = quoters.map((q) => q.booking_file_id).filter(Boolean);

    const bookingFiles = await BookingFile.find({ _id: { $in: bookingFileIds } })
      .select('_id fileCode travel_date_start travel_date_end destinations payments_status')
      .lean();

    const bfById = new Map(bookingFiles.map((bf) => [String(bf._id), bf]));

    const serviceOrders = await ServiceOrder.find({
      file_id: { $in: bookingFiles.map((bf) => bf._id) },
      status: { $ne: 'CANCELLED' },
    })
      .select('file_id financials')
      .lean();

    const costByFileId = new Map();
    for (const so of serviceOrders) {
      const key = String(so.file_id);
      costByFileId.set(key, (costByFileId.get(key) || 0) + (so.financials?.expectedCost || 0));
    }

    const items = quoters.map((q) => {
      const bf = q.booking_file_id ? bfById.get(String(q.booking_file_id)) : null;
      const revenue = q.total_prices?.final_cost || 0;
      const cost = bf ? costByFileId.get(String(bf._id)) || 0 : 0;
      const margin = revenue - cost;
      const marginPct = revenue > 0 ? Math.round((margin / revenue) * 10000) / 100 : 0;

      return {
        quoter_id: q._id,
        booking_file_id: bf?._id || null,
        fileCode: bf?.fileCode || '',
        guest: q.guest || '',
        travel_designer: q.soldBy
          ? { _id: q.soldBy._id, username: q.soldBy.username, email: q.soldBy.email }
          : null,
        sold_at: q.soldAt,
        travel_date_start: bf?.travel_date_start || q.travelDate?.start || '',
        travel_date_end: bf?.travel_date_end || q.travelDate?.end || '',
        destinations: bf?.destinations?.length ? bf.destinations : (q.destinations || []),
        payments_status: bf?.payments_status || 'NOT_STARTED',
        revenue,
        price_pp: q.total_prices?.price_pp || 0,
        cost,
        margin,
        margin_pct: marginPct,
      };
    });

    items.sort((a, b) => {
      if (!a.sold_at && !b.sold_at) return 0;
      if (!a.sold_at) return 1;
      if (!b.sold_at) return -1;
      return new Date(b.sold_at) - new Date(a.sold_at);
    });

    const summary = {
      total_bookings: items.length,
      total_revenue: items.reduce((s, i) => s + i.revenue, 0),
      total_cost: items.reduce((s, i) => s + i.cost, 0),
      total_margin: items.reduce((s, i) => s + i.margin, 0),
      avg_margin_pct:
        items.length > 0
          ? Math.round((items.reduce((s, i) => s + i.margin_pct, 0) / items.length) * 100) / 100
          : 0,
    };

    const total = items.length;
    const skip = (Number(page) - 1) * Number(pageSize);
    const paginatedItems = items.slice(skip, skip + Number(pageSize));

    return { items: paginatedItems, total, page: Number(page), pageSize: Number(pageSize), summary };
  }

  _emptySummary() {
    return { total_bookings: 0, total_revenue: 0, total_cost: 0, total_margin: 0, avg_margin_pct: 0 };
  }
}

module.exports = new FinancialReportService();
