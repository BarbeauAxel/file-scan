/**
 * Paires document → JSON jouées en boucle par le fond animé.
 *
 * Pour en ajouter une : copiez un bloc, dessinez le document en ASCII et écrivez
 * le JSON correspondant. Règles :
 *  - une grille fixe : 1 caractère = 1 case, les espaces sont transparents ;
 *  - n'importe quel caractère Unicode est permis (┌─┐│└┘, ▬, ║…), il est centré dans sa case ;
 *  - gardez chaque bloc sous ~40 colonnes × ~20 lignes pour qu'il tienne sur mobile.
 * La première et la dernière ligne vides des chaînes sont ignorées.
 */

export interface DocTemplate {
  /** Nom lisible (débogage uniquement). */
  name: string
  /** Silhouette du document, en ASCII. */
  doc: string
  /** JSON produit à partir du document (les clés sont colorées en violet vif). */
  json: string
}

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    name: 'facture',
    doc: String.raw`
┌────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬            FACTURE   │
│ ▬▬▬▬▬ ▬▬▬▬▬           N° 0118  │
│ ▬▬▬▬▬▬▬ ▬▬▬                    │
│                                │
│ CLIENT  ▬▬▬▬▬▬ ▬▬▬▬▬▬▬         │
│ DATE    17/11/2026             │
│                                │
│ ┌──────────────┬────┬────────┐ │
│ │ DÉSIGNATION  │ QT │   PRIX │ │
│ ├──────────────┼────┼────────┤ │
│ │ ▬▬▬▬▬▬ ▬▬▬▬  │  2 │ 400.00 │ │
│ │ ▬▬▬▬▬▬▬▬     │  1 │ 350.00 │ │
│ │ ▬▬▬▬ ▬▬▬▬▬   │  4 │ 100.00 │ │
│ └──────────────┴────┴────────┘ │
│                                │
│             TOTAL   1250.00 €  │
└────────────────────────────────┘
`,
    json: String.raw`
{
  "type": "facture",
  "numero": "0118",
  "date": "2026-11-17",
  "client": "…",
  "lignes": [
    { "qte": 2, "prix": 400.00 },
    { "qte": 1, "prix": 350.00 },
    { "qte": 4, "prix": 100.00 }
  ],
  "total": 1250.00
}
`,
  },
  {
    name: "carte d'identité",
    doc: String.raw`
┌──────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬     CARTE ID    │
├──────────┬───────────────────────┤
│  .----.  │ NOM     ▬▬▬▬▬▬▬       │
│ ( o  o ) │ PRÉNOM  ▬▬▬▬▬         │
│  \ -- /  │ NÉ LE   04/03/1998    │
│  /'--'\  │ SEXE    F             │
│ /      \ │ N°      X4RT 92KL 07  │
├──────────┴───────────────────────┤
│ IDFRA<<▬▬▬▬▬▬▬<<<<<<<<<<<<<<<<<< │
│ X4RT92KL07<<9803041F<<<<<<<<<<<< │
└──────────────────────────────────┘
`,
    json: String.raw`
{
  "type": "carte_identite",
  "nom": "…",
  "prenom": "…",
  "naissance": "1998-03-04",
  "sexe": "F",
  "numero": "X4RT92KL07",
  "mrz_valide": true
}
`,
  },
  {
    name: 'ticket de caisse',
    doc: String.raw`
┌──────────────────────┐
│   ▬▬▬▬ MARKET ▬▬▬▬   │
│   12 rue ▬▬▬▬▬▬▬▬    │
│ ···················· │
│ PAIN            1.20 │
│ LAIT x2         2.40 │
│ CAFÉ            4.95 │
│ POMMES 1kg      2.85 │
│ ···················· │
│ TOTAL          11.40 │
│ CB            ****42 │
│ 17/11/26       08:42 │
│                      │
│  ║│║║│║│║║│║│║║│║│║  │
└──────────────────────┘
`,
    json: String.raw`
{
  "type": "ticket_caisse",
  "magasin": "… market",
  "date": "2026-11-17T08:42",
  "articles": [
    ["pain", 1.20],
    ["lait", 2.40],
    ["cafe", 4.95],
    ["pommes", 2.85]
  ],
  "total": 11.40,
  "paiement": "carte"
}
`,
  },
]
