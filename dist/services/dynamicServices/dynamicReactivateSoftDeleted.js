"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicReactivateSoftDeleted = void 0;
// ** Firestore Imports
const types_1 = require("../../types");
const firebase_1 = require("../../firebase");
const dynamicReactivateSoftDeleted = async (entity, id) => {
    const docRef = firebase_1.db.collection(entity).doc(id);
    try {
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error('Document does not exist');
        }
        await docRef.update({
            softState: types_1.StateTypes.active,
            reactivatedAt: new Date(),
        });
        const updatedSnapshot = await docRef.get();
        return { id, ...updatedSnapshot.data() };
    }
    catch (error) {
        console.error('Error trying to reactivate soft deleted document:', error);
    }
};
exports.dynamicReactivateSoftDeleted = dynamicReactivateSoftDeleted;
