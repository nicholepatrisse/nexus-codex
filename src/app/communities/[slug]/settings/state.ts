export interface CommunitySettingsFormState {
  fieldErrors?: Record<string, string[] | undefined>;
  formError?: string;
  success?: string;
  saved?: {
    slug: string;
    visibility: string;
    membershipApproval: string;
    gmAdmission: string;
    scheduleVisibility: string;
  };
}

export interface CommunityLifecycleFormState {
  formError?: string;
}
