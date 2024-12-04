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
            type: Number,
            default: null
        }
    },
    guide_price: {
        type: Number
    },
    approximateDuration: {
        type: String
    },
    priceperson: { 
        type: Boolean, 
        required: true
    },
    guide: {
        type: Boolean,
        default: false
    },
    take_notes:{type:String},
    politica_canc:{type: String},
    contac_phone:{type:String},
    year: {type:String}
},{timestamps: true});

module.exports = mongoose.model('Experience', experienceSchema);