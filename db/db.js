const mongoose = require('mongoose');
require('dotenv').config()

const connectDB = async () => {
    try {
      //  await mongoose.connect('mongodb://localhost:27017/bdcotizacion');
        // await mongoose.connect('mongodb+srv://benavidesc802:xT531NRftG1uZvsO@atlascluster.gj289zh.mongodb.net/bdcotizacion?retryWrites=true&w=majority&appName=AtlasCluster')   
        await mongoose.connect(process.env.DB_NAME)    
            console.log('MongoDB connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

//xT531NRftG1uZvsO
module.exports = connectDB;