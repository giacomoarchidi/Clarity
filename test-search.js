// Test della ricerca automatica di notizie
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testSearch() {
  console.log('🔍 Testando ricerca automatica di notizie...\n');

  const testFilters = {
    categories: ["packaging", "sustainability"],
    regions: ["italy", "eu"],
    searchTerm: "supply chain"
  };

  try {
    console.log('📤 Invio richiesta di ricerca...');
    const response = await fetch('http://localhost:3000/api/search-news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filters: testFilters })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Ricerca completata!');
    console.log(`📊 Articoli trovati: ${result.total}`);
    console.log(`📰 Fonti utilizzate: ${result.sources.join(', ')}`);
    
    if (result.articles && result.articles.length > 0) {
      console.log('\n📋 Primi articoli:');
      result.articles.slice(0, 3).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   📰 Fonte: ${article.source}`);
        console.log(`   🔗 URL: ${article.url}`);
        console.log(`   📅 Data: ${new Date(article.publishedAt).toLocaleDateString('it-IT')}`);
        if (article.description) {
          console.log(`   📝 Descrizione: ${article.description.substring(0, 100)}...`);
        }
      });
    }

    console.log('\n🎉 Test ricerca completato!');
    console.log('💡 Ora puoi testare l\'interfaccia con il pulsante "Cerca Notizie"');

  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.log('\n🔧 Controlla che:');
    console.log('1. Il server sia in esecuzione (npm run dev)');
    console.log('2. L\'endpoint /api/search-news sia disponibile');
  }
}

testSearch();
