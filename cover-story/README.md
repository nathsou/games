# Cover Story

A word-association spy game, inspired by *Codenames*, in English and French. Vanilla HTML, CSS and ES modules.

## Play

25 words. A clue is one word and a number; it can't be a word still in play, or contain one, or sit inside one (accents and case are ignored).

- **Duo** (co-op): each partner holds one side of the key: nine agents for the other to find and three assassins. Take turns giving clues; the guesser keeps going while they find agents on the giver's side. A bystander ends the turn and is marked for that side; an assassin loses. Find all 15 agents in 7, 9 or 11 turns. Play with a friend, the bot or an AI partner.
- **Teams**: Red and Blue each have a spymaster and an operative. Operatives may guess the number plus one. First team to uncover all its agents wins; the assassin loses at once. Solo, you play one role with a bot or AI partner against a bot or AI team.

## Words

About 245 original words per language in five themed packs (**Nature & animals**, **Home & food**, **Places & travel**, **Science & body**, **Culture & fun**) or all together. The French list was written for French, with its own double meanings (*glace*, *carte*, *pile*, *puce*, *canard*…), not translated. Each word lists associations: they are what the bot knows.

## Bots and AI

The bot gives clues that several of its words share and none of the dangerous ones do, and guesses words linked to the clue, stopping when nothing fits. It is careful rather than brilliant: in tests, bot teams never hit the assassin in 400 games, and two bots playing Duo together find about 9 of the 15 agents in nine turns. Solo Duo with a bot defaults to eleven turns.

AI players use the collection's shared provider settings (see [shared AI](../shared/ai/README.md)). They receive only their seat's view: spymasters and Duo partners see their key, operatives the revealed cards. An operative plans one ordered list of guesses per clue, which the page plays one at a time.

## With a friend

Duo seats both people as partners. Teams lineups: **together** on one team (the creator picks who gives clues), **rival spymasters** with bot or AI operatives, or **rival operatives** with bot or AI spymasters. Only spymaster seats receive the key. See [playing with a friend](../docs/FRIEND_SESSIONS.md).

## Checks

`npm test` checks both word lists, deals, 250 bot games in both modes and languages, clue validation, guess limits, the assassin, key privacy, the AI guess plan and room lineups.
