interface SignOutResult {
  error?: unknown;
}

export async function signOutAndRedirect<T extends SignOutResult>(
  signOut: () => Promise<T>,
  redirect: (href: "/") => void,
): Promise<T> {
  const result = await signOut();

  if (!result.error) redirect("/");

  return result;
}
