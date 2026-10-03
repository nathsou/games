// The quest: eight worlds, one per rank of the board.
// Positions use "Ke1 Qd1 ke8" placement (uppercase White) or FEN.
//
// Level kinds:
//   collect — move pieces to grab stars / capture targets; enemies don't move
//   quiz    — tap squares or pick an answer
//   puzzle  — find the right move(s); `drill` levels generate positions
//   battle  — play against a character, with a goal

const W1 = {
  id: 'w1', rank: 1, name: 'Rook Road', biome: 'meadow', color: '#7ad06a',
  blurb: 'The board, the rook, the bishop and the queen.',
  levels: [
    {
      id: 'board', kind: 'quiz', title: 'Hello, Board!', icon: 'board', codex: ['board'],
      intro: [
        'Hoo-hoo! Welcome, little pawn! I\'m **Professor Pip**, and I\'m going to teach you chess, one square at a time.',
        'Every pawn dreams of crossing the whole board to become a **queen**. Our journey climbs the 8 rows of the board. Let\'s start right at the bottom!',
        { text: 'A chessboard has 64 squares. The columns are called **files**, named a to h. The rows are called **ranks**, numbered 1 to 8.', board: { setup: '', marks: { a1: 'goal', h1: 'goal', a8: 'goal', h8: 'goal' } } },
        { text: 'Every square has a name: its file letter, then its rank number. The bottom-left corner is [a1]. Now you try! Tap the squares I call out.', board: { setup: '', marks: { a1: 'goal' } } },
      ],
      questions: [
        { setup: '', prompt: 'Tap the square **e4**.', answer: { type: 'squares', list: ['e4'] } },
        { setup: '', prompt: 'Now tap **a8**, the top-left corner.', answer: { type: 'squares', list: ['a8'] } },
        { setup: '', prompt: 'Tap **h1**.', answer: { type: 'squares', list: ['h1'] } },
        { setup: '', prompt: 'Tap **d5**.', answer: { type: 'squares', list: ['d5'] } },
        { setup: '', prompt: 'Tap **g7**.', answer: { type: 'squares', list: ['g7'] } },
        { setup: '', prompt: 'Which bottom corner is a **light** square?', answer: { type: 'choice', options: ['a1', 'h1'], correct: 1 }, explain: 'Remember: **light on the right!** When you set up a real board, the bottom-right square ([h1]) must be light.' },
      ],
      outro: ['Excellent! You\'ll see square names everywhere: the coach uses them to point things out.'],
    },
    {
      id: 'rook', kind: 'collect', title: 'The Rook', icon: 'R', codex: ['rook'],
      intro: [
        { text: 'This is the **rook**. It moves in straight lines: up, down, left or right, as many squares as it likes.', board: { setup: 'Rd4', legal: 'd4' } },
        { text: 'Collect every star by moving onto it. Try to use as few moves as possible: that earns you more stars!', board: { setup: 'Rd2', marks: { d7: 'star', a7: 'star', a2: 'star', h2: 'star' } } },
      ],
      setup: 'Rd2', stars: ['d7', 'a7', 'a2', 'h2'],
    },
    {
      id: 'rook2', kind: 'collect', title: 'Blocked Road', icon: 'R', moveTypes: 'R',
      intro: [
        'Pieces can\'t jump over other pieces. Even your own pawns get in the way!',
        'Find a path around them to every star.',
      ],
      setup: 'Ra1 Pa4 Pf3 Pc6 Pg6', stars: ['a3', 'e3', 'e8', 'h8'],
    },
    {
      id: 'bishop', kind: 'collect', title: 'The Bishop', icon: 'B', codex: ['bishop'],
      intro: [
        { text: 'Meet the **bishop**. It moves diagonally, as far as it likes.', board: { setup: 'Bd4', legal: 'd4' } },
        { text: 'Notice something? A bishop that starts on a dark square stays on dark squares **forever**.', board: { setup: 'Bc1', marks: { e3: 'star', g5: 'star', d8: 'star', a5: 'star' } } },
      ],
      setup: 'Bc1', stars: ['e3', 'g5', 'd8', 'a5'],
    },
    {
      id: 'bishops', kind: 'collect', title: 'Two Bishops', icon: 'B', moveTypes: 'B',
      intro: [
        'You have two bishops: one walks on light squares, the other on dark squares.',
        'Each star can only be reached by the bishop of the right color. Teamwork!',
      ],
      setup: 'Bc1 Bf1', stars: ['e3', 'b5', 'h6', 'd7', 'a3'],
    },
    {
      id: 'queen', kind: 'collect', title: 'The Queen', icon: 'Q', codex: ['queen'],
      intro: [
        { text: 'Bow before the **queen**, the most powerful piece! She moves like a rook **and** a bishop: straight or diagonal, any distance.', board: { setup: 'Qd4', legal: 'd4' } },
        'Grab all the stars. The queen can cover the whole board in a flash!',
      ],
      setup: 'Qd1', stars: ['a4', 'd7', 'h3', 'f8', 'b1'],
    },
    {
      id: 'capture', kind: 'collect', title: 'Capture!', icon: 'x', passive: true, codex: ['capture'],
      intro: [
        { text: 'To **capture**, move onto a square with an enemy piece. The enemy piece is removed from the board!', board: { setup: 'Rb2 pb6', arrows: [['b2', 'b6']], marks: { b6: 'target' } } },
        'Capture all the black pawns with your rook. Don\'t worry: they\'re too scared to fight back today.',
      ],
      setup: 'Rb1 pb6 pe6 pe2 ph2', targets: 'all',
    },
    {
      id: 'guarded', kind: 'collect', title: 'Guarded Squares', icon: '!', showDanger: true, codex: ['guarded'],
      intro: [
        'Careful now! Enemy pieces can capture too. A square an enemy piece could move to is **guarded**.',
        { text: 'I\'ll paint guarded squares with red stripes. Collect the stars, but never stop on a red square, or you\'ll be captured!', board: { setup: 'Qa1 rd8 bh6', danger: true } },
      ],
      setup: 'Qa1 rd8 bh6', stars: ['b3', 'g2', 'a7', 'h5'],
    },
    {
      id: 'gus', kind: 'battle', title: 'Boss: Grabby Gus', icon: 'boss', boss: true, character: 'gus', codex: ['char-gus', 'protect'],
      rules: { variant: 'capture-all', checks: false, castling: false, enPassant: false },
      setup: 'Ra1 Bc1 Qd1 Bf1 Rh1 ra8 bc8 qd8 bf8 rh8', side: 'w',
      bot: { depth: 1, noise: 50, greed: 450 }, maxMoves: 30, onLimit: 'material', threats: true,
      goal: 'Capture all of Gus\'s pieces (or have more points after 30 moves).',
      intro: [
        { who: 'gus', text: 'Har har! I\'m **Grabby Gus**! Everything on this board is MINE, and I grab EVERYTHING I can reach!' },
        'Gus is greedy: he captures whatever he can, even when it\'s a trap. Use that!',
        'Keep your pieces **protected** by each other. If Gus grabs a protected piece, you capture him right back.',
        'No kings in this battle: whoever captures all the enemy pieces wins. Red stripes show the squares Gus guards. Go!',
      ],
      extra: { type: 'keep', count: 3, label: 'Finish with 3+ pieces left' },
    },
  ],
};

