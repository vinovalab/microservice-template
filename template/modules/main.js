"use strict";

const BaseService = require("@vinovalab/backbone-shared/BaseService");

class __CLASS_NAME__ extends BaseService {
  constructor() {
    super({
      microservice: "__MICROSERVICE_NAME__",
      moduleName: "main",
      moduleVersion: "__MODULE_VERSION__",
    });
  }

  async _onInit() {
    this.logger.info("[_onInit] Custom initialization...");
  }

  async _onShutdown() {
    this.logger.info("[_onShutdown] Cleaning up...");
  }
}

module.exports = __CLASS_NAME__;
