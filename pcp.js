/* PCP: complemento da interface existente. Salvamento remoto explícito por obra. */
function pcpState(o) {
  if (!o.pcp) o.pcp = {passagem:{}, tarefas:[], comprometido:0, restante:0};
  return o.pcp;
}
function pcpElement(tag, text, parent) {
  const el=document.createElement(tag);
  if(text!==undefined) el.textContent=text;
  if(parent) parent.appendChild(el);
  return el;
}
function pcpInput(parent,label,value,type,change,disabled=false) {
  const wrap=pcpElement('label',undefined,parent); wrap.className='form-field';
  pcpElement('span',label,wrap).className='form-label';
  const input=pcpElement(type==='textarea'?'textarea':'input',undefined,wrap);
  if(type!=='textarea') input.type=type==='date'||type==='number'?'text':type==='emails'?'email':type;
  if(type==='date'){input.placeholder='dd/mm/aaaa';input.maxLength=10;input.inputMode='numeric';}
  if(type==='number')input.inputMode='decimal';
  if(type==='emails') input.multiple=true;
  input.className='form-input'; input.value=type==='date'?brDate(value):type==='number'?brEdit(value):value??''; input.disabled=disabled;
  input.lang='pt-BR';
  input.addEventListener('change',()=>{
    let parsed=input.value;input.setCustomValidity('');
    try{
      if(type==='date'&&parsed){if(!/^\d{2}\/\d{2}\/\d{4}$/.test(parsed))throw new Error('Use dd/mm/aaaa.');parsed=scheduleDate(parsed);}
      if(type==='number'){if(!brCheck(input))throw new Error('Use o padrão brasileiro: 1.234,56.');parsed=input.value.trim()===''?0:brParse(input.value);}
    }catch(e){input.setCustomValidity(e.message);input.reportValidity();return;}
    if(!input.checkValidity()){input.reportValidity();return;}
    change(parsed);
    saveAll(); renderPCP();
  });
}
function pcpDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')?Date.parse(d+'T12:00:00Z'):NaN;}
function pcpErrors(p){
  const errors=[], map=new Map(p.tarefas.map(t=>[t.id,t]));
  p.tarefas.forEach(t=>{
    [['inicio','fim'],['inicioReal','fimReal']].forEach(([a,b])=>{
      if(t[a]&&t[b]&&pcpDate(t[b])<pcpDate(t[a])) errors.push(t.nome+': término anterior ao início.');
    });
    if(t.qtdReal>t.qtd) errors.push(t.nome+': quantidade concluída maior que a prevista.');
    if(t.predecessora&&!map.has(t.predecessora)) errors.push(t.nome+': predecessora inexistente.');
    const seen=new Set([t.id]); let prev=t.predecessora;
    while(prev&&map.has(prev)){
      if(seen.has(prev)){errors.push(t.nome+': ciclo de dependência.');break;}
      seen.add(prev);prev=map.get(prev).predecessora;
    }
    const pred=map.get(t.predecessora);
    if(pred&&t.inicio&&(pred.fimReal||pred.previsao||pred.fim)&&pcpDate(t.inicio)<=pcpDate(pred.fimReal||pred.previsao||pred.fim))
      errors.push(t.nome+': início deve ser posterior ao término da predecessora (dias corridos).');
  });
  return [...new Set(errors)];
}
function pcpMetrics(o){
  const p=pcpState(o), hours=p.tarefas.reduce((s,t)=>s+(t.horas||0),0);
  const weighted=p.tarefas.every(t=>t.horas>0&&t.qtd>0)&&p.tarefas.length>0;
  const advance=weighted?p.tarefas.reduce((s,t)=>s+t.horas*Math.min(1,(t.qtdReal||0)/t.qtd),0)/hours*100:null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const parts=Object.fromEntries(today.map(x=>[x.type,x.value]));
  const iso=parts.year+'-'+parts.month+'-'+parts.day;
  return {advance, hours, realHours:p.tarefas.reduce((s,t)=>s+(t.horasReal||0),0),
    late:p.tarefas.filter(t=>!t.fimReal&&(t.previsao||t.fim)&&(t.previsao||t.fim)<iso).length,
    final:obraTotal(o)+(p.comprometido||0)+(p.restante||0)};
}
function renderPCP(){
  const panel=document.getElementById('pcpPanel');
  const openTasks = panel.dataset.obraId === currentObraId
    ? new Set(Array.from(panel.querySelectorAll('details[open]')).map(el => el.dataset.taskId))
    : new Set();
  panel.dataset.obraId = currentObraId || '';
  panel.replaceChildren();
  const o=obras[currentObraId]; if(!o)return;
  const p=pcpState(o), m=pcpMetrics(o);
  pcpElement('h2','PCP — prazo e custo para concluir',panel);
  const summary=pcpElement('p',undefined,panel);
  summary.textContent='Atividades atrasadas: '+m.late+' | Avanço físico: '+(m.advance===null?'não definido':brNumber(m.advance,1)+'%')+
    ' | Horas: '+brNumber(m.realHours)+' / '+brNumber(m.hours)+' | Custo final estimado: '+fmtP(m.final);
  pcpElement('p','Avanço ponderado pelas horas previstas. Preencha horas e quantidades de todas as atividades. Horas realizadas são informativas; os custos continuam no financeiro.',panel);
  const grid=pcpElement('div',undefined,panel);grid.className='fin-grid';
  pcpInput(grid,'Comprometido ainda não realizado (R$)',p.comprometido,'number',v=>p.comprometido=v);
  pcpInput(grid,'Restante ainda não contratado (R$)',p.restante,'number',v=>p.restante=v);
  pcpElement('h3','Passagem da proposta',panel);
  const handoff=pcpElement('div',undefined,panel);handoff.className='fin-grid';
  [['proposta','Proposta e revisão'],['gestor','Gestor da implantação'],['escopo','Escopo contratado'],
   ['premissas','Premissas e exclusões'],['pendencias','Pendências / responsável / prazo']].forEach(([key,label])=>{
    pcpInput(handoff,label,p.passagem[key],'textarea',v=>p.passagem[key]=v);
  });
  pcpElement('h3','Responsáveis e destinatários dos alertas',panel);
  const contacts=pcpElement('div',undefined,panel);contacts.className='fin-grid';
  pcpInput(contacts,'E-mail do gestor',p.passagem.emailGestor,'email',v=>p.passagem.emailGestor=v);
  pcpInput(contacts,'E-mails para resumo do PCP (separados por vírgula)',p.passagem.emailsPCP,'emails',v=>p.passagem.emailsPCP=v);
  delayAlertUI(panel,o);
  purchaseUI(panel,o);
  pcpImportUI(panel,o);
  pcpElement('h3','Cronograma — dias corridos',panel);
  proposalUI(panel,o);
  scheduleImportUI(panel,o);
  pcpElement('p','Dependências geram alertas; as datas não são deslocadas automaticamente. A linha de base preserva o primeiro planejamento; o cronograma atual continua editável.',panel);
  const actions=pcpElement('div',undefined,panel);actions.className='actions-row';
  const print=pcpElement('button','Imprimir cronograma para cliente',actions);print.className='btn';
  print.onclick=printClientSchedule;
  const add=pcpElement('button','Adicionar atividade',actions);add.className='btn';add.disabled=false;
  add.onclick=()=>{p.tarefas.push({id:crypto.randomUUID(),nome:'Nova atividade',responsavel:'',qtd:1,qtdReal:0,horas:0,horasReal:0});saveAll();renderPCP();};
  const base=pcpElement('button',p.baseline?'Linha de base registrada':'Registrar linha de base',actions);base.className='btn';base.disabled=!!p.baseline;
  base.onclick=()=>{
    if(!p.tarefas.length||p.tarefas.some(t=>!t.inicio||!t.fim)||pcpErrors(p).length){alert('Preencha datas válidas e resolva os alertas antes de registrar.');return;}
    p.baseline={data:new Date().toISOString(),tarefas:JSON.parse(JSON.stringify(p.tarefas)),
      orcamento:CATS.reduce((s,c)=>s+(o.cats[c]||[]).reduce((n,r)=>n+(Number(r.bud)||0),0),0)};
    saveAll();renderPCP();
  };
  const errors=pcpErrors(p);
  if(errors.length)pcpElement('p',errors.join(' '),panel).style.color='var(--red)';
  p.tarefas.forEach(t=>{
    const card=pcpElement('details',undefined,panel);card.className='card';card.style.marginBottom='10px';
    card.dataset.taskId=t.id;
    card.open=openTasks.has(t.id);
    pcpElement('summary',t.nome+' — '+(t.responsavel||'Sem responsável'),card);
    const fields=pcpElement('div',undefined,card);fields.className='fin-grid';
    [['nome','Atividade','text'],['responsavel','Responsável','text'],['emailResponsavel','E-mail do responsável','email'],
      ['inicio','Início planejado','date'],['fim','Fim planejado','date'],['previsao','Previsão atual de término','date'],
      ['inicioReal','Início real','date'],['fimReal','Fim real','date'],
      ['qtd','Quantidade prevista','number'],['qtdReal','Quantidade concluída','number'],
      ['horas','Horas previstas','number'],['horasReal','Horas realizadas','number'],
      ['impedimento','Impedimento / ação / responsável','textarea']].forEach(([key,label,type])=>{
      pcpInput(fields,label,t[key],type,v=>{
        t[key]=v;
      },false);
    });
    const label=pcpElement('label','Predecessora (término → início)',fields);
    const select=pcpElement('select',undefined,label);select.className='form-input';
    [{id:'',nome:'Sem predecessora'},...p.tarefas.filter(x=>x.id!==t.id)].forEach(x=>{
      const opt=pcpElement('option',x.nome,select);opt.value=x.id;opt.selected=t.predecessora===x.id;
    });
    select.onchange=()=>{t.predecessora=select.value;saveAll();renderPCP();};
    const copy=pcpElement('button','Duplicar atividade',card);copy.className='btn';
    copy.onclick=()=>{const next=scheduleCopy(t);p.tarefas.splice(p.tarefas.indexOf(t)+1,0,next);saveAll();renderPCP();const el=Array.from(panel.querySelectorAll('details')).find(el=>el.dataset.taskId===next.id);if(el)el.open=true;};
    const del=pcpElement('button','Remover atividade',card);del.className='btn btn-danger';
    del.disabled=false;
    del.onclick=()=>{
      if(p.tarefas.some(x=>x.predecessora===t.id)){alert('Remova primeiro as dependências desta atividade.');return;}
      p.tarefas=p.tarefas.filter(x=>x.id!==t.id);saveAll();renderPCP();
    };
  });
  renderGantt(panel,p);
}
function renderGantt(panel,p){
  const tasks=p.tarefas.filter(t=>Number.isFinite(pcpDate(t.inicio))&&Number.isFinite(pcpDate(t.previsao||t.fim)));
  if(!tasks.length)return;
  const min=Math.min(...tasks.map(t=>pcpDate(t.inicio)));
  const max=Math.max(...tasks.map(t=>pcpDate(t.previsao||t.fim))),span=Math.max(86400000,max-min+86400000);
  pcpElement('h3','Visão do cronograma',panel);
  pcpElement('p',new Date(min).toLocaleDateString('pt-BR',{timeZone:'UTC'})+' a '+new Date(max).toLocaleDateString('pt-BR',{timeZone:'UTC'}),panel);
  tasks.forEach(t=>{
    pcpElement('p',t.nome+' | '+brDate(t.inicio)+' → '+brDate(t.previsao||t.fim),panel);
    const track=pcpElement('div',undefined,panel);track.style.cssText='height:12px;background:var(--bg);margin-bottom:12px';
    const bar=pcpElement('div',undefined,track);
    bar.style.cssText='height:12px;background:var(--text-accent);margin-left:'+((pcpDate(t.inicio)-min)/span*100)+'%;width:'+Math.max(0,(pcpDate(t.previsao||t.fim)-pcpDate(t.inicio)+86400000)/span*100)+'%';
  });
}
function pcpBackup(){
  saveCurrent(); const a=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(obras,null,2)],{type:'application/json'}));
  a.href=url;a.download='obras-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function pcpLoad(){
  if(!scriptUrl){alert('Configure a URL do Apps Script.');return;}
  try {
    const d=window.pcpRpc?await window.pcpRpc('obras') : await (await fetch(scriptUrl+'?action=obras')).json();
    if(!d.ok||!Array.isArray(d.obras))throw new Error(d.erro||'Atualize o Apps Script para a versão PCP.');
    if(!confirm('Carregar a versão compartilhada substituirá as obras locais com o mesmo ID. Faça backup antes. Continuar?'))return;
    saveCurrent();d.obras.forEach(o=>obras[o.id]=o);saveAll();goHome();
    if(d.sheetUrl)localStorage.setItem('obra_sheet_url',d.sheetUrl);
    setSyncStatus('ok','obras carregadas');
  }catch(e){setSyncStatus('err',e.message);}
}
async function pcpSave(){
  if(!scriptUrl){alert('Configure a URL do Apps Script.');return;}
  const invalid=Array.from(document.getElementById('dashScreen').querySelectorAll('input')).find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}
  saveCurrent();const o=obras[currentObraId];if(!o)return;
  const errors=pcpErrors(pcpState(o));if(errors.length){alert(errors.join('\n'));return;}
  if(window.pcpSaving)return;
  window.pcpSaving=true;setSyncStatus('load','salvando obra...');
  const sent=JSON.parse(JSON.stringify(o));
  const fd=new FormData();fd.append('payload',JSON.stringify({action:'salvarObra',obra:sent,requestId:crypto.randomUUID()}));
  try{
    const payload=JSON.parse(fd.get('payload'));
    const d=window.pcpRpc?await window.pcpRpc('salvarObra',payload) : await (await fetch(scriptUrl,{method:'POST',body:fd})).json();
    if(!d.ok)throw new Error(d.erro||'Falha no salvamento.');
    o._revision=d.revision;saveAll();
    if(d.sheetUrl){localStorage.setItem('obra_sheet_url',d.sheetUrl);document.getElementById('sheetsLink').href=d.sheetUrl;}
    setSyncStatus('ok','obra salva no Sheets');
  }catch(e){setSyncStatus('err',e.message);}finally{window.pcpSaving=false;}
}
const originalOpenDash=openDash;
openDash=function(id){originalOpenDash(id);renderPCP();};
saveToSheets=pcpSave;
const panel=document.createElement('section');panel.id='pcpPanel';panel.className='fin-section';
document.getElementById('dashScreen').appendChild(panel);
const shared=document.createElement('div');shared.className='actions-row';
[['Backup das obras',pcpBackup],['Carregar obras do Sheets',pcpLoad]].forEach(([text,fn])=>{
  const b=pcpElement('button',text,shared);b.className='btn';b.onclick=fn;
});
document.getElementById('homeScreen').prepend(shared);


