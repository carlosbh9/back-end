const mongoose = require('mongoose');

const Schema = mongoose.Schema

const activitiesSchema = new Schema({
    description: {type: String, required: true},
    price_pp: {type: Schema.Types.Decimal128, required: true},
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
 module.exports = mongoose.model('Activities',activitiesSchema);