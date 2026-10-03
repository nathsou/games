import {CARD_CONTEXT, REGION_2015_CONTEXT} from './context.js';

// Preserve the original subjects and artwork when opening an older saved game.
const legacyRegions = [
      ['Auvergne-Rhône-Alpes', 'Alpine peaks and volcanic hills'], ['Bourgogne-Franche-Comté', 'Vineyards and tiled roofs'], ['Bretagne', 'Atlantic coast and lighthouses'],
      ['Centre-Val de Loire', 'Loire castles and river'], ['Corse', 'Mediterranean island and mountains'], ['Grand Est', 'Cathedrals and timbered towns'],
      ['Hauts-de-France', 'Belfries and northern coast'], ['Île-de-France', 'Paris and Versailles'], ['Normandie', 'Chalk cliffs and apple orchards'],
      ['Nouvelle-Aquitaine', 'Atlantic dunes and vineyards'], ['Occitanie', 'Medieval walls and sunflowers'], ['Pays de la Loire', 'Loire river and Nantes'],
      ["Provence-Alpes-Côte d’Azur", 'Lavender and Mediterranean coast'], ['Guadeloupe', 'Caribbean islands and volcano'], ['Martinique', 'Caribbean island and Mount Pelée'],
      ['Guyane', 'Amazonian forest and spaceport'], ['La Réunion', 'Indian Ocean volcanic island'], ['Mayotte', 'Indian Ocean lagoon and mangroves'],
      ['Alsace', 'Historic region · Storks and canals'], ['Lorraine', 'Historic region · Nancy and mirabelles'], ['Bourgogne', 'Historic region · Vineyards and abbeys'],
      ['Champagne', 'Historic region · Reims and sparkling wine'], ['Picardie', 'Historic region · Somme Bay'], ['Auvergne', 'Historic region · Volcanic uplands'],
    ];
export const LEGACY_REGION_ATLAS = 'assets/regions.webp';

