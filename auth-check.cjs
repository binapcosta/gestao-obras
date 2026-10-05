const fs=require('fs'),vm=require('vm'),assert=require('assert');
let email='',reads=0;
const props={ALLOWED_EMAILS:'binapcosta@gmail.com,aleksanderlotto@gmail.com,instalacaocpsrj@gmail.com,manutencaocpsrj@gmail.com,projetocps15@gmail.com',ADMIN_EMAIL:'binapcosta@gmail.com'};
const ctx={Session:{getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),ctx);
ctx.readData_=()=>{reads++;return {getContent:()=>'{"ok":true,"obras":[]}'}};
for(const candidate of ['', 'estranho@gmail.com']){email=candidate;assert.throws(()=>ctx.pcpApi('obras'),/não autorizado/);}
assert.equal(reads,0);
email='aleksanderlotto@gmail.com';assert.equal(ctx.pcpApi('obras').ok,true);assert.throws(()=>ctx.requireAdmin_(),/administração/);
assert.throws(()=>ctx.pcpApi('backupDiarioPCP'),/inválida/);
email='binapcosta@gmail.com';ctx.requireAdmin_();
delete props.ALLOWED_EMAILS;assert.throws(()=>ctx.pcpApi('obras'),/ALLOWED_EMAILS/);
const html=fs.readFileSync('apps-script/Painel.html','utf8');
assert(!html.includes('src="pcp.js"'));assert(!html.includes('href="compasss.css"'));
let sources=[];
for(const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
 new vm.Script(s[1]);
 const encoded=s[1].match(/atob\("([A-Za-z0-9+/=]+)"\)/);
 if(encoded){const source=Buffer.from(encoded[1],'base64').toString('utf8');new vm.Script(source);sources.push(source);}
}
assert.equal(sources.length,4);
// Todos os scripts compartilham escopo global, como na página.
new vm.Script(sources.join('\n'));
assert(sources[1].includes('function openDash('));
assert(sources[2].includes('Carregar obras do Sheets'));
console.log('OK: anônimo e conta externa bloqueados antes dos dados; usuário, administrador e sintaxe do painel.');
