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

const SpecialDatesSchema = new Schema({
    date: {
        type: String
    },
    price: {
        type: Number
    }
}, { _id: false });

const ServicesSchema = new Schema({
    name_service: {
        type: String
    },
    tipo_habitaciones: [TipoHabitacionSchema],   
    
});

// Colección principal: Hoteles
const HotelSchema = new Schema({
    name: {
        type: String
    },
    location: {
        type: String
    },
    services: [ServicesSchema],
    special_dates: [SpecialDatesSchema],
    informacion_general: { type: Map,
        of: Schema.Types.Mixed }
},{timestamps: true});

module.exports = mongoose.model('Hotel', HotelSchema);