const W2 = {
  id: 'w2', rank: 2, name: 'Knight Woods', biome: 'forest', color: '#3fa36a',
  blurb: 'The tricky knight and the precious king.',
  levels: [
    {
      id: 'knight', kind: 'collect', title: 'The Knight', icon: 'N', moveTypes: 'N', codex: ['knight'],
      intro: [
        { text: 'The **knight** moves in an L-shape: two squares in a straight line, then one square to the side.', board: { setup: 'Nd4', legal: 'd4' } },
        { text: 'It\'s the only piece that can **jump** over other pieces!', board: { setup: 'Nb1 Pa2 Pb2 Pc2 Pd2', legal: 'b1' } },
      ],
      setup: 'Nb1 Pa2 Pb2 Pc2 Pd2', stars: ['c3', 'e4', 'f6', 'd7'],
    },
    {
      id: 'jumps', kind: 'quiz', title: 'Knight Jumps', icon: 'N',
      intro: ['Knights are tricky, so let\'s practise. Tap **every** square the knight can jump to.'],
      questions: [
        { setup: 'Nd4', prompt: 'Tap every square this knight can jump to.', answer: { type: 'moves', from: 'd4' }, explain: 'A knight in the middle of the board reaches **8** squares. Knights love the center!' },
        { setup: 'Na1', prompt: 'And from the corner?', answer: { type: 'moves', from: 'a1' }, explain: 'Only **2** squares from a corner. "A knight on the rim is dim!"' },
        { setup: 'Ng6 Pe5 pf4', prompt: 'Tap every square this knight can reach. Remember: it can capture enemies, but not land on friends.', answer: { type: 'moves', from: 'g6' } },
      ],
    },
    {
      id: 'knight2', kind: 'collect', title: 'Through the Woods', icon: 'N', showDanger: true,
      intro: ['The woods are full of black pawns guarding squares. Hop to every star without stopping on a red square.', 'Remember, pawns guard diagonally forward: for black pawns, that\'s downward.'],
      setup: 'Ng1 pc6 pf5 pd3', stars: ['h3', 'e6', 'c4', 'b7'],
    },
    {
      id: 'king', kind: 'collect', title: 'The King', icon: 'K', showDanger: true, codex: ['king'],
      intro: [
        { text: 'This is the **king**: the most important piece of all. It moves just one square in any direction.', board: { setup: 'Ke4', legal: 'e4' } },
        'If your king gets captured, you lose the game. So never step onto a guarded square!',
      ],
      setup: 'Ke1 ra5 nd6', stars: ['c3', 'f3', 'g4', 'd4'],
    },
    {
      id: 'lunch', kind: 'collect', title: 'Free Lunch', icon: 'x', showDanger: true, codex: ['defender'],
      intro: [
        'Black pawns protect each other. If you capture a protected pawn, another pawn captures you back.',
        'Find the right **order**: take the unprotected pawns first, and the others will lose their guards!',
      ],
      setup: 'Nd2 pc5 pd6 pe5', targets: 'all',
    },
    {
      id: 'prance', kind: 'battle', title: 'Boss: Sir Prance', icon: 'boss', boss: true, character: 'prance', codex: ['char-prance'],
      rules: { variant: 'king-capture', checks: false, castling: false, enPassant: false },
      setup: 'Ke1 Ra1 Nb1 Ng1 Rh1 ke8 ra8 nb8 ng8 rh8', side: 'w',
      bot: { depth: 2, noise: 60, blunder: 0.18, style: { knights: 1 } }, threats: true,
      goal: 'Capture Sir Prance\'s king!',
      intro: [
        { who: 'prance', text: 'En garde! I am **Sir Prance**, and my knights shall leap upon your king!' },
        'In this battle, you win by **capturing the enemy king**. But he can capture yours too!',
        'Every move, check: is my king attacked? If it glows red, move it to safety, block, or capture the attacker!',
      ],
      extra: { type: 'moves', n: 25, label: 'Win in 25 moves or fewer' },
    },
  ],
};

