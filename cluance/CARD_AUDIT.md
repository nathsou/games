# Individual card audit

Original audit completed on 2026-10-03; the Musicians expansion was reviewed on 2026-10-04. **353 active cards: 53 Musicians and 30 in each of the other ten themes.** All decks meet or exceed the publisher's [Similo: History deck description](https://horribleguild.com/eu/product/similo-history/): “Each version of Similo comes with a deck of 30 big cards”. Cluance's subjects and illustrations are original; these are expanded original rosters, not copies of commercial rosters.

Added 63 cards, including Charles Babbage, Jean-Paul Sartre and Albert Camus. French Regions retains all 27 administrative regions of 2015 and adds three explicitly labelled historical provinces: Anjou, Touraine and Provence. They are identified in their subtitles, date captions, biographies and deck description, rather than presented as extra regions in the 2015 division.

Each row below records an individual inspection of the **final browser-rendered card**, including its artwork crop at 288 × 392, subject match, silhouette, important props, anatomy, period/geography, date caption, biography and distinguishing visual traits. The entire source atlas was also inspected. Retained means the existing illustration passed this review; New means newly generated; Redrawn means a completely new imagegen composition replaced an inconsistent illustration. All remaining cards passed their recorded review. Billie Eilish was removed at the user’s request; her former `singers-39` slot is not reused, preserving every other card’s ID and image mapping.

Place scenes combine landmarks and landscape motifs as **symbolic montages**, not literal views with all depicted objects geographically adjacent. Ancient and mythological likenesses are imaginative; archaeological portrait accuracy is not claimed. An audit establishes an editorial assessment, not a guarantee that all possible readings of a clue agree.

## Redesign decisions

- Clovis: removed a later medieval crown and royal costume; replaced with an early Frankish cloak, brooch and plain diadem.
- Mansa Musa: replaced the European crown with a turban/gold circlet and Sahelian architecture.
- Ibn al-Haytham: removed the Newton-like prism and rainbow. Rejected a first redraw with an upright camera-obscura projection; the accepted portrait has a lens and closed pinhole box, without a false projection.
- Marie Curie: removed fluorescent green liquid and the modern radiation icon. Both French History and Scientists now share the electroscope-and-clear-vial composition.
- Homer: removed modern glasses; the new ancient bard has naturally closed eyes and a lyre.
- Diogenes: replaced the wooden barrel and later lantern with a ceramic pithos and ancient clay lamp.
- Kenya: replaced the single Kilimanjaro-like snow cone with Mount Kenya's jagged rocky peaks.
- Beijing: replaced the incorrect four-tier roof with the Temple of Heaven's three blue roof tiers.
- Cronus: rejected the newly generated sundial motif because it conflates Cronus and Chronos. The accepted art uses a sickle and throne.
- Pandora: rejected an escaping luminous butterfly that could imply hope escaped. The accepted ceramic jar has dark mist outside and warm light remaining inside.
- Provence: rejected the Pont du Gard, which lies in historical Languedoc; the final historical province card uses Arles's Roman arena. Anjou depicts the Maine river; Touraine depicts Chenonceau over the Cher.

## Compatibility and delivery

All 267 pre-expansion active IDs, all 24 archived region IDs, subject names and indices are unchanged. Original 6 × 4 and 6 × 5 atlas geometry is preserved. Additions use separate 3 × 2 atlases with an independent artwork index; redraws use subject-based overrides. Unused rejected cells in a retained generated sheet cannot be selected as cards. PNGs preserve generated outputs; WebP delivery uses quality 94.

Prompts and accepted/rejected dispositions are in [EXPANSION_PROMPTS.md](assets/EXPANSION_PROMPTS.md). No model version is claimed; the imagegen tool does not expose one.

## Verification

- Musicians expansion (2026-10-04): all 23 retained additions individually inspected in full-bleed UI and labelled AI crops; all 53 pack images are distinct. All retained requested subjects appear once, including the retained Gainsbourg card. Search/details, both collection sorts, four viewport widths, complete classic/fixed UI games, replay export/import and six engine games passed. Every original and archived card record is unchanged.
- Original 2026-10-03 review: each collection gallery contained 30 cards. All 330 accessible labels and metadata records were checked; Babbage, Sartre and Camus were opened in the card inspector.
- Original 2026-10-03 review: all 330 active cards and 24 archived cards were rendered using the production Canvas renderer and individually inspected on contact sheets with full card captions.
- Desktop at 1440 × 1000 and mobile at 390 × 844: collection selection and inspection work, with no browser JavaScript errors or failed HTTP asset requests.
- Completed 242 temporary five-round game checks: every board/clue theme combination in both Classic and Fixed five. Checked legal hands, cross-theme subject exclusion and successful final state. No tests or test framework were added to the repository.
- Original IDs, names and indices were compared against the pre-expansion roster. All atlas mappings stay within their declared grid and every asset exists.
- Module syntax and git whitespace checks pass. Existing replay import, resume and an actual five-round one-screen game were checked separately as described in [PLAY_NOTES.md](PLAY_NOTES.md).

## Per-card findings

The date column reproduces the actual card caption. For a historical province it deliberately states “Historical province” rather than inventing administrative dates.

