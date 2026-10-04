import {cp, mkdir, readdir, rm, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)), output=resolve(root,'_site');
// Only ship each game's runtime files, not credentials, developer tests or docs.
const games=['spacegolf','flip-it','midnight','cluance','pawn-quest'];
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(resolve(root,'index.html'),resolve(output,'index.html'));
await cp(resolve(root,'shared'),resolve(output,'shared'),{recursive:true,filter:path=>!/(?:\/tests|\/tools|\.md$|\.json$)/.test(path)});
for(const game of games){
  const dest=resolve(output,game);await mkdir(dest,{recursive:true});
  for(const file of await readdir(resolve(root,game))){
    if(['src','assets'].includes(file)||file==='index.html'||file==='style.css'||/^preview\.(png|jpg)$/.test(file))
      await cp(resolve(root,game,file),resolve(dest,file),{recursive:true});
  }
}
const built=resolve(root,'nonocube/dist');
if(!(await stat(resolve(built,'index.html')).catch(()=>null)))throw new Error('Build Nonocube before assembling the site: npm --prefix nonocube run build');
await cp(built,resolve(output,'nonocube'),{recursive:true});
await cp(resolve(root,'nonocube/preview.jpg'),resolve(output,'nonocube/preview.jpg'));
console.log('Assembled six games and shared runtime assets in _site.');
