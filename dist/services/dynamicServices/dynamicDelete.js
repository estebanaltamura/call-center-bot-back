"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicDelete = void 0;
// dynamicDelete.ts
const types_1 = require("../../types");
const firebase_1 = require("../../firebase");
const dynamicDelete = async (entity, id) => {
    const docRef = firebase_1.db.collection(entity).doc(id);
    try {
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error('Document does not exist');
        }
        await docRef.update({
            state: types_1.StateTypes.inactive,
            deletedAt: new Date(),
        });
        return { id, ...snapshot.data() };
    }
    catch (error) {
        console.error('Error trying to delete item', error);
    }
};
exports.dynamicDelete = dynamicDelete;
