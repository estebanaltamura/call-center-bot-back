// ** Firestore Imports
import {  EntityTypesMapPayloadValues, EntityTypesMapReturnedValues, StateTypes } from '../../types';
import { db } from '../../firebase';
import admin from "firebase-admin";


export const dynamicReactivateSoftDeleted = async <T extends keyof EntityTypesMapReturnedValues>(
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
      softState: StateTypes.active,
      reactivatedAt: admin.firestore.Timestamp.fromDate(new Date()),
    });
    const updatedSnapshot = await docRef.get();
    return { id, ...updatedSnapshot.data() } as EntityTypesMapReturnedValues[T];
  } catch (error) {
    console.error('Error trying to reactivate soft deleted document:', error);
  }
};
