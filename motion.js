(() => {
  'use strict';
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Full motion is the product default; explicit saved preferences still win.
  let preference='full';
  try {preference=localStorage.getItem('so-tay-motion')||'full';} catch {}
  if(!['system','full','reduced'].includes(preference))preference='full';
  document.documentElement.dataset.motion=preference;
  const reduced={get matches(){return preference==='reduced'||preference==='system'&&systemMotion.matches;}};
  const precise = matchMedia('(hover: hover) and (pointer: fine)');
  const seen = new WeakSet();
  const active = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('motion-in');
      observer.unobserve(entry.target);
    }
  }, {threshold:.08});
  let scheduled = 0;
  function refresh() {
    scheduled = 0;
    if (reduced.matches) return;
    const targets = document.querySelectorAll('#main-content .card, #main-content .stat, #main-content .tool-card, #main-content .feature-banner, #main-content .next-session, .auth-inner, .auth-art-copy');
    let order=0;
    for (const element of targets) {
      if (seen.has(element) || element.closest('[hidden]') || element.classList.contains('quiz-card')) continue;
      seen.add(element);
      element.style.setProperty('--reveal-delay',Math.min(order++,5)*55+'ms');
      element.classList.add('motion-reveal');
      observer.observe(element);
    }
    document.querySelectorAll('.stat strong').forEach(element => {
      if (seen.has(element)) return;
      seen.add(element);
      const total=Number(element.textContent);
      if (!Number.isFinite(total) || total<=0) return;
      const started=performance.now();
      const state={element,total,frame:0};active.add(state);
      const step=now=>{
        if (!element.isConnected || reduced.matches) {element.textContent=String(total);active.delete(state);return;}
        const progress=Math.min(1,(now-started)/800);
        element.textContent=String(Math.round(total*(1-Math.pow(1-progress,3))));
        if(progress<1)state.frame=requestAnimationFrame(step);else active.delete(state);
      };
      state.frame=requestAnimationFrame(step);
    });
  }
  const mutations=new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1))&&!scheduled)scheduled=requestAnimationFrame(refresh);
  });
  mutations.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointerdown',event=>{
    if(reduced.matches)return;
    const button=event.target.closest('.button,.nav-item,.template-chip,.quiz-option,.intro-option');
    if(!button||button.disabled)return;
    const rect=button.getBoundingClientRect();const ripple=document.createElement('span');
    ripple.className='tap-ripple';ripple.setAttribute('aria-hidden','true');
    ripple.style.left=(event.clientX-rect.left)+'px';ripple.style.top=(event.clientY-rect.top)+'px';
    ripple.style.setProperty('--ripple-size',Math.max(rect.width,rect.height)*2+'px');
    button.classList.add('ripple-host');button.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
    setTimeout(()=>ripple.remove(),900);
  });
  let tiltTarget=null,tiltFrame=0,pointerX=0,pointerY=0;
  document.addEventListener('pointermove',event=>{
    if(reduced.matches||!precise.matches)return;
    const target=event.target.closest('.tool-card,.hero-art');
    if(tiltTarget!==target){tiltTarget?.style.removeProperty('transform');tiltTarget=target;}
    if(!target)return;pointerX=event.clientX;pointerY=event.clientY;
    if(!tiltFrame)tiltFrame=requestAnimationFrame(()=>{tiltFrame=0;if(!tiltTarget)return;const r=tiltTarget.getBoundingClientRect();const x=(pointerX-r.left)/r.width-.5,y=(pointerY-r.top)/r.height-.5;tiltTarget.style.transform=`perspective(900px) rotateX(${-y*5}deg) rotateY(${x*6}deg) translateY(-3px)`;});
  },{passive:true});
  document.addEventListener('pointerleave',()=>{tiltTarget?.style.removeProperty('transform');tiltTarget=null;});
  function applyPreference(){
    if(reduced.matches){observer.disconnect();document.querySelectorAll('.motion-reveal').forEach(el=>el.classList.add('motion-in'));for(const a of active){cancelAnimationFrame(a.frame);a.element.textContent=String(a.total);}active.clear();tiltTarget?.style.removeProperty('transform');}
    else refresh();
  }
  systemMotion.addEventListener('change',applyPreference);
  window.studyMotion={
    preference:()=>preference,
    setPreference(value){if(!['system','full','reduced'].includes(value))return;preference=value;document.documentElement.dataset.motion=value;try{localStorage.setItem('so-tay-motion',value);}catch{}applyPreference();},
    refresh,
    async flip(element,update){
      if(reduced.matches||!element.animate){update();return;}
      element.style.transformOrigin='50% 50%';
      try{await element.animate([{transform:'perspective(1100px) rotateY(0deg)',opacity:1},{transform:'perspective(1100px) rotateY(90deg)',opacity:.55}],{duration:160,easing:'ease-in',fill:'forwards'}).finished;}catch{}
      if(!element.isConnected)return;
      update();
      const next=document.querySelector('.flashcard');
      next?.animate([{transform:'perspective(1100px) rotateY(-90deg)',opacity:.55},{transform:'perspective(1100px) rotateY(0deg)',opacity:1}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
    },
    async turnBook(book,html,direction){
      if(!book)return;
      if(reduced.matches||!book.animate){book.innerHTML=html;return;}
      const mobile=matchMedia('(max-width: 650px)').matches;
      const oldPages=[...book.children].map(p=>p.cloneNode(true));
      const measure=document.createElement('div');measure.className='journey-book book-measure';
      measure.style.width=book.getBoundingClientRect().width+'px';measure.innerHTML=html;document.body.append(measure);
      const height=Math.max(book.getBoundingClientRect().height,measure.getBoundingClientRect().height);
      const nextPages=[...measure.children].map(p=>p.cloneNode(true));measure.remove();
      book.style.minHeight=height+'px';book.style.height=height+'px';book.classList.add('book-turning');
      book.dataset.turnDirection=direction>0?'forward':'backward';book.setAttribute('aria-busy','true');
      const sheet=document.createElement('div');sheet.className='book-turn-sheet '+(mobile?'mobile-sheet ':'')+(direction>0?'turn-forward':'turn-backward');sheet.setAttribute('aria-hidden','true');sheet.inert=true;
      const face=(nodes,back)=>{const surface=document.createElement('div');surface.className='turn-face '+(back?'turn-back':'turn-front');surface.append(...nodes.map(n=>n.cloneNode(true)));const shade=document.createElement('span');shade.className='turn-shade';surface.append(shade);return surface;};
      if(mobile){book.replaceChildren(...nextPages.map(p=>p.cloneNode(true)));sheet.append(face(oldPages,false),face(nextPages,true));}
      else if(direction>0){book.replaceChildren(oldPages[0].cloneNode(true),nextPages[1].cloneNode(true));sheet.append(face([oldPages[1]],false),face([nextPages[0]],true));}
      else{book.replaceChildren(nextPages[0].cloneNode(true),oldPages[1].cloneNode(true));sheet.append(face([oldPages[0]],false),face([nextPages[1]],true));}
      book.append(sheet);
      const angle=direction>0?-180:180,duration=mobile?620:850;
      let animation;
      try{
        sheet.querySelectorAll('.turn-shade').forEach(shade=>shade.animate([{opacity:0},{opacity:.18,offset:.5},{opacity:0}],{duration,easing:'ease-in-out'}));
        animation=sheet.animate([{transform:'rotateY(0deg)'},{transform:'rotateY('+angle+'deg)'}],{duration,easing:'cubic-bezier(.32,.05,.2,1)',fill:'forwards'});
        await animation.finished;
      }catch{}
      finally{book.replaceChildren(...nextPages);animation?.cancel();book.classList.remove('book-turning');book.removeAttribute('aria-busy');book.style.removeProperty('height');delete book.dataset.turnDirection;}
    },
    async openBook(element,update){
      if(reduced.matches||!element?.animate){update();return;}
      const from=element.getBoundingClientRect(),cover=element.cloneNode(true);update();
      const book=document.querySelector('.journey-book');if(!book)return;
      const mobile=matchMedia('(max-width: 650px)').matches,target=book.getBoundingClientRect();
      const width=mobile?target.width:target.width/2,left=mobile?target.left:target.left+width;
      cover.classList.add('opening-cover');cover.style.cssText='position:fixed;left:'+left+'px;top:'+target.top+'px;width:'+width+'px;height:'+target.height+'px;margin:0;z-index:50;transform-origin:left center;';document.body.append(cover);
      const dx=from.left-left,dy=from.top-target.top,scaleX=from.width/width,scaleY=from.height/target.height;
      let animation;
      try{
        animation=cover.animate([
          {transform:'perspective(1600px) translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotate(-5deg)',offset:0},
          {transform:'perspective(1600px) translate(0,0) scale(1) rotate(0) rotateY(0deg)',offset:.36},
          {transform:'perspective(1600px) translate(0,0) scale(1) rotate(0) rotateY(-178deg)',offset:1}
        ],{duration:950,easing:'cubic-bezier(.3,.05,.2,1)',fill:'forwards'});
        await animation.finished;
      }catch{}finally{cover.remove();animation?.cancel();}
    }
  };
  window.addEventListener('resize',()=>{document.querySelectorAll('.journey-book:not(.book-turning)').forEach(book=>book.style.removeProperty('min-height'));});
  refresh();
})();
