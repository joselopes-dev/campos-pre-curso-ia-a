import React, { useState, useEffect } from 'react';
import { User, Discipline, UserRole } from './types/index.ts';
import { Header } from './components/Header.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { CurriculumCatalog } from './components/CurriculumCatalog.tsx';
import { Classroom } from './components/Classroom.tsx';
import { TutorIAChat } from './components/TutorIAChat.tsx';
import { CertificatesModal } from './components/CertificatesModal.tsx';
import { AcademicManagement } from './components/AcademicManagement.tsx';
import { SystemAuditModal } from './components/SystemAuditModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalogo' | 'sala' | 'certificados' | 'gestao'>('dashboard');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('disc-01');
  const [isTutorOpen, setIsTutorOpen] = useState<boolean>(false);
  const [tutorContext, setTutorContext] = useState<{ disciplineId?: string; lessonId?: string }>({});
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [progressData, setProgressData] = useState<any>(null);
  const [isPostgresConnected, setIsPostgresConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAllData = async () => {
    try {
      const meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          setUser(meData.user);
        } else {
          setUser(null);
        }
      }
      const discRes = await fetch('/api/v1/curriculum/disciplines', { credentials: 'include' });
      if (discRes.ok) {
        const discData = await discRes.json();
        setDisciplines(discData.disciplines || []);
      }
      const progRes = await fetch('/api/v1/progress', { credentials: 'include' });
      if (progRes.ok) {
        const progData = await progRes.json();
        setProgressData(progData);
      }
      const healthRes = await fetch('/api/health', { credentials: 'include' });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setIsPostgresConnected(healthData.database?.postgres?.connected || false);
      }
    } catch (err) {
      console.error('Erro ao sincronizar dados com o backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const refreshProgress = async () => {
    try {
      const progRes = await fetch('/api/v1/progress', { credentials: 'include' });
      if (progRes.ok) {
        const progData = await progRes.json();
        setProgressData(progData);
      }
    } catch (err) {
      console.error('Erro ao atualizar progresso:', err);
    }
  };

  const handleSwitchUserRole = async (role: UserRole) => {
    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        refreshProgress();
      }
    } catch (err) {
      console.error('Erro ao trocar perfil:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setProgressData(null);
      setIsAuthOpen(true);
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  const handleSelectDiscipline = (disciplineId: string) => {
    setSelectedDisciplineId(disciplineId);
    setActiveTab('sala');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTutorWithContext = (disciplineId: string, lessonId: string) => {
    setTutorContext({ disciplineId, lessonId });
    setIsTutorOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight font-mono">CAMPOS IA</h2>
            <p className="text-xs text-gray-500 mt-1">Carregando matriz curricular de 20 disciplinas e verificando backend...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col font-sans text-gray-900">
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openTutor={() => { setTutorContext({}); setIsTutorOpen(true); }}
        openAuditModal={() => setIsAuditOpen(true)}
        openAuthModal={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onSwitchUserRole={handleSwitchUserRole}
        isPostgresConnected={isPostgresConnected}
      />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-12 flex-1 w-full">
        {activeTab === 'dashboard' && !user && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-[#003d1c] via-[#005a2b] to-teal-900 text-white p-8 sm:p-12 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-600/30">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-white/5 rounded-full pointer-events-none blur-3xl"></div>
              <div className="relative z-10 max-w-2xl space-y-4">
                <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xs border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Pré-Curso de Inteligência Artificial • 200 Horas</span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white font-mono drop-shadow-sm">CAMPOS IA</h1>
                <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed font-normal">
                  Ambiente Virtual de Aprendizagem oficial com 20 disciplinas sequenciais, acervo técnico local completo, sala de aula com progressão em 5 etapas, Tutor IA com RAG e certificação digital com validação pública.
                </p>
                <div className="pt-4 flex flex-wrap gap-3">
                  <button onClick={() => setIsAuthOpen(true)} className="bg-white hover:bg-emerald-50 text-[#004d25] font-black px-6 py-3.5 rounded-xl text-sm transition-all shadow-lg flex items-center space-x-2 cursor-pointer hover:scale-105">
                    <span>Acessar Plataforma</span><span className="text-emerald-700 font-bold">&rarr;</span>
                  </button>
                  <button onClick={() => setActiveTab('catalogo')} className="bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors border border-white/20 flex items-center space-x-2 cursor-pointer">
                    <span>Consultar Matriz Curricular (20 Disciplinas)</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006633] flex items-center justify-center font-bold text-sm">M1</div>
                <h3 className="font-bold text-gray-900 text-sm">Módulo I — Fundamentos</h3>
                <p className="text-xs text-gray-500 leading-relaxed">6 disciplinas: Linux, Lógica, Python Aplicado, Banco de Dados, Matemática/Estatística e Fundamentos de IA.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-sm">M2</div>
                <h3 className="font-bold text-gray-900 text-sm">Módulo II — Núcleo Tecnológico</h3>
                <p className="text-xs text-gray-500 leading-relaxed">6 disciplinas: Ciência de Dados, Machine Learning, Deep Learning, PLN & Chatbots, Metodologia e Prática Supervisionada I.</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-sm">M3</div>
                <h3 className="font-bold text-gray-900 text-sm">Módulo III — Aplicações Avançadas</h3>
                <p className="text-xs text-gray-500 leading-relaxed">8 disciplinas: Segurança & LGPD, Engenharia de Software para IA, MLOps, Assistentes, LLMs, Visão Computacional e Projeto Final.</p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dashboard' && user && (
          <Dashboard user={user} progressData={progressData} disciplines={disciplines} onSelectDiscipline={handleSelectDiscipline} openTutor={() => { setTutorContext({}); setIsTutorOpen(true); }} openAuditModal={() => setIsAuditOpen(true)} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'catalogo' && (
          <CurriculumCatalog disciplines={disciplines} progressList={progressData?.disciplines || []} onSelectDiscipline={handleSelectDiscipline} />
        )}
        {activeTab === 'sala' && (
          user ? (
            <Classroom disciplineId={selectedDisciplineId} user={user} onBack={() => setActiveTab('catalogo')} openTutorWithContext={handleOpenTutorWithContext} onProgressUpdated={refreshProgress} onSelectDiscipline={setSelectedDisciplineId} allDisciplines={disciplines} />
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4 max-w-lg mx-auto my-12">
              <div className="w-12 h-12 bg-emerald-50 text-[#006633] rounded-full flex items-center justify-center mx-auto font-black text-xl">🔒</div>
              <h2 className="text-lg font-bold text-gray-900">Autenticação Necessária</h2>
              <p className="text-xs text-gray-500">Para ingressar na Sala de Aula e salvar seu progresso sequencial na plataforma <strong>CAMPOS IA</strong>, realize seu acesso seguro com o Google.</p>
              <button onClick={() => setIsAuthOpen(true)} className="bg-[#006633] hover:bg-[#004d25] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Entrar na Plataforma</button>
            </div>
          )
        )}
        {activeTab === 'certificados' && (
          user ? (
            <CertificatesModal user={user} progressData={progressData} />
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4 max-w-lg mx-auto my-12">
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto font-black text-xl">🎓</div>
              <h2 className="text-lg font-bold text-gray-900">Autenticação de Certificados</h2>
              <p className="text-xs text-gray-500">Acesse com sua conta para verificar sua elegibilidade ou emitir seu diploma oficial com QR Code na plataforma <strong>CAMPOS IA</strong>.</p>
              <button onClick={() => setIsAuthOpen(true)} className="bg-[#006633] hover:bg-[#004d25] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Entrar na Plataforma</button>
            </div>
          )
        )}
        {activeTab === 'gestao' && user && (user.role === 'professor' || user.role === 'administrador') && (
          <AcademicManagement user={user} />
        )}
      </main>
      <footer className="bg-white border-t border-gray-200 mt-auto py-6 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-black text-gray-950 tracking-wider text-sm font-mono">CAMPOS IA</span><span>•</span><span className="text-gray-700 font-medium">Pré-Curso de Inteligência Artificial</span><span>•</span><span className="text-emerald-700 font-bold">200 Horas</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <button onClick={() => setIsAuditOpen(true)} className="text-[#006633] font-bold hover:underline cursor-pointer">Status do Sistema & Infraestrutura</button><span>•</span><span>Língua Portuguesa (Brasil)</span>
          </div>
        </div>
      </footer>
      <TutorIAChat isOpen={isTutorOpen} onClose={() => setIsTutorOpen(false)} disciplines={disciplines} initialDisciplineId={tutorContext.disciplineId} initialLessonId={tutorContext.lessonId} />
      <SystemAuditModal isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(loggedUser) => { setUser(loggedUser); refreshProgress(); }} />
    </div>
  );
}
