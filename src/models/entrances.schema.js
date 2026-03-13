const mongoose = require('mongoose');
const Tariff = require('./tarifario.schema');

const Schema = mongoose.Schema;

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
    take_note: {type: String},
    year: {type:String}
},{timestamps: true});

module.exports = mongoose.models.Entrances || Tariff.discriminator('Entrances', entranceSchema);
