// Configurazione Dipartimenti Andriani
// Ogni dipartimento ha competenze specifiche e riceve articoli rilevanti

export type DepartmentId = 
  | 'legal'
  | 'operations'
  | 'marketing'
  | 'rd'
  | 'sustainability'
  | 'finance'
  | 'supply-chain'
  | 'quality';

export interface Department {
  id: DepartmentId;
  name: string;
  nameIT: string;
  icon: string;
  color: string;
  description: string;
  keywords: string[]; // Keywords che triggerano questo dipartimento
  responsibilities: string[]; // Responsabilità del dipartimento
}

export const DEPARTMENTS: Department[] = [
  {
    id: 'legal',
    name: 'Legal & Compliance',
    nameIT: 'Legale e Conformità',
    icon: '⚖️',
    color: 'from-blue-500 to-indigo-600',
    description: 'Gestione normative, compliance, contratti e questioni legali',
    keywords: [
      'regulation', 'law', 'legal', 'compliance', 'directive', 'mandate',
      'lawsuit', 'court', 'legislation', 'policy', 'standard', 'certification',
      'patent', 'trademark', 'intellectual property', 'contract', 'tariff'
    ],
    responsibilities: [
      'Monitorare nuove normative EU e nazionali',
      'Gestire compliance food safety e labeling',
      'Proteggere proprietà intellettuale',
      'Gestire contratti commerciali internazionali'
    ]
  },
  {
    id: 'operations',
    name: 'Operations & Production',
    nameIT: 'Operazioni e Produzione',
    icon: '🏭',
    color: 'from-orange-500 to-red-600',
    description: 'Gestione impianti produttivi, efficienza operativa, automazione',
    keywords: [
      'production', 'manufacturing', 'plant', 'facility', 'automation',
      'efficiency', 'capacity', 'output', 'process', 'optimization',
      'machinery', 'equipment', 'productivity', 'operational'
    ],
    responsibilities: [
      'Ottimizzare processi produttivi',
      'Implementare nuove tecnologie',
      'Gestire capacity planning',
      'Migliorare efficienza operativa'
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing & Sales',
    nameIT: 'Marketing e Vendite',
    icon: '📢',
    color: 'from-pink-500 to-rose-600',
    description: 'Brand positioning, comunicazione, vendite, espansione mercato',
    keywords: [
      'marketing', 'brand', 'campaign', 'advertising', 'consumer',
      'market share', 'sales', 'distribution', 'retail', 'e-commerce',
      'promotion', 'positioning', 'customer', 'demand', 'trend'
    ],
    responsibilities: [
      'Sviluppare strategie di brand positioning',
      'Analizzare trend di mercato',
      'Espandere canali di distribuzione',
      'Gestire comunicazione e PR'
    ]
  },
  {
    id: 'rd',
    name: 'R&D & Innovation',
    nameIT: 'Ricerca e Sviluppo',
    icon: '🔬',
    color: 'from-purple-500 to-violet-600',
    description: 'Sviluppo nuovi prodotti, innovazione, ricerca scientifica',
    keywords: [
      'research', 'development', 'innovation', 'r&d', 'technology',
      'new product', 'formulation', 'ingredient', 'patent', 'breakthrough',
      'scientific', 'study', 'experiment', 'protein', 'nutrition'
    ],
    responsibilities: [
      'Sviluppare nuovi prodotti plant-based',
      'Innovare formule e ingredienti',
      'Collaborare con università e centri ricerca',
      'Brevettare innovazioni'
    ]
  },
  {
    id: 'sustainability',
    name: 'Sustainability & ESG',
    nameIT: 'Sostenibilità e ESG',
    icon: '🌱',
    color: 'from-green-500 to-emerald-600',
    description: 'Sostenibilità ambientale, economia circolare, ESG reporting',
    keywords: [
      'sustainability', 'sustainable', 'esg', 'environment', 'climate',
      'carbon', 'emission', 'renewable', 'circular economy', 'green',
      'eco-friendly', 'biodegradable', 'recycling', 'waste', 'energy'
    ],
    responsibilities: [
      'Ridurre carbon footprint',
      'Implementare economia circolare',
      'Gestire ESG reporting',
      'Sviluppare packaging sostenibile'
    ]
  },
  {
    id: 'finance',
    name: 'Finance & Strategy',
    nameIT: 'Finanza e Strategia',
    icon: '💰',
    color: 'from-yellow-500 to-amber-600',
    description: 'Pianificazione finanziaria, investimenti, M&A, strategia aziendale',
    keywords: [
      'finance', 'investment', 'acquisition', 'merger', 'funding',
      'revenue', 'profit', 'cost', 'pricing', 'budget', 'financial',
      'valuation', 'stock', 'dividend', 'earnings', 'growth'
    ],
    responsibilities: [
      'Pianificare investimenti strategici',
      'Valutare opportunità M&A',
      'Ottimizzare struttura costi',
      'Gestire relazioni investitori'
    ]
  },
  {
    id: 'supply-chain',
    name: 'Supply Chain & Logistics',
    nameIT: 'Supply Chain e Logistica',
    icon: '🚛',
    color: 'from-cyan-500 to-blue-600',
    description: 'Gestione fornitori, logistica, procurement, distribuzione',
    keywords: [
      'supply chain', 'logistics', 'supplier', 'procurement', 'sourcing',
      'distribution', 'warehouse', 'transportation', 'delivery', 'freight',
      'inventory', 'stock', 'import', 'export', 'shipping'
    ],
    responsibilities: [
      'Ottimizzare supply chain',
      'Gestire fornitori strategici',
      'Migliorare efficienza logistica',
      'Gestire rischi di approvvigionamento'
    ]
  },
  {
    id: 'quality',
    name: 'Quality & Food Safety',
    nameIT: 'Qualità e Sicurezza Alimentare',
    icon: '🛡️',
    color: 'from-red-500 to-rose-600',
    description: 'Controllo qualità, food safety, certificazioni, standard',
    keywords: [
      'quality', 'food safety', 'safety', 'hygiene', 'contamination',
      'recall', 'certification', 'haccp', 'iso', 'brc', 'ifs',
      'testing', 'inspection', 'traceability', 'audit'
    ],
    responsibilities: [
      'Garantire food safety',
      'Gestire certificazioni (BRC, IFS, etc.)',
      'Implementare sistemi tracciabilità',
      'Gestire non-conformità e recall'
    ]
  }
];

// Helper function per trovare dipartimenti rilevanti per un articolo
export function getRelevantDepartments(text: string): DepartmentId[] {
  const lowerText = text.toLowerCase();
  const relevant: DepartmentId[] = [];

  for (const dept of DEPARTMENTS) {
    const hasMatch = dept.keywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    if (hasMatch) {
      relevant.push(dept.id);
    }
  }

  return relevant.length > 0 ? relevant : ['operations']; // Default a operations se nessun match
}

// Helper per ottenere info dipartimento
export function getDepartment(id: DepartmentId): Department | undefined {
  return DEPARTMENTS.find(d => d.id === id);
}

