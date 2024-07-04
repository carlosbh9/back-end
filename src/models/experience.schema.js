const mongoose = require('mongoose');

const Schema = mongoose.Schema

const priceSchema = new Schema({
    groupSize: {
        type: Number
    },
    pricePerPerson: {
        type: Number
    }
}, { _id: false });

const experienceSchema = new Schema({
    name: {
        type: String
    },
    category: {
        type: String
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
        type: Number
    },
    approximateDuration: {
        type: String
    }
},{timestamps: true});

module.exports = mongoose.model('Experience', experienceSchema);