### French History

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| french-0 | Vercingetorix | c. 80–46 BCE | Retained | Long hair, torc and green cloak distinguish the Gallic leader; approximate BCE lifespan is explicit. |
| french-1 | Clovis | c. 466–511 | Redrawn | Redrawn with a plain diadem, cloak brooch and early hall; removed the later medieval crown. |
| french-2 | Charlemagne | Reign 768–814 | Retained | White beard, imperial orb and crown read clearly; caption uses the reign to avoid disputed birth dates. |
| french-3 | Eleanor of Aquitaine | c. 1122–1204 | Retained | Red gown and medieval veil remain distinct from later court portraits. |
| french-4 | Louis IX | 1214–1270 | Retained | Blue royal cloak and fleur-de-lis scepter distinguish this medieval French king. |
| french-5 | Joan of Arc | c. 1412–1431 | Retained | Short hair, armor and banner make the military role readable. |
| french-6 | Francis I | 1494–1547 | Retained | Feathered cap and patterned Renaissance doublet remain legible. |
| french-7 | Catherine de Medici | 1519–1589 | Retained | Black dress, white ruff and veil fit the sixteenth-century court. |
| french-8 | Henry IV | 1553–1610 | Retained | Pointed gray beard and white plume separate him from Francis I. |
| french-9 | Cardinal Richelieu | 1585–1642 | Retained | Red cardinal clothing makes the church and state role immediately visible. |
| french-10 | Louis XIV | 1638–1715 | Retained | Long curls and sun scepter support the Sun King association. |
| french-11 | Molière | 1622–1673 | Retained | Theatrical mask remains readable beside the seventeenth-century wig. |
| french-12 | Voltaire | 1694–1778 | Retained | White wig and quill support the Enlightenment writer context. |
| french-13 | Émilie du Châtelet | 1706–1749 | Retained | Blue court dress and astronomical equipment fit the eighteenth-century scientist. |
| french-14 | Marie Antoinette | 1755–1793 | Retained | Powdered hair, pink dress and fan separate the queen from other royals. |
| french-15 | Olympe de Gouges | 1748–1793 | Retained | Manuscript and revolutionary-period dress match the writer and activist. |
| french-16 | Robespierre | 1758–1794 | Retained | Spectacles, document and green coat distinguish the revolutionary. |
| french-17 | Napoleon | 1769–1821 | Retained | Bicorne and gray coat are recognisable; hand and silhouette survive the crop. |
| french-18 | Joséphine | 1763–1814 | Retained | Empire dress, floral hair and garden setting fit the Malmaison association. |
| french-19 | Victor Hugo | 1802–1885 | Retained | White beard and book support the novelist; Paris backdrop is a symbolic setting. |
| french-20 | Louis Pasteur | 1822–1895 | Retained | Ordinary flask and microscope support microbiology without fantasy effects. |
| french-21 | Marie Curie | 1867–1934 | Redrawn | Redrawn with an electroscope and clear vials; removed fluorescent liquid. Shared redraw also used in Scientists. |
| french-22 | Joséphine Baker | 1906–1975 | Retained | Gold stage clothing and microphone depict the performance role; Resistance work remains in the biography. |
| french-23 | Charles de Gaulle | 1890–1970 | Retained | Military kepi and uniform distinguish the general and president. |
| french-24 | Louis XIII | 1601–1643 | New | Dark hair, thin mustache, lace collar and blue sash distinguish Louis XIII from Louis XIV. |
| french-25 | Denis Diderot | 1713–1784 | New | Encyclopedia volumes and mechanical drawings make the editorial/scientific role visible. |
| french-26 | Marquis de Lafayette | 1757–1834 | New | Blue-and-buff uniform, tricorne and ship masts support the American Revolutionary connection. |
| french-27 | Louise Michel | 1830–1905 | New | Plain black dress, barricade and red flag fit the Paris Commune context. |
| french-28 | Gustave Eiffel | 1832–1923 | New | Tower model and construction backdrop identify the engineer; correct 1832–1923 lifespan. |
| french-29 | Simone Veil | 1927–2017 | New | Blue blazer, parliamentary benches and law book support her political work. |

### Global History

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| global-0 | Cleopatra | 69–30 BCE | Retained | Egyptian royal jewelry is an imaginative period illustration; the biographical label correctly identifies the Ptolemaic queen. |
| global-1 | Julius Caesar | 100–44 BCE | Retained | Laurel and red toga support the Roman role; 100–44 BCE lifespan checked. |
| global-2 | Hatshepsut | Reign c. 1473–1458 BCE | Retained | Pharaonic headdress and ceremonial false beard match the distinctive ruler; reign explicitly labelled. |
| global-3 | Alexander the Great | 356–323 BCE | Retained | Curly hair, bronze armor and spear differentiate the Macedonian king. |
| global-4 | Confucius | Trad. 551–479 BCE | Retained | Bamboo scroll and long beard fit the scholar; traditional dates clearly marked. |
| global-5 | Qin Shi Huang | 259–210 BCE | Retained | Imperial robe and beaded headdress distinguish the emperor from Confucius. |
| global-6 | Mansa Musa | Reign c. 1312–1337 | Redrawn | Redrawn with turban, gold circlet and Sahelian architecture; removed the European crown. |
| global-7 | Genghis Khan | c. 1162–1227 | Retained | Fur hat, bow and steppe background distinguish the Mongol ruler. |
| global-8 | Saladin | 1137/38–1193 | Retained | Turban, armor and curved sword fit the medieval sultan role. |
| global-9 | Ibn Battuta | c. 1304–1368/69 | Retained | Map, walking staff and travel clothes support the traveler; death-year uncertainty preserved. |
| global-10 | Zheng He | 1371–c. 1433 | Retained | Ship and maritime robe distinguish the admiral from other Chinese subjects. |
| global-11 | Pachacuti | Reign c. 1438–1471 | Retained | Inca headdress and sun emblem fit the emperor; reign dates approximate. |
| global-12 | Leonardo da Vinci | 1452–1519 | Retained | Red cap, long beard and mechanical drawing match the Renaissance investigator. |
| global-13 | Elizabeth I | 1533–1603 | Retained | White ruff and elaborate royal jewelry distinguish the Tudor queen. |
| global-14 | William Shakespeare | 1564–1616 | Retained | Quill and theater mask match the playwright; shared-subject biography consistent. |
| global-15 | Isaac Newton | 1643–1727 | Retained | Prism, spectrum and apple match Newton's work and traditional iconography. |
| global-16 | Ada Lovelace | 1815–1852 | Retained | Victorian dress and mechanical engine support the computing connection with Babbage. |
| global-17 | Harriet Tubman | c. 1822–1913 | Retained | Headscarf and lantern support the abolitionist journey motif; approximate birth date. |
| global-18 | Frederick Douglass | c. 1818–1895 | Retained | Silver hair, dark suit and book distinguish the abolitionist writer. |
| global-19 | Mahatma Gandhi | 1869–1948 | Retained | Round glasses, white shawl and spinning wheel are recognisable. |
| global-20 | Frida Kahlo | 1907–1954 | Retained | Flowers, brows, paintbrush and palette support the painter's identity. |
| global-21 | Albert Einstein | 1879–1955 | Retained | White hair and chalkboard support the physicist; Nobel wording correctly concerns the photoelectric effect. |
| global-22 | Nelson Mandela | 1918–2013 | Retained | Patterned shirt and raised fist distinguish Mandela; lifespan and presidential context checked. |
| global-23 | Wangari Maathai | 1940–2011 | Retained | Sapling and green clothing make the environmental role visible. |
| global-24 | Ashoka | Reign c. 268–232 BCE | New | Lion capital and Mauryan clothing support the ancient Indian emperor; reign approximate. |
| global-25 | Augustus | 63 BCE–14 CE | New | Short hair, laurel and white-purple toga distinguish Augustus from Caesar. |
| global-26 | Wu Zetian | 624–705 | New | Tang court dress, updo and plum blossom support the empress context. |
| global-27 | Simón Bolívar | 1783–1830 | New | Military coat, sideburns and Andean setting distinguish the independence leader. |
| global-28 | Florence Nightingale | 1820–1910 | New | Oil lamp and hospital beds support the nurse/reformer; statistics included in biography. |
| global-29 | Rosa Parks | 1913–2005 | New | Spectacles, mid-century coat and city bus support the Montgomery boycott context. |

