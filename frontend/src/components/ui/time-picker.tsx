import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './dialog';
import { AppButton } from './app-button';
/** Shared, full-field time picker with product colours and keyboard support. */
export function TimePicker({ value = '', onChange, label = 'Choose time' }: { value?: string; onChange: (value: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const hour = value.split(':')[0] || '18';
  const minute = value.split(':')[1] || '00';
  return <><button type="button" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'12px 16px', border:'1px solid #cedee9', borderRadius:14, background:'#fff', color:'#4f91ba', fontSize:16 }}><span>{value || 'Select time'}</span><Clock size={18}/></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-sm rounded-3xl"><DialogTitle>{label}</DialogTitle><DialogDescription>Select an hour and minute.</DialogDescription><div className="grid grid-cols-2 gap-3">
      {[['Hour',24,hour],['Minute',60,minute]].map(([title,count,selected], column) => <div key={String(title)}><p className="mb-2 text-sm text-[#7f7280]">{title}</p><div className="h-56 overflow-y-auto rounded-2xl bg-[#f5f3f8] p-2" role="group" aria-label={String(title)}>{Array.from({length:Number(count)},(_,i) => String(i).padStart(2,'0')).map(item => <button type="button" key={item} aria-pressed={item === selected} className="mb-1 w-full rounded-xl py-2" style={{background:item === selected ? (column ? '#c995a5' : '#4f91ba') : 'transparent',color:item === selected ? 'white' : '#3d5f7a'}} onClick={() => onChange(column ? `${hour}:${item}` : `${item}:${minute}`)}>{item}</button>)}</div></div>)}
    </div><AppButton tone="gradient" onClick={() => { if (!value) onChange(`${hour}:${minute}`); setOpen(false); }}>Done</AppButton></DialogContent></Dialog></>;
}
