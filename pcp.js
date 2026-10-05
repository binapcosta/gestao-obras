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
  if(type!=='textarea') input.type=type;
  input.className='form-input'; input.value=value??''; input.disabled=disabled;
  if(type==='number'){input.min='0';input.step='0.01';}
  input.addEventListener('change',()=>{
    if(!input.checkValidity()){input.reportValidity();return;}
    change(type==='number'?Number(input.value):input.value);
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
  const panel=document.getElementById('pcpPanel'); panel.replaceChildren();
  const o=obras[currentObraId]; if(!o)return;
  const p=pcpState(o), m=pcpMetrics(o);
  pcpElement('h2','PCP — prazo e custo para concluir',panel);
  const summary=pcpElement('p',undefined,panel);
  summary.textContent='Atividades atrasadas: '+m.late+' | Avanço físico: '+(m.advance===null?'não definido':m.advance.toFixed(1)+'%')+
    ' | Horas: '+m.realHours+' / '+m.hours+' | Custo final estimado: '+fmtP(m.final);
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
  pcpElement('h3','Cronograma — dias corridos',panel);
  pcpElement('p','Dependências geram alertas; as datas não são deslocadas automaticamente. A linha de base preserva o primeiro planejamento.',panel);
  const actions=pcpElement('div',undefined,panel);actions.className='actions-row';
  const add=pcpElement('button','Adicionar atividade',actions);add.className='btn';add.disabled=!!p.baseline;
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
    pcpElement('summary',t.nome+' — '+(t.responsavel||'Sem responsável'),card);
    const fields=pcpElement('div',undefined,card);fields.className='fin-grid';
    [['nome','Atividade','text'],['responsavel','Responsável','text'],
      ['inicio','Início planejado','date'],['fim','Fim planejado','date'],['previsao','Previsão atual de término','date'],
      ['inicioReal','Início real','date'],['fimReal','Fim real','date'],
      ['qtd','Quantidade prevista','number'],['qtdReal','Quantidade concluída','number'],
      ['horas','Horas previstas','number'],['horasReal','Horas realizadas','number'],
      ['impedimento','Impedimento / ação / responsável','textarea']].forEach(([key,label,type])=>{
      pcpInput(fields,label,t[key],type,v=>{
        t[key]=v;
      },!!p.baseline&&['inicio','fim','horas','qtd'].includes(key));
    });
    const label=pcpElement('label','Predecessora (término → início)',fields);
    const select=pcpElement('select',undefined,label);select.className='form-input';
    [{id:'',nome:'Sem predecessora'},...p.tarefas.filter(x=>x.id!==t.id)].forEach(x=>{
      const opt=pcpElement('option',x.nome,select);opt.value=x.id;opt.selected=t.predecessora===x.id;
    });
    select.onchange=()=>{t.predecessora=select.value;saveAll();renderPCP();};
    const del=pcpElement('button','Remover atividade',card);del.className='btn btn-danger';
    del.disabled=!!p.baseline;
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
    pcpElement('p',t.nome+' | '+t.inicio+' → '+(t.previsao||t.fim),panel);
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
    const res=await fetch(scriptUrl+'?action=obras');const d=await res.json();
    if(!d.ok||!Array.isArray(d.obras))throw new Error(d.erro||'Atualize o Apps Script para a versão PCP.');
    if(!confirm('Carregar a versão compartilhada substituirá as obras locais com o mesmo ID. Faça backup antes. Continuar?'))return;
    saveCurrent();d.obras.forEach(o=>obras[o.id]=o);saveAll();goHome();
    if(d.sheetUrl)localStorage.setItem('obra_sheet_url',d.sheetUrl);
    setSyncStatus('ok','obras carregadas');
  }catch(e){setSyncStatus('err',e.message);}
}
async function pcpSave(){
  if(!scriptUrl){alert('Configure a URL do Apps Script.');return;}
  saveCurrent();const o=obras[currentObraId];if(!o)return;
  const errors=pcpErrors(pcpState(o));if(errors.length){alert(errors.join('\n'));return;}
  if(window.pcpSaving)return;
  window.pcpSaving=true;setSyncStatus('load','salvando obra...');
  const sent=JSON.parse(JSON.stringify(o));
  const fd=new FormData();fd.append('payload',JSON.stringify({action:'salvarObra',obra:sent,requestId:crypto.randomUUID()}));
  try{
    const r=await fetch(scriptUrl,{method:'POST',body:fd});const d=await r.json();
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
