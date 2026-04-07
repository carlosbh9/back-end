const express = require('express');
const boomErrors = require('@hapi/boom')
const router = express.Router();
const Roles = require('../../models/roles.schema');
const { PERMISSIONS, PERMISSION_TREE, normalizePermissions } = require('../../security/permissions');
const { ROLE_SCOPE_CATALOG } = require('../../security/access-policies');

// Crear un nuevo restaurante
router.post('/', async (req, res) => {
    try {
        const role = new Roles({
          ...req.body,
          permissions: normalizePermissions(req.body?.permissions)
        });
        await role.save();
        res.status(201).send(role);
    } catch (error) {
        res.status(400).send(error);
    }
});

router.get('/permissions-catalog', async (_req, res) => {
    try {
        res.status(200).send({
          permissions: PERMISSIONS,
          tree: PERMISSION_TREE,
          roleScopes: ROLE_SCOPE_CATALOG
        });
    } catch (error) {
        res.status(500).send(error);
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
        const payload = {
          ...req.body,
          permissions: Object.prototype.hasOwnProperty.call(req.body || {}, 'permissions')
            ? normalizePermissions(req.body.permissions)
            : undefined
        };
        if (payload.permissions === undefined) {
          delete payload.permissions;
        }

        const role = await Roles.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
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
