const $=id=>document.getElementById(id);
const canvas=$("canvas"),ctx=canvas.getContext("2d");
const APPLE_CDN="https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";
const emojiList=[
"😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","👍","👎","👏","🙌","👐","🤲","🤝","🙏","✍️","💪","👀","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟","🔥","✨","⭐","🌟","💫","💥","💯","💢","💦","💨","🎉","🎊","🎯","🏆","🥇","👑","💎","💰","💵","🚀","⚡","☀️","🌈","☁️","❄️","🌙","🍕","🍔","🍟","🎮","🎧","📱","💻","📸","🎥","🎬","🎵","🎶","🐱","🐶","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦄","🐝","🦋","🌸","🌹","🌺","🌻","🌼","🍀","🌴","🍎","🍓","🍉","🍌","🥑","🍩","🍪","🍫","⚽","🏀","🏈","🎸","🎹","🎤","🎧","🎁","🎈","💡","📌","🔔","💬","❤️‍🔥","🤍","🩷","🩵","🩶","🫠","🫣","🫢","🫡","🤯","🤠","🥸","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"
];
let layers=[
 {id:1,type:"text",name:"فيديو جديد",text:"فيديو جديد",x:600,y:325,size:150,font:"Cairo",c1:"#fff200",c2:"#ff7800",gradient:"vertical",stroke:12,strokeColor:"#111111",shadow:20,blur:6,glow:0,glowColor:"#ffd400",shine:0,depth:0,rotate:0}
];
let selected=1,nextId=2,drag=null,transform=null,history=[],future=[];

