const mongoose = require('mongoose');
const Schema = mongoose.Schema

const userSchema = Schema({
  username: { type: String ,required: true, unique: true},
  password: { type: String },
  role: { type: String },
  image: { type: String, default: 'default.jpg' }, // URL de la imagen del usuario
  name: { type: String, required: true }
},{ timestamps: true });

// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 10); // Encriptar contraseña
//   next();
// });
// Contacts are owned from the Contact collection through `owner`.
// Keep this as a virtual relation only; do not persist contact ids inside User.
userSchema.virtual('contacts', {
  ref:          'Contact',
  localField:   '_id',
  foreignField: 'owner'
});

module.exports = mongoose.model('User', userSchema);
// , required: true, unique: true