const W3 = {
  id: 'w3', rank: 3, name: 'Pawn Plains', biome: 'plains', color: '#e8c060',
  blurb: 'Pawns: small, brave, and full of surprises.',
  levels: [
    {
      id: 'pawn', kind: 'collect', title: 'The Pawn', icon: 'P', codex: ['pawn', 'promotion'],
      intro: [
        { text: 'The **pawn** marches forward, one square at a time. Never backwards!', board: { setup: 'Pe3', legal: 'e3' } },
        { text: 'But on its very first move, a pawn may jump **two** squares.', board: { setup: 'Pe2', legal: 'e2' } },
        'And if a pawn reaches the far side of the board... it **promotes** into a queen! Just like your dream. Let\'s try!',
      ],
      setup: 'Pe2', stars: ['e4', 'e6', 'e8'],
    },
    {
      id: 'bites', kind: 'collect', title: 'Diagonal Bites', icon: 'P', passive: true,
      intro: [
        { text: 'Pawns capture differently than they move: one square **diagonally forward**.', board: { setup: 'Pd4 pc5 pe5 pd5', marks: { c5: 'target', e5: 'target' } } },
        'And a pawn can\'t move straight ahead if anything is in front of it. Capture your way to the last rank!',
      ],
      setup: 'Pc2 pd3 pd4 pe4 pf6 pe6 pg7', targets: ['d3', 'e4', 'f6', 'g7'], stars: ['g8'],
    },
    {
      id: 'pawnquiz', kind: 'quiz', title: 'Pawn Puzzles', icon: 'P',
      intro: ['Pawns have the strangest rules of all. Let\'s check you\'ve got them!'],
      questions: [
        { setup: 'Pe2', prompt: 'Tap every square this pawn can move to.', answer: { type: 'moves', from: 'e2' }, explain: 'From its starting square, a pawn may go one or two squares.' },
        { setup: 'Pd4 pc5 pd5 pe5', prompt: 'Tap every square this pawn can move to.', answer: { type: 'moves', from: 'd4' }, explain: 'It can\'t go forward (blocked!), but it can capture diagonally.' },
        { setup: 'Pf4 pf5', prompt: 'Can the white pawn move?', answer: { type: 'choice', options: ['Yes', 'No'], correct: 1 }, explain: 'No! It\'s blocked, and there\'s nothing to capture diagonally.' },
        { setup: 'Pb7', prompt: 'If this pawn moves forward, what can it become?', answer: { type: 'choice', options: ['Only a queen', 'Queen, rook, bishop or knight', 'A king'], correct: 1 }, explain: 'A pawn can promote to any piece except a king. Almost everyone picks a queen!' },
      ],
    },
    {
      id: 'party', kind: 'collect', title: 'Promotion Party', icon: 'Q',
      intro: ['Promote your pawn, then use your brand-new queen to collect every star!'],
      setup: 'Pb6', stars: ['b8', 'h8', 'h2', 'd2'],
    },
    {
      id: 'race', kind: 'battle', title: 'Pawn Race', icon: 'P', character: 'rookie', codex: ['passed-pawn'],
      rules: { variant: 'pawn-wars', checks: false, castling: false, enPassant: false },
      setup: 'Pa2 Pb2 Pc2 pa7 pb7 pc7', side: 'w',
      bot: { depth: 2, noise: 80, blunder: 0.25 },
      goal: 'Get a pawn to the other side first!',
      intro: [
        'A little race! Only pawns. The first pawn to reach the other side wins. If you can\'t move at all, you lose.',
        'Tip: a pawn with no enemy pawns in front of it, or beside it, is a **passed pawn**. Nothing can stop it!',
      ],
      extra: { type: 'keep', count: 2, label: 'Win with 2+ pawns left' },
    },
    {
      id: 'stomp', kind: 'battle', title: 'Boss: Sgt. Stomp', icon: 'boss', boss: true, character: 'stomp', codex: ['char-stomp', 'pawn-structure'],
      rules: { variant: 'pawn-wars', checks: false, castling: false, enPassant: false },
      setup: 'Pa2 Pb2 Pc2 Pd2 Pe2 Pf2 Pg2 Ph2 pa7 pb7 pc7 pd7 pe7 pf7 pg7 ph7', side: 'w',
      bot: { depth: 2, noise: 60, blunder: 0.22 },
      goal: 'Pawn Wars! First to the other side wins.',
      intro: [
        { who: 'stomp', text: 'TEN-HUT! I am **Sergeant Stomp**! My eight pawns march as one. LEFT, RIGHT, LEFT!' },
        'Full Pawn Wars! Keep your pawns together so they protect each other.',
        'Look for a chance to break through and create a passed pawn. And count: who reaches the end first?',
      ],
      extra: { type: 'keep', count: 4, label: 'Win with 4+ pawns left' },
    },
  ],
};

