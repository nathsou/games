export const THEME_KEY='games-arcade:appearance';
const valid=v=>['dark','light','system'].includes(v);
export function loadTheme(){try {const value=localStorage.getItem(THEME_KEY);if(valid(value))return value;const old=JSON.parse(localStorage.getItem('similo-arcade-v1:settings')||'{}').appearance;return valid(old)?old:'system';}catch{return 'system';}}
let memoryTheme=loadTheme();
export function saveTheme(value){if(!valid(value))return;memoryTheme=value;try{localStorage.setItem(THEME_KEY,value);}catch{}globalThis.dispatchEvent?.(new Event('games-theme-change'));}
export function installThemeControls(parent) {
  const control=document.createElement('select');control.className='appearance-control';control.setAttribute('aria-label','Color theme');control.id='appearance';
  control.innerHTML='<option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>';parent.append(control);
  const media=matchMedia('(prefers-color-scheme: dark)');
  function apply(){const preference=memoryTheme;control.value=preference;const theme=preference==='system'?(media.matches?'dark':'light'):preference;document.documentElement.dataset.colorTheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4edda':'#123c3a');}
  control.onchange=()=>saveTheme(control.value);media.addEventListener('change',apply);
  window.addEventListener('games-theme-change',apply);window.addEventListener('storage',e=>{if(e.key===THEME_KEY){memoryTheme=loadTheme();apply();}});apply();
}