function printClientSchedule(){
  saveCurrent();
  const o=obras[currentObraId]; if(!o)return;
  const p=pcpState(o);
  if(!p.tarefas.length){alert('Cadastre atividades antes de imprimir o cronograma.');return;}
  const errors=pcpErrors(p);
  if(errors.length){alert('Resolva os alertas antes de emitir o cronograma:\n'+errors.join('\n'));return;}
  const win=window.open('','_blank');
  if(!win){alert('Permita pop-ups para visualizar o cronograma.');return;}
  const doc=win.document;
  doc.title='Cronograma — '+o.nome;
  const style=doc.createElement('style');
  style.textContent='@page{size:A4 landscape;margin:12mm}body{font:12px Open Sans,Arial,sans-serif;color:#202020;--bg:#eee;--text-accent:#406E2A;margin:24px}h1{font-size:22px;color:#406E2A}h2,h3{font-size:15px;margin-top:24px}header{border-bottom:2px solid #406E2A;padding-bottom:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#E9F4E6}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px 18px;background:#406E2A;color:white;border:0;margin-bottom:18px;cursor:pointer}.meta{line-height:1.7}.gantt{break-before:page}.gantt p{margin:8px 0 4px}footer{margin-top:24px;color:#666;font-size:11px}@media print{body{margin:0}button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  doc.head.appendChild(style);
  const fonts=doc.createElement('link');fonts.rel='stylesheet';fonts.href='https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap';doc.head.appendChild(fonts);
  const titles=doc.createElement('style');titles.textContent='h1,h2,h3,th{font-family:Montserrat,Arial,sans-serif}th{background:#406E2A;color:#FFFFFF}tbody tr:nth-child(even){background:#F8FAFC}';doc.head.appendChild(titles);
  const root=doc.body;
  const button=pcpElement('button','Imprimir / Salvar PDF',root);button.onclick=()=>win.print();
  const head=pcpElement('header',undefined,root);
  const logo=doc.createElement('img');logo.src=document.getElementById('companyLogo').src;logo.alt='CompaSSS Tecnologia';logo.style.cssText='width:210px;height:auto;margin-bottom:12px';head.appendChild(logo);
  pcpElement('h1','CompaSSS | Cronograma de implantação',head);
  pcpElement('h2',o.nome,head);
  const date=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
  pcpElement('p','Proposta: '+(p.passagem.proposta||'Não informada')+' | Emitido em: '+date,head).className='meta';
  pcpElement('p','Datas em dias corridos. Previsão atual de término apresentada quando cadastrada.',root);
  const table=pcpElement('table',undefined,root),thead=pcpElement('thead',undefined,table),tr=pcpElement('tr',undefined,thead);
  ['Atividade','Responsável','Início planejado','Fim planejado','Previsão atual','Início real','Fim real'].forEach(label=>pcpElement('th',label,tr));
  const tbody=pcpElement('tbody',undefined,table);
  function dateBR(v){return Number.isFinite(pcpDate(v))?v.split('-').reverse().join('/'):'—';}
  p.tarefas.forEach(t=>{
    const row=pcpElement('tr',undefined,tbody);
    [t.nome,t.responsavel||'—',dateBR(t.inicio),dateBR(t.fim),dateBR(t.previsao),dateBR(t.inicioReal),dateBR(t.fimReal)].forEach(v=>pcpElement('td',v,row));
  });
  const gantt=pcpElement('section',undefined,root);gantt.className='gantt';
  renderGantt(gantt,p);
  pcpElement('footer','CompaSSS Tecnologia · '+o.nome+' · '+date,root);
  win.focus();
}

