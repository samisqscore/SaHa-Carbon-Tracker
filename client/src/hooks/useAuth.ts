import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isApproved = user?.status === "approved";
  const isPending = user?.status === "pending";
  const isRejected = user?.status === "rejected";

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    isApproved,
    isPending,
    isRejected,
    error,
  };
}
