const mongoose = require('mongoose');
const launchTokenService = require('../application/services/launch-token.service');

function asString(value) {
  return String(value || '').trim();
}

function validateOptionalQuoterId(rawValue) {
  const value = asString(rawValue);
  if (!value) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    const err = new Error('quoterId must be a valid ObjectId');
    err.status = 400;
    throw err;
  }

  return value;
}

class ItineraryLaunchController {
  issue(req, res) {
    try {
      const user = req.user || {};
      if (!user.id) {
        return res.status(401).json({ message: 'Authenticated user is required' });
      }

      const quoterId = validateOptionalQuoterId(req.body?.quoterId);
      const result = launchTokenService.issueLaunchToken({ user, quoterId });

      return res.status(201).json({
        message: 'Launch token generated successfully',
        data: result,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message || 'Error generating launch token',
      });
    }
  }

  consume(req, res) {
    try {
      const launchToken = asString(req.body?.launchToken);
      if (!launchToken) {
        return res.status(400).json({ message: 'launchToken is required' });
      }

      const result = launchTokenService.consumeLaunchToken(launchToken);

      return res.status(200).json({
        message: 'Launch token consumed successfully',
        data: result,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message || 'Error consuming launch token',
      });
    }
  }
}

module.exports = new ItineraryLaunchController();
