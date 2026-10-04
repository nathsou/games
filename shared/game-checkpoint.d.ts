export function registerCheckpoint<T>(game:string, options:{capture:()=>T|null;restore:(data:T)=>void}):()=>boolean;
