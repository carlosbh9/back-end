const ServiceOrder = require('../../models/service_order.schema');
const ServiceOrderTemplate = require('../../models/service_order_template.schema');
const Quoter = require('../../models/quoter.schema');

class ServiceOrderOrchestrator {
  buildBusinessEventId({ contactId, soldQuoterId }) {
    return `CONTACT_SOLD:${contactId}:${soldQuoterId}`;
  }

  buildIdempotencyKey({ businessEventId, type, lineKey }) {
    return `${businessEventId}:${type}:${lineKey}`;
  }

  defaultAreaByType(type) {
    if (type === 'HOTEL') return 'RESERVAS';
    if (type === 'TRANSPORT') return 'OPERACIONES';
    if (type === 'PREPAYMENT' || type === 'INVOICE') return 'CONTABILIDAD';
    return 'OPERACIONES';
  }

  toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  sumNumbers(values = []) {
    if (!Array.isArray(values)) return 0;
    return values.reduce((acc, value) => acc + this.toNumber(value), 0);
  }

  slug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'line';
  }

  extractOrderItemsFromQuoter(quoterDoc) {
    const items = [];
    const baseSnapshot = {
      guest: quoterDoc?.guest || '',
      travelDate: quoterDoc?.travelDate || null,
      totals: quoterDoc?.total_prices || null,
      extractedAt: new Date().toISOString()
    };

    (quoterDoc?.hotels || []).forEach((hotel, index) => {
      const priceBase = this.toNumber(hotel?.price_base);
      const estimatedTotal = this.toNumber(hotel?.price) || priceBase;
      items.push({
        type: 'HOTEL',
        lineKey: `hotel-${index}-${this.slug(hotel?.name_hotel)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'hotel',
          lineIndex: index,
          city: hotel?.city || '',
          date: hotel?.date || '',
          day: hotel?.day ?? null,
          name: hotel?.name_hotel || '',
          accommodationCategory: hotel?.accomodatios_category || '',
          priceBase,
          price: estimatedTotal,
          estimatedTotal,
          notes: hotel?.notes || ''
        }
      });
    });

    (quoterDoc?.services || []).forEach((serviceGroup, groupIndex) => {
      const day = serviceGroup?.day ?? null;
      const date = serviceGroup?.date || '';
      (serviceGroup?.services || []).forEach((serviceLine, lineIndex) => {
        const priceBase = this.toNumber(serviceLine?.price_base);
        const estimatedTotal = this.toNumber(serviceLine?.price) || priceBase;
        items.push({
          type: 'TOUR',
          lineKey: `service-${groupIndex}-${lineIndex}-${this.slug(serviceLine?.name_service)}`,
          sourceSnapshot: {
            ...baseSnapshot,
            category: 'service',
            groupIndex,
            lineIndex,
            day,
            date,
            city: serviceLine?.city || '',
            name: serviceLine?.name_service || '',
            priceBase,
            price: estimatedTotal,
            estimatedTotal,
            notes: serviceLine?.notes || ''
          }
        });
      });
    });

    (quoterDoc?.flights || []).forEach((flight, index) => {
      const priceConf = this.toNumber(flight?.price_conf);
      const estimatedTotal = this.toNumber(flight?.price) || priceConf;
      items.push({
        type: 'TRANSPORT',
        lineKey: `flight-${index}-${this.slug(flight?.route)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'flight',
          lineIndex: index,
          date: flight?.date || '',
          route: flight?.route || '',
          priceBase: priceConf,
          price: estimatedTotal,
          estimatedTotal,
          notes: flight?.notes || ''
        }
      });
    });

    (quoterDoc?.operators || []).forEach((operator, index) => {
      const estimatedTotal = this.toNumber(operator?.price);
      items.push({
        type: 'TOUR',
        lineKey: `operator-${index}-${this.slug(operator?.name_operator)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'operator',
          lineIndex: index,
          country: operator?.country || '',
          city: operator?.city || '',
          name: operator?.name_operator || '',
          price: estimatedTotal,
          estimatedTotal,
          notes: operator?.notes || ''
        }
      });
    });

    (quoterDoc?.cruises || []).forEach((cruise, index) => {
      const priceConf = this.toNumber(cruise?.price_conf);
      const estimatedTotal = this.toNumber(cruise?.price) || priceConf;
      items.push({
        type: 'TICKETS',
        lineKey: `cruise-${index}-${this.slug(cruise?.name)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'cruise',
          lineIndex: index,
          name: cruise?.name || '',
          operator: cruise?.operator || '',
          priceBase: priceConf,
          price: estimatedTotal,
          estimatedTotal,
          notes: cruise?.notes || ''
        }
      });
    });

    // Financial control orders (singletons).
    items.push({
      type: 'PREPAYMENT',
      lineKey: 'financial-prepayment',
      sourceSnapshot: {
        ...baseSnapshot,
        category: 'financial',
        name: 'Prepayment control',
        estimatedTotal: this.toNumber(quoterDoc?.total_prices?.final_cost),
        notes: 'Generated automatically from sold quote'
      }
    });
    items.push({
      type: 'INVOICE',
      lineKey: 'financial-invoice',
      sourceSnapshot: {
        ...baseSnapshot,
        category: 'financial',
        name: 'Invoice control',
        estimatedTotal: this.toNumber(quoterDoc?.total_prices?.final_cost),
        notes: 'Generated automatically from sold quote'
      }
    });

    return items;
  }

  buildChecklist(template) {
    const checklist = (template?.checklistTemplate || []).map((item) => ({
      itemId: item.itemId,
      label: item.label,
      status: 'PENDING'
    }));
    return checklist;
  }

  async buildTemplatesMap() {
    const templates = await ServiceOrderTemplate.find({}).lean();
    const map = new Map();
    for (const template of templates) {
      map.set(template.type, template);
    }
    return map;
  }

  async buildChecklistFromTemplate(type, templatesMap = null) {
    const template = templatesMap?.get(type)
      || await ServiceOrderTemplate.findOne({ type }).lean();
    if (!template) return { template: null, checklist: [] };
    const checklist = this.buildChecklist(template);
    return { template, checklist };
  }

  async createOrdersForContactSold({ contactId, soldQuoterId, changedBy }) {
    const quoterDoc = await Quoter.findById(soldQuoterId).lean();
    if (!quoterDoc) {
      throw new Error(`Sold quoter not found: ${soldQuoterId}`);
    }

    const businessEventId = this.buildBusinessEventId({ contactId, soldQuoterId });
    const orderItems = this.extractOrderItemsFromQuoter(quoterDoc);
    const templatesMap = await this.buildTemplatesMap();
    const created = [];

    for (const item of orderItems) {
      const type = item.type;
      const lineKey = item.lineKey;
      const idempotencyKey = this.buildIdempotencyKey({ businessEventId, type, lineKey });
      const { template, checklist } = await this.buildChecklistFromTemplate(type, templatesMap);

      const dueDate = template?.slaDays >= 0
        ? new Date(Date.now() + template.slaDays * 24 * 60 * 60 * 1000)
        : null;

      const payload = {
        contactId,
        soldQuoterId,
        sourceQuoterId: soldQuoterId,
        businessEventId,
        idempotencyKey,
        area: template?.area || this.defaultAreaByType(type),
        type,
        priority: template?.defaultPriority || 'MEDIUM',
        dueDate,
        checklist,
        sourceSnapshot: item.sourceSnapshot,
        createdBy: changedBy || null,
        updatedBy: changedBy || null,
        auditLogs: [{
          action: 'CREATED',
          by: changedBy || null,
          message: 'Order created from CONTACT_SOLD event',
          payload: { businessEventId, idempotencyKey, type, lineKey }
        }]
      };

      // Idempotent creation by unique idempotencyKey.
      const order = await ServiceOrder.findOneAndUpdate(
        { idempotencyKey },
        { $setOnInsert: payload },
        { new: true, upsert: true }
      );

      created.push(order);
    }

    return { businessEventId, createdCount: created.length, orders: created };
  }

  async cancelOrdersForBusinessEvent({ businessEventId, reason, changedBy }) {
    const orders = await ServiceOrder.find({ businessEventId, status: { $ne: 'CANCELLED' } });
    for (const order of orders) {
      order.status = 'CANCELLED';
      order.updatedBy = changedBy || null;
      order.auditLogs.push({
        action: 'CANCELLED',
        by: changedBy || null,
        message: reason || 'Sale reverted',
        payload: { reason: reason || 'Sale reverted' }
      });
      await order.save();
    }
    return { cancelledCount: orders.length };
  }
}

module.exports = new ServiceOrderOrchestrator();
