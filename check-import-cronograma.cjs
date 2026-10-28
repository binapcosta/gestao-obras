const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/pcp.js','utf8');
const categories=['eq','ter','inf','cab','cmp'];
class El{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.style={};}
 appendChild(el){this.children.push(el);return el;} replaceChildren(){this.children=[];}
 addEventListener(event,fn){this.events[event]=fn;} querySelectorAll(){return [];}
 checkValidity(){return !this.validationMessage;} setCustomValidity(v){this.validationMessage=v;} reportValidity(){return this.checkValidity();}
}
const panel=new El('section');
const obra={id:'obra1',nome:'Obra',cats:Object.fromEntries(categories.map(c=>[c,[]])),idCt:0,pcp:{passagem:{},comprometido:0,restante:0,tarefas:[{id:'t1',nome:'Instalar',inicio:'2026-10-01',fim:'2026-10-05',horas:8,qtd:2}]}};
obra.pcp.baseline={tarefas:JSON.parse(JSON.stringify(obra.pcp.tarefas))};
const original=JSON.stringify(obra.pcp.baseline);
const ctx=vm.createContext({console,Intl,Date,Map,Set,Number,JSON,crypto:{randomUUID:()=> 'new-task'},CATS:categories,LABELS:{eq:'Equipamentos',cmp:'M.O. Compass'},obras:{obra1:obra},currentObraId:'obra1',obraTotal:()=>0,fmtP:String,saveAll:()=>{},printClientSchedule:()=>{},alert:()=>{},document:{getElementById:()=>panel,createElement:t=>new El(t)}});
vm.runInContext(fs.readFileSync(__dirname+'/locale-br.js','utf8'),ctx);
vm.runInContext(source.slice(0,source.indexOf('const originalOpenDash='))+source.slice(source.indexOf('/* Importação local:')),ctx);
vm.runInContext('renderPCP()',ctx);
function all(e){return [e,...e.children.flatMap(all)];}
let nodes=all(panel);
const input=nodes.find(e=>e.tag==='input'&&e.value==='05/10/2026');assert.equal(input.disabled,false);
input.value='10/10/2026';input.events.change();assert.equal(obra.pcp.tarefas[0].fim,'2026-10-10');assert.equal(JSON.stringify(obra.pcp.baseline),original);
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
let scheduleId=0;ctx.crypto.randomUUID=()=> 'schedule-'+(++scheduleId);
const task={id:'original',nome:'Instalar',responsavel:'Leo',emailResponsavel:'leo@example.com',inicio:'2026-10-01',fim:'2026-10-02',qtd:5,horas:8,qtdReal:4,horasReal:7,inicioReal:'2026-10-01',fimReal:'2026-10-02',previsao:'2026-10-02',impedimento:'Antigo',scheduleImportKey:'old'};
const copy=ctx.scheduleCopy(task);assert.notEqual(copy.id,task.id);assert.equal(copy.qtd,5);assert.equal(copy.horas,8);assert.equal(copy.qtdReal,0);assert.equal(copy.horasReal,0);assert.equal(copy.fimReal,undefined);assert.equal(copy.scheduleImportKey,undefined);
const inputRows=[['ID','Atividade','Responsável','Início planejado','Fim planejado','Quantidade prevista','Horas previstas','Predecessora'],[1,'Infraestrutura','Leo','01/11/2026','03/11/2026',10,16,''],[2,'Cabeamento','Alan','04/11/2026','05/11/2026',20,8,1]];
const tasks=ctx.scheduleRows(inputRows);assert.equal(tasks[0].inicio,'2026-11-01');assert.equal(tasks[1].pred,'1');
const scheduleBefore=JSON.stringify(obra),addedSchedule=ctx.scheduleApply(obra,tasks,'Cronograma.xlsx / Obra');assert.equal(addedSchedule.added,2);
const imported=addedSchedule.obra.pcp.tarefas.slice(-2);assert.notEqual(imported[0].id,imported[1].id);assert.equal(imported[1].predecessora,imported[0].id);assert.equal(imported[0].qtdReal,0);assert.equal(JSON.stringify(obra),scheduleBefore);assert.equal(JSON.stringify(addedSchedule.obra.pcp.baseline),original);
assert.equal(ctx.scheduleApply(addedSchedule.obra,tasks,'Cronograma.xlsx / Obra').skipped,2);
assert.equal(ctx.scheduleDate(1),'1900-01-01');assert.equal(ctx.scheduleDate(61),'1900-03-01');assert.equal(ctx.scheduleDate(0,true),'1904-01-01');assert.equal(ctx.scheduleDate(1,true),'1904-01-02');assert.throws(()=>ctx.scheduleDate(60));assert.throws(()=>ctx.scheduleDate('31/02/2026'));
const invalid=inputRows.map(r=>r.slice());invalid[2][7]=99;assert.throws(()=>ctx.scheduleRows(invalid));invalid[2][7]=2;assert.throws(()=>ctx.scheduleRows(invalid));
assert.throws(()=>ctx.scheduleRows([['Atividade','Início','Fim'],['Sem datas','','']]));
assert.throws(()=>ctx.scheduleRows([['Atividade','Início','Fim'],['Invertido','10/11/2026','09/11/2026']]));
assert.equal(ctx.scheduleRows([['Atividade','Início','Fim'],['Padrão','01/11/2026','02/11/2026']])[0].qtd,1);
const tooBig=tasks.map(t=>({...t,nome:t.nome+'x'.repeat(46000)}));assert.throws(()=>ctx.scheduleApply(obra,tooBig,'G'));assert.equal(JSON.stringify(obra),scheduleBefore);
console.log('OK: cópia sem apontamentos, importação de atividades, dependências, datas Excel 1900/1904, duplicidade, linha de base e rejeição sem alteração parcial.');
assert.equal(ctx.brMoney(1234.56),'R$ 1.234,56');assert.equal(ctx.brEdit(0),'0,00');assert.equal(ctx.brNumber(12.5,1),'12,5');assert.equal(ctx.brParse('1.234,56'),1234.56);assert.equal(ctx.brParse('0,05'),0.05);assert.equal(ctx.brParse('1.234'),1234);assert.ok(Number.isNaN(ctx.brParse('1,234.56')));assert.equal(ctx.brDate('2026-11-04'),'04/11/2026');
vm.runInContext('renderPCP()',ctx);
const planned=all(panel).find(e=>e.tag==='input'&&e.value==='10/10/2026');planned.value='31/02/2026';planned.events.change();assert.equal(obra.pcp.tarefas[0].fim,'2026-10-10');assert.equal(planned.checkValidity(),false);planned.value='11/10/2026';planned.events.change();assert.equal(obra.pcp.tarefas[0].fim,'2026-10-11');
const money=all(panel).find(e=>e.tag==='input'&&e.inputMode==='decimal');money.value='1.234,56';money.events.change();assert.equal(obra.pcp.comprometido,1234.56);
const mainScript=scripts[1];assert.ok(mainScript.includes('brMoney(v)'));assert.ok(!mainScript.includes("Math.round(v).toLocaleString"));assert.ok(!mainScript.includes("'name',this.value);brCheck"));
ctx.recalc=()=>{};ctx.scheduleAutoSave=()=>{};
vm.runInContext(mainScript.slice(mainScript.indexOf('function updateEntry('),mainScript.indexOf('function renderList(')),ctx);
ctx.updateEntry('eq','e99','val','2.345,67');assert.equal(obra.cats.eq[0].val,2345.67);ctx.updateEntry('eq','e99','val','invalid');assert.equal(obra.cats.eq[0].val,2345.67);
const index=fs.readFileSync(__dirname+'/index.html','utf8');assert.ok(index.includes("function brNumber"));
console.log('OK: padrão BR nos campos e datas, centavos preservados, entrada com vírgula, rejeição de data inválida e números persistidos sem formatação.');

