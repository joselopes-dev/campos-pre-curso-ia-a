import React, { useState, useEffect } from 'react';
import { User, Certificate } from '../types/index.ts';
import { 
  Award, 
  ShieldCheck, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  FileBadge, 
  Download, 
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  GraduationCap
} from 'lucide-react';

interface CertificatesModalProps {
  user: User;
  progressData: any;
  onClose?: () => void;
}

interface MyCertificateResponse {
  hasCertificate: boolean;
  certificate: Certificate | null;
  eligible: boolean;
  approvedDisciplinesCount: number;
  totalDisciplinesCount: number;
  courseTitle: string;
  totalHours: number;
  studentName: string;
  registrationNumber?: string;
  requirements: string[];
}

export const CertificatesModal: React.FC<CertificatesModalProps> = ({ user, progressData }) => {
  const [certInfo, setCertInfo] = useState<MyCertificateResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Verificador Público
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);

  // Carrega status de certificado do aluno autenticado
  const fetchMyCertificate = async () => {
    try {
      setLoadingInfo(true);
      const res = await fetch('/api/v1/certificates/my');
      if (res.ok) {
        const data: MyCertificateResponse = await res.json();
        setCertInfo(data);
      }
    } catch (err) {
      console.error('Erro ao consultar certificados do estudante:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    fetchMyCertificate();
  }, [user.id]);

  // Emissão de Certificado
  const handleIssueCertificate = async () => {
    try {
      setIssuing(true);
      setIssueError(null);
      setIssueSuccess(null);

      const res = await fetch('/api/v1/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao emitir o certificado.');
      }

      setIssueSuccess(data.message || 'Certificado emitido e registrado com sucesso!');
      await fetchMyCertificate();
    } catch (err: any) {
      setIssueError(err.message || 'Erro durante a emissão.');
    } finally {
      setIssuing(false);
    }
  };

  // Verificação Pública
  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || verificationCode).trim();
    if (!code) return;

    try {
      setVerifying(true);
      setVerifyError(null);
      setVerificationResult(null);

      const res = await fetch(`/api/v1/certificates/verify/${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.message || data.error || 'Código de certificado não localizado.');
      } else {
        setVerificationResult(data);
      }
    } catch (err: any) {
      setVerifyError('Falha na verificação: ' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const approvedCount = certInfo?.approvedDisciplinesCount ?? (progressData?.completedDisciplinesCount || 0);
  const totalDisciplines = certInfo?.totalDisciplinesCount || 20;
  const isEligible = certInfo?.eligible || approvedCount >= totalDisciplines;
  const hasCertificate = Boolean(certInfo?.hasCertificate && certInfo?.certificate);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Principal */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase bg-amber-50 px-2 py-0.5 rounded">
              Certificação Técnica Oficial
            </span>
            <h1 className="text-2xl font-black text-gray-900">Certificados e Registro Acadêmico</h1>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          O certificado do Pré-Curso de Inteligência Artificial (200 horas) possui registro acadêmico institucional, QR Code rastreável e validação criptográfica pública.
        </p>
      </div>

      {/* 1. SEÇÃO DE CERTIFICADO DO ESTUDANTE */}
      {loadingInfo ? (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-xs text-gray-500">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Consultando registros acadêmicos do estudante...
        </div>
      ) : hasCertificate && certInfo?.certificate ? (
        /* Certificado Já Emitido */
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-7 rounded-2xl shadow-lg border border-emerald-700 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/5 rounded-full pointer-events-none blur-2xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 bg-emerald-700/80 text-emerald-100 px-3 py-1 rounded-full text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Certificado Oficial Emitido e Registrado</span>
              </div>

              <h2 className="text-2xl font-black text-white">
                {certInfo.certificate.courseTitle}
              </h2>

              <p className="text-sm text-emerald-100">
                Diplomado(a): <strong className="text-white">{certInfo.certificate.userName}</strong>
                {user.registration_number && (
                  <span> • Matrícula: <strong className="text-white">{user.registration_number}</strong></span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-emerald-200 pt-1">
                <span>Carga Horária: <strong>{certInfo.certificate.totalHours} horas</strong></span>
                <span>•</span>
                <span>Conclusão: <strong>{certInfo.certificate.completionDate}</strong></span>
                <span>•</span>
                <span className="flex items-center space-x-1.5 bg-white/10 px-2.5 py-1 rounded font-mono text-emerald-100">
                  <span>Chave: {certInfo.certificate.validationCode}</span>
                  <button
                    onClick={() => copyToClipboard(certInfo.certificate!.validationCode)}
                    className="hover:text-white cursor-pointer ml-1"
                    title="Copiar código"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
              </div>
            </div>

            {/* Ações do Certificado */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <a
                href={`/api/v1/certificates/download/${certInfo.certificate.validationCode}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center space-x-2 bg-amber-400 hover:bg-amber-300 text-gray-950 font-black px-5 py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Certificado em PDF</span>
              </a>

              <button
                onClick={() => {
                  setVerificationCode(certInfo.certificate!.validationCode);
                  handleVerify(certInfo.certificate!.validationCode);
                }}
                className="inline-flex items-center justify-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
                <span>Consultar no Validador</span>
              </button>
            </div>
          </div>
        </div>
      ) : isEligible ? (
        /* Elegível para Emissão */
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Requisitos Integralmente Cumpridos
              </span>
              <h2 className="text-xl font-black text-gray-950">
                Parabéns! Você está apto(a) a emitir seu Certificado Oficial
              </h2>
            </div>
          </div>

          <p className="text-xs text-gray-700">
            Você obteve aprovação em todos os 20 componentes curriculares com nota mínima de 7,0 e cumpriu a carga horária regimental de 200 horas do Pré-Curso de Inteligência Artificial.
          </p>

          {issueError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{issueError}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleIssueCertificate}
              disabled={issuing}
              className="bg-[#006633] hover:bg-[#004d25] disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all shadow-md flex items-center space-x-2 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>{issuing ? 'Emitindo e Registrando Certificado...' : 'Emitir Certificado de Conclusão Agora'}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requisitos para Obtenção do Certificado */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
            <FileBadge className="w-5 h-5 text-[#006633]" />
            <span>Critérios Regimentais para Certificação</span>
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 text-xs">
              <div>
                <p className="font-bold text-gray-900">Carga Horária Integral (200h)</p>
                <p className="text-gray-500">Módulo I (60h) + Módulo II (60h) + Módulo III (80h)</p>
              </div>
              <span className={`font-black ${approvedCount === 20 ? 'text-emerald-700' : 'text-gray-700'}`}>
                {approvedCount === 20 ? '100%' : `${Math.round((approvedCount / 20) * 100)}%`}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 text-xs">
              <div>
                <p className="font-bold text-gray-900">20 Componentes Curriculares Aprovados</p>
                <p className="text-gray-500">Nota mínima obrigatória de 7,0 em cada avaliação final</p>
              </div>
              <span className={`font-black ${approvedCount === 20 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {approvedCount} / 20
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 text-xs">
              <div>
                <p className="font-bold text-gray-900">Práticas Supervisionadas e Projetos</p>
                <p className="text-gray-500">Práticas Profissionais e TCC Aplicado em IA</p>
              </div>
              <span className={`font-bold px-2 py-0.5 rounded ${
                approvedCount === 20 ? 'text-emerald-800 bg-emerald-50' : 'text-amber-800 bg-amber-50'
              }`}>
                {approvedCount === 20 ? 'Concluído' : 'Em andamento'}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-gray-500 border-t border-gray-100 flex items-center justify-between">
            <span>Estudante: <strong className="text-gray-800">{user.name}</strong></span>
            <span className="font-mono text-gray-600">{user.registration_number || 'IF-ALUNO'}</span>
          </div>
        </div>

        {/* Ferramenta de Verificação Pública de Autenticidade */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
            <Search className="w-5 h-5 text-[#006633]" />
            <span>Validador Público de Autenticidade</span>
          </h2>

          <p className="text-xs text-gray-600">
            Digite o código de validação impresso no documento para verificar a autenticidade nos registros do Instituto Federal:
          </p>

          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Ex: IFIA-2026-A1B2"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2 text-xs uppercase font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            />
            <button
              onClick={() => handleVerify()}
              disabled={verifying || !verificationCode.trim()}
              className="bg-[#006633] hover:bg-[#004d25] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              {verifying ? 'Consultando...' : 'Verificar'}
            </button>
          </div>

          {verifyError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{verifyError}</span>
            </div>
          )}

          {verificationResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-950 animate-in fade-in">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Certificado Autêntico e Registrado no Sistema</span>
              </div>
              <p>Instituição: <strong className="text-emerald-950">{verificationResult.institution}</strong></p>
              <p>Diplomado(a): <strong>{verificationResult.certificate.userName}</strong></p>
              <p>Curso: <strong>{verificationResult.certificate.courseTitle}</strong></p>
              <p>Carga Horária: <strong>{verificationResult.certificate.totalHours} horas</strong></p>
              <p>Código: <span className="font-mono font-bold text-emerald-900">{verificationResult.certificate.validationCode}</span></p>
              <p>Data de Conclusão: {verificationResult.certificate.completionDate}</p>
              <p>Situação Registral: <span className="font-bold uppercase text-emerald-700">{verificationResult.certificate.status}</span></p>
            </div>
          )}

          <div className="bg-gray-50 p-3 rounded-lg text-[11px] text-gray-500">
            A autenticidade é validada exclusivamente pelo backend via endpoint público <code className="text-emerald-800 font-mono">/api/v1/certificates/verify/:code</code>.
          </div>
        </div>
      </div>
    </div>
  );
};
