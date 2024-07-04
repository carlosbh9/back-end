const mongoose = require('mongoose');

const Schema = mongoose.Schema


const TipoHabitacionSchema = new Schema({
    tipo_servicio: {
        type: String
    },
    tipo_habitacion: {
        type: String // Cambiar a otro tipo si necesario
    },
    price: {
        type: Number
    }
}, { _id: false });

// Subcolección: InformacionGeneral
const InformacionGeneralSchema = new Schema({
    check_in: {
        type: Date
    },
    check_out: {
        type: Date
    },
    breakfast: {
        type: Date
    },
    box_breakfasts: {
        type: Date
    },
    spa: {
        type: Boolean
    },
    gym: {
        type: Boolean
    },
    piscina: {
        type: Boolean
    },
    agua: {
        type: Boolean
    },
    dinner: {
        type: Boolean
    },
    cuna: {
        type: Boolean
    },
    bar: {
        type: Boolean
    },
    hab_conectantes: {
        type: Boolean
    },
    oxigeno: {
        type: Boolean
    }
}, { _id: false });

// Colección principal: Hoteles
const HotelSchema = new Schema({
    nombre: {
        type: String
    },
    destinations: {
        type: String
    },
    servicio: {
        type: String
    },
    special_dates: {
        type: [String]
    },
    tipo_habitaciones: [TipoHabitacionSchema],
    informacion_general: InformacionGeneralSchema
},{timestamps: true});

module.exports = mongoose.model('Hotel', HotelSchema);