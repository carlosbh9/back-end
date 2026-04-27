const ServiceOrder = require('../../models/service_order.schema');
const ServiceOrderTemplate = require('../../models/service_order_template.schema');
const QuoterV2Schema = require('../../modules/quoter-v2/infrastructure/mongoose/quoter-v2.schema');

class ServiceOrderOrchestrator {
  normalizeText(value = '') {
    return String(value || '').trim();
  }

  buildAuditLog({ action, by = null, message = '', payload = {}, source = 'BUSINESS_EVENT' }) {
    return {
      action,
      by,
      message: this.normalizeText(message),
      payload: {
        source,
        ...payload,
      },
    };
  }

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
      const priceBase = this.toNumber(flight?.price_base ?? flight?.price_conf);
      const estimatedTotal = this.toNumber(flight?.price) || priceBase;
      items.push({
        type: 'TRANSPORT',
        lineKey: `flight-${index}-${this.slug(flight?.route)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'flight',
          lineIndex: index,
          date: flight?.date || '',
          route: flight?.route || '',
          priceBase,
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
      const priceBase = this.toNumber(cruise?.price_base ?? cruise?.price_conf);
      const estimatedTotal = this.toNumber(cruise?.price) || priceBase;
      items.push({
        type: 'TICKETS',
        lineKey: `cruise-${index}-${this.slug(cruise?.name)}`,
        sourceSnapshot: {
          ...baseSnapshot,
          category: 'cruise',
          lineIndex: index,
          name: cruise?.name || '',
          operator: cruise?.operator || '',
          priceBase,
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
      required: item.required !== false,
      helpText: item.helpText || '',
      status: 'PENDING'
    }));
    return checklist;
  }

  buildStageChecklist(stage) {
    return (stage?.checklistTemplate || []).map((item) => ({
      itemId: item.itemId,
      label: item.label,
      required: item.required !== false,
      helpText: item.helpText || '',
      status: 'PENDING',
      doneAt: null,
      doneBy: null
    }));
  }

  buildStagesSnapshot(template) {
    const stages = Array.isArray(template?.stages) ? [...template.stages] : [];
    if (!stages.length) return [];

    const sortedStages = stages.sort((a, b) => (a.order || 0) - (b.order || 0));
    const defaultStageCode = String(template?.defaultStageCode || sortedStages[0]?.code || '').toUpperCase();
    const activeStageCode = sortedStages.some((stage) => String(stage.code).toUpperCase() === defaultStageCode)
      ? defaultStageCode
      : String(sortedStages[0]?.code || '').toUpperCase();

    return sortedStages.map((stage) => {
      const stageCode = String(stage.code || '').toUpperCase();
      const isActive = stageCode === activeStageCode;
      return {
        code: stageCode,
        label: stage.label || stageCode,
        description: stage.description || '',
        color: stage.color || 'slate',
        order: Number(stage.order) || 1,
        isFinal: stage.isFinal === true,
        requireCommentOnEnter: stage.requireCommentOnEnter === true,
        requireCommentOnComplete: stage.requireCommentOnComplete === true,
        requiredAttachments: Array.isArray(stage.requiredAttachments) ? stage.requiredAttachments : [],
        status: isActive ? 'ACTIVE' : 'PENDING',
        startedAt: isActive ? new Date() : null,
        completedAt: null,
        checklist: this.buildStageChecklist(stage)
      };
    });
  }

  async buildTemplatesMap() {
    const templates = await ServiceOrderTemplate.find({ active: true }).sort({ isDefault: -1, type: 1, name: 1 }).lean();
    const map = new Map();
    for (const template of templates) {
      const current = map.get(template.type);
      if (!current || template.isDefault) {
        map.set(template.type, template);
      }
    }
    return map;
  }

  async buildChecklistFromTemplate(type, templatesMap = null) {
    const template = templatesMap?.get(type)
      || await ServiceOrderTemplate.findOne({ type, active: true }).sort({ isDefault: -1, name: 1 }).lean();
    if (!template) return { template: null, checklist: [], stagesSnapshot: [], currentStage: null };
    const checklist = this.buildChecklist(template);
    const stagesSnapshot = this.buildStagesSnapshot(template);
    const currentStage = stagesSnapshot.find((stage) => stage.status === 'ACTIVE') || null;
    return { template, checklist, stagesSnapshot, currentStage };
  }

  async createOrdersForContactSold({ contactId, soldQuoterId, fileId, changedBy }) {
    const quoterDoc = await QuoterV2Schema.findById(soldQuoterId).lean();
    if (!quoterDoc) {
      throw new Error(`Sold quoter not found: ${soldQuoterId}`);
    }
    if (!fileId) {
      throw new Error('fileId is required to create service orders');
    }

    const businessEventId = this.buildBusinessEventId({ contactId, soldQuoterId });
    const orderItems = this.extractOrderItemsFromQuoter(quoterDoc);
    const templatesMap = await this.buildTemplatesMap();
    const created = [];

    for (const item of orderItems) {
      const type = item.type;
      const lineKey = item.lineKey;
      const idempotencyKey = this.buildIdempotencyKey({ businessEventId, type, lineKey });
      const { template, checklist, stagesSnapshot, currentStage } = await this.buildChecklistFromTemplate(type, templatesMap);

      const dueDate = template?.slaDays >= 0
        ? new Date(Date.now() + template.slaDays * 24 * 60 * 60 * 1000)
        : null;

      const payload = {
        file_id: fileId,
        contactId,
        soldQuoterId,
        sourceQuoterId: soldQuoterId,
        businessEventId,
        idempotencyKey,
        area: template?.area || this.defaultAreaByType(type),
        type,
        priority: template?.defaultPriority || 'MEDIUM',
        dueDate,
        workflowTemplateId: template?._id || null,
        workflowTemplateCode: template?.code || '',
        workflowTemplateName: template?.name || '',
        currentStageCode: currentStage?.code || '',
        currentStageLabel: currentStage?.label || '',
        stagesSnapshot,
        checklist,
        sourceSnapshot: item.sourceSnapshot,
        createdBy: changedBy || null,
        updatedBy: changedBy || null,
        lastStatusChangeAt: new Date(),
        auditLogs: [this.buildAuditLog({
          action: 'CREATED',
          by: changedBy || null,
          message: 'Order created from CONTACT_SOLD event',
          payload: { kind: 'CREATION', businessEventId, idempotencyKey, type, lineKey }
        })]
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
    const now = new Date();
    const cancellationReason = this.normalizeText(reason) || 'Sale reverted';
    for (const order of orders) {
      const previousStatus = order.status;
      order.status = 'CANCELLED';
      order.lastStatusChangeAt = now;
      order.cancelledAt = now;
      order.cancelledBy = changedBy || null;
      order.cancellationReason = cancellationReason;
      order.completedAt = null;
      order.completedBy = null;
      order.updatedBy = changedBy || null;
      order.auditLogs.push(this.buildAuditLog({
        action: 'CANCELLED',
        by: changedBy || null,
        message: cancellationReason,
        payload: {
          kind: 'STATUS_TRANSITION',
          fromStatus: previousStatus,
          toStatus: 'CANCELLED',
          reason: cancellationReason,
          businessEventId,
        }
      }));
      await order.save();
    }
    return { cancelledCount: orders.length };
  }
}

module.exports = new ServiceOrderOrchestrator();
