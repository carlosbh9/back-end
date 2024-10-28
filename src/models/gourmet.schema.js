const mongoose = require('mongoose');

const Schema = mongoose.Schema

const LimaGourmetSchema = new Schema({
    code: {type: String},
    activitie: {type: String},
    price_pp:{type: Number},
    price_for_one_person:{type: Number},
    childRate: {
        from: {
            type: Number,
            default: null
        },
        upTo: {
            type: Number,
            default: null
        },
        price: {
            type: Number,
            default: null
        },
    },
    aprox_duration: {type: String},
    closing_date: [{ date: { type: String }, _id: false }],
    year: {type:String}
},{timestamps: true})

 module.exports = mongoose.model('LimaGourmet',LimaGourmetSchema);