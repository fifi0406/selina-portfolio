/* Coordinates follow the approved illustration; actor positions are measured at their feet. */
const AtlasGeometry = (() => {
  const W = 1897, H = 829, CELL = 20;
  const island = [[150,375],[95,300],[165,230],[330,160],[360,95],[550,45],[690,85],[820,20],[920,60],[1000,30],[1200,25],[1360,80],[1450,110],[1540,145],[1560,250],[1660,305],[1750,300],[1810,360],[1790,465],[1860,560],[1850,680],[1700,720],[1620,780],[1400,790],[1250,800],[1100,795],[980,760],[850,735],[760,780],[610,750],[500,790],[360,760],[220,720],[180,650],[80,605],[45,540],[60,470]];
  const river = [[920,450],[1140,430],[1370,440],[1350,470],[1570,477],[1760,490],[1870,560],[1850,585],[1710,545],[1440,545],[1270,520],[1230,490],[925,480]];
  const bases = [[312,388,135,24],[830,445,215,25],[1200,758,210,24]];
  function inside(x, y, points) {
    let yes = false;
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const [xi,yi]=points[i], [xj,yj]=points[j];
      if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) yes=!yes;
    }
    return yes;
  }
  function walkable(x,y) {
    if (!Number.isFinite(x)||!Number.isFinite(y)||x<150||x>W-150||y<270||y>H-20) return false;
    return [[0,0],[-22,0],[22,0],[0,12],[0,-12]].every(([dx,dy])=>inside(x+dx,y+dy,island)&&!inside(x+dx,y+dy,river)) && !bases.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
  }
  const cols=Math.ceil(W/CELL), rows=Math.ceil(H/CELL), nodes=[];
  const grid=new Map();
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
    const x=c*CELL+CELL/2, y=r*CELL+CELL/2;
    if(walkable(x,y)){const node={x,y,id:r*cols+c,c,r};nodes.push(node);grid.set(node.id,node);}
  }
  function nearest(x,y) {
    let best=nodes[0],d=Infinity;
    for(const node of nodes){const distance=(node.x-x)**2+(node.y-y)**2;if(distance<d){d=distance;best=node;}}
    return best;
  }
  function clearSegment(a,b) {
    const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5);
    for(let i=1;i<=n;i++)if(!walkable(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;
    return true;
  }
  function route(from,to) {
    if(!Number.isFinite(to.x)||!Number.isFinite(to.y))return [];
    const start=nearest(from.x,from.y), goal=nearest(to.x,to.y);
    const queue=[start],parents=new Map([[start.id,null]]);
    for(let q=0;q<queue.length && !parents.has(goal.id);q++) {
      const cur=queue[q];
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
        const next=grid.get((cur.r+dr)*cols+cur.c+dc);
        if(!next||Math.abs(next.c-cur.c)>1||parents.has(next.id)||!clearSegment(cur,next))continue;
        parents.set(next.id,cur.id);queue.push(next);
      }
    }
    if(!parents.has(goal.id))return [];
    const path=[];for(let id=goal.id;id!==null;id=parents.get(id))path.push(grid.get(id));path.reverse();
    // Only skip waypoints when every point on the resulting segment stays on land.
    const simple=[];let anchor=from,index=0;
    while(index<path.length){let last=index;while(last+1<path.length&&clearSegment(anchor,path[last+1]))last++;if(!clearSegment(anchor,path[last]))return [];simple.push(path[last]);anchor=path[last];index=last+1;}
    return simple;
  }
  return {W,H,walkable,route,clearSegment,nearest};
})();
if (typeof module !== 'undefined') module.exports=AtlasGeometry;
if (typeof document !== 'undefined') (() => {
  'use strict';
  const map=document.getElementById('travelMap'),actor=document.getElementById('traveler');
  if(!map||!actor)return;
  const {W,H,walkable,route}=AtlasGeometry;
  const marker=map.querySelector('.atlas-destination'),status=document.getElementById('atlasStatus');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const start={x:610,y:670};let pos={...start},path=[],keys=new Set(),held=null,frame=0,last=0,facing=1,turnUntil=0,turnStart=0,nextFacing=1,flipped=false;
  const vectors={ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0],ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1]};
  const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
  function render(){actor.style.left=pos.x/W*100+'%';actor.style.top=pos.y/H*100+'%';actor.style.zIndex=String(Math.round(pos.y/H*100));actor.dataset.x=pos.x.toFixed(1);actor.dataset.y=pos.y.toFixed(1);}
  function wake(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
  function clearTarget(){path=[];marker.classList.remove('visible');}
  function stop(){keys.clear();held=null;clearTarget();turnUntil=0;actor.classList.remove('is-turning','is-walking');if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
  function tick(now){
    frame=0;const dt=last?Math.min((now-last)/1000,.04):0;last=now;
    let dx=0,dy=0;
    for(const key of keys){const v=vectors[key];if(v){dx+=v[0];dy+=v[1];}}
    if(held){dx+=directions[held][0];dy+=directions[held][1];}
    const manual=!!(dx||dy);
    if(!manual && path.length){dx=path[0].x-pos.x;dy=path[0].y-pos.y;}
    const length=Math.hypot(dx,dy);let moved=false;
    if(length>.01){
      const desired=Math.abs(dx)>.1?(dx<0?-1:1):facing;
      if(!turnUntil&&desired!==facing){
        if(reduced.matches){facing=desired;actor.style.setProperty('--facing',facing);}
        else{nextFacing=desired;turnStart=now;turnUntil=now+260;flipped=false;actor.classList.add('is-turning');}
      }
      if(turnUntil){
        if(!flipped&&now-turnStart>=130){facing=nextFacing;actor.style.setProperty('--facing',facing);flipped=true;}
        if(now>=turnUntil){facing=nextFacing;actor.style.setProperty('--facing',facing);turnUntil=0;actor.classList.remove('is-turning');}
      }else{
        const amount=manual?170*dt:Math.min(length,170*dt),nx=pos.x+dx/length*amount,ny=pos.y+dy/length*amount;
        if(walkable(nx,ny)){pos={x:nx,y:ny};moved=amount>0;}
        else if(manual){if(walkable(nx,pos.y)){pos.x=nx;moved=true;}if(walkable(pos.x,ny)){pos.y=ny;moved=true;}}
        else clearTarget();
        if(!manual&&path.length&&Math.hypot(path[0].x-pos.x,path[0].y-pos.y)<1){path.shift();if(!path.length){marker.classList.remove('visible');status.textContent='You’ve arrived. Choose a landmark to explore.';}}
      }
    }else if(path.length)path.shift();
    // Finish an interrupted turn even if a key is released during the turn.
    if(turnUntil&&!length){facing=nextFacing;actor.style.setProperty('--facing',facing);turnUntil=0;actor.classList.remove('is-turning');}
    actor.classList.toggle('is-walking',moved);render();
    if(keys.size||held||path.length||turnUntil)frame=requestAnimationFrame(tick);else last=0;
  }
  map.addEventListener('click',event=>{
    if(event.target.closest('a,button'))return;
    map.focus({preventScroll:true});const box=map.getBoundingClientRect();
    const target={x:(event.clientX-box.left)/box.width*W,y:(event.clientY-box.top)/box.height*H};
    keys.clear();held=null;path=route(pos,target);
    if(path.length){const end=path[path.length-1];marker.style.left=end.x/W*100+'%';marker.style.top=end.y/H*100+'%';marker.classList.add('visible');status.textContent='Walking to the nearest reachable spot.';wake();}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){stop();return;}
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"],nav,a'))return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(vectors[key]){event.preventDefault();clearTarget();keys.add(key);wake();}
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
  document.querySelectorAll('[data-direction]').forEach(button=>{
    button.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();clearTarget();keys.clear();held=button.dataset.direction;button.setPointerCapture(event.pointerId);wake();});
    const release=()=>{if(held===button.dataset.direction)held=null;};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',event=>{if(event.detail!==0)return;const [dx,dy]=directions[button.dataset.direction];path=route(pos,{x:pos.x+dx*60,y:pos.y+dy*60});wake();});
  });
  document.getElementById('resetWalk').addEventListener('click',()=>{stop();pos={...start};facing=1;actor.style.setProperty('--facing',1);render();status.textContent='Back at the start of the trail.';});
  window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  const menu=document.querySelector('.menu'),nav=document.querySelector('.nav');
  function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');menu.textContent='☰';}
  menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');menu.textContent=open?'×':'☰';});
  nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){closeMenu();menu.focus();}});
  map.querySelectorAll('img').forEach(img=>{const fail=()=>{document.getElementById('atlasError').hidden=false;};img.addEventListener('error',fail);if(img.complete&&!img.naturalWidth)fail();});
  render();
})();
