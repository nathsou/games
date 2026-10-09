const MIDNIGHT = {backhand:'Backhand', closing:'Closing Time', heist:'Heist Night'};
export default {
  validate(value) {
    const {type = 'backhand', team = false, opponent = 'dealer'} = value;
    if (!Object.hasOwn(MIDNIGHT,type) || typeof team !== 'boolean' || !['dealer','model'].includes(opponent)) throw new Error('Choose valid Midnight Table settings.');
    return {type,team,opponent};
  },
  saved: () => ({type:'backhand',team:false}),
  fallback: {},
  summary: value => `${MIDNIGHT[value.type]} · ${value.team?'shared hand against '+(value.opponent==='model'?'AI':'the dealer'):'play against each other'}`,
  render({select, checkbox, fields}, setup) {
    select('type','Game',MIDNIGHT,setup.type);checkbox('team','Share a hand against the dealer / AI',setup.team);
    select('opponent','Team opponent',{dealer:'Dealer · no API calls',model:'AI · your provider settings'},setup.opponent);
    return ()=>({type:fields.type.value,team:fields.team.checked,opponent:fields.opponent.value});
  },
};
