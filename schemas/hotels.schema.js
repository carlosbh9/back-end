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
});

// Subcolección: InformacionGeneral
const InformacionGeneralSchema = new Schema({
    check_in: {
        type: Date,
        required: true
    },
    check_out: {
        type: Date,
        required: true
    },
    breakfast: {
        type: Date,
        required: true
    },
    box_breakfasts: {
        type: Date,
        required: true
    },
    spa: {
        type: Boolean,
        required: true
    },
    gym: {
        type: Boolean,
        required: true
    },
    piscina: {
        type: Boolean,
        required: true
    },
    agua: {
        type: Boolean,
        required: true
    },
    dinner: {
        type: Boolean,
        required: true
    },
    cuna: {
        type: Boolean,
        required: true
    },
    bar: {
        type: Boolean,
        required: true
    },
    hab_conectantes: {
        type: Boolean,
        required: true
    },
    oxigeno: {
        type: Boolean,
        required: true
    }
});

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