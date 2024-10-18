const mongoose = require('mongoose');
const Schema = mongoose.Schema



const masterQuoterSchema = new Schema({
    name: { type: String, required: true },// Nombre de la opción programada
    days: {type: Number} ,
    destinations: {type:String} ,
    services: [
        {
            name_service:{type: String },
            service_id: { type: Schema.Types.ObjectId, required: true },  // ID del servicio referenciado
            service_type: { type: String, enum: ['entrance', 'restaurant', 'operator','expeditions','experience','guides','hotel','train','transport'], required: true },  // Tipo del servicio
            operator_service_id: { type: Schema.Types.ObjectId, required: false } , // ID del servicio específico dentro de un operador (si es 'operator')
            hotels_service_id: {type: Schema.Types.ObjectId, required: false},
            train_service_id: {type: Schema.Types.ObjectId, required: false }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('MasterQuoter', masterQuoterSchema);