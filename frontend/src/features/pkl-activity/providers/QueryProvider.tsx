/**
 * @file providers/QueryProvider.tsx
 * @description React Query Client Provider for client-side state caching in Next.js App Router.
 */

"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000, // 5 seconds stale time
            refetchOnWindowFocus: false, // disable aggressive refetching on window focus
            retry: 1, // retry failed queries once
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
export { QueryClient };
