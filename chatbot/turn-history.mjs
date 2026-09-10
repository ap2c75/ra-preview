const STATE_KEYS=['filters','selected','unresolved','offset','sort','view','preferences','awaiting','visibleCodes','recommendedCodes','reprompt'];

export function stateSnapshot(state={}){
  return Object.fromEntries(STATE_KEYS.map(key=>[key,structuredClone(state[key])]).filter(([,value])=>value!==undefined));
}

export function isUndoRequest(text=''){
  return /(?:방금|아까|마지막).{0,8}(?:말|선택|조건|변경).{0,8}(?:취소|되돌|복구)|(?:이전|전).{0,6}(?:조건|선택|상태)(?:으로|로)?.{0,5}(?:돌아|되돌|복구)|^(?:실수였어|잘못 골랐어|되돌려줘)$/i.test(String(text).trim());
}

export function createTurnHistory({limit=10}={}){
  let stack=[];
  return {
    checkpoint(before,after){
      const previous=stateSnapshot(before),next=stateSnapshot(after);
      if(JSON.stringify(previous)===JSON.stringify(next))return false;
      stack=[...stack,previous].slice(-limit);return true;
    },
    undo(current){
      if(!stack.length)return {state:stateSnapshot(current),restored:false};
      const state=stack.at(-1);stack=stack.slice(0,-1);return {state:structuredClone(state),restored:true};
    },
    count(){return stack.length;},
    clear(){stack=[];},
  };
}
