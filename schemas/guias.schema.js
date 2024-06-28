const mongoose = require('mongoose');

const Schema = mongoose.Schema

const guiasSchema = new Schema({
    name_guide:{
        type: String,
        required: true
    },
    type_guide: {
        type: String,
        required: false
    },
    price_guide:{
        type: Schema.Types.Decimal128,
        required: false
    },
    observations: {
        type: String,
        required: false
    }
});
//falta especificar consideraciones y importante info