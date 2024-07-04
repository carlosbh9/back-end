const mongoose = require('mongoose');

const Schema = mongoose.Schema

const typeVehicleSchema = new Schema({
    name_type_vehicle: {
        type: String
    },
    price:{
        type: Number
    }
}, { _id: false });

const transportationSchema = new Schema({
    nombre: {
        type: String
    },
    type_service:{
        type: String
    },
    type_vehicle:[typeVehicleSchema],
    info: {
        type: String
    }
},{timestamps: true});

module.exports = mongoose.model('Transportation',transportationSchema);