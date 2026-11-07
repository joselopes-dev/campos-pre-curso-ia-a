import React from 'react';
import { User, Discipline } from '../types/index.ts';
import { 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  Lock, 
  ArrowRight, 
  Bot, 
  ShieldCheck, 
  Database, 
  Sparkles,
  Layers,
  Award
} from 'lucide-react';

interface DashboardProps {
  user: User;
  progressData: any;
  disciplines: Discipline[];
  onSelectDiscipline: (disciplineId: string) => void;
  openTutor: () => void;
  openAuditModal: () => void;
  setActiveTab: (tab: 'dashboard' | 'catalogo' | 'sala' | 'certificados') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  progressData,
  disciplines,
  onSelectDiscipline,
  openTutor,
  openAuditModal,
  setActiveTab,
}) => {
  const overallPercent = progressData?.overallPercent || 0;
  const hoursCompleted = progressData?.hoursCompleted || 0;
  const completedDisciplines = progressData?.completedDisciplinesCount || 0;
  const inProgressDisciplines = progressData?.inProgressDisciplinesCount || 1;

  // Encontra a disciplina atual para retomada rápida
  const resumeDisciplineId = progressData?.nextToResume?.disciplineId || 'disc-01';
  const resumeDiscipline = disciplines.find((d) => d.id === resumeDisciplineId) || disciplines[0];

  return (
    <div className="space-y-8 pb-12">
      {/* Banner de Boas-Vindas Institucional */}
      <div className="bg-gradient-to-r from-[#004d25] via-[#006633] to-[#0a7e43] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 backdrop-blur-xs border border-emerald-400/30 px-3.5 py-1 rounded-full text-xs font-semibold mb-4 text-emerald-100">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span className="font-mono font-bold">CAMPOS IA</span>
            <span>•</span>
            <span>Pré-Curso de Inteligência Artificial (200h)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, {user.name.split(' ')[0]}!
          </h1>
          <p className="mt-2 text-emerald-100 text-sm sm:text-base leading-relaxed">
            Bem-vindo(a) à plataforma <strong>CAMPOS IA</strong>. Acompanhe seu progresso sequencial, acesse os materiais didáticos e tire dúvidas com o Tutor IA.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 items-center">
            <button
              onClick={() => onSelectDiscipline(resumeDiscipline.id)}
              className="bg-white text-[#006633] hover:bg-emerald-50 font-bold px-4 py-2.5 rounded-lg text-sm shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-[#006633]" />
              <span>Continuar: {resumeDiscipline.code}</span>
            </button>
            <button
              onClick={openTutor}
              className="bg-emerald-800/80 hover:bg-emerald-800 text-white font-medium px-4 py-2.5 rounded-lg text-sm border border-emerald-400/30 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>Perguntar ao Tutor IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cartões de Indicadores Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Progresso Geral */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Carga Concluída</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-gray-900">{hoursCompleted}h</span>
              <span className="text-xs text-gray-400 font-medium">/ 200h</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
              <div
                className="bg-[#006633] h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(overallPercent, 3)}%` }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-gray-400 mt-2 font-medium">{overallPercent}% da formação cumprida</span>
        </div>

        {/* Disciplinas em Andamento */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Em Andamento</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-2xl font-black text-gray-900">{inProgressDisciplines}</span>
            <span className="text-xs text-gray-500 ml-1.5 font-medium">componente(s)</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Desbloqueio sequencial por aula</p>
        </div>

        {/* Disciplinas Concluídas */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-2xl font-black text-gray-900">{completedDisciplines}</span>
            <span className="text-xs text-gray-400 ml-1.5 font-medium">/ 20 disciplinas</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-2">Média mínima exigida: 7.0</p>
        </div>

        {/* Certificação */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Status do Certificado</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-800">Certificação Oficial</span>
            <p className="text-[11px] text-gray-500 mt-1">20 Disciplinas (200h)</p>
          </div>
          <button
            onClick={() => setActiveTab('certificados')}
            className="text-[11px] text-[#006633] font-bold hover:underline mt-2 text-left"
          >
            Verificar autenticidade &rarr;
          </button>
        </div>
      </div>

      {/* Cartão de Retomada Rápida (Continuar de onde parou) */}
      <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-100 text-[#006633] text-xs font-bold px-2 py-0.5 rounded uppercase">
                {resumeDiscipline.code}
              </span>
              <span className="text-xs font-medium text-gray-500">
                Módulo {resumeDiscipline.moduleId} • {resumeDiscipline.hours} horas
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{resumeDiscipline.title}</h2>
            <p className="text-sm text-gray-600 line-clamp-1">{resumeDiscipline.summary}</p>
          </div>

          <button
            onClick={() => onSelectDiscipline(resumeDiscipline.id)}
            className="bg-[#006633] hover:bg-[#004d25] text-white font-bold px-5 py-2.5 rounded-lg text-sm shadow-xs transition-colors flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <span>Acessar Sala de Aula</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Estrutura dos 3 Módulos Acadêmicos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Módulos da Formação Técnica</h2>
            <p className="text-sm text-gray-500">Distribuição acadêmica dos 20 componentes curriculares</p>
          </div>
          <button
            onClick={() => setActiveTab('catalogo')}
            className="text-sm text-[#006633] font-bold hover:underline flex items-center space-x-1"
          >
            <span>Ver todos os 20 componentes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Módulo I */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#006633] uppercase bg-emerald-50 px-2 py-0.5 rounded">
                  Módulo I
                </span>
                <span className="text-xs font-bold text-gray-600">60 Horas</span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mt-2">
                Fundamentos de Computação e Matemática para IA
              </h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                Sistemas operacionais, algoritmos, Python essencial, banco de dados, matemática e fundamentos de IA.
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                <p>• 6 disciplinas obrigatórias (10h cada)</p>
                <p>• Práticas com terminal Linux e Python</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('catalogo')}
              className="mt-4 w-full bg-gray-50 hover:bg-emerald-50 text-[#006633] font-bold py-2 rounded-lg text-xs transition-colors text-center"
            >
              Consultar Componentes do Módulo I
            </button>
          </div>

          {/* Módulo II */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#006633] uppercase bg-emerald-50 px-2 py-0.5 rounded">
                  Módulo II
                </span>
                <span className="text-xs font-bold text-gray-600">60 Horas</span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mt-2">
                Aprendizado de Máquina, Deep Learning e PLN
              </h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                Ciência de dados com Pandas, Scikit-Learn, redes neurais profundas, chatbots e Prática Profissional I.
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                <p>• 6 disciplinas obrigatórias (10h cada)</p>
                <p>• Prática Profissional Supervisionada I (10h)</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('catalogo')}
              className="mt-4 w-full bg-gray-50 hover:bg-emerald-50 text-[#006633] font-bold py-2 rounded-lg text-xs transition-colors text-center"
            >
              Consultar Componentes do Módulo II
            </button>
          </div>

          {/* Módulo III */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#006633] uppercase bg-emerald-50 px-2 py-0.5 rounded">
                  Módulo III
                </span>
                <span className="text-xs font-bold text-gray-600">80 Horas</span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mt-2">
                MLOps, LLMs, Governança e Aplicações Avançadas
              </h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                Segurança LGPD, Engenharia de Software, Deploy, Assistentes IA, Visão Computacional e TCC/PPS II.
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                <p>• 8 disciplinas obrigatórias (10h cada)</p>
                <p>• Prática Profissional Supervisionada II (10h)</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('catalogo')}
              className="mt-4 w-full bg-gray-50 hover:bg-emerald-50 text-[#006633] font-bold py-2 rounded-lg text-xs transition-colors text-center"
            >
              Consultar Componentes do Módulo III
            </button>
          </div>
        </div>
      </div>

      {/* Ambiente Institucional de Produção */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-900">Ambiente de Produção CAMPOS IA — Carga Horária Oficial de 200 Horas</p>
            <p className="text-emerald-800">
              Matriz curricular oficial com 20 disciplinas de 10 horas cada, banco relacional com integridade referencial, controle de autenticação e emissão oficial de certificados.
            </p>
          </div>
        </div>
        <button
          onClick={openAuditModal}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-xs shrink-0 cursor-pointer"
        >
          Verificar Integridade do Sistema
        </button>
      </div>
    </div>
  );
};
