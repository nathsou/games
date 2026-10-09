// Cover Story word lists. One word per line: the board word, then words it
// brings to mind. The associations are what the offline bot knows: it gives
// clues that several of its words share and guesses words linked to a clue.
// Both lists were written for this game; the French one is not a translation.
export const PACKS = {
  all: {en: 'Classic · every word', fr: 'Classique · tous les mots'},
  nature: {en: 'Nature & animals', fr: 'Nature et animaux'},
  home: {en: 'Home & food', fr: 'Maison et cuisine'},
  places: {en: 'Places & travel', fr: 'Lieux et voyages'},
  science: {en: 'Science & body', fr: 'Sciences et corps'},
  culture: {en: 'Culture & fun', fr: 'Culture et loisirs'},
};
export const LANGS = {en: 'English', fr: 'Français'};

const RAW = {en: `
# nature
bat: night cave wing vampire baseball blind fly dracula animal
bear: forest honey teddy grizzly polar brown claw winter animal
bee: honey hive sting yellow buzz flower insect queen
crane: bird construction lift tall neck origami machine
duck: pond bird quack feather dodge water egg
eagle: bird flag america eye prey feather mountain wing
fox: forest red sly tail hunt clever animal den
horse: ride saddle race farm stable hoof gallop chess animal
mouse: computer cheese tiny click rodent cat trap animal
spider: web eight leg insect fear silk
whale: ocean giant blue sea mammal swim animal
shark: ocean teeth fin jaws fish predator swim sea
snake: poison venom python cobra scale charmer animal
owl: night wise bird hoot feather eye forest
wolf: pack howl moon forest wild hunt grey animal
lion: king mane africa roar cat jungle zoo pride
monkey: banana jungle tree zoo climb tail ape
turtle: shell slow sea ninja egg swim
frog: pond green jump prince toad croak water
tree: forest wood leaf branch root green oak family
rose: flower red thorn love garden petal pink
grass: green lawn field cow garden mow
leaf: tree green autumn fall branch paper
river: water flow bank fish bridge boat stream
mountain: peak snow climb high rock alps everest
volcano: lava fire eruption mountain ash hot island
desert: sand dry hot camel cactus sahara sun
island: sea beach palm treasure ocean pirate
forest: tree wood wolf green hunt leaf dark
ocean: sea water blue wave whale ship deep
storm: rain wind thunder cloud lightning weather
snow: cold white winter ski flake ice mountain
rain: water cloud umbrella wet storm drop weather
moon: night space sky star wolf full crater astronaut
sun: light hot sky star day yellow beach summer
star: sky night space light hollywood shine moon
cloud: sky rain white storm computer weather
ice: cold water winter skate cube frozen white
fire: hot flame burn red smoke dragon
wind: storm sail blow air kite mill weather
egg: chicken breakfast shell easter bird yolk
feather: bird light pen wing pillow hat
web: spider internet net silk site
root: tree plant ground carrot square
seed: plant garden grow apple flower
apple: fruit tree red pie computer newton
banana: fruit yellow monkey peel split
mushroom: forest soup pizza poison cap
cactus: desert spine plant dry mexico
# home
bread: bakery butter toast flour sandwich breakfast
cheese: mouse milk pizza france cow slice
cake: birthday party sugar candle chocolate bakery
chocolate: sweet cocoa cake brown easter bar
pie: apple bake pizza pastry slice math
soup: spoon bowl hot tomato kitchen
salt: sea pepper kitchen white mine
sugar: sweet cake candy white coffee
pepper: salt spice hot red green
coffee: cup morning bean brown cafe breakfast
tea: cup leaf china green kettle british
milk: cow white cheese bottle breakfast
wine: grape red france bottle glass vineyard
glass: window cup wine mirror clear bottle
plate: dish kitchen food table license
fork: knife spoon kitchen table road
knife: fork kitchen sharp blade cut
pan: kitchen cook fry pot
oven: kitchen bake hot bread pizza
fridge: kitchen cold milk ice magnet
table: chair kitchen leg dinner wood
chair: table sit wood leg king
bed: sleep pillow night bedroom
door: house key lock open knock window
window: glass house door computer open
key: lock door piano music car code
lock: key door safe chain
lamp: light bulb night desk
mirror: glass face reflection bathroom
clock: time hour hand wall alarm
bell: ring church school door sound
candle: light wax fire birthday cake
pillow: bed sleep feather soft
roof: house top rain tile cat
wall: house brick paint china street
garden: flower plant grass tree house
ladder: climb tall step roof
broom: clean witch sweep floor
soap: wash clean bath bubble
towel: bath dry beach bathroom
box: cardboard gift package square
basket: picnic ball fruit egg
bottle: glass wine milk water message
cup: tea coffee world trophy kitchen
spoon: soup fork kitchen silver
honey: bee sweet bear yellow
pizza: cheese italy oven slice tomato
tomato: red fruit sauce pizza soup
lemon: yellow sour fruit juice
onion: cry kitchen layer soup vegetable
carrot: rabbit orange vegetable root
# places
paris: france eiffel city capital europe
london: england city capital bridge queen
rome: italy city empire capital ancient
egypt: pyramid nile desert pharaoh africa ancient
china: wall asia tea panda dragon
japan: asia sushi island tokyo samurai
india: asia curry elephant tiger
brazil: football carnival amazon america
mexico: cactus america taco desert
africa: lion elephant desert continent
america: country flag eagle president
canada: maple cold snow america
australia: kangaroo island continent beach
moscow: russia capital cold city
venice: italy boat canal city carnival
bridge: river cross road london
castle: king queen tower knight
tower: tall castle eiffel london
church: bell cross religion wedding
school: teacher student class bell
hospital: doctor nurse sick health
bank: money river account safe
hotel: room travel bed holiday
museum: art history painting statue
port: ship boat sea harbor wine
station: train space bus police
airport: plane travel flight
road: car street way travel
street: road city house car
beach: sand sea sun summer holiday
camp: tent fire scout summer
farm: cow animal horse field tractor
jungle: tree monkey tiger wild
cave: bat dark rock bear
temple: religion ancient asia
pyramid: egypt ancient tomb triangle
palace: king queen royal castle
prison: jail crime cell guard
market: buy sell food stock
park: tree garden bench car
ship: boat sea ocean sail captain
train: rail station travel track
plane: fly airport sky wing travel
car: road drive wheel engine
bus: road school station ticket
bike: wheel ride pedal tour
boat: sea river sail ship water
map: travel world road treasure
ticket: travel train cinema bus
suitcase: travel holiday hotel
passport: travel country border
# science
computer: screen keyboard mouse internet
robot: machine metal android future
rocket: space launch moon fire
satellite: space orbit moon phone
laser: light beam red weapon
magnet: metal attract north fridge
atom: tiny bomb nucleus energy
battery: energy phone power charge
engine: car motor power fuel machine
screen: computer phone film television
phone: call screen mobile
camera: photo picture lens film
radio: music news wave sound
television: screen show film news
virus: computer sick flu cell
cell: prison phone biology body blood
brain: head think smart nerve body
heart: love blood body red
blood: red heart vampire body
bone: skeleton dog body skull
skeleton: bone halloween skull body
tooth: mouth dentist white bite body
eye: see vision look camera body
hand: finger glove clock help body
foot: shoe ball leg toe body
nose: face smell elephant body
microscope: tiny lab cell glass lens
telescope: star space lens sky
planet: space earth mars orbit
comet: space tail star ice
gold: metal money yellow ring
iron: metal steel clothes
diamond: ring jewel shine hard
oil: car fuel cook black
gas: fuel car cloud
code: secret computer password key
internet: web computer network
game: play fun board video
chip: computer potato fish
plug: electric socket power
wire: electric cable metal
bulb: light lamp flower
spark: fire electric light
wheel: car bike round
gear: machine wheel tooth
needle: sew sharp doctor
pill: medicine doctor sick
doctor: hospital nurse medicine
lab: science test experiment
# culture
piano: music key black white
guitar: music string rock band
drum: music beat band rock
violin: music string orchestra
band: music rock drum guitar
opera: music sing theatre
theatre: stage play actor
film: cinema movie camera actor
ball: football round dance party
football: ball goal team sport
tennis: ball racket court sport
golf: ball club hole sport
chess: king queen board game
card: game king queen ace
king: queen crown chess castle
queen: king crown chess bee
knight: castle sword horse chess
crown: king queen gold royal
sword: knight blade fight
shield: knight protect armor
pirate: ship treasure sea parrot
ghost: halloween spirit castle
witch: magic broom halloween
dragon: fire fantasy castle knight
wizard: magic hat witch spell
vampire: blood night bat dracula
angel: wing heaven halo
circus: clown tent lion
clown: circus nose funny
mask: face carnival hide
party: dance birthday fun
dance: music party ballet
book: read page library story
pen: write ink paper
paper: write book white plane
paint: art color brush wall
statue: museum stone liberty art
photo: camera picture album selfie frame
poem: write verse book
joke: funny laugh clown comedy pun
toy: child play teddy
puzzle: game piece brain
dice: game luck six
hat: head wizard magic
shoe: foot walk lace heel boot
ring: wedding gold diamond bell
gift: present birthday box
`, fr: `
# nature
chauve-souris: nuit grotte aile vampire aveugle animal
ours: forêt miel peluche polaire brun griffe hiver animal
abeille: miel ruche piqûre jaune fleur insecte reine
grue: oiseau chantier levage cou origami machine
canard: étang oiseau plume eau journal
aigle: oiseau drapeau œil montagne aile proie
renard: forêt roux ruse queue chasse animal
cheval: selle course ferme écurie galop échecs animal
souris: ordinateur fromage chat piège clic animal
araignée: toile huit patte insecte peur
baleine: océan géante bleu mer mammifère animal
requin: océan dent aileron poisson mer
serpent: venin poison python cobra écaille animal
hibou: nuit sage oiseau plume forêt
loup: meute lune forêt sauvage chasse gris animal
lion: roi crinière afrique rugir zoo
singe: banane jungle arbre zoo queue
tortue: carapace lent mer œuf ninja
grenouille: étang vert saut prince crapaud eau
arbre: forêt bois feuille branche racine vert famille
rose: fleur rouge épine amour jardin pétale
herbe: vert pelouse champ vache jardin
feuille: arbre vert automne papier branche
fleuve: eau courant pont bateau poisson
montagne: sommet neige ski haut rocher alpes
volcan: lave feu éruption cendre île chaud
désert: sable sec chaud chameau cactus sahara
île: mer plage palmier trésor océan pirate
forêt: arbre bois loup vert chasse
océan: mer eau bleu vague baleine bateau
orage: pluie vent tonnerre nuage éclair météo
neige: froid blanc hiver ski flocon montagne
pluie: eau nuage parapluie mouillé orage goutte météo
lune: nuit espace ciel étoile loup cratère
soleil: lumière chaud ciel étoile jour jaune plage été
étoile: ciel nuit espace lumière cinéma briller
nuage: ciel pluie blanc orage météo
glace: froid eau hiver patin miroir vanille
feu: chaud flamme brûler rouge fumée dragon
vent: tempête voile souffle air moulin météo
œuf: poule coquille pâques oiseau omelette
plume: oiseau léger stylo aile oreiller
toile: araignée internet peinture tente
racine: arbre plante terre carotte carré
graine: plante jardin pousser fleur
pomme: fruit arbre rouge tarte newton
banane: fruit jaune singe peau
champignon: forêt soupe pizza poison
cactus: désert épine plante sec mexique
# home
pain: boulangerie beurre farine sandwich
fromage: souris lait pizza vache france
gâteau: anniversaire fête sucre bougie chocolat
chocolat: sucré cacao gâteau pâques
tarte: pomme pâtisserie gifle four
soupe: cuillère bol chaud tomate
sel: mer poivre cuisine blanc
sucre: doux gâteau bonbon blanc café
poivre: sel épice piquant
café: tasse matin grain bar
thé: tasse feuille chine vert
lait: vache blanc fromage bouteille
vin: raisin rouge france bouteille verre
verre: fenêtre vin miroir bouteille
assiette: plat cuisine table
fourchette: couteau cuillère table
couteau: fourchette cuisine lame couper
poêle: cuisine frire chauffage
four: cuisine cuire pain pizza chaud
frigo: cuisine froid lait aimant
table: chaise cuisine pied dîner bois
chaise: table assis bois pied
lit: dormir oreiller nuit chambre
porte: maison clé serrure fenêtre
fenêtre: verre maison porte ordinateur
clé: serrure porte piano musique voiture code
lampe: lumière ampoule nuit bureau
miroir: verre visage reflet glace
horloge: temps heure aiguille mur
cloche: église école sonner
bougie: lumière cire feu anniversaire gâteau
oreiller: lit dormir plume
toit: maison pluie tuile chat
mur: maison brique peinture chine
jardin: fleur plante herbe arbre
échelle: grimper haut barreau toit
balai: ménage sorcière sol
savon: laver propre bain bulle
serviette: bain plage sec table
boîte: carton cadeau colis
panier: pique-nique basket fruit œuf
bouteille: verre vin lait eau message
tasse: thé café cuisine
cuillère: soupe fourchette cuisine
miel: abeille sucré ours jaune
pizza: fromage italie four tomate
tomate: rouge fruit sauce pizza soupe
citron: jaune acide fruit jus
oignon: pleurer cuisine soupe légume
carotte: lapin orange légume racine
# places
paris: france tour capitale ville europe
londres: angleterre ville capitale pont reine
rome: italie ville empire capitale antique
égypte: pyramide nil désert pharaon afrique antique
chine: muraille asie thé panda dragon
japon: asie sushi île tokyo samouraï
inde: asie curry éléphant tigre
brésil: football carnaval amazonie amérique
mexique: cactus amérique désert
afrique: lion éléphant désert continent
amérique: pays drapeau aigle président
canada: érable froid neige amérique
australie: kangourou île continent plage
moscou: russie capitale froid ville
venise: italie bateau canal ville carnaval
pont: fleuve traverser route londres
château: roi reine tour chevalier
tour: haut château eiffel londres
église: cloche croix religion mariage
école: maître élève classe cloche
hôpital: médecin infirmière malade santé
banque: argent compte coffre
hôtel: chambre voyage lit vacances
musée: art histoire tableau statue
port: bateau mer navire quai
gare: train voyage quai billet
aéroport: avion voyage vol
route: voiture rue chemin voyage
rue: route ville maison voiture
plage: sable mer soleil été vacances
camp: tente feu scout été
ferme: vache animal cheval champ tracteur
jungle: arbre singe tigre sauvage
grotte: chauve-souris sombre rocher ours
temple: religion antique asie
pyramide: égypte antique tombeau triangle
palais: roi reine royal château
prison: crime cellule gardien
marché: acheter vendre bourse
parc: arbre jardin banc
navire: bateau mer océan voile capitaine
train: rail gare voyage
avion: voler aéroport ciel aile voyage
voiture: route conduire roue moteur
bus: route école billet
vélo: roue pédale tour
bateau: mer fleuve voile navire eau
carte: voyage monde route trésor jeu
billet: voyage train cinéma bus argent
valise: voyage vacances hôtel
passeport: voyage pays frontière
# science
ordinateur: écran clavier souris internet
robot: machine métal futur
fusée: espace lancement lune feu
satellite: espace orbite lune téléphone
laser: lumière rayon rouge
aimant: métal attirer nord frigo
atome: minuscule bombe noyau énergie
pile: énergie téléphone batterie face
moteur: voiture puissance carburant machine
écran: ordinateur téléphone cinéma télévision
téléphone: appel écran portable
radio: musique info onde son
télévision: écran émission info
virus: ordinateur malade grippe cellule
cellule: prison téléphone biologie corps
cerveau: tête penser intelligent nerf corps
cœur: amour sang corps rouge
sang: rouge cœur vampire corps
os: squelette chien corps crâne
squelette: os halloween crâne corps
dent: bouche dentiste blanc mordre corps
œil: voir vue regard caméra corps
main: doigt gant aiguille aide corps
pied: chaussure ballon jambe orteil table corps
nez: visage odeur éléphant corps
microscope: minuscule labo cellule verre
télescope: étoile espace lentille ciel
planète: espace terre mars orbite
comète: espace queue étoile glace
or: métal argent jaune bague
fer: métal acier repasser
diamant: bague bijou briller dur
pétrole: voiture carburant noir
gaz: carburant cuisine nuage
code: secret ordinateur clé
internet: toile ordinateur réseau
jeu: jouer amusement plateau vidéo
puce: ordinateur insecte chien
prise: électricité courant pêche
fil: électricité câble couture
ampoule: lumière lampe pied
étincelle: feu électricité lumière
roue: voiture vélo rond
engrenage: machine roue dent
aiguille: coudre pointu médecin horloge
pilule: médicament médecin malade
médecin: hôpital infirmière médicament
labo: science test expérience
# culture
piano: musique touche noir blanc
guitare: musique corde rock groupe
tambour: musique rythme groupe
violon: musique corde orchestre
groupe: musique rock batterie guitare
opéra: musique chanter théâtre
théâtre: scène pièce acteur
film: cinéma caméra acteur
ballon: football rond fête air
football: ballon but équipe sport
tennis: balle raquette court sport
golf: balle club trou sport
échecs: roi reine plateau jeu
roi: reine couronne échecs château lion
reine: roi couronne échecs abeille
chevalier: château épée cheval armure
couronne: roi reine or royal
épée: chevalier lame combat
bouclier: chevalier protection armure
pirate: bateau trésor mer perroquet
fantôme: halloween esprit château
sorcière: magie balai halloween
dragon: feu château chevalier
magicien: magie chapeau baguette tour
vampire: sang nuit chauve-souris
ange: aile paradis auréole
cirque: clown chapiteau lion
clown: cirque nez rire
masque: visage carnaval cacher
fête: danse anniversaire musique
danse: musique fête ballet
livre: lire page bibliothèque histoire
stylo: écrire encre papier plume
papier: écrire livre blanc avion
peinture: art couleur pinceau mur tableau
tableau: peinture musée école mur
statue: musée pierre liberté art
photo: appareil image album selfie cadre
poème: écrire vers livre
blague: drôle rire clown humour farce
jouet: enfant jouer peluche
puzzle: jeu pièce cerveau
dé: jeu chance six
chapeau: tête magicien magie
chaussure: pied marcher lacet talon botte
bague: mariage or diamant
cadeau: anniversaire boîte fête
`};

// Accent- and case-insensitive form used to compare clues and words.
export const fold = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').trim();
export const WORDS = {};
export const BANK = {};
for (const [lang, text] of Object.entries(RAW)) {
  WORDS[lang] = {all: []};
  BANK[lang] = {};
  let pack = null;
  for (const line of text.trim().split('\n')) {
    if (line.startsWith('#')) { pack = line.slice(1).trim(); WORDS[lang][pack] = []; continue; }
    const [word, rest] = line.split(':');
    if (BANK[lang][word]) throw new Error('Duplicate word ' + word);
    BANK[lang][word] = rest.trim().split(/\s+/);
    WORDS[lang][pack].push(word);
    WORDS[lang].all.push(word);
  }
}
