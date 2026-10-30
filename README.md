# Finding North

Portfolio van Hielke Gase voor de minor Next Gen Leadership (HRM-3, NHL Stenden), als website.

## De site opnieuw bouwen

1. Vervang `tekst.md` door je nieuwe versie (zelfde bestandsnaam).
2. Run in deze map:

   ```
   node build.js
   ```

3. Open `index.html` in je browser om te controleren, en zet het daarna weer op GitHub (commit en push).

`build.js` heeft alleen Node.js nodig, geen extra pakketten. Gaat er iets mis, bijvoorbeeld een foto die niet gevonden wordt, dan staat er na het bouwen een waarschuwing in de terminal.

## Wat waar staat

| Bestand | Wat het is |
| --- | --- |
| `tekst.md` | Alle tekst van de site |
| `fotos/` | De foto's |
| `build.js` | Zet `tekst.md` om naar de pagina's. Bovenin staan de instellingen (`SETTINGS`) |
| `index.html` | Startpagina: voorkant en How to read |
| `chapter-1.html` t/m `chapter-4.html` | Eén pagina per hoofdstuk |
| `references.html`, `appendices.html` | Bronnen en bijlagen |
| `assets/style.css` | Opmaak, kleuren en het lichte en donkere thema |
| `assets/site.js` | Themaschakelaar, navigatie en de fotoviewer |

Alle `.html`-bestanden worden gemaakt door `build.js`. Pas ze dus niet met de hand aan, want bij de volgende keer bouwen worden ze overschreven.

## Veelvoorkomende aanpassingen

- **De twee regels van Erin Hanson.** Vervang in `tekst.md` de tekst tussen haken `\[Paste the two lines ... (Hanson, n.d.).\]` door de twee regels tussen aanhalingstekens, gevolgd door `(Hanson, n.d.)`. Bouw opnieuw: het oranje vak verdwijnt en de regels staan als citaat op de site.
- **Een foto vervangen.** Zet de nieuwe foto in `fotos/` met precies dezelfde bestandsnaam en bouw opnieuw.
- **Een nieuwe foto.** Zet hem in `fotos/` en voeg in `build.js` bij `photos` een regel toe met de tekst na `image:` uit `tekst.md`, de bestandsnaam en een korte Engelse alt-tekst.
- **2.1 en 2.3.** Zodra `tekst.md` een kop `### 2.1 ...` of `### 2.3 ...` heeft, komt die tekst op de plek van het vak "To come".
- **Grote koppen en kompasrichtingen** staan in `build.js` bij `headings` en `chapterCompass`.
- **Tekst weglaten** zonder hem uit `tekst.md` te halen: in `build.js` bij `omit`. Zo zijn 1.2.5 en alles behalve de eerste alinea van Appendix B weggelaten.
