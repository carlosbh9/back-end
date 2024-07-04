const mongoose = require('mongoose');

const Schema = mongoose.Schema

const entranceSchema = new Schema({
    description: {type: String},
    price_pp: {type: Number},
    childRate: {
        pp: {
            type: Number,
            default: null
        },
        upTo: {
            type: Number,
            default: null
        },
    },
    take_note: String
},{timestamps: true})
 module.exports = mongoose.model('Entrances',entranceSchema);