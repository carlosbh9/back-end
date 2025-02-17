const exs = require("express");

const entranceRoutes = require ("./Entrance/entrance.route")
const expeditionRoute = require("./Expedition/expedition.route")
const experienceRoute = require("./Experience/experience.route")
const guideRoute = require("./Guide/guide.route")
const hotelRoute = require("./Hotel/hotel.route")
const operatorRoute = require("./Operator/operator.route")
const restaurantRoutes = require ("./Restaurant/restaurant.route")
const trainRoutes = require ("./Train/train.route")
const transportRoute = require("./Transport/transport.route")
const quoterRoute = require("./Quoter/quoter.route")
const masterQuoter = require("./masterQuoter/master_quoter.route")
const limaGourmet = require('./Gourmet/limaGourmet.route')
const servicesController = require('./servicesController/servicesController');
const hotelController = require('./servicesController/hotelController');
const userRoute = require('./User/user.route')
const {authenticate, authorize} = require('../middlewares/auth')
const createQuoter = require('../models/createQuoter')
const contactRoute = require('./Contact/contact.route')
const extrasRoute = require('./Extra/extras.route')
const roleFilterMiddleware = require('../middlewares/roleFilterMiddleware')
function routes(app){
    const route = exs.Router();
    app.use("/api",route);
    route.use("/",userRoute,authenticate);
  //  route.get("/",(req, res)=> res.send('Backend API Kuoda System'))
   // route.use(authenticate,authorize)
    route.use("/entrances",entranceRoutes);
    route.use("/expeditions",expeditionRoute);
    route.use("/experiences",experienceRoute);
    route.use("/guides",guideRoute);
    route.use("/hotels",hotelRoute);
    route.use("/operators",operatorRoute);
    route.use('/restaurants', restaurantRoutes);
    route.use("/trains",trainRoutes);
    route.use("/transports",transportRoute);
    route.use("/quoter",quoterRoute);
    route.use("/master",masterQuoter);
    route.post('/get-service-prices', servicesController.getServicePrices);
    route.post("/get-hotel-prices", hotelController.getServicePrices)
    route.post('/createquoter',createQuoter.createQuoter)
    route.use('/contacts',contactRoute)
    route.use("/limagourmet",limaGourmet);
    route.use('/extras',extrasRoute)
    // route.use('/',authenticate,roleFilterMiddleware)


}

module.exports = routes;