### Scientists

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| scientists-0 | Archimedes | c. 287–212 BCE | Retained | Compass, geometry and ancient robe support mathematics and invention. |
| scientists-1 | Hypatia | c. 350/370–415 CE | Retained | Ancient dress and astronomical instrument fit the Alexandrian teacher; disputed birth dates explicit. |
| scientists-2 | Al-Khwarizmi | c. 780–850 | Retained | Manuscript and medieval scholar dress support algebra; not a modern textbook. |
| scientists-3 | Ibn al-Haytham | c. 965–1040 | Redrawn | Redrawn with lens and closed pinhole box; no Newton spectrum or incorrect upright projection. |
| scientists-4 | Leonardo da Vinci | 1452–1519 | Retained | Red cap, mechanical sketches and long beard support Renaissance engineering. |
| scientists-5 | Galileo Galilei | 1564–1642 | Retained | Telescope and starry sky distinguish the astronomer. |
| scientists-6 | Isaac Newton | 1643–1727 | Retained | Prism and spectrum match optical research; Gregorian birth year is 1643. |
| scientists-7 | Émilie du Châtelet | 1706–1749 | Retained | Celestial globe and eighteenth-century dress support astronomy and physics. |
| scientists-8 | Michael Faraday | 1791–1867 | Retained | Coil and magnet visibly support electromagnetic induction. |
| scientists-9 | James Clerk Maxwell | 1831–1879 | Retained | Field-wave motifs and apparatus support electromagnetism; distinct beard and palette. |
| scientists-10 | Charles Darwin | 1809–1882 | Retained | Finch and natural landscape support evolution; no artificial laboratory role. |
| scientists-11 | Nikola Tesla | 1856–1943 | Retained | Coil and electrical arcs support electrical engineering; face and mustache recognisable. |
| scientists-12 | Ada Lovelace | 1815–1852 | Retained | Mechanical gears and Victorian dress support computing; biography names Babbage. |
| scientists-13 | Louis Pasteur | 1822–1895 | Retained | Clear flask and microscope support microbial research. |
| scientists-14 | Marie Curie | 1867–1934 | Redrawn | Shared Curie redraw: electroscope and ordinary vials replace green radiation effects. |
| scientists-15 | Albert Einstein | 1879–1955 | Retained | Spacetime grid and chalk support theoretical physics; no chemical props. |
| scientists-16 | Emmy Noether | 1882–1935 | Retained | Formal blouse and mathematical diagrams support mathematics and its physics connections. |
| scientists-17 | Srinivasa Ramanujan | 1887–1920 | Retained | Manuscript and geometric figures support mathematical work; no invented named theorem. |
| scientists-18 | Alan Turing | 1912–1954 | Retained | Codebreaking machinery and period suit match the computing role. |
| scientists-19 | Grace Hopper | 1906–1992 | Retained | Navy uniform and punched card match computing and naval work. |
| scientists-20 | Rosalind Franklin | 1920–1958 | Retained | Diffraction pattern and molecular structure support crystallography; not portrayed as sole DNA discoverer. |
| scientists-21 | Katherine Johnson | 1918–2020 | Retained | Calculator and rocket support orbital calculations; mathematically focused biography. |
| scientists-22 | Chien-Shiung Wu | 1912–1997 | Retained | Laboratory apparatus and period clothing support experimental physics. |
| scientists-23 | Hedy Lamarr | 1914–2000 | Retained | Frequency-wave motif supports invention alongside the actor portrait. |
| scientists-24 | Charles Babbage | 1791–1871 | New | Mechanical engine and brass gear distinguish Babbage from Lovelace and Turing. |
| scientists-25 | Lise Meitner | 1878–1968 | New | Period laboratory and plate provide a nuclear-physics cue without fantasy radiation. |
| scientists-26 | Niels Bohr | 1885–1962 | New | Atom model fits Bohr's theoretical model; correctly dated 1885–1962. |
| scientists-27 | Carl Sagan | 1934–1996 | New | Saturn model, corduroy jacket and starfield identify the planetary scientist. |
| scientists-28 | Tu Youyou | Born 1930 | New | Artemisia plant and clear glassware support malaria research; labelled birth year. |
| scientists-29 | Stephen Hawking | 1942–2018 | New | Wheelchair and communication screen remain visible alongside cosmology imagery. |

### Philosophers

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| philosophers-0 | Socrates | c. 469–399 BCE | Retained | Questioning pose and ancient robe distinguish Socrates; approximate BCE dates. |
| philosophers-1 | Plato | c. 428–348 BCE | Retained | Geometric solid supports Plato's philosophical/mathematical associations. |
| philosophers-2 | Aristotle | 384–322 BCE | Retained | Scroll and nature specimens distinguish Aristotle's broad investigations. |
| philosophers-3 | Epicurus | 341–270 BCE | Retained | Garden and fruit support the modest-pleasure tradition described in the biography. |
| philosophers-4 | Diogenes | c. 412–323 BCE | Redrawn | Redrawn with a terracotta pithos and ancient clay lamp; removed wooden barrel and later lantern. |
| philosophers-5 | Hypatia | c. 350/370–415 CE | Retained | Ancient dress and astronomical instrument remain consistent with Scientists. |
| philosophers-6 | Confucius | Trad. 551–479 BCE | Retained | Scroll and long beard match the scholar; traditional chronology marked. |
| philosophers-7 | Laozi | Trad. 6th century BCE | Retained | Mountains and white beard are imaginative traditional iconography; disputed historicity explicit. |
| philosophers-8 | Zhuangzi | c. 369–286 BCE | Retained | Butterfly motif directly supports the dream parable. |
| philosophers-9 | Mencius | c. 372–289 BCE | Retained | Bamboo book and blue robes distinguish the Confucian scholar. |
| philosophers-10 | Nāgārjuna | c. 150–250 CE | Retained | Monastic dress and lotus support Buddhist philosophy; approximate dates. |
| philosophers-11 | Ibn Sina | 980–1037 | Retained | Medical book and scholarly dress support physician/philosopher role. |
| philosophers-12 | Ibn Rushd | 1126–1198 | Retained | Manuscript and Andalusian architecture fit the scholarly context. |
| philosophers-13 | Thomas Aquinas | c. 1225–1274 | Retained | Dominican habit and book distinguish the medieval theologian. |
| philosophers-14 | Niccolò Machiavelli | 1469–1527 | Retained | Florentine architecture, Renaissance robe and quill fit the political writer. |
| philosophers-15 | René Descartes | 1596–1650 | Retained | Compass, lace collar and mustache support analytic geometry and period. |
| philosophers-16 | Baruch Spinoza | 1632–1677 | Retained | Optical lens fits Spinoza's lens-grinding work; distinct from Descartes's compass. |
| philosophers-17 | John Locke | 1632–1704 | Retained | Manuscript and seventeenth-century clothing fit empiricism and political writing. |
| philosophers-18 | David Hume | 1711–1776 | Retained | Powdered wig, red coat and study distinguish the Scottish philosopher. |
| philosophers-19 | Immanuel Kant | 1724–1804 | Retained | Blue coat and clock support the familiar routine association. |
| philosophers-20 | Mary Wollstonecraft | 1759–1797 | Retained | Book and late-eighteenth-century dress support the writer and education advocate. |
| philosophers-21 | Friedrich Nietzsche | 1844–1900 | Retained | Large mustache, dark suit and mountain backdrop remain distinctive. |
| philosophers-22 | Simone de Beauvoir | 1908–1986 | Retained | Headwrap, book and café fit the twentieth-century existentialist context. |
| philosophers-23 | Hannah Arendt | 1906–1975 | Retained | Books, dark bob and cigarette support the public thinker portrait. |
| philosophers-24 | Jean-Paul Sartre | 1905–1980 | New | Round spectacles, asymmetrical gaze, book and café make Sartre recognisable. |
| philosophers-25 | Karl Marx | 1818–1883 | New | White beard and industrial background support political economy. |
| philosophers-26 | Bertrand Russell | 1872–1970 | New | Angular face, white hair, bow tie and study distinguish Russell. |
| philosophers-27 | Søren Kierkegaard | 1813–1855 | New | Swept hair, sideburns, umbrella and Copenhagen setting fit the nineteenth-century writer. |
| philosophers-28 | Ludwig Wittgenstein | 1889–1951 | New | Simple shirt and geometric blocks support language/logic without fake formulas. |
| philosophers-29 | Simone Weil | 1909–1943 | New | Wire spectacles, olive branch and factory loom connect contemplation with labor. |

