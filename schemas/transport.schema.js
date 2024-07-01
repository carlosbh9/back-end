const mongoose = require('mongoose');

const Schema = mongoose.Schema

const typeVehicleSchema = new Schema({
    name_type_vehicle: {
        type: String,
        required: true
    },
    price:{
        type: Schema.Types.Decimal128,
        required: true
    }
}, { _id: false });

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

module.exports = mongoose.model('Transportation',transportationSchema);