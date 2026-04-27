const express = require('express');

const Roles = require('../../models/roles.schema');
const { PERMISSIONS, PERMISSION_TREE, normalizePermissions } = require('../../security/permissions');
const { ROLE_SCOPE_CATALOG } = require('../../security/access-policies');
const { createHttpError, sendError } = require('../../utils/httpError');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const role = new Roles({
      ...req.body,
      permissions: normalizePermissions(req.body?.permissions),
    });

    await role.save();
    return res.status(201).json(role);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error creating role',
      errorCode: 'ROLE_CREATE_FAILED',
    });
  }
});

router.get('/permissions-catalog', async (_req, res) => {
  try {
    return res.status(200).json({
      permissions: PERMISSIONS,
      tree: PERMISSION_TREE,
      roleScopes: ROLE_SCOPE_CATALOG,
    });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error loading permissions catalog',
      errorCode: 'ROLE_PERMISSIONS_CATALOG_FAILED',
    });
  }
});

router.get('/', async (_req, res) => {
  try {
    const roles = await Roles.find();
    return res.status(200).json(roles);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error listing roles',
      errorCode: 'ROLE_LIST_FAILED',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const role = await Roles.findById(req.params.id);
    if (!role) {
      return sendError(res, createHttpError(404, 'Role not found', 'ROLE_NOT_FOUND'));
    }

    return res.status(200).json(role);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error fetching role',
      errorCode: 'ROLE_FETCH_FAILED',
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      permissions: Object.prototype.hasOwnProperty.call(req.body || {}, 'permissions')
        ? normalizePermissions(req.body.permissions)
        : undefined,
    };

    if (payload.permissions === undefined) {
      delete payload.permissions;
    }

    const role = await Roles.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!role) {
      return sendError(res, createHttpError(404, 'Role not found', 'ROLE_NOT_FOUND'));
    }

    return res.status(200).json(role);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error updating role',
      errorCode: 'ROLE_UPDATE_FAILED',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const role = await Roles.findByIdAndDelete(req.params.id);
    if (!role) {
      return sendError(res, createHttpError(404, 'Role not found', 'ROLE_NOT_FOUND'));
    }

    return res.status(200).json(role);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error deleting role',
      errorCode: 'ROLE_DELETE_FAILED',
    });
  }
});

module.exports = router;
