import axios from 'axios';

// Free news APIs
const NEWS_API_KEY = process.env.NEWS_API_KEY || 'demo'; // Fallback for testing
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY || 'demo';
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || 'demo';

export async function POST(req: Request) {
  try {
    const { filters } = await req.json();
    // filters: { categories: string[], regions: string[], searchTerm: string, dateRange: string }

    // Build search queries based on filters
    const searchQueries = buildSearchQueries(filters);
    
    // Calculate date filter
    const dateFilter = calculateDateFilter(filters.dateRange || 'week');
    console.log(`📅 Date filter applied: ${filters.dateRange || 'week'} (from: ${dateFilter || 'no limit'})`);
    
    // Search news from multiple sources
    const newsResults = await Promise.allSettled([
      searchNewsAPI(searchQueries, dateFilter),
      searchGuardianAPI(searchQueries, dateFilter),
      searchNewsDataAPI(searchQueries, dateFilter)
    ]);

    // Combine and deduplicate results
    const allArticles: any[] = [];
    newsResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        allArticles.push(...result.value);
      }
    });

    // Deduplicate by URL
    const uniqueArticles = deduplicateArticles(allArticles);

    // Filter by date (client-side validation)
    const dateFilteredArticles = filterByDate(uniqueArticles, filters.dateRange || 'week');
    console.log(`📊 Articles after date filter: ${dateFilteredArticles.length} (from ${uniqueArticles.length} total)`);

    // Filter for Andriani relevance
    const relevantArticles = filterForAndriani(dateFilteredArticles, filters);

    // Se non ci sono articoli, restituisci un messaggio di errore
    if (relevantArticles.length === 0) {
      return Response.json({ 
        error: 'Nessuna notizia trovata. Configura le chiavi API per ottenere notizie reali.',
        articles: [],
        total: 0,
        sources: [],
        message: 'Per ottenere notizie reali, configura le seguenti chiavi API nel file .env.local: NEWS_API_KEY, GUARDIAN_API_KEY, NEWSDATA_API_KEY'
      });
    }

    return Response.json({ 
      articles: relevantArticles,
      total: relevantArticles.length,
      sources: ['NewsAPI', 'Guardian', 'NewsData'].filter(source => {
        // Mostra solo le fonti che hanno effettivamente restituito articoli
        return newsResults.some(result => result.status === 'fulfilled' && result.value && result.value.length > 0);
      })
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return Response.json({ 
      error: error.message,
      articles: [],
      total: 0
    }, { status: 500 });
  }
}

