const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../../models/user.schema');
const Role = require('../../models/roles.schema');
const { authenticate } = require('../../middlewares/auth');
const { normalizePermissions } = require('../../security/permissions');
const { createHttpError, sendError } = require('../../utils/httpError');
const { createValidator, isPlainObject, isValidObjectId } = require('../../utils/requestValidation');

const router = express.Router();

function validateSignupPayload(body) {
  const validator = createValidator({
    message: 'Invalid signup payload',
    errorCode: 'USER_SIGNUP_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('username', body.username);
  validator.requireNonEmptyString('password', body.password);
  validator.requireNonEmptyString('role', body.role);
  validator.requireNonEmptyString('name', body.name);
  validator.assert();
}

function validateLoginPayload(body) {
  const validator = createValidator({
    message: 'Invalid login payload',
    errorCode: 'USER_LOGIN_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('username', body.username);
  validator.requireNonEmptyString('password', body.password);
  validator.assert();
}

function validateUpdateUserPayload(body) {
  const validator = createValidator({
    message: 'Invalid user update payload',
    errorCode: 'USER_UPDATE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireAtLeastOne(['username', 'password', 'role', 'name', 'image'], body);
  validator.optionalString('username', body.username, { allowEmpty: false });
  validator.optionalString('password', body.password);
  validator.optionalString('role', body.role, { allowEmpty: false });
  validator.optionalString('name', body.name, { allowEmpty: false });
  validator.optionalString('image', body.image);
  validator.assert();
}

router.post('/auth/signup', async (req, res) => {
  const { username, password, role, name } = req.body || {};

  try {
    validateSignupPayload(req.body);

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return sendError(res, createHttpError(400, 'El usuario ya existe', 'USER_ALREADY_EXISTS'));
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS, 10));

    const temp = new User({
      username,
      password: hashedPassword,
      role,
      name,
    });

    await temp.save();

    const token = jwt.sign({ _id: temp._id }, process.env.JWT_SECRET);
    return res.status(200).json({
      usuario: temp,
      message: 'Usuario registrado',
      token,
    });
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error al registrar usuario',
      errorCode: 'USER_SIGNUP_FAILED',
    });
  }
});

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  try {
    validateLoginPayload(req.body);

    const user = await User.findOne({ username });
    if (!user) {
      return sendError(res, createHttpError(401, 'Usuario invalido', 'AUTH_INVALID_USERNAME'));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return sendError(res, createHttpError(401, 'Credenciales invalidas', 'AUTH_INVALID_CREDENTIALS'));
    }

    const roleData = await Role.findOne({ name: user.role });
    const permissions = normalizePermissions(roleData ? roleData.permissions : []);

    const token = jwt.sign({
      id: user._id,
      role: user.role,
      username: user.name,
      email: user.username,
      permissions,
    }, process.env.JWT_SECRET);

    return res.status(200).json({ token });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error al iniciar sesion',
      errorCode: 'USER_LOGIN_FAILED',
    });
  }
});

router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'User id is invalid', 'USER_ID_INVALID'));
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return sendError(res, createHttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND'));
    }

    return res.status(200).json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error al eliminar usuario',
      errorCode: 'USER_DELETE_FAILED',
    });
  }
});

router.patch('/users/:id', authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'User id is invalid', 'USER_ID_INVALID'));
    }

    validateUpdateUserPayload(req.body);

    const payload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(payload, 'password')) {
      if (String(payload.password || '').trim()) {
        payload.password = await bcrypt.hash(String(payload.password), parseInt(process.env.SALT_ROUNDS, 10));
      } else {
        delete payload.password;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, payload, { new: true, select: '-password' });
    if (!updatedUser) {
      return sendError(res, createHttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND'));
    }

    return res.status(200).json({ message: 'Usuario actualizado', usuario: updatedUser });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error al actualizar usuario',
      errorCode: 'USER_UPDATE_FAILED',
    });
  }
});

router.get('/users', authenticate, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    return res.status(200).json(users);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error al obtener usuarios',
      errorCode: 'USER_LIST_FAILED',
    });
  }
});

module.exports = router;