/* Importação local: custos orçados; nunca altera valores realizados. */
function budgetNorm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function budgetNumber(v){
  if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:NaN;
  let s=String(v??'').trim().replace(/^R\$\s*/,'').replace(/\s/g,'');
  if(!s)return NaN;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(s))return NaN;
  return Number(s);
}
function budgetRows(rows){
  const aliases={name:['descricao','item','material servico'],total:['custo r compra total','custo total','orcado r','orcado','valor total'],qty:['qtd','quantidade'],unit:['custo r compra unitario','custo unitario','valor unitario'],cat:['categoria'],type:['tipo']};
  let header=-1,cols;
  for(let i=0;i<Math.min(rows.length,60);i++){
    const h=rows[i].map(budgetNorm),m={};
    Object.keys(aliases).forEach(k=>m[k]=h.findIndex(v=>aliases[k].includes(v)));
    if(m.name>=0&&(m.total>=0||(m.qty>=0&&m.unit>=0))){header=i;cols=m;break;}
  }
  if(header<0)throw new Error('Cabeçalhos não reconhecidos. Use Descrição e Custo total, ou Quantidade e Custo unitário.');
  const result=[];
  const categories={equipamentos:'eq',materiais:'eq',terceiros:'ter','servico terceiros':'ter','servicos terceiros':'ter','servico de terceiros':'ter','servicos de terceiros':'ter',infraestrutura:'inf',cabeamento:'cab','m o compass':'cmp','mao de obra compasss':'cmp',eq:'eq',ter:'ter',inf:'inf',cab:'cab',cmp:'cmp'};
  rows.slice(header+1).forEach((r,i)=>{
    const name=String(r[cols.name]??'').trim();if(!name)return;
    if(/^(sub ?total|total)(\s|$)/.test(budgetNorm(name)))return;
    let cost=budgetNumber(r[cols.total]);
    // Fórmulas sem resultado salvo exigem revisão: não utilizar preço de venda.
    if(cols.total<0)cost=budgetNumber(r[cols.qty])*budgetNumber(r[cols.unit]);
    const desc=budgetNorm(name),type=budgetNorm(r[cols.type]);
    const thirdParty=/\b(terceiros?|terceirizadas?|terceirizados?)\b/.test(desc+' '+type);
    const infrastructure=/\b(eletroduto|eletrocalha|condulete|infraestrutura|canaleta|seal\s*tub(?:e|o)|sealtub(?:e|o)|ferro galvanizado)\b/.test(desc);
    const suggested=thirdParty?'ter':infrastructure?'inf':/\b(cabo|cabeamento|cordao optico|patch cord)\b/.test(desc)?'cab':type==='servico'?'cmp':type==='produto'?'eq':'';
    const category=categories[budgetNorm(r[cols.cat])]||suggested;
    const rawQty=cols.qty>=0?r[cols.qty]:'';
    const quantity=rawQty===''||rawQty==null?null:budgetNumber(rawQty);
    const rawUnit=cols.unit>=0?r[cols.unit]:'';
    const unitCost=rawUnit===''||rawUnit==null?null:budgetNumber(rawUnit);
    result.push({name,cost,category,quantity,unitCost,row:header+i+2});
  });
  if(!result.length)throw new Error('A aba não contém itens com descrição.');
  if(result.length>300)throw new Error('Importe no máximo 300 itens por vez.');
  return result;
}
function budgetApply(o,items,source){
  const next=JSON.parse(JSON.stringify(o));let added=0,skipped=0,updated=0;
  const byKey=new Map(CATS.flatMap(c=>(next.cats[c]||[]).filter(r=>r.importKey).map(r=>[r.importKey,r])));
  items.forEach(item=>{
    if(!CATS.includes(item.category)||!Number.isFinite(item.cost)||item.cost<0||!item.name.trim())throw new Error('Confira a categoria e o custo de todos os itens.');
    const key=JSON.stringify([source,item.row,item.name]);
    const quantity=item.quantity==null?null:item.quantity;
    if(quantity!==null&&(!Number.isFinite(quantity)||quantity<0))throw new Error('Confira a quantidade de '+item.name+'.');
    const unitCost=item.unitCost==null?null:item.unitCost;
    if(unitCost!==null&&(!Number.isFinite(unitCost)||unitCost<0))throw new Error('Confira o custo unitário de '+item.name+'.');
    if(byKey.has(key)){const old=byKey.get(key);let changed=false;if((old.qtdOrcada===undefined||old.qtdOrcada===null||old.qtdOrcada==='')&&quantity!==null){old.qtdOrcada=quantity;changed=true;}if((old.unitOrcado===undefined||old.unitOrcado===null||old.unitOrcado==='')&&unitCost!==null){old.unitOrcado=unitCost;changed=true;}if(changed)updated++;else skipped++;return;}
    next.idCt=(Number(next.idCt)||0)+1;
    const entry={id:'e'+next.idCt,name:item.name,bud:item.cost,val:'',importKey:key};if(quantity!==null)entry.qtdOrcada=quantity;if(unitCost!==null)entry.unitOrcado=unitCost;next.cats[item.category].push(entry);byKey.set(key,entry);added++;
  });
  if(JSON.stringify(next).length>45000)throw new Error('Os itens excedem o limite da obra (45.000 caracteres). Reduza a importação.');
  return {obra:next,added,skipped,updated};
}
let budgetLoader;
function budgetLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!budgetLoader)budgetLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de planilha indisponível.'));
    script.onerror=()=>{budgetLoader=null;script.remove();reject(new Error('Não foi possível carregar o leitor de planilhas. Verifique a conexão e tente novamente.'));};
    document.head.appendChild(script);
  });
  return budgetLoader;
}
function budgetBatch(o,groups){
  if(!groups.length||groups.some(g=>g.error||!g.items))throw new Error('Confira as abas de todos os arquivos antes de importar.');
  if(groups.reduce((n,g)=>n+g.items.length,0)>300)throw new Error('Selecione no máximo 300 itens no conjunto de arquivos.');
  let result={obra:o,added:0,skipped:0,updated:0};
  groups.forEach(g=>{const next=budgetApply(result.obra,g.items,g.source);result={obra:next.obra,added:result.added+next.added,skipped:result.skipped+next.skipped,updated:result.updated+next.updated};});
  return result;
}
function pcpImportUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';
  pcpElement('summary','Importar materiais e serviços orçados',box);
  pcpElement('p','Selecione um ou vários arquivos Excel (.xlsx/.xlsm) ou CSV. Escolha uma aba por arquivo e revise custos e categorias. Serviços sem identificação de terceiros são sugeridos como M.O. Compass. Os itens serão adicionados juntos; realizado e linha de base são preservados. Depois clique em Salvar no Sheets.',box);
  const file=pcpElement('input',undefined,box);file.type='file';file.accept='.xlsx,.xlsm,.csv';file.multiple=true;
  const preview=pcpElement('div',undefined,box);preview.style.overflowX='auto';
  let generation=0;
  file.onchange=async()=>{
    const token=++generation;preview.replaceChildren();const files=Array.from(file.files||[]);if(!files.length)return;
    const selected=o.id;
    const active=()=>token===generation&&currentObraId===selected&&box.isConnected;
    try{
      if(files.length>10)throw new Error('Selecione até 10 arquivos por vez.');
      if(files.some(f=>f.size>5*1024*1024))throw new Error('Cada arquivo deve ter até 5 MB.');
      if(files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw new Error('O conjunto deve ter até 20 MB.');
      const X=await budgetLibrary();if(!active())return;
      const groups=[];
      for(const f of files){
        const group={items:null,error:true,source:''};groups.push(group);
        const section=pcpElement('section',undefined,preview);pcpElement('h4',f.name,section);
        try{
          const bytes=await f.arrayBuffer();if(!active())return;
          const wb=X.read(bytes,{type:'array',cellFormula:false,bookVBA:false});
          const label=pcpElement('label','Aba da planilha: ',section),select=pcpElement('select',undefined,label);select.className='form-input';
          wb.SheetNames.forEach(name=>{const opt=pcpElement('option',name,select);opt.value=name;});
          select.value=wb.SheetNames[0]||'';
          const content=pcpElement('div',undefined,section);
          function show(){
            content.replaceChildren();group.items=null;group.error=true;group.source=f.name+' / '+select.value;
            try{
              const sheet=wb.Sheets[select.value];if(!sheet)throw new Error('Selecione uma aba válida.');
              const range=X.utils.decode_range(sheet['!ref']||'A1');
              if(range.e.r>10000||range.e.c>200)throw new Error('Aba muito extensa; exporte apenas a tabela de itens.');
              const items=budgetRows(X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}));
              group.items=items;group.error=false;
              pcpElement('p',items.length+' itens. Confira quantidade, custos unitário e total e categoria. Os valores são independentes; alterar um campo não recalcula os demais.',content);
          const table=pcpElement('table',undefined,content);table.style.width='100%';
          const tr=pcpElement('tr',undefined,pcpElement('thead',undefined,table));
          ['Linha','Descrição','Quantidade orçada','Categoria','Custo unitário (R$)','Custo total (R$)'].forEach(t=>pcpElement('th',t,tr));
          const body=pcpElement('tbody',undefined,table);
          items.forEach(item=>{
            const row=pcpElement('tr',undefined,body);pcpElement('td',String(item.row),row);pcpElement('td',item.name,row);
            const quantity=pcpElement('input',undefined,pcpElement('td',undefined,row));quantity.type='text';quantity.inputMode='decimal';quantity.className='form-input';quantity.placeholder='Não informada';quantity.value=Number.isFinite(item.quantity)?brEdit(item.quantity):'';
            quantity.oninput=()=>{brCheck(quantity);item.quantity=quantity.value.trim()===''?null:brParse(quantity.value);};quantity.onblur=()=>brBlur(quantity);
            const cat=pcpElement('select',undefined,pcpElement('td',undefined,row));cat.className='form-input';
            [{id:'',label:'Selecione…'},...CATS.map(id=>({id,label:LABELS[id]}))].forEach(c=>{const opt=pcpElement('option',c.label,cat);opt.value=c.id;opt.selected=c.id===item.category;});
            cat.onchange=()=>item.category=cat.value;
            const unitCost=pcpElement('input',undefined,pcpElement('td',undefined,row));unitCost.type='text';unitCost.inputMode='decimal';unitCost.className='form-input';unitCost.placeholder='Não informado';unitCost.value=Number.isFinite(item.unitCost)?brEdit(item.unitCost):'';
            unitCost.oninput=()=>{brCheck(unitCost);item.unitCost=unitCost.value.trim()===''?null:brParse(unitCost.value);};unitCost.onblur=()=>brBlur(unitCost);
            const cost=pcpElement('input',undefined,pcpElement('td',undefined,row));cost.type='text';cost.inputMode='decimal';cost.lang='pt-BR';cost.className='form-input';cost.value=Number.isFinite(item.cost)?brEdit(item.cost):'';
            cost.oninput=()=>{brCheck(cost);item.cost=brParse(cost.value);};cost.onblur=()=>brBlur(cost);
          });

            }catch(e){pcpElement('p',e.message,content);}
          }
          select.onchange=show;show();
        }catch(e){pcpElement('p',f.name+': '+e.message,section);}
      }
      if(!active())return;
      const status=pcpElement('p',files.length+' arquivos selecionados. Nenhum item foi adicionado ainda.',preview);
      const apply=pcpElement('button','Adicionar itens de todos os arquivos',preview);apply.type='button';apply.className='btn';
      apply.onclick=()=>{
        try{
          if(!active())throw new Error('Reabra a importação na obra desejada.');
          saveCurrent();const result=budgetBatch(obras[selected],groups);
          obras[selected]=result.obra;saveAll();renderAllLists();recalc();
          apply.disabled=true;alert(result.added+' itens adicionados; '+result.updated+' itens existentes complementados; '+result.skipped+' já importados. Clique em Salvar no Sheets para compartilhar.');renderPCP();
          setSyncStatus('load','Orçamentos importados localmente; salve no Sheets.');
        }catch(e){status.textContent=e.message;}
      };
    }catch(e){if(active())pcpElement('p',e.message,preview);}
  };
}
function scheduleCopy(t){
  const copy={id:crypto.randomUUID(),nome:t.nome+' (cópia)',qtdReal:0,horasReal:0};
  ['responsavel','emailResponsavel','inicio','fim','qtd','horas','predecessora'].forEach(k=>{if(t[k]!==undefined)copy[k]=t[k];});
  return copy;
}
function scheduleDate(v,date1904=false){
  if(v===''||v==null)return '';
  let iso;
  if(typeof v==='number'){
    if(!Number.isFinite(v)||(date1904?v<0:v<1)||(!date1904&&Math.floor(v)===60))throw new Error('Data Excel inválida.');
    const base=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,31);
    const days=Math.floor(v)-(date1904||v<60?0:1);
    iso=new Date(base+days*86400000).toISOString().slice(0,10);
  }else{
    const s=String(v).trim(),br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    iso=br?br[3]+'-'+br[2].padStart(2,'0')+'-'+br[1].padStart(2,'0'):s;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso+'T12:00:00Z'))||new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw new Error('Use uma data válida: dd/mm/aaaa ou aaaa-mm-dd.');
  return iso;
}
function scheduleRows(rows,date1904=false){
  const aliases={nome:['atividade','descricao','tarefa','nome da atividade'],inicio:['inicio','inicio planejado','data inicio','data de inicio'],fim:['fim','termino','fim planejado','data fim','data de termino','termino planejado'],responsavel:['responsavel'],emailResponsavel:['email','e mail','email do responsavel','e mail do responsavel'],qtd:['quantidade','quantidade prevista','qtd'],horas:['horas','horas previstas'],key:['id','codigo','ordem'],pred:['predecessora','id predecessora']};
  let header=-1,cols;
  for(let i=0;i<Math.min(60,rows.length);i++){
    const normalized=rows[i].map(budgetNorm),m={};
    Object.keys(aliases).forEach(k=>m[k]=normalized.findIndex(v=>aliases[k].includes(v)));
    if(m.nome>=0&&m.inicio>=0&&m.fim>=0){header=i;cols=m;break;}
  }
  if(header<0)throw new Error('Cabeçalhos necessários: Atividade, Início planejado e Fim planejado. Datas não são calculadas a partir de duração.');
  const tasks=[];
  rows.slice(header+1).forEach((r,index)=>{
    const nome=String(r[cols.nome]??'').trim();if(!nome)return;
    if(/^(sub ?total|total)(\s|$)/.test(budgetNorm(nome)))return;
    const line=header+index+2;
    try{
      const inicio=scheduleDate(r[cols.inicio],date1904),fim=scheduleDate(r[cols.fim],date1904);
      if(!inicio||!fim)throw new Error('Preencha início e fim.');
      if(fim<inicio)throw new Error('Fim anterior ao início.');
      const number=(k,fallback)=>cols[k]<0||r[cols[k]]===''||r[cols[k]]==null?fallback:budgetNumber(r[cols[k]]);
      const qtd=number('qtd',1),horas=number('horas',0);
      if(!Number.isFinite(qtd)||!Number.isFinite(horas))throw new Error('Quantidade ou horas inválidas.');
      tasks.push({nome,inicio,fim,responsavel:String(r[cols.responsavel]??'').trim(),emailResponsavel:String(r[cols.emailResponsavel]??'').trim(),qtd,horas,row:line,key:String(cols.key<0?tasks.length+1:r[cols.key]??'').trim(),pred:String(r[cols.pred]??'').trim()});
    }catch(e){throw new Error('Linha '+line+': '+e.message);}
  });
  if(!tasks.length)throw new Error('Nenhuma atividade encontrada.');
  if(tasks.length>200)throw new Error('Importe até 200 atividades por vez.');
  const map=new Map();
  tasks.forEach(t=>{if(!t.key||map.has(t.key))throw new Error('IDs/ordens vazios ou repetidos.');map.set(t.key,t);});
  tasks.forEach(t=>{
    const seen=new Set([t.key]);let p=t.pred;
    while(p){if(!map.has(p))throw new Error('Linha '+t.row+': predecessora inexistente no arquivo ('+p+'). Use apenas um ID por atividade.');if(seen.has(p))throw new Error('Dependências em ciclo no arquivo.');seen.add(p);p=map.get(p).pred;}
    const pred=map.get(t.pred);if(pred&&t.inicio<=pred.fim)throw new Error('Linha '+t.row+': início deve ser posterior ao fim da predecessora.');
  });
  return tasks;
}
function scheduleApply(o,items,source){
  const next=JSON.parse(JSON.stringify(o)),p=pcpState(next),ids=new Map();let added=0,skipped=0;
  items.forEach(t=>{
    const key=JSON.stringify([source,t.key,t.nome]);
    const existing=p.tarefas.find(x=>x.scheduleImportKey===key);
    ids.set(t.key,existing?existing.id:crypto.randomUUID());
  });
  items.forEach(t=>{
    const key=JSON.stringify([source,t.key,t.nome]);
    if(p.tarefas.some(x=>x.scheduleImportKey===key)){skipped++;return;}
    p.tarefas.push({id:ids.get(t.key),nome:t.nome,responsavel:t.responsavel,emailResponsavel:t.emailResponsavel,inicio:t.inicio,fim:t.fim,qtd:t.qtd,horas:t.horas,qtdReal:0,horasReal:0,predecessora:t.pred?ids.get(t.pred):'',scheduleImportKey:key});added++;
  });
  const errors=pcpErrors(p);if(errors.length)throw new Error(errors.join(' '));
  if(JSON.stringify(next).length>45000)throw new Error('O cronograma excede o limite de 45.000 caracteres da obra.');
  return {obra:next,added,skipped};
}
function scheduleImportUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';
  pcpElement('summary','Importar cronograma do Excel',box);
  pcpElement('p','Colunas obrigatórias: Atividade, Início planejado, Fim planejado. Opcionais: Responsável, E-mail, Quantidade prevista, Horas previstas, ID e Predecessora. Sem ID, a ordem das atividades é 1, 2, 3… A importação acrescenta atividades; preserva as existentes e a linha de base.',box);
  const file=pcpElement('input',undefined,box);file.type='file';file.accept='.xlsx,.xlsm,.csv';
  const preview=pcpElement('div',undefined,box);preview.style.overflowX='auto';let generation=0;
  file.onchange=async()=>{
    const token=++generation;preview.replaceChildren();const f=file.files[0];if(!f)return;
    const active=()=>token===generation&&currentObraId===o.id&&box.isConnected;
    try{
      if(f.size>5*1024*1024)throw new Error('Selecione arquivo de até 5 MB.');
      const X=await budgetLibrary(),bytes=await f.arrayBuffer();if(!active())return;
      const wb=X.read(bytes,{type:'array',cellFormula:false,bookVBA:false});
      const label=pcpElement('label','Aba: ',preview),select=pcpElement('select',undefined,label);select.className='form-input';
      wb.SheetNames.forEach(name=>{const opt=pcpElement('option',name,select);opt.value=name;});select.value=wb.SheetNames[0]||'';
      const content=pcpElement('div',undefined,preview);
      function show(){
        content.replaceChildren();
        try{
          const sheet=wb.Sheets[select.value];if(!sheet)throw new Error('Selecione uma aba.');
          const range=X.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>10000||range.e.c>200)throw new Error('Aba muito extensa.');
          const items=scheduleRows(X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}),!!(wb.Workbook&&wb.Workbook.WBProps&&wb.Workbook.WBProps.date1904));
          pcpElement('p',items.length+' atividades encontradas. Revise antes de adicionar. Avanço, horas realizadas e datas reais começam em branco/zero.',content);
          const table=pcpElement('table',undefined,content);table.style.width='100%';const head=pcpElement('tr',undefined,pcpElement('thead',undefined,table));
          ['ID','Atividade','Responsável','Início','Fim','Quantidade','Horas','Predecessora'].forEach(t=>pcpElement('th',t,head));const body=pcpElement('tbody',undefined,table);
          items.forEach(t=>{const tr=pcpElement('tr',undefined,body);[t.key,t.nome,t.responsavel,brDate(t.inicio),brDate(t.fim),brNumber(t.qtd),brNumber(t.horas),t.pred||'—'].forEach(v=>pcpElement('td',String(v),tr));});
          const status=pcpElement('p','',content),apply=pcpElement('button','Adicionar atividades à obra',content);apply.type='button';apply.className='btn';
          apply.onclick=()=>{
            try{
              if(!active())throw new Error('Reabra a importação na obra desejada.');saveCurrent();
              const result=scheduleApply(obras[o.id],items,f.name+' / '+select.value);obras[o.id]=result.obra;saveAll();renderPCP();
              alert(result.added+' atividades adicionadas; '+result.skipped+' já importadas. Clique em Salvar no Sheets.');setSyncStatus('load','Cronograma importado localmente; salve no Sheets.');
            }catch(e){status.textContent=e.message;}
          };
        }catch(e){pcpElement('p',e.message,content);}
      }
      select.onchange=show;show();
    }catch(e){if(active())pcpElement('p',e.message,preview);}
  };
}


