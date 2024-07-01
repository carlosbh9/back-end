const express = require('express');
const router = express.Router();
const Entrance = require('../../schemas/entrances.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const entrance = new Entrance(req.body);
        await entrance.save();
        res.status(201).send(entrance);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const entrances = await Entrance.find();
        res.status(200).send(entrances);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const entrance = await Entrance.findById(req.params.id);
        if (!entrance) {
            return res.status(404).send();
        }
        res.status(200).send(entrance);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const entrance = await Entrance.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!entrance) {
            return res.status(404).send();
        }
        res.status(200).send(entrance);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const entrance = await Entrance.findByIdAndDelete(req.params.id);
        if (!entrance) {
            return res.status(404).send();
        }
        res.status(200).send(entrance);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;