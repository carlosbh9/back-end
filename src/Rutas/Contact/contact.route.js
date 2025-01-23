const express = require('express');
const router = express.Router();
const Contact = require('../../models/contact.schema'); 
const User = require('../../models/user.schema')
const  { authenticate, authorize }= require('../../middlewares/auth');

// Crear un nuevo contacto
router.post('/', async (req, res) => {
    try {
        const contact = new Contact(req.body);
        await contact.save();
        res.status(201).send(contact);
    } catch (error) {
        res.status(400).send(error);
    }
});

router.get('/', authenticate,authorize(['TD','admin','ventas']), async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const allowedRoles = ['admin', 'ventas'];

    if (allowedRoles.includes(userRole)) {
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

// Obtener un contacto por ID
router.get('/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return res.status(404).send();
        }
        res.status(200).send(contact);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un contacto por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!contact) {
            return res.status(404).send();
        }
        res.status(200).send(contact);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un contacto por ID
router.delete('/:id', async (req, res) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);
        if (!contact) {
            return res.status(404).send();
        }
        res.status(200).send(contact);
    } catch (error) {
        res.status(500).send(error);
    }
});



module.exports = router;