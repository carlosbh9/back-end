const mongoose = require('mongoose');

const Schema = mongoose.Schema

const guideSchema = new Schema({
    name_guide:{
        type: String,
        required: true
    },
    type_guide: {
        type: String,
        required: false
    },
    price_guide:{
        type: Number,
        required: false
    },
    observations: {
        type: String,
        required: false
    }
});

module.exports = mongoose.model('Guides', guideSchema);
//falta especificar consideraciones y importante info