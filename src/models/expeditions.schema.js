const mongoose = require('mongoose');

const Schema = mongoose.Schema

const expeditionsSchema = new Schema({
    name:{
        type: String
    },
    price_pp:{
        type: Number
    },
    remarks: {
        type: String
    }
},{timestamps: true});

module.exports  = mongoose.model('Expeditions', expeditionsSchema);