function buildSearchQueries(filters: any) {
  const queries = [];
  
  // Se non ci sono filtri, usa query generiche più specifiche
  if (!filters || (!filters.categories?.length && !filters.regions?.length && !filters.searchTerm)) {
    return [
      'food industry', 'agriculture news', 'sustainable packaging', 
      'food manufacturing', 'agri-food business'
    ];
  }

  // Crea query specifiche basate sui filtri selezionati
  const categoryQueries: string[] = [];
  const regionQueries: string[] = [];
  
  // Query per categorie selezionate
  if (filters.categories?.length) {
    filters.categories.forEach((category: string) => {
      switch (category) {
        case 'packaging':
          categoryQueries.push('sustainable packaging regulations 2024');
          categoryQueries.push('biodegradable packaging food industry');
          categoryQueries.push('circular economy packaging solutions');
          break;
        case 'supply-chain':
          categoryQueries.push('food supply chain disruption 2024');
          categoryQueries.push('logistics food industry digital transformation');
          categoryQueries.push('supply chain resilience food sector');
          break;
        case 'regulations':
          categoryQueries.push('food regulations 2024 compliance');
          categoryQueries.push('food safety regulations new requirements');
          categoryQueries.push('sustainability regulations food industry');
          break;
        case 'competitors':
          categoryQueries.push('Barilla De Cecco Garofalo pasta market');
          categoryQueries.push('pasta industry competition analysis 2024');
          categoryQueries.push('Italian pasta brands international expansion');
          break;
        case 'innovation':
          categoryQueries.push('food technology innovation 2024');
          categoryQueries.push('agri-food tech startups investment');
          categoryQueries.push('artificial intelligence food industry');
          break;
        case 'sustainability':
          categoryQueries.push('sustainable food production ESG');
          categoryQueries.push('carbon footprint food industry reduction');
          categoryQueries.push('renewable energy food manufacturing');
          break;
      }
    });
  }
  
  // Query per regioni selezionate
  if (filters.regions?.length) {
    filters.regions.forEach((region: string) => {
      switch (region) {
        case 'italy':
          regionQueries.push('Italy food industry 2024');
          regionQueries.push('Italian pasta rice export market');
          regionQueries.push('Made in Italy food sustainability');
          break;
        case 'eu':
          regionQueries.push('EU food regulations 2024');
          regionQueries.push('European food market digital transformation');
          regionQueries.push('EU Green Deal food industry impact');
          break;
        case 'usa':
          regionQueries.push('US food industry innovation trends');
          regionQueries.push('American pasta market growth 2024');
          regionQueries.push('US food safety regulations updates');
          break;
        case 'canada':
          regionQueries.push('Canada food market sustainability');
          regionQueries.push('Canadian food industry innovation');
          regionQueries.push('Canada food regulations 2024');
          break;
      }
    });
  }
  
  // COMBINAZIONE INTELLIGENTE: searchTerm + categorie + regioni
  if (filters.searchTerm) {
    // Se c'è un searchTerm, combinalo con i filtri selezionati
    const baseSearchTerm = filters.searchTerm.trim();
    
    if (categoryQueries.length > 0 && regionQueries.length > 0) {
      // searchTerm + categoria + regione
      categoryQueries.forEach(catQuery => {
        regionQueries.forEach(regQuery => {
          queries.push(`${baseSearchTerm} ${catQuery} ${regQuery}`);
        });
      });
    } else if (categoryQueries.length > 0) {
      // searchTerm + categoria
      categoryQueries.forEach(catQuery => {
        queries.push(`${baseSearchTerm} ${catQuery}`);
      });
    } else if (regionQueries.length > 0) {
      // searchTerm + regione
      regionQueries.forEach(regQuery => {
        queries.push(`${baseSearchTerm} ${regQuery}`);
      });
    } else {
      // Solo searchTerm (senza filtri categoria/regione)
      queries.push(baseSearchTerm);
    }
  } else {
    // Nessun searchTerm, usa solo filtri categoria/regione
  if (categoryQueries.length > 0 && regionQueries.length > 0) {
    // Se ci sono sia categorie che regioni, combina le query
    categoryQueries.forEach(catQuery => {
      regionQueries.forEach(regQuery => {
        queries.push(`${catQuery} ${regQuery}`);
      });
    });
  } else if (categoryQueries.length > 0) {
    // Solo categorie
    queries.push(...categoryQueries);
  } else if (regionQueries.length > 0) {
    // Solo regioni
    queries.push(...regionQueries);
  }
  }

  // Se non ci sono query, usa termini generici
  if (queries.length === 0) {
    queries.push('pasta industry 2024', 'rice market 2024', 'sustainable packaging 2024');
  }

  return queries;
}

function calculateDateFilter(dateRange: string): string | null {
  const now = new Date();
  let targetDate: Date | null = null;

  switch (dateRange) {
    case 'today':
      targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      break;
    case 'week':
      targetDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
    case 'month':
      targetDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      break;
    case '3months':
      targetDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      break;
    case 'all':
      return null; // No date filter
    default:
      targetDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days
  }

  // Format as ISO date string (YYYY-MM-DD)
  return targetDate ? targetDate.toISOString().split('T')[0] : null;
}

