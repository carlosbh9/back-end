const mongoose = require('mongoose');

const Schema = mongoose.Schema

const transportationSchema = new Schema({
    nombre: {
        type: String,
        required: true
    },
    type_service:{
        type: String,
        required: true
    },
    type_vehicle:[typeVehicleSchema],
    info: {
        type: String,
        required: false
    }
});

const typeVehicleSchema = new Schema({
    name_type_vehicle: {
        type: String,
        required: true
    },
    price:{
        type: Schema.Types.Decimal128,
        required: true
    }
});

module.exports = mongoose.model('Transportation',transportationSchema);