# Cover Story

A word-association spy game, inspired by *Codenames*, in English and French. Vanilla HTML, CSS and ES modules.

Cards prioritize large word labels and explicit role names. Original agent portraits appear subtly behind known roles; artwork follows only information already available in the seat's view. See [artwork provenance and prompt](assets/PROMPTS.md).

## Play

25 words. A clue is one word and a number; it can't be a word still in play, or contain one, or sit inside one (accents and case are ignored).

- **Duo** (co-op): each partner holds one side of the key: nine agents for the other to find and three assassins. Take turns giving clues; the guesser keeps going while they find agents on the giver's side. A bystander ends the turn and is marked for that side; an assassin loses. Find all 15 agents in 7, 9 or 11 turns. Human play is the default: use separate screens in a friend room, or pass one device between partners. A handoff screen hides the key between turns and when the tab is hidden. Bot and AI partners remain optional practice settings.
- **Duel** (two humans, head to head): both players guess from printed clues drawn from the authored word associations. Alternate one guess at a time: a match scores +1 and claims the word; a miss scores −1 and blocks that word for this clue. Two consecutive passes, or finding all matches, draws the next clue. The starting player alternates each clue. Highest score after 7, 9 or 11 clues wins; equal scores draw. Play on one device or in a friend room. This variant has no bots, AI, private keys or assassins.
- **Teams**: Red and Blue each have a spymaster and an operative. Operatives may guess the number plus one. First team to uncover all its agents wins; the assassin loses at once. Solo, you play one role with a bot or AI partner against a bot or AI team.

## Words

About 245 original words per language in five themed packs (**Nature & animals**, **Home & food**, **Places & travel**, **Science & body**, **Culture & fun**) or all together. The French list was written for French, with its own double meanings (*glace*, *carte*, *pile*, *puce*, *canard*…), not translated. Each word lists associations: they are what the bot knows.

## Bots and AI

The bot gives clues that several of its words share and none of the dangerous ones do, and guesses words linked to the clue, stopping when nothing fits. It is careful rather than brilliant: in tests, bot teams never hit the assassin in 400 games, and two bots playing Duo together find about 9 of the 15 agents in nine turns. Solo Duo with a bot defaults to eleven turns.

AI players use the collection's shared provider settings (see [shared AI](../shared/ai/README.md)). They receive only their seat's view: spymasters and Duo partners see their key, operatives the revealed cards. An operative plans one ordered list of guesses per clue, which the page plays one at a time.

## With a friend

Duo seats both people as partners; Duel seats them as opponents. Both modes require only two humans, and hide irrelevant bot/AI setup options. Teams lineups: **together** on one team (the creator picks who gives clues), **rival spymasters** with bot or AI operatives, or **rival operatives** with bot or AI spymasters. Only spymaster seats receive the key. See [playing with a friend](../docs/FRIEND_SESSIONS.md).

## Checks

`npm test` checks Duel scoring, turn ownership, invalid guesses, bounded rounds and draws in both languages, plus both word lists, deals, 250 bot games in both modes and languages, clue validation, guess limits, the assassin, key privacy, the AI guess plan and room lineups.

From the repository root, `npm run test:gameplay:ui` checks local interactions and `npm run test:parlor:ui` checks two-browser room play against a running preview. Set `GAMES_URL` as needed.
