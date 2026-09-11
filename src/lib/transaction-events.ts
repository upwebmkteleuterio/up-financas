export const TRANSACTION_CREATED_EVENT = "finance-transaction-created";

export interface TransactionCreatedDetail {
  ids: string[];
  id?: string;
}

export const dispatchTransactionCreated = (transactionIds: string | string[]) => {
  const ids = Array.isArray(transactionIds) ? transactionIds : [transactionIds];
  window.dispatchEvent(new CustomEvent<TransactionCreatedDetail>(TRANSACTION_CREATED_EVENT, {
    detail: {
      ids,
      ...(ids.length === 1 ? { id: ids[0] } : {}),
    },
  }));
};
