const mongoose = require('mongoose');
const Schema = mongoose.Schema

const quoter = new Schema({ 
  name_version: {type:String, default: 'version 1'}, 
  quoter_id: {type: Schema.Types.ObjectId, ref: 'Quoter'} 
},{_id: false})
const contactSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    source: { type: String },
    cotizations: [quoter] 
  },{ timestamps: true });
  
  
  module.exports = mongoose.model('Contact', contactSchema);