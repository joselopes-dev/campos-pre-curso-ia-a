import React, { useState, useEffect, useMemo } from 'react';
import { 
  Discipline, 
  Lesson, 
  User, 
  FinalExamQuestion, 
  DisciplineFile 
} from '../types/index.ts';
import { 
  ArrowLeft, 
  Video, 
  SlidersHorizontal, 
  FileText, 
  CheckSquare, 
  Unlock, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Bot, 
  Download, 
  ChevronDown, 
  HelpCircle,
  Award,
  FileCheck,
  Eye,
  BookOpen,
  ExternalLink,
  X,
  Search,
  Copy,
  Check,
  FolderOpen,
  FileCode,
  Sparkles,
  Layers,
  Compass,
  File,
  RotateCcw
} from 'lucide-react';

interface ClassroomProps {
  disciplineId: string;
  user: User;
  onBack: () => void;
  openTutorWithContext: (disciplineId: string, lessonId: string) => void;
  onProgressUpdated: () => void;
  onSelectDiscipline?: (disciplineId: string) => void;
  allDisciplines?: Discipline[];
}

export const Classroom: React.FC<ClassroomProps> = ({
  disciplineId: initialDisciplineId,
  user,
  onBack,
  openTutorWithContext,
  onProgressUpdated,
  onSelectDiscipline,
  allDisciplines = [],
}) => {
  // Disciplina ativa na sala de aula
  const [currentDisciplineId, setCurrentDisciplineId] = useState<string>(initialDisciplineId);
  const [disciplinesList, setDisciplinesList] = useState<Discipline[]>(allDisciplines);
  const [isDisciplineDropdownOpen, setIsDisciplineDropdownOpen] = useState<boolean>(false);
  const [moduleFilter, setModuleFilter] = useState<number | 'all'>('all');

  // Dados da disciplina atual
  const [disciplineData, setDisciplineData] = useState<{ discipline: Discipline; lessons: Lesson[]; module?: any } | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [activeStepNumber, setActiveStepNumber] = useState<number>(1);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Arquivos individuais da disciplina atual
  const [disciplineFiles, setDisciplineFiles] = useState<DisciplineFile[]>([]);
  const [filesLoading, setFilesLoading] = useState<boolean>(false);
  const [filesFilter, setFilesFilter] = useState<'all' | 'pdf' | 'text' | 'markdown'>('all');

  // Visualizador / Leitor de Documentos Integrado (Modal)
  const [isReaderOpen, setIsReaderOpen] = useState<boolean>(false);
  const [readerFile, setReaderFile] = useState<DisciplineFile | null>(null);
  const [readerContent, setReaderContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [isMobileLessonsOpen, setIsMobileLessonsOpen] = useState<boolean>(false);

  // Estado do Teste de Fixação (Etapa 4 - 3 questões dinâmicas por aula)
  const [quizQuestions, setQuizQuestions] = useState<Array<{ question: string; options: string[] }>>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({ 0: -1, 1: -1, 2: -1 });
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; feedback: string; explanation: string } | null>(null);
  const [quizLoading, setQuizLoading] = useState<boolean>(false);

  // Estado da Avaliação Final da Disciplina (10 questões)
  const [isFinalExamActive, setIsFinalExamActive] = useState<boolean>(false);
  const [finalExamQuestions, setFinalExamQuestions] = useState<FinalExamQuestion[]>([]);
  const [finalExamAnswers, setFinalExamAnswers] = useState<Record<number, number>>({});
  const [finalExamResult, setFinalExamResult] = useState<{ score: number; passed: boolean; feedback: string } | null>(null);
  const [isDisciplineApproved, setIsDisciplineApproved] = useState<boolean>(false);
  const [finalGrade, setFinalGrade] = useState<number | null>(null);

  // Sincroniza quando a prop externa mudar
  useEffect(() => {
    if (initialDisciplineId && initialDisciplineId !== currentDisciplineId) {
      setCurrentDisciplineId(initialDisciplineId);
    }
  }, [initialDisciplineId]);

  // Carrega lista geral de disciplinas se não fornecida
  useEffect(() => {
    if (disciplinesList.length === 0) {
      fetch('/api/v1/curriculum/disciplines')
        .then((res) => res.json())
        .then((data) => {
          if (data.disciplines) setDisciplinesList(data.disciplines);
        })
        .catch((err) => console.error('Erro ao carregar lista de disciplinas:', err));
    }
  }, [disciplinesList.length]);

  // 1. Carrega dados da disciplina ativa e lições
  useEffect(() => {
    let isMounted = true;

    async function loadDiscipline() {
      try {
        setLoading(true);
        setFeedbackMessage(null);
        setIsFinalExamActive(false);
        setFinalExamResult(null);
        setQuizResult(null);
        setQuizAnswers({ 0: -1, 1: -1, 2: -1 });

        // 1.1 Dados da disciplina
        const res = await fetch(`/api/v1/curriculum/disciplines/${currentDisciplineId}`);
        const data = await res.json();

        if (!isMounted) return;
        setDisciplineData(data);

        if (data.lessons && data.lessons.length > 0) {
          setActiveLessonId(data.lessons[0].id);
          setActiveStepNumber(1);
        }

        // 1.2 Progresso do usuário
        const progRes = await fetch('/api/v1/progress');
        const progData = await progRes.json();

        if (!isMounted) return;

        const map: Record<string, boolean> = {};
        if (progData.rawProgress) {
          progData.rawProgress.forEach((p: any) => {
            if (p.disciplineId === currentDisciplineId && p.completed) {
              map[`${p.lessonId}:${p.stepNumber}`] = true;
            }
          });
        }
        setProgressMap(map);

        // Verifica aprovação final
        const approval = progData.approvals?.find((a: any) => a.disciplineId === currentDisciplineId && a.approved);
        if (approval) {
          setIsDisciplineApproved(true);
          setFinalGrade(approval.finalGrade);
        } else {
          setIsDisciplineApproved(false);
          setFinalGrade(null);
        }

        // 1.3 Carrega arquivos individuais físicos da disciplina
        loadDisciplineFiles(currentDisciplineId);
      } catch (err) {
        console.error('Erro ao carregar dados da disciplina:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDiscipline();

    return () => {
      isMounted = false;
    };
  }, [currentDisciplineId]);

  // 2. Carrega lista de arquivos físicos individuais da disciplina
  const loadDisciplineFiles = async (discId: string) => {
    try {
      setFilesLoading(true);
      const res = await fetch(`/api/v1/curriculum/disciplines/${discId}/files`);
      if (res.ok) {
        const data = await res.json();
        setDisciplineFiles(data.files || []);
      }
    } catch (err) {
      console.error('Erro ao carregar arquivos da disciplina:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  // 3. Carrega questões dinâmicas do teste de fixação para a aula atual
  useEffect(() => {
    if (!currentDisciplineId || !activeLessonId) return;

    let isMounted = true;
    async function loadQuiz() {
      try {
        setQuizLoading(true);
        const res = await fetch(`/api/v1/curriculum/disciplines/${currentDisciplineId}/lessons/${activeLessonId}/quiz`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.questions) {
            setQuizQuestions(data.questions);
            setQuizAnswers({ 0: -1, 1: -1, 2: -1 });
            setQuizResult(null);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar teste da aula:', err);
      } finally {
        if (isMounted) setQuizLoading(false);
      }
    }

    loadQuiz();

    return () => {
      isMounted = false;
    };
  }, [currentDisciplineId, activeLessonId]);

  // Abre leitor de arquivos no modal integrado
  const handleOpenFile = async (file: DisciplineFile) => {
    setReaderFile(file);
    setIsReaderOpen(true);
    setSearchQuery('');
    setHasCopied(false);

    if (file.type === 'pdf') {
      setReaderContent(null);
      setContentLoading(false);
      return;
    }

    // Se for texto ou markdown, carrega o conteúdo via API
    try {
      setContentLoading(true);
      const res = await fetch(
        `/api/v1/curriculum/disciplines/${currentDisciplineId}/file-content?filename=${encodeURIComponent(file.name)}`
      );
      if (res.ok) {
        const data = await res.json();
        setReaderContent(data.content || 'Arquivo vazio.');
      } else {
        setReaderContent('Não foi possível ler o conteúdo do arquivo.');
      }
    } catch (err: any) {
      setReaderContent('Erro ao carregar conteúdo: ' + err.message);
    } finally {
      setContentLoading(false);
    }
  };

  // Copia conteúdo de texto para a área de transferência
  const handleCopyText = () => {
    if (!readerContent) return;
    navigator.clipboard.writeText(readerContent);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  // Alterna a disciplina selecionada diretamente na sala
  const handleSwitchDiscipline = (newDisciplineId: string) => {
    setCurrentDisciplineId(newDisciplineId);
    setIsDisciplineDropdownOpen(false);
    if (onSelectDiscipline) {
      onSelectDiscipline(newDisciplineId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading || !disciplineData) {
    return (
      <div className="flex items-center justify-center min-h-[460px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-gray-700">Carregando ambiente da sala de aula e acervo didático...</p>
          <p className="text-xs text-gray-400">Verificando arquivos PDF, textos e progresso acadêmico</p>
        </div>
      </div>
    );
  }

  const { discipline, lessons, module } = disciplineData;
  const currentLesson = lessons.find((l) => l.id === activeLessonId) || lessons[0];

  // Verifica se todas as aulas da disciplina foram concluídas
  const areAllLessonsCompleted = lessons.every((l) => Boolean(progressMap[`${l.id}:5`]));

  // Helper para verificar desbloqueio de passos
  const isStepUnlocked = (stepNum: number) => {
    if (stepNum === 1) return true;
    return Boolean(progressMap[`${currentLesson.id}:${stepNum - 1}`]);
  };

  const isStepCompleted = (stepNum: number) => {
    return Boolean(progressMap[`${currentLesson.id}:${stepNum}`]);
  };

  // Concluir Etapas 1, 2, 3 ou 5 no backend
  const handleCompleteStep = async (stepNum: number) => {
    try {
      setActionLoading(true);
      setFeedbackMessage(null);

      const res = await fetch('/api/v1/progress/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplineId: discipline.id,
          lessonId: currentLesson.id,
          stepNumber: stepNum,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setFeedbackMessage({ type: 'error', text: result.message || result.error });
        return;
      }

      setProgressMap((prev) => ({
        ...prev,
        [`${currentLesson.id}:${stepNum}`]: true,
      }));

      setFeedbackMessage({ type: 'success', text: result.message });
      onProgressUpdated();

      if (stepNum < 5) {
        setActiveStepNumber(stepNum + 1);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Falha de comunicação com o servidor: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Submeter Teste de Fixação (Etapa 4 da Aula)
  const handleSubmitQuiz = async () => {
    try {
      setActionLoading(true);
      setFeedbackMessage(null);

      const answersArray = [quizAnswers[0], quizAnswers[1], quizAnswers[2]];
      if (answersArray.some((a) => a === -1)) {
        setFeedbackMessage({ type: 'error', text: 'Por favor, responda a todas as 3 questões antes de submeter.' });
        setActionLoading(false);
        return;
      }

      const res = await fetch('/api/v1/progress/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplineId: discipline.id,
          lessonId: currentLesson.id,
          answers: answersArray,
        }),
      });

      const result = await res.json();
      setQuizResult(result);

      if (result.passed) {
        setProgressMap((prev) => ({
          ...prev,
          [`${currentLesson.id}:4`]: true,
        }));
        setFeedbackMessage({ type: 'success', text: result.feedback });
        onProgressUpdated();
        setActiveStepNumber(5);
      } else {
        setFeedbackMessage({ type: 'error', text: result.feedback });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Erro ao avaliar teste: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Abrir Avaliação Final de 10 Questões
  const handleOpenFinalExam = async () => {
    try {
      setActionLoading(true);
      setFeedbackMessage(null);
      setIsFinalExamActive(true);

      const res = await fetch(`/api/v1/progress/final-exam/${discipline.id}`);
      const data = await res.json();

      if (!res.ok) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Não foi possível carregar a Avaliação Final.' });
        setIsFinalExamActive(false);
        return;
      }

      setFinalExamQuestions(data.questions || []);
      const initialAnswers: Record<number, number> = {};
      for (let i = 0; i < 10; i++) initialAnswers[i] = -1;
      setFinalExamAnswers(initialAnswers);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Falha ao acessar Avaliação Final: ' + err.message });
      setIsFinalExamActive(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Submeter Avaliação Final de 10 Questões
  const handleSubmitFinalExam = async () => {
    try {
      setActionLoading(true);
      setFeedbackMessage(null);

      const answersArray: number[] = [];
      for (let i = 0; i < 10; i++) {
        answersArray.push(finalExamAnswers[i] ?? -1);
      }

      if (answersArray.some((a) => a === -1)) {
        setFeedbackMessage({ type: 'error', text: 'Por favor, responda a todas as 10 questões da Avaliação Final antes de submeter.' });
        setActionLoading(false);
        return;
      }

      const res = await fetch(`/api/v1/progress/final-exam/${discipline.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      });

      const result = await res.json();
      setFinalExamResult(result);

      if (result.passed) {
        setIsDisciplineApproved(true);
        setFinalGrade(result.score);
        setFeedbackMessage({ type: 'success', text: result.feedback });
        onProgressUpdated();
      } else {
        setFeedbackMessage({ type: 'error', text: result.feedback });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Erro ao processar Avaliação Final: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtra arquivos da disciplina por tipo
  const filteredFiles = disciplineFiles.filter((f) => {
    if (filesFilter === 'all') return true;
    return f.type === filesFilter;
  });

  // Número oficial da disciplina com 2 dígitos (01 a 20)
  const discNum = String(discipline.order || 1).padStart(2, '0');

  // Arquivos específicos para uso rápido nos passos da aula de acordo com a numeração da disciplina
  const slidesFile = disciplineFiles.find((f) => 
    f.name === `slides-aula-${discNum}.pdf` || 
    f.name === `slides-${discNum}.pdf` || 
    f.name === 'slides-aula-01.pdf' ||
    f.name.startsWith('slides-')
  ) || {
    name: `slides-aula-${discNum}.pdf`,
    url: `${discipline.localMaterialPath}/slides-aula-${discNum}.pdf`,
    downloadUrl: `/api/v1/curriculum/disciplines/${discipline.id}/download?filename=slides-aula-${discNum}.pdf`,
    size: 50000,
    formattedSize: '50 KB',
    type: 'pdf' as const,
    label: `Slides de Apresentação (Disciplina ${discNum})`,
    description: 'Lâminas conceituais da aula.',
  };

  const apostilaAulaPdfFile = disciplineFiles.find((f) => 
    f.name === `apostila-aula-${discNum}.pdf` || 
    f.name === `apostila-${discNum}.pdf` || 
    f.name === 'apostila-aula-01.pdf' ||
    (f.name.startsWith('apostila-aula-') && f.name.endsWith('.pdf'))
  ) || {
    name: `apostila-aula-${discNum}.pdf`,
    url: `${discipline.localMaterialPath}/apostila-aula-${discNum}.pdf`,
    downloadUrl: `/api/v1/curriculum/disciplines/${discipline.id}/download?filename=apostila-aula-${discNum}.pdf`,
    size: 80000,
    formattedSize: '80 KB',
    type: 'pdf' as const,
    label: `Apostila Didática (Disciplina ${discNum})`,
    description: 'Texto didático completo da disciplina.',
  };

  const completeBookPdfFile = disciplineFiles.find((f) => 
    f.name.startsWith('apostila-') && 
    f.name.endsWith('.pdf') && 
    !f.name.startsWith('apostila-aula-') &&
    f.name !== `apostila-${discNum}.pdf`
  );

  const apostilaTxtFile = disciplineFiles.find((f) => 
    f.name === `apostila-aula-${discNum}.txt` || 
    f.name === `apostila-${discNum}.txt` || 
    f.name === 'apostila-aula-01.txt' ||
    (f.name.startsWith('apostila-aula-') && f.name.endsWith('.txt'))
  );

  const officialStudyTxtFile = disciplineFiles.find((f) => 
    f.name === 'material-estudo.txt' || 
    f.name === `material-estudo-${discNum}.txt` ||
    f.name === 'material-estudo-experimental.txt'
  );

  // Vídeo oficial da disciplina (busca video-aula-XX.mp4, video-XX.mp4 ou qualquer vídeo na pasta)
  const videoFile = disciplineFiles.find((f) => 
    f.name === `video-aula-${discNum}.mp4` ||
    f.name === `video-${discNum}.mp4` ||
    f.name === `video-aula-${discNum}.webm` ||
    f.type === 'video' || 
    f.name.endsWith('.mp4') || 
    f.name.endsWith('.webm') || 
    f.name.endsWith('.mov')
  );

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR: NAVEGAÇÃO, SELETOR DE DISCIPLINAS E MÓDULOS */}
      {/* ============================================================== */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Lado Esquerdo: Voltar + Identificação da Disciplina */}
          <div className="flex items-start sm:items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer shrink-0"
              title="Voltar ao catálogo de disciplinas"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-100 text-[#006633] text-xs font-black px-2.5 py-0.5 rounded uppercase tracking-wider">
                  {discipline.code}
                </span>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  Módulo {discipline.moduleId} • {discipline.hours} horas
                </span>
                {isDisciplineApproved && (
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-[#006633]" />
                    <span>Aprovado(a) • Nota {finalGrade?.toFixed(1)}/10,0</span>
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                {discipline.title}
              </h1>
            </div>
          </div>

          {/* Lado Direito: Ações Rápidas (Seletor de Disciplina e Tutor IA) */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto">
            {/* Botão Seletor de Disciplinas */}
            <div className="relative flex-1 sm:flex-initial">
              <button
                onClick={() => setIsDisciplineDropdownOpen(!isDisciplineDropdownOpen)}
                className="w-full sm:w-auto bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold px-3 sm:px-3.5 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 sm:space-x-2 transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#006633] shrink-0" />
                <span>Trocar Disciplina</span>
                <span className="hidden sm:inline">(20 Componentes)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDisciplineDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Menu Flutuante de Seleção de Todas as 20 Disciplinas e 3 Módulos */}
              {isDisciplineDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-xl z-40 p-3 space-y-2 max-h-[460px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 px-1">
                    <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
                      Matriz Completa (200h)
                    </span>
                    <button
                      onClick={() => setIsDisciplineDropdownOpen(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Filtro por Módulo */}
                  <div className="flex items-center space-x-1 p-1 bg-gray-100 rounded-lg text-[11px]">
                    <button
                      onClick={() => setModuleFilter('all')}
                      className={`flex-1 py-1 text-center font-bold rounded-md transition-colors ${
                        moduleFilter === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setModuleFilter(1)}
                      className={`flex-1 py-1 text-center font-bold rounded-md transition-colors ${
                        moduleFilter === 1 ? 'bg-white shadow-xs text-[#006633]' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Mod. 1 (6)
                    </button>
                    <button
                      onClick={() => setModuleFilter(2)}
                      className={`flex-1 py-1 text-center font-bold rounded-md transition-colors ${
                        moduleFilter === 2 ? 'bg-white shadow-xs text-[#006633]' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Mod. 2 (6)
                    </button>
                    <button
                      onClick={() => setModuleFilter(3)}
                      className={`flex-1 py-1 text-center font-bold rounded-md transition-colors ${
                        moduleFilter === 3 ? 'bg-white shadow-xs text-[#006633]' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Mod. 3 (8)
                    </button>
                  </div>

                  {/* Lista de Disciplinas */}
                  <div className="space-y-1 pt-1">
                    {disciplinesList
                      .filter((d) => moduleFilter === 'all' || d.moduleId === moduleFilter)
                      .map((d) => {
                        const isCurrent = d.id === currentDisciplineId;
                        return (
                          <button
                            key={d.id}
                            onClick={() => handleSwitchDiscipline(d.id)}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? 'border-[#006633] bg-emerald-50 text-[#006633] font-bold shadow-xs'
                                : 'border-gray-100 hover:border-emerald-200 hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="space-y-0.5 truncate pr-2">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono text-[10px] bg-gray-200 text-gray-800 px-1.5 py-0.2 rounded font-bold">
                                  {d.code}
                                </span>
                                <span className="text-[10px] text-gray-500">Módulo {d.moduleId}</span>
                              </div>
                              <p className="truncate font-semibold text-gray-900">{d.title}</p>
                            </div>
                            <span className="text-[10px] font-mono shrink-0 text-gray-500 font-bold">{d.hours}h</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Botão Tutor IA */}
            <button
              onClick={() => openTutorWithContext(discipline.id, currentLesson.id)}
              className="flex-1 sm:flex-initial bg-emerald-50 hover:bg-emerald-100 text-[#006633] border border-emerald-300 font-bold px-3 sm:px-3.5 py-2 rounded-xl text-xs flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer shadow-xs truncate"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="truncate">Tutor IA Desta Aula</span>
            </button>
          </div>
        </div>

        {/* Resumo da ementa e competências */}
        <div className="pt-2 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-gray-600">
          <p className="line-clamp-2 md:line-clamp-1 max-w-4xl text-gray-700">
            <strong>Ementa:</strong> {discipline.summary}
          </p>
          <div className="shrink-0 flex items-center space-x-2 text-[11px] font-mono text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{disciplineFiles.length} arquivos disponíveis nesta disciplina</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. GRID PRINCIPAL: SIDEBAR DE AULAS + CONTEÚDO ATIVO */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ============================================================== */}
        {/* COLUNA ESQUERDA: LISTA DE AULAS + AVALIAÇÃO FINAL + ACERVO */}
        {/* ============================================================== */}
        <div className="lg:col-span-1 space-y-4">
          {/* Botão de Expansão no Mobile para não empurrar o conteúdo */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileLessonsOpen(!isMobileLessonsOpen)}
              className="w-full bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between text-xs font-bold text-gray-800 cursor-pointer"
            >
              <div className="flex items-center space-x-2 truncate pr-2">
                <BookOpen className="w-4 h-4 text-[#006633] shrink-0" />
                <span className="truncate">
                  {currentLesson.title}
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0 text-emerald-700">
                <span>{isMobileLessonsOpen ? 'Ocultar Detalhes' : lessons.length === 1 ? 'Aula 01' : `Aulas (${lessons.length})`}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileLessonsOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
          </div>

          <div className={`space-y-4 ${isMobileLessonsOpen ? 'block' : 'hidden lg:block'}`}>
            {/* Aulas da Disciplina */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-wider">
                {lessons.length === 1 ? 'Aula da Disciplina' : `Aulas da Disciplina (${lessons.length})`}
              </h2>
              <span className="text-[10px] text-gray-400 font-mono">5 etapas</span>
            </div>

            <div className="space-y-1.5">
              {lessons.map((lesson, idx) => {
                const isSelected = !isFinalExamActive && lesson.id === currentLesson.id;
                const isPreviousLessonFinished = idx === 0 || Boolean(progressMap[`${lessons[idx - 1].id}:5`]);
                const isLessonFullyCompleted = Boolean(progressMap[`${lesson.id}:5`]);

                return (
                  <button
                    key={lesson.id}
                    disabled={!isPreviousLessonFinished}
                    onClick={() => {
                      setIsFinalExamActive(false);
                      setActiveLessonId(lesson.id);
                      setActiveStepNumber(1);
                      setFeedbackMessage(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-[#006633] bg-emerald-50/60 shadow-xs ring-2 ring-[#006633]/20'
                        : isPreviousLessonFinished
                        ? 'border-gray-200 bg-white hover:border-emerald-300'
                        : 'border-gray-100 bg-gray-50/70 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-0.5 truncate pr-1">
                      <span className="font-bold text-gray-900 block truncate">{lesson.title}</span>
                      <p className="text-[11px] text-gray-500 truncate">{lesson.summary}</p>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {isLessonFullyCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isPreviousLessonFinished ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cartão de Avaliação Final da Disciplina (10 Questões) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-wider">
              Conclusão da Disciplina
            </h2>

            <button
              disabled={!areAllLessonsCompleted}
              onClick={handleOpenFinalExam}
              className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs space-y-2 cursor-pointer ${
                isFinalExamActive
                  ? 'border-[#006633] bg-emerald-100/60 ring-2 ring-[#006633]'
                  : isDisciplineApproved
                  ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                  : areAllLessonsCompleted
                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 shadow-xs'
                  : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 flex items-center space-x-1.5">
                  <FileCheck className="w-4 h-4 text-[#006633]" />
                  <span>Avaliação Final (10 Questões)</span>
                </span>
                {isDisciplineApproved ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : areAllLessonsCompleted ? (
                  <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Liberada</span>
                ) : (
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                )}
              </div>
              <p className="text-[11px] text-gray-600 leading-tight">
                {isDisciplineApproved
                  ? `Componente concluído com nota ${finalGrade?.toFixed(1)}/10,0.`
                  : areAllLessonsCompleted
                  ? 'Todas as aulas concluídas! Realize a avaliação final de 10 questões para homologar sua aprovação.'
                  : 'Exige conclusão integral das etapas de cada aula desta disciplina.'}
              </p>
            </button>
          </div>

          {/* ACERVO DE ARQUIVOS INDIVIDUAIS DA DISCIPLINA (FÍSICOS) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <div className="flex items-center space-x-1.5">
                <FolderOpen className="w-4 h-4 text-[#006633]" />
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                  Arquivos da Disciplina
                </h3>
              </div>
              <span className="text-[10px] bg-emerald-100 text-[#006633] font-bold px-1.5 py-0.5 rounded">
                {disciplineFiles.length} arquivos
              </span>
            </div>

            <p className="text-[11px] text-gray-500 leading-tight">
              Clique em qualquer arquivo para abrir no leitor integrado ou baixar para estudo local.
            </p>

            {/* Filtros rápidos dos arquivos */}
            <div className="flex items-center space-x-1 text-[10px] font-bold">
              <button
                onClick={() => setFilesFilter('all')}
                className={`px-2 py-0.5 rounded ${filesFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilesFilter('pdf')}
                className={`px-2 py-0.5 rounded ${filesFilter === 'pdf' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
              >
                PDFs
              </button>
              <button
                onClick={() => setFilesFilter('text')}
                className={`px-2 py-0.5 rounded ${filesFilter === 'text' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              >
                Textos
              </button>
              <button
                onClick={() => setFilesFilter('markdown')}
                className={`px-2 py-0.5 rounded ${filesFilter === 'markdown' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
              >
                README
              </button>
            </div>

            {/* Lista dos arquivos individuais */}
            {filesLoading ? (
              <div className="py-4 text-center text-xs text-gray-500 animate-pulse">
                Carregando arquivos da disciplina...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-3 text-center text-xs text-gray-400">
                Nenhum arquivo encontrado com este filtro.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredFiles.map((file) => {
                  const isPdf = file.type === 'pdf';
                  const isText = file.type === 'text';
                  const isMd = file.type === 'markdown';

                  return (
                    <div
                      key={file.name}
                      className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-emerald-300 transition-all text-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-start space-x-2 truncate">
                          {isPdf ? (
                            <FileText className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          ) : isMd ? (
                            <FileCode className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          ) : (
                            <File className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-gray-900 block truncate" title={file.label}>
                              {file.label}
                            </span>
                            <span className="font-mono text-[10px] text-gray-500 block truncate">
                              {file.name} • {file.formattedSize}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-600 line-clamp-1">{file.description}</p>

                      <div className="pt-1 flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenFile(file)}
                          className="flex-1 bg-white hover:bg-emerald-50 border border-emerald-300 hover:border-[#006633] text-[#006633] font-bold py-1 px-2 rounded-lg text-[11px] flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Abrir</span>
                        </button>

                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir em Nova Aba"
                          className="p-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <a
                          href={file.downloadUrl || file.url}
                          download
                          title="Baixar Arquivo"
                          className="p-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUNA DIREITA: SALA DE AULA SEQUENCIAL OU AVALIAÇÃO FINAL */}
        {/* ============================================================== */}
        <div className="lg:col-span-3 space-y-5">
          {/* Mensagens de Feedback */}
          {feedbackMessage && (
            <div
              className={`p-4 rounded-xl border text-xs flex items-center space-x-2 animate-in fade-in duration-200 ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* MODO AVALIAÇÃO FINAL DO COMPONENTE */}
          {isFinalExamActive ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
              <div className="border-b border-gray-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#006633] uppercase">Exame de Conclusão do Componente</span>
                  <h3 className="text-xl font-black text-gray-900">Avaliação Final — {discipline.code}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    10 questões conceituais e aplicadas • Nota mínima para homologação: 7,0 / 10,0
                  </p>
                </div>
                {isDisciplineApproved && (
                  <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold self-start">
                    ✓ Aprovado(a) com Nota {finalGrade?.toFixed(1)}/10,0
                  </div>
                )}
              </div>

              {/* 10 Questões Oficiais */}
              <div className="space-y-6">
                {finalExamQuestions.map((q, qIdx) => (
                  <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
                    <p className="text-xs font-bold text-gray-900 leading-relaxed">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <label
                          key={oIdx}
                          className={`flex items-start space-x-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            finalExamAnswers[qIdx] === oIdx
                              ? 'border-[#006633] bg-emerald-50 text-[#006633] font-semibold ring-1 ring-[#006633]'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`final_q_${qIdx}`}
                            checked={finalExamAnswers[qIdx] === oIdx}
                            onChange={() => setFinalExamAnswers({ ...finalExamAnswers, [qIdx]: oIdx })}
                            className="mt-0.5 text-[#006633] focus:ring-emerald-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {finalExamResult && (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1 ${
                    finalExamResult.passed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}
                >
                  <p className="font-bold text-sm">Resultado Oficial: {finalExamResult.score.toFixed(1)} / 10,0</p>
                  <p>{finalExamResult.feedback}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  disabled={actionLoading}
                  onClick={handleSubmitFinalExam}
                  className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Submeter Avaliação Final para Correção no Servidor</span>
                </button>
              </div>
            </div>
          ) : (
            // ==============================================================
            // MODO AULA NORMAL SEQUENCIAL EM 5 ETAPAS OBRIGATÓRIAS
            // ==============================================================
            <>
              {/* Barra de Progresso das 5 Etapas Obrigatórias */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider truncate pr-2">
                    {currentLesson.title} — Progressão:
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 font-bold shrink-0">
                    Etapa {activeStepNumber} de 5
                  </span>
                </div>

                <div className="flex sm:grid sm:grid-cols-5 gap-1.5 sm:gap-2 overflow-x-auto pb-1 text-center text-xs">
                  {[
                    { num: 1, label: 'Vídeo', fullLabel: '1. Vídeo', icon: Video },
                    { num: 2, label: 'Slides', fullLabel: '2. Slides', icon: SlidersHorizontal },
                    { num: 3, label: 'Apostila', fullLabel: '3. PDF Didático', icon: FileText },
                    { num: 4, label: 'Fixação', fullLabel: '4. Teste Fixação', icon: CheckSquare },
                    { num: 5, label: 'Liberação', fullLabel: '5. Liberação', icon: Unlock },
                  ].map(({ num, label, fullLabel, icon: Icon }) => {
                    const completed = isStepCompleted(num);
                    const unlocked = isStepUnlocked(num);
                    const isCurrent = activeStepNumber === num;

                    return (
                      <button
                        key={num}
                        disabled={!unlocked}
                        onClick={() => {
                          setActiveStepNumber(num);
                          setFeedbackMessage(null);
                        }}
                        className={`p-2 sm:p-2.5 rounded-xl border font-semibold transition-all flex flex-col items-center justify-center space-y-0.5 sm:space-y-1 cursor-pointer shrink-0 min-w-[68px] sm:min-w-0 flex-1 ${
                          completed
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : isCurrent
                            ? 'border-[#006633] bg-[#006633] text-white shadow-xs ring-2 ring-emerald-500/20'
                            : unlocked
                            ? 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
                            : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span className="sm:hidden text-[10px] font-bold">#{num}</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] leading-tight truncate w-full">
                          <span className="sm:hidden">{label}</span>
                          <span className="hidden sm:inline">{fullLabel}</span>
                        </span>
                        {completed ? (
                          <span className="text-[9px] sm:text-[10px] text-emerald-700 font-bold truncate">✓ Feito</span>
                        ) : !unlocked ? (
                          <span className="text-[9px] sm:text-[10px] text-gray-400 truncate">🔒 Bloq.</span>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] text-emerald-600 font-medium sm:hidden">Disponível</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CONTEÚDO DA ETAPA ATIVA DA AULA */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-xs min-h-[440px] flex flex-col justify-between">
                {/* ============================================================== */}
                {/* ETAPA 1: VÍDEO-AULA */}
                {/* ============================================================== */}
                {activeStepNumber === 1 && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-1">
                      <div>
                        <span className="text-xs font-bold text-[#006633] uppercase">Etapa 01 de 05</span>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Vídeo-Aula Expositiva e Introdução Temática</h3>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Carga estimada: 25 min</span>
                    </div>

                    {/* Player de Vídeo Responsivo (Suporta MP4/WebM local ou modo expositivo) */}
                    {videoFile ? (
                      <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                        <video
                          src={videoFile.url}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden relative flex flex-col items-center justify-center text-white shadow-inner p-3 sm:p-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#003d1c]/80 via-black/80 to-teal-950/80"></div>
                        <div className="relative z-10 text-center space-y-2 sm:space-y-3 max-w-lg px-2">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg transition-transform hover:scale-105 cursor-pointer">
                            <Play className="w-5 h-5 sm:w-7 sm:h-7 ml-0.5 sm:ml-1 text-white" />
                          </div>
                          <div>
                            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-400 font-bold">
                              {discipline.code} • {currentLesson.title}
                            </span>
                            <h4 className="font-bold text-sm sm:text-base text-white mt-0.5">{discipline.title}</h4>
                            <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-[10px] sm:text-xs font-medium">
                              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Vídeo-aula instrucional • Lâminas e Apostila nos Passos 2 e 3</span>
                            </div>
                          </div>
                          <div className="pt-2 text-[11px] text-emerald-100/90 bg-black/50 border border-white/10 rounded-xl p-2.5 max-w-md mx-auto space-y-1">
                            <p className="font-bold text-white text-[11px]">📁 Onde colocar o vídeo desta disciplina:</p>
                            <p className="font-mono text-[10px] text-emerald-300 break-all">
                              public{discipline.localMaterialPath}/video-aula-{discNum}.mp4
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1">
                      <p className="font-bold text-gray-800">Objetivo da Etapa 1:</p>
                      <p>
                        Acompanhar os conceitos fundamentais da aula e desbloquear o conjunto de lâminas pedagógicas (Passo 2).
                      </p>
                    </div>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleCompleteStep(1)}
                      className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isStepCompleted(1) ? 'Etapa 1 Concluída (Revalidar)' : 'Concluir Introdução e Desbloquear Slides'}</span>
                    </button>
                  </div>
                )}

                {/* ============================================================== */}
                {/* ETAPA 2: SLIDES DA AULA */}
                {/* ============================================================== */}
                {activeStepNumber === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#006633] uppercase">Etapa 02 de 05</span>
                        <h3 className="text-lg font-bold text-gray-900">Slides de Apresentação da Aula</h3>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Carga estimada: 15 min</span>
                    </div>

                    {/* Destaque das Lâminas com Leitor Integrado e Download */}
                    <div className="border border-emerald-200 bg-emerald-50/30 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#006633] flex items-center justify-center mx-auto shadow-xs">
                        <SlidersHorizontal className="w-8 h-8 text-[#006633]" />
                      </div>

                      <div className="max-w-md mx-auto space-y-1">
                        <span className="text-[10px] font-bold bg-emerald-200 text-[#006633] px-2 py-0.5 rounded-full uppercase">
                          Material Visual Oficial
                        </span>
                        <h4 className="font-bold text-gray-900 text-base">Lâminas Pedagógicas da Disciplina {discNum}</h4>
                        <p className="text-xs text-gray-600">
                          Síntese visual, diagramas de arquitetura e esquemas instrucionais para assimilação conceitual.
                        </p>
                        <p className="text-[11px] font-mono text-emerald-800 pt-1">
                          Arquivo: {slidesFile.name} ({slidesFile.formattedSize})
                        </p>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        {/* BOTÃO PRINCIPAL: ABRIR NO LEITOR INTEGRADO */}
                        <button
                          onClick={() => handleOpenFile(slidesFile)}
                          className="bg-[#006633] hover:bg-[#004d25] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Abrir Slides no Leitor Integrado</span>
                        </button>

                        {/* ABRIR EM NOVA ABA */}
                        <a
                          href={slidesFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir em Nova Aba</span>
                        </a>

                        {/* BAIXAR PDF */}
                        <a
                          href={slidesFile.downloadUrl || slidesFile.url}
                          download
                          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar PDF</span>
                        </a>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1">
                      <p className="font-bold text-gray-800">Critério de Conclusão da Etapa 2:</p>
                      <p>
                        Revisar as lâminas pedagógicas e confirmar a conclusão para liberar o material didático em PDF (Passo 3).
                      </p>
                    </div>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleCompleteStep(2)}
                      className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isStepCompleted(2) ? 'Etapa 2 Concluída (Revalidar)' : 'Concluir Slides e Desbloquear Material Didático'}</span>
                    </button>
                  </div>
                )}

                {/* ============================================================== */}
                {/* ETAPA 3: MATERIAL DIDÁTICO / APOSTILA EM PDF E TEXTO */}
                {/* ============================================================== */}
                {activeStepNumber === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#006633] uppercase">Etapa 03 de 05</span>
                        <h3 className="text-lg font-bold text-gray-900">Material Didático da Disciplina</h3>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Carga estimada: 30 min</span>
                    </div>

                    {/* Acervo de Materiais Didáticos da Disciplina (Aula + Livro Completo + Texto Puro) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Cartão 1: Apostila Didática da Aula (PDF) */}
                      <div className="border border-gray-200 bg-white p-4 rounded-xl space-y-2.5 shadow-2xs hover:border-emerald-300 transition-colors">
                        <div className="flex items-start space-x-2.5">
                          <FileText className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-bold bg-red-100 text-red-800 px-1.5 py-0.2 rounded uppercase">PDF</span>
                            <h4 className="font-bold text-xs text-gray-900 mt-0.5">Apostila da Disciplina {discNum}</h4>
                            <p className="text-[11px] text-gray-500 line-clamp-2">
                              {apostilaAulaPdfFile.name} • Fundamentos teóricos e laboratório da disciplina.
                            </p>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenFile(apostilaAulaPdfFile)}
                            className="flex-1 bg-[#006633] hover:bg-[#004d25] text-white font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizar Online</span>
                          </button>
                          <a
                            href={apostilaAulaPdfFile.downloadUrl || apostilaAulaPdfFile.url}
                            download
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Baixar PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Cartão 2: Livro Técnico Completo da Disciplina (PDF) */}
                      {completeBookPdfFile ? (
                        <div className="border border-emerald-300 bg-emerald-50/30 p-4 rounded-xl space-y-2.5 shadow-2xs hover:bg-emerald-50/60 transition-colors">
                          <div className="flex items-start space-x-2.5">
                            <BookOpen className="w-5 h-5 text-[#006633] shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold bg-emerald-200 text-[#006633] px-1.5 py-0.2 rounded uppercase">Livro Completo</span>
                              <h4 className="font-bold text-xs text-gray-900 mt-0.5">{completeBookPdfFile.label}</h4>
                              <p className="text-[11px] text-gray-600 line-clamp-2">
                                Compêndio completo de {discipline.code} com todas as seções e referências bibliográficas.
                              </p>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenFile(completeBookPdfFile)}
                              className="flex-1 bg-[#006633] hover:bg-[#004d25] text-white font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Ler Livro Completo</span>
                            </button>
                            <a
                              href={completeBookPdfFile.downloadUrl || completeBookPdfFile.url}
                              download
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                              title="Baixar PDF do Livro Completo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ) : null}

                      {/* Cartão 3: Versão Textual Formatada (TXT) */}
                      {apostilaTxtFile ? (
                        <div className="border border-gray-200 bg-white p-4 rounded-xl space-y-2.5 shadow-2xs hover:border-emerald-300 transition-colors">
                          <div className="flex items-start space-x-2.5">
                            <File className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded uppercase">TXT</span>
                              <h4 className="font-bold text-xs text-gray-900 mt-0.5">Versão em Texto Integral</h4>
                              <p className="text-[11px] text-gray-500 line-clamp-2">
                                Texto didático completo em formato plano para leitura rápida e pesquisa de trechos.
                              </p>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenFile(apostilaTxtFile)}
                              className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Search className="w-3.5 h-3.5 text-blue-600" />
                              <span>Ler no Navegador</span>
                            </button>
                            <a
                              href={apostilaTxtFile.downloadUrl || apostilaTxtFile.url}
                              download
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                              title="Baixar TXT"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ) : null}

                      {/* Cartão 4: Material de Estudo Oficial da Disciplina (TXT) */}
                      {officialStudyTxtFile ? (
                        <div className="border border-gray-200 bg-white p-4 rounded-xl space-y-2.5 shadow-2xs hover:border-emerald-300 transition-colors">
                          <div className="flex items-start space-x-2.5">
                            <FileText className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold bg-emerald-100 text-[#006633] px-1.5 py-0.2 rounded uppercase">Texto Oficial</span>
                              <h4 className="font-bold text-xs text-gray-900 mt-0.5">Material de Estudo Oficial</h4>
                              <p className="text-[11px] text-gray-500 line-clamp-2">
                                Síntese curricular oficial, diretrizes temáticas e conceitos-chave da disciplina.
                              </p>
                            </div>
                          </div>

                          <div className="pt-1 flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenFile(officialStudyTxtFile)}
                              className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Visualizar Texto</span>
                            </button>
                            <a
                              href={officialStudyTxtFile.downloadUrl || officialStudyTxtFile.url}
                              download
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                              title="Baixar Material de Estudo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1">
                      <p className="font-bold text-gray-800">Critério de Conclusão da Etapa 3:</p>
                      <p>
                        Efetuar a leitura do material instrucional desta aula e confirmar o avanço para o Teste de Fixação (Passo 4).
                      </p>
                    </div>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleCompleteStep(3)}
                      className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isStepCompleted(3) ? 'Etapa 3 Concluída (Revalidar)' : 'Confirmar Leitura e Liberar Teste de Fixação'}</span>
                    </button>
                  </div>
                )}

                {/* ============================================================== */}
                {/* ETAPA 4: TESTE DE FIXAÇÃO DINÂMICO (3 QUESTÕES) */}
                {/* ============================================================== */}
                {activeStepNumber === 4 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#006633] uppercase">Etapa 04 de 05</span>
                        <h3 className="text-lg font-bold text-gray-900">Teste de Fixação de Aprendizado da Aula</h3>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">Nota mínima: 7,0 / 10,0</span>
                    </div>

                    {quizLoading ? (
                      <div className="py-8 text-center text-xs text-gray-500 animate-pulse">
                        Carregando questões de fixação para {currentLesson.title}...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {quizQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
                            <p className="text-xs font-bold text-gray-900 leading-relaxed">{q.question}</p>
                            <div className="space-y-2">
                              {q.options.map((opt, oIdx) => (
                                <label
                                  key={oIdx}
                                  className={`flex items-start space-x-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                    quizAnswers[qIdx] === oIdx
                                      ? 'border-[#006633] bg-emerald-50 text-[#006633] font-semibold ring-1 ring-[#006633]'
                                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`quiz_q_${qIdx}`}
                                    checked={quizAnswers[qIdx] === oIdx}
                                    onChange={() => setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx })}
                                    className="mt-0.5 text-[#006633] focus:ring-emerald-500"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {quizResult && (
                      <div
                        className={`p-4 rounded-xl border text-xs space-y-1 ${
                          quizResult.passed
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-red-50 border-red-300 text-red-950'
                        }`}
                      >
                        <p className="font-bold text-sm">Nota Obtida: {quizResult.score.toFixed(1)} / 10,0</p>
                        <p>{quizResult.feedback}</p>
                        {quizResult.explanation && (
                          <p className="text-[11px] text-gray-600 pt-1">
                            <strong>Fundamentação Técnica:</strong> {quizResult.explanation}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      disabled={actionLoading || quizLoading}
                      onClick={handleSubmitQuiz}
                      className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Submeter Respostas para Correção no Servidor</span>
                    </button>
                  </div>
                )}

                {/* ============================================================== */}
                {/* ETAPA 5: LIBERAÇÃO DA PRÓXIMA AULA */}
                {/* ============================================================== */}
                {activeStepNumber === 5 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-[#006633] uppercase">Etapa 05 de 05</span>
                        <h3 className="text-lg font-bold text-gray-900">Liberação e Registro Acadêmico</h3>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700">✓ Concluído</span>
                    </div>

                    <div className="border border-emerald-200 bg-emerald-50/60 rounded-2xl p-8 text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#006633] flex items-center justify-center mx-auto shadow-xs">
                        <Award className="w-8 h-8 text-[#006633]" />
                      </div>
                      <h4 className="text-lg font-extrabold text-emerald-950">Aula Concluída com Sucesso!</h4>
                      <p className="text-xs text-emerald-800 max-w-md mx-auto">
                        Todas as 4 etapas prévias foram auditadas e salvas no banco de dados. O percurso formativo foi atualizado com segurança.
                      </p>

                      <div className="pt-2 text-[11px] text-emerald-700 font-mono">
                        Registro de conclusão persistido de forma idempotente.
                      </div>
                    </div>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleCompleteStep(5)}
                      className="w-full bg-[#006633] hover:bg-[#004d25] text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Confirmar Registro e Prosseguir na Matriz Curricular</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. MODAL LEITOR INTERATIVO DE DOCUMENTOS (PDF, TXT, MD) */}
      {/* ============================================================== */}
      {isReaderOpen && readerFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            {/* Cabeçalho do Leitor */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-white border border-gray-200 text-[#006633]">
                  {readerFile.type === 'pdf' ? (
                    <FileText className="w-5 h-5 text-red-600" />
                  ) : readerFile.type === 'markdown' ? (
                    <FileCode className="w-5 h-5 text-purple-600" />
                  ) : (
                    <File className="w-5 h-5 text-blue-600" />
                  )}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                      {readerFile.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{readerFile.formattedSize}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate max-w-md">
                    {readerFile.label}
                  </h3>
                </div>
              </div>

              {/* Botões de Ação do Leitor */}
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                {readerFile.type !== 'pdf' && (
                  <button
                    onClick={handleCopyText}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-white text-gray-700 transition-colors text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    title="Copiar texto completo"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copiar</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={readerFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl border border-gray-200 hover:bg-white text-gray-700 transition-colors text-xs font-semibold flex items-center space-x-1"
                  title="Abrir em Nova Aba"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nova Aba</span>
                </a>

                <a
                  href={readerFile.downloadUrl || readerFile.url}
                  download
                  className="bg-[#006633] hover:bg-[#004d25] text-white p-2 sm:px-3 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                  title="Baixar Arquivo"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>

                <button
                  onClick={() => setIsReaderOpen(false)}
                  className="p-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer"
                  title="Fechar Leitor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barra de Pesquisa de Texto (para arquivos TXT e MD) */}
            {readerFile.type !== 'pdf' && (
              <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex items-center space-x-3 text-xs">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Pesquisar termo neste arquivo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 outline-hidden text-gray-800 placeholder-gray-400 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600 text-[11px]"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}

            {/* Corpo do Documento */}
            <div className="flex-1 overflow-hidden bg-gray-100 p-2 sm:p-4">
              {readerFile.type === 'pdf' ? (
                // Visualizador de PDF Embutido
                <div className="w-full h-full rounded-2xl overflow-hidden bg-white border border-gray-300 shadow-inner flex flex-col">
                  <iframe
                    src={`${readerFile.url}#view=FitH`}
                    title={readerFile.label}
                    className="w-full flex-1 border-0"
                  />
                </div>
              ) : (
                // Visualizador de Texto / Markdown
                <div className="w-full h-full bg-white rounded-2xl border border-gray-200 shadow-inner p-5 sm:p-8 overflow-y-auto font-mono text-xs text-gray-800 leading-relaxed whitespace-pre-wrap select-text">
                  {contentLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-2">
                        <div className="w-8 h-8 border-3 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-500 font-sans text-xs">Carregando conteúdo do arquivo...</p>
                      </div>
                    </div>
                  ) : readerContent ? (
                    searchQuery ? (
                      // Destaque de pesquisa
                      readerContent.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                          <mark key={i} className="bg-yellow-200 text-gray-950 font-bold px-0.5 rounded">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      )
                    ) : (
                      readerContent
                    )
                  ) : (
                    'Arquivo sem conteúdo disponível.'
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 px-5 flex items-center justify-between text-[11px] text-gray-500">
              <span className="font-mono text-emerald-800 truncate">
                Caminho: {readerFile.url}
              </span>
              <span className="hidden sm:inline">
                CAMPOS IA — Plataforma Educacional Oficial (200h)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
