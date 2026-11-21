import React, { useState, useEffect, useCallback } from 'react';
import { AcademicWork, User } from '../types/index.ts';
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface AcademicWorksPageProps {
  user: User | null;
  onBack: () => void;
}

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PAGE_LIMIT = 20;

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const AcademicWorksPage: React.FC<AcademicWorksPageProps> = ({ user, onBack }) => {
  const canManage = user?.role === 'professor' || user?.role === 'administrador';

  const [works, setWorks] = useState<AcademicWork[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Modal de Cadastro / Edição
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingWork, setEditingWork] = useState<AcademicWork | null>(null);
  const [titleInput, setTitleInput] = useState<string>('');
  const [authorsInput, setAuthorsInput] = useState<string>('');
  const [workUrlInput, setWorkUrlInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal de Confirmação de Exclusão
  const [workToDelete, setWorkToDelete] = useState<AcademicWork | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchWorks = useCallback(
    async (targetPage: number, searchTerm: string, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setErrorMsg(null);

        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_LIMIT),
        });
        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim());
        }

        const res = await fetch(`/api/v1/academic-works?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível carregar os trabalhos acadêmicos.');
        }

        const received: AcademicWork[] = Array.isArray(data.works) ? data.works : [];
        if (append) {
          setWorks((prev) => {
            const seen = new Set(prev.map((w) => w.id));
            const next = [...prev];
            for (const item of received) {
              if (!seen.has(item.id)) {
                next.push(item);
              }
            }
            return next;
          });
        } else {
          setWorks(received);
          setFailedImages({});
        }

        setTotal(Number(data.total) || 0);
        setPage(Number(data.page) || targetPage);
        setHasMore(Boolean(data.hasMore));
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro de conexão ao consultar trabalhos acadêmicos.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchWorks(1, activeSearch, false);
  }, [activeSearch, fetchWorks]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
  };

  const openCreateModal = () => {
    setEditingWork(null);
    setTitleInput('');
    setAuthorsInput('');
    setWorkUrlInput('');
    setDescriptionInput('');
    setImageDataUrl(null);
    setImagePreviewUrl(null);
    setRemoveCoverImage(false);
    setImageError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (work: AcademicWork) => {
    setEditingWork(work);
    setTitleInput(work.title);
    setAuthorsInput(work.authors);
    setWorkUrlInput(work.workUrl);
    setDescriptionInput(work.description || '');
    setImageDataUrl(null);
    setImagePreviewUrl(work.coverImageUrl || null);
    setRemoveCoverImage(false);
    setImageError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Formato de arquivo inválido. Envie apenas imagens PNG, JPG/JPEG ou WebP.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError('A imagem selecionada excede o limite de 2 MB. Escolha um arquivo menor.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
        setImagePreviewUrl(reader.result);
        setRemoveCoverImage(false);
      } else {
        setImageError('Não foi possível ler o arquivo de imagem selecionado.');
      }
    };
    reader.onerror = () => {
      setImageError('Erro ao processar o arquivo de imagem. Tente novamente.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImageDataUrl(null);
    setImagePreviewUrl(null);
    setImageError(null);
    if (editingWork && editingWork.coverImageUrl) {
      setRemoveCoverImage(true);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = titleInput.trim();
    const authors = authorsInput.trim();
    const workUrl = workUrlInput.trim();
    const description = descriptionInput.trim();

    if (title.length < 3) {
      setFormError('Informe um título com pelo menos 3 caracteres.');
      return;
    }
    if (authors.length < 2) {
      setFormError('Informe o nome do autor ou dos integrantes da equipe.');
      return;
    }
    if (!isSafeHttpUrl(workUrl)) {
      setFormError('Informe um link válido iniciando com https:// ou http://.');
      return;
    }
    if (imageError) {
      setFormError('Corrija ou remova a imagem inválida antes de salvar.');
      return;
    }

    try {
      setSubmitting(true);
      const endpoint = editingWork
        ? `/api/v1/academic-works/${editingWork.id}`
        : '/api/v1/academic-works';
      const method = editingWork ? 'PUT' : 'POST';

      const payload: Record<string, any> = {
        title,
        authors,
        workUrl,
        description: description || null,
      };
      if (imageDataUrl) {
        payload.imageDataUrl = imageDataUrl;
      }
      if (editingWork && removeCoverImage && !imageDataUrl) {
        payload.removeCoverImage = true;
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Erro ao salvar trabalho acadêmico.');
        return;
      }

      setIsFormOpen(false);
      setFeedbackMsg(
        editingWork
          ? 'Trabalho acadêmico atualizado com sucesso.'
          : 'Novo trabalho acadêmico publicado com sucesso.'
      );
      await fetchWorks(1, activeSearch, false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      setFormError('Erro de comunicação com o servidor: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!workToDelete) return;
    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/v1/academic-works/${workToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Não foi possível excluir o trabalho acadêmico.');
        return;
      }

      const deletedId = workToDelete.id;
      setWorkToDelete(null);
      setWorks((prev) => prev.filter((item) => item.id !== deletedId));
      setTotal((prev) => Math.max(0, prev - 1));
      setFeedbackMsg('Trabalho acadêmico excluído com sucesso.');
      await fetchWorks(1, activeSearch, false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      setDeleteError('Falha ao excluir trabalho: ' + (err.message || 'Tente novamente.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho Institucional da Área */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006633] hover:text-[#004d25] transition-colors cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Painel</span>
            </button>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Trabalhos Acadêmicos
            </h1>
            <p className="text-sm sm:text-base font-semibold text-[#006633]">
              Produções acadêmicas e projetos voltados à Inteligência Artificial
            </p>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Espaço dedicado à publicação, divulgação científica e consulta de pesquisas, artigos técnicos, experimentos e projetos práticos desenvolvidos no contexto da Inteligência Artificial na CAMPUS IA.
            </p>
          </div>

          {canManage && (
            <div className="shrink-0">
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 bg-[#006633] hover:bg-[#004d25] text-white font-bold px-5 py-3 rounded-xl text-sm shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar Trabalho</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra de Busca e Contagem */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por título, autor ou tema..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Buscar
            </button>
            {activeSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Limpar
              </button>
            )}
          </form>

          <div className="text-xs text-gray-500 font-medium tabular-nums">
            Exibindo <strong className="text-gray-900">{works.length}</strong> de{' '}
            <strong className="text-gray-900">{total}</strong>{' '}
            {total === 1 ? 'trabalho publicado' : 'trabalhos publicados'}
          </div>
        </div>
      </div>

      {/* Feedback de Sucesso */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-medium">{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Erro de Carregamento */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => fetchWorks(1, activeSearch, false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 hover:bg-red-100 text-red-800 font-semibold rounded-lg text-xs cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* Estado de Carregamento Inicial */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-gray-800">Carregando trabalhos acadêmicos...</p>
          <p className="text-xs text-gray-500">Consultando acervo de publicações da CAMPUS IA</p>
        </div>
      ) : works.length === 0 ? (
        /* Estado Vazio */
        <div className="bg-white rounded-2xl border border-gray-200 p-12 sm:p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#006633] flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-gray-900">
              {activeSearch
                ? 'Nenhum trabalho encontrado para sua busca'
                : 'Nenhum trabalho acadêmico publicado até o momento'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500">
              {activeSearch
                ? 'Tente utilizar outros termos de título, autor ou tema.'
                : canManage
                ? 'Publique o primeiro trabalho acadêmico para iniciar o acervo científico da plataforma.'
                : 'Assim que professores ou administradores publicarem novos trabalhos, eles ficarão disponíveis aqui.'}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            {activeSearch && (
              <button
                onClick={handleClearSearch}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
            {canManage && !activeSearch && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 bg-[#006633] hover:bg-[#004d25] text-white font-bold px-5 py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Publicar Primeiro Trabalho</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grade Responsiva de Cards */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {works.map((work) => {
              const hasValidImage = Boolean(work.coverImageUrl) && !failedImages[work.id];
              const safeHref = isSafeHttpUrl(work.workUrl) ? work.workUrl : '#';

              return (
                <article
                  key={work.id}
                  className="group bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                >
                  {/* Imagem de Capa ou Espaço Reservado */}
                  <div className="aspect-[16/9] w-full bg-slate-900 relative overflow-hidden shrink-0">
                    {hasValidImage ? (
                      <img
                        src={work.coverImageUrl!}
                        alt={work.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={() =>
                          setFailedImages((prev) => ({
                            ...prev,
                            [work.id]: true,
                          }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#003d1c] via-[#005a2b] to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-2">
                          <BookOpen className="w-5 h-5 text-emerald-200" />
                        </div>
                        <span className="text-[11px] font-medium text-emerald-100/90">
                          Produção Acadêmica em IA
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Corpo do Card */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-snug line-clamp-2">
                        {work.title}
                      </h2>

                      <div className="flex items-start gap-1.5 text-xs font-medium text-emerald-800">
                        <Users className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{work.authors}</span>
                      </div>

                      {work.description && (
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                          {work.description}
                        </p>
                      )}
                    </div>

                    {/* Ações do Card */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 bg-[#006633] hover:bg-[#004d25] text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition-colors"
                      >
                        <span>Visualizar trabalho</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {canManage && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(work)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setWorkToDelete(work);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Carregamento Progressivo / Paginação */}
          {hasMore && (
            <div className="flex flex-col items-center justify-center pt-4 space-y-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchWorks(page + 1, activeSearch, true)}
                className="inline-flex items-center gap-2 bg-white hover:bg-emerald-50 text-[#006633] border border-emerald-300 font-bold px-6 py-3 rounded-xl text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Carregando mais trabalhos...</span>
                  </>
                ) : (
                  <span>
                    Carregar mais trabalhos ({total - works.length}{' '}
                    {total - works.length === 1 ? 'restante' : 'restantes'})
                  </span>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de Cadastro e Edição */}
      {isFormOpen && canManage && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#004d25] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  {editingWork ? 'Editar Trabalho Acadêmico' : 'Publicar Trabalho Acadêmico'}
                </h2>
                <p className="text-xs text-emerald-100/80">
                  Preencha as informações do projeto ou pesquisa em Inteligência Artificial
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Fechar formulário"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Título do trabalho <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="Ex.: Detecção de Anomalias em Séries Temporais com Deep Learning"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Autor ou integrantes da equipe <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={500}
                  value={authorsInput}
                  onChange={(e) => setAuthorsInput(e.target.value)}
                  placeholder="Ex.: Maria Silva, João Santos, Prof. Carlos Lima"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Link do trabalho completo <span className="text-red-600">*</span>
                </label>
                <input
                  type="url"
                  required
                  maxLength={2048}
                  value={workUrlInput}
                  onChange={(e) => setWorkUrlInput(e.target.value)}
                  placeholder="https://repositorio.instituicao.edu.br/trabalho"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Descrição breve <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Resumo objetivo dos métodos, resultados ou contribuição do trabalho..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-y"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Imagem de capa ou representativa{' '}
                  <span className="text-gray-400 font-normal">(PNG, JPG ou WebP • máx. 2 MB)</span>
                </label>

                {imagePreviewUrl ? (
                  <div className="space-y-2">
                    <div className="aspect-[16/9] w-full max-w-sm rounded-xl overflow-hidden border border-gray-200 bg-slate-900">
                      <img
                        src={imagePreviewUrl}
                        alt="Pré-visualização da capa"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs rounded-lg cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Alterar imagem</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Remover imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl bg-gray-50 hover:bg-emerald-50/30 transition-colors cursor-pointer text-center">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">
                      Clique para selecionar uma imagem de capa
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Formatos aceitos: PNG, JPG/JPEG ou WebP (até 2 MB)
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}

                {imageError && (
                  <p className="mt-2 text-xs text-red-700 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{imageError}</span>
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006633] hover:bg-[#004d25] disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingWork ? 'Salvar alterações' : 'Publicar trabalho'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {workToDelete && canManage && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-gray-900">Excluir Trabalho Acadêmico</h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Tem certeza de que deseja excluir o trabalho{' '}
                    <strong className="text-gray-900">"{workToDelete.title}"</strong>? Esta ação não poderá ser desfeita.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setWorkToDelete(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Confirmar exclusão</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
