import React, { useState } from 'react';
import { Discipline, DisciplineProgress } from '../types/index.ts';
import { 
  BookOpen, 
  Clock, 
  Lock, 
  CheckCircle, 
  PlayCircle, 
  Search, 
  FolderCheck, 
  ChevronRight, 
  FileText, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface CurriculumCatalogProps {
  disciplines: Discipline[];
  progressList: any[];
  onSelectDiscipline: (disciplineId: string) => void;
}

export const CurriculumCatalog: React.FC<CurriculumCatalogProps> = ({
  disciplines,
  progressList,
  onSelectDiscipline,
}) => {
  const [selectedModule, setSelectedModule] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompetencies, setExpandedCompetencies] = useState<Record<string, boolean>>({});

  const toggleCompetencies = (id: string) => {
    setExpandedCompetencies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtra por módulo e termo de busca
  const filteredDisciplines = disciplines.filter((d) => {
    const matchesModule = selectedModule === 'all' || d.moduleId === selectedModule;
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesModule && matchesSearch;
  });

  const getDisciplineStatus = (discipline: Discipline, index: number) => {
    const p = progressList?.find((item) => item.disciplineId === discipline.id);
    if (p) return p.status;
    return index === 0 ? 'em_andamento' : 'bloqueado';
  };

  const getDisciplinePercent = (discipline: Discipline) => {
    const p = progressList?.find((item) => item.disciplineId === discipline.id);
    return p ? p.percent : 0;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Matriz */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-100 text-[#006633] text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                Matriz Curricular Oficial
              </span>
              <span className="text-xs text-gray-500 font-medium">200 Horas Totais</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">20 Componentes Curriculares</h1>
            <p className="text-sm text-gray-600 mt-1">
              Estruturados em 3 módulos de formação técnica de nível médio (10h por componente), com desbloqueio sequencial das aulas e avaliações no backend.
            </p>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Filtro por Módulos */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setSelectedModule('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedModule === 'all'
                ? 'bg-[#006633] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos os Componentes (20)
          </button>
          <button
            onClick={() => setSelectedModule(1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedModule === 1
                ? 'bg-[#006633] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Módulo I: Fundamentos (6 disciplinas • 60h)
          </button>
          <button
            onClick={() => setSelectedModule(2)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedModule === 2
                ? 'bg-[#006633] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Módulo II: Machine Learning e PLN (6 disciplinas • 60h)
          </button>
          <button
            onClick={() => setSelectedModule(3)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              selectedModule === 3
                ? 'bg-[#006633] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Módulo III: MLOps, LLMs e TCC (8 disciplinas • 80h)
          </button>
        </div>
      </div>

      {/* Lista dos 20 Componentes */}
      <div className="grid grid-cols-1 gap-4">
        {filteredDisciplines.map((d, index) => {
          const status = getDisciplineStatus(d, index);
          const percent = getDisciplinePercent(d);
          const isLocked = status === 'bloqueado';
          const isCompleted = status === 'concluido';
          const isExpanded = expandedCompetencies[d.id] || false;

          return (
            <div
              key={d.id}
              className={`bg-white border rounded-xl p-5 transition-all shadow-xs ${
                isLocked
                  ? 'border-gray-200 bg-gray-50/50 opacity-90'
                  : 'border-emerald-200 hover:border-emerald-400'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Lado Esquerdo: Identificação e Ementa */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-gray-400">
                      #{String(d.order).padStart(2, '0')}
                    </span>
                    <span className="bg-emerald-50 text-[#006633] border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded">
                      {d.code}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      Módulo {d.moduleId}
                    </span>
                    <span className="flex items-center space-x-1 text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3 text-emerald-700" />
                      <span>{d.hours} horas</span>
                    </span>

                    {/* Badge de Status */}
                    {isCompleted && (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" />
                        <span>Concluído</span>
                      </span>
                    )}
                    {status === 'em_andamento' && (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                        <PlayCircle className="w-3 h-3" />
                        <span>Em Andamento ({percent}%)</span>
                      </span>
                    )}
                    {isLocked && (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                        <Lock className="w-3 h-3 text-gray-500" />
                        <span>Bloqueado</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900">{d.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{d.summary}</p>

                  {/* Informação sobre os materiais locais */}
                  <div className="flex items-center space-x-3 text-[11px] text-gray-500 pt-1">
                    <span className="flex items-center space-x-1 text-gray-500">
                      <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-mono text-[10px] text-gray-600">{d.localMaterialPath}</span>
                    </span>
                    <span>• {d.totalLessons} {d.totalLessons === 1 ? 'aula estruturada' : 'aulas estruturadas'}</span>
                  </div>

                  {/* Competências Curriculares (Acordeão) */}
                  <div className="pt-2">
                    <button
                      onClick={() => toggleCompetencies(d.id)}
                      className="text-xs text-[#006633] font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Ocultar Competências' : 'Ver Competências e Objetivos'}</span>
                      <ChevronRight className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="mt-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-3 text-xs text-emerald-950 space-y-1">
                        <p className="font-bold text-emerald-900">Competências Técnicas Esperadas:</p>
                        <ul className="list-disc list-inside space-y-1 text-emerald-900/90 pl-1">
                          {d.competencies.map((comp, idx) => (
                            <li key={idx}>{comp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Direito: Ação de Acesso */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-center gap-2 min-w-[180px]">
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1 hidden sm:block">
                    <div
                      className="bg-[#006633] h-1.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <button
                    onClick={() => onSelectDiscipline(d.id)}
                    className={`w-full font-bold px-4 py-2.5 rounded-lg text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                      isLocked
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-[#006633] hover:bg-[#004d25] text-white shadow-xs'
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Acessar (Pré-requisito)</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Entrar na Sala de Aula</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
