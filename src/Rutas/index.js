const exs = require("express");

const userRoute = require('./User/user.route')
const {authenticate, authorize} = require('../middlewares/auth')
const contactRoute = require('./Contact/contact.route')
const roleRoute = require('./Roles/role.route')
const publicBookingRoute = require('./PublicBooking/publicBooking.route')
const serviceOrdersRoute = require('./ServiceOrders/serviceOrders.route')
const serviceOrderTemplatesRoute = require('./ServiceOrders/serviceOrderTemplates.route')
const bookingFilesRoute = require('./BookingFiles/bookingFiles.route')
const tariffV2Route = require('../modules/tariff-v2/api/tariff-v2.routes')
const masterQuoterV2Route = require('../modules/master-quoter-v2/api/master-quoter-v2.routes')
const quoterV2Route = require('../modules/quoter-v2/api/quoter-v2.routes')

function routes(app){
    const route = exs.Router();
    app.use("/api",route);
    route.use("/",userRoute);
    route.use("/", publicBookingRoute);
    route.use(authenticate);
  //  route.get("/",(req, res)=> res.send('Backend API Kuoda System'))
   // route.use(authenticate,authorize)
    route.use('/contacts',contactRoute)
    route.use('/roles',roleRoute)
    route.use('/tariff-v2', tariffV2Route)
    route.use('/master-quoter-v2', masterQuoterV2Route)
    route.use('/quoter-v2', quoterV2Route)
    route.use('/service-orders', serviceOrdersRoute)
    route.use('/service-order-templates', serviceOrderTemplatesRoute)
    route.use('/booking-files', bookingFilesRoute)
    // route.use('/',authenticate,roleFilterMiddleware)


}

module.exports = routes;
