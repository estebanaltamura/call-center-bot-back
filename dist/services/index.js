"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICES = void 0;
// ** Dynamic services
const dynamicCreate_1 = require("./dynamicServices/dynamicCreate");
const dynamicDelete_1 = require("./dynamicServices/dynamicDelete");
const dynamicGet_1 = require("./dynamicServices/dynamicGet");
const dynamicReactivateSoftDeleted_1 = require("./dynamicServices/dynamicReactivateSoftDeleted");
const dynamicSoftDelete_1 = require("./dynamicServices/dynamicSoftDelete");
const dynamicUpdate_1 = require("./dynamicServices/dynamicUpdate");
// ** CustomServices
exports.SERVICES = {
    CMS: {
        create: dynamicCreate_1.dynamicCreate,
        update: dynamicUpdate_1.dynamicUpdate,
        get: dynamicGet_1.dynamicGet,
        delete: dynamicDelete_1.dynamicDelete,
        softDelete: dynamicSoftDelete_1.dynamicSoftDelete,
        reactivateSoftDeleted: dynamicReactivateSoftDeleted_1.dynamicReactivateSoftDeleted,
    },
};
