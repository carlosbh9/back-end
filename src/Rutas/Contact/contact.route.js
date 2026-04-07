const express = require('express');
const router = express.Router();
const Contact = require('../../models/contact.schema');
const User = require('../../models/user.schema');
const BookingFile = require('../../models/booking_file.schema');
const { authenticate } = require('../../middlewares/auth');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');
const {
  canManageAllContacts,
  buildContactAccessFilter,
  findAccessibleContactById
} = require('../../Services/contacts/contact-access.service');

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
    soldQuoterId: normalizedSoldId || null
  };
}

router.post('/', authenticate, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const { phone, email } = req.body || {};
    const ownerId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: 'El nombre del contacto es obligatorio' });
    }

    const duplicate = await Contact.findOne({ name, owner: ownerId }).select('_id');
    if (duplicate) {
      return res.status(400).json({ message: 'Ya existe un contacto con ese nombre para este usuario' });
    }

    const owner = await User.findById(ownerId).select('_id');
    if (!owner) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const contact = await Contact.create({
      name,
      phone,
      email,
      owner: ownerId
    });

    return res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(400).json({
        message: 'Ya existe un contacto con ese nombre para este usuario',
        err: err.message
      });
    }
    return res.status(400).json({ message: 'Error al crear contacto', err: err.message });
  }
});

router.get('/all-cotizations', authenticate, async (req, res) => {
  try {
    const scopedMatch = buildContactAccessFilter(req.user);
    const cotizations = await Contact.aggregate([
      { $match: scopedMatch },
      {
        $unwind: {
          path: '$cotizations',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          contactId: '$_id',
          contactName: '$name',
          cotization: '$cotizations',
          _id: 0
        }
      }
    ]);

    return res.status(200).json(cotizations);
  } catch (error) {
    console.error('Error al extraer cotizaciones:', error);
    return res.status(500).send({ error: 'Error al obtener las cotizaciones' });
  }
});

router.get('/all-contacts', authenticate, async (req, res) => {
  try {
    const contacts = await Contact.find(buildContactAccessFilter(req.user))
      .select('name _id owner')
      .sort({ createdAt: -1 });

    return res.json(contacts);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener contactos', error: err.message });
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
  } catch (err) {
    console.error('Error al obtener contactos:', err);
    return res.status(500).json({ message: 'Error interno al obtener contactos', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contact = await findAccessibleContactById(req.params.id, req.user);
    if (!contact) {
      return res.status(404).json({ message: 'Contacto no encontrado o sin acceso' });
    }

    return res.status(200).send(contact);
  } catch (error) {
    return res.status(500).send(error);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const contact = await findAccessibleContactById(req.params.id, req.user).lean();
    if (!contact) {
      return res.status(404).json({ message: 'Contacto no encontrado o sin acceso' });
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
        return res.status(400).json({ message: 'Booking file not found for current sold quoter' });
      }

      await serviceOrderOrchestrator.createOrdersForContactSold({
        contactId: String(contact._id),
        soldQuoterId: currentSoldQuoterId,
        fileId: String(bookingFile._id),
        changedBy
      });
    }

    if (!currentSoldQuoterId && previousSoldQuoterId) {
      const previousEventId = serviceOrderOrchestrator.buildBusinessEventId({
        contactId: String(contact._id),
        soldQuoterId: previousSoldQuoterId
      });

      await serviceOrderOrchestrator.cancelOrdersForBusinessEvent({
        businessEventId: previousEventId,
        reason: 'Contact sale reverted',
        changedBy
      });
    }

    return res.status(200).send(updatedContact);
  } catch (error) {
    return res.status(400).send(error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const contact = await findAccessibleContactById(req.params.id, req.user);
    if (!contact) {
      return res.status(404).json({ message: 'Contacto no encontrado o sin acceso' });
    }

    await Contact.findByIdAndDelete(contact._id);
    return res.status(200).json(contact);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error al eliminar contacto', err });
  }
});

module.exports = router;
