import type { AuthorizationOperation } from "@/authorization/policy";

export type AuthorizationDenialReason =
  | "resource-unavailable"
  | "insufficient-permission";

/**
 * Deliberately excludes actor, community, slug, and request data. Denial logs
 * must remain useful without becoming a side channel for private metadata.
 */
export type AuthorizationDenialEvent = Readonly<{
  operation: AuthorizationOperation;
  reason: AuthorizationDenialReason;
}>;

export type AuthorizationDenialSink = (event: AuthorizationDenialEvent) => void;

export const logAuthorizationDenial: AuthorizationDenialSink = (event) => {
  console.warn("Authorization denied", event);
};
