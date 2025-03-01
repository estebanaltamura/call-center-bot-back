"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicGet = void 0;
const firebase_1 = require("../../firebase");
const dynamicGet = async (entity, filters) => {
    try {
        let collectionRef = firebase_1.db.collection(entity);
        if (filters && filters.length > 0) {
            filters.forEach((f) => {
                collectionRef = collectionRef.where(f.field, f.operator, f.value);
            });
        }
        const snapshot = await collectionRef.get();
        const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        return items;
    }
    catch (error) {
        console.error('Error al obtener los datos:', error);
    }
};
exports.dynamicGet = dynamicGet;
