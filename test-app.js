// Test completo dell'applicazione Andriani Intelligence
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testApp() {
  console.log('🧪 Testando Andriani Intelligence...\n');

  // Dati di test
  const testData = {
    items: [
      {
        title: "Nuove normative UE su packaging sostenibile entrano in vigore",
        source: "Il Sole 24 Ore",
        link: "https://www.ilsole24ore.com/packaging-ue"
      },
      {
        title: "Barilla lancia nuova linea pasta biologica in Canada",
        source: "Food Navigator",
        link: "https://www.foodnavigator.com/barilla-canada"
      },
      {
        title: "Prezzi grano in aumento del 15% in Italia",
        source: "Milano Finanza",
        link: "https://www.milanofinanza.com/grano-prezzi"
      },
      {
        title: "Tecnologia blockchain per tracciabilità supply chain",
        source: "AgriFood Tech",
        link: "https://www.agrifoodtech.com/blockchain"
      }
    ],
    filters: {
      categories: ["packaging", "sustainability"],
      regions: ["italy", "eu"],
      searchTerm: ""
    }
  };

  try {
    console.log('📤 Invio richiesta all\'API...');
    const response = await fetch('http://localhost:3000/api/brief', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ API risponde correttamente!');
    console.log(`📊 Elementi ricevuti: ${result.items?.length || 0}`);
    
    if (result.items && result.items.length > 0) {
      console.log('\n📋 Primo elemento:');
      console.log(`- Titolo: ${result.items[0].title}`);
      console.log(`- Fonte: ${result.items[0].source}`);
      console.log(`- Tema: ${result.items[0].theme}`);
      console.log(`- Regione: ${result.items[0].region}`);
      console.log(`- Categoria: ${result.items[0].category}`);
      console.log(`- Perché importa: ${result.items[0].why_it_matters}`);
    }

    console.log('\n🎉 Test completato con successo!');
    console.log('💡 Ora puoi aprire http://localhost:3000 per testare l\'interfaccia');

  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.log('\n🔧 Controlla che:');
    console.log('1. Il server sia in esecuzione (npm run dev)');
    console.log('2. L\'API key sia configurata correttamente');
    console.log('3. Ci sia credito sufficiente su OpenAI');
  }
}

testApp();
