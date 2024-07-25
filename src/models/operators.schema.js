const mongoose = require('mongoose');

const Schema = mongoose.Schema

const VehiculoEnum = [
    'Camioneta',
    'Van',
    'Sprinter',
    'MiniBus',
    'Bus',
    'Sin especificar'
  ];

const price_ppSchema = new Schema({
    range_min: Number,
    range_max: Number,
    type_vehicle: { type: String, enum: VehiculoEnum },
    price:{
        type: Number
    }
}, { _id: false });

const ServicioSchema = new Schema({
    descripcion: {type: String},
    prices: [price_ppSchema],
    observaciones: {type: String}
});

const OperatorSchema = new Schema({
    operador: {type: String},
    ciudad: {type: String},
    name_service: {type: String},
    servicios: [ServicioSchema],
    // observaciones: {type: String} 
  },{timestamps: true});

  module.exports = mongoose.model('Operators',OperatorSchema)