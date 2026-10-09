import {DECKS} from './decks.js';

export default {
  validate(value) {
    const {role, options} = value;
    if (!['giver','guesser'].includes(role) || !options || !Object.hasOwn(DECKS,options.theme) || !Object.hasOwn(DECKS,options.clueTheme) || !['classic','fixed'].includes(options.variant)) throw new Error('Choose valid Cluance decks, role and hand.');
    return {role, options:{theme:options.theme, clueTheme:options.clueTheme, variant:options.variant}};
  },
  saved(read) {
    const setup=read('cluance-v1:setup');
    return {role:setup.mode==='peer-host'?'giver':'guesser',options:{theme:setup.theme||'french',clueTheme:!setup.clueTheme||setup.clueTheme==='same'?setup.theme||'french':setup.clueTheme,variant:setup.variant||'classic'}};
  },
  fallback: {role:'guesser',options:{theme:'french',clueTheme:'french',variant:'classic'}},
  summary: (value, host) => `${DECKS[value.options.theme].name} · clues from ${DECKS[value.options.clueTheme].name} · ${value.options.variant==='fixed'?'fixed five':'draw replacements'} · you ${((value.role==='giver')===host)?'give clues':'guess'}`,
  render({select, fields}, setup) {
    select('role','Your role',{guesser:'Guess the secret',giver:'Give the clues'},setup.role);
    const decks=Object.fromEntries(Object.entries(DECKS).map(([id,deck])=>[id,deck.name]));
    select('theme','Board deck',decks,setup.options.theme);
    select('clueTheme','Clue deck',{same:'Same as the board',...decks},setup.options.clueTheme===setup.options.theme?'same':setup.options.clueTheme);
    select('variant','Clue giver’s hand',{classic:'Draw a replacement after each clue',fixed:'Keep the initial five cards'},setup.options.variant);
    return ()=>({role:fields.role.value,options:{theme:fields.theme.value,clueTheme:fields.clueTheme.value==='same'?fields.theme.value:fields.clueTheme.value,variant:fields.variant.value}});
  },
};
