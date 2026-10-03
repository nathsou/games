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
  ...deck, id, atlas: `assets/${id}.png`,
  cards: deck.cards.map(([name, subtitle], index) => ({id: `${id}-${index}`, deck: id, index, name, subtitle})),
}]));
export const CARDS = Object.fromEntries(Object.values(DECKS).flatMap(d => d.cards).map(c => [c.id, c]));
export const THEME_IDEAS = [
  ['Fairy tales', 'Witches, wolves, crowns, forests: familiar stories with wonderfully ambiguous clues.'],
  ['Natural world', 'Animals, plants and fungi. Shapes, habitats and colors make this an accessible first deck.'],
  ['Space & discovery', 'Astronauts, astronomers, inventors and explorers, crossing history with science.'],
  ['World folklore', 'Tricksters, spirits and legendary creatures from many storytelling traditions.'],
  ['Arts & literature', 'Painters, composers, writers and fictional archetypes: clues that jump between media.'],
  ['Everyday oddities', 'A lighthouse, a teapot, a cactus, a violin. Objects make mixed-deck play delightfully strange.'],
];
