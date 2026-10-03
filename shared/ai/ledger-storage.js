const PREFIX='games-arcade:';
export function read(name,fallback) {try {return JSON.parse(localStorage.getItem(PREFIX+name) || localStorage.getItem('similo-arcade-v1:'+name) || 'null') || fallback;} catch {return fallback;}}
export function write(name,value) {try {localStorage.setItem(PREFIX+name,JSON.stringify(value));return true;} catch {return false;}}
