/* Read-only DOM geometry for the current frontend, evaluated by browser tooling. */
() => {
  const p = Number.parseFloat;
  const width = innerWidth, viewportHeight = innerHeight;
  const box = r => ({x:r.x,y:r.y,width:r.width,height:r.height});
  const intersect = (a,b) => ({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))});
  const shown = e => { const s=getComputedStyle(e),r=e.getBoundingClientRect(); if(e.closest('[hidden]'))return false; for(let a=e.parentElement;a;a=a.parentElement){if(Number(getComputedStyle(a).opacity)===0)return false;if(a.tagName==='DETAILS'&&!a.open&&!a.querySelector('summary')?.contains(e))return false;} return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0; };
  const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(shown),root=dialogs.at(-1)||document.body;
  const expandedBody=root.matches('.activity-drawer')?root.querySelector('.pl-detail'):null;
  const overflowExtra=expandedBody?Math.max(0,expandedBody.scrollHeight-expandedBody.clientHeight):0;
  const height=dialogs.length ? viewportHeight+overflowExtra : Math.max(viewportHeight,document.documentElement.scrollHeight);
  const view={x:0,y:0,width,height};
  const clipFor = e => { let c=view; for(let el=e.parentElement;el&&el!==document.documentElement&&el!==document.body;el=el.parentElement){ const s=getComputedStyle(el); if(/hidden|clip|auto|scroll/.test(s.overflowX+' '+s.overflowY)){const b=box(el.getBoundingClientRect());if(expandedBody&&(el===expandedBody||el===root)){b.y=0;b.height=height;}c=intersect(c,b);} } return {...c}; };
  const visible = e => shown(e)&&intersect(box(e.getBoundingClientRect()),clipFor(e)).width>0&&intersect(box(e.getBoundingClientRect()),clipFor(e)).height>0;
  const elements=[root,...root.querySelectorAll('*')].filter(e=>!e.closest('svg')&&visible(e));
  const boxes=[],texts=[],images=[],controls=[],icons=[];
  for(const e of elements){
    const r=box(e.getBoundingClientRect()),s=getComputedStyle(e),clip=clipFor(e);
    if(expandedBody&&e===root)r.height=height;
    const background=s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.backgroundColor!=='transparent';
    if((background||s.backgroundImage!=='none'||p(s.borderTopWidth)>0)&&r.width>2&&r.height>2)boxes.push({...r,clip:{...clip},radius:p(s.borderTopLeftRadius)||0,kind:e.tagName.toLowerCase(),borderWidth:p(s.borderTopWidth)||0,borderColor:s.borderTopColor,background,fill:s.backgroundColor,backgroundImage:s.backgroundImage,opacity:p(s.opacity),shadow:s.boxShadow});
    if(e.tagName==='IMG')images.push({...r,clip:{...clip},alt:e.alt||'Image',src:e.currentSrc||e.src,objectFit:s.objectFit,objectPosition:s.objectPosition});
    if(e.matches('a,button,input,textarea,select,[role="button"],[role="tab"]')){
      const label=e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.getAttribute('title')||'';
      controls.push({...r,clip:{...clip},label:label.trim(),role:e.getAttribute('role')||e.tagName.toLowerCase(),href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true'});
      if(e.matches('input,textarea')&&e.type!=='radio'&&e.type!=='checkbox'){
        const value=e.value||e.placeholder||'';
        if(value)texts.push({x:r.x+p(s.paddingLeft)+1,y:e.tagName==='TEXTAREA'?r.y+p(s.paddingTop)+p(s.borderTopWidth):r.y+(r.height-p(s.fontSize)*1.2)/2,width:r.width-p(s.paddingLeft)-p(s.paddingRight)-2,height:e.tagName==='TEXTAREA'?r.height-p(s.paddingTop)-p(s.paddingBottom):p(s.fontSize)*1.2,text:value,fontSize:p(s.fontSize),fontWeight:s.fontWeight,fontFamily:s.fontFamily,lineHeight:s.lineHeight,fill:s.color,synthetic:true,multiline:e.tagName==='TEXTAREA',clip:{...clip}});
      }
    }
    for(const n of e.childNodes){
      if(n.nodeType!==3||!n.textContent.trim()||e.closest('script,style,textarea,option'))continue;
      const lines=[];
      for(const m of n.textContent.matchAll(/\S+\s*/g)){
        const range=document.createRange();range.setStart(n,m.index);range.setEnd(n,m.index+m[0].length);
        const rr=box(range.getBoundingClientRect());
        if(!intersect(rr,clip).width||!intersect(rr,clip).height)continue;
        const last=lines.at(-1);
        if(last&&Math.abs(last.y-rr.y)<1){last.text+=m[0];last.width=rr.x+rr.width-last.x;last.height=Math.max(last.height,rr.height);}
        else lines.push({...rr,text:m[0]});
      }
      for(const line of lines){
        let text=line.text.trimEnd(); if(s.textTransform==='uppercase')text=text.toUpperCase();else if(s.textTransform==='lowercase')text=text.toLowerCase();
        texts.push({...line,text,fontSize:p(s.fontSize),fontWeight:s.fontWeight,fontFamily:s.fontFamily,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,fill:s.color,clip:{...clip}});
      }
    }
  }
  for(const e of root.querySelectorAll('svg'))if(visible(e))icons.push({...box(e.getBoundingClientRect()),clip:clipFor(e),markup:e.outerHTML,color:getComputedStyle(e).color});
  return {width,height,viewportHeight,url:location.href,scrollY,overlay:dialogs.length>0,boxes,texts,images,icons,controls};
}
