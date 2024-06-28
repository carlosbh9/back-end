const mongoose = require('mongoose');

const Schema = mongoose.Schema
const priceSchema = new Schema({
    season: {
        type: String,
        enum: ['High', 'Low'],
        required: true
    },
    adultPrice: {
        type: Number,
        required: true
    },
    childPrice: {
        type: Number,
        required: true
    }
}, { _id: false });

const serviceSchema = new Schema({
    serviceName: {
        type: String,
        required: true
    },
    prices: [priceSchema],
    observations: {
        type: String,
        default: ''
    }
}, { _id: false });

const trainSchema = new Schema({
    company: {
        type: String,
        required: true
    },
    services: [serviceSchema]
});



module.exports = mongoose.model('Train', trainSchema);