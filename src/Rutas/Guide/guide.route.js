const express = require('express');
const router = express.Router();
const Guide = require('../../../src/models/guides.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const guide = new Guide(req.body);
        await guide.save();
        res.status(201).send(guide);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const guides = await Guide.find();
        res.status(200).send(guides);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const guide = await Guide.findById(req.params.id);
        if (!guide) {
            return res.status(404).send();
        }
        res.status(200).send(guide);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const guide = await Guide.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!guide) {
            return res.status(404).send();
        }
        res.status(200).send(guide);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const guide = await Guide.findByIdAndDelete(req.params.id);
        if (!guide) {
            return res.status(404).send();
        }
        res.status(200).send(guide);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;