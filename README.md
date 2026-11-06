# file-scan

Déposez un document (facture, CV, formulaire, ticket, courrier…) et obtenez un JSON structuré.
Tout tourne dans le navigateur : pas de backend, pas de base de données.

**Pipeline**

1. **OCR** : Tesseract.js en local (par défaut), ou OCR.space avec votre clé gratuite.
   Les PDF sont rendus page par page via pdf.js avant l'OCR.
2. **LLM** (facultatif) : le texte OCR est envoyé au fournisseur de votre choix (OpenRouter, OpenAI ou Anthropic),
   qui le restructure en JSON. Vous utilisez vos propres crédits.

Sans LLM configuré, l'appli renvoie le JSON de l'OCR seul :

```json
{ "pages": [{ "page": 1, "text": "...", "confidence": 0.94 }] }
```

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm run lint
```

## Format de sortie

Avec un LLM, la sortie suit toujours la même enveloppe ; le contenu de `fields` dépend du document :

```json
{
  "document_type": "facture | cv | formulaire | ticket | courrier | autre",
  "language": "fr",
  "summary": "résumé en une phrase",
  "fields": { "numero_facture": "F-2026-0142", "vendeur": { "nom": "..." }, "total_ttc": 74.4 },
  "tables": [{ "name": "lignes", "columns": ["description", "quantite"], "rows": [["Réparation vélo", 1]] }],
  "confidence": "high | medium | low",
  "warnings": ["texte illisible, champs incertains, etc."]
}
```

Le LLM n'invente rien (`null` si une valeur manque), normalise les dates en ISO 8601 et les montants en nombres,
et signale les erreurs d'OCR probables dans `warnings`.

Les structured outputs stricts (OpenAI, Anthropic, OpenRouter) imposent `additionalProperties: false` sur tous les objets.
Le LLM renvoie donc `fields` sous forme de paires `[{ key, value }]`, que l'appli reconvertit en objet.
Une clé pointée (`vendeur.nom`) devient un objet imbriqué. La réponse est validée ; en cas de JSON invalide,
l'appli fait **une seule** nouvelle tentative en expliquant l'erreur au modèle.

## Fournisseurs

| Fournisseur | Connexion | Sortie JSON |
|---|---|---|
| OpenRouter | « Se connecter avec OpenRouter » (OAuth PKCE, sans client ID ni secret) ou clé manuelle | `json_schema` strict si le modèle le supporte, sinon mode JSON + validation |
| OpenAI | clé manuelle (SDK officiel, `dangerouslyAllowBrowser`) | `json_schema` strict |
| Anthropic | clé manuelle (SDK officiel, en-tête `anthropic-dangerous-direct-browser-access`) | `output_config.format` (json_schema) |

**Modèles** : la liste par défaut est dans [`src/config.ts`](src/config.ts). Elle a été vérifiée dans la documentation
des fournisseurs en novembre 2026 ; modifiez-la librement. L'interface permet aussi de saisir n'importe quel identifiant,
de charger les modèles de votre compte (OpenAI, Anthropic), et la liste OpenRouter est chargée automatiquement
(filtrée sur les modèles qui supportent la sortie JSON).

### Moteurs OCR

| Moteur | Coût | Confidentialité | Limites |
|---|---|---|---|
| Tesseract.js (par défaut) | gratuit, sans quota | le fichier ne quitte pas le navigateur (seuls le moteur et les données de langue sont téléchargés, puis mis en cache) | aucune |
| OCR.space | gratuit avec votre clé ([obtenir une clé](https://ocr.space/ocrapi/freekey)) | le fichier est envoyé à OCR.space | 25 000 requêtes/mois, 1 Mo par fichier (images compressées automatiquement), 3 pages max par PDF |

## Sécurité des clés

- Les clés sont stockées uniquement dans le navigateur : `localStorage` par défaut, ou `sessionStorage` si vous cochez
  « Ne pas mémoriser » (effacées à la fermeture de l'onglet).
- Elles ne sont jamais loguées ni affichées en clair, et ne sont envoyées qu'au fournisseur concerné.
- Un bouton « Effacer toutes les clés enregistrées » les supprime.
- Comme pour toute appli 100 % navigateur, une clé stockée est lisible par du JavaScript exécuté sur la même origine :
  n'hébergez pas l'appli à côté de scripts tiers non maîtrisés.

## Erreurs gérées

Clé invalide (401), crédits insuffisants (402), quota dépassé (429, avec délai `Retry-After` si fourni),
quota OCR.space, fichier trop lourd, PDF de plus de 3 pages avec OCR.space, PDF protégé ou corrompu, JSON invalide renvoyé
par le LLM, refus du modèle, réponse tronquée. Si la structuration échoue, le résultat de l'OCR est conservé et un bouton
permet de relancer uniquement l'étape LLM.

À noter : `api.openai.com` n'envoie pas d'en-tête CORS sur ses réponses 401. Dans un navigateur, une clé OpenAI invalide
apparaît donc comme une erreur réseau ; le message le précise.

## Architecture

```
src/
  ocr/          OcrEngine (types.ts), tesseract.ts, ocrspace.ts, pdf.ts
  llm/          LlmProvider (types.ts), openai.ts, anthropic.ts, openrouter.ts, prompt.ts, structure.ts, errors.ts
  auth/         openrouterOAuth.ts (PKCE)
  storage/      keys.ts (clés API), settings.ts (réglages non sensibles)
  components/   Dropzone, Settings, KeyField, ModelPicker, Results, JsonViewer, ProgressBar
  pipeline.ts   OCR puis LLM, avec repli sur l'OCR seul
  config.ts     modèles par défaut, langues, limites OCR.space
```

Les modules lourds (tesseract.js, pdf.js, SDK OpenAI et Anthropic) sont chargés à la demande.

Les abstractions `OcrEngine` et `LlmProvider` sont prévues pour la V2 : un mode vision (image envoyée directement au LLM)
peut s'ajouter comme nouveau moteur ou en enrichissant `CompletionRequest`, sans toucher au reste du pipeline.

## Hors périmètre V1

Mode vision, comptes utilisateurs, backend, historique.
