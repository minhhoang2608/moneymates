import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useRepositories } from "@/db/RepositoriesProvider";

export const ONBOARDING_STATUS_KEY = ["profile", "onboarding"] as const;

/** Whether the first-run onboarding has been completed (`profile.onboarding_completed_at` is set). */
export function useOnboardingStatus() {
  const { profile } = useRepositories();
  const { isPending, data } = useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => profile.getOnboardingCompletedAt(),
  });
  return { loading: isPending, completed: data != null };
}

export function useMarkOnboardingCompleted() {
  const { profile } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => profile.markOnboardingCompleted(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY }),
  });
}

export function useResetOnboarding() {
  const { profile } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => profile.resetOnboarding(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY }),
  });
}
