import { db } from "../firebase";
import { EntityTypesMapPayloadValues, EntityTypesMapReturnedValues, StateTypes } from "../types";
import { v4 as uuidv4 } from 'uuid';
import admin from "firebase-admin";



export const dynamicCreate = async <T extends keyof EntityTypesMapPayloadValues>(
  collection: T,
  item: EntityTypesMapPayloadValues[T],
  providedId?: string // ID opcional
): Promise<EntityTypesMapReturnedValues[T] | undefined> => {
  const itemId = providedId || uuidv4(); // Usar el ID proporcionado o generar uno
  const itemDocRef = db.collection(collection).doc(itemId); // Referencia al documento

  // Construcción del payload
  const payload: EntityTypesMapReturnedValues[T] = {
    id: itemId,
    ...item,
    state: StateTypes.active,
    createdAt: admin.firestore.Timestamp.fromDate(new Date()),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
  } as EntityTypesMapReturnedValues[T];

  try {
    await itemDocRef.set(payload); // Guardar el documento en Firestore
    return payload;
  } catch (error) {
    console.error('Error al crear el documento:', error);
    throw new Error('Error al crear el documento en Firestore');
  }
};