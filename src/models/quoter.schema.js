const mongoose = require('mongoose');

const Schema = mongoose.Schema

// const ServicesSchema = Schema({
//     day: {type: Number},
//     date: {type: String},
//     city: {type: String},
//     name_service: {type: String},
//     price_base:{type: Number},
//     prices:[Number],   
//     total_prices:[Number],
//     notes: {type: String}
// }, { _id: false })

const DaySchema= new Schema({
    
    city: { type: String},
    name_service: { type: String },
    price_base: { type: Number}, // Precio base del servicio
    prices: [Number], // Array de precios adicionales
    notes: { type: String }
});

const ServicesSchema = new Schema({
    day: { type: Number, required: true }, // Número de día (1, 2, 3, etc.)
    date: { type: String},
    services: [DaySchema] // Array de servicios para cada día
});

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
    total_cost:[Number],
    external_utility:[Number],
    cost_external_taxes:[Number],
    total_cost_external:[Number],
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
const OperatorsSchema = Schema({
    country: {type: String},
    name_operator: {type: String},
    city: {type: String},
    prices:[Number],   
    notes: {type: String}
}, { _id: false })

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
    operators: [OperatorsSchema],
    total_prices:totalPrices
    // services2:[{
    //     service_id: { type: Schema.Types.ObjectId, refPath: 'services2.type_service' },  // Referencia dinámica
    //         type_service: { type: String, required: true, enum: ['Entrances', 'Expeditions'] },  // Tipos de servicio
    //         price: { type: Number }  // Precio en el momento de la cotización
    // }]

},{timestamps: true})
 module.exports = mongoose.model('Quoter',quoterSchema);