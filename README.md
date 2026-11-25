# file-scan

Glissez une facture, un CV, un ticket de caisse ou n'importe quel document, et récupérez son contenu en JSON propre.
Tout se passe dans votre navigateur : pas de serveur, pas de compte, rien n'est stocké chez moi.

## Comment ça marche

1. **L'OCR lit le document.** Par défaut avec Tesseract.js, en local : votre fichier ne sort pas du navigateur.
   Vous pouvez aussi passer par OCR.space (gratuit avec une clé, mais le fichier leur est envoyé).
2. **Un LLM le met en forme** (optionnel). Branchez OpenRouter, OpenAI ou Anthropic avec votre propre clé,
   et le texte brut devient un JSON structuré : type de document, résumé, champs, tableaux, avertissements.

Sans LLM, vous obtenez simplement le texte OCR page par page.

```json
{
  "document_type": "facture",
  "summary": "Facture de réparation vélo",
  "fields": { "numero_facture": "F-2026-0142", "total_ttc": 74.4 },
  "tables": [{ "name": "lignes", "columns": ["description", "quantite"], "rows": [["Réparation vélo", 1]] }],
  "confidence": "high",
  "warnings": []
}
```

Le modèle n'invente rien : une valeur absente vaut `null`, et les passages douteux sont signalés dans `warnings`.

## Lancer le projet

```bash
npm install
npm run dev   # http://localhost:5173
```

## Vos clés

Elles restent dans votre navigateur (`localStorage`, ou `sessionStorage` si vous cochez « Ne pas mémoriser »)
et ne partent que vers le fournisseur concerné. Un bouton permet de tout effacer.
Seule précaution : n'hébergez pas l'appli à côté de scripts tiers que vous ne maîtrisez pas.

## Et après ?

Prochaine étape envisagée : un mode vision, où l'image est envoyée directement au LLM sans passer par l'OCR.