const definitions = {
  french: {
    name: 'French History', subtitle: 'Crowns, revolutions & brilliant minds', color: '#e68b68', symbol: '⚜',
    cards: [
      ['Vercingetorix', 'Gallic leader'], ['Clovis', 'King of the Franks'], ['Charlemagne', 'Emperor of the West'],
      ['Eleanor of Aquitaine', 'Queen and patron'], ['Louis IX', 'King of France'], ['Joan of Arc', 'The Maid of Orléans'],
      ['Francis I', 'Renaissance king'], ['Catherine de Medici', 'Queen and regent'], ['Henry IV', 'King of France'],
      ['Cardinal Richelieu', 'Cardinal and statesman'], ['Louis XIV', 'The Sun King'], ['Molière', 'Playwright and actor'],
      ['Voltaire', 'Enlightenment writer'], ['Émilie du Châtelet', 'Physicist and mathematician'], ['Marie Antoinette', 'Queen of France'],
      ['Olympe de Gouges', 'Writer and activist'], ['Robespierre', 'Revolutionary'], ['Napoleon', 'Emperor and general'],
      ['Joséphine', 'Empress of the French'], ['Victor Hugo', 'Poet and novelist'], ['Louis Pasteur', 'Chemist and microbiologist'],
      ['Marie Curie', 'Physicist and chemist'], ['Joséphine Baker', 'Performer and resistance agent'], ['Charles de Gaulle', 'General and president'],
    ],
  },
  global: {
    name: 'Global History', subtitle: 'A table spanning centuries & continents', color: '#69c7c2', symbol: '◎',
    cards: [
      ['Cleopatra', 'Queen of Egypt'], ['Julius Caesar', 'Roman general and statesman'], ['Hatshepsut', 'Pharaoh of Egypt'],
      ['Alexander the Great', 'King of Macedon'], ['Confucius', 'Chinese philosopher'], ['Qin Shi Huang', 'First emperor of China'],
      ['Mansa Musa', 'Emperor of Mali'], ['Genghis Khan', 'Founder of the Mongol Empire'], ['Saladin', 'Sultan of Egypt and Syria'],
      ['Ibn Battuta', 'Moroccan traveler'], ['Zheng He', 'Chinese admiral'], ['Pachacuti', 'Inca emperor'],
      ['Leonardo da Vinci', 'Artist and inventor'], ['Elizabeth I', 'Queen of England'], ['William Shakespeare', 'Playwright and poet'],
      ['Isaac Newton', 'Physicist and mathematician'], ['Ada Lovelace', 'Mathematician and computing pioneer'], ['Harriet Tubman', 'Abolitionist'],
      ['Frederick Douglass', 'Abolitionist and writer'], ['Mahatma Gandhi', 'Indian independence leader'], ['Frida Kahlo', 'Mexican painter'],
      ['Albert Einstein', 'Theoretical physicist'], ['Nelson Mandela', 'South African president'], ['Wangari Maathai', 'Kenyan environmentalist'],
    ],
  },
  scientists: {
    name: 'Scientists', subtitle: 'Equations, inventions & great discoveries', color: '#9ab780', symbol: '⌁',
    cards: [
      ['Archimedes', 'Mathematician and inventor'], ['Hypatia', 'Mathematician and philosopher'], ['Al-Khwarizmi', 'Mathematician and astronomer'],
      ['Ibn al-Haytham', 'Physicist and pioneer of optics'], ['Leonardo da Vinci', 'Artist and engineer'], ['Galileo Galilei', 'Astronomer and physicist'],
      ['Isaac Newton', 'Physicist and mathematician'], ['Émilie du Châtelet', 'Physicist and mathematician'], ['Michael Faraday', 'Physicist and chemist'],
      ['James Clerk Maxwell', 'Physicist'], ['Charles Darwin', 'Naturalist and biologist'], ['Nikola Tesla', 'Electrical engineer and inventor'],
      ['Ada Lovelace', 'Mathematician and computing pioneer'], ['Louis Pasteur', 'Chemist and microbiologist'], ['Marie Curie', 'Physicist and chemist'],
      ['Albert Einstein', 'Theoretical physicist'], ['Emmy Noether', 'Mathematician'], ['Srinivasa Ramanujan', 'Mathematician'],
      ['Alan Turing', 'Mathematician and computer scientist'], ['Grace Hopper', 'Computer scientist and naval officer'], ['Rosalind Franklin', 'Chemist and crystallographer'],
      ['Katherine Johnson', 'Mathematician'], ['Chien-Shiung Wu', 'Experimental physicist'], ['Hedy Lamarr', 'Inventor and actor'],
    ],
  },
  philosophers: {
    name: 'Philosophers', subtitle: 'Big questions & unexpected connections', color: '#d9ad76', symbol: '◈',
    cards: [
      ['Socrates', 'Greek philosopher'], ['Plato', 'Greek philosopher'], ['Aristotle', 'Greek philosopher and polymath'],
      ['Epicurus', 'Greek philosopher'], ['Diogenes', 'Greek Cynic philosopher'], ['Hypatia', 'Mathematician and philosopher'],
      ['Confucius', 'Chinese philosopher'], ['Laozi', 'Traditional Daoist sage'], ['Zhuangzi', 'Chinese Daoist philosopher'],
      ['Mencius', 'Chinese Confucian philosopher'], ['Nāgārjuna', 'Indian Buddhist philosopher'], ['Ibn Sina', 'Persian philosopher and physician'],
      ['Ibn Rushd', 'Andalusian philosopher and physician'], ['Thomas Aquinas', 'Italian philosopher and theologian'], ['Niccolò Machiavelli', 'Florentine political thinker'],
      ['René Descartes', 'French philosopher and mathematician'], ['Baruch Spinoza', 'Dutch philosopher'], ['John Locke', 'English philosopher'],
      ['David Hume', 'Scottish philosopher'], ['Immanuel Kant', 'German philosopher'], ['Mary Wollstonecraft', 'English philosopher and writer'],
      ['Friedrich Nietzsche', 'German philosopher'], ['Simone de Beauvoir', 'French philosopher and writer'], ['Hannah Arendt', 'Political thinker'],
    ],
  },
  writers: {
    name: 'Writers', subtitle: 'Poets, novelists & storytellers', color: '#d99aaa', symbol: '¶',
    cards: [
      ['Homer', 'Ancient Greek epic poet'], ['Sappho', 'Ancient Greek lyric poet'], ['Dante Alighieri', 'Italian poet'],
      ['Geoffrey Chaucer', 'English poet'], ['Miguel de Cervantes', 'Spanish novelist'], ['William Shakespeare', 'Playwright and poet'],
      ['Molière', 'Playwright and actor'], ['Jean de La Fontaine', 'French fabulist'], ['Voltaire', 'Enlightenment writer'],
      ['Johann Wolfgang von Goethe', 'German poet and novelist'], ['Jane Austen', 'English novelist'], ['Mary Shelley', 'English novelist'],
      ['Victor Hugo', 'Poet and novelist'], ['Alexandre Dumas', 'French novelist'], ['George Sand', 'French novelist'],
      ['Fyodor Dostoevsky', 'Russian novelist'], ['Leo Tolstoy', 'Russian novelist'], ['Charles Dickens', 'English novelist'],
      ['Oscar Wilde', 'Irish playwright and poet'], ['Virginia Woolf', 'English novelist'], ['Franz Kafka', 'Prague-born writer'],
      ['Rabindranath Tagore', 'Bengali poet and polymath'], ['Jorge Luis Borges', 'Argentine writer'], ['Toni Morrison', 'American novelist'],
    ],
  },
  singers: {
    name: 'Singers', subtitle: 'Iconic voices, stages & unmistakable styles', color: '#ec99bd', symbol: '♪', preview: 8,
    cards: [
      ['Édith Piaf', 'French chanson singer'], ['Charles Aznavour', 'French-Armenian chanson singer'], ['Jacques Brel', 'Belgian chanson singer'],
      ['Barbara', 'French singer and pianist'], ['Georges Brassens', 'French singer and guitarist'], ['Johnny Hallyday', 'French rock singer'],
      ['Michael Jackson', 'Pop singer and dancer'], ['Prince', 'Funk and pop musician'], ['Freddie Mercury', 'Rock singer and pianist'],
      ['Beyoncé', 'Pop and R&B singer'], ['Adele', 'Soul and pop singer'], ['Taylor Swift', 'Country and pop songwriter'],
      ['Aretha Franklin', 'Soul singer and pianist'], ['Whitney Houston', 'Pop and R&B singer'], ['Nina Simone', 'Jazz and soul singer-pianist'],
      ['Ella Fitzgerald', 'Jazz singer'], ['Bob Marley', 'Jamaican reggae musician'], ['Elvis Presley', 'Rock and roll singer'],
      ['David Bowie', 'Rock musician and actor'], ['Shakira', 'Colombian pop singer'], ['Céline Dion', 'Canadian pop singer'],
      ['Björk', 'Icelandic singer and composer'], ['Stromae', 'Belgian singer and producer'], ['Bad Bunny', 'Puerto Rican Latin music artist'],
    ],
  },
  actors: {
    name: 'Actors', subtitle: 'Screen legends & unforgettable faces', color: '#e4bc87', symbol: '▣', preview: 3,
    cards: [
      ['Charlie Chaplin', 'Silent-film actor and director'], ['Buster Keaton', 'Silent-film actor and stunt performer'], ['Marilyn Monroe', 'American actor and singer'],
      ['Audrey Hepburn', 'British actor'], ['James Dean', 'American actor'], ['Marlon Brando', 'American actor'],
      ['Alain Delon', 'French actor'], ['Jean-Paul Belmondo', 'French actor'], ['Catherine Deneuve', 'French actor'],
      ['Louis de Funès', 'French comedy actor'], ['Omar Sy', 'French actor'], ['Marion Cotillard', 'French actor'],
      ['Meryl Streep', 'American actor'], ['Robert De Niro', 'American actor'], ['Morgan Freeman', 'American actor'],
      ['Denzel Washington', 'American actor and director'], ['Keanu Reeves', 'Canadian actor'], ['Michelle Yeoh', 'Malaysian actor'],
      ['Jackie Chan', 'Hong Kong actor and martial artist'], ['Bruce Lee', 'Actor and martial artist'], ['Shah Rukh Khan', 'Indian actor'],
      ['Amitabh Bachchan', 'Indian actor'], ['Viola Davis', 'American actor'], ['Tilda Swinton', 'Scottish actor'],
    ],
  },
  cities: {
    name: 'Cities', subtitle: 'Skylines, streets & familiar landmarks', color: '#82c8da', symbol: '⌂', preview: 0, kind: 'places',
    cards: [
      ['Paris', 'France'], ['Rome', 'Italy'], ['London', 'United Kingdom'],
      ['Berlin', 'Germany'], ['Tokyo', 'Japan'], ['New York City', 'United States'],
      ['Amsterdam', 'Netherlands'], ['Venice', 'Italy'], ['Barcelona', 'Spain'],
      ['Athens', 'Greece'], ['Istanbul', 'Turkey'], ['Moscow', 'Russia'],
      ['Cairo', 'Egypt'], ['Marrakesh', 'Morocco'], ['Dubai', 'United Arab Emirates'],
      ['Mumbai', 'India'], ['Beijing', 'China'], ['Seoul', 'South Korea'],
      ['Singapore', 'City-state in Southeast Asia'], ['Sydney', 'Australia'], ['Rio de Janeiro', 'Brazil'],
      ['Mexico City', 'Mexico'], ['Cape Town', 'South Africa'], ['San Francisco', 'United States'],
    ],
  },
  countries: {
    name: 'Countries', subtitle: 'Landscapes, cultures & connections worldwide', color: '#91c89b', symbol: '◎', preview: 7, kind: 'places',
    cards: [
      ['France', 'Western Europe'], ['Italy', 'Southern Europe'], ['United Kingdom', 'Northwestern Europe'],
      ['Germany', 'Central Europe'], ['Spain', 'Southwestern Europe'], ['Greece', 'Southeastern Europe'],
      ['Norway', 'Northern Europe'], ['Japan', 'East Asia'], ['China', 'East Asia'],
      ['India', 'South Asia'], ['South Korea', 'East Asia'], ['Indonesia', 'Southeast Asia'],
      ['Turkey', 'Europe and West Asia'], ['Saudi Arabia', 'West Asia'], ['Egypt', 'North Africa and Sinai'],
      ['Morocco', 'North Africa'], ['Kenya', 'East Africa'], ['South Africa', 'Southern Africa'],
      ['United States', 'North America'], ['Canada', 'North America'], ['Mexico', 'North America'],
      ['Brazil', 'South America'], ['Australia', 'Oceania'], ['New Zealand', 'Oceania'],
    ],
  },
  regions: {
    name: 'French Regions', subtitle: 'The 27 regions of France in 2015', color: '#d1bb83', symbol: '◒', preview: 3, kind: 'places',
    atlas:'assets/regions-2015.webp', columns:6, rows:5, cardPrefix:'regions-2015',
    description:'One card for each region as it stood on 31 December 2015: 22 metropolitan regions, including Corsica, and five overseas regions. No post-2016 mergers.',
    cards: [
      ['Alsace', 'Storks, timbered houses and canals'], ['Aquitaine', 'Atlantic dunes and Bordeaux vineyards'], ['Auvergne', 'Volcanic peaks and lava-stone churches'],
      ['Basse-Normandie', 'Mont Saint-Michel and tidal bays'], ['Bourgogne', 'Vineyards and stone châteaux'], ['Bretagne', 'Atlantic coast and lighthouses'],
      ['Centre-Val de Loire', 'Loire castles and river'], ['Champagne-Ardenne', 'Reims, vineyards and Ardennes forests'], ['Corse', 'Mediterranean island and mountains'],
      ['Franche-Comté', 'Jura hills, citadel and Comté cheese'], ['Haute-Normandie', 'Chalk cliffs, Rouen and the Seine'], ['Île-de-France', 'Paris and Versailles'],
      ['Languedoc-Roussillon', 'Carcassonne and Mediterranean coast'], ['Limousin', 'Porcelain and chestnut forests'], ['Lorraine', 'Nancy gates and mirabelle plums'],
      ['Midi-Pyrénées', 'Toulouse, Garonne and Pyrenean peaks'], ['Nord-Pas-de-Calais', 'Belfries, mining hills and dunes'], ['Pays de la Loire', 'Nantes and the lower Loire'],
      ['Picardie', 'Amiens cathedral and Somme Bay'], ['Poitou-Charentes', 'La Rochelle and Marais Poitevin'], ['Provence-Alpes-Côte d’Azur', 'Lavender and Mediterranean coast'],
      ['Rhône-Alpes', 'Mont Blanc, Lyon and cable cars'], ['Guadeloupe', 'Caribbean islands and La Soufrière'], ['Guyane', 'Amazonian forest and spaceport'],
      ['Martinique', 'Caribbean island and Mount Pelée'], ['La Réunion', 'Indian Ocean volcano and lava'], ['Mayotte', 'Indian Ocean lagoon and mangroves'],
    ],
  },
  greek: {
    name: 'Greek Mythology', subtitle: 'Gods, monsters & dangerously good clues', color: '#b5a3ec', symbol: '✦',
    cards: [
      ['Zeus', 'God of the sky and thunder'], ['Hera', 'Goddess of marriage'], ['Poseidon', 'God of the sea'],
      ['Demeter', 'Goddess of harvest'], ['Athena', 'Goddess of wisdom'], ['Apollo', 'God of music and prophecy'],
      ['Artemis', 'Goddess of the hunt'], ['Ares', 'God of war'], ['Aphrodite', 'Goddess of love'],
      ['Hephaestus', 'God of the forge'], ['Hermes', 'Messenger of the gods'], ['Dionysus', 'God of wine and theater'],
      ['Hades', 'God of the underworld'], ['Persephone', 'Queen of the underworld'], ['Hestia', 'Goddess of the hearth'],
      ['Heracles', 'Hero of twelve labors'], ['Achilles', 'Hero of the Trojan War'], ['Odysseus', 'King of Ithaca'],
      ['Medusa', 'The snake-haired Gorgon'], ['Minotaur', 'Monster of the labyrinth'], ['Pegasus', 'The winged horse'],
      ['Cerberus', 'Three-headed guardian'], ['Orpheus', 'Legendary musician'], ['Ariadne', 'Keeper of the guiding thread'],
    ],
  },
};

