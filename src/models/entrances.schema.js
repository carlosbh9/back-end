const mongoose = require('mongoose');

const Schema = mongoose.Schema

const entranceSchema = new Schema({
    description: {type: String, required: true},
    price_pp: {type: Number, required: true},
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
})
 module.exports = mongoose.model('Entrances',entranceSchema);