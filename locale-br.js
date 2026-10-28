function brNumber(value,decimals=2){return Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});}
function brMoney(value){return 'R$ '+brNumber(value,2);}
function brEdit(value){return value===''||value==null?'':brNumber(value,2);}
function brParse(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:NaN;
  const s=String(value??'').trim().replace(/^R\$\s*/,'');
  if(!s)return NaN;
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s))return NaN;
  return Number(s.replace(/\./g,'').replace(',','.'));
}
function brDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):value||'';}
function brCheck(input){
  const value=brParse(input.value),valid=input.value.trim()===''||Number.isFinite(value);
  input.setCustomValidity(valid?'':'Use o padrão brasileiro: 1.234,56.');
  return valid;
}
function brBlur(input){if(brCheck(input)&&input.value.trim()!=='')input.value=brEdit(brParse(input.value));}
