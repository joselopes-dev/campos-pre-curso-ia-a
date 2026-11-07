/**
 * Tipos e Interfaces Centrais da Plataforma Educacional de IA
 * Pré-Curso de Inteligência Artificial
 */

export type UserRole = 'aluno' | 'professor' | 'administrador';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  registration_number?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalIdentity {
  id: string;
  user_id: string;
  provider: 'google';
  provider_id: string; // Google sub ID estável
  email: string;
  created_at: string;
}

export interface Module {
  id: number;
  title: string;
  subtitle: string;
  total_hours: number;
  description: string;
  order: number;
}

export type DisciplineStatus = 'bloqueado' | 'em_andamento' | 'concluido';

export interface Discipline {
  id: string;
  order: number; // 1 a 20
  code: string;
  moduleId: number; // 1, 2 ou 3
  title: string;
  hours: number;
  summary: string;
  competencies: string[];
  prerequisites?: string[];
  localMaterialPath: string;
  totalLessons: number;
}

export type LessonStepType = 'video' | 'slides' | 'pdf' | 'quiz' | 'next_unlock';

export interface LessonStep {
  stepNumber: number; // 1: Vídeo, 2: Slides, 3: Material PDF, 4: Teste de Fixação, 5: Liberação
  type: LessonStepType;
  title: string;
  description: string;
  requiredTimeMinutes?: number;
  assetUrl?: string;
  isAvailable: boolean; // Se o material local já existe ou se está "Em preparação"
}

export interface Lesson {
  id: string;
  disciplineId: string;
  order: number;
  title: string;
  summary: string;
  steps: LessonStep[];
}

export interface StudentProgress {
  userId: string;
  disciplineId: string;
  lessonId: string;
  stepNumber: number;
  completed: boolean;
  completedAt?: string;
  quizScore?: number;
}

export interface DisciplineProgress {
  disciplineId: string;
  status: DisciplineStatus;
  completedLessonsCount: number;
  totalLessonsCount: number;
  percent: number;
  finalGrade?: number;
  lastAccessedLessonId?: string;
}

export interface QuizQuestion {
  id: string;
  disciplineId: string;
  lessonId?: string;
  question: string;
  options: string[];
  // Resposta correta mantida ESTRITAMENTE no backend
}

export interface Certificate {
  id: string;
  validationCode: string;
  userId: string;
  userName: string;
  courseTitle: string;
  totalHours: number;
  issuedAt: string;
  completionDate: string;
  status: 'valido' | 'revogado';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  disciplineId?: string;
  lessonId?: string;
  sources?: { title: string; section?: string; path?: string; pageNumber?: number; similarity?: string }[];
}

export interface FinalExamQuestion {
  id: string;
  disciplineId: string;
  questionNumber: number; // 1 a 10
  question: string;
  options: string[];
  // Resposta correta mantida ESTRITAMENTE no backend
}

export interface FinalExamAttempt {
  id: string;
  userId: string;
  disciplineId: string;
  score: number; // 0.0 a 10.0
  passed: boolean; // score >= 7.0
  answers: number[];
  attemptedAt: string;
}

export interface DisciplineApproval {
  userId: string;
  disciplineId: string;
  approved: boolean;
  finalGrade: number; // 0.0 a 10.0
  approvedAt: string;
}

export interface DisciplineFile {
  name: string;
  url: string;
  downloadUrl?: string;
  size: number;
  formattedSize: string;
  type: 'pdf' | 'text' | 'markdown' | 'video';
  label: string;
  description: string;
}

export interface DisciplineFileContent {
  filename: string;
  url: string;
  type: 'pdf' | 'text' | 'markdown' | 'video';
  content?: string;
  linesCount?: number;
  charactersCount?: number;
}

