
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'read' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}

export type StorageRuleContext = {
  path: string;
  operation: 'read' | 'write';
};

export class StoragePermissionError extends Error {
  public readonly context: StorageRuleContext;

  constructor(context: StorageRuleContext) {
    const message = `StorageError: Missing or insufficient permissions: The following request was denied by Storage Security Rules:`;
    super(message);
    this.name = 'StoragePermissionError';
    this.context = context;
  }
}
