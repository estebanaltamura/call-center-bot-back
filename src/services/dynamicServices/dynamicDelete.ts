// dynamicDelete.ts
import {  EntityTypesMapReturnedValues, StateTypes } from '../../types';
import { db } from '../../firebase';
import admin from "firebase-admin";


export const dynamicDelete = async <T extends keyof EntityTypesMapReturnedValues>(
  entity: T,
  id: string,
): Promise<EntityTypesMapReturnedValues[T] | undefined> => {
  const docRef = db.collection(entity).doc(id);
  try {
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Document does not exist');
    }
    await docRef.update({
      state: StateTypes.inactive,
      deletedAt: admin.firestore.Timestamp.fromDate(new Date()),
    });
    return { id, ...snapshot.data() } as EntityTypesMapReturnedValues[T];
  } catch (error) {
    console.error('Error trying to delete item', error);
  }
};
