// Ripples puzzles, written for this game in English and French. Each puzzle
// has two starting clues outside the grid and two chains of associations. Step
// by step, the next word of each chain must share a row or a column with the
// other. Once every chain word is covered, the leftover words, read in grid
// order, sound out the missing last line of the dialogue.
export const CAMPAIGNS = {
  heist: {lang: 'en', title: 'The Butterfingers Heist Crew', blurb: 'Marge, Twitch and Lefty plan the perfect museum job. Nothing goes to plan.'},
  manor: {lang: 'en', title: 'The Haunted Manor', blurb: 'Agatha inherits a crumbling manor and its very sociable ghost, Sir Reginald.'},
  kitchen: {lang: 'en', title: 'Kitchen Brigade', blurb: 'Chef Paolo runs the busiest kitchen in town with one very nervous apprentice.'},
  gang: {lang: 'fr', title: 'Le Gang des Bras Cassés', blurb: 'Mémé Lulu, Bidule et Fifi préparent le casse du siècle. Ou presque.'},
  chateau: {lang: 'fr', title: 'Le Château hanté', blurb: 'Hortense hérite d’un château, de ses courants d’air et de son fantôme, le comte Gaston.'},
  cuisine: {lang: 'fr', title: 'Brigade en cuisine', blurb: 'Le chef Bernard, sa brigade et un commis très maladroit.'},
};

// The missing line is said by the last speaker, or by a final [name, null] entry.
const P = (id, campaign, title, start, a, b, rebus, answer, accept, sounds, dialogue) => {
  const speaker = dialogue.at(-1)[0], lines = dialogue.filter(([, line]) => line !== null);
  return {id, campaign, lang: CAMPAIGNS[campaign].lang, title, start, chains: [a, b], rebus, answer, accept, sounds, dialogue: lines, speaker};
};
const w = text => text.trim().split(/\s+/);

