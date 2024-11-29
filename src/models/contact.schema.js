const mongoose = require('mongoose');
const Schema = mongoose.Schema


const contactSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    source: { type: String },
    cotizations: [{ type: Schema.Types.ObjectId, ref: 'Quoter' }] // Cotizaciones asociadas
  },{ timestamps: true });
  
  
  module.exports = mongoose.model('Contact', contactSchema);