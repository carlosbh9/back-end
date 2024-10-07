const mongoose = require('mongoose');

const Schema = mongoose.Schema

const ServicesSchema = Schema({
    day: {type: Number},
    date: {type: String},
    city: {type: String},
    name_service: {type: String},
    price_base:{type: Number},
    prices:[Number],   
    total_prices:[Number],
    notes: {type: String}
}, { _id: false })

const hotelSchema = new Schema({
    day: {type:Number},
    date:{type: String},
    city: {type: String},
    name_hotel:{type: String},
    price_base:{type: Number},
    prices:[Number],
    total_prices:[Number],
    accomodatios_category:{type:String},
    notes: {type: String}
}, { _id: false })
 


const flightsSchema = new Schema({
    date: {type: String},
    route: {type:String},
    price_conf: {type: Number},
    prices:[Number],
    total_prices:[Number],
    notes: {type:String}
}, { _id: false })

const totalPrices = new Schema({
    total_hoteles:[Number],
    total_services:[Number],
    total_ext_operator:[Number],
    total_ext_cruises:[Number],
    total_flights:[Number],
    subtotal: [Number],
    cost_transfers:[Number],
    final_cost:[Number],
    price_pp:[Number]

},{_id:false})

const quoterSchema = new Schema({
    guest: {type: String},
    FileCode: {type:String},
    travelDate:{
        start:String,
        end: String
    },
    accomodations: {type: String},
    totalNights: {type:String},
    number_paxs:[Number],
    travel_agent:{type:String},
    exchange_rate:{type:String},
    services:[ServicesSchema],
    hotels:[hotelSchema],
    flights:[flightsSchema],
    total_prices:[totalPrices]

},{timestamps: true})
 module.exports = mongoose.model('Quoter',quoterSchema);