### Writers

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| writers-0 | Homer | Trad. 8th century BCE | Redrawn | Redrawn as a blind ancient bard with lyre; removed modern spectacles. Traditional attribution retained. |
| writers-1 | Sappho | c. 630–570 BCE | Retained | Laurel, scroll and ancient clothing support Greek lyric poetry. |
| writers-2 | Dante Alighieri | 1265–1321 | Retained | Red cap and laurel are recognisable Dante iconography. |
| writers-3 | Geoffrey Chaucer | c. 1343–1400 | Retained | Hood and illustrated manuscript fit the medieval English poet. |
| writers-4 | Miguel de Cervantes | 1547–1616 | Retained | Ruff and windmills support the Don Quixote association. |
| writers-5 | William Shakespeare | 1564–1616 | Retained | Quill and theatrical mask support the playwright. |
| writers-6 | Molière | 1622–1673 | Retained | Theater mask and wig match the French History appearance. |
| writers-7 | Jean de La Fontaine | 1621–1695 | Retained | Fox and crow provide specific fable associations. |
| writers-8 | Voltaire | 1694–1778 | Retained | Quill and white wig match the Enlightenment context. |
| writers-9 | Johann Wolfgang von Goethe | 1749–1832 | Retained | Period coat and manuscript fit the German writer. |
| writers-10 | Jane Austen | 1775–1817 | Retained | Regency bonnet, gown and book fit the novelist. |
| writers-11 | Mary Shelley | 1797–1851 | Retained | Gothic backdrop and lightning support Frankenstein rather than a literal scientific role. |
| writers-12 | Victor Hugo | 1802–1885 | Retained | White beard, book and Paris setting match the novelist. |
| writers-13 | Alexandre Dumas | 1802–1870 | Retained | Mixed-ancestry portrait and musketeer swords support historical adventure writing. |
| writers-14 | George Sand | 1804–1876 | Retained | Waistcoat and quill support the novelist's challenge to gender expectations. |
| writers-15 | Fyodor Dostoevsky | 1821–1881 | Retained | Receding hair, beard and book fit the Russian novelist. |
| writers-16 | Leo Tolstoy | 1828–1910 | Retained | Long white beard and plain shirt distinguish Tolstoy. |
| writers-17 | Charles Dickens | 1812–1870 | Retained | Victorian suit, watch and London backdrop support Dickens. |
| writers-18 | Oscar Wilde | 1854–1900 | Retained | Velvet jacket and green carnation support aesthetic-movement imagery. |
| writers-19 | Virginia Woolf | 1882–1941 | Retained | Book and understated early-twentieth-century dress fit Woolf. |
| writers-20 | Franz Kafka | 1883–1924 | Retained | Surreal doorway supports Kafka's fiction without claiming a literal scene. |
| writers-21 | Rabindranath Tagore | 1861–1941 | Retained | Long white beard and robe fit the Bengali poet; Nobel date checked. |
| writers-22 | Jorge Luis Borges | 1899–1986 | Retained | Cane and labyrinth connect Borges's appearance and fiction. |
| writers-23 | Toni Morrison | 1931–2019 | Retained | Silver locks, patterned shawl and books distinguish Morrison. |
| writers-24 | Albert Camus | 1913–1960 | New | Trench coat, novel and coastal Algeria setting distinguish Camus; Nobel date 1957. |
| writers-25 | Agatha Christie | 1890–1976 | New | Typewriter and magnifying glass support crime writing. |
| writers-26 | Gabriel García Márquez | 1927–2014 | New | Yellow butterfly and Caribbean architecture support magical realism. |
| writers-27 | Ursula K. Le Guin | 1929–2018 | New | Book, wooded islands and dragon silhouette support Earthsea. |
| writers-28 | James Baldwin | 1924–1987 | New | Expressive face, notebook and Harlem backdrop fit the essayist and novelist. |
| writers-29 | Emily Dickinson | 1830–1886 | New | Plain black dress, folded paper and Amherst window support the poet. |

### Musicians

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| singers-0 | Édith Piaf | 1915–1963 | Retained | Dark dress, short curls and vintage microphone identify the chanson singer. |
| singers-1 | Charles Aznavour | 1924–2018 | Retained | Suit and red theater curtain support Aznavour's stage identity. |
| singers-2 | Jacques Brel | 1929–1978 | Retained | Expressive singing pose and loosened tie fit Brel. |
| singers-3 | Barbara | 1930–1997 | Retained | Piano and dark clothing distinguish Barbara. |
| singers-4 | Georges Brassens | 1921–1981 | Retained | Guitar, mustache and pipe fit Brassens's stage iconography. |
| singers-5 | Johnny Hallyday | 1943–2017 | Retained | Leather jacket and stage lights support French rock. |
| singers-6 | Michael Jackson | 1958–2009 | Retained | Fedora, glove and red stage jacket clearly distinguish Jackson. |
| singers-7 | Prince | 1958–2016 | Retained | Purple clothing and instrument strap fit Prince. |
| singers-8 | Freddie Mercury | 1946–1991 | Retained | Mustache, white stage vest and microphone are recognisable Mercury cues. |
| singers-9 | Beyoncé | Born 1981 | Retained | Gold stage outfit and flowing hair fit contemporary pop performance. |
| singers-10 | Adele | Born 1988 | Retained | Vintage microphone, black dress and auburn hair distinguish Adele. |
| singers-11 | Taylor Swift | Born 1989 | Retained | Blond fringe and blue stage dress fit Swift; birth caption explicit. |
| singers-12 | Aretha Franklin | 1942–2018 | Retained | Piano edge and energetic vocal pose support soul performance. |
| singers-13 | Whitney Houston | 1963–2012 | Retained | Silver gown and microphone fit Houston's concert portrait. |
| singers-14 | Nina Simone | 1933–2003 | Retained | Profile at piano supports the singer-pianist role. |
| singers-15 | Ella Fitzgerald | 1917–1996 | Retained | Vintage microphone and pearls fit Fitzgerald's jazz identity. |
| singers-16 | Bob Marley | 1945–1981 | Retained | Dreadlocks, guitar and red-gold-green palette fit the reggae musician. |
| singers-17 | Elvis Presley | 1935–1977 | Retained | White stage suit and microphone distinguish Presley. |
| singers-18 | David Bowie | 1947–2016 | Retained | Lightning makeup and red hair clearly identify the Bowie persona. |
| singers-19 | Shakira | Born 1977 | Retained | Stage outfit and long curls fit Shakira. |
| singers-20 | Céline Dion | Born 1968 | Retained | Elegant white dress and vocal pose fit Dion's performance image. |
| singers-21 | Björk | Born 1965 | Retained | Experimental colorful clothing supports Björk's distinctive visual style. |
| singers-22 | Stromae | Born 1985 | Retained | Geometric patterned jacket distinguishes Stromae. |
| singers-23 | Bad Bunny | Born 1994 | Retained | Sunglasses and vivid modern jacket distinguish Bad Bunny. |
| singers-24 | Dalida | 1933–1987 | New | Auburn hair, cream stage dress and microphone fit Dalida. |
| singers-25 | Serge Gainsbourg | 1928–1991 | New | Lean face, prominent ears and piano distinguish Gainsbourg. |
| singers-26 | Billie Holiday | 1915–1959 | New | White gardenia and vintage microphone are strong Holiday cues. |
| singers-27 | Tina Turner | 1939–2023 | New | Spiked hair, red sequins and singing pose distinguish Turner. |
| singers-28 | Bob Dylan | Born 1941 | New | Harmonica holder and acoustic guitar support Dylan. |
| singers-29 | Luciano Pavarotti | 1935–2007 | New | White handkerchief, beard and opera-house setting distinguish the tenor. |

