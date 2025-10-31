"use client";
import { useState, useEffect, useRef } from "react";
import { DEPARTMENTS, type DepartmentId } from "../config/departments";

type BriefItem = {
  title: string;
  source: string;
  link: string;
  theme: string;
  priority: "High" | "Medium" | "Low";
  why_it_matters: string;
  region: string;
  category: string;
  publishedAt?: string;
  article_summary?: string; // 5-line faithful summary
  key_data?: {
    market_size?: string;
    growth_rate?: string;
    companies?: string[];
    regions?: string[];
    key_figures?: string[];
    [key: string]: any;
  };
  risk_register?: Array<{
    name: string;
    type: string; // regulatory, supply_chain, market, reputational, financial, technology, ESG
    drivers?: string[];
    likelihood?: "Low" | "Medium" | "High";
    impact?: "Low" | "Medium" | "High";
    timeframe?: "Immediate" | "Short-term" | "Mid-term" | "Long-term";
    mitigation?: string;
  }>;
  opportunity_register?: Array<{
    name: string;
    thesis?: string;
    magnitude?: string;
    timeframe?: "Immediate" | "Short-term" | "Mid-term" | "Long-term";
    actions?: string;
  }>;
  relevant_departments?: DepartmentId[];
  strategic_actions?: {
    [key in DepartmentId]?: string[];
  };
};

type FilterState = {
  categories: string[];
  regions: string[];
  priorities: string[];
  themes: string[];
  dateRange: string;
  searchTerm: string;
};

type ProposalItem = {
  dept_id: string;
  article_title: string;
  article_link: string;
  action_idx: number;
  action_text: string;
  file_name: string;
  uploaded_at: string;
  analysis?: {
    summary?: string;
    strengths?: string[];
    gaps?: string[];
    next_steps?: string[];
    alignment_score?: number;
  }
};

