const mongoose = require('mongoose');

const Schema = mongoose.Schema

const trainSchema = new Schema({
    train_service: {
        type: String,
        required: true
    },
    price: {
        type: Schema.Types.Decimal128,
        required: true
    },
    temporada: {
        type: String,
        required: true  
    },
    descripcion: {
        type: String,
        required: false
    },
    observacion: {
        type: String,
        required: false 
    }
    
});

const temporadaSchema = new Schema({
    high: {
        type
    }
})
module.exports = mongoose.model('Train', trainSchema);