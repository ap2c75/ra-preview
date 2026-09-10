const VERSION=1;
const empty=()=>({version:VERSION,turns:0,outcomes:{responded:0,unresolved:0,handoff:0,blocked:0},feedback:{repeat:0,misread:0,insufficient:0,recommendation:0},intents:{},selectionTurns:0,updatedAt:null});
const safeKey=value=>typeof value==='string'&&/^[a-z0-9:_-]{1,80}$/i.test(value)?value:'unknown';
const clone=value=>JSON.parse(JSON.stringify(value));

export function createQualityMetrics({storage,key='somun:quality-metrics:v1',now=Date.now}={}){
 let value=empty();
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.version===VERSION)value={...empty(),...saved,outcomes:{...empty().outcomes,...saved.outcomes},feedback:{...empty().feedback,...saved.feedback},intents:{...saved.intents}};}catch{}
 const persist=()=>{value.updatedAt=new Date(now()).toISOString();try{storage?.setItem(key,JSON.stringify(value));}catch{}}
 return {
  observe({outcome,intent,selectedCount=0}={}){
   value.turns++;const result=['responded','unresolved','handoff','blocked'].includes(outcome)?outcome:'blocked';value.outcomes[result]++;
   const topic=safeKey(intent);value.intents[topic]=(value.intents[topic]||0)+1;
   if(Number(selectedCount)>0)value.selectionTurns++;
   persist();return clone(value);
  },
  feedback(reason){const id=safeKey(reason);if(Object.hasOwn(value.feedback,id))value.feedback[id]++;persist();return clone(value);},
  snapshot(){return clone(value);},
  clear(){value=empty();try{storage?.removeItem(key);}catch{}},
  exportText(){return JSON.stringify(value,null,2);},
 };
}
