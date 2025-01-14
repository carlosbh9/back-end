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
    notes: { type: String , default: ''}
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
    price_base:{type: Number, defaulf: 0},
    prices:[Number],
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
    price_pp:[Number],
    porcentajeTD: {type: Number}

},{_id:false})
const OperatorsSchema = Schema({
    country: {type: String},
    name_operator: {type: String},
    city: {type: String},
    prices:[Number],   
    notes: {type: String}
   
}, { _id: false })

const CruisesSchema = Schema({
    name: {type: String},
    operator: {type: String},
    price_conf: {type: Number},
    prices:[Number],   
    notes: {type: String}
   
}, { _id: false })

const QUOTE_STATUSES = {
    WIP: 'WIP',
    HOLD: 'HOLD',
    SOLD: 'SOLD',
    LOST: 'LOST',
};

const quoterSchema = new Schema({
    contact_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guest: {type:String},
    travelDate:{
        start:String,
        end: String
    },
    accomodations: {type: String},
    destinations: [String],
    totalNights: {type:String},
    number_paxs:[Number],
    children_ages: [Number],
    travel_agent:{type:String},
    exchange_rate:{type:String},
    services:[ServicesSchema],
    hotels:[hotelSchema],
    flights:[flightsSchema],
    operators: [OperatorsSchema],
    cruises: [CruisesSchema],
    total_prices:totalPrices
},{timestamps: true})


// Esquema de la cotización
// const quoterSchema = new Schema({
//    // guest: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//     guest: { type: Schema.Types.ObjectId, ref: 'Contact' }, // Referencia al contacto
//     versions: [quoterVersionSchema], // Array de versiones de cotización
//     isApproved: { type: Boolean, default: false },
//   },{timestamps: true});


module.exports = mongoose.model('Quoter',quoterSchema);