const W4 = {
  id: 'w4', rank: 4, name: 'Check Castle', biome: 'castle', color: '#9aa3c8',
  blurb: 'Check, checkmate, and the sneaky stalemate.',
  levels: [
    {
      id: 'check', kind: 'quiz', title: 'Check!', icon: '+', codex: ['check'],
      intro: [
        'Here\'s the most important rule in chess. When a king is attacked, it\'s in **check**.',
        'You must get out of check right away, and you may **never** move into check. That\'s why kings are never actually captured in real chess!',
      ],
      questions: [
        { setup: 'Ke1 Pd2 Pf2 re6 bb6 nh4 kg8', prompt: 'Your king is in check. Tap the piece giving check.', answer: { type: 'checkers' }, explain: 'The rook attacks straight down the e-file.' },
        { setup: 'Ke1 Pd2 Pe2 nd3 bb5 ra8 kg8', prompt: 'Which piece is giving check?', answer: { type: 'checkers' }, explain: 'Sneaky knight! Knights give check by jumping, so you can\'t block them.' },
        { setup: 'Kd1 Pe2 ba4 rd8 kh8', prompt: 'Uh-oh. Tap **every** piece giving check.', answer: { type: 'checkers' }, explain: 'Two at once! That\'s a **double check**. The only escape is to move the king.' },
      ],
    },
    {
      id: 'escape', kind: 'puzzle', title: 'Escape!', icon: '+', codex: ['escape-check'],
      intro: [
        'There are three ways out of check: **move** the king, **block** the attack, or **capture** the attacker.',
        'Find the best escape each time. Sometimes you can even win something!',
      ],
      puzzles: [
        { setup: 'Ke1 Nc3 Pa2 Pb2 Pf2 Pg2 Ph2 re4 kg8 pf7 pg7 ph7', prompt: 'Check! Escape, and win something while you\'re at it.', accept: 'engine', explain: 'You **captured** the attacker. Free rook!' },
        { setup: 'Kg1 Pf2 Pg2 Ph2 Bc4 ra1 kg8 pf7 pg7 ph7', prompt: 'Check along the back rank! Your king is stuck. How can you escape?', accept: 'engine', explain: 'You **blocked** the check. Only one way out!' },
        { setup: 'Ke4 Rh1 Pa2 Pb2 re8 nc6 kh8 ph7 pg7', prompt: 'Check from the rook! Where can your king go safely?', accept: 'engine', explain: 'Sometimes the king just has to **move**. Watch out for squares the knight guards!' },
      ],
    },
    {
      id: 'mateornot', kind: 'quiz', title: 'Checkmate?', icon: '#', codex: ['checkmate', 'stalemate'],
      intro: [
        'If a king is in check and there\'s **no way out**, that\'s **checkmate**. The game is over: whoever delivers checkmate wins!',
        'If a player is **not** in check but has no legal move at all, that\'s **stalemate**. Nobody wins: it\'s a draw.',
        'Look at Black\'s king. Is it check, checkmate, or stalemate?',
      ],
      questions: [
        { setup: 'kg8 pf7 pg7 ph7 Re8 Kg1', turn: 'b', prompt: 'Black to move. What is it?', answer: { type: 'status' }, explain: 'Checkmate! The king is trapped behind its own pawns. This is a **back-rank mate**.' },
        { setup: 'ke8 Qe2 Kg1', turn: 'b', prompt: 'Black to move. What is it?', answer: { type: 'status' }, explain: 'Just check: the king can step to the side.' },
        { setup: 'ka8 Qb6 Kc1', turn: 'b', prompt: 'Black to move. What is it?', answer: { type: 'status' }, explain: 'Stalemate! The king isn\'t attacked, but every move would walk into check. Draw.' },
        { setup: 'kh8 Qg7 Kg6', turn: 'b', prompt: 'Black to move. What is it?', answer: { type: 'status' }, explain: 'Checkmate! The queen is protected by the king, so it can\'t be captured.' },
        { setup: 'ke8 Qe7 Kg1', turn: 'b', prompt: 'Careful with this one!', answer: { type: 'status' }, explain: 'Only check: the queen is unprotected, so the king can simply capture it!' },
      ],
    },
    {
      id: 'queenmates', kind: 'puzzle', title: 'Queen Mates', icon: 'Q', drill: { gen: 'mate1-queen', count: 5 }, codex: ['mate-patterns'],
      intro: ['Your turn to deliver checkmate! Each position has a **mate in one** with your queen.', 'Tip: look at every check, then ask: can the king escape? Can the queen be captured?'],
    },
    {
      id: 'backrank', kind: 'puzzle', title: 'Back-Rank Mates', icon: 'R', drill: { gen: 'mate1-rook', count: 4 }, codex: ['back-rank'],
      intro: ['A king hiding behind its pawns can get trapped on its back rank. A rook or queen landing there can be checkmate!', 'Find the rook mate in each position.'],
    },
    {
      id: 'stalemate', kind: 'puzzle', title: 'Don\'t Stalemate!', icon: '=',
      intro: ['You\'re winning! But careful: leave the enemy king **at least one move** unless you\'re giving checkmate. Otherwise it\'s stalemate, a draw.', 'Find checkmate. Don\'t fall into the stalemate trap!'],
      puzzles: [
        { setup: 'kh8 Qf6 Kg6', prompt: 'Checkmate in one. Avoid the stalemate!', accept: 'mate', explain: 'Checkmate! Note that **Qf7** would have been stalemate. Ouch!' },
        { setup: 'ka1 Qd3 Kc2', prompt: 'One more: checkmate the king in the corner.', accept: 'mate', explain: 'Mate! **Qb3** looked tempting, but it\'s stalemate.' },
      ],
    },
    {
      id: 'rollo', kind: 'battle', title: 'Boss: King Rollo', icon: 'boss', boss: true, character: 'rollo', codex: ['char-rollo', 'kqk'],
      rules: { variant: 'standard', castling: false, enPassant: false },
      setup: 'Ke1 Qd1 ke5', side: 'w', bot: { depth: 3 }, maxMoves: 25, botDelay: 350,
      goal: 'Checkmate the runaway king within 25 moves. No stalemate!',
      intro: [
        { who: 'rollo', text: 'Eek! A queen?! You\'ll never catch me! Wheee!' },
        'King Rollo is alone, but slippery. Here\'s the secret recipe:',
        '1) Use your queen to build a **box** around his king. Make the box smaller, a knight\'s jump away from him, without giving check.',
        '2) Once he\'s pushed to the edge, bring **your king** closer to help.',
        '3) Deliver mate on the edge. And always leave him a move until the final blow! Ask for a hint if you\'re stuck.',
      ],
      extra: { type: 'moves', n: 15, label: 'Mate in 15 moves or fewer' },
    },
  ],
};