function cp(s){return [...s].map(ch=>ch.codePointAt(0).toString(16)).join("-").replace(/-fe0f/g,"-fe0f")}
function emojiURL(e){return APPLE_CDN+cp(e)+".png"}
function imgFor(e){let im=new Image();im.crossOrigin="anonymous";im.src=emojiURL(e);return im}
function selectedLayer(){return layers.find(x=>x.id===selected)}
function gradientFor(o){
 if(o.gradient==="solid")return o.c1;
 let g=o.gradient==="horizontal"?ctx.createLinearGradient(o.x-o.size,o.y,o.x+o.size,o.y):ctx.createLinearGradient(o.x,o.y-o.size,o.x,o.y+o.size);
 g.addColorStop(0,o.c1);g.addColorStop(1,o.c2);return g;
}
function textMetrics(o){
 ctx.font=`900 ${o.size}px "${o.font}"`;
 return ctx.measureText(o.text).width;
}
function drawText(o){
 ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotate*Math.PI/180);ctx.translate(-o.x,-o.y);
 ctx.font=`900 ${o.size}px "${o.font}"`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.direction="rtl";ctx.lineJoin="round";
 const t=o.text||" ";
 if(o.depth){for(let i=o.depth;i>0;i--){ctx.strokeStyle="#080808";ctx.lineWidth=o.stroke;ctx.strokeText(t,o.x+i*.7,o.y+i*.7)}}
 ctx.shadowColor="rgba(0,0,0,.84)";ctx.shadowBlur=o.blur;ctx.shadowOffsetX=o.shadow*.5;ctx.shadowOffsetY=o.shadow;
 ctx.lineWidth=o.stroke;ctx.strokeStyle=o.strokeColor;ctx.strokeText(t,o.x,o.y);
 ctx.shadowColor="transparent";ctx.fillStyle=gradientFor(o);ctx.fillText(t,o.x,o.y);
 if(o.shine){let sh=o.shine/100,g=ctx.createLinearGradient(o.x-o.size,o.y-o.size,o.x+o.size,o.y+o.size);g.addColorStop(0,`rgba(255,255,255,${sh})`);g.addColorStop(.45,"rgba(255,255,255,0)");g.addColorStop(.55,`rgba(255,255,255,${sh*.75})`);g.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=g;ctx.fillText(t,o.x,o.y)}
 if(o.glow){ctx.globalCompositeOperation="screen";ctx.shadowColor=o.glowColor;ctx.shadowBlur=o.glow;ctx.fillStyle="rgba(255,255,255,.01)";ctx.fillText(t,o.x,o.y)}
 ctx.restore();
}
function drawEmoji(o){
 if(!o.img||!o.img.complete||!o.img.naturalWidth){o.img=imgFor(o.emoji);o.img.onload=draw;return}
 ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rotate*Math.PI/180);
 const s=o.size;ctx.shadowColor="rgba(0,0,0,.8)";ctx.shadowBlur=o.shadow*.4;ctx.shadowOffsetY=o.shadow*.5;
 ctx.drawImage(o.img,-s/2,-s/2,s,s);ctx.restore();
}
function draw(){
 const W=+$("W").value||1200,H=+$("H").value||650;canvas.width=W;canvas.height=H;ctx.clearRect(0,0,W,H);
 if(!$("transparent").checked){ctx.fillStyle="#15171d";ctx.fillRect(0,0,W,H)}
 layers.forEach(o=>o.type==="text"?drawText(o):drawEmoji(o));
 drawSelection();
 renderLayers();
}
function localPoint(o,p){
  const a=-(o.rotate||0)*Math.PI/180,dx=p.x-o.x,dy=p.y-o.y;
  return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};
}
function bounds(o){
  if(o.type==="emoji") return {w:o.size,h:o.size};
  return {w:textMetrics(o)+30,h:o.size*1.3};
}
function drawSelection(){
 const o=selectedLayer();if(!o)return;
 const b=bounds(o), handle=12;
 ctx.save();ctx.translate(o.x,o.y);ctx.rotate((o.rotate||0)*Math.PI/180);
 ctx.strokeStyle="#ffb000";ctx.fillStyle="#0e1117";ctx.lineWidth=2;ctx.setLineDash([7,5]);
 ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);ctx.setLineDash([]);
 const pts=[[-b.w/2,-b.h/2],[b.w/2,-b.h/2],[b.w/2,b.h/2],[-b.w/2,b.h/2]];
 pts.forEach(([x,y])=>{ctx.fillStyle="#fff";ctx.strokeStyle="#ffb000";ctx.beginPath();ctx.arc(x,y,handle/2,0,Math.PI*2);ctx.fill();ctx.stroke()});
 // rotate handle
 ctx.beginPath();ctx.moveTo(0,-b.h/2);ctx.lineTo(0,-b.h/2-34);ctx.stroke();
 ctx.fillStyle="#ffb000";ctx.beginPath();ctx.arc(0,-b.h/2-40,7,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
function hitHandle(p,o){
 const b=bounds(o), lp=localPoint(o,p), h=18;
 const corners={
   nw:{x:-b.w/2,y:-b.h/2},ne:{x:b.w/2,y:-b.h/2},
   se:{x:b.w/2,y:b.h/2},sw:{x:-b.w/2,y:b.h/2}
 };
 for(const [k,c] of Object.entries(corners))
   if(Math.hypot(lp.x-c.x,lp.y-c.y)<h)return k;
 if(Math.hypot(lp.x,lp.y+(b.h/2+40))<18)return "rotate";
 return null;
}
function snapshot(){history.push(JSON.stringify({layers,selected}));if(history.length>50)history.shift();future=[]}
function restore(s){let a=JSON.parse(s);layers=a.layers;selected=a.selected;layers.forEach(o=>{if(o.type==="emoji")o.img=imgFor(o.emoji)});syncPanel();draw()}
function addText(){
 const o={id:nextId++,type:"text",name:"نص جديد",text:"نص جديد",x:600,y:325,size:120,font:"Cairo",c1:"#ffffff",c2:"#ffffff",gradient:"solid",stroke:10,strokeColor:"#111111",shadow:15,blur:5,glow:0,glowColor:"#ffd400",shine:0,depth:0,rotate:0};
 layers.push(o);selected=o.id;snapshot();syncPanel();draw();
}
function addEmoji(e){
 const o={id:nextId++,type:"emoji",name:e,emoji:e,x:600,y:325,size:170,shadow:12,blur:3,rotate:0,img:imgFor(e)};
 layers.push(o);selected=o.id;snapshot();syncPanel();draw();
}
function syncPanel(){
 const o=selectedLayer();if(!o)return;
 if(o.type==="text"){
  $("text").value=o.text;$("font").value=o.font;$("size").value=o.size;$("rotate").value=o.rotate;$("c1").value=o.c1;$("c2").value=o.c2;$("gradient").value=o.gradient;
  $("stroke").value=o.stroke;$("strokeColor").value=o.strokeColor;$("shadow").value=o.shadow;$("blur").value=o.blur;$("glow").value=o.glow;$("glowColor").value=o.glowColor;$("shine").value=o.shine;$("depth").value=o.depth;
 } else {$("text").value=o.emoji;$("size").value=o.size;$("rotate").value=o.rotate;$("shadow").value=o.shadow;$("blur").value=o.blur}
 ["size","rotate","stroke","shadow","blur","glow","shine","depth"].forEach(id=>{let e=$(id),out=$(id+"Out");if(e&&out)out.textContent=id==="rotate"?e.value+"°":e.value})
}
function renderLayers(){
 const box=$("layerList");box.innerHTML="";
 [...layers].reverse().forEach(o=>{let d=document.createElement("div");d.className="layer"+(o.id===selected?" selected":"");d.innerHTML=`<span>${o.type==="emoji"?"😀":"T"} ${escapeHtml(o.name)}</span><small>${o.type==="emoji"?"Emoji":"نص"}</small>`;d.onclick=()=>{selected=o.id;syncPanel();draw()};box.appendChild(d)})
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function moveLayer(dir){
 let i=layers.findIndex(o=>o.id===selected);if(i<0)return;
 let j=i+dir;if(j<0||j>=layers.length)return;[layers[i],layers[j]]=[layers[j],layers[i]];snapshot();draw();
}
function moveExtreme(top){let o=layers.find(x=>x.id===selected);layers=layers.filter(x=>x!==o);top?layers.push(o):layers.unshift(o);snapshot();draw()}
function pos(e){let r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function hit(p){
 for(let i=layers.length-1;i>=0;i--){let o=layers[i];
  if(o.type==="emoji"){if(Math.abs(p.x-o.x)<=o.size/2&&Math.abs(p.y-o.y)<=o.size/2)return o}
  else {let w=textMetrics(o)+25,h=o.size*1.3;if(Math.abs(p.x-o.x)<=w/2&&Math.abs(p.y-o.y)<=h/2)return o}
 }return null
}
canvas.addEventListener("pointerdown",e=>{
 let p=pos(e),o=selectedLayer();
 if(o){
   const h=hitHandle(p,o);
   if(h){ transform={type:h,o,start:{x:p.x,y:p.y},startSize:o.size,startRotate:o.rotate||0,startDist:Math.hypot(p.x-o.x,p.y-o.y),startAngle:Math.atan2(p.y-o.y,p.x-o.x),startW:bounds(o).w,startH:bounds(o).h};canvas.setPointerCapture(e.pointerId);return;}
 }
 o=hit(p);
 if(o){selected=o.id;drag={o,px:p.x,py:p.y};syncPanel();draw();canvas.setPointerCapture(e.pointerId)}
});
canvas.addEventListener("pointermove",e=>{
 let p=pos(e);
 if(transform){
   const o=transform.o;
   if(transform.type==="rotate"){
     let ang=Math.atan2(p.y-o.y,p.x-o.x);
     let deg=(ang-transform.startAngle)*180/Math.PI+transform.startRotate;
     while(deg>180)deg-=360;while(deg<-180)deg+=360;
     o.rotate=Math.round(deg);
   }else{
     const dist=Math.hypot(p.x-o.x,p.y-o.y);
     let ratio=dist/Math.max(1,transform.startDist);
     if(transform.type==="nw"||transform.type==="ne"||transform.type==="se"||transform.type==="sw")
       o.size=Math.max(25,Math.min(500,Math.round(transform.startSize*ratio)));
   }
   syncPanel();draw();return;
 }
 if(drag){drag.o.x+=p.x-drag.px;drag.o.y+=p.y-drag.py;drag.px=p.x;drag.py=p.y;draw()}
});
canvas.addEventListener("pointerup",()=>{
 if(transform){snapshot();transform=null;return}
 if(drag){snapshot();drag=null}
});
function bind(id,prop,parse=v=>v){
 const e=$(id);e.addEventListener("input",()=>{let o=selectedLayer();if(!o)return;o[prop]=parse(e.value);if(o.type==="emoji"&&prop==="size"){};draw();let out=$(id+"Out");if(out)out.textContent=id==="rotate"?e.value+"°":e.value});
 e.addEventListener("change",snapshot);
}
$("text").oninput=()=>{let o=selectedLayer();if(o&&o.type==="text"){o.text=$("text").value;o.name=o.text||"نص";draw();renderLayers()}};
["font","gradient","c1","c2","strokeColor","glowColor"].forEach(id=>$(id).oninput=()=>{let o=selectedLayer();if(!o||o.type!=="text")return;o[id]= $(id).value;draw()});
bind("size","size",Number);bind("rotate","rotate",Number);bind("stroke","stroke",Number);bind("shadow","shadow",Number);bind("blur","blur",Number);bind("glow","glow",Number);bind("shine","shine",Number);bind("depth","depth",Number);
$("addText").onclick=addText;
$("delete").onclick=()=>{if(layers.length<=1)return;layers=layers.filter(o=>o.id!==selected);selected=layers.at(-1).id;snapshot();syncPanel();draw()};
$("center").onclick=()=>{let o=selectedLayer();if(o){o.x=canvas.width/2;o.y=canvas.height/2;snapshot();draw()}};
$("reset").onclick=()=>{let o=selectedLayer();if(o){o.x=canvas.width/2;o.y=canvas.height/2;o.rotate=0;snapshot();syncPanel();draw()}};
$("up").onclick=()=>moveLayer(1);$("down").onclick=()=>moveLayer(-1);$("top").onclick=()=>moveExtreme(true);$("bottom").onclick=()=>moveExtreme(false);
$("download").onclick=async()=>{draw();await new Promise(r=>setTimeout(r,250));ctx.save();if(selectedLayer()){};drawWithoutSelection();let a=document.createElement("a");a.download="arabic-text.png";a.href=canvas.toDataURL("image/png");a.click();ctx.restore();draw()};
function drawWithoutSelection(){const o=selected;selected=null;draw();selected=o}
$("undo").onclick=()=>{if(history.length>1){future.push(history.pop());restore(history.at(-1))}};
$("redo").onclick=()=>{if(future.length){let s=future.pop();history.push(s);restore(s)}};
$("transparent").oninput=draw;$("W").oninput=draw;$("H").oninput=draw;
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab,.tabcontent").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active")});
document.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{let o=selectedLayer();if(!o||o.type!=="text")return;let p={youtube:["#fff200","#ff7600",12,20,6,0,8],gold:["#fff6a0","#e8a900",10,14,4,5,10],ice:["#ffffff","#48c9ff",10,10,5,8,4],neon:["#ff65df","#6c5cff",8,5,12,30,0],comic:["#ffea00","#ff3d00",18,25,3,0,12]}[b.dataset.preset];[o.c1,o.c2,o.stroke,o.shadow,o.blur,o.glow,o.depth]=p;syncPanel();snapshot();draw()});
function renderEmojiGrid(filter=""){
 const grid=$("emojiGrid");grid.innerHTML="";
 emojiList.filter(e=>!filter||e.includes(filter)).forEach(e=>{let b=document.createElement("button"),im=imgFor(e);im.alt=e;im.loading="lazy";b.appendChild(im);b.title=e;b.onclick=()=>addEmoji(e);grid.appendChild(b)})
}
$("emojiSearch").oninput=e=>renderEmojiGrid(e.target.value);
renderEmojiGrid();snapshot();syncPanel();draw();

canvas.addEventListener("pointermove",e=>{
 if(drag||transform)return;
 const p=pos(e),o=selectedLayer();
 if(o){
   const h=hitHandle(p,o);
   canvas.style.cursor=h==="rotate"?"crosshair":h?"nwse-resize":hit(p)?"move":"default";
 } else canvas.style.cursor="default";
});
