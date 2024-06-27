const mongoose = require('mongoose');

const Schema = mongoose.Schema

const restaurantSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price_pp:{
        type: Schema.Types.Decimal128,
        required: true
    },
    child_rate: {
        type: [Number],
        required: false
    },
    price_guide_pp: {
        type: Schema.Types.Decimal128,
        required: true
    },
    special_dates: [specialDateSchema],
    closing_date: {
        type: String,
        required: false
    },
    schedules: {
        type: String,
        required: false
    },
    location:{
        type: String,
        required: false
    },
    take_notes:{
        type: String,
        required: false
    },
    nearby_places: {
        type: String,
        required: false
    },
    politica_canc: {
        type: String,
        required: false
    },
    contac_phone: {
        type: String,
        reuired: false
    },
    observaciones: {
        type: String,
        required: false
    }
    
})


const specialDateSchema = new Schema({
    date: {
        type: Date,
        required: false,
    },
    price: {
        type: Schema.Types.Decimal128,
        required: false
    },
    porcentaje: {
        type: Number,
        required: false
    }
}) 


module.exports = mongoose.model('Restaurant', restaurantSchema);