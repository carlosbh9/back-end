const mongoose = require('mongoose');
const Schema = mongoose.Schema


const quoter = new Schema({ 
  name_version: {type:String, default: 'version 1'}, 
  status: {
    type: String,
    enum:['WIP','HOLD','SOLD','LOST'], // Usar los valores de las constantes
    required: true,
    default: 'WIP' // Asegurar que el campo sea obligatorio
},
  quoter_id: {type: Schema.Types.ObjectId, ref: 'Quoter'},
  createQuoter: { type: Date, default: Date.now }, // Fecha de creación de la cotización 
},{_id: false},{ timestamps: true});

// const contactSchema = new Schema({
//     name: { type: String, required: true, unique: true, trim: true },
//     td_designed: {type:String},
//     status: {
//       type: String,
//       enum: ['WIP','HOLD','SOLD','LOST'],
//       default: 'WIP'
//     },
//     email: { type: String },
//     phone: { type: String },
//     source: { type: String },
//     cotizations: [quoter] 
//   },{ timestamps: true });
  
const contactSchema = new Schema({
  name:  { type: String, required: true, unique: true, trim: true },
  td_designed: {type:String},
  phone: String,
  email: String,
  soldQuoterId: {
    type: Schema.Types.ObjectId,
    default: null
  },
  status: {
      type: String,
      enum: ['WIP','HOLD','SOLD','LOST'],
      default: 'WIP'
    },
  /* …otros campos… */
  owner: {                                 // ← NUEVO
    type: Schema.Types.ObjectId,
    ref:  'User',
    required: true,
    index: true                            // para que el filtro sea rápido
  },
   cotizations: [quoter] 
}, { timestamps: true });


  module.exports = mongoose.model('Contact', contactSchema);
