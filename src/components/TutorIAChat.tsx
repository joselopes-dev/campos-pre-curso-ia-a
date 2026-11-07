import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Discipline } from '../types/index.ts';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  HelpCircle, 
  FileText, 
  RotateCcw, 
  Lightbulb, 
  AlertTriangle,
  BookOpen
} from 'lucide-react';

interface TutorIAChatProps {
  isOpen: boolean;
  onClose: () => void;
  disciplines: Discipline[];
  initialDisciplineId?: string;
  initialLessonId?: string;
}

export const TutorIAChat: React.FC<TutorIAChatProps> = ({
  isOpen,
  onClose,
  disciplines,
  initialDisciplineId,
  initialLessonId,
}) => {
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(initialDisciplineId || 'disc-01');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSimplifyActive, setIsSimplifyActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedDiscipline = disciplines.find((d) => d.id === selectedDisciplineId) || disciplines[0];

  useEffect(() => {
    if (initialDisciplineId) {
      setSelectedDisciplineId(initialDisciplineId);
    }
  }, [initialDisciplineId]);

  // Carrega histórico quando abre ou muda disciplina
  useEffect(() => {
    if (!isOpen) return;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/v1/tutor/history?disciplineId=${selectedDisciplineId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            setMessages(data.history);
          } else {
            // Mensagem inicial de acolhimento pedagógico
            setMessages([
              {
                id: 'welcome-msg',
                role: 'assistant',
                content: `Olá! Sou o Tutor IA da plataforma **CAMPOS IA** para apoio pedagógico na disciplina **${selectedDiscipline.title}** (${selectedDiscipline.code}).\n\nComo posso ajudar você a compreender os conceitos fundamentais, praticar exemplos ou resolver dúvidas do material didático?`,
                timestamp: new Date().toISOString(),
                disciplineId: selectedDiscipline.id,
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar histórico do chat:', err);
      }
    }

    loadHistory();
  }, [isOpen, selectedDisciplineId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage.trim();
    if (!text || isLoading) return;

    setInputMessage('');
    setErrorMessage(null);

    // Mensagem do usuário
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      disciplineId: selectedDiscipline.id,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          disciplineId: selectedDiscipline.id,
          lessonId: initialLessonId,
          simplify: isSimplifyActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Não foi possível obter resposta do Tutor.');
        return;
      }

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        disciplineId: selectedDiscipline.id,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMessage('Falha na conexão com o servidor: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-gray-200">
        {/* Cabeçalho do Tutor IA */}
        <div className="bg-[#004d25] text-white p-4 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-white">
              <Bot className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm text-white">Tutor IA — Apoio Pedagógico</span>
                <span className="bg-emerald-400/20 text-emerald-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">Pré-Curso de Inteligência Artificial</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Disciplina Contextual */}
        <div className="bg-emerald-50/70 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-emerald-950 shrink-0">Contexto Curricular:</span>
          <select
            value={selectedDisciplineId}
            onChange={(e) => setSelectedDisciplineId(e.target.value)}
            className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs text-gray-800 font-medium focus:ring-1 focus:ring-emerald-500 outline-none truncate max-w-[280px]"
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-[#006633] text-white rounded-tr-xs'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Citações de Referências Oficiais da Ementa */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 text-[10px] text-gray-500 space-y-1">
                      <span className="font-bold text-emerald-800 flex items-center space-x-1">
                        <BookOpen className="w-3 h-3 text-emerald-700" />
                        <span>Referência Curricular Oficial:</span>
                      </span>
                      {m.sources.map((s, idx) => (
                        <div key={idx} className="bg-emerald-50/70 border border-emerald-100 p-2 rounded-lg font-mono text-gray-700 space-y-0.5">
                          <div className="flex items-center justify-between font-bold text-emerald-900">
                            {s.path ? (
                              <a
                                href={s.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-1 text-emerald-900"
                              >
                                <span>📄 {s.title}</span>
                              </a>
                            ) : (
                              <span>📄 {s.title}</span>
                            )}
                            {s.similarity && (
                              <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-sans font-semibold">
                                Relevância: {s.similarity}
                              </span>
                            )}
                          </div>
                          {s.section && (
                            <p className="text-[10px] text-gray-600 font-sans italic">{s.section}</p>
                          )}
                        </div>
                      ))}
                    </div>
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
              <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></div>
              <span>Tutor IA consultando base curricular e formulando explicação...</span>
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

        {/* Sugestões Rápidas e Botão de Simplificação */}
        <div className="p-3 border-t border-gray-200 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Dúvidas Frequentes</span>
            </span>

            {/* Toggle: Explicação Mais Simples */}
            <button
              onClick={() => setIsSimplifyActive(!isSimplifyActive)}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                isSimplifyActive
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isSimplifyActive ? '✓ Modo Simples Ativo' : 'Solicitar Linguagem Mais Simples'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              'Explique os conceitos desta aula passo a passo',
              'Me dê um exemplo prático em Python',
              'Como este tema se aplica no mercado de IA?',
            ].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(suggestion)}
                className="text-[11px] bg-gray-100 hover:bg-emerald-50 hover:text-emerald-900 text-gray-700 px-2.5 py-1 rounded-md transition-colors text-left"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Campo de Entrada de Mensagem */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="text"
              placeholder="Digite sua dúvida pedagógica (até 1.000 caracteres)..."
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
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-1">
            <span>{inputMessage.length}/1000 caracteres</span>
            <span>Respostas geradas por IA para apoio ao estudo • Podem conter imprecisões</span>
          </div>
        </div>
      </div>
    </div>
  );
};
