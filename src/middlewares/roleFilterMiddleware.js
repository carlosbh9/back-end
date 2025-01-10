const express = require('express');
const router = express.Router();
const User = require('../models/user.schema');
const Contact = require('../models/contact.schema')
const  { authenticate, authorize }= require('../middlewares/auth')


 // Ruta protegida
router.get('/contacts', authenticate, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
  
    if (userRole === 'admin' || 'ventas') {
      Contact.find()
        .then(contacts => res.json(contacts))
        .catch(err => res.status(500).json({ message: 'Error al obtener contactos', error: err }));
    } else {
       // Si el usuario no es admin, devuelve solo los contactos asignados a ese usuario
       const user = await User.findById(userId).populate('contacts'); // Populate para cargar los contactos del usuario
       if (!user) {
         return res.status(404).json({ message: 'Usuario no encontrado' });
       }
       
       return res.json(user.contacts);
    }
  });
  

  module.exports = router;