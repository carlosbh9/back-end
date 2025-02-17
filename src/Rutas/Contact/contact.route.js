const express = require('express');
const router = express.Router();
const Contact = require('../../models/contact.schema'); 
const User = require('../../models/user.schema')
const  { authenticate, authorize }= require('../../middlewares/auth');

// Crear un nuevo contacto
router.post('/',authorize(['TD','admin','ventas']),async (req, res) => {
    try {
        const contact = new Contact(req.body);
        await contact.save();
        res.status(201).send(contact);
    } catch (error) {
        res.status(400).send(error);
    }
});
// Ruta para obtener todas las cotizaciones de todos los contactos
router.get('/all-cotizations',authorize(['TD','admin','ventas']), async (req, res) => {
    try {
        const cotizations = await Contact.aggregate([
            {
                $unwind: {
                    path: '$cotizations',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    contactId: '$_id',
                    contactName: '$name',
                    cotization: '$cotizations',
                    _id: 0
                }
            }
        ]);

        res.status(200).json(cotizations);
    } catch (error) {
        console.error('Error al extraer cotizaciones:', error);
        res.status(500).send({ error: 'Error al obtener las cotizaciones' });
    }
});
router.get('/all-contacts', authenticate,authorize(['TD','admin','ventas']), async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const allowedRoles = ['admin', 'ventas'];

    if (allowedRoles.includes(userRole)) {
      Contact.find()
        .then(contacts => res.json(contacts))
        .catch(err => res.status(500).json({ message: 'Error al obtener contactos', error: err }));
    } else {
       // Si el usuario no es admin, devuelve solo los contactos asignados a ese usuario
       const user = await User.findById(userId).populate({path:'contacts',select:'name _id'}); // Populate para cargar los contactos del usuario
       if (!user) {
         return res.status(404).json({ message: 'Usuario no encontrado' });
       }
       
       return res.json(user.contacts);
    }
});
router.get('/', authenticate,authorize(['TD','admin','ventas']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const allowedRoles = ['admin', 'ventas'];
        
        // Obtener parámetros de paginación
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const filter = req.query.filter || '';
        const skip = (page - 1) * pageSize;
        const getAll = req.query.all === 'true'

        const filterCriteria = filter ? { name: { $regex: new RegExp(filter, 'i') } } : {};

        let contacts;
        let totalContacts;

        if (allowedRoles.includes(userRole)) {
            if(getAll){
                contacts = await Contact.find(filterCriteria).limit(pageSize).select('name _id');
                totalContacts = contacts.length;
            }else {
                // Obtener todos los contactos con paginación
                totalContacts = await Contact.countDocuments();
                contacts = await Contact.find(filterCriteria).skip(skip).limit(pageSize);
            }
            
        } else {
            // Obtener solo los contactos asignados al usuario
            const user = await User.findById(userId).populate({
                path: 'contacts',
                match: filterCriteria ,
                options: getAll ? {} : { skip, limit: pageSize },
            });
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            totalContacts = user.contacts.length;
            contacts = user.contacts;
        }

        res.json({ contacts, totalContacts, page, pageSize });
    } catch (err) {
        console.error('Error al obtener contactos:', err);
        res.status(500).json({ message: 'Error interno al obtener contactos', error: err });
    }
});


//Obtener un contacto por ID
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
router.patch('/:id',authorize(['TD','admin','ventas']), async (req, res) => {
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
router.delete('/:id', authorize(['TD','admin','ventas']), async (req, res) => {
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