const mongoose = require('mongoose');

const Schema = mongoose.Schema

const expeditionsSchema = new Schema({
    name:{
        type: String,
        required: false
    },
    price_pp:{
        type: String,
        required: true
    },
    remarks: {
        type: String,
        required: false
    }
});

module.exports  = mongoose.model('Expeditions', expeditionsSchema);