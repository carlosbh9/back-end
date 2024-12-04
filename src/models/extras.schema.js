const mongoose = require('mongoose');

const Schema = mongoose.Schema

const extrasSchema = new Schema({
    name: {type: String},
    price: {type: Number},
    year: {type:String},
    priceperson: { 
        type: Boolean, 
        required: true
    },
    notes: {type: String}
},{timestamps: true})

 module.exports = mongoose.model('extras',extrasSchema);