import {cp, mkdir, readdir, readFile, writeFile, rm, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {friendPanel} from '../shared/friend-panel.js';

const root=fileURLToPath(new URL('..',import.meta.url)), output=resolve(root,'_site');
// Only ship each game's runtime files, not credentials, developer tests or docs.
const games=[];
for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.isDirectory()&&entry.name!=='nonocube'&&entry.name!=='_site'&&!entry.name.startsWith('.')
    &&await stat(resolve(root,entry.name,'index.html')).catch(()=>null))games.push(entry.name);
}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(resolve(root,'index.html'),resolve(output,'index.html'));
await cp(resolve(root,'cloudflare/_headers'),resolve(output,'_headers'));
await cp(resolve(root,'shared'),resolve(output,'shared'),{recursive:true,filter:path=>!/(?:\/tests|\/tools|\.md$|\.json$)/.test(path)});
for(const game of games){
  const dest=resolve(output,game);await mkdir(dest,{recursive:true});
  for(const file of await readdir(resolve(root,game))){
    if(['src','assets'].includes(file)||/\.(?:html|js|css|svg|wasm|webmanifest)$/.test(file)||/^preview\.(png|jpg)$/.test(file))
      await cp(resolve(root,game,file),resolve(dest,file),{recursive:true});
  }
}
// Ship usable initial shell markup before the room module graph loads. The iframe
// gets its URL only after FriendSession exists, preserving checkpoint/room routing.
for (const file of ['index.html', 'together/index.html']) {
  const path = resolve(output, file);
  const html = await readFile(path, 'utf8');
  await writeFile(path, html.replace('<body>', '<body data-shell-loading>\n' + friendPanel));
}
const built=resolve(root,'nonocube/dist');
if(!(await stat(resolve(built,'index.html')).catch(()=>null)))throw new Error('Build Nonocube before assembling the site: npm --prefix nonocube run build');
await cp(built,resolve(output,'nonocube'),{recursive:true});
await cp(resolve(root,'nonocube/preview.jpg'),resolve(output,'nonocube/preview.jpg'));
console.log(`Assembled ${games.length+1} games and shared runtime assets in _site.`);
