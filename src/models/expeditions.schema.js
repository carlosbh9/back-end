const mongoose = require('mongoose');
const Tariff = require('./tarifario.schema');

const Schema = mongoose.Schema;

const expeditionsSchema = new Schema({
    name:{
        type: String
    },
    price_pp:{
        type: Number
    },
    priceperson: { 
        type: Boolean, 
        required: true
    },
    remarks: {
        type: String
    },
    year: {type:String}
},{timestamps: true});

module.exports = mongoose.models.Expeditions || Tariff.discriminator('Expeditions', expeditionsSchema);