| singers-30 | Chappell Roan | Born 1998 | New | Red curls, theatrical makeup, magenta stars and microphone distinguish Roan; both crops retain face and performance cues. |
| singers-31 | Lady Gaga | Born 1986 | New | Platinum bob, angular silver outfit and blue stage lighting distinguish Gaga; face and microphone remain readable. |
| singers-32 | The Beatles | Active 1960–1970 | New | Four distinct members, mop-top silhouettes, matching suits and guitars identify the classic quartet; all four faces survive both crops. |
| singers-33 | The Strokes | Formed 1998 | New | Five separated faces, Casablancas at the microphone and contrasting indie-rock clothing fit the band; no duplicated members. |
| singers-34 | Daft Punk | Active 1993–2021 | New | Two distinct silver/gold robot helmets and synthesizer distinguish the French duo; both complete helmets survive the crop. |
| singers-35 | Justice | Formed 2003 | New | Two distinct performers, analog synthesizer and illuminated cross identify Justice; black/amber palette differs from Daft Punk. |
| singers-36 | Coldplay | Formed 1997 | New | Four members, Martin at a painted piano, guitarist with cap, bassist and drummer remain visible against rainbow stadium lighting. |
| singers-37 | Muse | Formed 1994 | New | Bellamy with silver guitar, Wolstenholme with bass and blond Howard at drums form a clear trio; cobalt stage palette fits Muse. |
| singers-38 | Bruno Mars | Born 1985 | New | Curly hair, burgundy shirt, retro microphone and warm funk-stage lighting fit Mars; subdued backing players support the main portrait. |
| singers-40 | Fun. | Formed 2008 | New | Three separated performers: Ruess at microphone, Antonoff with glasses/guitar and Dost at keys; theater backdrop is coherent. |
| singers-41 | Angine de Poitrine | Active since 2023 | Redrawn | Official stage-photo reference corrected Khn's wide inverted-trapezoid white mask, Klek's tall rounded black mask, small spots, ochre features and downward noses. Both complete masks, shared-body double-neck guitar/bass and drums remain legible in UI and AI crops; no private identities are inferred. |
| singers-42 | Vampire Weekend | Formed 2006 | New | Koenig in patterned shirt with guitar, Baio with bass and Tomson near cymbal form a distinct trio; ivy/New York context fits. |
| singers-43 | Lana Del Rey | Born 1985 | New | Auburn vintage waves, cream dress, roses and silver microphone support the cinematic pop identity; face stays clear. |
| singers-44 | Kanye West | Born 1977 | New | Close-cropped hair, short beard and music sampler identify the rapper/producer; fingers and pad controller remain readable. |
| singers-45 | Imagine Dragons | Formed 2008 | New | Four-member classic lineup with Reynolds foreground, guitarists/bassist and drummer; warm orange lights distinguish the band. |
| singers-46 | Black Eyed Peas | Formed 1995 | New | Classic 2000s will.i.am/apl.de.ap/Taboo/Fergie quartet, distinct faces and cyan-magenta staging; biography explicitly identifies this lineup. |
| singers-47 | Lorde | Born 1996 | New | Dark curls, berry lipstick and moonlit indigo stage distinguish Lorde; face, microphone and night atmosphere fit both crops. |
| singers-48 | Sufjan Stevens | Born 1975 | New | Plaid shirt, acoustic guitar, banjo and wooded setting distinguish the folk/composer identity; standard name spelling verified. |
| singers-49 | Katy Perry | Born 1984 | New | Dark wavy hair, candy-patterned outfit and pink/turquoise lights distinguish Perry; visible hands and microphone are coherent. |
| singers-50 | Rihanna | Born 1988 | New | Asymmetric dark bob, emerald outfit and closed umbrella support Rihanna; face and key prop stay visible without covering her. |
| singers-51 | Françoise Hardy | 1944–2024 | New | Long brown fringe, restrained cream/brown clothing and acoustic guitar fit the 1960s portrait; lifespan and accented name are correct. |
| singers-52 | France Gall | 1947–2018 | New | Rounded blond bob, sunny blue/yellow set and vintage microphone fit the yé-yé era; lifespan and Eurovision context are explicit. |
| singers-53 | Michel Berger | 1947–1992 | New | Dark curls, open-collar shirt and grand piano distinguish Berger; keyboard and face remain visible in both production crops. |

Serge Gainsbourg (`singers-25`) is retained once. The additions preserve all original card records. Band compositions may depict historical lineups as stated in their biographies; formation/activity captions are distinguished from people's birth dates.

