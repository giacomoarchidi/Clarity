"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DEPARTMENTS, type DepartmentId, type Department } from "../../config/departments";

type ApprovedArticle = {
  title: string;
  source: string;
  link: string;
  theme: string;
  priority: "High" | "Medium" | "Low";
  why_it_matters: string;
  region: string;
  category: string;
  article_summary?: string;
  key_data?: { [key: string]: any };
  strategic_actions?: { [key: string]: string[] };
  approved_at: string;
  approved_by: string;
};

export default function DepartmentDashboard() {
  const params = useParams();
  const router = useRouter();
  const deptId = params.id as DepartmentId;
  const department = DEPARTMENTS.find(d => d.id === deptId);

  const [articles, setArticles] = useState<ApprovedArticle[]>([]);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadDepartmentArticles();

    // Load completed actions from localStorage
    const saved = localStorage.getItem(`dept_${deptId}_completed`);
    if (saved) {
      setCompletedActions(new Set(JSON.parse(saved)));
    }

    // Listen for new articles
    const interval = setInterval(() => {
      loadDepartmentArticles();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [deptId]);

  const loadDepartmentArticles = () => {
    const deptKey = `dept_${deptId}_articles`;
    const saved = localStorage.getItem(deptKey);
    if (saved) {
      const articles = JSON.parse(saved);
      setArticles(articles.sort((a: ApprovedArticle, b: ApprovedArticle) => 
        new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime()
      ));
    }
  };

  const saveProposal = (payload: any) => {
    const key = `dept_${deptId}_proposals`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(payload);
    localStorage.setItem(key, JSON.stringify(list));
  };

  const getProposal = (articleIdx: number, actionIdx: number, article: ApprovedArticle) => {
    try {
      const key = `dept_${deptId}_proposals`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const found = list.find((p: any) => p.article_link === article.link && p.action_idx === actionIdx);
      return found;
    } catch { return null; }
  };

  const handleUploadProposal = async (articleIdx: number, actionIdx: number, article: ApprovedArticle, actionText: string, file: File) => {
    const uk = `${articleIdx}-${actionIdx}`;
    setUploadingKeys(prev => new Set([...prev, uk]));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('deptId', deptId);
      form.append('articleTitle', article.title);
      form.append('articleLink', article.link);
      form.append('actionText', actionText);
      form.append('articleWhy', article.why_it_matters || '');
      form.append('articleSummary', article.article_summary || '');
      // load strategy context if present
      let strategyContext = '';
      try { strategyContext = localStorage.getItem('andriani_strategy_context') || ''; } catch {}
      form.append('strategyContext', strategyContext);

      const res = await fetch('/api/proposal', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');

      const payload = {
        dept_id: deptId,
        article_title: article.title,
        article_link: article.link,
        action_idx: actionIdx,
        action_text: actionText,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        analysis: data.analysis || {}
      };
      saveProposal(payload);
    } catch (e) {
      console.error('Upload proposal failed', e);
      alert('Caricamento proposta fallito: ' + (e as any)?.message);
    } finally {
      setUploadingKeys(prev => { const n = new Set(prev); n.delete(uk); return n; });
    }
  };

  const toggleActionCompleted = (actionKey: string) => {
    setCompletedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionKey)) {
        newSet.delete(actionKey);
      } else {
        newSet.add(actionKey);
      }
      localStorage.setItem(`dept_${deptId}_completed`, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const clearAllArticles = () => {
    if (confirm('Sei sicuro di voler eliminare tutti gli articoli?')) {
      localStorage.removeItem(`dept_${deptId}_articles`);
      setArticles([]);
    }
  };

  const generateDepartmentSummary = (
    article: ApprovedArticle,
    dept: Department,
    actions: string[]
  ): React.ReactNode => {
    const topResp = dept.responsibilities.slice(0, 2);
    const hasActions = actions.length > 0;
    const tone = ((): { focus: string[]; kpis?: string[]; note?: string } => {
      switch (dept.id) {
        case 'quality':
          return {
            focus: ['Implicazioni su food safety e conformità', 'Standard/certificazioni coinvolti (BRC, IFS, HACCP)'],
            kpis: ['Non-conformità individuate', 'Tempo di risoluzione', 'Esiti audit'],
            note: 'Priorità alla valutazione del rischio e piani di mitigazione.'
          };
        case 'finance':
          return {
            focus: ['Impatto su costi, margini e pricing', 'Decisioni di investimento o riallocazione budget'],
            kpis: ['Impatto % su COGS', 'Variazione margine', 'Payback atteso'],
            note: 'Focalizzarsi su quantificazione e tempi di ritorno.'
          };
        case 'supply-chain':
          return {
            focus: ['Disponibilità fornitori e lead time', 'Rischi logistici e alternative di sourcing'],
            kpis: ['OTIF', 'Lead time medio', 'Service level'],
            note: 'Definire rapidamente piani A/B per garantire continuità.'
          };
        case 'operations':
          return {
            focus: ['Impatto su processi e capacità impianti', 'Automazione ed efficienza'],
            kpis: ['OEE', 'Scarti', 'Throughput'],
            note: 'Individuare colli di bottiglia e quick-win operativi.'
          };
        case 'marketing':
          return {
            focus: ['Messaggi chiave e tutela del brand', 'Attivazioni su canali e trade'],
            kpis: ['Awareness', 'Intent to buy', 'Sell-out canale'],
            note: 'Coerenza narrativa e time-to-market delle iniziative.'
          };
        case 'rd':
          return {
            focus: ['Implicazioni su formula/ingredienti', 'Fattibilità tecnica e test'],
            kpis: ['Time-to-prototype', 'Stabilità/qualità', 'Costo formula'],
            note: 'Allineare prove di laboratorio con i requisiti regolatori.'
          };
        case 'sustainability':
          return {
            focus: ['Allineamento a policy ESG e packaging', 'Riduzione impatti (PFAS, CO₂, rifiuti)'],
            kpis: ['CO₂e', '% materiali riciclati', 'Score ESG'],
            note: 'Produrre evidenze misurabili per reporting e claim.'
          };
        default:
          return {
            focus: ['Aspetti chiave per il ruolo', 'Azioni di breve periodo'],
            kpis: undefined,
            note: undefined
          };
      }
    })();

    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm">
        <h4 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
          <span className="text-xl">🧭</span>
          Sintesi Operativa per {dept.nameIT}
        </h4>
        <div className="text-gray-800 leading-relaxed space-y-3">
          <p>
            Rilevanza per {dept.nameIT}: {article.why_it_matters}
          </p>
          {topResp.length > 0 && (
            <p>
              Ambiti impattati: <strong>{topResp.join(" • ")}</strong>.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-800 mb-2">Focus immediato</div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {tone.focus.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-800 mb-2">Contesto</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700">Priorità: <strong className="ml-1">{article.priority}</strong></span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700">Tema: {article.theme}</span>
                <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700">Regione: {article.region}</span>
              </div>
              {tone.note && <div className="mt-2 text-xs text-slate-600">Nota: {tone.note}</div>}
            </div>
          </div>
          {hasActions && (
            <div className="mt-1">
              <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Top azioni dal Board
              </div>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
                {actions.slice(0, 3).map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
                {actions.length > 3 && (
                  <li className="text-gray-500">+{actions.length - 3} task extra nella checklist</li>
                )}
              </ul>
            </div>
          )}
          {tone.kpis && (
            <div className="mt-1">
              <div className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                KPI da monitorare
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tone.kpis.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs text-slate-700">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const base = "px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm";
    if (priority === "High") return <span className={`${base} bg-gradient-to-r from-red-500 to-rose-600 text-white`}>Alta Priorità</span>;
    if (priority === "Medium") return <span className={`${base} bg-gradient-to-r from-amber-500 to-orange-600 text-white`}>Media Priorità</span>;
    return <span className={`${base} bg-gradient-to-r from-emerald-500 to-cyan-600 text-white`}>Bassa Priorità</span>;
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center shadow-2xl mx-auto mb-6 animate-pulse">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-2xl font-light text-gray-800">Loading...</h1>
        </div>
      </main>
    );
  }

  if (!department) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Dipartimento non trovato</h1>
          <button
            onClick={() => router.push('/board')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white rounded-lg hover:from-cyan-600 hover:to-emerald-600 transition-all"
          >
            Torna alla Board
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Futuristic background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%236366f1%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header - Futuristic */}
        <header className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/board')}
              className="group px-5 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-xl hover:bg-white hover:border-indigo-300 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">←</span>
              <span className="font-medium">Board Dashboard</span>
            </button>

            <button
              onClick={clearAllArticles}
              className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all text-sm font-medium shadow-sm hover:shadow-md"
            >
              <span className="flex items-center gap-2">
                <span>🗑️</span>
                Cancella Tutti
              </span>
            </button>
          </div>

          {/* Department Hero Card - Futuristic */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-2xl mb-8">
            {/* Animated background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${department.color} opacity-5`}></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
            
            <div className="relative p-8">
              <div className="flex items-center gap-6">
                <div className={`w-28 h-28 bg-gradient-to-br ${department.color} rounded-2xl flex items-center justify-center shadow-2xl animate-float`}>
                  <span className="text-6xl">{department.icon}</span>
                </div>
                <div className="flex-1">
                  <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                    {department.nameIT}
                  </h1>
                  <p className="text-gray-700 text-lg mb-4">{department.description}</p>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-xl text-base font-semibold shadow-sm flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                      {articles.length} {articles.length === 1 ? 'Articolo Ricevuto' : 'Articoli Ricevuti'}
                    </div>
                    {articles.length > 0 && (
                      <div className="px-4 py-2 bg-gradient-to-r from-emerald-100 to-cyan-100 text-emerald-700 rounded-xl text-sm font-medium">
                        {articles.reduce((sum, a) => sum + (a.strategic_actions?.[deptId]?.length || 0), 0)} Azioni Totali
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Department Responsibilities - Info Card Compatta */}
          <details className="group/details bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-md overflow-hidden">
            <summary className="cursor-pointer px-6 py-4 hover:bg-gray-50 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <div>
                  <h3 className="text-gray-900 font-semibold text-base">Responsabilità del Dipartimento</h3>
                  <p className="text-gray-500 text-xs">Competenze generali e aree di focus</p>
                </div>
              </div>
              <span className="text-gray-400 text-sm group-open/details:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="border-t border-gray-200 p-6 bg-gradient-to-br from-gray-50 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {department.responsibilities.map((resp, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-gray-700 text-sm">
                    <span className="text-indigo-500 mt-0.5 text-base">✓</span>
                    <span className="leading-relaxed">{resp}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </header>

        {/* Separator */}
        {articles.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              <div className="px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full text-indigo-700 font-semibold text-sm shadow-sm">
                📬 Articoli Ricevuti dal Board
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            </div>
          </div>
        )}

        {/* Articles List */}
        {articles.length === 0 ? (
          <div className="relative overflow-hidden text-center py-24 bg-gradient-to-br from-white to-gray-50 border-2 border-dashed border-gray-300 rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-purple-50/30"></div>
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-float">
                <span className="text-5xl">📭</span>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-3">Nessun Articolo</h2>
              <p className="text-gray-600 text-lg">
                Il Board non ha ancora inviato articoli al tuo dipartimento
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Torna alla Board Dashboard per approvare e inviare articoli
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article, idx) => {
              const myActions = article.strategic_actions?.[deptId] || [];
              const actionsCompleted = myActions.filter((_, actionIdx) => 
                completedActions.has(`${idx}-${actionIdx}`)
              ).length;
              const progress = myActions.length > 0 ? (actionsCompleted / myActions.length) * 100 : 0;
              
              return (
                <article key={idx} className="group relative overflow-hidden bg-white/90 backdrop-blur-sm border border-gray-200 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 animate-fadeIn">
                  {/* Gradient accent top */}
                  <div className={`h-2 bg-gradient-to-r ${department.color}`}></div>
                  
                  <div className="p-8">
                    {/* Article Header */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {getPriorityBadge(article.priority)}
                          <div className="h-6 w-px bg-gray-300"></div>
                          <span className="text-sm text-gray-600 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
                            {new Date(article.approved_at).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {myActions.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-gray-600 font-medium">{actionsCompleted}/{myActions.length} completate</div>
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noreferrer"
                        className="group/link text-2xl font-bold text-gray-900 hover:text-indigo-600 transition-colors inline-flex items-center gap-2"
                      >
                        {article.title}
                        <span className="opacity-0 group-hover/link:opacity-100 transition-opacity text-lg">→</span>
                      </a>
                      
                      <div className="flex items-center gap-4 mt-4 text-sm">
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
                          <span>📰</span>
                          {article.source}
                        </span>
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-indigo-700 font-medium">
                          <span>🏷️</span>
                          {article.theme}
                        </span>
                      </div>
                    </div>

                    {/* Department-tailored Operational Summary */}
                    {generateDepartmentSummary(article, department, myActions)}

                    {/* Why It Matters - Futuristic Card */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 mb-6 border border-indigo-200/50 shadow-sm">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-2xl"></div>
                      <div className="relative">
                        <h4 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                            <span className="text-white text-sm">💡</span>
                          </div>
                          Perché è Rilevante per {department.nameIT}
                        </h4>
                        <p className="text-gray-800 leading-relaxed font-medium">{article.why_it_matters}</p>
                      </div>
                    </div>

                    {/* Article Summary */}
                    {article.article_summary && (
                      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 mb-6 border border-gray-200">
                        <h4 className="text-gray-900 font-bold text-base mb-3 flex items-center gap-2">
                          <span className="text-xl">📄</span>
                          Riassunto Completo
                        </h4>
                        <p className="text-gray-700 leading-relaxed">{article.article_summary}</p>
                      </div>
                    )}

                    {/* Strategic Actions - Futuristic Interactive */}
                    {myActions.length > 0 && (
                      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300/50 bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 shadow-md">
                        {/* Header with progress */}
                        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-5 text-white">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                <span className="text-2xl">🎯</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-lg">Azioni Strategiche da Eseguire</h4>
                                <p className="text-white/90 text-sm">Approvate dal Board per questo articolo</p>
                              </div>
                            </div>
                            {progress === 100 && (
                              <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex items-center gap-2">
                                <span className="text-xl">🎉</span>
                                <span className="font-semibold">Completato!</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions checklist */}
                        <div className="p-6 space-y-3">
                          {myActions.map((action, actionIdx) => {
                            const actionKey = `${idx}-${actionIdx}`;
                            const isCompleted = completedActions.has(actionKey);

                            return (
                              <div key={actionIdx} className={`group/action relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                                isCompleted 
                                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300' 
                                  : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                              }`}>
                                <div className="p-4 flex items-start gap-4">
                                  {/* Checkbox - Futuristic */}
                                  <button
                                    onClick={() => toggleActionCompleted(actionKey)}
                                    className={`mt-1 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                                      isCompleted
                                        ? 'bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-500 shadow-lg scale-110'
                                        : 'bg-white border-gray-300 hover:border-emerald-400 hover:scale-105'
                                    }`}
                                  >
                                    {isCompleted && (
                                      <span className="text-white text-lg font-bold animate-fadeIn">✓</span>
                                    )}
                                  </button>
                                  
                                  {/* Action number */}
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm ${
                                    isCompleted
                                      ? 'bg-emerald-200 text-emerald-700'
                                      : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700'
                                  }`}>
                                    {actionIdx + 1}
                                  </div>
                                  
                                  {/* Action text */}
                                  <span className={`flex-1 leading-relaxed font-medium transition-all ${
                                    isCompleted 
                                      ? 'line-through text-gray-500' 
                                      : 'text-gray-900'
                                  }`}>
                                    {action}
                                  </span>

                                  {/* Completed badge */}
                                  {isCompleted && (
                                    <div className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md animate-fadeIn">
                                      ✓ Fatto
                                    </div>
                                  )}
                                </div>
                                {/* Upload proposta e preview AI */}
                                <div className="px-4 pb-4 -mt-2">
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
                                      Carica proposta PDF
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleUploadProposal(idx, actionIdx, article, action, f);
                                        }}
                                      />
                                    </label>
                                    {uploadingKeys.has(`${idx}-${actionIdx}`) && (
                                      <span className="text-xs text-slate-500">Caricamento/analisi in corso…</span>
                                    )}
                                  </div>
                                  {(() => {
                                    const p = getProposal(idx, actionIdx, article);
                                    if (!p) return null;
                                    const a = p.analysis || {};
                                    return (
                                      <div className="mt-2 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-md p-3">
                                        <div className="text-xs text-slate-700 mb-1"><strong>AI screening</strong> • {p.file_name}</div>
                                        {a.summary && <div className="text-xs text-slate-800 mb-2">{a.summary}</div>}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                          {Array.isArray(a.strengths) && a.strengths.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-md p-2">
                                              <div className="font-semibold text-emerald-700 mb-1">Punti di forza</div>
                                              <ul className="list-disc pl-4 space-y-0.5">{a.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                          )}
                                          {Array.isArray(a.gaps) && a.gaps.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-md p-2">
                                              <div className="font-semibold text-amber-700 mb-1">Gap</div>
                                              <ul className="list-disc pl-4 space-y-0.5">{a.gaps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                          )}
                                          {Array.isArray(a.recommended_adjustments) && a.recommended_adjustments.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-md p-2">
                                              <div className="font-semibold text-purple-700 mb-1">Aggiustamenti consigliati</div>
                                              <ul className="list-disc pl-4 space-y-0.5">{a.recommended_adjustments.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                          )}
                                          {Array.isArray(a.feasibility) && a.feasibility.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-md p-2">
                                              <div className="font-semibold text-slate-700 mb-1">Fattibilità</div>
                                              <ul className="list-disc pl-4 space-y-0.5">{a.feasibility.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                          )}
                                          {Array.isArray(a.next_steps) && a.next_steps.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-md p-2">
                                              <div className="font-semibold text-blue-700 mb-1">Next steps</div>
                                              <ul className="list-disc pl-4 space-y-0.5">{a.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer - Futuristic */}
        <footer className="mt-16 text-center pb-8">
          <div className="inline-flex items-center gap-8 text-gray-400 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
              {department.nameIT}
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              Andriani Intelligence
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              Department Dashboard
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

