const mongoose = require('mongoose');

const Schema = mongoose.Schema


const TipoHabitacionSchema = new Schema({
    tipo_servicio: {
        type: String,
        required: true
    },
    tipo_habitacion: {
        type: String, // Cambiar a otro tipo si necesario
        required: true
    },
    price: {
        type: Number,
        required: true
    }
}, { _id: false });

// Subcolección: InformacionGeneral
const InformacionGeneralSchema = new Schema({
    check_in: {
        type: Date,
        required: false
    },
    check_out: {
        type: Date,
        required: false
    },
    breakfast: {
        type: Date,
        required: false
    },
    box_breakfasts: {
        type: Date,
        required: false
    },
    spa: {
        type: Boolean,
        required: false
    },
    gym: {
        type: Boolean,
        required: false
    },
    piscina: {
        type: Boolean,
        required: false
    },
    agua: {
        type: Boolean,
        required: false
    },
    dinner: {
        type: Boolean,
        required: false
    },
    cuna: {
        type: Boolean,
        required: false
    },
    bar: {
        type: Boolean,
        required: false
    },
    hab_conectantes: {
        type: Boolean,
        required: false
    },
    oxigeno: {
        type: Boolean,
        required: false
    }
}, { _id: false });

// Colección principal: Hoteles
const HotelSchema = new Schema({
    nombre: {
        type: String,
        required: true
    },
    destinations: {
        type: String,
        required: true
    },
    servicio: {
        type: String,
        required: true
    },
    special_dates: {
        type: [String],
        required: true
    },
    tipo_habitaciones: [TipoHabitacionSchema],
    informacion_general: InformacionGeneralSchema
});

module.exports = mongoose.model('Hotel', HotelSchema);