import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log("🌐 API REQUEST INITIATED");
  console.log("🔗 URL:", url);
  console.log("📝 Method:", method);
  console.log("📦 Data:", data ? JSON.stringify(data, null, 2) : "No data");

  const activeOrgId = localStorage.getItem("saha_active_org_id");

  const config: RequestInit = {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(activeOrgId ? { "x-organization-id": activeOrgId } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  };

  if (data) {
    console.log("📤 Request body:", JSON.stringify(data, null, 2));
  }

  console.log("⚙️ Request config:", JSON.stringify(config, null, 2));

  try {
    console.log("📡 Sending fetch request...");
    const response = await fetch(url, config);

    console.log("📡 Response received:");
    console.log("📡 Status:", response.status);
    console.log("📡 Status text:", response.statusText);
    console.log("📡 Ok:", response.ok);
    console.log("📡 Type:", response.type);
    console.log("📡 URL:", response.url);
    console.log("📡 Headers:", Object.fromEntries(response.headers.entries()));

    return response;
  } catch (error) {
    console.error("💥 FETCH ERROR:");
    const err = error as Error;
    console.error("💥 Error:", err);
    console.error("💥 Error name:", err?.name);
    console.error("💥 Error message:", err?.message);
    console.error("💥 Error stack:", err?.stack);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const url = queryKey.join("/");
      const activeOrgId = localStorage.getItem("saha_active_org_id");

      const res = await fetch(url, {
        credentials: "include",
        headers: {
          ...(activeOrgId ? { "x-organization-id": activeOrgId } : {}),
        }
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});