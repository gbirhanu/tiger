import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";

// Use the queryClient from queryClient.ts instead of creating a new one here
// This ensures consistency across the application

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ReactQueryDevtools initialIsOpen={false} position="bottom" />
  </QueryClientProvider>
);
