const mongoose = require('mongoose');
const Schema = mongoose.Schema

const QUOTE_STATUSES = {
  WIP: 'WIP',
  HOLD: 'HOLD',
  SOLD: 'SOLD',
  LOST: 'LOST',
};
const quoter = new Schema({ 
  name_version: {type:String, default: 'version 1'}, 
  status: {
    type: String,
    enum:['WIP','HOLD','SOLD','LOST',], // Usar los valores de las constantes
    required: true,
    default: 'WIP' // Asegurar que el campo sea obligatorio
},
  quoter_id: {type: Schema.Types.ObjectId, ref: 'Quoter'} 
},{_id: false})
const contactSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    source: { type: String },
    cotizations: [quoter] 
  },{ timestamps: true });
  
  // module.exports = {
  //   Contact: mongoose.model('Contact', contactSchema),
  //   QUOTE_STATUSES, // Exporta las constantes de los estados
  // };
  module.exports = mongoose.model('Contact', contactSchema);