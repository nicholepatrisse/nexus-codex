export type GmActionState = {
  status?: "pending" | "cancelled";
  message?: string;
  error?: string;
};
