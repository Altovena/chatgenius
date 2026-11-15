const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'board-fixes.css'),'utf8');
const analysis=fs.readFileSync(path.join(root,'analysis.js'),'utf8');

test('Chess.com username is a clearly labeled editable input, distinct from buttons',()=>{
  assert.equal((page.match(/id="chessUser"/g)||[]).length,1);
  assert.match(page,/<label class="chess-username-label" for="chessUser">1\. Skriv inn Chess\.com-brukernavnet ditt<\/label>/);
  assert.match(page,/<input id="chessUser" type="text"[^>]*aria-describedby="chessUserHelp"/);
  assert.match(page,/class="chess-username-entry"/);
  assert.match(css,/\.chess-username-entry #chessUser\{[^}]*background:transparent/);
  assert.match(css,/\.chess-username-entry\{[^}]*background:#f2f7ee/);
  assert.match(css,/\.chess-username-entry:focus-within/);
});
test('Existing Chess.com import actions remain available and connected',()=>{
  for(const id of ['chessUser','fetchGames','playChessCom','autoFetchChessGames']){
    assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    assert.ok(analysis.includes("'"+id+"'"),id+' is used by the existing import logic');
  }
  assert.match(page,/<button class="primary" id="fetchGames" type="button">2\. Hent partier fra Chess\.com<\/button>/);
  assert.match(page,/class="chess-auto-refresh"/);
  assert.match(css,/@media\(max-width:1150px\)\{\.chess-import-actions\{grid-template-columns:1fr\}/);
});
