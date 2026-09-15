/* Read-only capture of the complete calendar grid, including scrolled-out cells. */
() => {
  const p = value => Number.parseFloat(value) || 0;
  const intersect = (a,b) => ({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))});
  const shown = e => {
    const s=getComputedStyle(e),r=e.getBoundingClientRect();
    if(e.closest('[hidden]'))return false;
    for(let a=e.parentElement;a;a=a.parentElement){
      const style=getComputedStyle(a);
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
      if(a.tagName==='DETAILS'&&!a.open&&!a.querySelector('summary')?.contains(e))return false;
    }
    return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0;
  };
  const grid=[...document.querySelectorAll('.pl-time-grid')].find(shown);
  if(!grid)throw new Error('No visible .pl-time-grid was found.');
  const parent=grid.closest('.pl-time-scroll');
  const header=grid.querySelector('.pl-time-head');
  if(!parent||!header)throw new Error('The calendar scroll container or header is missing.');
  const gridRect=grid.getBoundingClientRect(),parentRect=parent.getBoundingClientRect();
  const width=Math.max(grid.scrollWidth,grid.clientWidth,gridRect.width);
  const height=Math.max(grid.scrollHeight,grid.clientHeight,gridRect.height);
  const headerHeight=header.getBoundingClientRect().height;
  const clip={x:0,y:0,width,height};
  const partFor=e=>e===header||header.contains(e)?'header':'body';
  const relative=(r,e)=>({x:r.x-gridRect.x,y:r.y-gridRect.y-(partFor(e)==='header'?parent.scrollTop:0),width:r.width,height:r.height});
  const visible=e=>{
    if(!shown(e))return false;
    const visibleBox=intersect(relative(e.getBoundingClientRect(),e),clip);
    return visibleBox.width>0&&visibleBox.height>0;
  };
  const boxes=[],texts=[],images=[],icons=[],controls=[];
  const elements=[grid,...grid.querySelectorAll('*')].filter(e=>!e.closest('svg')&&visible(e));
  for(const e of elements){
    const r=relative(e.getBoundingClientRect(),e),s=getComputedStyle(e),part=partFor(e);
    const background=s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.backgroundColor!=='transparent';
    if((background||s.backgroundImage!=='none'||p(s.borderTopWidth)>0)&&r.width>2&&r.height>2){
      boxes.push({...r,part,clip:{...clip},radius:p(s.borderTopLeftRadius),kind:e.tagName.toLowerCase(),borderWidth:p(s.borderTopWidth),borderColor:s.borderTopColor,background,fill:s.backgroundColor,backgroundImage:s.backgroundImage,opacity:p(s.opacity),shadow:s.boxShadow});
    }
    if(e.tagName==='IMG')images.push({...r,part,clip:{...clip},alt:e.alt||'Image',src:e.currentSrc||e.src,objectFit:s.objectFit,objectPosition:s.objectPosition});
    if(e.matches('a,button,input,textarea,select,[role="button"],[role="tab"]')){
      const label=e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||e.getAttribute('title')||'';
      controls.push({...r,part,clip:{...clip},label:label.trim(),role:e.getAttribute('role')||e.tagName.toLowerCase(),href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',inputType:e.tagName==='INPUT'?e.type:null,checked:e.tagName==='INPUT'?e.checked:null,accentColor:s.accentColor});
      if(e.matches('input,textarea')&&e.type!=='radio'&&e.type!=='checkbox'){
        const value=e.value||e.placeholder||'';
        if(value)texts.push({x:r.x+p(s.paddingLeft)+1,y:e.tagName==='TEXTAREA'?r.y+p(s.paddingTop)+p(s.borderTopWidth):r.y+(r.height-p(s.fontSize)*1.2)/2,width:r.width-p(s.paddingLeft)-p(s.paddingRight)-2,height:e.tagName==='TEXTAREA'?r.height-p(s.paddingTop)-p(s.paddingBottom):p(s.fontSize)*1.2,text:value,fontSize:p(s.fontSize),fontWeight:s.fontWeight,fontFamily:s.fontFamily,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,fill:s.color,synthetic:true,multiline:e.tagName==='TEXTAREA',part,clip:{...clip}});
      }
    }
    for(const node of e.childNodes){
      if(node.nodeType!==3||!node.textContent.trim()||e.closest('script,style,textarea,option'))continue;
      const lines=[];
      for(const match of node.textContent.matchAll(/\S+\s*/g)){
        const range=document.createRange();
        range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
        const r=relative(range.getBoundingClientRect(),e),visibleBox=intersect(r,clip);
        if(!visibleBox.width||!visibleBox.height)continue;
        const last=lines.at(-1);
        if(last&&Math.abs(last.y-r.y)<1){last.text+=match[0];last.width=r.x+r.width-last.x;last.height=Math.max(last.height,r.height);}
        else lines.push({...r,text:match[0]});
      }
      for(const line of lines){
        let text=line.text.trimEnd();
        if(s.textTransform==='uppercase')text=text.toUpperCase();else if(s.textTransform==='lowercase')text=text.toLowerCase();
        texts.push({...line,text,fontSize:p(s.fontSize),fontWeight:s.fontWeight,fontFamily:s.fontFamily,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,fill:s.color,part,clip:{...clip}});
      }
    }
  }
  for(const e of grid.querySelectorAll('svg'))if(visible(e))icons.push({...relative(e.getBoundingClientRect(),e),part:partFor(e),clip:{...clip},markup:e.outerHTML,color:getComputedStyle(e).color});
  return {width,height,viewportHeight:innerHeight,url:location.href,scrollY,overlay:false,
    sourceViewport:{width:innerWidth,height:innerHeight},
    calendarViewport:{x:parentRect.x+parent.clientLeft,y:parentRect.y+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight,scrollTop:parent.scrollTop,scrollLeft:parent.scrollLeft,headerHeight},
    boxes,texts,images,icons,controls};
}
