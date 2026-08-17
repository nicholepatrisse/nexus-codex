interface SignOutResult {
  error?: unknown;
}

export async function signOutAndRefresh<T extends SignOutResult>(
  signOut: () => Promise<T>,
  refresh: () => void,
): Promise<T> {
  const result = await signOut();

  if (!result.error) refresh();

  return result;
}
