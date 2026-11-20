import React, { useState, useEffect, useRef } from 'react';
import { User, VocationalDiagnosis, VocationalMessage, VocationalSession } from '../types/index.ts';
import {
  Compass,
  X,
  Send,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  GitCompare,
  Search,
  Lock,
  Info,
} from 'lucide-react';

interface VocationalCounselorChatProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  openAuthModal: () => void;
}

const STAGE_LABELS: Record<number, string> = {
  1: 'Etapa 1/6 • Interesses pessoais',
  2: 'Etapa 2/6 • Habilidades e aptidões',
  3: 'Etapa 3/6 • Preferências de trabalho',
  4: 'Etapa 4/6 • Ambiente e perfil',
  5: 'Etapa 5/6 • Objetivos profissionais',
  6: 'Etapa 6/6 • Formação e realidade',
  7: 'Diagnóstico Vocacional Concluído',
};

const DiagnosisCard: React.FC<{ diagnosis: VocationalDiagnosis }> = ({ diagnosis }) => {
  return (
    <div className="mt-3 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-3 text-xs text-gray-800">
      <div className="border-b border-emerald-200/80 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          1. Perfil Vocacional Identificado
        </span>
        <h4 className="text-sm font-extrabold text-[#004d25] mt-0.5">{diagnosis.profileTitle}</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <p className="font-bold text-[11px] text-emerald-900 mb-1">2. Principais Interesses</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
            {diagnosis.mainInterests.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <p className="font-bold text-[11px] text-emerald-900 mb-1">3. Habilidades e Aptidões</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
            {diagnosis.perceivedSkills.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <p className="font-bold text-[11px] text-emerald-900 mb-1">4. Preferências de Trabalho</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
            {diagnosis.workPreferences.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
          <p className="font-bold text-[11px] text-emerald-900 mb-1">5. Áreas Mais Compatíveis</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
            {diagnosis.compatibleAreas.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg p-3 border border-emerald-100 space-y-2">
        <p className="font-bold text-[11px] text-emerald-900 flex items-center space-x-1.5">
          <Briefcase className="w-3.5 h-3.5 text-[#006633]" />
          <span>6 e 7. Profissões Recomendadas e Justificativas</span>
        </p>
        <div className="space-y-2">
          {diagnosis.recommendedProfessions.map((prof, idx) => (
            <div key={idx} className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2">
              <p className="font-bold text-xs text-[#004d25]">{prof.name}</p>
              <p className="text-[11px] text-gray-700 mt-0.5 leading-relaxed">{prof.justification}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg p-3 border border-emerald-100 space-y-1.5">
        <p className="font-bold text-[11px] text-emerald-900 flex items-center space-x-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-[#006633]" />
          <span>8. Cursos e Caminhos de Formação</span>
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-700">
          {diagnosis.studyPaths.map((path, idx) => (
            <li key={idx}>{path}</li>
          ))}
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start space-x-2 text-[10px] text-amber-900">
        <Info className="w-3.5 h-3.5 shrink-0 text-amber-700 mt-0.5" />
        <p className="leading-relaxed">{diagnosis.disclaimer}</p>
      </div>
    </div>
  );
};

export const VocationalCounselorChat: React.FC<VocationalCounselorChatProps> = ({
  isOpen,
  onClose,
  user,
  openAuthModal,
}) => {
  const [session, setSession] = useState<VocationalSession | null>(null);
  const [messages, setMessages] = useState<VocationalMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega entrevista do usuário autenticado ao abrir ou trocar usuário
  useEffect(() => {
    if (!isOpen) return;
    if (!user) {
      setSession(null);
      setMessages([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      setErrorMessage(null);
      try {
        const res = await fetch('/api/v1/vocational/session');
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setErrorMessage(data.error || 'Não foi possível carregar sua entrevista.');
          return;
        }
        if (!cancelled) {
          setSession(data.session || null);
          setMessages(data.messages || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMessage('Falha na comunicação ao carregar a entrevista vocacional.');
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!text || isLoading || isResetting || !user) return;

    if (textToSend === undefined) {
      setInputMessage('');
    }
    setErrorMessage(null);

    const optimisticUserMsg: VocationalMessage = {
      id: `temp-${Date.now()}`,
      sessionId: session?.id || 'pending',
      role: 'user',
      content: text,
      stage: session?.currentStage || 1,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/vocational/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: session?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        if (textToSend === undefined) setInputMessage(text);
        setErrorMessage(data.error || 'Não foi possível obter resposta do Orientador Vocacional IA.');
        return;
      }

      if (data.session) setSession(data.session);

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== optimisticUserMsg.id);
        return [...withoutTemp, data.userMessage, data.assistantMessage];
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      if (textToSend === undefined) setInputMessage(text);
      setErrorMessage('Falha na conexão com o servidor: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetInterview = async () => {
    if (isLoading || isResetting || !user) return;
    setIsResetting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/vocational/reset', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Não foi possível reiniciar a entrevista.');
        return;
      }
      setSession(data.session || null);
      setMessages(data.messages || []);
      setInputMessage('');
    } catch (err: any) {
      setErrorMessage('Erro ao reiniciar entrevista: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  const isCompleted = session?.status === 'completed';
  const currentStage = session?.currentStage || 1;
  const diagnosis = session?.diagnosis || null;
  const userMessagesCount = messages.filter((m) => m.role === 'user').length;

  // Sugestões pós-diagnóstico usando as profissões reais identificadas quando disponíveis
  const topProfession = diagnosis?.recommendedProfessions?.[0]?.name || 'a primeira profissão recomendada';
  const secondProfession = diagnosis?.recommendedProfessions?.[1]?.name || 'a segunda profissão recomendada';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-label="Orientador Vocacional IA"
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-gray-200"
      >
        {/* Cabeçalho do Orientador Vocacional IA */}
        <div className="bg-gradient-to-r from-[#004d25] to-[#0f766e] text-white p-4 flex items-center justify-between border-b border-teal-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-white">
              <Compass className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm text-white">Orientador Vocacional IA</span>
                <span className="bg-amber-400/20 text-amber-100 text-[10px] font-bold px-1.5 py-0.2 rounded">
                  Entrevista
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/85">
                Descoberta de perfil, cursos e profissões
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar Orientador Vocacional IA"
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Estado da Entrevista */}
        {user && (
          <div className="bg-teal-50/70 border-b border-teal-200/80 px-4 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5 text-teal-950 font-semibold truncate">
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="truncate">{STAGE_LABELS[currentStage] || 'Entrevista Vocacional'}</span>
            </div>

            <button
              onClick={handleResetInterview}
              disabled={isLoading || isResetting}
              className="text-[11px] font-bold text-[#006633] hover:text-[#004d25] bg-white border border-emerald-200 hover:bg-emerald-50 px-2.5 py-1 rounded-md flex items-center space-x-1 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              title="Iniciar uma nova entrevista vocacional do zero"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refazer</span>
            </button>
          </div>
        )}

        {/* Área de Mensagens ou Convite para Login */}
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-gray-50/50">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006633]">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="font-bold text-gray-900 text-sm">Autenticação Necessária</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Entre com sua conta da <strong>CAMPUS IA</strong> para realizar sua entrevista vocacional individual e manter seu histórico protegido.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                openAuthModal();
              }}
              className="bg-[#006633] hover:bg-[#004d25] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              Entrar na Plataforma
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-[#006633] text-white rounded-tr-xs'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.isDiagnosis && m.diagnosis && (
                        <DiagnosisCard diagnosis={m.diagnosis} />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center space-x-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-2xl p-3 w-fit">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                  <span>Orientador Vocacional analisando sua resposta...</span>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Rodapé de Interação */}
            <div className="p-3 border-t border-gray-200 bg-white space-y-2">
              {/* Convite inicial discreto apenas antes da 1ª resposta */}
              {!isCompleted && userMessagesCount === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleSendMessage('Vamos começar!')}
                    disabled={isLoading}
                    className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-[#004d25] border border-emerald-200 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Vamos começar!
                  </button>
                </div>
              )}

              {/* Recursos adicionais após entrega do diagnóstico */}
              {isCompleted && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Explorar após o resultado
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() =>
                        handleSendMessage(`Quero conhecer melhor a profissão de ${topProfession}: rotina, desafios e mercado.`)
                      }
                      disabled={isLoading}
                      className="text-[11px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-900 text-gray-700 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Briefcase className="w-3 h-3 text-[#006633]" />
                      <span>Conhecer melhor uma profissão</span>
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage(`Compare ${topProfession} com ${secondProfession} considerando rotina e perfil.`)
                      }
                      disabled={isLoading}
                      className="text-[11px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-900 text-gray-700 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <GitCompare className="w-3 h-3 text-[#006633]" />
                      <span>Comparar duas profissões</span>
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Quais cursos e passos de formação devo fazer para essas áreas?')
                      }
                      disabled={isLoading}
                      className="text-[11px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-900 text-gray-700 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <GraduationCap className="w-3 h-3 text-[#006633]" />
                      <span>Descobrir cursos necessários</span>
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage('Gostaria de explorar outras áreas profissionais alternativas ao meu perfil.')
                      }
                      disabled={isLoading}
                      className="text-[11px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-900 text-gray-700 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-[#006633]" />
                      <span>Explorar outras áreas</span>
                    </button>
                    <button
                      onClick={handleResetInterview}
                      disabled={isLoading || isResetting}
                      className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Refazer entrevista vocacional</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Campo de entrada */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  placeholder={
                    isCompleted
                      ? 'Pergunte sobre profissões, cursos ou explore outras áreas...'
                      : 'Responda naturalmente à pergunta do orientador...'
                  }
                  value={inputMessage}
                  maxLength={1000}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
                <button
                  disabled={isLoading || !inputMessage.trim()}
                  onClick={() => handleSendMessage()}
                  className="bg-[#006633] hover:bg-[#004d25] disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                  title="Enviar resposta"
                  aria-label="Enviar resposta"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
                <span>{inputMessage.length}/1000 caracteres</span>
                <span>Orientação educativa por IA • Não substitui avaliação psicológica</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
