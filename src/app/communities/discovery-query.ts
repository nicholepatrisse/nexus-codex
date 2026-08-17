export interface DirectoryQuery {
  page: number;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDirectoryQuery(parameters: {
  page?: string | string[];
}): DirectoryQuery {
  const pageValue = firstValue(parameters.page);
  const parsedPage = pageValue && /^\d+$/.test(pageValue) ? Number(pageValue) : 1;

  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function directoryHref(page: number): string {
  return page > 1 ? `/communities?page=${page}` : "/communities";
}
