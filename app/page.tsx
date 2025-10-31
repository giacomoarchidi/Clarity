"use client";
import { useState, useEffect } from "react";
import Notification from "./components/Notification";

type DepartmentId = 'legal' | 'operations' | 'marketing' | 'rd' | 'sustainability' | 'finance' | 'supply-chain' | 'quality';

type BriefItem = {
  title: string;
  source: string;
  link: string;
  theme: string;
  priority: "High" | "Medium" | "Low";
  why_it_matters: string;
  region: string;
  category: string;
  article_summary?: string;
  key_data?: {
    [key: string]: any;
  };
  relevant_departments?: DepartmentId[];
  strategic_actions?: {
    [key in DepartmentId]?: string[];
  };
};

type FilterState = {
  categories: string[];
  regions: string[];
  priorities: string[];
  searchTerm: string;
  dateRange: string; // 'today' | 'week' | 'month' | '3months' | 'all'
};

export default function Home() {
  // Remove the raw variable that is no longer needed
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<BriefItem[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [strategyText, setStrategyText] = useState<string>("");
  const [uploadingStrategy, setUploadingStrategy] = useState<boolean>(false);
  const [strategyFileName, setStrategyFileName] = useState<string>("");
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    regions: [],
    priorities: [],
    searchTerm: "",
    dateRange: "week" // Default: ultima settimana
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const andrianiCategories = [
    { id: "packaging", name: "Packaging & Sustainability", icon: "♻️", color: "from-green-500 to-emerald-600" },
    { id: "supply-chain", name: "Supply Chain & Logistics", icon: "🚛", color: "from-blue-500 to-cyan-600" },
    { id: "regulations", name: "Regulations & Compliance", icon: "📋", color: "from-purple-500 to-violet-600" },
    { id: "competitors", name: "Competitors & Market", icon: "🏢", color: "from-gray-500 to-slate-600" },
    { id: "innovation", name: "Innovation & Technology", icon: "🔬", color: "from-indigo-500 to-blue-600" },
    { id: "sustainability", name: "Sustainability & ESG", icon: "🌱", color: "from-emerald-500 to-green-600" }
  ];

  const worldRegions = [
    { id: "italy", name: "Italy", flag: "🇮🇹", color: "from-green-600 to-emerald-700" },
    { id: "eu", name: "European Union", flag: "🇪🇺", color: "from-blue-600 to-indigo-700" },
    { id: "usa", name: "United States", flag: "🇺🇸", color: "from-red-600 to-rose-700" },
    { id: "canada", name: "Canada", flag: "🇨🇦", color: "from-red-500 to-red-700" }
  ];


  // Remove the parseInput function that is no longer needed

  const toggleFilter = (type: keyof Omit<FilterState, 'searchTerm'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) 
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      regions: [],
      priorities: [],
      searchTerm: "",
      dateRange: "week"
    });
  };

  // Filters are now handled by the API; order by priority High -> Medium -> Low for display
  const priorityRank = (p: string) => (p === 'High' ? 0 : p === 'Medium' ? 1 : 2);
  const filteredItems = [...items].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  const onSearchNews = async () => {
    setSearching(true);
    setError(null);
    setArticles([]);
    setItems([]);
    
    try {
      // First search for news
      const searchRes = await fetch("/api/search-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filters: {
            categories: filters.categories,
            regions: filters.regions,
            searchTerm: filters.searchTerm,
            dateRange: filters.dateRange
          }
        }),
      });
      
      const searchData = await searchRes.json();
      if (!searchRes.ok) throw new Error(searchData?.error || "Search failed");
      
      setArticles(searchData.articles || []);
      
      // Then analyze the found news
      if (searchData.articles?.length > 0) {
        await onAnalyzeNews(searchData.articles);
      }
      
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const onAnalyzeNews = async (newsArticles: any[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // Convert articles to the format required by the brief API
      const items = newsArticles.map(article => ({
        title: article.title,
        source: article.source,
        link: article.url,
        date: article.publishedAt
      }));

      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: items,
          filters: {
            categories: filters.categories,
            regions: filters.regions,
            searchTerm: filters.searchTerm,
            dateRange: filters.dateRange
          },
          strategyContext: strategyText
        }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(`AI Analysis Error: ${data.error || 'Failed to generate summaries'}`);
        setNotification({
          message: `Failed to analyze articles: ${data.error || 'Unknown error'}`,
          type: "error"
        });
        setItems([]);
        return;
      }
      
      const newItems = data.items || [];
      
      // STRICT CHECK: Must have summaries for all articles
      if (newItems.length === 0) {
        setError('No executive summaries generated');
        setNotification({
          message: 'AI failed to generate executive summaries. Please try again.',
          type: "error"
        });
        setItems([]);
        return;
      }
      
      // Process items first
      const processedItems = newItems.map((item: any, index: number) => ({
        ...item,
        publishedAt: newsArticles[index]?.publishedAt || new Date().toISOString()
      }));
      
      setItems(processedItems);
      
      // Show success notification
      const successRate = Math.round((newItems.length / newsArticles.length) * 100);
      if (newItems.length !== newsArticles.length) {
        setNotification({
          message: `Analyzed ${newItems.length} of ${newsArticles.length} articles (${successRate}% success)`,
          type: successRate >= 80 ? "success" : "info"
        });
      } else {
        setNotification({
          message: `✅ Successfully analyzed all ${processedItems.length} articles`,
          type: "success"
        });
      }
      
    } catch (e: any) {
      console.error('Analysis failed:', e);
      setError(`Analysis error: ${e.message}`);
      setNotification({
        message: `Failed to analyze articles: ${e.message}`,
        type: "error"
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Remove the onGenerate function that is no longer needed

  const chip = (p: string) => {
    const base = "rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm border";
    if (p === "High") return <span className={`${base} bg-red-600 text-white border-red-700`}>HIGH PRIORITY</span>;
    if (p === "Medium") return <span className={`${base} bg-amber-600 text-white border-amber-700`}>MEDIUM</span>;
    return <span className={`${base} bg-slate-600 text-white border-slate-700`}>LOW</span>;
  };

  const getThemeIcon = (theme: string) => {
    const icons: { [key: string]: string } = {
      "Agri & Commodity": "🌾",
      "Policy & Trade": "🏛️",
      "ESG/Energy/Packaging": "♻️",
      "Competitors/Finance/Governance": "💼",
      "Geopolitics & Risks": "🌍",
      "Tech/Data/Automation": "🤖",
      "Food Safety/Public Health": "🛡️",
      "Territory/Brand Italy": "🇮🇹",
      "Communication/Attention Economy": "📱"
    };
    return icons[theme] || "📰";
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-2xl mx-auto mb-6 overflow-hidden animate-pulse">
            <img 
              src="/LogoAndriani.png" 
              alt="Andriani Logo" 
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling!.style.display = 'block';
              }}
            />
            <span className="text-4xl hidden">🍝</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-800 mb-2">Andriani Intelligence</h1>
          <p className="text-slate-600">Loading platform...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 relative overflow-hidden">
      {/* Professional Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%231e40af%22%20fill-opacity%3D%221%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"></div>
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header - Professional & Clean */}
        <header className="mb-12">
          <div className="flex justify-between items-center mb-8">
            {/* Logo in alto a sinistra */}
            <div className="w-28 h-28 flex items-center justify-center -mt-2 -ml-2">
              <img 
                src="/LogoAndriani.png" 
                alt="Andriani Logo" 
                className="w-28 h-28 object-contain drop-shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.style.display = 'block';
                }}
              />
              <div className="text-slate-700 font-semibold text-3xl text-center leading-tight hidden">
                ANDRIANI
              </div>
            </div>
            
            {/* Titolo al centro - Professional */}
            <div className="text-center flex-1">
              <h1 className="text-5xl font-bold tracking-tight text-slate-900 leading-tight mb-2">
                Andriani Intelligence
              </h1>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-600 to-cyan-600 mx-auto mb-3 rounded-full"></div>
              <p className="text-slate-600 text-lg font-medium">Strategic News Analysis Platform</p>
            </div>
            
            {/* Dashboard Button - Professional */}
            <a
              href="/board"
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all duration-300 shadow-lg hover:shadow-xl font-medium border border-slate-700"
            >
              <span className="text-base">📊</span>
              <span>Board Dashboard</span>
            </a>
          </div>
          <p className="text-slate-600 text-base max-w-3xl mx-auto leading-relaxed text-center">
            Enterprise-grade intelligence platform for real-time monitoring and analysis of strategic developments in the global food industry
          </p>
        </header>

        {/* Filters Section - Professional */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm mb-10">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-xl">🔍</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Search Configuration</h2>
                <p className="text-slate-600 text-sm font-medium">Define parameters for intelligence gathering</p>
              </div>
            </div>
            <button
              onClick={clearAllFilters}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-sm font-semibold rounded-xl transition-all duration-200 border border-slate-300 shadow-sm"
            >
              Reset Filters
            </button>
          </div>

          {/* Search Bar - Professional */}
          <div className="mb-8">
            <label className="block text-slate-700 font-semibold text-sm mb-2 ml-1">Keywords & Topics</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Enter keywords: investment strategy, market trends, sustainability..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border-2 border-slate-200 text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-medium text-base"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 font-medium pl-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Combine with category and region filters for targeted intelligence
            </p>
          </div>

          {/* Categories - Professional */}
          <div className="mb-8">
            <label className="block text-slate-700 font-semibold text-sm mb-3 ml-1">Business Categories</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {andrianiCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => toggleFilter('categories', category.id)}
                  className={`relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                    filters.categories.includes(category.id)
                      ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-xs font-semibold text-center leading-tight">{category.name}</span>
                  </div>
                  {filters.categories.includes(category.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Regions - Professional */}
          <div className="mb-8">
            <label className="block text-slate-700 font-semibold text-sm mb-3 ml-1">Geographic Markets</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {worldRegions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => toggleFilter('regions', region.id)}
                  className={`relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                    filters.regions.includes(region.id)
                      ? 'bg-slate-800 text-white border-slate-800 shadow-lg scale-105'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">{region.flag}</span>
                    <span className="text-xs font-semibold text-center">{region.name}</span>
                  </div>
                  {filters.regions.includes(region.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter - Professional */}
          <div className="mb-6">
            <label className="block text-slate-700 font-semibold text-sm mb-3 ml-1">Time Period</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { id: 'today', label: 'Today', icon: '📅', desc: 'Last 24h' },
                { id: 'week', label: 'Last Week', icon: '📆', desc: '7 days' },
                { id: 'month', label: 'Last Month', icon: '🗓️', desc: '30 days' },
                { id: '3months', label: 'Last 3 Months', icon: '📊', desc: '90 days' },
                { id: 'all', label: 'All Time', icon: '🌐', desc: 'No limit' }
              ].map((range) => (
                <button
                  key={range.id}
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: range.id }))}
                  className={`relative p-3.5 rounded-xl border-2 transition-all duration-200 ${
                    filters.dateRange === range.id
                      ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xl">{range.icon}</span>
                    <span className="text-xs font-bold text-center">{range.label}</span>
                    <span className={`text-[10px] font-medium ${filters.dateRange === range.id ? 'text-white/70' : 'text-slate-500'}`}>
                      {range.desc}
                    </span>
                  </div>
                  {filters.dateRange === range.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full border-2 border-white"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          

          {/* Andriani Strategy PDF Upload */}
          <div className="mb-10">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center shadow-md">
                    <span className="text-lg">📄</span>
                  </div>
                  <div>
                    <div className="text-slate-900 font-bold">Andriani Strategy Document</div>
                    <div className="text-slate-600 text-sm">Upload a PDF with strategy, vision and objectives</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {/* Upload control */}
                <label className="group cursor-pointer border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-5 bg-slate-50 hover:bg-emerald-50/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center border border-slate-200">
                        <span className="text-base">⬆️</span>
                      </div>
                      <div>
                        <div className="text-slate-900 text-sm font-semibold">Select PDF file</div>
                        <div className="text-slate-500 text-xs">Max ~20k characters extracted • PDF only</div>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold border border-slate-700">Browse</div>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setStrategyFileName(file.name);
                        setUploadingStrategy(true);
                        setError(null);
                        const form = new FormData();
                        form.append('file', file);
                        const res = await fetch('/api/strategy', { method: 'POST', body: form });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || 'Upload failed');
                        setStrategyText(data.strategyText || '');
                        try { localStorage.setItem('andriani_strategy_context', data.strategyText || ''); } catch {}
                        setNotification({ message: 'Strategy PDF uploaded', type: 'success' });
                      } catch (err: any) {
                        setError(err.message || 'Failed to upload PDF');
                        setNotification({ message: 'Failed to upload PDF', type: 'error' });
                      } finally {
                        setUploadingStrategy(false);
                      }
                    }}
                  />
                </label>

                {/* Status row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    {uploadingStrategy ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
                        Processing PDF...
                      </span>
                    ) : strategyText ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Loaded {strategyFileName || 'strategy.pdf'} • {strategyText.length.toLocaleString()} chars
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                        No strategy uploaded
                      </span>
                    )}
                  </div>
                  {strategyText && (
                    <button
                      type="button"
                      onClick={() => {
                        setStrategyText("");
                        setStrategyFileName("");
                        try { localStorage.removeItem('andriani_strategy_context'); } catch {}
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Main Content - Minimalista */}
        <section className="space-y-6">
          {/* Search Section - Professional */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
            <p className="text-slate-600 mb-8 text-base max-w-2xl mx-auto leading-relaxed font-medium">
              Configure your search parameters above and initiate intelligence gathering
            </p>
            
            <button
              onClick={onSearchNews}
              disabled={searching || loading}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white px-12 py-4 font-semibold text-base hover:from-slate-900 hover:to-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 border border-slate-700"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Gathering Intelligence...</span>
                </>
              ) : loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Analyzing Data...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Execute Search</span>
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm flex items-center gap-2 justify-center font-light">
                  <span>⚠️</span>
                  <span>{error}</span>
                </p>
              </div>
            )}
          </div>

          {/* Articles Found Section - Professional */}
          {articles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-base">📰</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Articles Found</h2>
                    <p className="text-slate-600 text-xs font-medium">{articles.length} results matching criteria</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {articles.map((article, index) => (
                  <article 
                    key={index} 
                    className="group bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 hover:border-blue-400"
                  >
                    <a 
                      className="text-lg font-semibold text-slate-900 hover:text-blue-700 transition-colors duration-200 flex-1 leading-tight mb-4 block" 
                      href={article.url} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      {article.title}
                    </a>
                    
                    <div className="flex items-center gap-3 mb-4 text-slate-600 text-sm font-medium">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        {article.source}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-slate-700 leading-relaxed text-sm font-normal">
                        {article.description ? article.description.substring(0, 200) + '...' : 'No description available'}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Results Section - Professional */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-base">📋</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Executive Intelligence</h2>
                  <p className="text-slate-600 text-xs font-medium">{filteredItems.length} analyzed briefings</p>
                </div>
                {(filters.categories.length > 0 || filters.regions.length > 0 || filters.searchTerm || filters.dateRange !== 'week') && (
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg border border-blue-200 font-bold">
                    FILTERED
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {items.length === 0 && !loading && articles.length === 0 && (
                <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <span className="text-2xl">📰</span>
                  </div>
                  <h3 className="text-slate-900 font-bold text-lg mb-2">No Intelligence Data</h3>
                  <p className="text-slate-600 text-sm font-medium">Configure filters and execute search to begin analysis</p>
                </div>
              )}

              {items.length > 0 && filteredItems.length === 0 && (
                <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl">🔍</span>
                  </div>
                  <p className="text-gray-600 text-sm font-light">No items match the selected filters.</p>
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 text-cyan-500 hover:text-cyan-600 text-sm transition-colors duration-200 font-light"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {articles.length > 0 && items.length === 0 && !loading && (
                <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl">⏳</span>
                  </div>
                  <p className="text-gray-600 text-sm font-light">Articles found but analysis in progress...</p>
                  <p className="text-gray-500 text-xs mt-2 font-light">Executive summaries will appear here once analysis is complete.</p>
                </div>
              )}

              {articles.length > 0 && items.length === 0 && loading && (
                <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl">🔄</span>
                  </div>
                  <p className="text-gray-600 text-sm font-light">Analyzing articles and generating executive summaries...</p>
                  <p className="text-gray-500 text-xs mt-2 font-light">This may take a few moments.</p>
                </div>
              )}
              
              {filteredItems.map((it, i) => (
                <article 
                  key={i} 
                  className="group bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-200 hover:border-blue-400"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <a 
                      className="text-lg font-bold text-slate-900 hover:text-blue-700 transition-colors duration-200 flex-1 leading-tight" 
                      href={it.link} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      {it.title}
                    </a>
                    <div className="flex-shrink-0">
                      {chip(it.priority)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4 text-slate-600 text-sm font-medium flex-wrap">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      {it.source}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                      <span>{getThemeIcon(it.theme)}</span>
                      {it.theme}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                      <span className="text-sm">🌍</span>
                      {it.region}
                    </span>
                  </div>
                  
                  <div className="bg-blue-50 rounded-xl p-5 border-l-4 border-blue-600">
                    <div className="flex items-start gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-slate-700 font-semibold text-sm">Strategic Relevance</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed text-base font-medium">{it.why_it_matters}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Board Members Message - Professional */}
          {items.length > 0 && (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-10 shadow-2xl">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl border border-white/20">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold text-white">Board Review Required</h3>
                    <p className="text-slate-300 text-sm font-medium">{items.length} intelligence briefings ready</p>
                  </div>
                </div>
                <p className="text-slate-300 text-base mb-8 max-w-2xl mx-auto leading-relaxed font-medium">
                  Forward these strategic analyses to the Board Dashboard for executive review, 
                  approval, and distribution to relevant departments.
                </p>
                <button
                  onClick={() => {
                    localStorage.setItem('boardArticles', JSON.stringify(items));
                    setNotification({
                      message: `${items.length} briefings forwarded to Board Dashboard`,
                      type: "success"
                    });
                    setTimeout(() => {
                      window.location.href = '/board';
                    }, 1500);
                  }}
                  className="inline-flex items-center gap-3 px-10 py-4 bg-white text-slate-900 rounded-xl hover:bg-slate-100 transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transform font-bold text-base border-2 border-white/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Forward to Board Dashboard</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Footer - Professional */}
        <footer className="mt-16 text-center pb-8 border-t border-slate-200 pt-8">
          <div className="text-slate-400 text-sm font-medium mb-3">
            Andriani Intelligence Platform
          </div>
          <div className="inline-flex items-center gap-6 text-slate-500 text-xs">
            <span>Enterprise News Analytics</span>
            <span className="text-slate-300">•</span>
            <span>Real-time Monitoring</span>
            <span className="text-slate-300">•</span>
            <span>Strategic Intelligence</span>
          </div>
        </footer>
      </div>
      
      {/* Elegant Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          duration={3000}
          onClose={() => setNotification(null)}
        />
      )}
    </main>
  );
}