### Actors

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| actors-0 | Charlie Chaplin | 1889–1977 | Retained | Bowler, cane and toothbrush mustache fit the Tramp role. |
| actors-1 | Buster Keaton | 1895–1966 | Retained | Porkpie hat, deadpan face and train fit silent cinema. |
| actors-2 | Marilyn Monroe | 1926–1962 | Retained | Blond curls, beauty mark and white dress are recognisable Monroe cues. |
| actors-3 | Audrey Hepburn | 1929–1993 | Retained | Black dress, updo, pearls and gloves support Hepburn's screen image. |
| actors-4 | James Dean | 1931–1955 | Retained | Red jacket and tousled hair fit Dean's familiar screen persona. |
| actors-5 | Marlon Brando | 1924–2004 | Retained | White shirt and strong jaw fit Brando's early film image. |
| actors-6 | Alain Delon | 1935–2024 | Retained | Swept dark hair and dark suit fit Delon's screen identity. |
| actors-7 | Jean-Paul Belmondo | 1933–2021 | Retained | Crooked nose and casual leather jacket distinguish Belmondo. |
| actors-8 | Catherine Deneuve | Born 1943 | Retained | Blond bouffant and pale dress fit Deneuve. |
| actors-9 | Louis de Funès | 1914–1983 | Retained | Expressive face and comic gesture fit de Funès. |
| actors-10 | Omar Sy | Born 1978 | Retained | Broad smile and navy suit distinguish Sy. |
| actors-11 | Marion Cotillard | Born 1975 | Retained | Waved bob and film lighting fit Cotillard; no mistaken Piaf identity. |
| actors-12 | Meryl Streep | Born 1949 | Retained | Blond hair and theater setting fit Streep. |
| actors-13 | Robert De Niro | Born 1943 | Retained | Distinct brows and dark jacket fit De Niro. |
| actors-14 | Morgan Freeman | Born 1937 | Retained | Gray curls and thoughtful pose fit Freeman. |
| actors-15 | Denzel Washington | Born 1954 | Retained | Formal suit and intense expression distinguish Washington. |
| actors-16 | Keanu Reeves | Born 1964 | Retained | Long hair, beard and green lighting fit Reeves. |
| actors-17 | Michelle Yeoh | Born 1962 | Retained | Silk clothing and open martial-arts hand distinguish Yeoh. |
| actors-18 | Jackie Chan | Born 1954 | Retained | Martial-arts pose and warm smile distinguish Chan. |
| actors-19 | Bruce Lee | 1940–1973 | Retained | Yellow tracksuit and martial-arts pose clearly identify Lee. |
| actors-20 | Shah Rukh Khan | Born 1965 | Retained | Formal black clothing and Bollywood lighting fit Khan. |
| actors-21 | Amitabh Bachchan | Born 1942 | Retained | Square glasses and salt-and-pepper beard identify Bachchan. |
| actors-22 | Viola Davis | Born 1965 | Retained | Natural hair and red dress fit Davis. |
| actors-23 | Tilda Swinton | Born 1960 | Retained | Short pale hair and sculptural white outfit distinguish Swinton. |
| actors-24 | Ingrid Bergman | 1915–1982 | New | Waved hair, tailored coat and Casablanca-like setting support Bergman. |
| actors-25 | Grace Kelly | 1929–1982 | New | Blond waves, pearls and Riviera setting support Kelly. |
| actors-26 | Tom Hanks | Born 1956 | New | Friendly lined face and vintage camera fit Hanks. |
| actors-27 | Anthony Hopkins | Born 1937 | New | Pale eyes, older face and theater mask distinguish Hopkins. |
| actors-28 | Penélope Cruz | Born 1974 | New | Dark hair, red dress and Mediterranean courtyard fit Cruz. |
| actors-29 | Lupita Nyong’o | Born 1983 | New | Short natural hair, blue dress and purple premiere lights fit Nyong’o. |

### Cities

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| cities-0 | Paris | Eiffel Tower: 1889 | Retained | Eiffel Tower and Seine support Paris; milestone explicitly dates the tower. |
| cities-1 | Rome | Colosseum: 80 CE | Retained | Colosseum silhouette is recognisable; 80 CE dates its inauguration. |
| cities-2 | London | Big Ben: 1859 | Retained | Westminster tower and red bus fit London; 1859 milestone labelled. |
| cities-3 | Berlin | Brandenburg Gate: 1791 | Retained | Brandenburg Gate and television tower fit Berlin. |
| cities-4 | Tokyo | Renamed Tokyo: 1868 | Retained | Tokyo Tower, neon skyline and blossoms fit Tokyo; renaming is not a founding claim. |
| cities-5 | New York City | Renamed New York: 1664 | Retained | Liberty statue and Manhattan skyline support New York. |
| cities-6 | Amsterdam | First recorded: 1275 | Retained | Canals, gabled houses and bicycles fit Amsterdam. |
| cities-7 | Venice | Republic ended: 1797 | Retained | Gondola, canal and domed church fit Venice. |
| cities-8 | Barcelona | Sagrada Família: 1882– | Retained | Sagrada Família and mosaic foreground fit Barcelona. |
| cities-9 | Athens | Parthenon: 447–432 BCE | Retained | Parthenon and Acropolis fit Athens; ancient construction dates labelled. |
| cities-10 | Istanbul | Ottoman conquest: 1453 | Retained | Domes, minarets and Bosphorus ferry fit Istanbul. |
| cities-11 | Moscow | First recorded: 1147 | Retained | Colorful Saint Basil's domes and snow fit Moscow. |
| cities-12 | Cairo | Founded: 969 | Retained | Pyramids and city minarets form a symbolic Cairo/Giza montage, explained by the context. |
| cities-13 | Marrakesh | Founded c. 1070–1072 | Retained | Red medina, market and Koutoubia minaret fit Marrakesh. |
| cities-14 | Dubai | Burj Khalifa: 2010 | Retained | One dominant Burj Khalifa separates Dubai's skyline from other modern cities. |
| cities-15 | Mumbai | Gateway of India: 1924 | Retained | Gateway of India and harbor boats fit Mumbai. |
| cities-16 | Beijing | Temple of Heaven: 1420 | Redrawn | Redrawn with exactly three blue roof tiers; 1420 dates the complex, not the present rebuilt hall. |
| cities-17 | Seoul | Joseon capital: 1394 | Retained | Palace roofs and N Seoul Tower support Seoul. |
| cities-18 | Singapore | Independence: 1965 | Retained | Merlion and Marina Bay skyline identify Singapore. |
| cities-19 | Sydney | Opera House: 1973 | Retained | Opera House sails and harbor bridge identify Sydney; not described as the national capital. |
| cities-20 | Rio de Janeiro | Christ statue: 1931 | Retained | Christ statue, Sugarloaf and coast fit Rio's landmark montage. |
| cities-21 | Mexico City | Tenochtitlan: trad. 1325 | Retained | Historic cathedral and colorful square support Mexico City; Tenochtitlan date traditional. |
| cities-22 | Cape Town | Dutch settlement: 1652 | Retained | Table Mountain and waterfront identify Cape Town; settlement date does not erase older habitation. |
| cities-23 | San Francisco | Golden Gate Bridge: 1937 | Retained | Golden Gate Bridge and fog identify San Francisco. |
| cities-24 | Lisbon | Belém Tower: 16th century | New | Yellow tram, red roofs and Belém Tower support Lisbon. |
| cities-25 | Prague | Charles Bridge begun: 1357 | New | Bridge tower, statues and castle support Prague. |
| cities-26 | Vienna | Cathedral consecrated: 1147 | New | Patterned cathedral roof and spire support Vienna. |
| cities-27 | Bangkok | Capital since: 1782 | New | Wat Arun prang, river and long-tail boat support Bangkok. |
| cities-28 | Buenos Aires | Permanent foundation: 1580 | New | Obelisk and La Boca houses support Buenos Aires as a symbolic montage. |
| cities-29 | Nairobi | Established: 1899 | New | KICC cylindrical tower and conical auditorium support Nairobi; no erroneous snowy cone. |

