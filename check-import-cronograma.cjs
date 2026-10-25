const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/pcp.js','utf8');
const categories=['eq','ter','inf','cab','cmp'];
class El{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.style={};}
 appendChild(el){this.children.push(el);return el;} replaceChildren(){this.children=[];}
 addEventListener(event,fn){this.events[event]=fn;} querySelectorAll(){return [];}
 checkValidity(){return true;}
}
const panel=new El('section');
const obra={id:'obra1',nome:'Obra',cats:Object.fromEntries(categories.map(c=>[c,[]])),idCt:0,pcp:{passagem:{},comprometido:0,restante:0,tarefas:[{id:'t1',nome:'Instalar',inicio:'2026-10-01',fim:'2026-10-05',horas:8,qtd:2}]}};
obra.pcp.baseline={tarefas:JSON.parse(JSON.stringify(obra.pcp.tarefas))};
const original=JSON.stringify(obra.pcp.baseline);
const ctx=vm.createContext({console,Intl,Date,Map,Set,Number,JSON,crypto:{randomUUID:()=> 'new-task'},CATS:categories,LABELS:{eq:'Equipamentos',cmp:'M.O. Compass'},obras:{obra1:obra},currentObraId:'obra1',obraTotal:()=>0,fmtP:String,saveAll:()=>{},printClientSchedule:()=>{},alert:()=>{},document:{getElementById:()=>panel,createElement:t=>new El(t)}});
vm.runInContext(source.slice(0,source.indexOf('const originalOpenDash='))+source.slice(source.indexOf('/* Importação local:')),ctx);
vm.runInContext('renderPCP()',ctx);
function all(e){return [e,...e.children.flatMap(all)];}
let nodes=all(panel);
const input=nodes.find(e=>e.tag==='input'&&e.value==='2026-10-05');assert.equal(input.disabled,false);
input.value='2026-10-10';input.events.change();assert.equal(obra.pcp.tarefas[0].fim,'2026-10-10');assert.equal(JSON.stringify(obra.pcp.baseline),original);
const add=all(panel).find(e=>e.textContent==='Adicionar atividade');assert.equal(add.disabled,false);add.onclick();assert.equal(obra.pcp.tarefas.length,2);
const del=all(panel).find(e=>e.textContent==='Remover atividade');assert.equal(del.disabled,false);
let items=ctx.budgetRows([['DESCRIÇÃO','QTD','CUSTO (R$) COMPRA TOTAL','PREÇO (R$) VENDA TOTAL','CATEGORIA'],['Cabo',10,250,500,'Cabeamento'],['Serviço',1,0,200,'cmp'],['TOTAL',null,250]]);
assert.equal(items.length,2);assert.equal(items[0].cost,250);assert.equal(items[1].cost,0);
obra.cats.eq.push({id:'e99',name:'Existente',val:900,bud:1000});obra.idCt=99;
const result=ctx.budgetApply(obra,items,'arquivo/Planilha1');assert.equal(result.added,2);assert.equal(result.obra.cats.cab[0].bud,250);assert.equal(result.obra.cats.cab[0].val,'');assert.equal(result.obra.cats.eq[0].val,900);assert.equal(JSON.stringify(result.obra.pcp.baseline),original);
assert.equal(ctx.budgetApply(result.obra,items,'arquivo/Planilha1').skipped,2);
assert.throws(()=>ctx.budgetApply(obra,[{name:'A',cost:1,category:'',row:1}],'s'));
assert.throws(()=>ctx.budgetApply(obra,[{name:'A',cost:NaN,category:'eq',row:1}],'s'));
assert.throws(()=>ctx.budgetApply(obra,[{name:'a'.repeat(46000),cost:1,category:'eq',row:1}],'s'));
assert.equal(ctx.budgetNumber('R$ 1.234,56'),1234.56);assert.ok(Number.isNaN(ctx.budgetNumber('#VALUE!')));
assert.equal(ctx.budgetRows([['Descrição','Quantidade','Custo unitário'],['A',2,50]])[0].cost,100);
assert.ok(Number.isNaN(ctx.budgetRows([['Descrição','Custo total'],['Sem resultado','']])[0].cost));
const html=fs.readFileSync(__dirname+'/apps-script/Painel.html','utf8');
const scripts=[...html.matchAll(/atob\("([A-Za-z0-9+/=]+)"\)/g)].map(m=>Buffer.from(m[1],'base64').toString());
scripts.forEach(s=>new vm.Script(s));assert.equal(scripts[2],source);
console.log('OK: edição após linha de base, inclusão de atividade, preservação original, importação de custos, categorias, duplicidade, valores inválidos, limite e sintaxe do Painel.');

const classified=ctx.budgetRows([['Descrição','Custo total','Tipo'],['Serviço terceiros - passagem de cabo',100,'SERVIÇO'],['Seal tube 3/4',50,'PRODUTO'],['Infraestrutura de ferro galvanizado',80,'PRODUTO'],['Eletroduto com cabo',60,'PRODUTO'],['Suporte',20,'SERVIÇO TERCEIROS']]);
assert.deepEqual(Array.from(classified,x=>x.category),['ter','inf','inf','inf','ter']);
assert.equal(ctx.budgetRows([['Descrição','Custo total','Categoria'],['Instalação',10,'Serviço terceiros']])[0].category,'ter');
console.log('OK: terceiros prioritários sobre cabo; seal tube e ferro galvanizado em infraestrutura.');
const groups=[{source:'A.xlsx / Planilha1',items:[{name:'Cabo',category:'cab',cost:10,row:12}]},{source:'B.xlsm / Planilha1',items:[{name:'Cabo',category:'cab',cost:20,row:12}]}];
const beforeBatch=JSON.stringify(obra),batch=ctx.budgetBatch(obra,groups);
assert.equal(batch.added,2);assert.equal(batch.obra.cats.cab.reduce((n,r)=>n+r.bud,0),30);assert.equal(JSON.stringify(obra),beforeBatch);
assert.equal(ctx.budgetBatch(batch.obra,groups).skipped,2);
assert.throws(()=>ctx.budgetBatch(obra,[groups[0],{source:'invalido',error:true}]));assert.equal(JSON.stringify(obra),beforeBatch);
assert.throws(()=>ctx.budgetBatch(obra,[groups[0],{source:'bad',items:[{name:'A',category:'',cost:2,row:1}]}]));assert.equal(JSON.stringify(obra),beforeBatch);
assert.throws(()=>ctx.budgetBatch(obra,[{source:'large',items:Array(301).fill(groups[0].items[0])}]));
assert.equal(all(panel).find(e=>e.type==='file').multiple,true);
console.log('OK: múltiplos arquivos, origem individual, soma dos orçados, reimportação e lote inválido sem gravação parcial.');