const W5 = {
  id: 'w5', rank: 5, name: 'Hanging Gardens', biome: 'garden', color: '#ff8ab8',
  blurb: 'Piece values, safety, and your first real game.',
  levels: [
    {
      id: 'values', kind: 'quiz', title: 'What\'s It Worth?', icon: '$', codex: ['values'],
      intro: [
        'Not all pieces are equal. We count them in points: **pawn 1, knight 3, bishop 3, rook 5, queen 9**. The king is priceless!',
        'A good trade gives you more points than you lose.',
      ],
      questions: [
        { setup: 'Rd4 nf5', prompt: 'Which piece is worth more?', answer: { type: 'choice', options: ['The rook', 'The knight'], correct: 0 }, explain: 'Rook 5, knight 3.' },
        { setup: 'Re1 ne5 pd6 Kg1 kg8', prompt: 'If your rook takes the knight, the pawn takes your rook back. Good trade?', arrows: [['e1', 'e5', 'info'], ['d6', 'e5', 'bad']], answer: { type: 'choice', options: ['Good trade', 'Bad trade'], correct: 1 }, explain: 'You win 3 but lose 5. Bad trade!' },
        { setup: 'Bb2 re5 pd6 Kg1 kg8', prompt: 'Your bishop takes the rook, then the pawn takes your bishop. Good trade?', arrows: [['b2', 'e5', 'info'], ['d6', 'e5', 'bad']], answer: { type: 'choice', options: ['Good trade', 'Bad trade'], correct: 0 }, explain: 'You win 5 and lose 3. That\'s +2. Good trade!' },
        { setup: 'Qd1 pd5 pe6 Kg1 kg8', prompt: 'Your queen can take the pawn on d5, but the e6 pawn takes back. Worth it?', arrows: [['d1', 'd5', 'info'], ['e6', 'd5', 'bad']], answer: { type: 'choice', options: ['Yes', 'No way'], correct: 1 }, explain: 'You\'d win 1 point and lose 9. Never trade your queen for a pawn!' },
      ],
    },
    {
      id: 'free', kind: 'puzzle', title: 'Free Pieces', icon: 'x', drill: { gen: 'free-piece', count: 5 }, codex: ['hanging'],
      intro: [
        'Before every move, ask: **can I capture something for free?**',
        'A piece is free (we say **hanging**) when nobody can capture back, or when the capture back costs them more.',
      ],
    },
    {
      id: 'danger', kind: 'quiz', title: 'Danger Vision', icon: '!',
      intro: ['Now the other side of the coin: which of **your** pieces are in danger?', 'Tap each of your pieces that the enemy could win: attacked and not protected enough.'],
      questions: [
        { setup: 'Kg1 Nc3 Bf4 Rd1 Ph2 Pg2 kg8 bb4 pe5 ph7', prompt: 'Tap your pieces that are in danger.', answer: { type: 'hanging', color: 'w' }, explain: 'The knight has no defender, and the bishop is attacked by a pawn.' },
        { setup: 'Ke1 Qd4 Nf3 Bg5 Pe2 kg8 nc6 ph6 pg7', prompt: 'Tap your pieces that are in danger.', answer: { type: 'hanging', color: 'w' }, explain: 'Even protected pieces are in danger if a **cheaper** piece attacks them: knight takes queen, pawn takes bishop!' },
        { setup: 'Kg1 Ra1 Nd4 Pc3 Pd2 Pe3 Pf2 Pg2 Ph2 kg8 bb2 nf5 pg7', prompt: 'Look carefully. Tap your pieces in danger.', answer: { type: 'hanging', color: 'w' }, explain: 'Only the rook! The bishop attacks it and nothing protects it. The knight and the c3 pawn are attacked too, but well protected: any capture there is a fair trade.' },
      ],
    },
    {
      id: 'rescue', kind: 'puzzle', title: 'Rescue Mission', icon: '+', drill: { gen: 'save-piece', count: 4 },
      intro: ['One of your pieces is under attack! Save it: move it to a safe square, protect it, or block the attack.'],
    },
    {
      id: 'cct', kind: 'puzzle', title: 'Checks, Captures, Threats', icon: '?', drill: { gens: ['mate1', 'free-piece', 'save-piece', 'mate1-rook', 'free-piece'] }, codex: ['cct'],
      intro: [
        'Here\'s the secret habit of strong players. Before **every** move, look for:',
        '**Checks**: can I check the king? Maybe it\'s mate!',
        '**Captures**: can I win something?',
        '**Threats**: what is my opponent attacking? Do I need to save something?',
        'Each puzzle needs one of the three. Which one?',
      ],
    },
    {
      id: 'hangs', kind: 'battle', title: 'Boss: Sir Hangs-a-Lot', icon: 'boss', boss: true, character: 'hangs', codex: ['char-hangs', 'full-game'],
      rules: { variant: 'standard', castling: false, enPassant: false },
      fen: 'start', side: 'w', bot: { depth: 1, noise: 100, blunder: 0.32 }, threats: true, warnings: true,
      goal: 'Your first real game of chess! Checkmate Sir Hangs-a-Lot.',
      intro: [
        { who: 'hangs', text: 'Ahoy! Ready for a jolly good game? I do hope I don\'t drop anything...' },
        'This is a **real game of chess**, with all the pieces! (We\'ll learn castling next world.)',
        'Sir Hangs-a-Lot leaves pieces hanging all the time. Use **checks, captures, threats** to grab them!',
        'I\'ll keep your danger vision on, and I\'ll warn you if you\'re about to blunder. Once you\'re way ahead, trade pieces and go for checkmate!',
      ],
      extra: { type: 'keepQueen', label: 'Win without losing your queen' },
    },
  ],
};