function purchaseRead(o,controls){
  const proposal=String(o.nome||'').trim();
  if(!proposal)throw new Error('Informe o nome da obra.');
  let date;try{if(!/^\d{2}\/\d{2}\/\d{4}$/.test(controls.date.value))throw 0;date=scheduleDate(controls.date.value);}catch(e){throw new Error('Informe a data necessária no formato dd/mm/aaaa.');}
  const items=[];controls.rows.forEach(function(entry){
    if(!entry.checkbox.checked)return;
    const qty=brParse(entry.qty.value),budget=Number(entry.item.bud);
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Informe uma quantidade válida para '+entry.item.name+'.');
    if(entry.item.bud===''||entry.item.bud==null||!Number.isFinite(budget)||budget<0)throw new Error('Informe o valor orçado de '+entry.item.name+'.');
    const unitCost=entry.item.unitOrcado===''||entry.item.unitOrcado==null?null:Number(entry.item.unitOrcado);
    if(unitCost!==null&&(!Number.isFinite(unitCost)||unitCost<0))throw new Error('Custo unitário inválido em '+entry.item.name+'.');
    items.push({id:entry.item.id,qty:qty,name:String(entry.item.name||''),budget:budget,unitCost:unitCost});
  });
  if(!items.length)throw new Error('Selecione ao menos um equipamento.');
  if(items.length>100)throw new Error('Selecione até 100 equipamentos por solicitação.');
  return {project:o.nome,proposal,date,items,total:items.reduce((a,b)=>a+b.budget,0)};
}
function purchasePrint(data){
  const win=window.open('','_blank');if(!win)throw new Error('Permita a abertura de janelas para gerar o documento.');
  const d=win.document;d.title='Solicitação de compra';const style=d.createElement('style');
  style.textContent='body{font:14px Arial;margin:30px;color:#222}h1{color:#406e2a}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#e9f4e6}@media print{button{display:none}}';d.head.appendChild(style);
  const root=d.body,button=pcpElement('button','Imprimir / Salvar PDF',root);button.onclick=()=>win.print();
  pcpElement('h1','Solicitação de compra',root);pcpElement('p','Obra / proposta: '+data.proposal,root);pcpElement('p','Data necessária: '+brDate(data.date),root);
  const table=pcpElement('table',undefined,root),head=pcpElement('tr',undefined,table);
  ['Equipamento','Quantidade solicitada','Custo unitário orçado','Valor orçado total do item'].forEach(v=>pcpElement('th',v,head));
  data.items.forEach(item=>{const tr=pcpElement('tr',undefined,table);[item.name,brNumber(item.qty),item.unitCost==null?'Não informado':brMoney(item.unitCost),brMoney(item.budget)].forEach(v=>pcpElement('td',v,tr));});
  pcpElement('p','Orçado dos itens selecionados: '+brMoney(data.total),root);
  pcpElement('p','O valor é o orçamento total registrado para cada item, sem cálculo proporcional por quantidade.',root);win.focus();
}
function purchaseUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';pcpElement('summary','Selecionar equipamentos — compra e cotação',box);
  pcpElement('p','Confira quantidade orçada, custo unitário e custo total. O custo total é o do item inteiro e não é recalculado para uma compra parcial. Salve a obra no Sheets antes de enviar o PDF.',box);
  const controls={rows:[]},label=pcpElement('label','Data necessária (dd/mm/aaaa)',box);
  controls.date=pcpElement('input',undefined,label);controls.date.type='text';controls.date.placeholder='dd/mm/aaaa';controls.date.className='form-input';
  const table=pcpElement('table',undefined,box);table.style.width='100%';const h=pcpElement('tr',undefined,table);
  ['Selecionar','Equipamento','Quantidade orçada','Quantidade solicitada','Custo unitário orçado','Orçado total do item'].forEach(t=>pcpElement('th',t,h));
  (o.cats&&o.cats.eq||[]).forEach(item=>{
    const row=pcpElement('tr',undefined,table),check=pcpElement('input',undefined,pcpElement('td',undefined,row));check.type='checkbox';
    pcpElement('td',item.name||'Sem descrição',row);pcpElement('td',item.qtdOrcada==null||item.qtdOrcada===''?'Não informada':brNumber(item.qtdOrcada),row);const qty=pcpElement('input',undefined,pcpElement('td',undefined,row));qty.type='text';qty.inputMode='decimal';qty.placeholder='Quantidade';qty.className='form-input';qty.value=item.qtdOrcada==null||item.qtdOrcada===''?'':brEdit(item.qtdOrcada);
    pcpElement('td',item.unitOrcado===''||item.unitOrcado==null?'Não informado':brMoney(item.unitOrcado),row);
    pcpElement('td',item.bud===''||item.bud==null?'Não informado':brMoney(item.bud),row);controls.rows.push({checkbox:check,qty,item});
  });
  if(!controls.rows.length)pcpElement('p','Cadastre ou importe os equipamentos. O valor orçado é necessário apenas para a solicitação de compra.',box);
  const status=pcpElement('p','',box),print=pcpElement('button','Gerar / imprimir solicitação',box);print.type='button';print.className='btn';
  print.onclick=()=>{try{purchasePrint(purchaseRead(obras[o.id],controls));status.textContent='';}catch(e){status.textContent=e.message;}};
  const emailLabel=pcpElement('label','E-mail de destino',box),email=pcpElement('input',undefined,emailLabel);email.type='email';email.className='form-input';
  const send=pcpElement('button','Enviar solicitação em PDF',box);send.className='btn';send.type='button';
  send.onclick=async()=>{
    try{
      const data=purchaseRead(obras[o.id],controls),recipient=email.value.trim();
      if(!recipient||!email.checkValidity())throw new Error('Informe um e-mail de destino válido.');
      if(!window.pcpRpc)throw new Error('Abra o painel pela implantação do Apps Script.');
      if(!confirm('Enviar a solicitação de compra para '+recipient+'? A obra precisa estar salva no Sheets.'))return;
      send.disabled=true;status.textContent='Enviando…';
      const result=await window.pcpRpc('enviarCompra',{obraId:o.id,revision:Number(obras[o.id]._revision||0),date:data.date,email:recipient,proposal:data.proposal,requestId:crypto.randomUUID(),items:data.items.map(i=>({id:i.id,qty:i.qty,name:i.name,budget:i.budget,unitCost:i.unitCost}))});
      if(!result.ok)throw new Error(result.erro||'Não foi possível enviar.');status.textContent='Solicitação enviada em PDF para '+recipient+'.';
    }catch(e){status.textContent=e.message;}finally{send.disabled=false;}
  };
  quotationUI(box,o,controls);
}
function delayAlertUI(panel,o){
  const p=pcpState(o),box=pcpElement('div',undefined,panel);box.className='card';
  const label=pcpElement('label',' Ativar alertas diários de atraso para esta obra',box),check=pcpElement('input',undefined,label);check.type='checkbox';check.checked=!!p.alertasAtivos;
  check.onchange=()=>{p.alertasAtivos=check.checked;saveAll();};
  pcpElement('p','Salve a obra no Sheets. O gestor e os destinatários do resumo recebem as atividades atrasadas; cada responsável recebe suas atividades. O acionador é instalado uma vez pela administração.',box);
  const status=pcpElement('p','',box),install=pcpElement('button','Instalar alertas automáticos (administração)',box);install.className='btn';install.type='button';
  install.onclick=async()=>{try{if(!window.pcpRpc)throw new Error('Abra o painel pelo Apps Script.');install.disabled=true;const result=await window.pcpRpc('instalarAlertas');status.textContent=result.info;}catch(e){status.textContent=e.message;}finally{install.disabled=false;}};
}

