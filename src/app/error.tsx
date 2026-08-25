"use client";

import { useEffect, useState } from "react";
import { getOpaqueErrorId } from "@/app/error-identity";
import { reportApplicationError } from "@/app/error-reporting";
import { ErrorState } from "@/app/error-state";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId] = useState(() => getOpaqueErrorId(error));

  useEffect(() => {
    reportApplicationError({ boundary: "route", errorId, error });
  }, [error, errorId]);

  return <ErrorState errorId={errorId} onRetry={reset} />;
}

