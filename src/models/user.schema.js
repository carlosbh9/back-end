const mongoose = require('mongoose');
const Schema = mongoose.Schema

const userSchema = Schema({
  username: { type: String ,required: true, unique: true},
  password: { type: String },
  role: { type: String, enum: ['admin', 'TD', 'OPE','ventas'], default: 'viewer' },
  image: { type: String, default: 'default.jpg' }, // URL de la imagen del usuario
  name: { type: String, required: true },
  contacts: [{ type: Schema.Types.ObjectId, ref: 'Contact' }] 
},{ timestamps: true });

// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 10); // Encriptar contraseña
//   next();
// });

module.exports = mongoose.model('User', userSchema);
// , required: true, unique: true