export const DECKS = Object.fromEntries(Object.entries(definitions).map(([id, deck]) => [id, {
  ...deck, id, kind: deck.kind || 'people', atlas: deck.atlas || `assets/${id}.webp`, columns:deck.columns||6, rows:deck.rows||4,
  cards: deck.cards.map(([name, subtitle], index) => ({id: `${deck.cardPrefix||id}-${index}`, deck: id, index, name, subtitle, ...(id==='regions'?REGION_2015_CONTEXT:CARD_CONTEXT)[name]})),
}]));
export const CARDS = Object.fromEntries([...Object.values(DECKS).flatMap(d => d.cards),
  ...legacyRegions.map(([name,subtitle],index)=>({id:`regions-${index}`,deck:'regions',index,name,subtitle,...CARD_CONTEXT[name],atlas:LEGACY_REGION_ATLAS,columns:6,rows:4}))].map(c => [c.id,c]));
export const THEME_IDEAS = [
  ['Fairy tales', 'Witches, wolves, crowns, forests: familiar stories with wonderfully ambiguous clues.'],
  ['Natural world', 'Animals, plants and fungi. Shapes, habitats and colors make this an accessible first deck.'],
  ['Space & discovery', 'Astronauts, astronomers, inventors and explorers, crossing history with science.'],
  ['World folklore', 'Tricksters, spirits and legendary creatures from many storytelling traditions.'],
  ['Arts & literature', 'Painters, composers, writers and fictional archetypes: clues that jump between media.'],
  ['Everyday oddities', 'A lighthouse, a teapot, a cactus, a violin. Objects make mixed-deck play delightfully strange.'],
];
