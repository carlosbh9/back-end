const mongoose = require('mongoose');

const Schema = mongoose.Schema
const priceSchema = new Schema({
    season: {
        type: String,
        enum: ['High', 'Low','Regular']
    },
    adultPrice: {
        type: Number
    },
    childPrice: {
        type: Number
    }
}, { _id: false });

const serviceSchema = new Schema({
    serviceName: {
        type: String
    },
    prices: [priceSchema],
    observations: {
        type: String,
        default: ''
    }
}, { _id: false });

const trainSchema = new Schema({
    company: {
        type: String
    },
    services: [serviceSchema],
    observations: {type: String}
},{timestamps: true});



module.exports = mongoose.model('Train', trainSchema);