### Countries

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| countries-0 | France | First Republic: 1792 | Redrawn | User-selected Chenonceau variant: Renaissance château and arched gallery over the Cher, slate roofs, river reflections and foreground roses. Coherent Loire landscape; main architecture fits the card crop. |
| countries-1 | Italy | Unification: 1861 | Retained | Leaning Tower, cypress and classical ruins support Italy. |
| countries-2 | United Kingdom | Act of Union: 1801 | Retained | Stonehenge and telephone box support the United Kingdom. |
| countries-3 | Germany | Reunification: 1990 | Retained | Alpine castle and autumn forest fit Germany. |
| countries-4 | Spain | Constitution: 1978 | Retained | Alhambra-style arches and orange trees support Spain. |
| countries-5 | Greece | Independence recognized: 1830 | Retained | Blue domes, white houses and olive branch support Greece. |
| countries-6 | Norway | Independence: 1905 | Retained | Fjord, red cabins and aurora distinguish Norway. |
| countries-7 | Japan | Meiji Restoration: 1868 | Retained | Fuji, torii and blossoms support Japan. |
| countries-8 | China | People’s Republic: 1949 | Retained | Great Wall and lantern support China. |
| countries-9 | India | Independence: 1947 | Retained | Taj Mahal, peacock and reflection pool support India. |
| countries-10 | South Korea | Republic established: 1948 | Retained | Hanok roofs and hillside tower distinguish South Korea. |
| countries-11 | Indonesia | Independence declared: 1945 | Retained | Balinese tiered temple and volcanic lake landscape support Indonesia. |
| countries-12 | Turkey | Republic proclaimed: 1923 | Retained | Cappadocia rocks, balloons and ceramic support Turkey. |
| countries-13 | Saudi Arabia | Kingdom unified: 1932 | Retained | Hegra-style sandstone tomb and coffee pot fit Saudi Arabia's AlUla landscape. |
| countries-14 | Egypt | Republic proclaimed: 1953 | Retained | Pyramids, Sphinx and river reeds support Egypt. |
| countries-15 | Morocco | Independence: 1956 | Retained | Blue Chefchaouen-like street and ceramics support Morocco. |
| countries-16 | Kenya | Independence: 1963 | Redrawn | Redrawn with jagged Mount Kenya peaks; removed Kilimanjaro-like cone. |
| countries-17 | South Africa | Inclusive elections: 1994 | Retained | Table Mountain, protea and African penguin support South Africa. |
| countries-18 | United States | Independence declared: 1776 | Retained | Grand Canyon, eagle and distant Liberty statue form a national montage. |
| countries-19 | Canada | Confederation: 1867 | Retained | Rocky Mountains, lake and maple leaves support Canada. |
| countries-20 | Mexico | Independence achieved: 1821 | Retained | Maya pyramid, agave and textile support Mexico. |
| countries-21 | Brazil | Independence: 1822 | Retained | Macaw, toucan, rainforest and Rio coast are a symbolic national montage. |
| countries-22 | Australia | Federation: 1901 | Retained | Uluru, kangaroo and reef motifs support Australia. |
| countries-23 | New Zealand | Dominion status: 1907 | Retained | Fjord, fern and kiwi distinguish New Zealand. |
| countries-24 | Portugal | Republic proclaimed: 1910 | New | Belém Tower and azulejo foreground distinguish Portugal from Spain. |
| countries-25 | Switzerland | Federal constitution: 1848 | New | Pointed Matterhorn, chalets and red train support Switzerland. |
| countries-26 | Ireland | Republic declared: 1949 | New | Atlantic cliffs and Celtic cross distinguish Ireland. |
| countries-27 | Argentina | Independence declared: 1816 | New | Fitz Roy peaks and mate gourd support Argentina. |
| countries-28 | Peru | Independence proclaimed: 1821 | New | Machu Picchu terraces, Huayna Picchu and llama support Peru. |
| countries-29 | Thailand | Constitutional monarchy: 1932 | New | Thai roof forms, karst landscape and long-tail boat distinguish Thailand. |

### French Regions

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| regions-2015-0 | Alsace | Separate region until 2015 | Retained | Colmar-style canal, timbered houses and stork fit Alsace. |
| regions-2015-1 | Aquitaine | Separate region until 2015 | Retained | Dune du Pilat, pine forest and vineyard form an Aquitaine montage. |
| regions-2015-2 | Auvergne | Separate region until 2015 | Retained | Rounded volcanic peak and dark-stone church fit Auvergne. |
| regions-2015-3 | Basse-Normandie | Separate region until 2015 | Retained | Mont Saint-Michel and apples identify Basse-Normandie. |
| regions-2015-4 | Bourgogne | Separate region until 2015 | Retained | Stone château, vines and grapes fit Bourgogne. |
| regions-2015-5 | Bretagne | Union with France: 1532 | Retained | Pink granite, lighthouse and Atlantic sailboat fit Bretagne. |
| regions-2015-6 | Centre-Val de Loire | Renamed: 2015 | Retained | Chambord and river reflection support Centre-Val de Loire; 2015 rename labelled. |
| regions-2015-7 | Champagne-Ardenne | Separate region until 2015 | Retained | Reims cathedral, vineyards and wine glass fit Champagne-Ardenne. |
| regions-2015-8 | Corse | 2015 territorial division | Retained | Genoese tower and rugged turquoise coast support Corse. |
| regions-2015-9 | Franche-Comté | Separate region until 2015 | Retained | Besançon citadel, Doubs curve and cheese support Franche-Comté. |
| regions-2015-10 | Haute-Normandie | Separate region until 2015 | Retained | Étretat arch, cathedral and timbered buildings fit Haute-Normandie montage. |
| regions-2015-11 | Île-de-France | Court at Versailles: 1682 | Retained | Versailles gates and distant Paris identify Île-de-France. |
| regions-2015-12 | Languedoc-Roussillon | Separate region until 2015 | Retained | Carcassonne, vines and flamingo support Languedoc-Roussillon. |
| regions-2015-13 | Limousin | Separate region until 2015 | Retained | Porcelain pitcher and wooded red-roofed village support Limousin. |
| regions-2015-14 | Lorraine | Separate region until 2015 | Retained | Nancy gilded gates and yellow plum branch support Lorraine. |
| regions-2015-15 | Midi-Pyrénées | Separate region until 2015 | Retained | Toulouse brick basilica, river and Pyrenees form a regional montage. |
| regions-2015-16 | Nord-Pas-de-Calais | Separate region until 2015 | Retained | Belfry, spoil heap and dunes support Nord-Pas-de-Calais. |
| regions-2015-17 | Pays de la Loire | Planning region: 1956 | Retained | Nantes mechanical elephant and waterfront fit Pays de la Loire. |
| regions-2015-18 | Picardie | Separate region until 2015 | Retained | Amiens cathedral and Somme marsh support Picardie. |
| regions-2015-19 | Poitou-Charentes | Separate region until 2015 | Retained | La Rochelle towers and canal vegetation support Poitou-Charentes. |
| regions-2015-20 | Provence-Alpes-Côte d’Azur | Avignon papacy: 1309–1377 | Retained | Lavender, village and calanque distinguish the administrative region from historical Provence. |
| regions-2015-21 | Rhône-Alpes | Separate region until 2015 | Retained | Mont Blanc, cable car and Lyon riverfront form a Rhône-Alpes montage. |
| regions-2015-22 | Guadeloupe | Department status: 1946 | Retained | Tropical volcano, waterfall and hibiscus distinguish Guadeloupe. |
| regions-2015-23 | Guyane | Department status: 1946 | Retained | Rocket, rainforest and river distinguish mainland Guyane. |
| regions-2015-24 | Martinique | Department status: 1946 | Retained | Mount Pelée, Creole houses and sugarcane support Martinique. |
| regions-2015-25 | La Réunion | Department status: 1946 | Retained | Volcanic lava and rugged tropical coast distinguish La Réunion. |
| regions-2015-26 | Mayotte | Department status: 2011 | Retained | Lagoon, mangroves, turtle and outrigger fit Mayotte. |
| regions-2015-27 | Anjou | Historical province | New | Angers's striped towers and Maine river fit Anjou; explicitly historical, not a 2015 region. |
| regions-2015-28 | Touraine | Historical province | New | Chenonceau gallery over the Cher fits Touraine; explicitly historical. |
| regions-2015-29 | Provence | Historical province | New · redrawn | Redrawn using Arles's arena and olives; removed Pont du Gard, which belongs to historical Languedoc. |