const W6 = {
  id: 'w6', rank: 6, name: 'Castle Coast', biome: 'coast', color: '#5ec8e8',
  blurb: 'Castling, en passant, promotion and draws.',
  levels: [
    {
      id: 'castling', kind: 'puzzle', title: 'Castling', icon: 'K', codex: ['castling'],
      intro: [
        'Time for a special move: **castling**! The king steps two squares toward a rook, and the rook hops over to the other side.',
        { text: 'It\'s the only move where two pieces move at once. It tucks your king into safety and wakes up your rook.', board: { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', arrows: [['e1', 'g1', 'good'], ['h1', 'f1', 'info']] } },
        'The rules: the king and that rook must not have moved yet, the squares between them must be empty, and the king can\'t be in check or cross an attacked square.',
        'To castle, just move your king two squares toward the rook.',
      ],
      puzzles: [
        { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', prompt: 'Castle **kingside** (the short side)!', accept: 'list', solution: ['e1g1'], wrong: 'To castle, move your **king** two squares toward the rook on [h1]: drag it from [e1] to [g1].', explain: 'Your king is safe behind its pawns, and your rook joins the game.' },
        { fen: 'r2qkbnr/ppp1pppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 4 4', prompt: 'Now castle **queenside** (the long side)!', accept: 'list', solution: ['e1c1'], wrong: 'Move your **king** two squares toward the rook on [a1]: from [e1] to [c1].', explain: 'Long castling puts your rook right on the open d-file.' },
      ],
    },
    {
      id: 'cancastle', kind: 'quiz', title: 'Can You Castle?', icon: '?',
      intro: ['Castling has strict rules. Can White castle in each position?'],
      questions: [
        { setup: 'Ke1 Rh1 Pf2 Pg2 Ph2 ke8 re6', prompt: 'Can White castle kingside?', answer: { type: 'castle', side: 'k' }, explain: 'No! You can\'t castle **out of check**.' },
        { setup: 'Ke1 Rh1 Pg2 Ph2 ke8 bc4', prompt: 'Can White castle kingside?', answer: { type: 'castle', side: 'k' }, explain: 'No! The king would **cross** [f1], which the bishop attacks.' },
        { setup: 'Ke1 Rh1 Pf2 Pg2 Ph2 ke8 pd7', prompt: 'Can White castle kingside?', answer: { type: 'castle', side: 'k' }, explain: 'Yes! Nothing in the way, nothing attacked.' },
        { setup: 'Ke1 Ra1 Pa2 Pc2 Pd3 ke8 rb8', prompt: 'Tricky! Can White castle queenside?', answer: { type: 'castle', side: 'q' }, explain: 'Yes! [b1] is attacked, but only the **king\'s** path matters. The rook may cross attacked squares.' },
      ],
    },
    {
      id: 'enpassant', kind: 'puzzle', title: 'En Passant', icon: 'P', codex: ['en-passant'],
      intro: [
        'One more pawn trick: **en passant** (French for "in passing").',
        { text: 'If an enemy pawn jumps two squares and lands right beside your pawn, you may capture it as if it had moved only one square.', board: { fen: '6k1/8/8/3pP3/8/8/8/4K3 w - d6 0 2', arrows: [['d7', 'd5', 'info'], ['e5', 'd6', 'good']] } },
        'But only on the very next move. Use it or lose it!',
      ],
      puzzles: [
        { fen: '6k1/8/8/3pP3/8/8/8/4K3 w - d6 0 2', lastMove: 'd7d5', prompt: 'Black\'s pawn just jumped from d7 to d5. Capture it **en passant**!', accept: 'list', solution: ['e5d6'], wrong: 'Your pawn on [e5] captures diagonally onto [d6], the square the black pawn skipped over.', explain: 'Your pawn lands on d6, and the black pawn disappears!' },
        { fen: '7k/8/8/1Pp5/8/8/8/K7 w - c6 0 1', lastMove: 'c7c5', prompt: 'That pawn is trying to sneak past. Stop it with en passant!', accept: 'list', solution: ['b5c6'], wrong: 'Capture **en passant**: your pawn on [b5] moves diagonally to [c6].', explain: 'Gotcha! And now your pawn is the one running for promotion.' },
      ],
    },
    {
      id: 'promo', kind: 'puzzle', title: 'Promotion Power', icon: 'Q', codex: ['underpromotion'],
      intro: ['When a pawn promotes, you choose its new piece. Almost always a queen... but not always!'],
      puzzles: [
        { setup: 'kh8 Kg6 Pe7', prompt: 'Promote and deliver checkmate!', accept: 'mate', explain: 'A brand-new piece, and checkmate. Glorious!' },
        { fen: '8/2q1P1k1/8/8/8/8/8/1K6 w - - 0 1', prompt: 'Promoting to a queen isn\'t best here. Find the knight **fork**!', accept: 'list', solution: ['e7e8n'], wrong: 'Push the pawn to [e8] and choose the **knight** when asked. Which squares would a knight there attack?', explain: 'A knight with check! After the king moves, you capture the queen. That\'s an **underpromotion**.' },
      ],
    },
    {
      id: 'draws', kind: 'quiz', title: 'Draws', icon: '=', codex: ['draws'],
      intro: [
        'Not every game has a winner. A game is a **draw** if:',
        '**Stalemate**: the player to move has no legal move but isn\'t in check.',
        '**Not enough pieces** to ever checkmate (like king against king).',
        '**Repetition**: the same position appears three times. And the **50-move rule**: 50 moves each with no capture or pawn move.',
      ],
      questions: [
        { setup: 'Ke4 ke6', prompt: 'What\'s the result?', answer: { type: 'choice', options: ['White wins', 'Draw', 'Keep playing'], correct: 1 }, explain: 'Two lonely kings can never checkmate. Draw!' },
        { setup: 'Ke4 Bc4 ke6', prompt: 'White has an extra bishop. What\'s the result?', answer: { type: 'choice', options: ['White wins', 'Draw', 'Keep playing'], correct: 1 }, explain: 'A bishop alone can\'t force checkmate. Draw!' },
        { setup: 'Ke4 Rh1 ke6', prompt: 'And with a rook?', answer: { type: 'choice', options: ['White wins', 'Draw', 'Keep playing'], correct: 2 }, explain: 'King and rook can force checkmate. Keep playing!' },
        { setup: 'kh8 Kg6 Ra8', turn: 'b', prompt: 'Black to move. What\'s the result?', answer: { type: 'choice', options: ['White wins', 'Draw', 'Keep playing'], correct: 0 }, explain: 'Checkmate! White wins.' },
        { setup: 'ka8 Qb6 Kc1', turn: 'b', prompt: 'Black to move. What\'s the result?', answer: { type: 'choice', options: ['White wins', 'Draw', 'Keep playing'], correct: 1 }, explain: 'Stalemate: draw, even though White has a whole queen.' },
      ],
    },
    {
      id: 'tess', kind: 'battle', title: 'Boss: Turtle Tess', icon: 'boss', boss: true, character: 'tess', codex: ['char-tess', 'plans'],
      rules: { variant: 'standard' }, fen: 'start', side: 'w',
      bot: { depth: 2, noise: 55, blunder: 0.16, style: { timid: 1 } }, threats: true, warnings: true,
      goal: 'Checkmate Turtle Tess. All the rules apply now!',
      intro: [
        { who: 'tess', text: 'Mmm... slow and steady. I\'ll just... stay... in my shell.' },
        'Turtle Tess hides behind her pawns and waits. To beat her, **you** have to make a plan.',
        'Develop your pieces, **castle** your king to safety, then bring everyone to attack her king together.',
      ],
      extra: { type: 'castled', label: 'Castle during the game' },
    },
  ],
};

const W7 = {
  id: 'w7', rank: 7, name: 'Tactics Tower', biome: 'tower', color: '#b07cff',
  blurb: 'Forks, pins, skewers and sneaky discoveries.',
  levels: [
    {
      id: 'forks', kind: 'puzzle', title: 'Forks', icon: 'N', codex: ['fork'],
      intro: [
        'A **fork** is when one piece attacks two enemy pieces at once. Your opponent can only save one!',
        'Knights are fork experts, but every piece can fork. Even a humble pawn!',
      ],
      puzzles: [
        { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', prompt: 'Fork the king and the rook!', accept: 'list', solution: ['b5c7'], explain: 'Check! The king must move, and then the rook on a8 is yours.' },
        { fen: '6k1/5ppp/8/2b1n3/8/3PP3/6PP/6K1 w - - 0 1', prompt: 'A pawn can fork too. Attack two pieces at once!', accept: 'list', solution: ['d3d4'], explain: 'The pawn attacks both the bishop and the knight. Black will lose one of them.' },
        { fen: 'r5k1/6pp/8/8/8/8/6PP/3Q2K1 w - - 0 1', prompt: 'Queen fork! Check the king and hit the rook.', accept: 'list', solution: ['d1d5'], explain: 'Check along the diagonal, and the rook on a8 is attacked too.' },
      ],
    },
    {
      id: 'forkdrill', kind: 'puzzle', title: 'Fork Finder', icon: 'N', drill: { gen: 'fork', count: 4 },
      intro: ['More forks! Find the knight jump that attacks the king and a big piece at the same time.'],
    },
    {
      id: 'pins', kind: 'puzzle', title: 'Pins', icon: 'B', codex: ['pin'],
      intro: [
        'A **pin** is when a piece can\'t move without exposing a more valuable piece behind it.',
        'If the piece behind is the king, the pinned piece can\'t legally move at all!',
      ],
      puzzles: [
        { fen: '4k3/1p6/2n5/1B6/3P4/8/8/4K3 w - - 0 1', prompt: 'The knight is pinned to its king. Attack it!', accept: 'list', solution: ['d4d5'], explain: 'The knight can\'t run away: it\'s pinned. You win it!' },
        { fen: '6k1/6pp/4q3/8/8/1P6/4BPPP/6K1 w - - 0 1', prompt: 'Pin the queen to the king!', accept: 'list', solution: ['e2c4'], explain: 'The queen can\'t step aside. She can take your bishop, but your pawn takes back: a queen for a bishop!' },
      ],
    },
    {
      id: 'skewers', kind: 'puzzle', title: 'Skewers', icon: 'R', codex: ['skewer'],
      intro: ['A **skewer** is a pin in reverse: you attack a valuable piece, it moves away, and you capture the piece behind it.'],
      puzzles: [
        { fen: '8/2k4q/8/8/8/8/8/R5K1 w - - 0 1', prompt: 'Skewer the king and queen!', accept: 'list', solution: ['a1a7'], explain: 'Check! When the king steps off the 7th rank, the queen falls.' },
        { fen: '8/1r6/8/8/4k3/8/8/2K2B2 w - - 0 1', prompt: 'Bishop skewer! Check the king and win the rook behind it.', accept: 'list', solution: ['f1g2'], explain: 'Check! The king steps aside, and the rook on b7 falls.' },
      ],
    },
    {
      id: 'discovered', kind: 'puzzle', title: 'Discoveries', icon: '!', codex: ['discovered'],
      intro: [
        'A **discovered attack** happens when you move one piece out of the way and reveal an attack by the piece behind it.',
        'If the moving piece makes its own threat too, your opponent faces two problems at once!',
      ],
      puzzles: [
        { fen: '6k1/5ppp/8/3q4/8/3B4/5PPP/3Q2K1 w - - 0 1', prompt: 'Your bishop blocks your queen\'s path to the black queen. Move it with check!', accept: 'list', solution: ['d3h7'], explain: 'Check! Even if the king takes your bishop, your queen captures the queen on d5. A bishop for a queen!' },
        { fen: '4k3/7q/8/8/4B3/8/5PPP/4R1K1 w - - 0 1', prompt: 'Your bishop is blocking your rook. Move it with a bang!', accept: 'engine', explain: 'Discovered check from the rook, and the bishop grabs the queen!' },
      ],
    },
    {
      id: 'mix', kind: 'puzzle', title: 'Tactic Tower', icon: '?', codex: ['mate-in-two'],
      intro: ['The tower\'s final floor: a mix of everything. Some puzzles take **two** moves!'],
      puzzles: [
        { fen: '2r3k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1', prompt: 'Mate in 2! Use both rooks.', accept: 'list', solution: ['d2d8', 'c8d8', 'd1d8'], explain: 'Back-rank mate! The first rook deflects the defender, the second one mates.' },
        { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', prompt: 'Win material!', accept: 'list', solution: ['b5c7'], explain: 'The royal fork strikes again.' },
        { fen: '8/2k4q/8/8/8/8/8/R5K1 w - - 0 1', prompt: 'Win the queen!', accept: 'list', solution: ['a1a7'], explain: 'Skewer!' },
        { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', prompt: 'Mate in one!', accept: 'mate', explain: 'Back-rank mate. Always give your king an escape square!' },
      ],
    },
    {
      id: 'fiona', kind: 'battle', title: 'Boss: Fiona Forks', icon: 'boss', boss: true, character: 'fiona', codex: ['char-fiona'],
      rules: { variant: 'standard' }, fen: 'start', side: 'w',
      bot: { depth: 2, noise: 35, blunder: 0.08, style: { knights: 1, aggression: 1 }, book: true }, threats: true, warnings: true,
      goal: 'Defeat Fiona Forks!',
      intro: [
        { who: 'fiona', text: 'Two for the price of one, darling! Let\'s see if you can spot my forks.' },
        'Fiona is sharp! She sets up forks and double attacks. Use your danger vision.',
        'Remember your routine every move: **checks, captures, threats**. For her moves AND yours.',
      ],
      extra: { type: 'noHints', label: 'Win without hints or takebacks' },
    },
  ],
};

const W8 = {
  id: 'w8', rank: 8, name: 'Crown Summit', biome: 'summit', color: '#ffd23f',
  blurb: 'Openings, endgames, and the final crown.',
  levels: [
    {
      id: 'principles', kind: 'quiz', title: 'Opening Principles', icon: '♦', codex: ['opening'],
      intro: [
        'Every game starts with the **opening**. Three golden rules:',
        '1) Control the **center** with pawns. 2) **Develop** knights and bishops toward the middle. 3) **Castle** early to keep your king safe.',
        'Which move follows the principles best?',
      ],
      questions: [
        { fen: 'start', prompt: 'Your first move. Which is best?', answer: { type: 'choice', options: ['e4', 'h4', 'Na3'], correct: 0 }, explain: '**e4** grabs the center and opens lines for the queen and bishop.' },
        { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', prompt: 'After 1.e4 e5, which move?', answer: { type: 'choice', options: ['Qh5', 'Nf3', 'a3'], correct: 1 }, explain: '**Nf3** develops a knight and attacks the e5 pawn. Qh5 brings the queen out too early: she\'ll get chased around.' },
        { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', prompt: 'Your pieces are developing nicely. Now?', answer: { type: 'choice', options: ['Ng5', 'O-O', 'a4'], correct: 1 }, explain: '**Castle!** Your king is safe and your rook comes toward the center. Ng5 moves the same piece twice.' },
        { fen: 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2', prompt: 'After 1.d4 Nf6, which move?', answer: { type: 'choice', options: ['c4', 'Kd2', 'g4'], correct: 0 }, explain: '**c4** fights for the center. Kd2 ruins castling and g4 weakens your king.' },
      ],
    },
    {
      id: 'openrace', kind: 'battle', title: 'The Opening Race', icon: '♦', character: 'rookie',
      rules: { variant: 'standard' }, fen: 'start', side: 'w', bot: { depth: 2, noise: 40, blunder: 0.05, book: true }, threats: true, warnings: true,
      goal: 'In 10 moves: develop both knights and both bishops, castle, and don\'t lose material.',
      custom: 'develop', maxMoves: 10,
      intro: [
        'A race against the clock! You have **10 moves** to get your pieces out.',
        'Develop both knights and both bishops, castle, and don\'t lose any material. Ready, set, develop!',
      ],
      extra: { type: 'noHints', label: 'No hints or takebacks' },
    },
    {
      id: 'ladder', kind: 'battle', title: 'Rook Ladder', icon: 'R', character: 'rollo', codex: ['ladder'],
      rules: { variant: 'standard', castling: false }, setup: 'Kh1 Ra1 Rb2 ke5', side: 'w', bot: { depth: 3 }, maxMoves: 12, botDelay: 300,
      goal: 'Checkmate with two rooks in 12 moves.',
      intro: [
        'Two rooks make the easiest checkmate: the **ladder**!',
        'One rook cuts off the king along a rank, the other gives check on the next rank. Then they swap roles, pushing the king step by step to the edge.',
        'Keep your rooks far from the king so he can\'t attack them!',
      ],
      extra: { type: 'moves', n: 7, label: 'Mate in 7 moves or fewer' },
    },
    {
      id: 'loneRook', kind: 'battle', title: 'The Lone Rook', icon: 'R', character: 'rollo', codex: ['krk'],
      rules: { variant: 'standard', castling: false }, setup: 'Ke1 Ra1 ke5', side: 'w', bot: { depth: 3 }, maxMoves: 40, botDelay: 300,
      goal: 'Checkmate with king and rook within 40 moves.',
      intro: [
        'One rook is harder, but you can do it!',
        'The rook builds a box around the enemy king. Your king walks up to face him. When the kings face each other, a rook check on the edge squeezes him further.',
        'Use the **hint** button whenever you\'re unsure. Practice makes perfect!',
      ],
      extra: { type: 'moves', n: 25, label: 'Mate in 25 moves or fewer' },
    },
    {
      id: 'outrun', kind: 'battle', title: 'Outrun the King', icon: 'P', character: 'rollo', codex: ['square-rule'],
      rules: { variant: 'standard', castling: false }, setup: 'Kh1 Pa5 ke5', side: 'w', bot: { depth: 4 }, maxMoves: 30, botDelay: 300,
      goal: 'Promote your pawn, then checkmate within 30 moves.',
      intro: [
        'Can the king catch your pawn? Use the **rule of the square**: draw a square from the pawn to the last rank. If the king can\'t step into it, the pawn wins the race!',
        'Run, pawn, run! Then finish with your new queen.',
      ],
      extra: { type: 'moves', n: 15, label: 'Mate in 15 moves or fewer' },
    },
    {
      id: 'iron', kind: 'battle', title: 'Final Boss: The Iron Queen', icon: 'boss', boss: true, character: 'iron', codex: ['char-iron'],
      rules: { variant: 'standard' }, fen: 'start', side: 'w',
      bot: { depth: 3, noise: 40, blunder: 0.07, book: true, opening: 20 }, threats: false, warnings: true,
      goal: 'Defeat the Iron Queen and earn your crown!',
      intro: [
        { who: 'iron', text: 'So. The little pawn wants a crown. You will have to **earn** it.' },
        'This is it: the last rank! Everything you\'ve learned comes together now.',
        'Develop, castle, look for checks, captures and threats every move, and don\'t rush. I believe in you!',
      ],
      extra: { type: 'noHints', label: 'Win without hints or takebacks' },
    },
  ],
};

export const WORLDS = [W1, W2, W3, W4, W5, W6, W7, W8];

// Flat list with ids like "w1-rook".
export const LEVELS = [];
for (const w of WORLDS) w.levels.forEach((l, i) => { l.uid = `${w.id}-${l.id}`; l.world = w; l.index = i; LEVELS.push(l); });

export const levelById = uid => LEVELS.find(l => l.uid === uid);
export const nextLevel = l => LEVELS[LEVELS.indexOf(l) + 1] || null;
