const mongoose = require('mongoose');

const Schema = mongoose.Schema

const PriceSchema = new Schema({
    type: {
        type: String // Puede ser 'SWB', 'DWB', 'TRP'
    },
    confidential: {
        type: Number // Precio de CONFIDENTIAL
    },
    rack: {
        type: Number // Precio de RACK PRICES
    }
}, { _id: false });


const SpecialDatesSchema = new Schema({
    date: {
        type: String
    },
    price: {
        type: Number
    }
}, { _id: false });

const ServicesSchema = new Schema({
    name_service: {
        type: String
    },
    roomPrices: [PriceSchema],   
    
});

// Colección principal: Hoteles
const HotelSchema = new Schema({
    name: {
        type: String
    },
    location: {
        type: String
    },
    services: [ServicesSchema],
    special_dates: [SpecialDatesSchema],
    informacion_general: { type: Map,
        of: Schema.Types.Mixed },
    year: {type:String}    
},{timestamps: true});

module.exports = mongoose.model('Hotel', HotelSchema);