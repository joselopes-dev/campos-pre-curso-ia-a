import React, { useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { 
  Users, 
  Award, 
  Search, 
  FileBadge, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  ExternalLink, 
  X, 
  BookOpen, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface AcademicManagementProps {
  user: User;
}

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  registrationNumber?: string;
  role: string;
  createdAt: string;
  completedDisciplinesCount: number;
  overallPercent: number;
  hasCertificate: boolean;
  certificateCode?: string;
}

interface CertificateRecord {
  id: string;
  validationCode: string;
  userId: string;
  userName: string;
  courseTitle: string;
  totalHours: number;
  completionDate: string;
  status: string;
  issuedAt: string;
}

interface AcademicDetail {
  student: {
    id: string;
    name: string;
    email: string;
    registrationNumber?: string;
    role: string;
    createdAt: string;
  };
  disciplines: Array<{
    disciplineId: string;
    code: string;
    title: string;
    moduleId: number;
    hours: number;
    approved: boolean;
    finalGrade: number | null;
    completedSteps: number;
    totalSteps: number;
    percent: number;
  }>;
  approvedDisciplinesCount: number;
  totalDisciplinesCount: number;
  certificate: CertificateRecord | null;
}

export const AcademicManagement: React.FC<AcademicManagementProps> = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'certificates'>('students');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Detalhe / Prontuário do Aluno
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetail, setStudentDetail] = useState<AcademicDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Carrega dados iniciais da área docente/administrativa
  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [studentsRes, certsRes] = await Promise.all([
        fetch('/api/v1/admin/students'),
        fetch('/api/v1/admin/certificates'),
      ]);

      if (!studentsRes.ok) {
        const err = await studentsRes.json();
        throw new Error(err.error || 'Falha ao consultar listagem de estudantes.');
      }
      if (!certsRes.ok) {
        const err = await certsRes.json();
        throw new Error(err.error || 'Falha ao consultar certificados.');
      }

      const studentsData = await studentsRes.json();
      const certsData = await certsRes.json();

      setStudents(studentsData.students || []);
      setCertificates(certsData.certificates || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Carrega prontuário do estudante selecionado
  const handleOpenStudentDetail = async (studentId: string) => {
    try {
      setSelectedStudentId(studentId);
      setDetailLoading(true);
      const res = await fetch(`/api/v1/admin/students/${studentId}/academic-record`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao carregar prontuário acadêmico.');
      }
      const data = await res.json();
      setStudentDetail(data);
    } catch (err: any) {
      alert(err.message);
      setSelectedStudentId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filtro de busca de estudantes
  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(term))
    );
  });

  const totalCompletedStudents = students.filter((s) => s.completedDisciplinesCount === 20).length;
  const averageProgress = students.length > 0
    ? Math.round(students.reduce((acc, s) => acc + s.overallPercent, 0) / students.length)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Superior da Área Administrativa */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-[#006633] text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-emerald-800 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {user.role === 'administrador' ? 'Painel do Administrador' : 'Painel Docente'}
                </span>
                <span className="text-xs text-gray-500 font-medium">Controle de Turmas e Registros</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 mt-0.5">Gestão Acadêmica e Certificados</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3 max-w-3xl">
          Visualização em tempo real do aproveitamento dos estudantes nos 20 componentes curriculares, notas das avaliações e diplomas emitidos com validação criptográfica.
        </p>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
              <span>Alunos Cadastrados</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-950">{students.length}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">Matrículas ativas</p>
          </div>

          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between text-xs text-blue-800 font-semibold mb-1">
              <span>Concluintes (20/20)</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-blue-950">{totalCompletedStudents}</p>
            <p className="text-[11px] text-blue-700 mt-0.5">Aprovados no currículo</p>
          </div>

          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between text-xs text-amber-800 font-semibold mb-1">
              <span>Certificados Emitidos</span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-950">{certificates.length}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">Diplomas registrados</p>
          </div>

          <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between text-xs text-purple-800 font-semibold mb-1">
              <span>Média de Progresso</span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-black text-purple-950">{averageProgress}%</p>
            <p className="text-[11px] text-purple-700 mt-0.5">Média da turma</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-Navegação */}
      <div className="flex space-x-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveSubTab('students')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'students'
              ? 'bg-[#006633] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Estudantes da Turma ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('certificates')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'certificates'
              ? 'bg-[#006633] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Certificados Oficiais ({certificates.length})</span>
        </button>
      </div>

      {/* 1. ABA ESTUDANTES */}
      {activeSubTab === 'students' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Barra de Filtro e Busca */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
            <div className="text-xs text-gray-500">
              Mostrando <strong className="text-gray-800">{filteredStudents.length}</strong> de {students.length} estudantes
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-500">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Carregando registros acadêmicos...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500 space-y-1">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">Nenhum estudante localizado.</p>
              <p className="text-gray-400">Verifique os filtros de busca informados acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Estudante</th>
                    <th className="py-3 px-4">Matrícula</th>
                    <th className="py-3 px-4">Progresso Geral</th>
                    <th className="py-3 px-4">Aprovações (Nota &ge; 7,0)</th>
                    <th className="py-3 px-4">Certificação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-500">{s.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-gray-700">
                        {s.registrationNumber || 'IF-PENDENTE'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#006633] h-full rounded-full transition-all duration-300"
                              style={{ width: `${s.overallPercent}%` }}
                            />
                          </div>
                          <span className="font-bold text-gray-800">{s.overallPercent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          s.completedDisciplinesCount === 20
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.completedDisciplinesCount > 0
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {s.completedDisciplinesCount} / 20 componentes
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {s.hasCertificate ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            <Award className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{s.certificateCode}</span>
                          </span>
                        ) : s.completedDisciplinesCount === 20 ? (
                          <span className="text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                            Elegível para Emissão
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">
                            Pendente ({20 - s.completedDisciplinesCount} rest.)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenStudentDetail(s.id)}
                          className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <span>Prontuário</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. ABA CERTIFICADOS EMITIDOS */}
      {activeSubTab === 'certificates' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
              <FileBadge className="w-4 h-4 text-emerald-700" />
              <span>Livro de Registro de Diplomas e Certificados Emitidos</span>
            </h2>
            <span className="text-xs text-gray-500">
              Total de registros: <strong className="text-gray-800">{certificates.length}</strong>
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-500">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Consultando livro de certificados...
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500 space-y-2">
              <Award className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-700 text-sm">Nenhum certificado emitido até o momento.</p>
              <p className="text-gray-400 max-w-md mx-auto">
                Os certificados são emitidos quando os alunos completam integralmente a aprovação nos 20 componentes curriculares com nota mínima 7,0.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Chave de Autenticidade</th>
                    <th className="py-3 px-4">Estudante Diplomado</th>
                    <th className="py-3 px-4">Curso e Carga Horária</th>
                    <th className="py-3 px-4">Data de Emissão</th>
                    <th className="py-3 px-4">Situação Registral</th>
                    <th className="py-3 px-4 text-right">Ações Oficiais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {certificates.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        {c.validationCode}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900">{c.userName}</p>
                        <p className="text-[11px] text-gray-500">ID: {c.userId.slice(0, 10)}...</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-800 font-medium">{c.courseTitle}</p>
                        <p className="text-[11px] text-emerald-700 font-semibold">{c.totalHours} Horas • 3 Módulos</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {c.completionDate}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-[11px] border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="capitalize">{c.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <a
                          href={`/api/v1/certificates/download/${c.validationCode}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 bg-[#006633] hover:bg-[#004d25] text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar PDF</span>
                        </a>
                        <a
                          href={`/api/v1/certificates/verify/${c.validationCode}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Validar</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. MODAL DE PRONTUÁRIO ACADÊMICO DETALHADO DO ESTUDANTE */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Cabeçalho do Prontuário */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-[#004d25] text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Prontuário e Histórico Acadêmico</h3>
                  <p className="text-xs text-emerald-200">Pré-Curso de Inteligência Artificial</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedStudentId(null);
                  setStudentDetail(null);
                }}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Prontuário */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {detailLoading || !studentDetail ? (
                <div className="py-16 text-center text-xs text-gray-500">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Carregando prontuário acadêmico...
                </div>
              ) : (
                <>
                  {/* Dados Pessoais e Matrícula */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-bold text-gray-900">{studentDetail.student.name}</p>
                      <p className="text-xs text-gray-500">{studentDetail.student.email}</p>
                      <p className="text-xs text-gray-600 font-mono mt-1">
                        Matrícula: <strong>{studentDetail.student.registrationNumber || 'IF-PENDENTE'}</strong>
                      </p>
                    </div>

                    <div className="text-right sm:text-right">
                      <span className="text-xs text-gray-500">Status Curricular</span>
                      <p className="text-lg font-black text-emerald-800">
                        {studentDetail.approvedDisciplinesCount} / {studentDetail.totalDisciplinesCount} Componentes
                      </p>
                      <span className={`inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded ${
                        studentDetail.approvedDisciplinesCount === 20
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {studentDetail.approvedDisciplinesCount === 20 ? 'Currículo Integral Concluído' : 'Em Formação Técnica'}
                      </span>
                    </div>
                  </div>

                  {/* Certificado Emitido (se houver) */}
                  {studentDetail.certificate && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Award className="w-6 h-6 text-emerald-700" />
                        <div>
                          <p className="text-xs font-bold text-emerald-950">Certificado Oficial Emitido</p>
                          <p className="text-xs font-mono text-emerald-800">Chave: {studentDetail.certificate.validationCode}</p>
                          <p className="text-[11px] text-emerald-700">Emitido em: {studentDetail.certificate.completionDate}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/v1/certificates/download/${studentDetail.certificate.validationCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#006633] hover:bg-[#004d25] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar PDF</span>
                      </a>
                    </div>
                  )}

                  {/* Detalhamento dos 20 Componentes Curriculares */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Desempenho por Componente Curricular (20 Disciplinas)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {studentDetail.disciplines.map((d, index) => (
                        <div
                          key={d.disciplineId}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                            d.approved
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="space-y-0.5 max-w-[240px]">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-[10px] text-gray-500 font-semibold">{d.code}</span>
                              <span className="text-[10px] bg-gray-200 px-1 rounded text-gray-700">Módulo {d.moduleId}</span>
                            </div>
                            <p className="font-bold text-gray-900 truncate">{d.title}</p>
                            <p className="text-[11px] text-gray-500">Carga: {d.hours}h • {d.completedSteps}/{d.totalSteps} etapas</p>
                          </div>

                          <div className="text-right">
                            {d.approved ? (
                              <div>
                                <span className="inline-flex items-center space-x-1 text-emerald-800 font-black text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Nota: {d.finalGrade?.toFixed(1) || '10.0'}</span>
                                </span>
                                <p className="text-[10px] text-emerald-700 font-semibold">Aprovado</p>
                              </div>
                            ) : (
                              <div>
                                <span className="text-gray-500 font-semibold text-[11px]">
                                  {d.completedSteps > 0 ? `${d.percent}%` : 'Não iniciado'}
                                </span>
                                <p className="text-[10px] text-amber-700 font-medium">Pendente</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedStudentId(null);
                  setStudentDetail(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Fechar Prontuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
