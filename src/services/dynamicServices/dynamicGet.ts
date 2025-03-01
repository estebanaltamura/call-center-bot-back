// dynamicGet.ts
import {  EntityTypesMapReturnedValues } from '../../types';
import { db } from '../../firebase';

export interface IFilter {
  field: string;
  operator: FirebaseFirestore.WhereFilterOp;
  value: unknown;
}

export const dynamicGet = async <T extends keyof EntityTypesMapReturnedValues>(
  entity: T,
  filters?: IFilter[],
): Promise<EntityTypesMapReturnedValues[T][] | undefined> => {
  try {
    let collectionRef: FirebaseFirestore.Query = db.collection(entity);
    if (filters && filters.length > 0) {
      filters.forEach((f) => {
        collectionRef = collectionRef.where(f.field, f.operator, f.value);
      });
    }
    const snapshot = await collectionRef.get();
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EntityTypesMapReturnedValues[T][];
    return items;
  } catch (error) {
    console.error('Error al obtener los datos:', error);
  }
};
