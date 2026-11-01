export type TopupCheckout = {
  id?: string;
  status?: string;
  request_id?: string;
  requestId?: string;
  metadata?: Record<string, string>;
  product?: { id?: string } | string;
  order?: {
    id?: string;
    status?: string;
    amount?: number;
    subTotal?: number;
    sub_total?: number;
    amountPaid?: number;
    amount_paid?: number;
    discountAmount?: number;
    discount_amount?: number;
    transaction?: string | null;
    currency?: string;
    product?: string | { id?: string };
  };
};
