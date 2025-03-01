// dynamicUpdate.ts
import {  EntityTypesMapPayloadValues, EntityTypesMapReturnedValues, StateTypes } from '../../types';
import { db } from '../../firebase';

export const dynamicUpdate = async <T extends keyof EntityTypesMapReturnedValues>(
  entity: T,
  id: string,
  item: Partial<EntityTypesMapPayloadValues[T]>
): Promise<EntityTypesMapReturnedValues[T] | undefined> => {
  const docRef = db.collection(entity).doc(id);
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
    return { id, ...updatedSnapshot.data() } as EntityTypesMapReturnedValues[T];
  } catch (error) {
    console.error('Error updating document:', error);
  }
};
