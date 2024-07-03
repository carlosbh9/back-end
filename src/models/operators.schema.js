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
    descripcion: {type: String, required: true},
    prices: [price_ppSchema],
    observaciones: {type: String, required: false}
}, { _id: false });

const OperatorSchema = new Schema({
    operador: {type: String, required: true},
    ciudad: {type: String, required: true},
    name_service: {type: String, required: true},
    servicios: [ServicioSchema],
    observaciones: {type: String, required: false} 
  });

  module.exports = mongoose.model('Operators',OperatorSchema)