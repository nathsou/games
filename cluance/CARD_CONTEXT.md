# Card dates and context

All 354 active cards have a date caption and a short description. Original subjects are in `src/context.js`: the 27 administrative regions use `REGION_2015_CONTEXT`, and other original themes share `CARD_CONTEXT`. The append-only additions carry their dates and descriptions in `src/expansion.js` and `src/musicians.js`. The caption appears on the card; inspecting a card shows the full description. The same public context accompanies the AI's permitted board, clues and hand. Descriptions are shared background information, not hints about the dealt secret.

## Reading the captions

- A person's unlabelled date range is a lifespan. Contemporary performers use **Born** and a birth year; this does not assert their present status.
- Bands use explicitly labelled **Formed** or **Active** captions, describing the group rather than its members’ lifespans.
- **c.** means approximate. **Trad.** identifies a traditional attribution rather than a securely documented date. BCE and CE distinguish dates around the beginning of the Common Era; unmarked later dates are CE.
- A caption beginning with **Reign** describes a ruler's reign, not their lifespan. Hypatia's `c. 350/370–415 CE` reflects disputed birth dates around 350–370, explained in her description. Newton's birth year uses the Gregorian calendar (1643 rather than the Julian 1642).
- City, country and region captions name a particular landmark, event or administrative milestone. They do not claim that the place, its inhabitants or its culture began that year. Modern political boundaries can also differ from earlier ones.
- Greek mythological figures are labelled as myths, without invented lifespans. Homer and Laozi have traditional dates with explicit uncertainty. A myth's setting and the date of its surviving written account are different things.
- French Regions retains the complete administrative division on 31 December 2015: 22 metropolitan regions and five overseas regions. Centre-Val de Loire had adopted that name in January 2015. Three additional cards are explicitly labelled **Historical province**: Anjou, Touraine and Provence. These are not additional administrative regions of 2015 and have no invented administrative dates. A regional reform or department-status date does not date the older regional culture. Legacy region metadata is retained only for older saves/replays.

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

When correcting context, preserve card IDs and logical indices in `src/decks.js`; change the shared original subject entry in `src/context.js`, or the appended subject entry in `src/expansion.js`. Artwork overrides are independent of logical indices. The [individual card audit](CARD_AUDIT.md) records the final caption and review for every active card.

The expansion includes [Charles Babbage's Difference Engines](https://www.sciencemuseum.org.uk/objects-and-stories/charles-babbages-difference-engines), [Jean-Paul Sartre's 1964 Nobel biography](https://www.nobelprize.org/prizes/literature/1964/sartre/biographical/) and [Albert Camus's 1957 Nobel biography](https://www.nobelprize.org/prizes/literature/1957/camus/biographical/). Cronus is distinguished from Chronos; Pandora's vessel follows the ancient jar tradition. Place imagery uses regional/national landmark montages rather than asserting literal shared viewpoints.

The 2015 region roster follows [INSEE’s 2015 Code officiel géographique](https://www.insee.fr/fr/information/2560698), with Centre’s subsequent 2015 rename documented in [Article 2 of the 16 January 2015 law](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000030110734). The [2016 INSEE regional summary](https://www.insee.fr/fr/statistiques/1906658) records the change from 22 to 13 metropolitan regions.

## Musicians expansion

The pack includes both solo artists and bands. Solo artists retain birth-year or lifespan captions; groups use an explicitly labelled formation/activity year or activity span (The Beatles, Daft Punk). Portraits may depict an artist's earlier public stage style. Black Eyed Peas uses its classic 2000s lineup including Fergie, while Vampire Weekend uses its core trio. Billie Eilish's card uses Raph_PH's concert photograph from The O2 on 14 July 2025, licensed under CC BY 4.0, to show her actual face. Imagegen rejected her likeness, so the card uses a photograph instead of generated pixel art. Photographer, source and license appear in the details drawer and [art credits](assets/ART_CREDITS.md).

Angine de Poitrine's [official biography](https://anginedepoitrine.com/pages/a-propos) describes Khn and Klek's microtonal guitar/bass looping and drum patterns, and dates their repertoire to 2023. The corrected illustration references a stage photograph on that page for the white inverted-trapezoid and tall rounded black masks, downward noses, small dots and ochre features. The card uses public stage characters without inferring the performers' private identities. Additional biographies and explicit image mappings are in `src/musicians.js`.
