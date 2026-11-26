// TELAR's private assistant permits reversible canvas actions only.
export const MAX_BODY = 16384;
export const MAX_CARDS = 6;
export const ACTIONS = ['none','note','brief','storyboard'];
export function parseInput(body) {
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) throw new Error('invalid_message');
  const context = {};
  for (const k of ['name','client','goal','audience']) {
    const v=body.context?.[k];
    context[k]=typeof v==='string'?v.slice(0,1000):'';
  }
  const history=Array.isArray(body.history)?body.history.slice(-8).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.text==='string').map(x=>({role:x.role,text:x.text.slice(0,1000)})):[];
  return {message:body.message.trim(),context,history};
}
export function validateOutput(raw) {
  if (!raw || typeof raw.reply!=='string' || !raw.reply.trim() || raw.reply.length>3000 || !ACTIONS.includes(raw.action) || !Array.isArray(raw.cards) || raw.cards.length>MAX_CARDS || raw.cards.some(c=>typeof c!=='string'||!c.trim()||c.length>1000)) throw new Error('invalid_model_output');
  if (raw.action==='none' && raw.cards.length) throw new Error('invalid_model_output');
  if (['note','brief'].includes(raw.action) && raw.cards.length!==1) throw new Error('invalid_model_output');
  if (raw.action==='storyboard' && !raw.cards.length) throw new Error('invalid_model_output');
  return {reply:raw.reply,action:raw.action,cards:raw.cards};
}
