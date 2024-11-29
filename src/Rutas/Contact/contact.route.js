const express = require('express');
const router = express.Router();
const Contact = require('../../models/contact.schema'); // Cambia a tu modelo de contacto

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

// Obtener todos los contactos
// router.get('/', async (req, res) => {
//     try {
//         const contacts = await Contact.find();
//         res.status(200).send(contacts);
//     } catch (error) {
//         res.status(500).send(error);
//     }
// });

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

router.get('/', async (req, res) => {
    try {
      const contacts = await Contact.find()
        .populate({
          path: 'cotizations',   // Nombre del campo que referencia a las cotizaciones
          select: 'createdAt'    // Solo seleccionamos el campo createdAt de las cotizaciones
        });
  
      // Ahora, transformamos los contactos para devolver solo el id y la fecha de creación de las cotizaciones
      const contactsWithCotizations = contacts.map(contact => {
        return {
          ...contact.toObject(), // Convertimos el documento a un objeto para manipularlo
          cotizations: contact.cotizations.map(cotization => ({
            id: cotization._id,     // Incluimos el id de la cotización
            createdAt: cotization.createdAt  // Incluimos la fecha de creación
          }))
        };
      });
  
      res.status(200).json(contactsWithCotizations);  // Devolvemos los contactos con las cotizaciones
    } catch (error) {
      console.error(error);
      res.status(500).send(error);  // Error de servidor si ocurre algo mal
    }
  });

module.exports = router;