export function formatPhone(value){
 const digits=value.replace(/\D/g,'').slice(0,11);
 const prefix=digits.startsWith('02')?2:3;
 if(digits.length<=prefix)return digits;
 const middle=digits.startsWith('010')||digits.length>prefix+7?4:3;
 if(digits.length<=prefix+middle)return digits.slice(0,prefix)+'-'+digits.slice(prefix);
 return digits.slice(0,prefix)+'-'+digits.slice(prefix,prefix+middle)+'-'+digits.slice(prefix+middle);
}
export function bindPhoneInput(input){
 input.addEventListener('input',event=>{
  if(event.isComposing)return;
  const raw=input.value,position=input.selectionStart??raw.length;
  const count=raw.slice(0,position).replace(/\D/g,'').length;
  const formatted=formatPhone(raw);
  if(formatted===raw)return;
  input.value=formatted;
  let caret=0,digits=0;
  while(caret<formatted.length&&digits<count){if(/\d/.test(formatted[caret]))digits++;caret++;}
  input.setSelectionRange(caret,caret);
 });
}
