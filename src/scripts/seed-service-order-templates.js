require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../../db/db');
const ServiceOrderTemplate = require('../models/service_order_template.schema');

const templates = [
  {
    type: 'HOTEL',
    area: 'RESERVAS',
    defaultPriority: 'HIGH',
    slaDays: 2,
    blocking: true,
    checklistTemplate: [
      { itemId: 'hotel-confirmation', label: 'Confirm hotel with supplier' },
      { itemId: 'hotel-voucher', label: 'Issue hotel voucher' }
    ]
  },
  {
    type: 'TRANSPORT',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 2,
    blocking: true,
    checklistTemplate: [
      { itemId: 'transport-provider', label: 'Confirm transport provider' },
      { itemId: 'transport-briefing', label: 'Share operation briefing' }
    ]
  },
  {
    type: 'TOUR',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 2,
    blocking: true,
    checklistTemplate: [
      { itemId: 'tour-booking', label: 'Book tour slots' },
      { itemId: 'tour-voucher', label: 'Issue tour voucher' }
    ]
  },
  {
    type: 'TICKETS',
    area: 'OPERACIONES',
    defaultPriority: 'MEDIUM',
    slaDays: 1,
    blocking: true,
    checklistTemplate: [
      { itemId: 'tickets-issued', label: 'Issue tickets' },
      { itemId: 'tickets-delivered', label: 'Deliver tickets to client' }
    ]
  },
  {
    type: 'PREPAYMENT',
    area: 'CONTABILIDAD',
    defaultPriority: 'HIGH',
    slaDays: 1,
    blocking: true,
    checklistTemplate: [
      { itemId: 'prepayment-request', label: 'Create prepayment request' },
      { itemId: 'prepayment-register', label: 'Register prepayment in accounting' }
    ]
  },
  {
    type: 'INVOICE',
    area: 'CONTABILIDAD',
    defaultPriority: 'HIGH',
    slaDays: 3,
    blocking: true,
    checklistTemplate: [
      { itemId: 'invoice-draft', label: 'Draft invoice' },
      { itemId: 'invoice-issued', label: 'Issue invoice to customer' }
    ]
  }
];

async function seed() {
  await connectDB();
  for (const template of templates) {
    await ServiceOrderTemplate.findOneAndUpdate(
      { type: template.type },
      { $set: template },
      { upsert: true, new: true }
    );
  }
  console.log(`Seeded ${templates.length} service order templates.`);
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error('Error seeding service order templates:', error);
  await mongoose.connection.close();
  process.exit(1);
});
