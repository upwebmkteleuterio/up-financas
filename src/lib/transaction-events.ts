export const TRANSACTION_CREATED_EVENT = "finance-transaction-created";

export interface TransactionCreatedDetail {
  id: string;
}

export const dispatchTransactionCreated = (id: string) => {
  window.dispatchEvent(new CustomEvent<TransactionCreatedDetail>(TRANSACTION_CREATED_EVENT, {
    detail: { id },
  }));
};
