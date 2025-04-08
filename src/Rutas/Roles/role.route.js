const express = require('express');
const boomErrors = require('@hapi/boom')
const router = express.Router();
const Roles = require('../../models/roles.schema');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const role = new Roles(req.body);
        await role.save();
        res.status(201).send(role);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Crear un nuevo restaurante
router.get('/', async (req, res) => {
    try {
        const roles = await Roles.find();
        res.status(201).send(roles);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const role = await Roles.findById(req.params.id);
        if (!role) {
            return res.status(404).send(boomErrors.notFound('Error, ID novalida/encontrada'));
        }
        res.status(200).send(role);
    } catch (error) {
        res.status(500).send(error);
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const role = await Roles.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!role) {
            return res.status(404).send();
        }
        res.status(200).send(role);
    } catch (error) {
        res.status(400).send(error);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const role = await Roles.findByIdAndDelete(req.params.id);
        if (!role) {
            return res.status(404).send();
        }
        res.status(200).send(role);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;