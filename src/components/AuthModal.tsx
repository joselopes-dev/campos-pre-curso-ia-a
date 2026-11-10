import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, AlertCircle, Lock, Mail, ArrowRight, User as UserIcon } from 'lucide-react';
import { User } from '../types/index.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '271409256917-dbbv48015no5uiicp9slk7vm3ona8gr.apps.googleusercontent.com';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const initGoogle = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) return;

      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            if (response.credential) {
              setLoading(true);
              setErrorMessage(null);
              try {
                const res = await fetch('/api/v1/auth/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });
                const data = await res.json();
                if (!res.ok) {
                  setErrorMessage(data.error || 'Falha na validação com o Google.');
                } else {
                  onLoginSuccess(data.user);
                  onClose();
                }
              } catch (err: any) {
                setErrorMessage('Erro ao conectar ao servidor: ' + err.message);
              } finally {
                setLoading(false);
              }
            }
          },
        });

        const targetDiv = document.getElementById('google-btn-container');
        if (targetDiv) {
          targetDiv.innerHTML = '';
          google.accounts.id.renderButton(targetDiv, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'rectangular',
          });
        }
      } catch (err) {
        console.warn('Google Identity Services inicialização controlada:', err);
      }
    };

    // Se o script do Google ainda não carregou, carrega ele
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      initGoogle();
    }
  }, [isOpen]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail institucional válido.');
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          name: nameInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Falha ao autenticar.');
        return;
      }
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMessage('Erro ao conectar ao servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-200 flex flex-col">
        <div className="bg-[#004d25] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-white">
              <Lock className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white font-mono">CAMPOS IA</h2>
                <span className="text-[10px] bg-emerald-700/80 text-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">Produção</span>
              </div>
              <p className="text-[11px] text-emerald-200/80">Ambiente Virtual de Aprendizagem Oficial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-gray-700">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-gray-900">Acesso à Plataforma</h3>
            <p className="text-gray-500 text-xs">
              Entre com seu e-mail institucional ou conta Google para acompanhar suas aulas e certificar seu progresso de 200 horas.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-2">
            <div id="google-btn-container" className="min-h-[44px]"></div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-gray-200"></div>
            <span className="shrink mx-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
              Ou acesse com e-mail institucional
            </span>
            <div className="grow border-t border-gray-200"></div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">E-mail Institucional</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="email" required placeholder="ex: seu.nome@escola.edu.br" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">Nome Completo (Opcional)</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input type="text" placeholder="Nome para registro acadêmico" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#006633] hover:bg-[#004d25] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer mt-2">
              <span>{loading ? 'Validando acesso...' : 'Acessar Ambiente Oficial'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p><strong>Segurança Operacional:</strong> Sessões autenticadas utilizam cookies HttpOnly criptografados com SameSite rigoroso e auditoria de acesso no servidor.</p>
          </div>
        </div>
      </div>
    </div>
  );
};