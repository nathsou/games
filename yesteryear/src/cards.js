// Yesteryear decks. One card per line: year | English title | French title |
// English Wikipedia article used as the source. Negative years are BCE. Years
// were checked against Wikidata with tools/verify-years.mjs; see SOURCES.md for
// the date each card means where an event has several.
export const THEMES = {
  inventions: {en: 'Inventions', fr: 'Inventions', icon: '💡'},
  science: {en: 'Science & Discoveries', fr: 'Sciences et découvertes', icon: '🔬'},
  history: {en: 'World History', fr: 'Histoire du monde', icon: '🌍'},
  france: {en: 'History of France', fr: 'Histoire de France', icon: '🇫🇷'},
  pop: {en: 'Pop Culture', fr: 'Culture pop', icon: '🎬'},
  flight: {en: 'Space & Flight', fr: 'Air et espace', icon: '🚀'},
};

const RAW = {
inventions: `
1724 | Fahrenheit temperature scale | L'échelle de température Fahrenheit | Fahrenheit
1608 | First telescope patent | Premier brevet de télescope | History of the telescope
1643 | Barometer | Le baromètre | Barometer
1656 | Pendulum clock | L'horloge à balancier | Pendulum clock
1712 | Newcomen steam engine | La machine à vapeur de Newcomen | Newcomen atmospheric engine
1733 | Flying shuttle | La navette volante | Flying shuttle
1752 | Lightning rod | Le paratonnerre | Lightning rod
1764 | Spinning jenny | La spinning jenny | Spinning jenny
1796 | Jenner's first smallpox vaccination | Première vaccination de Jenner contre la variole | Smallpox vaccine
1800 | Voltaic pile, the first battery | La pile voltaïque | Voltaic pile
1804 | First steam railway locomotive | Première locomotive à vapeur | Richard Trevithick
1810 | Tin can | La boîte de conserve | Tin can
1815 | Metronome | Le métronome | Metronome
1816 | Stethoscope | Le stéthoscope | Stethoscope
1817 | Draisine, the running machine | La draisienne | Dandy horse
1836 | Colt revolver | Le revolver Colt | Colt Paterson
1839 | Daguerreotype photography | Le daguerréotype | Daguerreotype
1840 | Penny Black, the first postage stamp | Le Penny Black, premier timbre-poste | Penny Black
1844 | First Morse telegraph message | Premier message télégraphique en morse | Morse code
1849 | Safety pin | L'épingle à nourrice | Safety pin
1867 | Dynamite | La dynamite | Dynamite
1868 | First traffic light | Premier feu de circulation | Traffic light
1873 | Riveted blue jeans | Le jean à rivets | Jeans
1876 | Telephone patent | Brevet du téléphone | Invention of the telephone
1877 | Phonograph | Le phonographe | Phonograph
1879 | Edison's light bulb | L'ampoule d'Edison | Incandescent light bulb
1879 | Cash register | La caisse enregistreuse | Cash register
1886 | Benz Patent-Motorwagen | La Benz Patent-Motorwagen | Benz Patent-Motorwagen
1887 | Gramophone | Le gramophone | Gramophone record
1893 | Ferris wheel | La grande roue de Ferris | Ferris Wheel
1895 | Lumière cinematograph screening | Première séance du cinématographe Lumière | Workers Leaving the Lumière Factory
1901 | Transatlantic radio signal | Premier signal radio transatlantique | Guglielmo Marconi
1907 | Bakelite, the first synthetic plastic | La bakélite | Bakelite
1908 | Ford Model T | La Ford T | Ford Model T
1910 | Neon lighting | L'enseigne au néon | Neon lighting
1926 | Television demonstrated by Baird | Démonstration de la télévision par Baird | John Logie Baird
1935 | Nylon | Le nylon | Nylon
1938 | Bíró's ballpoint pen patent | Brevet du stylo à bille de Bíró | Ballpoint pen
1946 | ENIAC computer unveiled | Présentation de l'ordinateur ENIAC | ENIAC
1947 | Transistor | Le transistor | History of the transistor
1948 | Polaroid instant camera | L'appareil photo instantané Polaroid | Instant camera
1958 | Integrated circuit | Le circuit intégré | Invention of the integrated circuit
1959 | Hovercraft SR.N1 | L'aéroglisseur SR.N1 | SR.N1
1960 | Laser | Le laser | Laser
1971 | Email between computers | Le courrier électronique | Email
1971 | Intel 4004 microprocessor | Le microprocesseur Intel 4004 | Intel 4004
1973 | First mobile phone call | Premier appel sur téléphone portable | Martin Cooper (inventor)
1974 | First barcode scanned at a till | Premier code-barres scanné en caisse | Universal Product Code
1977 | Apple II personal computer | L'ordinateur Apple II | Apple II
1979 | Sony Walkman | Le Walkman de Sony | Walkman
1982 | Compact disc goes on sale | Commercialisation du disque compact | Compact disc
1989 | World Wide Web proposed | Proposition du World Wide Web | World Wide Web
2001 | iPod | L'iPod | IPod
2007 | iPhone unveiled | Présentation de l'iPhone | IPhone (1st generation)
`,
science: `
1543 | Copernicus puts the Sun at the centre | Copernic place le Soleil au centre | De revolutionibus orbium coelestium
1609 | Kepler's first laws of planetary motion | Les premières lois de Kepler | Astronomia nova
1610 | Galileo discovers Jupiter's moons | Galilée découvre les lunes de Jupiter | Galilean moons
1628 | Harvey describes blood circulation | Harvey décrit la circulation sanguine | De Motu Cordis
1687 | Newton's Principia | Les Principia de Newton | Philosophiæ Naturalis Principia Mathematica
1735 | Linnaeus classifies living things | Linné classe les êtres vivants | Systema Naturae
1781 | Uranus discovered | Découverte d'Uranus | Uranus
1801 | Ceres, first asteroid found | Découverte de Cérès, premier astéroïde | Ceres (dwarf planet)
1827 | Ohm's law | La loi d'Ohm | Ohm's law
1831 | Electromagnetic induction | L'induction électromagnétique | Faraday's law of induction
1842 | Doppler effect described | Description de l'effet Doppler | Doppler effect
1846 | Neptune discovered | Découverte de Neptune | Neptune
1851 | Foucault's pendulum | Le pendule de Foucault | Foucault pendulum
1856 | Neanderthal fossils found | Découverte des fossiles de Néandertal | Neanderthal 1
1859 | On the Origin of Species | De l'origine des espèces | On the Origin of Species
1861 | Archaeopteryx fossil found | Découverte du fossile d'archéoptéryx | Archaeopteryx
1865 | Maxwell's equations of electromagnetism | Les équations de Maxwell | A Dynamical Theory of the Electromagnetic Field
1869 | Mendeleev's periodic table | Le tableau périodique de Mendeleïev | History of the periodic table
1885 | Pasteur's rabies vaccine | Le vaccin contre la rage de Pasteur | Rabies vaccine
1887 | Radio waves produced by Hertz | Hertz produit des ondes radio | Heinrich Hertz
1895 | X-rays discovered | Découverte des rayons X | X-ray
1896 | Radioactivity discovered | Découverte de la radioactivité | Radioactive decay
1897 | Electron discovered | Découverte de l'électron | Electron
1898 | Radium discovered | Découverte du radium | Radium
1900 | Planck's quantum hypothesis | L'hypothèse des quanta de Planck | Planck's law
1901 | Blood groups discovered | Découverte des groupes sanguins | ABO blood group system
1905 | Special relativity | La relativité restreinte | Special relativity
1911 | Atomic nucleus discovered | Découverte du noyau atomique | Geiger–Marsden experiments
1912 | Continental drift proposed | La dérive des continents | Continental drift
1915 | General relativity | La relativité générale | General relativity
1921 | Insulin isolated | Isolement de l'insuline | Insulin
1928 | Penicillin discovered | Découverte de la pénicilline | Penicillin
1929 | Hubble finds the universe expanding | Hubble découvre l'expansion de l'Univers | Hubble's law
1930 | Pluto discovered | Découverte de Pluton | Pluto
1932 | Neutron discovered | Découverte du neutron | Neutron
1938 | Living coelacanth found | Découverte d'un cœlacanthe vivant | Coelacanth
1938 | Nuclear fission discovered | Découverte de la fission nucléaire | Nuclear fission
1942 | First nuclear reactor | Premier réacteur nucléaire | Chicago Pile-1
1953 | DNA double helix | La double hélice de l'ADN | Molecular Structure of Nucleic Acids: A Structure for Deoxyribose Nucleic Acid
1955 | Salk polio vaccine approved | Le vaccin de Salk contre la polio | Polio vaccine
1967 | First pulsar detected | Découverte du premier pulsar | PSR B1919+21
1974 | Lucy the australopithecine found | Découverte de Lucy | Lucy (Australopithecus)
1980 | Smallpox declared eradicated | Éradication de la variole | Eradication of smallpox
1985 | Ozone hole discovered | Découverte du trou dans la couche d'ozone | Ozone depletion
1995 | First planet around a Sun-like star | Première exoplanète autour d'une étoile comme le Soleil | 51 Pegasi b
1996 | Dolly the sheep is born | Naissance de la brebis Dolly | Dolly (sheep)
2003 | Human genome sequenced | Séquençage du génome humain | Human Genome Project
2012 | Higgs boson found | Découverte du boson de Higgs | Higgs boson
2012 | CRISPR gene editing | L'édition génomique CRISPR | CRISPR gene editing
2015 | Gravitational waves detected | Détection des ondes gravitationnelles | First observation of gravitational waves
2019 | First image of a black hole | Première image d'un trou noir | Messier 87
`,
history: `
-776 | First ancient Olympic Games | Premiers Jeux olympiques antiques | Ancient Olympic Games
-753 | Legendary founding of Rome | Fondation légendaire de Rome | Founding of Rome
-490 | Battle of Marathon | Bataille de Marathon | Battle of Marathon
-323 | Death of Alexander the Great | Mort d'Alexandre le Grand | Death of Alexander the Great
-44 | Assassination of Julius Caesar | Assassinat de Jules César | Assassination of Julius Caesar
79 | Vesuvius buries Pompeii | Le Vésuve ensevelit Pompéi | Eruption of Mount Vesuvius in 79 AD
476 | Fall of the Western Roman Empire | Chute de l'Empire romain d'Occident | Fall of the Western Roman Empire
622 | The Hijra of Muhammad | L'Hégire de Mahomet | Hijrah
1066 | Battle of Hastings | Bataille d'Hastings | Battle of Hastings
1099 | Crusaders capture Jerusalem | Les croisés prennent Jérusalem | Siege of Jerusalem (1099)
1206 | Genghis Khan proclaimed | Gengis Khan proclamé | Genghis Khan
1215 | Magna Carta | La Grande Charte | Magna Carta
1347 | Black Death reaches Sicily | La peste noire atteint la Sicile | Black Death
1453 | Fall of Constantinople | Chute de Constantinople | Fall of Constantinople
1492 | Columbus reaches the Americas | Christophe Colomb atteint l'Amérique | Voyages of Christopher Columbus
1498 | Vasco da Gama reaches India | Vasco de Gama atteint l'Inde | Vasco da Gama
1517 | Luther's Ninety-five Theses | Les 95 thèses de Luther | Ninety-five Theses
1522 | First voyage around the world ends | Fin du premier tour du monde | Magellan expedition
1588 | Spanish Armada defeated | Défaite de l'Invincible Armada | Spanish Armada
1620 | Mayflower lands in America | Le Mayflower arrive en Amérique | Mayflower
1648 | Peace of Westphalia | Traités de Westphalie | Peace of Westphalia
1666 | Great Fire of London | Grand incendie de Londres | Great Fire of London
1776 | US Declaration of Independence | Déclaration d'indépendance des États-Unis | United States Declaration of Independence
1799 | Rosetta Stone found | Découverte de la pierre de Rosette | Rosetta Stone
1815 | Battle of Waterloo | Bataille de Waterloo | Battle of Waterloo
1833 | Slavery abolished in the British Empire | Abolition de l'esclavage dans l'Empire britannique | Slavery Abolition Act 1833
1848 | Revolutions across Europe | Le printemps des peuples | Revolutions of 1848
1861 | American Civil War begins | Début de la guerre de Sécession | American Civil War
1865 | Lincoln assassinated | Assassinat de Lincoln | Assassination of Abraham Lincoln
1868 | Meiji Restoration in Japan | Restauration Meiji au Japon | Meiji Restoration
1869 | Suez Canal opens | Ouverture du canal de Suez | Suez Canal
1871 | German Empire proclaimed | Proclamation de l'Empire allemand | Proclamation of the German Empire
1886 | Statue of Liberty dedicated | Inauguration de la statue de la Liberté | Statue of Liberty
1912 | Titanic sinks | Naufrage du Titanic | Titanic
1914 | First World War begins | Début de la Première Guerre mondiale | World War I
1917 | October Revolution in Russia | Révolution d'Octobre en Russie | October Revolution
1919 | Treaty of Versailles | Traité de Versailles | Treaty of Versailles
1922 | Tutankhamun's tomb opened | Découverte du tombeau de Toutânkhamon | KV62
1929 | Wall Street Crash | Krach de Wall Street | Wall Street crash of 1929
1939 | Second World War begins | Début de la Seconde Guerre mondiale | World War II
1944 | D-Day landings | Débarquement de Normandie | Normandy landings
1945 | United Nations founded | Fondation de l'ONU | United Nations
1947 | Independence of India | Indépendance de l'Inde | Indian Independence Act 1947
1949 | People's Republic of China proclaimed | Proclamation de la République populaire de Chine | Proclamation of the People's Republic of China
1961 | Berlin Wall built | Construction du mur de Berlin | Berlin Wall
1962 | Cuban Missile Crisis | Crise des missiles de Cuba | Cuban Missile Crisis
1963 | "I Have a Dream" speech | Discours « I Have a Dream » | I Have a Dream
1986 | Chernobyl disaster | Catastrophe de Tchernobyl | Chernobyl disaster
1989 | Fall of the Berlin Wall | Chute du mur de Berlin | Fall of the Berlin Wall
1990 | Nelson Mandela released | Libération de Nelson Mandela | Nelson Mandela
1991 | Dissolution of the Soviet Union | Dissolution de l'URSS | Dissolution of the Soviet Union
2001 | September 11 attacks | Attentats du 11 septembre | September 11 attacks
`,
france: `
-52 | Battle of Alesia | Bataille d'Alésia | Battle of Alesia
732 | Battle of Tours | Bataille de Poitiers | Battle of Tours
800 | Charlemagne crowned emperor | Charlemagne couronné empereur | Charlemagne
843 | Treaty of Verdun | Traité de Verdun | Treaty of Verdun
987 | Hugh Capet crowned king | Hugues Capet couronné roi | Hugh Capet
1163 | Building of Notre-Dame de Paris begins | Début de la construction de Notre-Dame de Paris | Notre-Dame de Paris
1214 | Battle of Bouvines | Bataille de Bouvines | Battle of Bouvines
1337 | Hundred Years' War begins | Début de la guerre de Cent Ans | Hundred Years' War
1429 | Joan of Arc lifts the siege of Orléans | Jeanne d'Arc délivre Orléans | Siege of Orléans
1431 | Joan of Arc burned at Rouen | Jeanne d'Arc brûlée à Rouen | Trial of Joan of Arc
1515 | Battle of Marignano | Bataille de Marignan | Battle of Marignano
1539 | Ordinance of Villers-Cotterêts | Ordonnance de Villers-Cotterêts | Ordinance of Villers-Cotterêts
1572 | St. Bartholomew's Day massacre | Massacre de la Saint-Barthélemy | St. Bartholomew's Day massacre
1598 | Edict of Nantes | Édit de Nantes | Edict of Nantes
1610 | Henry IV assassinated | Assassinat d'Henri IV | Assassination of Henry IV
1635 | Académie française founded | Fondation de l'Académie française | Académie Française
1648 | The Fronde begins | Début de la Fronde | The Fronde
1682 | Louis XIV moves the court to Versailles | Louis XIV installe la cour à Versailles | Palace of Versailles
1685 | Edict of Nantes revoked | Révocation de l'édit de Nantes | Edict of Fontainebleau
1751 | First volume of the Encyclopédie | Premier volume de l'Encyclopédie | Encyclopédie
1783 | First hot-air balloon flight | Premier vol en montgolfière | Montgolfier brothers
1789 | Storming of the Bastille | Prise de la Bastille | Storming of the Bastille
1793 | Louis XVI executed | Exécution de Louis XVI | Execution of Louis XVI
1804 | Napoleon crowned emperor | Sacre de Napoléon | Coronation of Napoleon
1805 | Battle of Austerlitz | Bataille d'Austerlitz | Battle of Austerlitz
1830 | Three Glorious Days revolution | Les Trois Glorieuses | July Revolution
1836 | Arc de Triomphe completed | Achèvement de l'Arc de triomphe | Arc de Triomphe
1848 | Slavery abolished for good in France | Abolition définitive de l'esclavage en France | Abolition of slavery in France
1852 | Second Empire proclaimed | Proclamation du Second Empire | Second French Empire
1862 | Les Misérables published | Publication des Misérables | Les Misérables
1871 | Paris Commune | La Commune de Paris | Paris Commune
1889 | Eiffel Tower inaugurated | Inauguration de la tour Eiffel | Eiffel Tower
1898 | Zola's "J'accuse…!" | « J'accuse…! » de Zola | J'Accuse…!
1900 | First Paris Métro line opens | Ouverture de la première ligne du métro parisien | Paris Métro Line 1
1903 | First Tour de France | Premier Tour de France | 1903 Tour de France
1905 | Separation of Church and State | Loi de séparation des Églises et de l'État | 1905 French law on the Separation of the Churches and the State
1916 | Battle of Verdun | Bataille de Verdun | Battle of Verdun
1940 | Lascaux cave paintings found | Découverte de la grotte de Lascaux | Lascaux
1940 | De Gaulle's Appeal of 18 June | L'appel du 18 Juin | Appeal of 18 June
1944 | Liberation of Paris | Libération de Paris | Liberation of Paris
1945 | Women vote for the first time | Les femmes votent pour la première fois | Women's suffrage in France
1958 | Fifth Republic founded | Naissance de la Ve République | French Fifth Republic
1968 | May 68 protests | Mai 68 | May 68
1981 | Death penalty abolished | Abolition de la peine de mort | Capital punishment in France
1981 | TGV enters service | Mise en service du TGV | TGV
1989 | Louvre Pyramid opens | Inauguration de la pyramide du Louvre | Louvre Pyramid
1994 | Channel Tunnel opens | Ouverture du tunnel sous la Manche | Channel Tunnel
1998 | France wins the World Cup | La France championne du monde | 1998 FIFA World Cup
2002 | Euro coins and notes arrive | Arrivée des pièces et billets en euros | Euro banknotes
2019 | Notre-Dame de Paris fire | Incendie de Notre-Dame de Paris | Notre-Dame de Paris fire
`,
pop: `
1824 | Beethoven's Ninth Symphony premieres | Création de la Neuvième de Beethoven | Symphony No. 9 (Beethoven)
1865 | Alice's Adventures in Wonderland | Alice au pays des merveilles | Alice's Adventures in Wonderland
1887 | Sherlock Holmes's first case | Première enquête de Sherlock Holmes | A Study in Scarlet
1896 | First modern Olympic Games | Premiers Jeux olympiques modernes | 1896 Summer Olympics
1902 | A Trip to the Moon by Méliès | Le Voyage dans la Lune de Méliès | A Trip to the Moon
1913 | First crossword puzzle | Première grille de mots croisés | Crossword
1927 | The Jazz Singer, first talkie | Le Chanteur de jazz, premier film parlant | The Jazz Singer
1928 | Mickey Mouse in Steamboat Willie | Mickey Mouse dans Steamboat Willie | Steamboat Willie
1929 | Tintin's first adventure | Première aventure de Tintin | Tintin in the Land of the Soviets
1930 | First FIFA World Cup | Première Coupe du monde de football | 1930 FIFA World Cup
1935 | Monopoly goes on sale | Le Monopoly en vente | Monopoly (game)
1937 | Snow White and the Seven Dwarfs | Blanche-Neige et les Sept Nains | Snow White and the Seven Dwarfs (1937 film)
1938 | Superman's first comic | Première bande dessinée de Superman | Action Comics 1
1939 | The Wizard of Oz film | Le film Le Magicien d'Oz | The Wizard of Oz
1943 | The Little Prince | Le Petit Prince | The Little Prince
1956 | First Eurovision Song Contest | Premier concours Eurovision | Eurovision Song Contest 1956
1958 | LEGO brick patented | Brevet de la brique LEGO | Lego
1959 | Astérix first appears | Première apparition d'Astérix | Asterix
1959 | Barbie doll | La poupée Barbie | Barbie
1962 | Dr. No, the first James Bond film | James Bond 007 contre Dr No | Dr. No (film)
1963 | The Beatles' first album | Premier album des Beatles | Please Please Me
1966 | Star Trek on television | Star Trek à la télévision | Star Trek: The Original Series
1969 | Woodstock festival | Festival de Woodstock | Woodstock
1972 | Pong arcade game | Le jeu d'arcade Pong | Pong
1974 | Rubik's Cube | Le Rubik's Cube | Rubik's Cube
1977 | Star Wars | La Guerre des étoiles | Star Wars (film)
1978 | Space Invaders | Space Invaders | Space Invaders
1980 | Pac-Man | Pac-Man | Pac-Man
1981 | MTV goes on air | Lancement de MTV | MTV
1982 | Michael Jackson's Thriller | Thriller de Michael Jackson | Thriller (album)
1983 | Nintendo Famicom console | La console Famicom de Nintendo | Nintendo Entertainment System
1984 | Tetris | Tetris | Tetris
1984 | Dragon Ball manga begins | Début du manga Dragon Ball | Dragon Ball (manga)
1985 | Super Mario Bros. | Super Mario Bros. | Super Mario Bros.
1989 | Game Boy | La Game Boy | Game Boy
1993 | Jurassic Park film | Le film Jurassic Park | Jurassic Park (film)
1994 | PlayStation | La PlayStation | PlayStation (console)
1995 | Toy Story | Toy Story | Toy Story
1996 | Pokémon Red and Green | Pokémon Rouge et Vert | Pokémon Red and Blue
1997 | Harry Potter's first book | Premier livre de Harry Potter | Harry Potter and the Philosopher's Stone
1997 | Titanic film | Le film Titanic | Titanic (1997 film)
1998 | Google founded | Fondation de Google | Google
1999 | The Matrix | Matrix | The Matrix
2001 | Wikipedia launched | Lancement de Wikipédia | Wikipedia
2004 | Facebook launched | Lancement de Facebook | Facebook
2005 | YouTube launched | Lancement de YouTube | YouTube
2006 | Twitter launched | Lancement de Twitter | Twitter
2008 | Spotify launched | Lancement de Spotify | Spotify
2009 | Avatar | Avatar | Avatar (2009 film)
2009 | Minecraft's first public version | Première version publique de Minecraft | Minecraft
2010 | Instagram launched | Lancement d'Instagram | Instagram
2012 | Gangnam Style | Gangnam Style | Gangnam Style
2013 | Frozen | La Reine des neiges | Frozen (2013 film)
2017 | Fortnite | Fortnite | Fortnite
`,
flight: `
1797 | First parachute jump from a balloon | Premier saut en parachute depuis un ballon | André-Jacques Garnerin
1853 | Cayley's glider carries a man | Le planeur de Cayley emporte un homme | George Cayley
1891 | Lilienthal's first glider flights | Premiers vols plané de Lilienthal | Otto Lilienthal
1900 | First Zeppelin flight | Premier vol d'un zeppelin | Zeppelin LZ 1
1903 | Wright brothers' first powered flight | Premier vol motorisé des frères Wright | Wright Flyer
1909 | Blériot flies across the Channel | Blériot traverse la Manche en avion | Louis Blériot
1926 | First liquid-fuelled rocket | Première fusée à carburant liquide | Robert H. Goddard
1927 | Lindbergh flies solo across the Atlantic | Lindbergh traverse l'Atlantique en solitaire | Spirit of St. Louis
1932 | Amelia Earhart's solo Atlantic flight | Amelia Earhart traverse l'Atlantique en solitaire | Amelia Earhart
1937 | Hindenburg disaster | Catastrophe du Hindenburg | Hindenburg disaster
1939 | First jet aircraft flight | Premier vol d'un avion à réaction | Heinkel He 178
1947 | Sound barrier broken | Franchissement du mur du son | Bell X-1
1957 | Sputnik 1, first satellite | Spoutnik 1, premier satellite | Sputnik 1
1958 | NASA founded | Création de la NASA | NASA
1959 | Luna 2 reaches the Moon | Luna 2 atteint la Lune | Luna 2
1961 | Yuri Gagarin, first human in space | Youri Gagarine, premier homme dans l'espace | Vostok 1
1963 | Valentina Tereshkova, first woman in space | Valentina Terechkova, première femme dans l'espace | Vostok 6
1965 | First spacewalk | Première sortie dans l'espace | Voskhod 2
1968 | Apollo 8 orbits the Moon | Apollo 8 tourne autour de la Lune | Apollo 8
1969 | First steps on the Moon | Premiers pas sur la Lune | Apollo 11
1969 | Concorde's first flight | Premier vol du Concorde | Concorde
1970 | Apollo 13 returns safely | Le retour d'Apollo 13 | Apollo 13
1970 | Venera 7 lands on Venus | Venera 7 se pose sur Vénus | Venera 7
1970 | Boeing 747 enters service | Mise en service du Boeing 747 | Boeing 747
1973 | Skylab space station | La station spatiale Skylab | Skylab
1976 | Viking 1 lands on Mars | Viking 1 se pose sur Mars | Viking 1
1977 | Voyager 1 launched | Lancement de Voyager 1 | Voyager 1
1979 | First Ariane rocket launch | Premier lancement d'une fusée Ariane | Ariane 1
1981 | First Space Shuttle flight | Premier vol de la navette spatiale | STS-1
1986 | Challenger disaster | Catastrophe de Challenger | Space Shuttle Challenger disaster
1986 | Mir station launched | Lancement de la station Mir | Mir
1990 | Hubble Space Telescope launched | Lancement du télescope Hubble | Hubble Space Telescope
1997 | Pathfinder lands on Mars | Pathfinder se pose sur Mars | Mars Pathfinder
1998 | First ISS module launched | Lancement du premier module de l'ISS | Zarya
1999 | Balloon flies nonstop around the world | Tour du monde en ballon sans escale | Breitling Orbiter 3
2003 | First Chinese astronaut | Premier astronaute chinois | Shenzhou 5
2005 | Airbus A380 first flight | Premier vol de l'Airbus A380 | Airbus A380
2012 | Curiosity lands on Mars | Curiosity se pose sur Mars | Curiosity (rover)
2014 | Philae lands on a comet | Philae se pose sur une comète | Philae (spacecraft)
2015 | New Horizons flies past Pluto | New Horizons survole Pluton | New Horizons
2015 | First orbital rocket booster lands | Premier atterrissage d'un étage de fusée orbitale | Falcon 9 Flight 20
2019 | Landing on the Moon's far side | Atterrissage sur la face cachée de la Lune | Chang'e 4
2021 | James Webb Space Telescope launched | Lancement du télescope James-Webb | James Webb Space Telescope
2021 | First powered flight on Mars | Premier vol motorisé sur Mars | Ingenuity (helicopter)
`,
};

const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const CARDS = {};
export const DECKS = {};
for (const [theme, text] of Object.entries(RAW)) {
  DECKS[theme] = [];
  for (const line of text.trim().split('\n')) {
    const [year, en, fr, wiki] = line.split('|').map(part => part.trim());
    const id = theme.slice(0, 3) + '-' + slug(en);
    if (CARDS[id]) throw new Error('Duplicate card ' + id);
    CARDS[id] = {id, theme, year: Number(year), en, fr, wiki};
    DECKS[theme].push(id);
  }
}
export function formatYear(year, lang = 'en') {
  return year < 0 ? -year + (lang === 'fr' ? ' av. J.-C.' : ' BCE') : String(year);
}
