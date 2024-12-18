const express = require('express');
const router = express.Router();
const Quoter = require('../../../src/models/quoter.schema');
const Contact = require('../../models/contact.schema')
// Crear una nueva cotización
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
        const quoters = await Quoter.find();
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
router.post('/:quoterId/quoterItems', async (req, res) => {
    const {quoterId} = req.params;
    const newItem = req.body;
    try{
        const item = await Quoter.findById(quoterId);
        if(!item){
            return res.status(404).send({message: 'Hotel not found'});
        }
        item.services.push(newItem);
        await item.save();
        res.status(201).send(newItem);
    }catch(error){
        res.status(400).send(error);
    }
});

module.exports = router;