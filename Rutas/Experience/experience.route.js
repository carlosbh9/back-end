const express = require('express');
const router = express.Router();
const Experience = require('../../schemas/experience.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const experience = new Experience(req.body);
        await experience.save();
        res.status(201).send(experience);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Obtener todos los restaurantes
router.get('/', async (req, res) => {
    try {
        const experiences = await Experience.find();
        res.status(200).send(experiences);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Obtener un restaurante por ID
router.get('/:id', async (req, res) => {
    try {
        const experience = await Experience.findById(req.params.id);
        if (!experience) {
            return res.status(404).send();
        }
        res.status(200).send(experience);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Actualizar un restaurante por ID
router.patch('/:id', async (req, res) => {
    console.log(req.params)
    try {
        const experience = await Experience.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!experience) {
            return res.status(404).send();
        }
        res.status(200).send(experience);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Eliminar un restaurante por ID
router.delete('/:id', async (req, res) => {
    try {
        const experience = await Experience.findByIdAndDelete(req.params.id);
        if (!experience) {
            return res.status(404).send();
        }
        res.status(200).send(experience);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;