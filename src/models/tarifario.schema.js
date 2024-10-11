const mongoose = require('mongoose');

const tarifarioSchema = new mongoose.Schema({
    year: { type: Number, required: true },
    categories: [{
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Categories' },
        services: [{
            serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Services' },
            price: { type: Number }
        }]
    }]
}, { timestamps: true });

module.exports = mongoose.model('Tarifarios', tarifarioSchema);