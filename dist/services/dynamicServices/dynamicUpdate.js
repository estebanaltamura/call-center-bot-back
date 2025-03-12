"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicUpdate = void 0;
const firebase_1 = require("../../firebase");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const dynamicUpdate = async (entity, id, item) => {
    const docRef = firebase_1.db.collection(entity).doc(id);
    try {
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error('Document does not exist');
        }
        const payload = {
            ...item,
            updatedAt: firebase_admin_1.default.firestore.Timestamp.fromDate(new Date()),
        };
        await docRef.update(payload);
        const updatedSnapshot = await docRef.get();
        return { id, ...updatedSnapshot.data() };
    }
    catch (error) {
        console.error('Error updating document:', error);
    }
};
exports.dynamicUpdate = dynamicUpdate;
