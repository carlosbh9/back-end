const express = require('express');
const router = express.Router();
const Expedition = require('../../../src/models/expeditions.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const expedition = new Expedition(req.body);
        await expedition.save();
        res.status(201).send(expedition);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const expeditions = await Expedition.find();
        res.status(200).send(expeditions);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const expedition = await Expedition.findById(req.params.id);
        if (!expedition) {
            return res.status(404).send();
        }
        res.status(200).send(expedition);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const expedition = await Expedition.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!expedition) {
            return res.status(404).send();
        }
        res.status(200).send(expedition);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const expedition = await Expedition.findByIdAndDelete(req.params.id);
        if (!expedition) {
            return res.status(404).send();
        }
        res.status(200).send(expedition);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;