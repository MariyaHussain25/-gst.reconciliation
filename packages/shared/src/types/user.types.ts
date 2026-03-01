/**
 * @file packages/shared/src/types/user.types.ts
 * @description TypeScript interfaces for user-related data.
 */

/** Reference to an uploaded purchase/books document */
export interface PurchaseDocumentRef {
  /** MongoDB document ID of the uploaded file */
  docId: string;
  /** Original file name */
  fileName: string;
  /** Upload timestamp */
  createdAt: Date;
}

/** Reference to an uploaded GSTR-2A or GSTR-2B document */
export interface GstrDocumentRef {
  /** MongoDB document ID of the uploaded file */
  docId: string;
  /** Original file name */
  fileName: string;
  /** Tax period the file covers (YYYY-MM) */
  period: string;
  /** GSTR return type */
  type: '2A' | '2B';
  /** Upload timestamp */
  createdAt: Date;
}

/** Reference to a completed reconciliation result */
export interface ReconciliationResultRef {
  /** MongoDB document ID of the result */
  docId: string;
  /** Tax period the result covers (YYYY-MM) */
  period: string;
  /** Timestamp when reconciliation was completed */
  createdAt: Date;
}

/** Full user profile stored in the database */
export interface User {
  /** MongoDB document ID */
  id: string;
  /** Unique user identifier (e.g. from auth provider) */
  userId: string;
  /** User email address */
  email: string;
  /** List of uploaded purchase/books documents */
  purchaseData: PurchaseDocumentRef[];
  /** List of uploaded GSTR-2A/2B documents */
  gstrData: GstrDocumentRef[];
  /** List of reconciliation results */
  results: ReconciliationResultRef[];
  /** Account creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/** Partial user data for creation */
export type CreateUserData = Pick<User, 'userId' | 'email'>;
