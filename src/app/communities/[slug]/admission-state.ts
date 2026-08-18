export type AdmissionActionState = Readonly<{
  status?: "pending" | "admitted" | "cancelled";
  requestId?: string;
  message?: string;
  error?: string;
}>;
