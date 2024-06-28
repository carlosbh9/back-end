const mongoose = require('mongoose');

const Schema = mongoose.Schema

const priceSchema = new Schema({
    groupSize: {
        type: Number,
        required: true
    },
    pricePerPerson: {
        type: Number,
        required: true
    }
}, { _id: false });

const experienceSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    prices: [priceSchema],
    childRate: {
        pp: {
            type: Number,
            default: null
        },
        upTo: {
            type: Number,
            default: null
        },
        minimumAge: {
            type: String,
            default: null
        }
    },
    guide_price: {
        type: Number,
        default: true
    },
    approximateDuration: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Experience', experienceSchema);