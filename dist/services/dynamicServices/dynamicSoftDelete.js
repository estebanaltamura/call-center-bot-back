"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicSoftDelete = void 0;
const types_1 = require("../../types");
const firebase_1 = require("../../firebase");
const dynamicSoftDelete = async (entity, id) => {
    const docRef = firebase_1.db.collection(entity).doc(id);
    try {
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error('Document does not exist');
        }
        await docRef.update({
            softState: types_1.StateTypes.inactive,
            softDeletedAt: new Date(),
        });
        const updatedSnapshot = await docRef.get();
        return { id, ...updatedSnapshot.data() };
    }
    catch (error) {
        console.error('Error trying to soft delete the document:', error);
    }
};
exports.dynamicSoftDelete = dynamicSoftDelete;
