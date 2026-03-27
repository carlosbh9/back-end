require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../../db/db');
const ServiceOrderTemplate = require('../models/service_order_template.schema');

function buildStage(code, label, order, color, checklistTemplate = [], extras = {}) {
  return {
    code,
    label,
    order,
    color,
    description: extras.description || '',
    isFinal: extras.isFinal === true,
    requireCommentOnEnter: extras.requireCommentOnEnter === true,
    requireCommentOnComplete: extras.requireCommentOnComplete === true,
    requiredAttachments: extras.requiredAttachments || [],
    checklistTemplate
  };
}

const templates = [
  {
    code: 'hotel-reservation-standard',
    name: 'Hotel Reservation Standard',
    active: true,
    isDefault: true,
    type: 'HOTEL',
    area: 'RESERVAS',
    defaultPriority: 'HIGH',
    slaDays: 2,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'validate-hotel', label: 'Validate hotel and dates', required: true, helpText: 'Review room category, dates and city.' }
      ]),
      buildStage('SUPPLIER_CONTACTED', 'Supplier Contacted', 2, 'blue', [
        { itemId: 'contact-supplier', label: 'Contact supplier', required: true, helpText: 'Send request and keep reference.' }
      ], { requireCommentOnEnter: true }),
      buildStage('CONFIRMED', 'Confirmed', 3, 'emerald', [
        { itemId: 'save-confirmation', label: 'Save confirmation code', required: true, helpText: 'Store locator or hotel confirmation.' }
      ], { requiredAttachments: ['RESERVATION_CONFIRMATION'] }),
      buildStage('DONE', 'Done', 4, 'emerald', [], { isFinal: true })
    ]
  },
  {
    code: 'transport-operation-standard',
    name: 'Transport Operation Standard',
    active: true,
    isDefault: true,
    type: 'TRANSPORT',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 2,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'validate-transfer', label: 'Validate transfer details', required: true, helpText: 'Check route, date and pax.' }
      ]),
      buildStage('ASSIGNED', 'Assigned', 2, 'blue', [
        { itemId: 'assign-unit', label: 'Assign vehicle/provider', required: true, helpText: 'Define supplier and vehicle.' }
      ], { requireCommentOnEnter: true }),
      buildStage('READY', 'Ready', 3, 'amber', [
        { itemId: 'brief-driver', label: 'Send operation briefing', required: true, helpText: 'Share pickup and passenger details.' }
      ]),
      buildStage('DONE', 'Done', 4, 'emerald', [], { isFinal: true })
    ]
  },
  {
    code: 'tour-provider-confirmation',
    name: 'Tour Provider Confirmation',
    active: true,
    isDefault: true,
    type: 'TOUR',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 2,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'validate-tour', label: 'Validate tour service', required: true, helpText: 'Check date, city and service line.' }
      ]),
      buildStage('PENDING_PROVIDER', 'Pending Provider', 2, 'amber', [
        { itemId: 'send-booking-request', label: 'Send booking request', required: true, helpText: 'Share service details with provider.' }
      ], { requireCommentOnEnter: true }),
      buildStage('CONFIRMED', 'Confirmed', 3, 'emerald', [
        { itemId: 'voucher-ready', label: 'Prepare voucher', required: true, helpText: 'Voucher or provider confirmation must be available.' }
      ], { requiredAttachments: ['VOUCHER'] }),
      buildStage('DONE', 'Done', 4, 'emerald', [], { isFinal: true })
    ]
  },
  {
    code: 'tickets-issuance-standard',
    name: 'Tickets Issuance Standard',
    active: true,
    isDefault: true,
    type: 'TICKETS',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 1,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'validate-ticket-data', label: 'Validate ticket data', required: true, helpText: 'Check names and route.' }
      ]),
      buildStage('ISSUED', 'Issued', 2, 'blue', [
        { itemId: 'issue-ticket', label: 'Issue ticket', required: true, helpText: 'Ticket should be generated and recorded.' }
      ], { requiredAttachments: ['TICKET'] }),
      buildStage('DELIVERED', 'Delivered', 3, 'emerald', [
        { itemId: 'send-ticket', label: 'Send ticket to client', required: true, helpText: 'Confirm delivery channel.' }
      ]),
      buildStage('DONE', 'Done', 4, 'emerald', [], { isFinal: true })
    ]
  },
  {
    code: 'prepayment-control-basic',
    name: 'Prepayment Control Basic',
    active: true,
    isDefault: true,
    type: 'PREPAYMENT',
    area: 'CONTABILIDAD',
    defaultPriority: 'HIGH',
    slaDays: 1,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'review-amount', label: 'Review prepayment amount', required: true, helpText: 'Validate expected amount.' }
      ]),
      buildStage('REGISTERED', 'Registered', 2, 'blue', [
        { itemId: 'register-request', label: 'Register prepayment request', required: true, helpText: 'Create accounting control.' }
      ], { requireCommentOnEnter: true }),
      buildStage('DONE', 'Done', 3, 'emerald', [], { isFinal: true })
    ]
  },
  {
    code: 'invoice-control-standard',
    name: 'Invoice Control Standard',
    active: true,
    isDefault: true,
    type: 'INVOICE',
    area: 'CONTABILIDAD',
    defaultPriority: 'HIGH',
    slaDays: 3,
    blocking: true,
    defaultStageCode: 'REQUESTED',
    stages: [
      buildStage('REQUESTED', 'Requested', 1, 'slate', [
        { itemId: 'review-billing-data', label: 'Review billing data', required: true, helpText: 'Validate invoice recipient and amount.' }
      ]),
      buildStage('DRAFTED', 'Drafted', 2, 'blue', [
        { itemId: 'draft-invoice', label: 'Draft invoice', required: true, helpText: 'Draft should be ready for issue.' }
      ]),
      buildStage('ISSUED', 'Issued', 3, 'amber', [
        { itemId: 'issue-invoice', label: 'Issue invoice to client', required: true, helpText: 'Invoice must be delivered.' }
      ], { requiredAttachments: ['INVOICE'] }),
      buildStage('DONE', 'Done', 4, 'emerald', [], { isFinal: true })
    ]
  }
];

async function seed() {
  await connectDB();
  for (const template of templates) {
    await ServiceOrderTemplate.findOneAndUpdate(
      { code: template.code },
      { $set: template },
      { upsert: true, new: true, runValidators: true }
    );
  }
  console.log(`Seeded ${templates.length} workflow templates.`);
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error('Error seeding service order templates:', error);
  await mongoose.connection.close();
  process.exit(1);
});
