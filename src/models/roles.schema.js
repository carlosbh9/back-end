const mongoose = require('mongoose');
const Schema = mongoose.Schema

const Roles = Schema({
    nameRole:{type: String},
    name: {type: String,unique: true,required: true},
    permissions:[String],
},{ timestamps: true });

module.exports = mongoose.model('Roles', Roles);