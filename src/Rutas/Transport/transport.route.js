const express = require('express');
const router = express.Router();
const Transport = require('../../../src/models/transport.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const transport = new Transport(req.body);
        await transport.save();
        res.status(201).send(transport);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const transports = await Transport.find();
        res.status(200).send(transports);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const transport = await Transport.findById(req.params.id);
        if (!transport) {
            return res.status(404).send();
        }
        res.status(200).send(transport);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const transport = await Transport.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!transport) {
            return res.status(404).send();
        }
        res.status(200).send(transport);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const transport = await Transport.findByIdAndDelete(req.params.id);
        if (!transport) {
            return res.status(404).send();
        }
        res.status(200).send(transport);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;