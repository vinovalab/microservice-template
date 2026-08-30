"use strict";

const path = require("path");
const { createMicroserviceServer } = require("@vinovalab/backbone-shared/serverFactory");
const MainService = require("./modules/main");
const { registerReadmeLanding } = require("./readmeLanding");

const MICROSERVICE = "__MICROSERVICE_NAME__";
const MODULE_VERSION = "__MODULE_VERSION__";
const DEFAULT_PORT = __PORT__;

const { app, getService, logger } = createMicroserviceServer({
  ServiceClass: MainService,
  microservice: MICROSERVICE,
  moduleName: "RESTServer",
  moduleVersion: MODULE_VERSION,
  defaultPort: DEFAULT_PORT,
  routes: [],
});

registerReadmeLanding({
  app,
  getService,
  logger,
  serviceName: MICROSERVICE,
  description: "__DESCRIPTION__",
  readmePath: path.join(__dirname, "README.md"),
  port: DEFAULT_PORT,
});
