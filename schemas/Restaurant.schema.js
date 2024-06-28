const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const specialDateSchema = new Schema({
    date: {
        type: Date,
        required: false,
    },
    price_add: {
        type: Number,
        required: false
    }
}, { _id: false });

const closingDateSchema = new Schema({
    date: {
        type: Date,
        required: false
    },
    price_add:{
        type: Number,
        required: false
    }
}, { _id: false });

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
    closing_date: [closingDateSchema],
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
    
});


module.exports = mongoose.model('Restaurant', restaurantSchema);


// const resSchema = mongoose.model('Restaurant',restaurantSchema);

// const newRestaurant = new resSchema({
//     name: "Restaurante Los Andes 2",
//     price_pp: 25.50,
//     child_rate: [10, 15],
//     price_guide_pp: 20.00,
//     special_dates: [
//         {
//             date: new Date("2024-12-25T00:00:00Z"),
//             price_add: 5
//         },
//         {
//             date: new Date("2024-12-31T00:00:00Z"),
//             price_add: 10
//         }
//     ],
//     closing_date: [
//         {
//             date: new Date("2024-01-01T00:00:00Z"),
//             price_add: 0
//         }
//     ],
//     schedules: "09:00 AM - 09:00 PM",
//     location: "Av. Principal 123, Cusco",
//     take_notes: "Requiere reservación previa",
//     nearby_places: "Plaza de Armas",
//     politica_canc: "Cancelación gratuita hasta 24 horas antes",
//     contac_phone: "+51 987 654 321",
//     observaciones: "Ofrecemos menú vegetariano"
// });

// newRestaurant.save()
//     .then(() => console.log('Restaurant saved successfully'))
//     .catch(err => console.error(err));