export const PUZZLES = [
  // The Butterfingers Heist Crew -------------------------------------------------
  P('heist-1', 'heist', 'Lost in the vents', ['MOON', 'BREAD'],
    w('STAR FISH CHIPS COMPUTER MOUSE CHEESE PIZZA OVEN GLOVE BOXING RING'),
    w('BUTTER FLY PAPER PLANE TICKET TRAIN STATION POLICE CAR WHEEL CHAIR'),
    w('WARE OAR EWE'), 'Where are you?', ['where are you'], 'WARE · OAR · EWE sounds like “Where are you?”',
    [['Marge', 'Right. Everyone into the air vents. Twitch, you go left.'], ['Twitch', 'Which left? There are three lefts in here.'], ['Lefty', 'I took the middle one. It smells of soup.'], ['Marge', 'Twitch? Twitch! Say something!']]),
  P('heist-2', 'heist', 'The watchman', ['HONEY', 'SNOW'],
    w('BEE HIVE QUEEN CROWN JEWEL THIEF JAIL BREAK FAST FOOD TRUCK'),
    w('MAN HOLE GOLF CLUB SANDWICH PICNIC BASKET BALL ROOM SERVICE STATION'),
    w('KNOT TWO KNIGHT'), 'Not tonight.', ['not tonight', 'not tonight!'], 'KNOT · TWO · KNIGHT sounds like “Not tonight.”',
    [['Lefty', 'Psst. The night watchman is asleep in his chair.'], ['Twitch', 'Should we tiptoe past?'], ['Marge', 'Lefty, ask him nicely if he plans to wake up.'], ['Lefty', 'Excuse me, sir, are you going to catch us?'], ['Watchman', '(snoring)']]),
  P('heist-3', 'heist', 'Locked out', ['SUN', 'TOOTH'],
    w('FLOWER POT TEA CUP BOARD GAME SHOW BUSINESS CARD TRICK TREAT'),
    w('BRUSH PAINT BALL FOOT PRINT FINGER NAIL POLISH SHOE LACE CURTAIN'),
    w('LETTUCE INN PLEAS'), 'Let us in, please!', ['let us in please', 'let us in, please'], 'LETTUCE · INN · PLEAS sounds like “Let us in, please!”',
    [['Marge', 'We made it out with the diamond. Now back inside the van.'], ['Twitch', 'Lefty has the keys.'], ['Lefty', 'I left the keys inside the van.'], ['Marge', '(knocking on the van window, to the parrot inside)']]),
  // The Haunted Manor -------------------------------------------------------------------
  P('manor-1', 'manor', 'A cold welcome', ['APPLE', 'FIRE'],
    w('PIE CHART MAP TREASURE CHEST DRAWER SOCK PUPPET STRING GUITAR ROCK'),
    w('ALARM CLOCK TOWER CASTLE GHOST STORY BOOK WORM HOLE BLACK BOARD'),
    w('EYE SEA EWE'), 'I see you!', ['i see you', 'i see you!'], 'EYE · SEA · EWE sounds like “I see you!”',
    [['Agatha', 'What a dusty old hall. Hello? Anyone here?'], ['Sir Reginald', 'Oooooh…'], ['Agatha', 'I know you’re behind the curtain. Your chains are rattling.'], ['Sir Reginald', 'Rats. Then I’ll hide in the wardrobe.'], ['Agatha', 'Too late, Sir Reginald.']]),
  P('manor-2', 'manor', 'A star is dead', ['PEANUT', 'DOOR'],
    w('BUTTER CUP CAKE BIRTHDAY PARTY HAT TRICK MAGIC WAND WIZARD BEARD'),
    w('BELL PEPPER SALT SEA SHELL TURTLE SLOW MOTION PICTURE FRAME WORK'),
    w('HALO HOLLY WOOD'), 'Hello, Hollywood!', ['hello hollywood', 'hello, hollywood'], 'HALO · HOLLY · WOOD sounds like “Hello, Hollywood!”',
    [['Agatha', 'Sir Reginald, why are you wearing sunglasses at midnight?'], ['Sir Reginald', 'A film crew is shooting a ghost movie in the manor.'], ['Agatha', 'And they cast you?'], ['Sir Reginald', 'As myself! I’ve rehearsed my first line all century.']]),
  P('manor-3', 'manor', 'The guests are coming', ['SPIDER', 'SNOW'],
    w('WEB SITE BUILDING BLOCK ICE CUBE SUGAR CANE CANDY FLOSS TOOTH'),
    w('FLAKE CORN POP MUSIC BOX OFFICE CHAIR ARM BAND WAGON WHEEL'),
    w('SIR PRIZE PARTY'), 'Surprise party!', ['surprise party', 'surprise party!'], 'SIR · PRIZE · PARTY sounds like “Surprise party!”',
    [['Agatha', 'Why is the ballroom dark? And why do I hear whispering?'], ['Sir Reginald', 'No reason. Please switch on the light.'], ['Agatha', 'Fine… oh! Forty ghosts in party hats!'], ['All the ghosts', '(throwing confetti)']]),
  // Kitchen Brigade ---------------------------------------------------------------------
  P('kitchen-1', 'kitchen', 'The dessert menu', ['KITCHEN', 'TOMATO'],
    w('SINK HOLE DONUT COFFEE BEAN JELLY FISH TANK TOP HAT'),
    w('SAUCE PAN CAKE WALK DOG HOUSE PLANT POT LUCK CHARM'),
    w('EYE SCREAM FOUR ICE CREAM'), 'I scream for ice cream!', ['i scream for ice cream', 'i scream for ice cream!'], 'EYE · SCREAM · FOUR · ICE · CREAM sounds like “I scream for ice cream!”',
    [['Chef Paolo', 'Apprentice! The freezer broke. The ice cream is soup.'], ['Apprentice', 'Oh no. Table four ordered six bowls.'], ['Chef Paolo', 'Then serve them soup and smile.'], ['Table four', '(banging spoons on the table)']]),
  P('kitchen-2', 'kitchen', 'The perfect steak', ['STEAK', 'LEMON'],
    w('KNIFE FORK LIFT ELEVATOR MUSIC NOTE BOOK SHELF LIFE JACKET POTATO'),
    w('JUICE ORANGE PEEL BANANA SPLIT SECOND HAND BAG TEA POT ROAST'),
    w('WHALE DUN SUN'), 'Well done, son!', ['well done son', 'well done, son'], 'WHALE · DUN · SUN sounds like “Well done, son!”',
    [['Apprentice', 'Chef, I cooked my first steak all by myself.'], ['Chef Paolo', 'How did the customer ask for it?'], ['Apprentice', 'Well done. It’s a little bit black.'], ['Chef Paolo', 'Then he gets exactly what he ordered.']]),
  P('kitchen-3', 'kitchen', 'Closing time', ['CHEF', 'WINTER'],
    w('HAT BOX LUNCH BREAK DANCE FLOOR LAMP POST OFFICE SPACE SHIP'),
    w('SCARF WOOL SHEEP DOG BONE FISH TANK WATER MELON SEED GARDEN'),
    w('HONEY AIM HOME'), 'Honey, I’m home!', ['honey im home', 'honey i am home', "honey, i'm home"], 'HONEY · AIM · HOME sounds like “Honey, I’m home!”',
    [['Chef Paolo', 'Kitchen clean. Pans hung. Lights off.'], ['Apprentice', 'Long day, Chef. Going home?'], ['Chef Paolo', 'Yes. My wife cooks tonight. I just eat.'], ['Chef Paolo', '(opening his front door)']]),
  // Le Gang des Bras Cassés ------------------------------------------------------------
  P('gang-1', 'gang', 'Le signal', ['SOLEIL', 'PORTE'],
    w('LUNETTES VUE MER VAGUE SURF PLANCHE BOIS FEU POMPIER CAMION ROUTE'),
    w('MONNAIE PIÈCE THÉÂTRE RIDEAU FENÊTRE VITRE VERRE EAU BAIN MOUSSE CHOCOLAT'),
    w('ÎLE LAIT TAON'), 'Il est temps.', ['il est temps'], 'ÎLE · LAIT · TAON se lit « Il est temps ».',
    [['Mémé Lulu', 'Le gardien du musée vient de partir manger.'], ['Bidule', 'On attend quoi, Mémé ?'], ['Fifi', 'Le signal. Mémé tricote tant qu’on ne doit pas bouger.'], ['Mémé Lulu', '(rangeant ses aiguilles)']]),
  P('gang-2', 'gang', 'Le coffre', ['NUIT', 'CHAT'],
    w('ÉTOILE MER BATEAU VOILE MARIÉE ROBE CHAMBRE LIT DRAP FANTÔME CHÂTEAU'),
    w('SOURIS ORDINATEUR ÉCRAN CINÉMA POP-CORN MAÏS POULET ŒUF PÂQUES CLOCHE ÉGLISE'),
    w('PAS MAIN TENANT'), 'Pas maintenant !', ['pas maintenant'], 'PAS · MAIN · TENANT se lit « Pas maintenant ! »',
    [['Bidule', 'Mémé, j’ai trouvé la combinaison du coffre !'], ['Fifi', 'Et moi, j’ai trouvé un sandwich dans la cuisine du gardien.'], ['Bidule', 'Fifi, tu veux la moitié ?'], ['Mémé Lulu', '(l’oreille collée au coffre)']]),
  P('gang-3', 'gang', 'La statue', ['BANQUE', 'HIVER'],
    w('COFFRE VOITURE ROUE SECOURS AMBULANCE SIRÈNE POISSON AVRIL PRINTEMPS FLEUR BOUQUET'),
    w('NEIGE BONHOMME CAROTTE LAPIN CHAPEAU MAGICIEN BAGUETTE PAIN BEURRE TARTINE CONFITURE'),
    w('AILE LAIT PARTIE'), 'Elle est partie !', ['elle est partie'], 'AILE · LAIT · PARTIE se lit « Elle est partie ! »',
    [['Mémé Lulu', 'Fifi, tu devais surveiller la statue de la déesse.'], ['Fifi', 'Je l’ai quittée des yeux une minute, pour éternuer.'], ['Bidule', 'Et son socle est vide…'], ['Fifi', 'Oups.']]),
  // Le Château hanté -----------------------------------------------------------------------
  P('chateau-1', 'chateau', 'Le fantôme philosophe', ['VAMPIRE', 'TOUR'],
    w('CHAUVE-SOURIS GROTTE OURS MIEL ABEILLE RUCHE REINE COURONNE ROI LION JUNGLE'),
    w('HORLOGE AIGUILLE FIL TÉLÉPHONE PORTABLE BATTERIE CUISINE FOUR PIZZA FROMAGE SOURIS'),
    w('SET LA VIS'), 'C’est la vie.', ['c est la vie', 'cest la vie'], 'SET · LA · VIS se lit « C’est la vie ».',
    [['Hortense', 'Comte Gaston, vous hantez ce château depuis trois cents ans.'], ['Le comte', 'Trois cent douze, très chère.'], ['Hortense', 'Ça ne vous ennuie pas de traverser les murs tous les soirs ?'], ['Le comte', '(haussant ses épaules transparentes)']]),
  P('chateau-2', 'chateau', 'Courants d’air', ['BOUGIE', 'ARAIGNÉE'],
    w('GÂTEAU ANNIVERSAIRE CADEAU PAPIER CISEAUX COIFFEUR PEIGNE CHEVEUX BROSSE DENTS SOURIRE'),
    w('TOILE TENTE CIRQUE CLOWN NEZ ROUGE TOMATE SAUCE PÂTES ITALIE BOTTE'),
    w('ÎLE FÉE FROID'), 'Il fait froid !', ['il fait froid'], 'ÎLE · FÉE · FROID se lit « Il fait froid ! »',
    [['Hortense', 'Pourquoi toutes les fenêtres sont-elles ouvertes ?'], ['Le comte', 'Un fantôme aime les courants d’air.'], ['Hortense', 'Mes dents claquent, mon thé a gelé…'], ['Le comte', 'Vous disiez ?'], ['Hortense', null]]),
  P('chateau-3', 'chateau', 'Le vampire invité', ['VIOLON', 'ÉCOLE'],
    w('CORDE NŒUD PAPILLON FLEUR JARDIN NAIN BLANCHE-NEIGE POMME TARTE CRÈME CHANTILLY'),
    w('CARTABLE CRAYON COULEUR ARC-EN-CIEL PLUIE GOUTTE EAU ROBINET LAVABO SALLE CLASSE'),
    w('GEAI TRAIT FIN'), 'J’ai très faim.', ['j ai tres faim', 'jai tres faim'], 'GEAI · TRAIT · FIN se lit « J’ai très faim ».',
    [['Le comte', 'Hortense, je vous présente mon vieil ami Vlad.'], ['Hortense', 'Enchantée. Vous restez dîner ?'], ['Vlad', 'Avec plaisir. Il n’y a que de la soupe ?'], ['Vlad', '(regardant le cou d’Hortense)']]),
  // Brigade en cuisine --------------------------------------------------------------------
  P('cuisine-1', 'cuisine', 'La dégustation', ['BOULANGER', 'ORANGE'],
    w('PAIN CHOCOLAT NOIR BLANC NEIGE SKI MONTAGNE CHALET FONDUE FROMAGE VACHE'),
    w('JUS CITRON JAUNE POUSSIN POULE ŒUF COQUE BATEAU PORT PÊCHE CANNE'),
    w('SEPT SCIE BON'), 'C’est si bon !', ['c est si bon', 'cest si bon'], 'SEPT · SCIE · BON se lit « C’est si bon ! »',
    [['Le chef Bernard', 'Le critique gastronomique goûte ma tarte.'], ['Le commis', 'Il ferme les yeux. Il ne dit rien.'], ['Le chef Bernard', 'Il reprend une part… et une troisième…'], ['Le critique', '(la bouche pleine)']]),
  P('cuisine-2', 'cuisine', 'La catastrophe', ['TOMATE', 'LUNE'],
    w('KETCHUP FRITES BELGIQUE BRUXELLES CHOU FLEUR ABEILLE MIEL OURS PELUCHE'),
    w('CROISSANT CAFÉ TASSE THÉ VERT POMME TERRE PLANÈTE MARS AVRIL'),
    w('JEU SUIE DÉ SOLE CHEF'), 'Je suis désolé, chef !', ['je suis desole chef', 'je suis desole, chef'], 'JEU · SUIE · DÉ · SOLE · CHEF se lit « Je suis désolé, chef ! »',
    [['Le chef Bernard', 'Qui a renversé la pièce montée sur le carrelage ?'], ['La brigade', '(tout le monde regarde le commis)'], ['Le commis', 'J’ai glissé sur une épluchure de banane…'], ['Le commis', '(tout petit)']]),
  P('cuisine-3', 'cuisine', 'Le pourboire', ['SALADE', 'CLOCHE'],
    w('TOMATE ROUGE FEU CHEMINÉE NOËL SAPIN FORÊT LOUP MOUTON LAINE PULL'),
    w('VACHE LAIT CAFÉ CROISSANT LUNE ÉTOILE CINÉMA FILM PHOTO ALBUM CHANSON'),
    w('MILLE MER SCIE'), 'Mille mercis !', ['mille mercis', 'mille merci'], 'MILLE · MER · SCIE se lit « Mille mercis ! »',
    [['Le commis', 'Chef, une cliente a laissé un énorme pourboire.'], ['Le chef Bernard', 'Pour toute la brigade ?'], ['Le commis', 'Pour moi, parce que j’ai porté son manteau.'], ['Le chef Bernard', 'Alors dis-lui merci.'], ['Le commis', '(à la cliente)']]),
];
export const PUZZLE = Object.fromEntries(PUZZLES.map(puzzle => [puzzle.id, puzzle]));
export const fold = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[’'`]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
