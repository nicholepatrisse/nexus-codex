export interface CommunitySettingsFormState {
  fieldErrors?: Record<string, string[] | undefined>;
  formError?: string;
  success?: string;
}

export interface CommunityLifecycleFormState {
  formError?: string;
}
