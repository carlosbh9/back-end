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

function routes(app){
    const route = exs.Router();
    app.use("/api",route);
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
}

module.exports = routes;