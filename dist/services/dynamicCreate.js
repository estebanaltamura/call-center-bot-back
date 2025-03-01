"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicCreate = void 0;
const firebase_1 = require("../firebase");
const types_1 = require("../types");
const uuid_1 = require("uuid");
const dynamicCreate = async (collection, item, providedId // ID opcional
) => {
    const itemId = providedId || (0, uuid_1.v4)(); // Usar el ID proporcionado o generar uno
    const itemDocRef = firebase_1.db.collection(collection).doc(itemId); // Referencia al documento
    // Construcción del payload
    const payload = {
        id: itemId,
        ...item,
        state: types_1.StateTypes.active,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    try {
        await itemDocRef.set(payload); // Guardar el documento en Firestore
        return payload;
    }
    catch (error) {
        console.error('Error al crear el documento:', error);
        throw new Error('Error al crear el documento en Firestore');
    }
};
exports.dynamicCreate = dynamicCreate;
