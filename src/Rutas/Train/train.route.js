const express = require('express');
const router = express.Router();
const Train = require('../../../src/models/train.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const train = new Train(req.body);
        await train.save();
        res.status(201).send(train);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const trains = await Train.find();
        res.status(200).send(trains);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const train = await Train.findById(req.params.id);
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const train = await Train.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const train = await Train.findByIdAndDelete(req.params.id);
        if (!train) {
            return res.status(404).send();
        }
        res.status(200).send(train);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;