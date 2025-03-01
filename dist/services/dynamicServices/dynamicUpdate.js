"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicUpdate = void 0;
const firebase_1 = require("../../firebase");
const dynamicUpdate = async (entity, id, item) => {
    const docRef = firebase_1.db.collection(entity).doc(id);
    try {
        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            throw new Error('Document does not exist');
        }
        const payload = {
            ...item,
            updatedAt: new Date(),
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
