const express = require('express');

const Contact = require('../../models/contact.schema');
const User = require('../../models/user.schema');
const BookingFile = require('../../models/booking_file.schema');
const { authenticate } = require('../../middlewares/auth');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');
const {
  canManageAllContacts,
  buildContactAccessFilter,
  findAccessibleContactById,
} = require('../../Services/contacts/contact-access.service');
const { createHttpError, sendError } = require('../../utils/httpError');
const { createValidator, isPlainObject, isValidObjectId } = require('../../utils/requestValidation');

const router = express.Router();
const CONTACT_STATUSES = ['WIP', 'HOLD', 'SOLD', 'LOST'];
const QUOTER_MODELS = ['v1', 'v2'];

function validateContactCreatePayload(body) {
  const validator = createValidator({
    message: 'Invalid contact payload',
    errorCode: 'CONTACT_CREATE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('name', body.name);
  validator.optionalString('phone', body.phone);
  validator.optionalEmail('email', body.email);
  validator.assert();
}

function validateCotizations(cotizations, validator, field = 'cotizations') {
  validator.optionalArray(field, cotizations);
  if (!Array.isArray(cotizations)) {
    return;
  }

  cotizations.forEach((item, index) => {
    const itemField = `${field}[${index}]`;
    if (!isPlainObject(item)) {
      validator.addIssue(itemField, `${itemField} must be an object`, item);
      return;
    }

    validator.optionalString(`${itemField}.name_version`, item.name_version);
    validator.optionalEnum(`${itemField}.quoter_model`, item.quoter_model, QUOTER_MODELS);
    validator.optionalEnum(`${itemField}.status`, item.status, CONTACT_STATUSES);
    validator.optionalObjectId(`${itemField}.quoter_id`, item.quoter_id, { allowNull: true });
    validator.optionalDate(`${itemField}.createQuoter`, item.createQuoter);
  });
}

function validateContactUpdatePayload(body) {
  const validator = createValidator({
    message: 'Invalid contact update payload',
    errorCode: 'CONTACT_UPDATE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  if (!Object.keys(body).length) {
    validator.addIssue('body', 'body must not be empty');
  }

  validator.optionalString('name', body.name, { allowEmpty: false });
  validator.optionalString('phone', body.phone);
  validator.optionalEmail('email', body.email);
  validator.optionalString('td_designed', body.td_designed);
  validator.optionalEnum('status', body.status, CONTACT_STATUSES);
  validator.optionalObjectId('assignedTo', body.assignedTo, { allowNull: true });

  if (body.soldQuoterId !== undefined && body.soldQuoterId !== null && body.soldQuoterId !== '') {
    validator.optionalObjectId('soldQuoterId', body.soldQuoterId);
  }

  validateCotizations(body.cotizations, validator);
  validator.assert();
}

function enforceSingleSold(cotizations = [], soldQuoterId) {
  const normalizedCotizations = Array.isArray(cotizations)
    ? cotizations.map((cotization) => ({ ...cotization }))
    : [];

  let normalizedSoldId = soldQuoterId ? String(soldQuoterId) : '';

  if (normalizedSoldId) {
    let hasMatch = false;
    normalizedCotizations.forEach((cotization) => {
      const currentId = cotization?.quoter_id ? String(cotization.quoter_id) : '';
      const isSelected = currentId && currentId === normalizedSoldId;
      if (isSelected) {
        hasMatch = true;
        cotization.status = 'SOLD';
      } else if (cotization.status === 'SOLD') {
        cotization.status = 'HOLD';
      }
    });

    if (!hasMatch) {
      normalizedSoldId = '';
    }
  }

  if (!normalizedSoldId) {
    const soldIndexes = [];
    normalizedCotizations.forEach((cotization, index) => {
      if (cotization?.status === 'SOLD') {
        soldIndexes.push(index);
      }
    });

    if (soldIndexes.length > 0) {
      const winnerIndex = soldIndexes[0];
      const winnerId = normalizedCotizations[winnerIndex]?.quoter_id
        ? String(normalizedCotizations[winnerIndex].quoter_id)
        : '';

      soldIndexes.slice(1).forEach((index) => {
        normalizedCotizations[index].status = 'HOLD';
      });

      normalizedSoldId = winnerId || '';
    }
  }

  if (normalizedSoldId) {
    normalizedCotizations.forEach((cotization) => {
      const currentId = cotization?.quoter_id ? String(cotization.quoter_id) : '';
      if (cotization.status === 'SOLD' && currentId !== normalizedSoldId) {
        cotization.status = 'HOLD';
      }
    });
  }

  return {
    cotizations: normalizedCotizations,
    soldQuoterId: normalizedSoldId || null,
  };
}

router.post('/', authenticate, async (req, res) => {
  try {
    validateContactCreatePayload(req.body);

    const name = String(req.body?.name || '').trim();
    const { phone, email } = req.body || {};
    const ownerId = req.user.id;

    if (!name) {
      return sendError(res, createHttpError(400, 'El nombre del contacto es obligatorio', 'CONTACT_NAME_REQUIRED'));
    }

    const duplicate = await Contact.findOne({ name, owner: ownerId }).select('_id');
    if (duplicate) {
      return sendError(res, createHttpError(400, 'Ya existe un contacto con ese nombre para este usuario', 'CONTACT_DUPLICATE_NAME'));
    }

    const owner = await User.findById(ownerId).select('_id');
    if (!owner) {
      return sendError(res, createHttpError(404, 'Usuario no encontrado', 'CONTACT_OWNER_NOT_FOUND'));
    }

    const contact = await Contact.create({
      name,
      phone,
      email,
      owner: ownerId,
    });

    return res.status(201).json(contact);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error al crear contacto',
      errorCode: 'CONTACT_CREATE_FAILED',
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const getAll = req.query.all === 'true';
    const filter = String(req.query.filter || '');
    const nameRegex = new RegExp(filter, 'i');
    const scopedFilter = buildContactAccessFilter(req.user, { name: { $regex: nameRegex } });

    let contacts;
    let totalContacts;

    if (getAll) {
      contacts = await Contact.find(scopedFilter)
        .sort({ createdAt: -1 })
        .select('name _id owner')
        .limit(pageSize);
      totalContacts = contacts.length;
    } else {
      totalContacts = await Contact.countDocuments(scopedFilter);
      contacts = await Contact.find(scopedFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);
    }

    return res.json({ contacts, totalContacts, page, pageSize });
  } catch (error) {
    console.error('Error al obtener contactos:', error);
    return sendError(res, error, {
      status: 500,
      message: 'Error interno al obtener contactos',
      errorCode: 'CONTACT_LIST_FAILED',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Contact id is invalid', 'CONTACT_ID_INVALID'));
    }

    const contact = await findAccessibleContactById(req.params.id, req.user);
    if (!contact) {
      return sendError(res, createHttpError(404, 'Contacto no encontrado o sin acceso', 'CONTACT_NOT_FOUND'));
    }

    return res.status(200).send(contact);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error al obtener contacto',
      errorCode: 'CONTACT_FETCH_FAILED',
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Contact id is invalid', 'CONTACT_ID_INVALID'));
    }

    validateContactUpdatePayload(req.body);

    const contact = await findAccessibleContactById(req.params.id, req.user);
    if (!contact) {
      return sendError(res, createHttpError(404, 'Contacto no encontrado o sin acceso', 'CONTACT_NOT_FOUND'));
    }

    const previousSoldQuoterId = contact.soldQuoterId ? String(contact.soldQuoterId) : null;
    const incomingData = { ...req.body };

    delete incomingData.owner;
    delete incomingData.createdBy;

    if (!canManageAllContacts(req.user)) {
      delete incomingData.assignedTo;
    }

    const hasCotizationsUpdate = Array.isArray(incomingData.cotizations);
    const hasSoldQuoterUpdate = Object.prototype.hasOwnProperty.call(incomingData, 'soldQuoterId');

    if (hasCotizationsUpdate || hasSoldQuoterUpdate) {
      const cotizations = hasCotizationsUpdate ? incomingData.cotizations : contact.cotizations;
      const soldQuoterId = hasSoldQuoterUpdate ? incomingData.soldQuoterId : contact.soldQuoterId;
      const normalized = enforceSingleSold(cotizations, soldQuoterId);
      incomingData.cotizations = normalized.cotizations;
      incomingData.soldQuoterId = normalized.soldQuoterId;
    }

    const updatedContact = await Contact.findByIdAndUpdate(
      contact._id,
      incomingData,
      { new: true, runValidators: true }
    );

    const currentSoldQuoterId = updatedContact?.soldQuoterId ? String(updatedContact.soldQuoterId) : null;
    const changedBy = req.user?.id || null;

    if (currentSoldQuoterId && currentSoldQuoterId !== previousSoldQuoterId) {
      const bookingFile = await BookingFile.findOne({ quoter_id: currentSoldQuoterId }).select('_id');
      if (!bookingFile) {
        return sendError(res, createHttpError(400, 'Booking file not found for current sold quoter', 'CONTACT_BOOKING_FILE_NOT_FOUND'));
      }

      await serviceOrderOrchestrator.createOrdersForContactSold({
        contactId: String(contact._id),
        soldQuoterId: currentSoldQuoterId,
        fileId: String(bookingFile._id),
        changedBy,
      });
    }

    if (!currentSoldQuoterId && previousSoldQuoterId) {
      const previousEventId = serviceOrderOrchestrator.buildBusinessEventId({
        contactId: String(contact._id),
        soldQuoterId: previousSoldQuoterId,
      });

      await serviceOrderOrchestrator.cancelOrdersForBusinessEvent({
        businessEventId: previousEventId,
        reason: 'Contact sale reverted',
        changedBy,
      });
    }

    return res.status(200).send(updatedContact);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error al actualizar contacto',
      errorCode: 'CONTACT_UPDATE_FAILED',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Contact id is invalid', 'CONTACT_ID_INVALID'));
    }

    const contact = await findAccessibleContactById(req.params.id, req.user);
    if (!contact) {
      return sendError(res, createHttpError(404, 'Contacto no encontrado o sin acceso', 'CONTACT_NOT_FOUND'));
    }

    await Contact.findByIdAndDelete(contact._id);
    return res.status(200).json(contact);
  } catch (error) {
    console.error(error);
    return sendError(res, error, {
      status: 500,
      message: 'Error al eliminar contacto',
      errorCode: 'CONTACT_DELETE_FAILED',
    });
  }
});

module.exports = router;
