const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const childRateSchema = new Schema({
    price_pp: {
        type: Number
    },
    upTo: {
        type: Number
    }
}, { _id: false });

const specialDateSchema = new Schema({
    date: {
        type: String
    },
    price_add: {
        type: Number
    }
}, { _id: false });

const closingDateSchema = new Schema({
    date: {
        type: String
    },
    price_add:{
        type: Number
    }
}, { _id: false });

const restaurantSchema = new Schema({
    name: {
        type: String
    },
    price_pp:{
        type: Number
    },
    child_rate: [childRateSchema],
    price_guide_pp: {
        type: Number
    },
    special_dates: [specialDateSchema],
    closing_date: [closingDateSchema],
    schedules: {
        type: String
    },
    location:{
        type: String
    },
    take_notes:{
        type: String
    },
    nearby_places: {
        type: String
    },
    politica_canc: {
        type: String
    },
    contac_phone: {
        type: String
    },
    observaciones: {
        type: String
    }
    
},{timestamps: true});


// // Middleware to convert dates to desired time zone when converting to JSON
// restaurantSchema.set('toJSON', {
//     transform: (doc, ret) => {
//       const timeZone = 'America/Lima'; // Use the time zone for Peru
//       if (ret.special_dates) {
//         ret.special_dates = ret.special_dates.map(dateObj => ({
//           ...dateObj,
//           date: moment(dateObj.date).tz(timeZone).format()
//         }));
//       }
//       if (ret.closing_date) {
//         ret.closing_date = ret.closing_date.map(dateObj => ({
//           ...dateObj,
//           date: moment(dateObj.date).tz(timeZone).format()
//         }));
//       }
//       return ret;
//     }
//   });

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
