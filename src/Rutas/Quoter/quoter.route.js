const express = require('express');
const router = express.Router();
const Quoter = require('../../../src/models/quoter.schema');
const Contact = require('../../models/contact.schema')
const User = require('../../models/user.schema')
const Boom = require('@hapi/boom');
//Crear una nueva cotización
router.post('/', async (req, res) => {
    try {
        const quoter = new Quoter(req.body);
        await quoter.save();
        res.status(201).send(quoter);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todas las cotizaciones
router.get('/', async (req, res) => {
    try {
        const quoters = await Quoter.find().select('_id guest contact_id name_quoter');
        res.status(200).send(quoters);
    } catch (error) {
        res.status(500).send(error);
    }
});

//Obtener una cotización por ID
router.get('/:id', async (req, res) => {
    try {
        const quoter = await Quoter.findById(req.params.id);
        if (!quoter) {
            return res.status(404).send(boomErrors.notFound('Error, ID no válida/encontrada'));
        }
        if (quoter.services && quoter.services.length > 0) {
            quoter.services.sort((a, b) => a.day - b.day);
        }
        if (quoter.hotels && quoter.hotels.length > 0) {
            quoter.hotels.sort((a, b) => a.day - b.day);
        }

        res.status(200).send(quoter);
    } catch (error) {
        res.status(500).send(error);
    }
});
// Eliminar una cotización por ID
// router.delete('/:id', async (req, res) => {
//     try {
//         const quoter = await Quoter.findByIdAndDelete(req.params.id);
//         if (!quoter) {
//             return res.status(404).send();
//         }
//         res.status(200).send(quoter);
//     } catch (error) {
//         res.status(500).send(error);
//     }
// });

// Eliminar una cotización por ID
router.delete('/:id', async (req, res) => {
    try {
        // Eliminar la cotización de la base de datos
        const quoter = await Quoter.findByIdAndDelete(req.params.id);
        if (!quoter) {
            return res.status(404).send({ message: 'Quoter not found' });
        }

        // Buscar el contacto que tiene esta cotización asociada
        const contact = await Contact.findOneAndUpdate(
            { 'cotizations.quoter_id': quoter._id },  // Buscar contacto que tiene esta cotización en el array 'cotizations'
            { $pull: { cotizations:{ quoter_id: quoter._id } } },  // Eliminar la cotización del array 'cotizations'
            { new: true } // Devuelve el contacto actualizado
        );

        if (!contact) {
            return res.status(404).send({ message: 'Contact not found or no cotization to remove' });
        }

        // Responder con la cotización eliminada
        res.status(200).send({ quoter, contact });
    } catch (error) {
        res.status(500).send({ message: 'Error deleting quoter and updating contact', error });
    }
});


// Actualizar una cotización por ID
router.patch('/:id', async (req, res) => {
    try {
        const quoter = await Quoter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!quoter) {
            return res.status(404).send();
        }
        res.status(200).send(quoter);
    } catch (error) {
        res.status(400).send(error);
    }
});



//crear un nuevo item
// router.post('/', async (req, res) => {
//     const { name_version, guest, FileCode, travelDate, totalNights,accomodations, number_paxs, travel_agent, exchange_rate, services, hotels, flights, operators, cruises, total_prices } = req.body;


//     try {
//       // Obtener el usuario logueado desde la solicitud
//       const userId = req.user.id;
//       // Verificar si el contacto ya existe
//       let contact = await Contact.findOne({ name: guest });  // Usamos el email como identificador único
  
//       if (!contact) {
//         // Si el contacto no existe, lo creamos
//         contact = new Contact({
//           name: guest,
  
//         });
  
//         // Guardamos el contacto
//         await contact.save();
  
  
//         // Asociar el contacto al usuario logueado
//         const user = await User.findById(userId);
//         if (!user) {
//           return res.status(404).json({ error: 'Usuario no encontrado' });
//         }
  
//         user.contacts.push(contact._id); // Agregar el contacto al array de contactos del usuario
//         await user.save();
//       }
  
//       // Crear la primera versión de la cotización
//       const quoter =new Quoter({
//       contact_id: contact._id,
//       guest,
//       FileCode,
//       travelDate,
//       accomodations, 
//       number_paxs,
//       totalNights, 
//       travel_agent, 
//       exchange_rate, 
//       services, 
//       hotels, 
//       flights, 
//       operators, 
//       cruises,
//       total_prices,  // Usar los precios totales de la cotización inicial
//       });
//       await quoter.save();
  
  
//       // Asociamos la cotización al contacto
//       contact.cotizations.push({name_version: name_version , quoter_id: quoter._id});
//       await contact.save();
  
//       // Respondemos con la cotización creada
//       res.status(201).json(contact);
//     } catch (error) {
//       if (error.isBoom) {
//         return next(error); 
//       }
    
//       console.error('jajjajaja 1:', error);
//       next(Boom.internal('Error al crear la cotización', { originalError: error.message }));
//     }
// });

module.exports = router;