function quoteBilling(direct,fields){
  if(!direct)return {direct:false,razaoSocial:'Compasss Tecnologia',cnpj:'28.781.740/0002-02',ie:'11.356.281',im:'1.437.030-7'};
  const b={direct:true};['razaoSocial','cnpj','ie','im'].forEach(k=>b[k]=String(fields[k]||'').trim());
  if(!b.razaoSocial||b.razaoSocial.length>200)throw new Error('Preencha a razão social para faturamento direto.');
  if(b.cnpj.replace(/\D/g,'').length!==14)throw new Error('Preencha o CNPJ para faturamento direto com 14 dígitos.');
  if(b.ie.length>80||b.im.length>80)throw new Error('Inscrição estadual ou municipal muito longa.');
  return b;
}
function quotationRead(o,controls,billing){
  const proposal=String(o.nome||'').trim();if(!proposal)throw new Error('Informe o nome da obra.');
  let date;try{if(!/^\d{2}\/\d{2}\/\d{4}$/.test(controls.date.value))throw 0;date=scheduleDate(controls.date.value);}catch(e){throw new Error('Informe a data necessária no formato dd/mm/aaaa.');}
  const items=[];controls.rows.forEach(e=>{if(e.checkbox.checked){const qty=brParse(e.qty.value);if(!Number.isFinite(qty)||qty<=0||qty>1000000)throw new Error('Informe a quantidade de '+e.item.name+'.');items.push({id:e.item.id,name:String(e.item.name||''),qty});}});
  if(!items.length||items.length>100)throw new Error('Selecione de 1 a 100 equipamentos.');
  return {proposal,date,items,billing:quoteBilling(billing.direct,billing)};
}
function quotationPrint(data){
  const win=window.open('','_blank');if(!win)throw new Error('Permita a abertura de janelas para gerar o documento.');
  const d=win.document;d.title='SOLICITAÇÃO DE COTAÇÃO';const style=d.createElement('style');
  style.textContent='body{font:14px Arial;color:#222;margin:30px}h1{color:#406e2a}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}th{background:#e9f4e6}@media print{button{display:none}}';d.head.appendChild(style);
  const root=d.body,btn=pcpElement('button','Imprimir / Salvar PDF',root);btn.onclick=()=>win.print();
  pcpElement('h1','SOLICITAÇÃO DE COTAÇÃO',root);pcpElement('p','Obra / proposta: '+data.proposal,root);pcpElement('p','Data necessária: '+brDate(data.date),root);
  const b=data.billing;pcpElement('h2',b.direct?'Faturamento direto ao cliente':'Faturamento CompaSSS',root);
  [['Razão social',b.razaoSocial],['CNPJ',b.cnpj],['Inscrição Estadual',b.ie||'Não informada'],['Inscrição Municipal',b.im||'Não informada']].forEach(([k,v])=>pcpElement('p',k+': '+v,root));
  const table=pcpElement('table',undefined,root),head=pcpElement('tr',undefined,table);
  ['Equipamento / especificação','Quantidade','Valor unitário','Valor total'].forEach(v=>pcpElement('th',v,head));
  data.items.forEach(item=>{const row=pcpElement('tr',undefined,table);[item.name,brNumber(item.qty),'',''].forEach(v=>pcpElement('td',v,row));});
  pcpElement('p','Favor informar preços, impostos, frete, prazo de entrega, validade da proposta e condições de pagamento.',root);win.focus();
}
function quotationUI(box,o,controls){
  const model=pcpState(o).faturamentoCotacao||{direct:false,razaoSocial:'',cnpj:'',ie:'',im:''};pcpState(o).faturamentoCotacao=model;
  pcpElement('h3','Cotação junto ao fornecedor',box);pcpElement('p','Use os equipamentos selecionados acima. O documento para o fornecedor apresenta quantidades e campos de preço para cotação.',box);
  const label=pcpElement('label',' Faturamento direto ao cliente',box),check=pcpElement('input',undefined,label);check.type='checkbox';check.checked=!!model.direct;
  const standard=pcpElement('p','Faturamento CompaSSS — Compasss Tecnologia | CNPJ: 28.781.740/0002-02 | IE: 11.356.281 | IM: 1.437.030-7',box);
  const fields=pcpElement('div',undefined,box);fields.className='fin-grid';
  [['razaoSocial','Razão social do cliente'],['cnpj','CNPJ do cliente'],['ie','Inscrição Estadual (opcional / isento)'],['im','Inscrição Municipal (opcional)']].forEach(([key,title])=>{
    const l=pcpElement('label',title,fields),input=pcpElement('input',undefined,l);input.type='text';input.className='form-input';input.value=model[key]||'';input.maxLength=key==='razaoSocial'?200:key==='cnpj'?30:80;
    input.oninput=()=>{model[key]=input.value;saveAll();};
  });
  const toggle=()=>{fields.hidden=!check.checked;fields.style.display=check.checked?'':'none';standard.hidden=check.checked;standard.style.display=check.checked?'none':'';};toggle();check.onchange=()=>{model.direct=check.checked;saveAll();toggle();};
  const status=pcpElement('p','',box),print=pcpElement('button','Gerar cotação para fornecedor',box);print.className='btn';print.type='button';
  print.onclick=()=>{try{quotationPrint(quotationRead(obras[o.id],controls,model));status.textContent='';}catch(e){status.textContent=e.message;}};
  const emailLabel=pcpElement('label','E-mail do fornecedor',box),email=pcpElement('input',undefined,emailLabel);email.type='email';email.className='form-input';
  const send=pcpElement('button','Enviar cotação em PDF',box);send.className='btn';send.type='button';
  send.onclick=async()=>{
    try{
      const data=quotationRead(obras[o.id],controls,model),recipient=email.value.trim();
      if(!recipient||!email.checkValidity())throw new Error('Informe o e-mail do fornecedor.');if(!window.pcpRpc)throw new Error('Abra o painel pelo Apps Script.');
      if(!confirm('Enviar a solicitação de cotação para '+recipient+' com faturamento '+(data.billing.direct?'direto ao cliente':'CompaSSS')+'?'))return;
      send.disabled=true;status.textContent='Enviando…';
      const result=await window.pcpRpc('enviarCotacao',{obraId:o.id,revision:Number(obras[o.id]._revision||0),date:data.date,email:recipient,proposal:data.proposal,billing:data.billing,items:data.items,requestId:crypto.randomUUID()});
      if(!result.ok)throw new Error(result.erro||'Envio não confirmado.');status.textContent='Cotação enviada em PDF para '+recipient+'.';
    }catch(e){status.textContent=e.message;}finally{send.disabled=false;}
  };
}


