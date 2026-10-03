// Codex entries: unlocked by levels, linked from the coach's comments.
// demo: a little board that loops through `moves` (UCI) with optional arrows/marks.
export const CODEX_CATS = ['Basics', 'Pieces', 'Rules', 'Safety', 'Tactics', 'Strategy', 'Endgames', 'Characters'];

export const CODEX = {
  board: {
    title: 'The Board', cat: 'Basics', icon: 'board',
    text: 'The chessboard has **64 squares** in an 8×8 grid. Columns are **files** (a–h), rows are **ranks** (1–8). Every square has a name like [e4]: file first, then rank.\n\nSet the board so each player has a **light square in the bottom-right corner** ("light on the right"). White always moves first.',
    demo: { fen: 'start', marks: { h1: 'goal', a8: 'goal' } },
  },
  rook: {
    title: 'Rook', cat: 'Pieces', icon: 'R',
    text: 'Moves any number of squares in a **straight line**: up, down, left or right. It can\'t jump over pieces.\n\nWorth **5 points**. Rooks love open files (columns with no pawns) and the 7th rank.',
    demo: { setup: 'Rd4 pd7 Pb4', legal: 'd4' },
  },
  bishop: {
    title: 'Bishop', cat: 'Pieces', icon: 'B',
    text: 'Moves any number of squares **diagonally**. A bishop stays on its starting square color for the whole game, so each side has a light-squared and a dark-squared bishop.\n\nWorth **3 points**. Two bishops together are a strong team.',
    demo: { setup: 'Bd4 pf6 Pb2', legal: 'd4' },
  },
  queen: {
    title: 'Queen', cat: 'Pieces', icon: 'Q',
    text: 'The most powerful piece: moves like a **rook and a bishop** combined, any distance in any straight or diagonal line.\n\nWorth **9 points**. Don\'t bring her out too early in the game, or enemy pieces will chase her around.',
    demo: { setup: 'Qd4', legal: 'd4' },
  },
  knight: {
    title: 'Knight', cat: 'Pieces', icon: 'N',
    text: 'Moves in an **L-shape**: two squares one way, then one square sideways. It\'s the only piece that **jumps** over others. Each jump lands on a square of the opposite color.\n\nWorth **3 points**. Knights are best in the center: "a knight on the rim is dim!"',
    demo: { setup: 'Nd4 Pc3 pe5', legal: 'd4' },
  },
  king: {
    title: 'King', cat: 'Pieces', icon: 'K',
    text: 'Moves **one square** in any direction. The king can never move onto a square attacked by an enemy piece.\n\nThe king is priceless: if it\'s checkmated, the game is lost. Keep it safe early on (castle!), then make it an active fighter in the endgame.',
    demo: { setup: 'Ke4', legal: 'e4' },
  },
  pawn: {
    title: 'Pawn', cat: 'Pieces', icon: 'P',
    text: 'Moves **straight forward one square** (two squares on its first move), but **captures diagonally forward**. It can never move backward, and it\'s blocked by anything directly in front of it.\n\nWorth **1 point**, but a pawn that reaches the last rank **promotes**!',
    demo: { setup: 'Pe2 Pc4 pd5', legal: 'e2' },
  },
  capture: {
    title: 'Capturing', cat: 'Basics', icon: 'x',
    text: 'To capture, move your piece onto a square occupied by an enemy piece. The enemy piece is removed. You can\'t capture your own pieces, and only one piece moves per turn.\n\nCapturing is optional in chess (unlike checkers), so don\'t grab things that are protected unless the trade is good for you.',
    demo: { setup: 'Rb2 pb6', moves: ['b2b6'] },
  },
  guarded: {
    title: 'Guarded Squares', cat: 'Safety', icon: '!',
    text: 'A square is **guarded** (or **attacked**) if an enemy piece could capture something there. Before moving a piece somewhere, ask: could it be captured on that square?\n\nPawns guard the squares **diagonally in front** of them, not the square straight ahead.',
    demo: { setup: 'Qa1 rd8 bh6', danger: true },
  },
  protect: {
    title: 'Protecting Pieces', cat: 'Safety', icon: '+',
    text: 'A piece is **protected** (or **defended**) when one of your own pieces could capture back if it were taken. Protected pieces can still be lost to a **cheaper** attacker: a pawn attacking your knight is a real threat even if the knight is protected.',
    demo: { setup: 'Nd4 Pe3 pc6', arrows: [['e3', 'd4', 'good'], ['c6', 'd5', 'info']] },
  },
  defender: {
    title: 'Removing the Defender', cat: 'Tactics', icon: 'x',
    text: 'If a piece is only protected by one defender, capture or chase away the **defender** first. Then the piece is hanging!',
    demo: { setup: 'Nd2 pc5 pd6 pe5', danger: true, arrows: [['d6', 'c5', 'bad'], ['d6', 'e5', 'bad']] },
  },
  promotion: {
    title: 'Promotion', cat: 'Rules', icon: 'Q',
    text: 'When a pawn reaches the last rank, it **must** turn into a queen, rook, bishop or knight (never a king). You can even have two queens!\n\nThat\'s why advanced pawns are so dangerous, and why this quest is about a pawn who dreams of becoming a queen.',
    demo: { setup: 'Pb6', moves: ['b6b7', 'b7b8q'] },
  },
  underpromotion: {
    title: 'Underpromotion', cat: 'Rules', icon: 'N',
    text: 'Promoting to something other than a queen. Usually a **knight**, to give a check or fork that a queen couldn\'t, or a rook, to avoid **stalemate**.',
    demo: { fen: '8/2q1P1k1/8/8/8/8/8/1K6 w - - 0 1', moves: ['e7e8n'] },
  },
  'passed-pawn': {
    title: 'Passed Pawns', cat: 'Strategy', icon: 'P',
    text: 'A **passed pawn** has no enemy pawns in front of it on its file or the files next to it. Only pieces can stop it. "Passed pawns must be pushed!"',
    demo: { setup: 'Pd5 Pa2 pb7 pg7', marks: { d8: 'goal' }, arrows: [['d5', 'd8', 'good']] },
  },
  'pawn-structure': {
    title: 'Pawn Chains', cat: 'Strategy', icon: 'P',
    text: 'Pawns side by side, or protecting each other diagonally, are strong. Lonely pawns (no friendly pawns on neighboring files) are weak, and two pawns on the same file (doubled) get in each other\'s way.',
    demo: { setup: 'Pc3 Pd4 Pe5 Ph2', arrows: [['c3', 'd4', 'good'], ['d4', 'e5', 'good']] },
  },
  check: {
    title: 'Check', cat: 'Rules', icon: '+',
    text: 'A king that is attacked is **in check**. You must get out of check immediately, and you can never make a move that puts or leaves your own king in check.',
    demo: { setup: 'Ke1 re6 kg8', arrows: [['e6', 'e1', 'bad']] },
  },
  'escape-check': {
    title: 'Escaping Check', cat: 'Rules', icon: '+',
    text: 'Three ways out of check:\n1) **Move** the king to a safe square.\n2) **Block** the attack by putting a piece in between (impossible against knights).\n3) **Capture** the piece giving check.',
    demo: { setup: 'Ke1 Nc3 re4 kg8', moves: ['c3e4'] },
  },
  checkmate: {
    title: 'Checkmate', cat: 'Rules', icon: '#',
    text: 'Check with **no way out**: the king can\'t move, the attack can\'t be blocked, and the attacker can\'t be captured. Checkmate ends the game immediately: the side delivering it wins.',
    demo: { setup: 'kg8 pf7 pg7 ph7 Re1 Kg1', moves: ['e1e8'] },
  },
  stalemate: {
    title: 'Stalemate', cat: 'Rules', icon: '=',
    text: 'The player to move is **not in check** but has **no legal move**. The game is a **draw**, no matter how much material anyone has. When you\'re winning, always leave the enemy king a square until you can give checkmate!',
    demo: { setup: 'ka8 Qb6 Kc1', turn: 'b' },
  },
  'mate-patterns': {
    title: 'Mating Patterns', cat: 'Tactics', icon: '#',
    text: 'Most checkmates repeat a few patterns. A queen right next to the king, **protected** by another piece, is the classic one. Look for checks that take away every escape square.',
    demo: { setup: 'kh8 Qf6 Kg6', moves: ['f6g7'] },
  },
  'back-rank': {
    title: 'Back-Rank Mate', cat: 'Tactics', icon: 'R',
    text: 'A king stuck behind its own pawns on the back rank can be mated by a rook or queen landing on that rank. Defend it by giving your king an escape square ("luft"), like moving the h-pawn one step.',
    demo: { setup: 'kg8 pf7 pg7 ph7 Ra1 Kg1', moves: ['a1a8'] },
  },
  kqk: {
    title: 'Queen + King Mate', cat: 'Endgames', icon: 'Q',
    text: 'With queen and king against a lone king:\n1) Put your queen a **knight\'s move** away from the enemy king to build a shrinking box.\n2) Once the king is on the edge, bring **your king** close.\n3) Mate with the queen protected by your king.\nAlways check that the enemy king still has a move, or it\'s stalemate!',
    demo: { setup: 'ka8 Qc6 Kc1', moves: ['c1b2', 'a8b8', 'b2b3', 'b8a7', 'b3b4', 'a7b8', 'b4b5', 'b8a7', 'c6c7', 'a7a8', 'b5a6', 'a8b8', 'c7b7'] },
  },
  ladder: {
    title: 'The Rook Ladder', cat: 'Endgames', icon: 'R',
    text: 'Two rooks (or a rook and queen) mate easily: one rook cuts the king off along a rank while the other gives check on the next rank. They take turns, climbing like a ladder until the king hits the edge.',
    demo: { setup: 'ke4 Ra1 Rb2 Kh8', moves: ['a1a4', 'e4d5', 'b2b5', 'd5c6', 'a4a6', 'c6c7', 'b5b7', 'c7c8', 'a6a8'] },
  },
  krk: {
    title: 'Rook + King Mate', cat: 'Endgames', icon: 'R',
    text: 'With a single rook, the rook cuts off the king in a **box** while your king walks up. When the two kings face each other (one square between them), a rook check along the edge pushes the enemy king back. Repeat until mate on the edge.',
    demo: { setup: 'ke8 Ra7 Ke6', moves: ['a7a8'] },
  },
  'square-rule': {
    title: 'Rule of the Square', cat: 'Endgames', icon: 'P',
    text: 'Can a king catch a passed pawn? Imagine a square from the pawn to its promotion rank. If the enemy king can step **inside the square** (on its move), it catches the pawn. If not, the pawn wins the race!',
    demo: { setup: 'Pa5 ke5 Kh1', marks: { a5: 'goal', d5: 'goal', a8: 'goal', d8: 'goal' } },
  },
  'active-king': {
    title: 'Active King', cat: 'Endgames', icon: 'K',
    text: 'When most pieces are traded off and there\'s little danger of checkmate, the king becomes a strong fighting piece. March it toward the center and the pawns!',
    demo: { setup: 'Ke1 ke8 Pa2 pa7 Pf4 pf5', moves: ['e1d2', 'e8d7', 'd2d3', 'd7d6', 'd3d4'] },
  },
  values: {
    title: 'Piece Values', cat: 'Safety', icon: '$',
    text: 'Pawn **1** · Knight **3** · Bishop **3** · Rook **5** · Queen **9** · King: priceless.\n\nAdd up what you win and lose in a trade. Giving a knight (3) for a rook (5) is great; giving a rook for a knight is a loss of 2 points.',
    demo: { setup: 'Ke1 Qd1 Ra1 Bc1 Nb1 Pa2' },
  },
  hanging: {
    title: 'Hanging Pieces', cat: 'Safety', icon: '!',
    text: 'A **hanging** piece can be captured for free: nobody protects it, or a cheaper piece attacks it. Most games between beginners are decided by hanging pieces. After every move your opponent makes, ask: **what did that move attack?**',
    demo: { setup: 'Nc3 bb4 Bf4 pe5', danger: true },
  },
  cct: {
    title: 'Checks, Captures, Threats', cat: 'Safety', icon: '?',
    text: 'Before every move, look for:\n**Checks**: can I check? It might be mate.\n**Captures**: can I win material?\n**Threats**: what is my opponent attacking, and what could I attack?\nThen check your chosen move is safe. This habit alone wins most beginner games.',
    demo: { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', arrows: [['h5', 'f7', 'good']] },
  },
  'full-game': {
    title: 'A Whole Game', cat: 'Strategy', icon: 'K',
    text: 'A game has three parts:\n**Opening**: develop your pieces and castle.\n**Middlegame**: make plans, attack, look for tactics.\n**Endgame**: few pieces left, promote pawns and checkmate.\nWhen you\'re ahead in material, **trade pieces**: the fewer pieces left, the bigger your advantage.',
    demo: { fen: 'start', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1'] },
  },
  castling: {
    title: 'Castling', cat: 'Rules', icon: 'K',
    text: 'The king moves **two squares** toward a rook, and that rook jumps to the square the king crossed. Allowed only if:\n• neither the king nor that rook has moved yet,\n• the squares between them are empty,\n• the king is not in check and doesn\'t cross or land on an attacked square.\nCastle early to keep your king safe!',
    demo: { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: ['e1g1'] },
  },
  'en-passant': {
    title: 'En Passant', cat: 'Rules', icon: 'P',
    text: 'If a pawn moves two squares and lands **beside** an enemy pawn, that enemy pawn may capture it as if it had moved only one square. This is allowed **only on the very next move**.',
    demo: { fen: '6k1/3p4/8/4P3/8/8/8/4K3 b - - 0 1', moves: ['d7d5', 'e5d6'] },
  },
  draws: {
    title: 'Draws', cat: 'Rules', icon: '=',
    text: 'A game is drawn by:\n• **Stalemate**: no legal move, not in check.\n• **Insufficient material**: e.g. king vs king, or king and bishop vs king.\n• **Threefold repetition**: the same position three times.\n• **50-move rule**: 50 moves each with no pawn move or capture.\n• **Agreement** between the players.',
    demo: { setup: 'Ke4 ke6' },
  },
  plans: {
    title: 'Making a Plan', cat: 'Strategy', icon: '?',
    text: 'When there are no tactics, improve your **worst** piece, open lines toward the enemy king, and bring more attackers than they have defenders. Against a passive opponent, take space with pawns before you attack.',
    demo: { fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 6', arrows: [['b1', 'c3', 'good'], ['c1', 'g5', 'good']] },
  },
  fork: {
    title: 'Fork', cat: 'Tactics', icon: 'N',
    text: 'One piece attacks **two or more** enemy pieces at once. They can only save one. Knights are the champion forkers (they can fork pieces that can\'t attack them back), but pawns, queens and even kings can fork.',
    demo: { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', moves: ['b5c7', 'e8d7', 'c7a8'] },
  },
  pin: {
    title: 'Pin', cat: 'Tactics', icon: 'B',
    text: 'A piece can\'t move without exposing a more valuable piece behind it. If the piece behind is the **king**, the pin is absolute: the pinned piece can\'t legally move. Attack pinned pieces: they can\'t run away!',
    demo: { fen: '4k3/1p6/2n5/1B6/3P4/8/8/4K3 w - - 0 1', moves: ['d4d5'] },
  },
  skewer: {
    title: 'Skewer', cat: 'Tactics', icon: 'R',
    text: 'The reverse of a pin: you attack a valuable piece (often the king), it has to move, and the piece **behind** it falls.',
    demo: { fen: '8/2k4q/8/8/8/8/8/R5K1 w - - 0 1', moves: ['a1a7', 'c7b6', 'a7h7'] },
  },
  discovered: {
    title: 'Discovered Attack', cat: 'Tactics', icon: '!',
    text: 'Moving one piece **uncovers** an attack by the piece behind it. If the moving piece also makes a threat (or gives check), your opponent faces two attacks at once. When both pieces give check, it\'s a **double check**: only a king move helps.',
    demo: { fen: '6k1/5ppp/8/3q4/8/3B4/5PPP/3Q2K1 w - - 0 1', moves: ['d3h7', 'g8h7', 'd1d5'] },
  },
  'mate-in-two': {
    title: 'Mate in Two', cat: 'Tactics', icon: '#',
    text: 'Some checkmates need a preparing move first: a **sacrifice** that drags a defender away, or a check that forces the king onto a mating square. Look at forcing moves (checks and captures) first.',
    demo: { fen: '2r3k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1', moves: ['d2d8', 'c8d8', 'd1d8'] },
  },
  opening: {
    title: 'Opening Principles', cat: 'Strategy', icon: '♦',
    text: '1) Put pawns in the **center** (e4, d4).\n2) **Develop** knights and bishops toward the center, knights before bishops.\n3) **Castle** early.\n4) Don\'t move the same piece twice or bring the queen out too soon.\n5) Connect your rooks.',
    demo: { fen: 'start', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'e1g1'] },
  },
  'char-gus': { title: 'Grabby Gus', cat: 'Characters', icon: 'char:gus', text: 'A rook who has never met a capture he didn\'t like. Beat him by letting him grab protected pieces.', demo: null },
  'char-prance': { title: 'Sir Prance', cat: 'Characters', icon: 'char:prance', text: 'A knight of great courage and little caution. His knights hop straight at your king.', demo: null },
  'char-stomp': { title: 'Sergeant Stomp', cat: 'Characters', icon: 'char:stomp', text: 'Drill sergeant of the Pawn Plains. Believes in marching in perfect formation.', demo: null },
  'char-rollo': { title: 'King Rollo', cat: 'Characters', icon: 'char:rollo', text: 'A lone king who has escaped many queens. He hopes you\'ll stalemate him.', demo: null },
  'char-hangs': { title: 'Sir Hangs-a-Lot', cat: 'Characters', icon: 'char:hangs', text: 'A cheerful bishop who forgets to protect his pieces. The perfect first opponent.', demo: null },
  'char-tess': { title: 'Turtle Tess', cat: 'Characters', icon: 'char:tess', text: 'Patient and defensive. She waits in her shell for you to overreach.', demo: null },
  'char-fiona': { title: 'Fiona Forks', cat: 'Characters', icon: 'char:fiona', text: 'A sly knight with an eye for double attacks. Count your undefended pieces!', demo: null },
  'char-iron': { title: 'The Iron Queen', cat: 'Characters', icon: 'char:iron', text: 'Ruler of the eighth rank. Defeat her to earn your crown.', demo: null },
};

// Coach tags -> codex entries.
export const TAG_TO_CODEX = {
  development: 'opening', center: 'opening', 'king-safety': 'castling', castling: 'castling', 'active-king': 'active-king', 'passed-pawn': 'passed-pawn',
  hanging: 'hanging', fork: 'fork', pin: 'pin', skewer: 'skewer', 'discovered attack': 'discovered', 'double check': 'discovered',
  'mate threat': 'checkmate', checkmate: 'checkmate', stalemate: 'stalemate', check: 'check',
};
