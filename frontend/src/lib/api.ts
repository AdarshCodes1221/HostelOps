export interface Project {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  imageUrl: string;
  githubUrl: string;
  liveUrl: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  level: number;
}

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

const mockProjects: Project[] = [
  {
    id: 1,
    title: 'Hostel Management Platform',
    description: 'A comprehensive web application for managing multi-hostel residential campus operations, student room allocations, complaints, and outpasses.',
    technologies: ['React', 'TypeScript', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS'],
    imageUrl: 'https://via.placeholder.com/600x400?text=Hostel+Management',
    githubUrl: 'https://github.com/AdarshCodes1221/Hostel-Management-System-FullStack',
    liveUrl: 'http://localhost:8080'
  }
];

const mockSkills: Skill[] = [
  { id: 1, name: 'React', category: 'Frontend', level: 90 },
  { id: 2, name: 'TypeScript', category: 'Frontend', level: 85 },
  { id: 3, name: 'Node.js', category: 'Backend', level: 85 },
  { id: 4, name: 'Express', category: 'Backend', level: 85 },
  { id: 5, name: 'MongoDB', category: 'Database', level: 80 }
];

export const api = {
  getProjects: async (): Promise<Project[]> => {
    return Promise.resolve(mockProjects);
  },
  getProject: async (id: number): Promise<Project> => {
    const project = mockProjects.find((p) => p.id === id);
    if (!project) throw new Error('Project not found');
    return Promise.resolve(project);
  },
  getSkills: async (): Promise<Skill[]> => {
    return Promise.resolve(mockSkills);
  },
  getSkillsByCategory: async (category: string): Promise<Skill[]> => {
    return Promise.resolve(mockSkills.filter((s) => s.category.toLowerCase() === category.toLowerCase()));
  },
  submitContactForm: async (data: ContactFormData): Promise<{ success: boolean; message: string }> => {
    return Promise.resolve({ success: true, message: 'Message sent successfully' });
  }
};