/* Planejamento assistido por regras; leitura local de PDF/DOCX. */
function proposalNorm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function proposalClauses(text){
  if(String(text||'').length>120000)throw new Error('Texto muito extenso. Use até 120.000 caracteres.');
  let excluded=false;
  const out=[];
  String(text||'').split(/\r?\n|[.;]\s+/).forEach(raw=>{
    const line=raw.trim();if(!line)return;const n=proposalNorm(line).replace(/^\d+[\s.)-]*/,'');
    if(/^(exclusoes|itens excluidos|nao (?:estao |esta )?(?:inclus|contemplad)|fora do escopo)/.test(n))excluded=true;
    else if(/^(escopo|servicos (?:inclus|contemplad)|itens inclus|condicoes comerciais|prazo de execucao|garantia|investimento)/.test(n))excluded=false;
    const negative=excluded||/\b(nao|sem|excluid[oa]s?|exclus[oa]s?|fora do escopo|responsabilidade d[oa] cliente|a cargo d[oa] cliente|pelo cliente)\b/.test(n);
    out.push({text:line,normalized:n,excluded:negative});
  });
  return out;
}
function proposalAnalyze(text,discipline){
  if(String(text||'').trim().length<40)throw new Error('O texto é insuficiente. Confira a extração ou cole o escopo aprovado.');
  const clauses=proposalClauses(text),positive=clauses.filter(c=>!c.excluded);
  const rules=[
    ['acesso','Controle de acesso',/\b(catraca|facial|controle de acesso|biometr|leitor de acesso)/],
    ['cftv','CFTV',/\b(cftv|camera|videomonitor|digifort|hikcentral)/],
    ['sdai','SDAI',/\b(sdai|deteccao|alarme de incendio|detector|notifier)/],
    ['automacao','Automação',/\b(automacao|bms|hvac|fancoil|vav|bacnet|modbus|controlador)/]
  ];
  const active=discipline&&discipline!=='auto'?rules.filter(r=>r[0]===discipline):rules.filter(r=>positive.some(c=>r[2].test(c.normalized)));
  if(!active.length)throw new Error('Não identifiquei a disciplina. Selecione a disciplina e confira o texto.');
  const stages=[
    ['validacao','Validar escopo, acessos e condições de execução',1,null],
    ['projeto','Validar projeto e documentação técnica',2,/\b(projeto|desenho|diagrama|engenharia)\b/],
    ['compras','Comprar e receber materiais',15,/\b(fornecimento|fornecer|compra|aquisicao|entrega de materiais)\b/],
    ['infra','Executar infraestrutura',3,/\b(infraestrutura|eletroduto|eletrocalha|seal tube|condulete)\b/],
    ['cabos','Lançar e identificar cabeamento',3,/\b(cabeamento|cabos?|fibra|utp)\b/]
  ];
  const tasks=stages.map(([id,name,days,pattern])=>{
    const evidence=pattern?positive.find(c=>pattern.test(c.normalized)):null;
    const exclusion=pattern?clauses.find(c=>c.excluded&&pattern.test(c.normalized)):null;
    return {key:id,nome:name,dias:days,selected:id==='validacao'||!!evidence,evidence:evidence?evidence.text.slice(0,240):exclusion?'Revisar exclusão: '+exclusion.text.slice(0,200):'Etapa de referência: confirmar necessidade.',qtd:1,horas:0,responsavel:''};
  });
  active.forEach(([id,label,pattern])=>{
    const evidence=positive.find(c=>pattern.test(c.normalized));
    const install=positive.find(c=>pattern.test(c.normalized)&&/\b(instalacao|instalar|implantacao|substituicao|remanejamento)\b/.test(c.normalized));
    const qtyMatch=install&&proposalNorm(install.text).match(/\b(\d{1,5}(?:,\d+)?)\s*(?:unidades?\s+(?:de\s+)?)?(cameras?|catracas?|leitores?|faciais|detectores?|fancoils?|vavs?)\b/);
    const suggestedQty=qtyMatch?Number(qtyMatch[1].replace(',','.')):1;
    tasks.push({key:'instalar_'+id,nome:'Instalação / implantação — '+label,dias:3,selected:!!install,evidence:(install||evidence)?.text.slice(0,240)||'Disciplina selecionada manualmente; confirmar escopo.',qtd:suggestedQty,horas:0,responsavel:''});
    const config=positive.find(c=>/\b(configuracao|programacao|parametrizacao|integracao)\b/.test(c.normalized));
    tasks.push({key:'config_'+id,nome:'Configuração e integração — '+label,dias:2,selected:!!config,evidence:config?config.text.slice(0,240):'Confirmar se configuração está contemplada.',qtd:1,horas:0,responsavel:''});
  });
  [['testes','Testar e comissionar o sistema',2,/\b(testes?|comissionamento)\b/],['entrega','Documentar e entregar a obra',1,/\b(as built|documentacao|treinamento|entrega tecnica|aceite)\b/]].forEach(([key,nome,dias,pattern])=>{
    const evidence=positive.find(c=>pattern.test(c.normalized));tasks.push({key,nome,dias,selected:!!evidence,evidence:evidence?evidence.text.slice(0,240):'Confirmar se a etapa está contemplada.',qtd:1,horas:0,responsavel:''});
  });
  return {disciplines:active.map(r=>r[1]),tasks,exclusions:clauses.filter(c=>c.excluded).map(c=>c.text).slice(0,20)};
}
function proposalPlan(o,stages,start,source,reviewed,idFactory){
  if(!reviewed)throw new Error('Confirme a revisão do escopo e das durações sugeridas.');
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(start||''))throw new Error('Informe o início em dd/mm/aaaa.');
  const iso=scheduleDate(start),selected=stages.filter(t=>t.selected);
  if(!selected.length)throw new Error('Selecione ao menos uma etapa.');
  const next=JSON.parse(JSON.stringify(o)),p=pcpState(next),ids=new Set(p.tarefas.map(t=>t.id));
  let cursor=Date.parse(iso+'T12:00:00Z'),previous='',added=0;
  if(p.tarefas.some(t=>t.proposalSource===source))throw new Error('Este texto/arquivo já gerou atividades nesta obra. Edite as atividades existentes ou use outra revisão da proposta.');
  selected.forEach(s=>{
    const days=Number(s.dias),qtd=Number(s.qtd),hours=Number(s.horas),name=String(s.nome||'').trim();
    if(!name||name.length>250||!Number.isInteger(days)||days<1||days>730||!Number.isFinite(qtd)||qtd<0||!Number.isFinite(hours)||hours<0)throw new Error('Confira o nome, duração, quantidade e horas de cada etapa.');
    let id=(idFactory||(()=>crypto.randomUUID()))();if(ids.has(id))throw new Error('Identificador de atividade repetido.');ids.add(id);
    const inicio=new Date(cursor).toISOString().slice(0,10),fim=new Date(cursor+(days-1)*86400000).toISOString().slice(0,10);
    p.tarefas.push({id,nome:name,responsavel:String(s.responsavel||'').slice(0,180),inicio,fim,qtd,horas:hours,qtdReal:0,horasReal:0,predecessora:previous,proposalSource:source});
    previous=id;cursor+=days*86400000;added++;
  });
  if(pcpErrors(p).length)throw new Error(pcpErrors(p).join(' '));
  if(JSON.stringify(next).length>45000)throw new Error('A obra excede o limite de 45.000 caracteres. Reduza o número de etapas.');
  return {obra:next,added,final:new Date(cursor-86400000).toISOString().slice(0,10)};
}
function proposalSource(name,text){
  let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
  return String(name||'Texto aprovado').slice(0,120)+'#'+(h>>>0).toString(16);
}
let proposalPdfLibrary,proposalWordLibrary;
async function proposalExtract(file){
  if(!file||file.size>5*1024*1024)throw new Error('Selecione um arquivo de até 5 MB.');
  const extension=file.name.split('.').pop().toLowerCase();
  if(extension==='txt')return file.text();
  if(extension==='pdf'){
    if(!proposalPdfLibrary)proposalPdfLibrary=import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs').catch(e=>{proposalPdfLibrary=null;throw e;});
    const X=await proposalPdfLibrary;X.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
    const task=X.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}),pdf=await task.promise;
    try{
      if(pdf.numPages>80)throw new Error('Use uma proposta de até 80 páginas.');
      let text='';
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),content=await page.getTextContent();let lastY=null;
        for(const item of content.items){const y=item.transform&&item.transform[5];if(lastY!==null&&y!=null&&Math.abs(y-lastY)>3)text+='\n';text+=String(item.str||'')+(item.hasEOL?'\n':' ');lastY=y;}
        text+='\n';if(text.length>120000)throw new Error('Texto muito extenso. Use somente a proposta aprovada.');
      }
      if(text.trim().length<40)throw new Error('PDF sem texto suficiente. Faça OCR antes ou cole o escopo abaixo.');
      return text;
    }finally{await pdf.destroy();}
  }
  if(extension==='docx'){
    if(!window.mammoth){
      if(!proposalWordLibrary)proposalWordLibrary=new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
        script.onload=()=>window.mammoth?resolve(window.mammoth):reject(new Error('Leitor Word indisponível.'));script.onerror=()=>{proposalWordLibrary=null;script.remove();reject(new Error('Não foi possível carregar o leitor Word.'));};document.head.appendChild(script);
      });
      await proposalWordLibrary;
    }
    const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});if(result.value.length>120000)throw new Error('Texto muito extenso.');return result.value;
  }
  throw new Error('Use PDF, DOCX ou TXT. Para arquivos .doc, salve uma cópia em DOCX.');
}
function proposalUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';
  pcpElement('summary','Gerar cronograma pela proposta aprovada',box);
  pcpElement('p','Envie PDF com texto ou Word (.docx). A leitura local sugere etapas por regras e modelos; confira exclusões e escopo. Durações e quantidades são referências editáveis, não compromissos extraídos da proposta.',box);
  const file=pcpElement('input',undefined,box);file.type='file';file.accept='.pdf,.docx,.txt';
  const text=pcpElement('textarea',undefined,box);text.className='form-input';text.placeholder='Texto extraído da proposta. Você também pode colar o escopo aprovado aqui.';text.style.minHeight='150px';text.maxLength=120000;
  const label=pcpElement('label','Disciplina: ',box),discipline=pcpElement('select',undefined,label);discipline.className='form-input';
  [['auto','Detectar pelo texto'],['acesso','Controle de acesso'],['cftv','CFTV'],['sdai','SDAI'],['automacao','Automação']].forEach(([value,name])=>{const opt=pcpElement('option',name,discipline);opt.value=value;});discipline.value='auto';
  const startLabel=pcpElement('label','Início previsto (dd/mm/aaaa): ',box),start=pcpElement('input',undefined,startLabel);start.type='text';start.placeholder='dd/mm/aaaa';start.className='form-input';
  const status=pcpElement('p','',box),analyze=pcpElement('button','Analisar e sugerir etapas',box);analyze.type='button';analyze.className='btn';
  const preview=pcpElement('div',undefined,box);preview.style.overflowX='auto';let generation=0,filename='Texto aprovado';
  const active=()=>currentObraId===o.id&&box.isConnected;
  function invalidate(){generation++;analyze.disabled=false;preview.replaceChildren();status.textContent='Texto alterado. Analise novamente antes de adicionar.';}
  text.oninput=invalidate;discipline.onchange=invalidate;
  file.onchange=async()=>{
    const token=++generation;preview.replaceChildren();const selected=file.files[0];if(!selected)return;
    filename=selected.name;text.value='';status.textContent='Lendo proposta…';analyze.disabled=true;
    try{const result=await proposalExtract(selected);if(!active()||token!==generation)return;text.value=result;status.textContent='Texto extraído. Confira o conteúdo e clique em Analisar.';}
    catch(e){if(active()&&token===generation)status.textContent=e.message+' Se necessário, cole o texto aprovado.';}
    finally{if(active()&&token===generation)analyze.disabled=false;}
  };
  analyze.onclick=()=>{
    preview.replaceChildren();try{
      if(!active())return;const analysis=proposalAnalyze(text.value,discipline.value),source=proposalSource(filename,text.value),captured=text.value;
      pcpElement('p','Disciplinas: '+analysis.disciplines.join(', ')+'. Datas em dias corridos; etapas selecionadas serão encadeadas na ordem abaixo.',preview);
      if(analysis.exclusions.length){const ex=pcpElement('details',undefined,preview);pcpElement('summary','Trechos com exclusões ou condições para revisar',ex);analysis.exclusions.forEach(t=>pcpElement('p',t,ex));}
      const table=pcpElement('table',undefined,preview);table.style.width='100%';const tr=pcpElement('tr',undefined,pcpElement('thead',undefined,table));
      ['Usar','Etapa','Dias sugeridos','Quantidade','Horas previstas','Responsável','Referência do texto / observação'].forEach(v=>pcpElement('th',v,tr));
      const body=pcpElement('tbody',undefined,table);
      analysis.tasks.forEach(t=>{
        const row=pcpElement('tr',undefined,body),check=pcpElement('input',undefined,pcpElement('td',undefined,row));check.type='checkbox';check.checked=t.selected;check.onchange=()=>t.selected=check.checked;
        [['nome','text'],['dias','number'],['qtd','number'],['horas','number'],['responsavel','text']].forEach(([key,type])=>{
          const input=pcpElement('input',undefined,pcpElement('td',undefined,row));input.type='text';input.className='form-input';input.value=type==='number'?brEdit(t[key]):t[key];if(type==='number')input.inputMode='decimal';
          input.oninput=()=>{t[key]=type==='number'?brParse(input.value):input.value;};
        });pcpElement('td',t.evidence,row);
      });
      const confirmLabel=pcpElement('label',' Revisei o escopo, exclusões, durações, quantidades e responsáveis.',preview),review=pcpElement('input',undefined,confirmLabel);review.type='checkbox';
      pcpElement('p','Na instalação, uma quantidade explícita no trecho pode ser sugerida; confira-a. Nos demais casos, quantidade 1 significa etapa única. Horas 0 precisam ser preenchidas para calcular avanço ponderado. Datas e prazo contratual devem ser conciliados antes de salvar.',preview);
      const add=pcpElement('button','Adicionar etapas ao cronograma',preview);add.type='button';add.className='btn';
      add.onclick=()=>{try{
        if(!active()||text.value!==captured)throw new Error('O texto mudou. Analise novamente.');saveCurrent();
        const result=proposalPlan(obras[o.id],analysis.tasks,start.value,source,review.checked);obras[o.id]=result.obra;saveAll();renderPCP();
        alert(result.added+' etapas adicionadas. Confira o cronograma e clique em Salvar no Sheets.');setSyncStatus('load','Cronograma preliminar gerado; revise e salve no Sheets.');
      }catch(e){status.textContent=e.message;}};
      status.textContent='Prévia pronta. Revise e confirme antes de adicionar.';
    }catch(e){status.textContent=e.message;}
  };
}
