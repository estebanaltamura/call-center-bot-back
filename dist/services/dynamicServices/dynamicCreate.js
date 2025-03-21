"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicCreate = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// dynamicCreate.ts
const uuid_1 = require("uuid");
const types_1 = require("../../types");
const firebase_1 = require("../../firebase");
const dynamicCreate = async (collection, item) => {
    const itemId = item.id || (0, uuid_1.v4)();
    const payload = {
        id: itemId,
        ...item,
        softState: types_1.StateTypes.active,
        state: types_1.StateTypes.active,
        createdAt: firebase_admin_1.default.firestore.Timestamp.fromDate(new Date()),
    };
    try {
        await firebase_1.db.collection(collection).doc(itemId).set(payload);
        return payload;
    }
    catch (error) {
        console.error(error);
    }
};
exports.dynamicCreate = dynamicCreate;
