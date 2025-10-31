# 💰 Monitoraggio Costi OpenAI GPT-3.5

## 📊 Calcoli di Costo

### **Modello: GPT-3.5-turbo**
- **Input**: $0.50 per 1M token
- **Output**: $1.50 per 1M token

### **Stima per Brief Andriani**
```
1 brief tipico:
- Input: ~1,500 token (titoli + istruzioni)
- Output: ~800 token (analisi + JSON)

Costo per brief: ~$0.0015 (0.15 centesimi)
```

### **Proiezioni Mensili**
| Brief al Giorno | Brief al Mese | Costo Mensile |
|-----------------|---------------|---------------|
| 10              | 300           | $0.45         |
| 50              | 1,500         | $2.25         |
| 100             | 3,000         | $4.50         |
| 200             | 6,000         | $9.00         |

## 🛡️ Controllo Costi

### **1. Limite di Spesa OpenAI**
- Vai su: https://platform.openai.com/account/billing
- Imposta limite: $10/mese (sicuro per 200+ brief/giorno)

### **2. Monitoraggio in Tempo Reale**
- Dashboard: https://platform.openai.com/usage
- Vedi token utilizzati e costi

### **3. Ottimizzazioni Implementate**
- ✅ `max_tokens: 2000` - Limita output
- ✅ Filtri intelligenti - Riduce input
- ✅ Pre-filtraggio - Analizza solo elementi rilevanti

## 🚀 Pronto per Produzione!

**Costo stimato**: $3-5/mese per uso normale
**Qualità**: Eccellente per brief esecutivi
**Velocità**: 2-3 secondi per brief