async function searchNewsAPI(queries: string[], dateFilter: string | null) {
  try {
    if (NEWS_API_KEY === 'demo' || !NEWS_API_KEY) {
      console.log('NewsAPI: Chiave API non configurata, saltando...');
      return [];
    }

    const results = [];
    for (const query of queries.slice(0, 3)) { // Increased to 3 queries for better balance
      const params: any = {
          q: query,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 5,
          apiKey: NEWS_API_KEY
      };
      
      // Add date filter only if specified and not 'all'
      if (dateFilter) {
        params.from = dateFilter;
        }
      
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params
      });
      
      if (response.data.articles) {
        results.push(...response.data.articles.map((article: any) => ({
          title: article.title,
          source: article.source.name,
          url: article.url,
          publishedAt: article.publishedAt,
          description: article.description
        })));
      }
    }
    
    return results;
  } catch (error) {
    console.error('NewsAPI error:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function searchGuardianAPI(queries: string[], dateFilter: string | null) {
  try {
    if (GUARDIAN_API_KEY === 'demo' || !GUARDIAN_API_KEY) {
      console.log('Guardian API: Chiave API non configurata, saltando...');
      return [];
    }

    const results = [];
    for (const query of queries.slice(0, 2)) { // Keep Guardian at 2 queries to balance
      const params: any = {
        q: query,
        'api-key': GUARDIAN_API_KEY,
        'show-fields': 'headline,trailText,shortUrl',
        'page-size': 5
      };
      
      // Add date filter only if specified and not 'all'
      if (dateFilter) {
        params['from-date'] = dateFilter;
      }
      
      const response = await axios.get('https://content.guardianapis.com/search', {
        params
      });
      
      if (response.data.response?.results) {
        results.push(...response.data.response.results.slice(0, 3).map((article: any) => ({
          title: article.webTitle,
          source: 'The Guardian',
          url: article.webUrl,
          publishedAt: article.webPublicationDate,
          description: article.fields?.trailText || ''
        })));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Guardian API error:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function searchNewsDataAPI(queries: string[], dateFilter: string | null) {
  try {
    if (NEWSDATA_API_KEY === 'demo' || !NEWSDATA_API_KEY) {
      console.log('NewsData API: Chiave API non configurata, saltando...');
      return [];
    }

    const results = [];
    for (const query of queries.slice(0, 1)) { // Limit to 1 query to save quota
      const params: any = {
        apikey: NEWSDATA_API_KEY,
        q: query
        // Removed page_size parameter as it causes 422 error
      };
      
      // NewsData uses 'from_date' parameter (but we'll skip it to avoid 422 errors)
      // The free tier may not support date filtering
      
      const response = await axios.get('https://newsdata.io/api/1/news', {
        params
      });
      
      if (response.data.results) {
        results.push(...response.data.results.slice(0, 5).map((article: any) => ({
          title: article.title,
          source: article.source_name || 'NewsData',
          url: article.link,
          publishedAt: article.pubDate,
          description: article.description || ''
        })));
      }
    }
    
    return results;
  } catch (error) {
    console.error('NewsData API error:', error instanceof Error ? error.message : error);
    return [];
  }
}

function deduplicateArticles(articles: any[]) {
  const seen = new Set();
  return articles.filter(article => {
    const key = article.url || article.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterByDate(articles: any[], dateRange: string): any[] {
  if (dateRange === 'all') {
    return articles; // No date filtering
  }

  const now = new Date();
  let cutoffDate: Date;

  switch (dateRange) {
    case 'today':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      break;
    case 'week':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      break;
    case 'month':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      break;
    case '3months':
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      break;
    default:
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days
  }

  return articles.filter(article => {
    if (!article.publishedAt) return true; // Include if no date
    const publishDate = new Date(article.publishedAt);
    return publishDate >= cutoffDate;
  });
}

function filterForAndriani(articles: any[], filters: any) {
  console.log(`🔍 Filtering ${articles.length} articles with filters:`, {
    categories: filters.categories,
    regions: filters.regions,
    searchTerm: filters.searchTerm
  });

  let rejectedBySearchTerm = 0;
  let rejectedByCategory = 0;
  let rejectedByRegion = 0;
  let rejectedByRelevance = 0;

  // LOGICA BILANCIATA:
  // - SEMPRE: Rilevanza Andriani (food industry, pasta, rice, agri-food, etc.)
  // - Se c'è searchTerm → DEVE essere presente (AND rigoroso)
  // - Categoria e Regione → OR flessibile (almeno uno dei due, o entrambi)
  const filtered = articles.filter(article => {
    const text = `${article.title} ${article.description}`.toLowerCase();
    
    // 0. VERIFICA RILEVANZA ANDRIANI - SEMPRE OBBLIGATORIA
    // Andriani: pasta, riso, legumi, food industry, agricoltura, sostenibilità alimentare
    const andrianiKeywords = [
      // Core business
      'pasta', 'rice', 'riso', 'legum', 'lentil', 'chickpea', 'bean', 'pea',
      // Food industry
      'food', 'aliment', 'agri-food', 'agrifood', 'cereal', 'grain', 'wheat', 'flour', 'semola',
      // Agriculture & farming
      'agricult', 'farm', 'crop', 'harvest', 'cultivation',
      // Food manufacturing & processing
      'food industry', 'food manufacturer', 'food production', 'food processing', 'food plant',
      // Packaging (relevant to food)
      'food packaging', 'sustainable packaging', 'biodegradable packaging',
      // Market & competitors
      'barilla', 'de cecco', 'garofalo', 'pasta brand', 'pasta market', 'pasta industry',
      // Regulations (food-specific)
      'food regulation', 'food safety', 'food law', 'food standard', 'food compliance',
      // Sustainability (food-specific)
      'sustainable food', 'food sustainability', 'organic food', 'natural food',
      // Trade & export
      'food export', 'food trade', 'food import',
      // Innovation (food-specific)
      'food tech', 'food innovation', 'agtech', 'agritech',
      // Nutrition
      'protein', 'nutrition', 'healthy food', 'plant-based',
      // Supply chain (food-specific)
      'food supply', 'food chain', 'food logistics'
    ];
    
    const hasAndrianiRelevance = andrianiKeywords.some(keyword => text.includes(keyword.toLowerCase()));
    if (!hasAndrianiRelevance) {
      console.log(`❌ Rejected (NO ANDRIANI RELEVANCE): "${article.title.substring(0, 50)}..."`);
      rejectedByRelevance++;
      return false;
    }
    
    // 1. VERIFICA SEARCHTERM (se presente, DEVE essere presente nell'articolo)
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchKeywords = filters.searchTerm.trim().toLowerCase().split(/\s+/);
      // Almeno UNA parola del searchTerm deve essere presente
      const hasSearchTerm = searchKeywords.some((keyword: string) => text.includes(keyword));
      if (!hasSearchTerm) {
        console.log(`❌ Article rejected (missing searchTerm): "${article.title.substring(0, 50)}..."`);
        rejectedBySearchTerm++;
        return false;
      }
    }
    
    // 2-3. VERIFICA CATEGORIA E REGIONE CON LOGICA FLESSIBILE
    // Se searchTerm presente → AND rigoroso (cat E region devono matchare se selezionati)
    // Se NO searchTerm → OR flessibile (cat O region, basta uno dei due)
    
    const hasCategoryFilter = filters.categories && filters.categories.length > 0;
    const hasRegionFilter = filters.regions && filters.regions.length > 0;
    const hasSearchTerm = filters.searchTerm && filters.searchTerm.trim();
    
    if (hasCategoryFilter || hasRegionFilter) {
      const categoryKeywords: { [key: string]: string[] } = {
        'packaging': ['pack', 'packaging', 'container', 'bottle', 'wrap', 'box', 'bag', 'plastic', 'recyclable', 'sustainable', 'biodegradable', 'eco-friendly', 'material'],
        'supply-chain': ['supply', 'chain', 'logistics', 'distribution', 'transport', 'delivery', 'warehouse', 'procurement', 'sourcing', 'freight', 'shipping', 'supplier'],
        'regulations': ['regulation', 'regulatory', 'compliance', 'law', 'policy', 'legislation', 'rule', 'standard', 'directive', 'mandate', 'legal', 'government', 'authority', 'requirement'],
        'competitors': ['barilla', 'de cecco', 'garofalo', 'competitor', 'competition', 'market', 'industry', 'sector', 'brand', 'company', 'business', 'rival', 'player', 'leader'],
        'innovation': ['innovation', 'technology', 'tech', 'digital', 'ai', 'artificial intelligence', 'automation', 'startup', 'research', 'development', 'new', 'advanced', 'breakthrough', 'patent', 'invention'],
        'sustainability': ['sustainab', 'esg', 'green', 'eco', 'environment', 'climate', 'carbon', 'renewable', 'energy', 'organic', 'natural', 'circular', 'emission', 'footprint']
      };
      
      const regionKeywords: { [key: string]: string[] } = {
        'italy': ['italy', 'italian', 'italia', 'rome', 'milan', 'turin', 'venice', 'florence', 'naples', 'bologna', 'sicily', 'piedmont', 'tuscany', 'lombardy', 'genoa', 'verona'],
        'eu': ['eu ', 'europe', 'european', 'brussels', 'germany', 'german', 'france', 'french', 'spain', 'spanish', 'netherlands', 'dutch', 'belgium', 'austria', 'portugal', 'greece', 'poland', 'polish', 'sweden', 'denmark', 'finland', 'ireland', 'czech', 'hungary', 'romania', 'uk', 'britain', 'british', 'england'],
        'usa': ['united states', 'america', 'american', 'u.s.', 'usa', 'washington', 'new york', 'california', 'texas', 'florida', 'chicago', 'boston', 'trump', 'biden', 'white house', 'pentagon', 'wall street', 'us market', 'us economy', 'us food'],
        'canada': ['canada', 'canadian', 'ottawa', 'toronto', 'quebec', 'montreal', 'vancouver', 'calgary', 'edmonton']
      };
      
      // Controlla categoria
      let categoryMatch = false;
      if (hasCategoryFilter) {
        for (const category of filters.categories) {
          const keywords = categoryKeywords[category] || [];
          if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
            categoryMatch = true;
            console.log(`✅ Category match: "${category}"`);
            break;
          }
        }
      }
      
      // Controlla regione
      let regionMatch = false;
      if (hasRegionFilter) {
        for (const region of filters.regions) {
          const keywords = regionKeywords[region] || [];
          for (const keyword of keywords) {
            if (text.includes(keyword.toLowerCase())) {
              regionMatch = true;
              console.log(`✅ Region match: "${keyword}"`);
              break;
            }
          }
          if (regionMatch) break;
        }
      }
      
      // LOGICA COMBINATA:
      if (hasSearchTerm) {
        // CON searchTerm → AND rigoroso
        if (hasCategoryFilter && !categoryMatch) {
          console.log(`❌ Rejected (no category match): "${article.title.substring(0, 50)}..."`);
          rejectedByCategory++;
          return false;
        }
        if (hasRegionFilter && !regionMatch) {
          console.log(`❌ Rejected (no region match): "${article.title.substring(0, 50)}..."`);
          rejectedByRegion++;
          return false;
        }
      } else {
        // SENZA searchTerm → OR flessibile (basta uno dei due)
        if (hasCategoryFilter && hasRegionFilter) {
          // Entrambi selezionati → almeno UNO deve matchare
          if (!categoryMatch && !regionMatch) {
            console.log(`❌ Rejected (no cat/region match): "${article.title.substring(0, 50)}..."`);
            rejectedByCategory++;
            rejectedByRegion++;
            return false;
          }
        } else if (hasCategoryFilter && !categoryMatch) {
          // Solo categoria → DEVE matchare
          console.log(`❌ Rejected (no category match): "${article.title.substring(0, 50)}..."`);
          rejectedByCategory++;
          return false;
        } else if (hasRegionFilter && !regionMatch) {
          // Solo regione → DEVE matchare
          console.log(`❌ Rejected (no region match): "${article.title.substring(0, 50)}..."`);
          rejectedByRegion++;
          return false;
        }
      }
    }
    
    console.log(`✅ Article ACCEPTED: "${article.title.substring(0, 60)}..."`);
    return true;
  });

  console.log(`📊 Filtering summary:
  - Total articles: ${articles.length}
  - Rejected by searchTerm: ${rejectedBySearchTerm}
  - Rejected by category: ${rejectedByCategory}
  - Rejected by region: ${rejectedByRegion}
  - Rejected by relevance: ${rejectedByRelevance}
  - ✅ Accepted: ${filtered.length}
  - Final (limited to 8): ${Math.min(filtered.length, 8)}`);

  return filtered.slice(0, 8); // Limit to 8 articles - guaranteed AI analysis for all
}
