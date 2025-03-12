import admin from "firebase-admin";


// dynamicCreate.ts
import { v4 as uuidv4 } from 'uuid';
import { EntityTypesMapPayloadValues, EntityTypesMapReturnedValues, StateTypes } from '../../types';
import { db } from '../../firebase';


export const dynamicCreate = async <T extends keyof EntityTypesMapPayloadValues>(
  collection: T,
  item: EntityTypesMapPayloadValues[T]
): Promise<EntityTypesMapReturnedValues[T] | undefined> => {
  const itemId = (item as unknown as any).id || uuidv4();
  const payload: EntityTypesMapReturnedValues[T] & { id: any} = {
    id: itemId,
    ...item,
    softState: StateTypes.active,
    state: StateTypes.active,
    createdAt: admin.firestore.Timestamp.fromDate(new Date()),
  } as EntityTypesMapReturnedValues[T];

  try {
    await db.collection(collection).doc(itemId).set(payload);
    return payload;
  } catch (error) {
    console.error(error);
  }
};

