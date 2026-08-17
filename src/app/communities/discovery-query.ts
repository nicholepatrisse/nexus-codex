const MAX_QUERY_LENGTH = 100;

export interface DiscoveryQuery {
  query: string;
  page: number;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDiscoveryQuery(parameters: {
  q?: string | string[];
  page?: string | string[];
}): DiscoveryQuery {
  const query = (firstValue(parameters.q) ?? "").trim().replace(/\s+/g, " ");
  const pageValue = firstValue(parameters.page);
  const parsedPage = pageValue && /^\d+$/.test(pageValue) ? Number(pageValue) : 1;

  return {
    query: query.slice(0, MAX_QUERY_LENGTH),
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function discoveryHref(query: string, page: number): string {
  const parameters = new URLSearchParams();
  if (query) parameters.set("q", query);
  if (page > 1) parameters.set("page", String(page));
  const serialized = parameters.toString();
  return serialized ? `/communities?${serialized}` : "/communities";
}
