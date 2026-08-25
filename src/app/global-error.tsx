"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import { getOpaqueErrorId } from "@/app/error-identity";
import { reportApplicationError } from "@/app/error-reporting";
import { ErrorState } from "@/app/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId] = useState(() => getOpaqueErrorId(error));

  useEffect(() => {
    reportApplicationError({ boundary: "global", errorId, error });
  }, [error, errorId]);

  return (
    <html lang="en">
      <body>
        <ErrorState errorId={errorId} onRetry={reset} global />
      </body>
    </html>
  );
}