const buyWork={nome:'Obra A',pcp:{passagem:{proposta:'I123R0'}}};const controls={date:{value:'04/11/2026'},rows:[{checkbox:{checked:true},qty:{value:'2,50'},item:{id:'e1',name:'Câmera',bud:1234.56}},{checkbox:{checked:false},qty:{value:''},item:{id:'e2',name:'Sensor',bud:20}}]};
const buy=ctx.purchaseRead(buyWork,controls);assert.equal(buy.proposal,'Obra A');assert.equal(buy.date,'2026-11-04');assert.equal(buy.items[0].qty,2.5);assert.equal(buy.total,1234.56);assert.equal(buy.items.length,1);
controls.date.value='31/02/2026';assert.throws(()=>ctx.purchaseRead(buyWork,controls));controls.date.value='04/11/2026';controls.rows[0].qty.value='0';assert.throws(()=>ctx.purchaseRead(buyWork,controls));controls.rows[0].qty.value='2';controls.rows[0].item.bud='';assert.throws(()=>ctx.purchaseRead(buyWork,controls));
console.log('OK: seleção de compra, data brasileira, quantidade, valor orçado total e rejeição de dados incompletos.');
const sourceRows=[['DESCRIÇÃO','QTD','CUSTO (R$) COMPRA UNITÁRIO','CUSTO (R$) COMPRA TOTAL','CATEGORIA'],['Câmera',5,110.5,552.5,'equipamentos'],['Duto','',15.25,100,'infraestrutura']];
const importedRows=ctx.budgetRows(sourceRows);assert.equal(importedRows[0].quantity,5);assert.equal(importedRows[0].unitCost,110.5);assert.equal(importedRows[0].cost,552.5);assert.equal(importedRows[1].quantity,null);assert.equal(importedRows[1].unitCost,15.25);
const importedResult=ctx.budgetApply(obra,importedRows,'file / Planilha1');const importedEntry=importedResult.obra.cats.eq.find(r=>r.name==='Câmera');assert.equal(importedEntry.qtdOrcada,5);assert.equal(importedEntry.unitOrcado,110.5);assert.equal(importedEntry.bud,552.5);
const legacy=JSON.parse(JSON.stringify(importedResult.obra));const old=legacy.cats.eq.find(r=>r.name==='Câmera');delete old.qtdOrcada;delete old.unitOrcado;old.bud=999;old.val=42;
const healed=ctx.budgetApply(legacy,importedRows,'file / Planilha1');const fixed=healed.obra.cats.eq.find(r=>r.name==='Câmera');assert.equal(fixed.qtdOrcada,5);assert.equal(fixed.unitOrcado,110.5);assert.equal(fixed.bud,999);assert.equal(fixed.val,42);assert.equal(healed.updated,1);
fixed.qtdOrcada=9;fixed.unitOrcado=200;const repeat=ctx.budgetApply(healed.obra,importedRows,'file / Planilha1');assert.equal(repeat.obra.cats.eq.find(r=>r.name==='Câmera').qtdOrcada,9);assert.equal(repeat.obra.cats.eq.find(r=>r.name==='Câmera').unitOrcado,200);
const broken=importedRows.map(i=>({...i}));broken[0].quantity=NaN;assert.throws(()=>ctx.budgetApply(obra,broken,'x'));broken[0].quantity=2;broken[0].unitCost=NaN;assert.throws(()=>ctx.budgetApply(obra,broken,'x'));
assert.ok(index.includes('qtdOrcada'));assert.ok(index.includes('unitOrcado'));
console.log('OK: quantidade, custo unitário e total; itens legados complementados sem alterar valores existentes; validação e reimportação.');
const defaultBill=ctx.quoteBilling(false,{razaoSocial:'Ignorar'});assert.equal(defaultBill.razaoSocial,'Compasss Tecnologia');assert.equal(defaultBill.cnpj,'28.781.740/0002-02');assert.equal(defaultBill.ie,'11.356.281');assert.equal(defaultBill.im,'1.437.030-7');
assert.throws(()=>ctx.quoteBilling(true,{}));const directBill=ctx.quoteBilling(true,{razaoSocial:'Cliente',cnpj:'12.345.678/0001-90',ie:'ISENTO',im:''});assert.equal(directBill.direct,true);assert.equal(directBill.ie,'ISENTO');
const quoteControls={date:{value:'30/10/2026'},rows:[{checkbox:{checked:true},qty:{value:'3,00'},item:{id:'e1',name:'Sensor',bud:''}}]};const quoteRead=ctx.quotationRead({nome:'Obra / Proposta'},quoteControls,{direct:false});assert.equal(quoteRead.items[0].qty,3);assert.equal(quoteRead.items[0].budget,undefined);assert.equal(quoteRead.billing.cnpj,defaultBill.cnpj);
console.log('OK: cotação sem orçamento interno, faturamento padrão exato e dados obrigatórios do cliente.');
