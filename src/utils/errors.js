class RestrictionError extends Error {
    constructor(message) {
      super(message);
      this.name = 'RestrictionError';
    }
  }
  
  module.exports = {
    RestrictionError
  };