export default function BoardPage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BriefItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [strategyText, setStrategyText] = useState<string>("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set()); // Track which items are expanded
  const [expandedStrategies, setExpandedStrategies] = useState<Set<number>>(new Set()); // Track which strategy sections are expanded
  const [editingStrategies, setEditingStrategies] = useState<{[articleIndex: number]: {[deptId: string]: string[]}}>({}); // Editable strategies
  const [approvedArticles, setApprovedArticles] = useState<Set<number>>(new Set()); // Track approved articles
  const actionGuardRef = useRef<number>(0); // Prevent double add/remove clicks
  const actionInFlightRef = useRef<boolean>(false); // Block duplicate handlers in same tick
  const lastActionRef = useRef<{ kind: 'add' | 'remove'; signature: string; ts: number } | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    regions: [],
    priorities: [],
    themes: [],
    dateRange: "all",
    searchTerm: ""
  });
  const [proposals, setProposals] = useState<ProposalItem[]>([]);

  useEffect(() => {
    setMounted(true);
    // Load saved articles from localStorage or API
    loadSavedArticles();
    // Load strategy context from localStorage if present
    try {
      const ctx = localStorage.getItem('andriani_strategy_context');
      if (ctx) setStrategyText(ctx);
    } catch {}
    
    // Listen for storage changes (when articles are sent from main page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'boardArticles' && e.newValue) {
        try {
          const articles = JSON.parse(e.newValue);
          if (articles && articles.length > 0) {
            setItems(articles);
            // Clear localStorage after loading
            localStorage.removeItem('boardArticles');
          }
        } catch (error) {
          console.error('Error loading articles from storage:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // When summary length changes, regenerate summaries for current items
  useEffect(() => {
    if (items.length > 0 && !loading) {
      regenerateSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryLength]);

  // When new items arrive without summaries, generate them once
  useEffect(() => {
    if (items.length > 0 && items.every(i => !i.article_summary) && !loading) {
      regenerateSummaries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleStrategyExpand = (index: number) => {
    setExpandedStrategies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const initializeEditingStrategies = (index: number, item: BriefItem) => {
    if (!editingStrategies[index] && item.strategic_actions) {
      setEditingStrategies(prev => ({
        ...prev,
        [index]: { ...item.strategic_actions }
      }));
    }
  };

  const updateStrategy = (articleIndex: number, deptId: string, strategyIndex: number, newValue: string) => {
    setEditingStrategies(prev => {
      const updated = { ...prev };
      if (!updated[articleIndex]) {
        updated[articleIndex] = {};
      }
      if (!updated[articleIndex][deptId]) {
        updated[articleIndex][deptId] = [];
      }
      updated[articleIndex][deptId] = [...updated[articleIndex][deptId]];
      updated[articleIndex][deptId][strategyIndex] = newValue;
      return updated;
    });
  };

  const addStrategy = (articleIndex: number, deptId: string) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    queueMicrotask(() => { actionInFlightRef.current = false; });
    const now = Date.now();
    if (now - actionGuardRef.current < 250) return; // guard against double click
    actionGuardRef.current = now;

    const currentLen = (editingStrategies[articleIndex]?.[deptId]?.length) || 0;
    const signature = `${articleIndex}|${deptId}|len:${currentLen}`;
    if (lastActionRef.current && lastActionRef.current.kind === 'add' && lastActionRef.current.signature === signature && (now - lastActionRef.current.ts) < 800) {
      return;
    }
    lastActionRef.current = { kind: 'add', signature, ts: now };
    setEditingStrategies(prev => {
      const updated = { ...prev };
      if (!updated[articleIndex]) {
        updated[articleIndex] = {};
      }
      if (!updated[articleIndex][deptId]) {
        updated[articleIndex][deptId] = [];
      }
      updated[articleIndex][deptId] = [...updated[articleIndex][deptId], ''];
      return updated;
    });
  };

  const removeStrategy = (articleIndex: number, deptId: string, strategyIndex: number) => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    queueMicrotask(() => { actionInFlightRef.current = false; });
    const now = Date.now();
    if (now - actionGuardRef.current < 250) return; // guard against double click
    actionGuardRef.current = now;

    const currentLen = (editingStrategies[articleIndex]?.[deptId]?.length) || 0;
    const signature = `${articleIndex}|${deptId}|idx:${strategyIndex}|len:${currentLen}`;
    if (lastActionRef.current && lastActionRef.current.kind === 'remove' && lastActionRef.current.signature === signature && (now - lastActionRef.current.ts) < 800) {
      return;
    }
    lastActionRef.current = { kind: 'remove', signature, ts: now };
    setEditingStrategies(prev => {
      const updated = { ...prev };
      if (updated[articleIndex] && updated[articleIndex][deptId]) {
        updated[articleIndex][deptId] = updated[articleIndex][deptId].filter((_, i) => i !== strategyIndex);
      }
      return updated;
    });
  };

  const approveAndSend = (articleIndex: number, item: BriefItem) => {
    // Save approved article with edited strategies, then tailor per-dept summaries via API
    const approvedBase = {
      ...item,
      strategic_actions: editingStrategies[articleIndex] || item.strategic_actions,
      approved_at: new Date().toISOString(),
      approved_by: 'Board'
    } as any;

    const doSend = async () => {
      try {
        const departments = item.relevant_departments || [];
        // Generate tailored summary per department in parallel
        const results = await Promise.allSettled(departments.map(async (deptId) => {
          const actions = (approvedBase.strategic_actions?.[deptId] || []) as string[];
          const body = {
            article: {
              title: approvedBase.title,
              source: approvedBase.source,
              link: approvedBase.link,
              article_summary: approvedBase.article_summary,
              why_it_matters: approvedBase.why_it_matters
            },
            deptId,
            actions,
            strategyContext: strategyText
          };
          try {
            const resp = await fetch('/api/brief-tailor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            const data = await resp.json();
            const tailored = data?.tailored_summary && typeof data.tailored_summary === 'string'
              ? data.tailored_summary
              : approvedBase.article_summary;

            // Store a dept-specific copy with tailored summary
            const deptKey = `dept_${deptId}_articles`;
            const existing = JSON.parse(localStorage.getItem(deptKey) || '[]');
            const perDept = { ...approvedBase, article_summary: tailored };
            existing.push(perDept);
            localStorage.setItem(deptKey, JSON.stringify(existing));
          } catch (e) {
            // Fallback: store generic summary
            const deptKey = `dept_${deptId}_articles`;
            const existing = JSON.parse(localStorage.getItem(deptKey) || '[]');
            existing.push(approvedBase);
            localStorage.setItem(deptKey, JSON.stringify(existing));
          }
        }));

        console.log('Tailor results:', results.map(r => r.status));
      } finally {
        // Mark as approved regardless of individual failures
        setApprovedArticles(prev => new Set([...prev, articleIndex]));
      }
    };

    // Fire and forget (no UI blocker)
    void doSend();

    console.log(`Article approved and sent to ${item.relevant_departments?.length || 0} departments (tailored).`);
  };

  const loadSavedArticles = () => {
    // Always start with empty dashboard
    setItems([]);
    
    // Check if there are articles in localStorage (in case of direct navigation)
    const saved = localStorage.getItem('boardArticles');
    if (saved) {
      try {
        const articles = JSON.parse(saved);
        if (articles && articles.length > 0) {
          setItems(articles);
          // Clear localStorage after loading
          localStorage.removeItem('boardArticles');
        }
      } catch (error) {
        console.error('Error loading articles:', error);
      }
    }
  };

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

  const themes = [
    "Agri & Commodity",
    "Policy & Trade", 
    "ESG/Energy/Packaging",
    "Competitors/Finance/Governance",
    "Geopolitics & Risks",
    "Tech/Data/Automation",
    "Food Safety/Public Health",
    "Territory/Brand Italy",
    "Communication/Attention Economy"
  ];

  const priorities = [
    { id: "High", name: "High Priority", color: "from-emerald-500 to-green-600" },
    { id: "Medium", name: "Medium Priority", color: "from-amber-500 to-orange-600" },
    { id: "Low", name: "Low Priority", color: "from-rose-500 to-pink-600" }
  ];

  const toggleFilter = (type: keyof Omit<FilterState, 'searchTerm' | 'dateRange'>, value: string) => {
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
      themes: [],
      dateRange: "all",
      searchTerm: ""
    });
  };

  const regenerateSummaries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare minimal items expected by API
      const inputItems = items.map((it) => ({
        title: it.title,
        source: it.source,
        link: it.link,
        date: it.publishedAt || new Date().toISOString()
      }));

      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: inputItems,
          filters: {
            categories: filters.categories,
            regions: filters.regions,
            searchTerm: filters.searchTerm,
            dateRange: filters.dateRange
          },
          summaryLength,
          strategyContext: strategyText
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(`AI Analysis Error: ${data.error || 'Failed to regenerate summaries'}`);
        return;
      }

      const newItems: any[] = data.items || [];
      // Preserve publishedAt by matching by link; fallback by index
      const merged = newItems.map((ni, idx) => {
        const match = items.find((old) => old.link === ni.link) || items[idx];
        return { ...ni, publishedAt: match?.publishedAt || new Date().toISOString() };
      });
      setItems(merged);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Ensure each article is in exactly one category
  const ensureUniqueCategories = (items: BriefItem[]) => {
    return items.map(item => ({
      ...item,
      category: item.category || 'general' // Ensure every item has a category
    }));
  };

  const uniqueItems = ensureUniqueCategories(items);
  const filteredItems = uniqueItems.filter(item => {
    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(item.category)) {
      return false;
    }
    
    // Region filter
    if (filters.regions.length > 0 && !filters.regions.includes(item.region)) {
      return false;
    }
    
    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(item.priority)) {
      return false;
    }
    
    // Theme filter
    if (filters.themes.length > 0 && !filters.themes.includes(item.theme)) {
      return false;
    }
    
    // Search term filter
    if (filters.searchTerm && !item.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) && 
        !item.source.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
        !item.why_it_matters.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
      return false;
    }
    
    // Date range filter
    if (filters.dateRange !== "all" && item.publishedAt) {
      const itemDate = new Date(item.publishedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (filters.dateRange === "today" && daysDiff > 0) return false;
      if (filters.dateRange === "week" && daysDiff > 7) return false;
      if (filters.dateRange === "month" && daysDiff > 30) return false;
    }
    
    return true;
  });

  // Order by priority: High -> Medium -> Low
  const priorityRank = (p: string) => (p === 'High' ? 0 : p === 'Medium' ? 1 : 2);
  const sortedItems = [...filteredItems].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  // Group sorted items by category for display
  const groupedItems = sortedItems.reduce((acc, item) => {
    const category = item.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, BriefItem[]>);

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

  const getPriorityBadge = (priority: string) => {
    const base = "inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm border";
    if (priority === "High") return <span className={`${base} bg-red-600 text-white border-red-700`}>HIGH PRIORITY</span>;
    if (priority === "Medium") return <span className={`${base} bg-amber-600 text-white border-amber-700`}>MEDIUM</span>;
    return <span className={`${base} bg-slate-600 text-white border-slate-700`}>LOW</span>;
  };

  // ===== Key Data utilities & visuals =====
  const formatKeyTitle = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const parseNumeric = (raw: any): { value: number; isPercent: boolean; currency?: string } | null => {
    if (typeof raw === 'number' && !isNaN(raw)) return { value: raw, isPercent: false };
    if (typeof raw !== 'string') return null;
    const str = raw.trim();
    const isPercent = /%/.test(str);
    const currencyMatch = str.match(/[€$£]/);
    const numMatch = str.replace(/[,\s]/g, '').match(/([-+]?\d*\.?\d+)/);
    if (!numMatch) return null;
    const value = parseFloat(numMatch[1]);
    if (isNaN(value)) return null;
    return { value, isPercent, currency: currencyMatch ? currencyMatch[0] : undefined };
  };

  const toNumberArray = (val: unknown): number[] | null => {
    if (Array.isArray(val) && val.every(v => typeof v === 'number' && isFinite(v))) return val as number[];
    if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
      const nums = (val as string[]).map(s => parseFloat(s.replace(/[,\s]/g, ''))).filter(v => !isNaN(v));
      return nums.length === (val as any[]).length ? nums : null;
    }
    return null;
  };

  const iconForKey = (key: string) => {
    const map: Record<string, string> = {
      market_size: '💹',
      growth_rate: '📈',
      companies: '🏢',
      regions: '🌍',
      key_figures: '🔢',
    };
    return map[key] || '📌';
  };

  const RadialProgress = ({ percent }: { percent: number }) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const r = 22;
    const c = 2 * Math.PI * r;
    const dash = (clamped / 100) * c;
    return (
      <svg width="64" height="64" viewBox="0 0 64 64" className="block">
        <g transform="translate(32,32)">
          <circle r={r} cx={0} cy={0} className="text-slate-200" stroke="currentColor" strokeWidth={8} fill="none" />
          <circle r={r} cx={0} cy={0} className="text-cyan-500" stroke="currentColor" strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90)" />
        </g>
      </svg>
    );
  };

  const Sparkline = ({ data, legend }: { data: number[]; legend?: boolean }) => {
    const w = 180;
    const h = 56;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = data.length > 1 ? w / (data.length - 1) : w;
    const points = data.map((d, i) => {
      const x = i * step;
      const y = h - ((d - min) / range) * h;
      return `${x},${y}`;
    });
    const path = points.reduce((acc, p, i) => acc + (i === 0 ? `M${p}` : ` L${p}`), '');
    const first = data[0];
    const last = data[data.length - 1];
    const deltaPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
    const trendUp = deltaPct >= 0;
    return (
      <div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="url(#spark)" strokeWidth={3} strokeLinecap="round" />
        </svg>
        {legend && (
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Min {min.toLocaleString()}</span>
            <span className={trendUp ? 'text-emerald-600' : 'text-rose-600'}>
              {trendUp ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
            </span>
            <span>Max {max.toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  };

  const BarGauge = ({ value, suffix }: { value: number; suffix?: string }) => {
    const max = value > 0 ? value * 1.25 : 100;
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div className="space-y-2">
        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-slate-600">{value.toLocaleString()} {suffix}</div>
      </div>
    );
  };

  const extractFiguresFromText = (text?: string): string[] => {
    if (!text) return [];
    const matches = text.match(/([€$£]\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?%)/g);
    return matches ? Array.from(new Set(matches)) : [];
  };

  const loadProposals = () => {
    const all: ProposalItem[] = [];
    try {
      DEPARTMENTS.forEach(d => {
        const key = `dept_${d.id}_proposals`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (Array.isArray(list)) all.push(...list);
      });
    } catch {}
    // Sort by time desc
    all.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    setProposals(all);
  };

  useEffect(() => {
    loadProposals();
    const onStorage = () => loadProposals();
    window.addEventListener('storage', onStorage);
    const t = setInterval(loadProposals, 5000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-emerald-50 relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <a 
            href="/"
            className="inline-block w-20 h-20 bg-gradient-to-br from-cyan-400 to-emerald-400 rounded-full flex items-center justify-center shadow-2xl mx-auto mb-6 overflow-hidden hover:scale-105 transition-transform duration-200 animate-pulse"
          >
              <img 
              src="/LogoAndriani.png" 
              alt="Andriani Logo" 
              className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (nextEl) nextEl.style.display = 'block';
                }}
            />
            <span className="text-4xl hidden">🍝</span>
          </a>
          <h1 className="text-3xl font-light text-gray-800 mb-2">Andriani Board Intelligence</h1>
          <p className="text-cyan-600 font-light">Loading...</p>
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
        {/* Header - Pulito e ordinato */}
        <header className="mb-10">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-lg relative z-30">
            <div className="flex flex-col gap-6">
              {/* Top row: logo, title, utility */}
              <div className="flex items-center justify-between">
                <a 
                  href="/"
                  className="flex items-center gap-3 hover:opacity-90 transition-opacity"
                >
                  <img 
                    src="/LogoAndriani.png" 
                    alt="Andriani Logo" 
                    className="w-16 h-16 object-contain drop-shadow-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextEl = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (nextEl) nextEl.style.display = 'block';
                    }}
                  />
                  <span className="text-3xl hidden">🍝</span>
                </a>

                <div className="flex-1 px-4 text-center md:text-left">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                    Board Dashboard
                  </h1>
                  <p className="text-slate-600 text-sm md:text-base font-medium mt-1">Executive Intelligence Center</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setItems([]);
                      try {
                        localStorage.removeItem('boardArticles');
                        DEPARTMENTS.forEach(d => {
                          localStorage.removeItem(`dept_${d.id}_proposals`);
                        });
                      } catch {}
                      setProposals([]);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-gradient-to-b from-white to-red-50 hover:from-white hover:to-red-100 transition-all duration-200 font-medium shadow-sm"
                  >
                    <span className="text-sm">🗑️</span>
                    <span className="text-sm">Clear</span>
                  </button>
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 shadow-sm font-medium"
                  >
                    <span className="text-sm">←</span>
                    <span className="text-sm">Home</span>
                  </a>
                </div>
              </div>

              {/* Bottom row: controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {strategyText && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Strategy loaded
                    </span>
                  )}
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-sm text-slate-600">Summary:</span>
                    <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                      {(['short','medium','long'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSummaryLength(opt)}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${summaryLength === opt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'}`}
                        >
                          {opt === 'short' ? 'Short' : opt === 'medium' ? 'Medium' : 'Long'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={regenerateSummaries}
                    disabled={loading || items.length === 0}
                    className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white shadow-sm disabled:opacity-50 overflow-hidden border border-blue-700 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-colors"
                  >
                    {!loading && <span className="text-sm">🚀</span>}
                    <span className="text-sm">{loading ? 'Generating…' : 'Regenerate Summaries'}</span>
                    {!loading && <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>}
                  </button>
                  <div className="relative group">
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all duration-200 border border-slate-700 shadow-sm font-medium">
                      <span className="text-sm">🏢</span>
                      <span className="text-sm">Departments</span>
                      <span className="text-xs">▼</span>
                    </button>
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="p-2">
                        {DEPARTMENTS.map(dept => (
                          <a
                            key={dept.id}
                            href={`/department/${dept.id}`}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all group/item"
                          >
                            <span className="text-2xl">{dept.icon}</span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 group-hover/item:text-indigo-700">{dept.nameIT}</div>
                              <div className="text-xs text-gray-500">{dept.name}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filters Section - Testo più grande e scuro */}
        <div className="bg-white/90 backdrop-blur-sm border border-gray-300 rounded-2xl p-8 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-lg">🔍</span>
              </div>
              <h2 className="text-2xl font-normal text-gray-900">Intelligence Filters</h2>
            </div>
            <button
              onClick={clearAllFilters}
              className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors duration-200"
            >
              Clear all filters
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search across all intelligence reports..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="w-full rounded-xl bg-white border border-gray-300 p-4 outline-none transition-all duration-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-gray-900 placeholder-gray-500 text-base"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Categories */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Categories</h3>
              <div className="space-y-2">
                {andrianiCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => toggleFilter('categories', category.id)}
                    className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                      filters.categories.includes(category.id)
                        ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white border-transparent shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{category.icon}</span>
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Regions */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Regions</h3>
              <div className="space-y-2">
                {worldRegions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => toggleFilter('regions', region.id)}
                    className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                      filters.regions.includes(region.id)
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-transparent shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{region.flag}</span>
                      <span className="text-sm font-medium">{region.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priorities - Testo più scuro e visibile */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Priority</h3>
              <div className="space-y-2">
                {priorities.map((priority) => (
                  <button
                    key={priority.id}
                    onClick={() => toggleFilter('priorities', priority.id)}
                    className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                      filters.priorities.includes(priority.id)
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-md'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium">{priority.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range - Testo più scuro e visibile */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Time Range</h3>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="w-full p-3 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary - Professional */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Intelligence Overview</h2>
                <p className="text-slate-600 text-sm font-medium">
                  {filteredItems.length} intelligence reports • {Object.keys(groupedItems).length} business categories
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg border border-red-200">
                <div className="w-3 h-3 bg-red-600 rounded-md shadow-sm"></div>
                <span className="text-slate-800 font-bold text-sm">{filteredItems.filter(item => item.priority === 'High').length}</span>
                <span className="text-slate-600 font-medium text-xs">HIGH</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <div className="w-3 h-3 bg-amber-600 rounded-md shadow-sm"></div>
                <span className="text-slate-800 font-bold text-sm">{filteredItems.filter(item => item.priority === 'Medium').length}</span>
                <span className="text-slate-600 font-medium text-xs">MED</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg border border-slate-200">
                <div className="w-3 h-3 bg-slate-600 rounded-md shadow-sm"></div>
                <span className="text-slate-800 font-bold text-sm">{filteredItems.filter(item => item.priority === 'Low').length}</span>
                <span className="text-slate-600 font-medium text-xs">LOW</span>
              </div>
            </div>
          </div>
        </div>

        {/* Articles by Category - Professional */}
        <div className="space-y-8">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-2xl">📭</span>
              </div>
              <h3 className="text-slate-900 font-bold text-lg mb-2">No Intelligence Data</h3>
              <p className="text-slate-600 text-sm font-medium">Execute searches from the main page to populate this dashboard</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, categoryItems]) => {
              const categoryInfo = andrianiCategories.find(cat => cat.id === category);
              return (
                <div key={category} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-xl">{categoryInfo?.icon || '📰'}</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{categoryInfo?.name || category}</h3>
                        <p className="text-slate-600 text-sm font-medium">{categoryItems.length} intelligence {categoryItems.length === 1 ? 'report' : 'reports'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    {categoryItems.map((item, itemIndex) => {
                      const globalIndex = sortedItems.indexOf(item);
                      const isExpanded = expandedItems.has(globalIndex);
                      const hasRisk = !!(item.risk_register && item.risk_register.length > 0);
                      const hasOpp = !!(item.opportunity_register && item.opportunity_register.length > 0);
                      
                      return (
                      <article 
                        key={itemIndex} 
                        className="group bg-white border border-gray-300 rounded-xl p-6 hover:bg-cyan-50 transition-all duration-200 hover:border-cyan-400"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <a 
                            className="text-lg font-medium text-gray-900 hover:text-cyan-600 transition-colors duration-200 flex-1 leading-relaxed" 
                            href={item.link} 
                            target="_blank" 
                            rel="noreferrer"
                          >
                            {item.title}
                          </a>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {getPriorityBadge(item.priority)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4 text-gray-700 text-sm font-normal">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                            {item.source}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="flex items-center gap-1.5">
                            <span>{getThemeIcon(item.theme)}</span>
                            {item.theme}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="flex items-center gap-1">
                            <span className="text-sm">🌍</span>
                            {item.region}
                          </span>
                          {item.publishedAt && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="flex items-center gap-1">
                                <span className="text-sm">📅</span>
                                {new Date(item.publishedAt).toLocaleDateString('it-IT')}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Strategic Relevance - Professional */}
                        <div className="bg-blue-50 rounded-xl p-5 border-l-4 border-blue-600 mb-4">
                          <div className="flex items-start gap-2 mb-2">
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700 font-bold text-sm">Board-Level Impact</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed text-base font-medium">{item.why_it_matters}</p>
                        </div>

                        {/* Expandable Details Section - Testo più grande */}
                        {isExpanded && (
                          <div className="mb-4">
                            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Article Summary */}
                            {item.article_summary && (
                              <div className="bg-gray-50 rounded-xl p-5 border border-gray-300 lg:col-span-2">
                                <h4 className="text-gray-800 font-medium mb-3 flex items-center gap-2 text-base">
                                  <span>📄</span>
                                  Sintesi dell'Articolo
                                </h4>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base font-normal">{item.article_summary}</p>
                              </div>
                            )}

                            {/* Key Data Table */}
                            {(item.key_data && Object.keys(item.key_data).length > 0) && (
                              <div className="bg-gray-50 rounded-xl p-5 border border-gray-300 lg:col-span-2">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-gray-800 font-medium flex items-center gap-2 text-base">
                                    <span>📊</span>
                                    Dati Chiave
                                  </h4>
                                  <span className="text-xs text-slate-500">Auto-generated per articolo</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {Object.entries(item.key_data)
                                    .sort(([kA, vA], [kB, vB]) => {
                                      // Sort by visualization richness: percent > series > numeric > array/text
                                      const score = (v: any) => {
                                        if (typeof v === 'string' && /%/.test(v)) return 4;
                                        const series = toNumberArray(v);
                                        if (series && series.length > 1) return 3;
                                        const num = parseNumeric(v);
                                        if (num) return 2;
                                        if (Array.isArray(v)) return 1;
                                        return 0;
                                      };
                                      return score(vB) - score(vA);
                                    })
                                    .map(([key, value]) => {
                                    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) return null;

                                    const numberSeries = toNumberArray(value);
                                    const numeric = parseNumeric(value);
                                    const title = formatKeyTitle(key);

                                    // Decide visual: percent -> radial, series -> sparkline, number -> bar, else -> text/tag list
                                    let visual: React.ReactNode = null;
                                    if (typeof value === 'string' && /%/.test(value)) {
                                      const n = parseNumeric(value);
                                      visual = n ? <RadialProgress percent={n.value} /> : null;
                                    } else if (numberSeries && numberSeries.length > 1) {
                                      visual = <Sparkline data={numberSeries} legend />;
                                    } else if (numeric && !numeric.isPercent) {
                                      visual = <BarGauge value={numeric.value} suffix={numeric.currency} />;
                                    }

                                    const body = (() => {
                                      if (visual) return visual;
                                      if (Array.isArray(value)) {
                                        return (
                                          <div className="flex flex-wrap gap-1.5">
                                            {value.map((v: any, i: number) => (
                                              <span key={i} className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs text-slate-700">{String(v)}</span>
                                            ))}
                                          </div>
                                        );
                                      }
                                      return <div className="text-gray-900 font-normal text-base">{String(value)}</div>;
                                    })();

                                    return (
                                      <div key={key} className="group bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                                            <span className="text-base">{iconForKey(key)}</span>
                                            {title}
                                          </div>
                                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Insight
                                            <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">•</span>
                                            <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">Hover</span>
                                          </div>
                                        </div>
                                        <div className="relative">
                                          {body}
                                          <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-transparent via-white/10 to-transparent"></div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Fallback when no key_data or nothing rendered */}
                            {(!item.key_data || Object.keys(item.key_data).length === 0) && (
                              <div className="bg-gray-50 rounded-xl p-5 border border-gray-300 lg:col-span-2">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-gray-800 font-medium flex items-center gap-2 text-base">
                                    <span>📊</span>
                                    Dati Chiave
                                  </h4>
                                  <span className="text-xs text-slate-500">Auto-extracted</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                                    <div className="text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2"><span>🔎</span>Figure rilevate</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {extractFiguresFromText(item.article_summary || item.why_it_matters).length > 0 ? (
                                        extractFiguresFromText(item.article_summary || item.why_it_matters).map((f, i) => (
                                          <span key={i} className="px-2 py-1 rounded-md bg-white border border-gray-200 text-xs text-slate-700">{f}</span>
                                        ))
                                      ) : (
                                        <span className="text-sm text-slate-500">Nessuna cifra individuata</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                                    <div className="text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2"><span>🏷️</span>Meta</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">{item.source}</span>
                                      <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">{item.theme}</span>
                                      <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">{item.region}</span>
                                      <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">{item.priority}</span>
                                      {item.publishedAt && (
                                        <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">{new Date(item.publishedAt).toLocaleDateString('it-IT')}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Risk Register */}
                            {item.risk_register && item.risk_register.length > 0 && (
                              <div className={`bg-rose-50 rounded-xl p-5 border border-rose-200 ${!hasOpp ? 'lg:col-span-2' : ''}`}>
                                <h4 className="text-rose-800 font-medium mb-3 flex items-center gap-2 text-base">
                                  <span>⚠️</span>
                                  Risk Register
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {item.risk_register.map((r, idx) => (
                                    <div key={idx} className="bg-white rounded-lg p-3 border border-rose-200">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="text-gray-900 font-semibold text-sm">{r.name}</div>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">{r.type}</span>
                                      </div>
                                      <div className="text-xs text-gray-600 mb-1">Drivers: {Array.isArray(r.drivers) ? (r.drivers.length ? r.drivers.join(', ') : '-') : (typeof r.drivers === 'string' ? r.drivers : '-')}</div>
                                      <div className="flex items-center gap-2 text-xs text-gray-700">
                                        <span>Likelihood: <strong>{r.likelihood || '-'}</strong></span>
                                        <span>•</span>
                                        <span>Impact: <strong>{r.impact || '-'}</strong></span>
                                        <span>•</span>
                                        <span>Timeframe: <strong>{r.timeframe || '-'}</strong></span>
                                      </div>
                                      {r.mitigation && (
                                        <div className="mt-1 text-xs text-gray-700">
                                          Mitigation: {r.mitigation}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Opportunity Register */}
                            {item.opportunity_register && item.opportunity_register.length > 0 && (
                              <div className={`bg-emerald-50 rounded-xl p-5 border border-emerald-200 ${!hasRisk ? 'lg:col-span-2' : ''}`}>
                                <h4 className="text-emerald-800 font-medium mb-3 flex items-center gap-2 text-base">
                                  <span>🌱</span>
                                  Opportunities
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {item.opportunity_register.map((o, idx) => (
                                    <div key={idx} className="bg-white rounded-lg p-3 border border-emerald-200">
                                      <div className="text-gray-900 font-semibold text-sm mb-1">{o.name}</div>
                                      {o.thesis && <div className="text-xs text-gray-700 mb-1">Thesis: {o.thesis}</div>}
                                      <div className="flex items-center gap-2 text-xs text-gray-700">
                                        <span>Magnitude: <strong>{o.magnitude || '-'}</strong></span>
                                        <span>•</span>
                                        <span>Timeframe: <strong>{o.timeframe || '-'}</strong></span>
                                      </div>
                                      {o.actions && <div className="mt-1 text-xs text-gray-700">Actions: {o.actions}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            </div>
                          </div>
                        )}

                        {/* Department Strategies Section - Futuristic Design */}
                        {item.relevant_departments && item.relevant_departments.length > 0 && (
                          <div className="mt-6">
                            <button
                              onClick={() => {
                                toggleStrategyExpand(globalIndex);
                                initializeEditingStrategies(globalIndex, item);
                              }}
                              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                            >
                              {/* Professional gradient background */}
                              <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-900"></div>
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                              
                              {/* Content */}
                              <div className="relative py-5 px-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                    <span className="text-2xl">🎯</span>
                                  </div>
                                  <div className="text-left">
                                    <div className="font-bold text-white text-base tracking-wide">Department Strategy Assignment</div>
                                    <div className="text-white/90 text-sm mt-0.5 flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                      {item.relevant_departments.length} departments assigned
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="hidden md:flex gap-1">
                                    {item.relevant_departments.slice(0, 3).map(deptId => {
                                      const dept = DEPARTMENTS.find(d => d.id === deptId);
                                      return dept ? (
                                        <div key={deptId} className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg" title={dept.nameIT}>
                                          {dept.icon}
                                        </div>
                                      ) : null;
                                    })}
                                    {item.relevant_departments.length > 3 && (
                                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-xs text-white font-semibold">
                                        +{item.relevant_departments.length - 3}
                                      </div>
                                    )}
                                  </div>
                                  <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <span className="text-white text-sm transition-transform duration-300" style={{ transform: expandedStrategies.has(globalIndex) ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                  </div>
                                </div>
                              </div>
                            </button>

                            {expandedStrategies.has(globalIndex) && (
                              <div className="mt-4 space-y-3 animate-fadeIn">
                                {item.relevant_departments.map(deptId => {
                                  const dept = DEPARTMENTS.find(d => d.id === deptId);
                                  if (!dept) return null;

                                  const strategies = (editingStrategies[globalIndex]?.[deptId] || item.strategic_actions?.[deptId] || []);

                                  return (
                                    <div key={deptId} className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:shadow-2xl transition-all duration-300">
                                      {/* Department Header */}
                                      <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 p-5">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                                              <span className="text-2xl">{dept.icon}</span>
                                            </div>
                                            <div>
                                              <h4 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                                                {dept.nameIT}
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                                                  {strategies.length} {strategies.length === 1 ? 'azione' : 'azioni'}
                                                </span>
                                              </h4>
                                              <p className="text-gray-600 text-sm mt-0.5">{dept.description}</p>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              // Stop any additional React/DOM listeners
                                              // @ts-ignore
                                              if (e?.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
                                              addStrategy(globalIndex, deptId);
                                            }}
                                            className="group/btn relative overflow-hidden px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                                          >
                                            <span className="relative z-10 flex items-center gap-1">
                                              <span className="text-lg">+</span>
                                              Aggiungi
                                            </span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* Strategies List */}
                                      <div className="p-5 space-y-3">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-1 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                                          <h5 className="text-gray-800 font-semibold text-sm">Azioni Strategiche Suggerite</h5>
                                        </div>
                                        
                                        {strategies.length === 0 && (
                                          <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                                            <div className="text-gray-400 text-3xl mb-2">📝</div>
                                            <p className="text-gray-500 text-sm">Nessuna strategia suggerita</p>
                                            <p className="text-gray-400 text-xs mt-1">Clicca "+ Aggiungi" per crearne una</p>
                                          </div>
                                        )}
                                        
                                        {strategies.map((strategy, idx) => (
                                          <div key={`${idx}-${String(strategy).slice(0, 24)}`} className="group/item relative">
                                            <div className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-3 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
                                              <div className="mt-2 flex-shrink-0">
                                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-sm">
                                                  <span className="text-white text-xs font-bold">{idx + 1}</span>
                                                </div>
                                              </div>
                                              <input
                                                type="text"
                                                value={strategy}
                                                onChange={(e) => updateStrategy(globalIndex, deptId, idx, e.target.value)}
                                                className="flex-1 px-3 py-2 bg-transparent text-gray-800 text-sm outline-none placeholder-gray-400"
                                                placeholder="Descrivi l'azione strategica da implementare..."
                                              />
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  // @ts-ignore
                                                  if (e?.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
                                                  removeStrategy(globalIndex, deptId, idx);
                                                }}
                                                className="opacity-0 group-hover/item:opacity-100 flex-shrink-0 w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                                                title="Rimuovi"
                                              >
                                                <span className="text-lg">×</span>
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Approve and Send Button - Professional */}
                                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border-2 border-blue-200 p-6 mt-4">
                                  {/* Animated background */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                                  
                                  <div className="relative flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg">
                                        <span className="text-2xl">{approvedArticles.has(globalIndex) ? '✓' : '📤'}</span>
                                      </div>
                                      <div className="flex-1">
                                        <h5 className="text-gray-900 font-bold text-base mb-1">
                                          {approvedArticles.has(globalIndex) ? 'Inviato con Successo!' : 'Pronto per l\'Invio?'}
                                        </h5>
                                        <p className="text-gray-700 text-sm flex items-center gap-2">
                                          {approvedArticles.has(globalIndex) ? (
                                            <>
                                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                              Articolo già distribuito ai dipartimenti
                                            </>
                                          ) : (
                                            <>
                                              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                              Invia a {item.relevant_departments.length} {item.relevant_departments.length === 1 ? 'dipartimento' : 'dipartimenti'}
                                            </>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <button
                                      onClick={() => approveAndSend(globalIndex, item)}
                                      disabled={approvedArticles.has(globalIndex)}
                                      className={`group/send relative overflow-hidden px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 shadow-lg ${
                                        approvedArticles.has(globalIndex)
                                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                          : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:shadow-2xl hover:scale-105'
                                      }`}
                                    >
                                      <span className="relative z-10 flex items-center gap-2">
                                        {approvedArticles.has(globalIndex) ? (
                                          <>
                                            <span className="text-xl">✓</span>
                                            Inviato
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xl group-hover/send:animate-bounce">🚀</span>
                                            Approva & Invia
                                          </>
                                        )}
                                      </span>
                                      {!approvedArticles.has(globalIndex) && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/send:translate-x-full transition-transform duration-700"></div>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expand/Collapse Button - Professional */}
                        {(item.article_summary || (item.key_data && Object.keys(item.key_data).length > 0)) && (
                          <button
                            onClick={() => toggleExpand(globalIndex)}
                            className="w-full mt-3 py-3 px-5 bg-slate-700 hover:bg-slate-800 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-md border border-slate-600 font-semibold"
                          >
                            <span className="text-sm">{isExpanded ? '▲' : '▼'}</span>
                            <span className="text-sm">{isExpanded ? 'Hide Details' : 'Show Full Analysis'}</span>
                          </button>
                        )}
                      </article>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          {/* Proposals Received Section */}
          {proposals.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center shadow-md"><span className="text-xl">📬</span></div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Proposte ricevute</h3>
                    <p className="text-slate-600 text-sm font-medium">{proposals.length} caricamenti dai dipartimenti</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {proposals.slice(0, 20).map((p, i) => {
                  const dept = DEPARTMENTS.find(d => d.id === p.dept_id);
                  return (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dept?.color || 'from-slate-200 to-slate-300'} flex items-center justify-center`}>{dept?.icon || '🏢'}</div>
                          <div>
                            <div className="text-slate-900 font-semibold text-sm">{dept?.nameIT || p.dept_id}</div>
                            <a href={p.article_link} target="_blank" rel="noreferrer" className="text-slate-700 text-sm hover:text-indigo-700 line-clamp-1">{p.article_title}</a>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{new Date(p.uploaded_at).toLocaleString('it-IT')}</div>
                      </div>
                      <div className="mt-2 text-sm text-slate-800"><strong>Azione {p.action_idx + 1}:</strong> {p.action_text}</div>
                      <div className="mt-2 text-xs text-slate-600">File: {p.file_name}</div>
                      {p.analysis && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white border border-slate-200 rounded-md p-3 col-span-1 md:col-span-3">
                            <div className="text-slate-800 text-sm font-semibold mb-1">AI Screening</div>
                            {p.analysis.summary && <div className="text-slate-700 text-sm">{p.analysis.summary}</div>}
                          </div>
                          {Array.isArray(p.analysis.strengths) && p.analysis.strengths.length > 0 && (
                            <div className="bg-white border border-emerald-200 rounded-md p-3">
                              <div className="text-emerald-700 text-xs font-bold mb-1">Punti di forza</div>
                              <ul className="list-disc pl-4 text-xs space-y-0.5">{p.analysis.strengths.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
                            </div>
                          )}
                          {Array.isArray(p.analysis.gaps) && p.analysis.gaps.length > 0 && (
                            <div className="bg-white border border-amber-200 rounded-md p-3">
                              <div className="text-amber-700 text-xs font-bold mb-1">Gap</div>
                              <ul className="list-disc pl-4 text-xs space-y-0.5">{p.analysis.gaps.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
                            </div>
                          )}
                          {Array.isArray(p.analysis.recommended_adjustments) && p.analysis.recommended_adjustments.length > 0 && (
                            <div className="bg-white border border-purple-200 rounded-md p-3">
                              <div className="text-purple-700 text-xs font-bold mb-1">Aggiustamenti consigliati</div>
                              <ul className="list-disc pl-4 text-xs space-y-0.5">{p.analysis.recommended_adjustments.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
                            </div>
                          )}
                          {Array.isArray(p.analysis.feasibility) && p.analysis.feasibility.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-md p-3">
                              <div className="text-slate-700 text-xs font-bold mb-1">Fattibilità</div>
                              <ul className="list-disc pl-4 text-xs space-y-0.5">{p.analysis.feasibility.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
                            </div>
                          )}
                          {Array.isArray(p.analysis.next_steps) && p.analysis.next_steps.length > 0 && (
                            <div className="bg-white border border-blue-200 rounded-md p-3">
                              <div className="text-blue-700 text-xs font-bold mb-1">Next steps</div>
                              <ul className="list-disc pl-4 text-xs space-y-0.5">{p.analysis.next_steps.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <div className="inline-flex items-center gap-6 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              Board Intelligence
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
              Strategic Monitoring
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Executive Dashboard
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
