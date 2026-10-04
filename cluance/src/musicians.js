// Additional musicians and bands; atlas cells follow this append-only order.
export const MUSICIAN_ADDITIONS = [
  [
    "Chappell Roan",
    "American pop singer-songwriter",
    "Born 1998",
    "American singer-songwriter known for theatrical, drag-inspired performances and synth-pop songs including Pink Pony Club and Good Luck, Babe!."
  ],
  [
    "Lady Gaga",
    "American pop musician and actor",
    "Born 1986",
    "American singer, songwriter and actor known for theatrical fashion, dance-pop hits such as Bad Romance, and the film A Star Is Born."
  ],
  [
    "The Beatles",
    "British rock band",
    "Active 1960–1970",
    "Liverpool band whose best-known lineup was John Lennon, Paul McCartney, George Harrison and Ringo Starr; their recordings ranged from early pop to the studio experimentation of Sgt. Pepper’s Lonely Hearts Club Band."
  ],
  [
    "The Strokes",
    "American indie rock band",
    "Formed 1998",
    "New York rock band with Julian Casablancas, Nick Valensi, Albert Hammond Jr., Nikolai Fraiture and Fabrizio Moretti, whose debut Is This It helped shape the early-2000s garage-rock revival."
  ],
  [
    "Daft Punk",
    "French electronic music duo",
    "Active 1993–2021",
    "French duo of Thomas Bangalter and Guy-Manuel de Homem-Christo, known for robot helmets and recordings including Discovery, Around the World and Get Lucky."
  ],
  [
    "Justice",
    "French electronic music duo",
    "Formed 2003",
    "French duo of Gaspard Augé and Xavier de Rosnay, combining distorted electronic dance music with rock and disco influences; their debut album and stage designs use a cross motif."
  ],
  [
    "Coldplay",
    "British rock band",
    "Formed 1997",
    "British band whose core lineup is Chris Martin, Jonny Buckland, Guy Berryman and Will Champion, known for songs such as Yellow and Viva la Vida and colorful stadium shows."
  ],
  [
    "Muse",
    "British rock band",
    "Formed 1994",
    "British trio of Matt Bellamy, Chris Wolstenholme and Dominic Howard, combining rock with electronic and classical influences in songs such as Supermassive Black Hole and Knights of Cydonia."
  ],
  [
    "Bruno Mars",
    "American pop, funk and soul musician",
    "Born 1985",
    "Hawaii-born American singer, songwriter and multi-instrumentalist whose music draws on pop, funk and soul; known for 24K Magic and for Silk Sonic with Anderson .Paak."
  ],
  [
    "Billie Eilish",
    "American pop singer-songwriter",
    "Born 2001",
    "American singer-songwriter known for intimate vocals, genre-blending production with her brother Finneas, and songs including bad guy and What Was I Made For?."
  ],
  [
    "Fun.",
    "American indie pop band",
    "Formed 2008",
    "New York band of Nate Ruess, Andrew Dost and Jack Antonoff, known for the album Some Nights and the anthem We Are Young."
  ],
  [
    "Angine de Poitrine",
    "Québécois experimental music duo",
    "Active since 2023",
    "Experimental duo performing as Khn and Klek de Poitrine, combining microtonal guitar and bass loops with asymmetrical drum patterns and surreal masked stage costumes."
  ],
  [
    "Vampire Weekend",
    "American indie rock band",
    "Formed 2006",
    "New York band led by Ezra Koenig, blending indie rock with varied rhythmic influences; its core trio includes bassist Chris Baio and drummer Chris Tomson."
  ],
  [
    "Lana Del Rey",
    "American singer-songwriter",
    "Born 1985",
    "American singer-songwriter whose cinematic pop draws on vintage Americana and melancholy storytelling, with albums including Born to Die and Norman Fucking Rockwell!."
  ],
  [
    "Kanye West",
    "American rapper and producer",
    "Born 1977",
    "American rapper and producer, also known as Ye, whose albums include The College Dropout, Graduation and My Beautiful Dark Twisted Fantasy; his production draws on soul samples and electronic sounds."
  ],
  [
    "Imagine Dragons",
    "American pop rock band",
    "Formed 2008",
    "Las Vegas band fronted by Dan Reynolds, known for anthemic pop rock songs including Radioactive, Demons and Believer."
  ],
  [
    "Black Eyed Peas",
    "American hip-hop and pop group",
    "Formed 1995",
    "Los Angeles group known for blending hip-hop, pop and dance music; its well-known 2000s lineup featured will.i.am, apl.de.ap, Taboo and Fergie, with hits including Where Is the Love? and I Gotta Feeling."
  ],
  [
    "Lorde",
    "New Zealand singer-songwriter",
    "Born 1996",
    "New Zealand singer-songwriter whose debut Pure Heroine included Royals; later albums such as Melodrama combine introspective writing with distinctive pop production."
  ],
  [
    "Sufjan Stevens",
    "American singer-songwriter and composer",
    "Born 1975",
    "American songwriter and multi-instrumentalist whose recordings range from intricate indie folk on Illinois to electronic experimentation and the intimate acoustic songs of Carrie & Lowell."
  ],
  [
    "Katy Perry",
    "American pop singer-songwriter",
    "Born 1984",
    "American pop singer-songwriter known for colorful stage imagery and songs including Teenage Dream, Firework and Roar."
  ],
  [
    "Rihanna",
    "Barbadian singer and entrepreneur",
    "Born 1988",
    "Barbadian singer whose music combines pop, R&B, dance and Caribbean influences, with hits including Umbrella and Diamonds and the album Anti."
  ],
  [
    "Françoise Hardy",
    "French singer-songwriter",
    "1944–2024",
    "French singer-songwriter associated with the 1960s yé-yé era and understated, melancholy pop; her first success included Tous les garçons et les filles."
  ],
  [
    "France Gall",
    "French pop singer",
    "1947–2018",
    "French singer who won Eurovision for Luxembourg in 1965 with Poupée de cire, poupée de son, written by Serge Gainsbourg, and later recorded songs with Michel Berger, including Ella, elle l’a."
  ],
  [
    "Michel Berger",
    "French singer-songwriter and pianist",
    "1947–1992",
    "French composer, singer and pianist known for La Groupie du pianiste, collaborations with France Gall, and the rock opera Starmania with lyricist Luc Plamondon."
  ]
].map((card, index) => [...card, index >= 6 && index < 12 ? {
  atlas: `assets/musician-${['coldplay', 'muse', 'bruno-mars', 'billie-eilish', 'fun', 'angine-de-poitrine'][index - 6]}.webp`,
  atlasIndex: 0, columns: 1, rows: 1,
} : {
  atlas: `assets/musicians-${Math.floor(index / 6) + 1}.webp`,
  atlasIndex: index % 6, columns: 3, rows: 2,
}]);
