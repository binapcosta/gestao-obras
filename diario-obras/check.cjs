const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=__dirname;
class Sheet {
  constructor(rows=[]){this.rows=rows.map(r=>[...r]);}
  getLastRow(){return this.rows.length;}
  setFrozenRows(){}
  getDataRange(){const max=Math.max(1,...this.rows.map(r=>r.length));return {getValues:()=>this.rows.map(r=>Array.from({length:max},(_,i)=>r[i]??''))};}
  getRange(row,col,n=1,m=1){return {
    getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[row-1+i]?.[col-1+j]??'')),
    setValue:v=>this.getRange(row,col).setValues([[v]]),
    setValues:vs=>{vs.forEach((r,i)=>r.forEach((v,j)=>{this.rows[row-1+i]??=[];this.rows[row-1+i][col-1+j]=typeof v==='string'&&v.startsWith("'")?v.slice(1):v;}));}
  };}
  deleteRow(n){this.rows.splice(n-1,1);}
}
let held=false,seq=0,createdSheets=0,uploads=0,trashed=false;
const props={SHEET_ID:'existing',FOLDER_ID:'photos'};
const headers=['id','date','cliente','tecnico','obra','atividade','fotos','createdAt'];
const photo='https://drive.google.com/thumbnail?id=photo_1&sz=w1600';
const ss={tabs:{reports:new Sheet([headers,['old1','2026-10-01','Cliente A','Técnico','Obra Á','Texto',JSON.stringify([{id:'f1',src:photo}]),100],['old2','2026-10-02','Cliente A','Técnico',' obra a ','Texto 2','[]',101],['old3','2026-10-02','Cliente B','Técnico','Obra Á','Outro cliente','[]',102]])},getSheetByName(n){return this.tabs[n];},insertSheet(n){return this.tabs[n]=new Sheet();},getId(){return 'existing';}};
const ctx={Date,console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},LockService:{getScriptLock:()=>({waitLock(){assert(!held,'lock reentrante');held=true;},releaseLock(){held=false;}})},SpreadsheetApp:{openById:id=>{if(id!=='existing')throw Error('Base inválida');return ss;},create(){createdSheets++;return ss;}},DriveApp:{getFileById:()=>({isTrashed:()=>trashed}),getFolderById:()=>({isTrashed:()=>false,createFile:()=>{uploads++;return {getId:()=>`photo_${uploads}`,setSharing(){}};}}),Access:{ANYONE_WITH_LINK:'link'},Permission:{VIEW:'view'}},Utilities:{getUuid:()=>`project_${++seq}`,base64Decode:()=>[1,2],newBlob:()=>({}),formatDate:()=> '2026-10-01'},Session:{getScriptTimeZone:()=> 'America/Sao_Paulo'}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'apps-script/Code.gs'),'utf8'),ctx);
const projects=ctx.getProjects();assert.equal(projects.length,2);assert.equal(ctx.getProjects().length,2);
const legacy=ctx.getReports();assert.equal(legacy[0].obraId,legacy[1].obraId);assert.notEqual(legacy[0].obraId,legacy[2].obraId);assert.equal(legacy[0].fotos[0].src,photo);
assert.deepEqual(ss.tabs.reports.rows[0].slice(0,8),headers);assert.equal(createdSheets,0);
const a=ctx.saveProject({nome:'Nova 1',cliente:'Cliente A',local:'RJ'}),b=ctx.saveProject({nome:'Nova 2',cliente:'Cliente A'});
assert.notEqual(a.id,b.id);assert.throws(()=>ctx.saveProject({nome:' nova 1 ',cliente:'cliente a'}),/Já existe/);
const report={id:'new1',date:'2026-10-05',obraId:a.id,tecnico:'Ana',atividade:'Instalação',fotos:[]};
const saved=ctx.saveReport(report);assert.equal(saved.revision,1);assert.throws(()=>ctx.saveReport(report),/Outro usuário/);
assert.throws(()=>ctx.saveReport({...report,id:'bad',obraId:'missing'}),/Selecione/);
assert.throws(()=>ctx.saveReport({...report,id:'bad',date:'2026-02-30'}),/Data inválida/);
assert.throws(()=>ctx.saveReport({...report,id:'bad',fotos:[{src:'javascript:alert(1)'}]}),/Endereço/);
ctx.saveReport({...report,id:'new2',obraId:b.id,atividade:'Outra obra'});
assert.equal(ctx.getReports().find(r=>r.id==='new1').obra,'Nova 1');assert.equal(ctx.getReports().find(r=>r.id==='new2').obra,'Nova 2');
ctx.saveReport({...report,revision:1,atividade:'Atualizado'});assert.throws(()=>ctx.deleteReport('new1',1),/Outro usuário/);ctx.deleteReport('new1',2);
assert(!ctx.getReports().some(r=>r.id==='new1'));assert.equal(held,false);
ctx.saveReport({...report,id:'formula',atividade:'=SUM(A1:A2)'});assert.equal(ss.tabs.reports.rows.at(-1)[5],'=SUM(A1:A2)');
trashed=true;assert.throws(()=>ctx.getProjects(),/lixeira/);assert.equal(createdSheets,0);trashed=false;
ctx.saveSettings({nome:'CompaSSS',logo:'',revisao:'R1',confidencial:''});assert.equal(ctx.getSettings().nome,'CompaSSS');
// Verifica fonte e a versão gerada que será copiada ao Apps Script.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);source.forEach(s=>new vm.Script(s));
const generated=fs.readFileSync(path.join(root,'apps-script/Index.html'),'utf8');
for(const m of generated.matchAll(/<script>([\s\S]*?)<\/script>/g)){new vm.Script(m[1]);const encoded=m[1].match(/atob\("([A-Za-z0-9+/=]+)"\)/);assert(encoded);assert.equal(Buffer.from(encoded[1],'base64').toString('utf8'),source.shift());}
assert.equal(source.length,0);
// Exercita seleção, filtro, edição e preservação de formulário com DOM mínimo.
class Element {
 constructor(){this.value='';this.style={};this.listeners={};this.children=[];this.innerHTML='';this.classList={add(){},remove(){}};this.files=[];}
 addEventListener(n,f){this.listeners[n]=f;}
 appendChild(c){this.children.push(c);}
 querySelector(){return new Element();}
 querySelectorAll(){return [];}
 reset(){['#f-date','#f-cliente','#f-tecnico','#f-obra','#f-atividade'].forEach(k=>nodes[k].value='');}
 focus(){}
}
const nodes={};const el=k=>nodes[k]??=new Element();
const ui={console,Date,setTimeout:()=>{},document:{querySelector:el,createElement:()=>new Element(),body:new Element()},window:{addEventListener(){},scrollTo(){},print(){}},Image:class{},FileReader:class{},confirm:()=>true};
vm.createContext(ui);vm.runInContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1],ui);
vm.runInContext('projects='+JSON.stringify([a,b])+';reports='+JSON.stringify([{id:'rA',date:'2026-10-05',cliente:'Cliente A',tecnico:'Ana',obra:'Nova 1',obraId:a.id,atividade:'Atividade A',fotos:[],createdAt:1,revision:1},{id:'rB',date:'2026-10-05',cliente:'Cliente A',tecnico:'Bob',obra:'Nova 2',obraId:b.id,atividade:'Atividade B',fotos:[],createdAt:2,revision:1}])+';renderProjects();',ui);
el('#filterObra').value=a.id;ui.renderList();assert.equal(el('#reportCount').textContent,1);assert(el('#reportList').children.at(-1).innerHTML.includes('Atividade A'));
ui.editReport('rB');assert.equal(el('#f-obra').value,b.id);assert.equal(el('#f-cliente').value,'Cliente A');assert.equal(el('#f-atividade').value,'Atividade B');
ui.resetForm();assert.equal(el('#f-obra').value,b.id);assert.equal(el('#f-tecnico').value,'Bob');
ui.printReport('rB');assert(el('#printArea').innerHTML.includes('Nova 2'));assert(el('#printArea').innerHTML.includes('Atividade B'));
console.log('OK: migração idempotente e fotos antigas; múltiplas obras; duplicidade; gravação e revisão; exclusão; validação; sintaxe; seleção, filtro, edição e impressão.');
