# Card dates and context

All 264 cards have a date caption and a short description in `src/context.js`. The caption appears on the card; inspecting a card shows the full description. The same public context accompanies the AI's permitted board, clues and hand. Descriptions are shared background information, not hints about the dealt secret.

## Reading the captions

- A person's unlabelled date range is a lifespan. Contemporary performers use **Born** and a birth year; this does not assert their present status.
- **c.** means approximate. **Trad.** identifies a traditional attribution rather than a securely documented date. BCE and CE distinguish dates around the beginning of the Common Era; unmarked later dates are CE.
- A caption beginning with **Reign** describes a ruler's reign, not their lifespan. Hypatia's `c. 350/370–415 CE` reflects disputed birth dates around 350–370, explained in her description. Newton's birth year uses the Gregorian calendar (1643 rather than the Julian 1642).
- City, country and region captions name a particular landmark, event or administrative milestone. They do not claim that the place, its inhabitants or its culture began that year. Modern political boundaries can also differ from earlier ones.
- Greek mythological figures are labelled as myths, without invented lifespans. Homer and Laozi have traditional dates with explicit uncertainty. A myth's setting and the date of its surviving written account are different things.
- Historic French region cards overlap present-day regions. A regional merger date belongs to the administrative area; it does not date the older regional culture.

The descriptions are brief editorial summaries written for play. Approximate ancient chronologies and conventional founding dates should not be read as more precise than the labels indicate.

## References for chronology and distinctions

These references support the nuanced dates and conventions used here; this is a selected bibliography, not an exhaustive source list for every sentence.

- [Stanford Encyclopedia of Philosophy: Laozi](https://plato.stanford.edu/entries/laozi/) explains the traditional sixth-century attribution and disputes about the sage and the Daodejing. [Zhuangzi](https://plato.stanford.edu/entries/zhuangzi/) discusses the tentative chronology of his life.
- [Internet Encyclopedia of Philosophy: Nāgārjuna](https://iep.utm.edu/nagarjun/) gives the approximate second- to third-century dating.
- [The Metropolitan Museum of Art: Hatshepsut](https://www.metmuseum.org/art/collection/search/544446) dates her reign approximately to 1473–1458 BCE. [UCL's chronology](https://www.ucl.ac.uk/museums-static/digitalegypt/chronology/hatshepsut.html) distinguishes her regency and sole rule.
- [Charlemagne's genealogical chronology](https://fasg.org/projects/henryproject/data/charl000.htm) discusses competing birth years; his card uses his reign instead. [Hypatia's biography](https://en.wikipedia.org/wiki/Hypatia) summarizes the competing birth dates. [Pachacuti](https://en.wikipedia.org/wiki/Pachacuti) and [Mansa Musa](https://en.wikipedia.org/wiki/Mansa_Musa) have approximate conventional reign chronologies.
- [The Eiffel Tower's official history](https://www.toureiffel.paris/en/the-monument/history) dates the tower to the 1889 World's Fair. [UK Parliament's clock tower chronology](https://www.parliament.uk/about/living-heritage/building/palace/big-ben/building-clock-tower/key-dates-/) distinguishes the clock and Great Bell's starts in 1859.
- [Amsterdam City Archives: toll privilege](https://www.amsterdam.nl/stadsarchief/stukken/handel/tolprivilege/) documents the city's first surviving mention in 1275. This is the card's milestone, rather than a disputed year for city rights.
- UNESCO's entries for the [Acropolis](https://whc.unesco.org/en/list/404), [Temple of Heaven](https://whc.unesco.org/en/list/881) and [Medina of Marrakesh](https://whc.unesco.org/en/list/331) support their monument and city chronologies. Beijing's description distinguishes the 1420 complex from its later rebuilt hall.
- [Chambord's official history](https://www.chambord.org/en/history/the-park-of-chambord/as-history-unfolds/) dates the beginning of construction to 1519.
- [Vie publique's territorial chronology](https://www.vie-publique.fr/eclairage/126857-construction-de-lorganisation-territoriale-de-la-france-chronologie) covers French regional reform and overseas departments. [INSEE's region definition](https://www.insee.fr/fr/metadonnees/definition/c1696) distinguishes the 18 present-day regions.

When correcting context, preserve card IDs and atlas positions in `src/decks.js`; change the shared subject entry in `src/context.js` so appearances across decks remain consistent.
