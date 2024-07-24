const mongoose = require('mongoose');

const Schema = mongoose.Schema

const guideSchema = new Schema({
    name_guide:{
        type: String
    },
    type_guide: {
        type: String,
        enum: ['Half day', 'Full day','Regular']
    },
    price_guide:{
        type: Number
    },
    observations: {
        type: String
    }
},{timestamps: true});

module.exports = mongoose.model('Guides', guideSchema);
//falta especificar consideraciones y importante info