### Greek Mythology

| ID | Subject | Date caption | Decision | Individual finding |
| --- | --- | --- | --- | --- |
| greek-0 | Zeus | Ancient Greek myth | Retained | Lightning and storm fit Zeus. |
| greek-1 | Hera | Ancient Greek myth | Retained | Crown and peacock support Hera. |
| greek-2 | Poseidon | Ancient Greek myth | Retained | Three-pronged trident and waves distinguish Poseidon. |
| greek-3 | Demeter | Ancient Greek myth | Retained | Wheat and green gown support harvest. |
| greek-4 | Athena | Ancient Greek myth | Retained | Armor and owl support Athena's wisdom/warfare associations. |
| greek-5 | Apollo | Ancient Greek myth | Retained | Lyre and sun support Apollo. |
| greek-6 | Artemis | Ancient Greek myth | Retained | Deer, moon and hunting outfit support Artemis. |
| greek-7 | Ares | Ancient Greek myth | Retained | Helmet, spear and red armor support Ares. |
| greek-8 | Aphrodite | Ancient Greek myth | Retained | Roses, shell-like fan and pink palette support Aphrodite. |
| greek-9 | Hephaestus | Ancient Greek myth | Retained | Hammer, anvil and sparks identify Hephaestus. |
| greek-10 | Hermes | Ancient Greek myth | Retained | Winged hat and two-snake caduceus distinguish Hermes. |
| greek-11 | Dionysus | Ancient Greek myth | Retained | Ivy, grapes and wine support Dionysus. |
| greek-12 | Hades | Ancient Greek myth | Retained | Dark crown and underworld palette fit Hades; description distinguishes him from Death. |
| greek-13 | Persephone | Ancient Greek myth | Retained | Pomegranate and flowers support Persephone. |
| greek-14 | Hestia | Ancient Greek myth | Retained | Hearth flame and veiled robe distinguish Hestia. |
| greek-15 | Heracles | Ancient Greek myth | Retained | Lion skin and club identify Heracles. |
| greek-16 | Achilles | Myth · Trojan War | Retained | Armor and shield support the Trojan hero; myth label avoids invented lifespan. |
| greek-17 | Odysseus | Myth · Trojan War | Retained | Ship and sailor-like headwear support Odysseus. |
| greek-18 | Medusa | Ancient Greek myth | Retained | Snakes replace hair; anatomy and silhouette clearly read as Medusa. |
| greek-19 | Minotaur | Ancient Greek myth | Retained | Bull head and labyrinth support Minotaur. |
| greek-20 | Pegasus | Ancient Greek myth | Retained | White horse and readable wings support Pegasus. |
| greek-21 | Cerberus | Ancient Greek myth | Retained | Three separate dog heads remain identifiable in the crop. |
| greek-22 | Orpheus | Ancient Greek myth | Retained | Lyre and laurel support Orpheus. |
| greek-23 | Ariadne | Ancient Greek myth | Retained | Thread spool and maze support Ariadne. |
| greek-24 | Cronus | Ancient Greek myth | New · redrawn | Redrawn with sickle and throne; removed sundial and confusion with Chronos. |
| greek-25 | Prometheus | Ancient Greek myth | New | Fennel flame, chains and eagle support Prometheus. |
| greek-26 | Theseus | Ancient Greek myth | New | Red thread, sword and labyrinth support Theseus. |
| greek-27 | Jason | Ancient Greek myth | New | Golden ram fleece and Argo support Jason. |
| greek-28 | Circe | Ancient Greek myth | New | Potion cup and pig support Circe's transformation story. |
| greek-29 | Pandora | Ancient Greek myth | New · redrawn | Redrawn with a ceramic jar, dark mist and hope glowing inside; removed escaping butterfly. |

## Archived region cards

These 24 cards are only used by older saves/replays and are absent from new deals. Their original illustrations, IDs and captions are preserved. Each was rendered and reviewed for subject/crop/metadata consistency; mixed administrative eras are explicitly historical compatibility content.

| ID | Subject | Finding |
| --- | --- | --- |
| regions-0 | Auvergne-Rhône-Alpes | Snowy Alps, volcanic hills and cable car; merged-region date retained. |
| regions-1 | Bourgogne-Franche-Comté | Vines and geometric tiled roof; merged-region date retained. |
| regions-2 | Bretagne | Granite coast, lighthouse and sailboat; unchanged subject. |
| regions-3 | Centre-Val de Loire | Chambord and Loire; landmark construction date retained. |
| regions-4 | Corse | Genoese tower and mountains; old collectivity caption preserved for replay. |
| regions-5 | Grand Est | Cathedral, timbered town and vines; merger caption retained. |
| regions-6 | Hauts-de-France | Amiens-style cathedral, belfry and dunes; merger caption retained. |
| regions-7 | Île-de-France | Versailles and Paris; court milestone remains labelled. |
| regions-8 | Normandie | Étretat and apple orchard; reunification date retained. |
| regions-9 | Nouvelle-Aquitaine | Atlantic dune, pines and vineyard; merger date retained. |
| regions-10 | Occitanie | Carcassonne, brick architecture and sunflowers; merger date retained. |
| regions-11 | Pays de la Loire | Mechanical elephant and riverfront; planning-region date retained. |
| regions-12 | Provence-Alpes-Côte d’Azur | Lavender, village and calanque; landmark milestone retained. |
| regions-13 | Guadeloupe | Volcano, waterfall and hibiscus; department date retained. |
| regions-14 | Martinique | Volcano, Creole coast and sugarcane; department date retained. |
| regions-15 | Guyane | Rainforest, river and rocket; department date retained. |
| regions-16 | La Réunion | Lava crater and coast; department date retained. |
| regions-17 | Mayotte | Lagoon, mangroves and turtle; department date retained. |
| regions-18 | Alsace | Stork and canal; historical/merged status visible. |
| regions-19 | Lorraine | Nancy gates and yellow fruit; historical/merged status visible. |
| regions-20 | Bourgogne | Vineyard château and grapes; historical/merged status visible. |
| regions-21 | Champagne | Reims and sparkling wine; historical-fairs caption retained. |
| regions-22 | Picardie | Wetlands, birds and windmill; historical/merged status visible. |
| regions-23 | Auvergne | Rounded volcanic hill and dark-stone church; historical/merged status visible. |
