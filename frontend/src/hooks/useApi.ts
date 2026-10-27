import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api, Project, Skill, ContactFormData } from '@/lib/api';

// Projects hooks
export const useProjects = (options?: UseQueryOptions<Project[]>) => {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    ...options,
  });
};

export const useProject = (id: number, options?: UseQueryOptions<Project>) => {
  return useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
    ...options,
  });
};

// Skills hooks
export const useSkills = (options?: UseQueryOptions<Skill[]>) => {
  return useQuery<Skill[]>({
    queryKey: ['skills'],
    queryFn: () => api.getSkills(),
    ...options,
  });
};

export const useSkillsByCategory = (category: string, options?: UseQueryOptions<Skill[]>) => {
  return useQuery<Skill[]>({
    queryKey: ['skills', category],
    queryFn: () => api.getSkillsByCategory(category),
    ...options,
  });
};

// Contact form hook
export const useContactForm = (
  options?: UseMutationOptions<
    { success: boolean; message: string },
    Error,
    ContactFormData
  >
) => {
  return useMutation<{ success: boolean; message: string }, Error, ContactFormData>({
    mutationFn: (data) => api.submitContactForm(data),
    ...options,
  });
};