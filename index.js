const exs = require("express");
const routes = require('./src/Rutas');
const connectDB = require('./db/db.js');
//require('./src/models/Restaurant.schema.js')
//const cors = require('cors')
//const { use } = require("./Rutas/Lotes/Lotes.route");

//const {mostrarError, manejarError, boomManejaError}= require('./middlewares/error.middleware');
const apk = exs();
const puerto = 3000;
apk.use(exs.json());
//apk.use(cors());
connectDB();
routes(apk);



//apk.use(mostrarError);
//apk.use(manejarError);
//apk.use(boomManejaError);


 
apk.listen(puerto, () =>{
  console.log("puerto " + puerto + " activo")
});


