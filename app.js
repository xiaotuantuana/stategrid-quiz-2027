'use strict';
const DATA = /*__PAYLOAD__*/;
const ALL=DATA.questions, MAP=new Map(ALL.map(q=>[q.id,q])), TOPICS=DATA.topics, SOURCES=DATA.sources;
const STORE='stategrid_othereng_2027_v2';
const app=document.getElementById('app');
let state={done:{},fav:{},pos:{},exam:null};
try { const s=JSON.parse(localStorage.getItem(STORE)); if(s&&typeof s==='object') state={...state,...s}; } catch(e){}
for(const k of ['done','fav','pos']) if(!state[k]||typeof state[k]!=='object'||Array.isArray(state[k]))state[k]={};
let view='home',list=[],index=0,selected=[],revealed=false,mode='drill',listKey='',searchTerm='',result=null;
let autoNextTimer=null;
function cancelAutoNext(){clearTimeout(autoNextTimer);autoNextTimer=null;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceName=q=>SOURCES[q.source]?.title||q.source;
const answer=q=>Array.isArray(q.a)?q.a:[q.a];
const correct=(q,a)=>JSON.stringify(answer(q).slice().sort((x,y)=>x-y))===JSON.stringify(a.slice().sort((x,y)=>x-y));
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){document.getElementById('storage-note').textContent='浏览器无法保存进度，请导出备份。';}}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
/* OPTION_ORDER_BEGIN */
// Stored answers always use source indices; only the on-screen positions change.
const optionOrders=new Map();
function optionShuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function assignOptionOrders(qs){
 const groups=new Map();
 for(const q of qs){
  if(q.t==='判断'){optionOrders.set(q.id,q.o.map((_,i)=>i));continue;}
  if(Array.isArray(q.a)){optionOrders.set(q.id,optionShuffle(q.o.map((_,i)=>i)));continue;}
  const n=q.o.length;if(!groups.has(n))groups.set(n,[]);groups.get(n).push(q);
 }
 for(const [n,group] of groups){
  const remainder=optionShuffle(Array.from({length:n},(_,i)=>i));
  const positions=optionShuffle(Array.from({length:group.length},(_,i)=>remainder[i%n]));
  group.forEach((q,i)=>{const order=optionShuffle(q.o.map((_,j)=>j).filter(j=>j!==q.a));order.splice(positions[i],0,q.a);optionOrders.set(q.id,order);});
 }
}
function optionOrder(q){if(!optionOrders.has(q.id))assignOptionOrders([q]);return optionOrders.get(q.id);}
function displayLetter(q,i){return String.fromCharCode(65+optionOrder(q).indexOf(i));}
function optionText(q,i){
 // This legacy option explicitly refers to other choices, unlike matrix/event A,B.
 if(q.id==='old_jimi_dg151'&&i===3)return displayLetter(q,1)+'和'+displayLetter(q,2);
 return q.o[i];
}
function displayExplanation(q,text){
 return String(text??'').replace(/((?:参考|标准|正确)答案[：:]\s*)([A-F](?:[、,，\s]+[A-F])*)(?=[。.;；]|$)/g,(_,prefix,letters)=>prefix+letters.match(/[A-F]/g).map(c=>displayLetter(q,c.charCodeAt(0)-65)).sort().join('、'));
}
/* OPTION_ORDER_END */
assignOptionOrders(ALL);
function btn(text,action,extra=''){return `<button ${extra} onclick="${action}">${text}</button>`;}
function go(v){
 cancelAutoNext();
 view=v;clearInterval(window.quizTimer);
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
 if(v==='home')home();if(v==='practice')setup();if(v==='search')searchView();if(v==='exam')examSetup();if(v==='coverage')coverage();if(v==='sources')sourcesView();
 if(v==='wrong')start(ALL.filter(q=>state.done[q.id]&&!state.done[q.id].correct),'wrong');
 if(v==='fav')start(ALL.filter(q=>state.fav[q.id]),'fav');
 window.scrollTo(0,0);
}
function home(){
 const d=ALL.filter(q=>state.done[q.id]),c=d.filter(q=>state.done[q.id].correct).length;
 app.innerHTML=`<section class="hero"><div class="eyebrow">2027 · 其他工学类</div><h2>按新考纲，把时间用在考点上。</h2><p>新增工程力学；补充电工测量、回归分析与人工智能数学基础。每题可查考点和来源。</p><div class="stats"><div><b>${ALL.length}</b><span>可练题目（含参数变式）</span></div><div><b>832</b><span>2027 官方参考题</span></div><div><b>${DATA.summary.practice_families}</b><span>新增原创题型 / 设问</span></div><div><b>40</b><span>考纲条目均有对应练习</span></div></div></section>
 <section><h2>继续学习</h2><p class="muted">答对自动下一题；答错显示解析，手动点击下一题。</p>${state.retiredExam?'<p class="notice">题库已精简，含已移除题目的旧练习卷已归档；其他学习记录保留，归档内容可随进度备份导出。</p>':''}<p>已做 ${d.length} 题 · 正确 ${c} 题 · 正确率 ${d.length?Math.round(c/d.length*100):0}%</p><div class="actions">${btn('按考纲练习',"go('practice')",'class="primary"')}${btn('新版官方题',"start(ALL.filter(q=>q.source==='sgcc2027'),'official')")}${btn('工程力学专项',"start(ALL.filter(q=>q.subject==='mechanics'),'mechanics')")}${btn('查看考纲变化',"go('coverage')")}</div>${state.exam?'<p><button onclick="resumeExam()">继续 / 查看上次练习卷</button></p>':''}</section>
 <section><h2>选择科目</h2><div class="grid">${Object.entries(DATA.subjects).map(([k,n])=>`<button class="subject" onclick="start(ALL.filter(q=>q.subject==='${k}'),'${k}')"><strong>${n}</strong><span>${ALL.filter(q=>q.subject===k).length} 题</span></button>`).join('')}</div></section>
 <section class="notice"><h3>题目构成</h3><p>官方参考题 ${DATA.summary.official} 题；旧库筛后保留 ${DATA.summary.legacy} 题（答案未逐题复核）；联网题源中文改编 ${DATA.summary.web||0} 个小问；原创概念题 ${DATA.summary.concepts} 题；原创计算题 ${DATA.summary.numeric||0} 题（同一题型仅保留一个代表题）。已移除仅替换数字的重复题 ${DATA.summary.removed_repetitions||0} 道。公开课程题与原创练习均不标作国网真题。</p><div class="actions">${btn('本轮联网新题',"start(ALL.filter(q=>q.origin==='联网题源·中文改编'),'web-round2')")}</div><p><a href="本轮联网补充.html">本轮新增题目与出处</a> · 超纲、过期及图文不完整旧题 ${DATA.summary.excluded} 题已移出新版，原版仍保存。查看 <a href="升级报告.html">升级报告与筛选规则</a>。</p></section>`;
}
function topicOptions(){return '<option value="">全部考点</option>'+Object.entries(TOPICS).map(([k,v])=>`<option value="${k}">${k} · ${esc(v)}</option>`).join('');}
function setup(){
 app.innerHTML=`<section><h2>按考纲练习</h2><div class="formgrid"><label>科目<select id="subject"><option value="">全部科目</option>${Object.entries(DATA.subjects).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>考点<select id="topic">${topicOptions()}</select></label><label>来源类型<select id="origin"><option value="">全部</option><option>2027官方参考题</option><option>旧库迁移·未逐题复核</option><option>联网题源·中文改编</option><option>原创考点练习</option><option>原创计算题</option></select></label><label>顺序<select id="order"><option value="seq">顺序（记忆位置）</option><option value="random">随机</option></select></label></div><label class="check"><input id="onefamily" type="checkbox">每个计算题型只抽一道变式</label><div class="actions">${btn('开始练习',"filteredStart()",'class="primary"')}</div></section>
 <section><h3>优先复习新增与调整考点</h3><div class="grid">${['P06','P07','P08','P09','P10','P21','P33','P34'].map(k=>`<button onclick="start(ALL.filter(q=>q.topic==='${k}'),'${k}')">${k} · ${esc(TOPICS[k])}</button>`).join('')}</div></section>`;
}
function singleFamilies(qs){const g=new Map();for(const q of shuffle(qs)){const key=q.family||q.id;if(!g.has(key))g.set(key,q);}return [...g.values()];}
function filteredStart(){
 const subject=document.getElementById('subject').value,topic=document.getElementById('topic').value,origin=document.getElementById('origin').value,random=document.getElementById('order').value==='random',one=document.getElementById('onefamily').checked;
 let qs=ALL.filter(q=>(!subject||q.subject===subject)&&(!topic||q.topic===topic)&&(!origin||q.origin===origin));
 if(one)qs=singleFamilies(qs);if(random)qs=shuffle(qs);start(qs,['filter',subject,topic,origin,one,random].join('_'),!random&&!one);
}
function start(qs,key,remember=true){
 cancelAutoNext();
 assignOptionOrders(qs);
 list=qs;listKey=remember?key:'';mode='drill';index=remember?Math.min(state.pos[key]||0,Math.max(qs.length-1,0)):0;selected=[];revealed=false;
 if(!qs.length){app.innerHTML='<section><h2>暂无题目</h2><p>这个筛选条件下没有题目。可以返回选择其他考点。</p><button onclick="go(\'practice\')">返回练习</button></section>';return;}
 renderQuestion();
}
function current(){return list[index];}
function provenance(q){
 const s=SOURCES[q.source]||{};const link=s.url&&/^https?:\/\//.test(s.url)?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title||q.source);
 return `<details class="provenance"><summary>考点与来源 · ${esc(q.origin)}</summary><p>${q.topic} · ${esc(TOPICS[q.topic])}</p><p>${link}</p><p>${esc(q.locator)} · 题目ID ${esc(q.id)}</p>${q.family?`<p>题型：${esc(q.family)}${q.origin==='原创计算题'?'（同题型的其他数值为变式）':''}</p>`:''}<p>${esc(q.review)}</p>${q.license?`<p>${esc(q.attribution)} <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">${esc(q.license)}</a></p>`:''}</details>`;
}
function renderQuestion(){
 const q=current();if(!q)return;
 if(mode==='drill'&&listKey){state.pos[listKey]=index;save();}
 if(mode==='exam')selected=state.exam.answers[q.id]||[];
 const a=answer(q),done=state.done[q.id];
 app.innerHTML=`<section><div class="questiontop"><span>${mode==='exam'?'练习卷':'章节练习'} · ${index+1} / ${list.length}${q.t==='判断'?'':' · 选项随机排列'}</span><span>${esc(q.t)} ${state.fav[q.id]?' · 已收藏':''}</span>${mode==='exam'?'<strong id="timer"></strong>':''}</div><div class="progress"><i style="width:${100*(index+1)/list.length}%"></i></div><div class="topic">${q.topic} · ${esc(TOPICS[q.topic])}</div><h2 class="stem">${esc(q.q)}</h2>${q.figure&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(q.figure)?`<figure class="sourcefigure"><img src="${q.figure}" alt="来源题目原图"><figcaption>${esc(q.figure_caption)}（原图字母为来源编号，请按下方随机选项作答。）</figcaption></figure>`:""}<div class="options">${optionOrder(q).map((i,d)=>`<button class="option ${selected.includes(i)?'selected':''} ${revealed?(a.includes(i)?'right':selected.includes(i)?'incorrect':''):''}" onclick="choose(${i})" ${revealed?'disabled':''}><b>${String.fromCharCode(65+d)}</b><span>${esc(optionText(q,i))}</span></button>`).join('')}</div>${revealed?`<div class="explanation"><h3>${correct(q,selected)?'回答正确':'回答有误'} · 正确答案 ${a.map(i=>displayLetter(q,i)).sort().join('、')}</h3><p>${esc(displayExplanation(q,q.e))}</p></div>`:''}
 <div class="actions">${mode==='drill'&&!revealed?btn('确认答案','checkAnswer()','class="primary"'):''}${btn(state.fav[q.id]?'取消收藏':'收藏','favorite()')}${btn('上一题','move(-1)',index===0?'disabled':'')}${btn(index===list.length-1?'本组结束':'下一题','move(1)')}${mode==='exam'?btn('交卷','finishExam()','class="primary"'):btn('返回总览',"go('home')")}</div>${mode==='drill'&&done?`<p class="muted">上次记录：${done.correct?'正确':'错误'}</p>`:''}${provenance(q)}</section>
 <section><h3>题号导航</h3><div class="qnav">${list.map((x,i)=>`<button title="${esc(x.topic)} · ${esc(x.id)}" class="${i===index?'current':''} ${mode==='exam'?(state.exam.answers[x.id]?.length?'answered':''):(state.done[x.id]?(state.done[x.id].correct?'right':'incorrect'):'')}" onclick="jump(${i})">${i+1}</button>`).join('')}</div></section>`;
 if(mode==='exam')tick();
}
function choose(i){
 if(revealed)return;const q=current();selected=Array.isArray(q.a)?(selected.includes(i)?selected.filter(x=>x!==i):selected.concat(i)):[i];
 if(mode==='exam'){state.exam.answers[q.id]=selected;save();}renderQuestion();
}
function checkAnswer(){if(revealed)return;if(!selected.length){alert('请先选择答案。');return;}revealed=true;const q=current(),passed=correct(q,selected);state.done[q.id]={correct:passed,answers:selected.slice(),at:new Date().toISOString()};save();renderQuestion();if(passed&&mode==='drill'){const id=q.id;autoNextTimer=setTimeout(()=>{autoNextTimer=null;if(mode==='drill'&&revealed&&current()?.id===id)move(1);},350);}}
function favorite(){const id=current().id;if(state.fav[id])delete state.fav[id];else state.fav[id]=true;save();renderQuestion();}
function jump(i){cancelAutoNext();index=i;revealed=false;selected=[];renderQuestion();}
function move(step){const next=index+step;if(next<0)return;if(next>=list.length){if(mode==='exam'){finishExam();return;}go('home');return;}jump(next);}
function searchView(){app.innerHTML=`<section><h2>搜索题目</h2><label>题干 / 选项 / 考点 / 解析<input id="query" value="${esc(searchTerm)}" placeholder="例如：力矩、回归、P21" oninput="runSearch()"></label><div id="results"></div></section>`;runSearch();}
function runSearch(){const el=document.getElementById('query');searchTerm=el.value.trim();const needle=searchTerm.toLowerCase();const found=needle?ALL.filter(q=>(q.q+q.o.join(' ')+q.e+q.topic+TOPICS[q.topic]).toLowerCase().includes(needle)):[];document.getElementById('results').innerHTML=`<p>${needle?'找到 '+found.length+' 题，展示前100题':'输入关键词开始检索'}</p>`+found.slice(0,100).map(q=>`<button class="searchresult" onclick="openId('${q.id}')"><b>${q.topic}</b> ${esc(q.q)}<small>${esc(q.origin)}</small></button>`).join('');}
function openId(id){start([MAP.get(id)],'search',false);}
function examSetup(){
 app.innerHTML=`<section><h2>综合练习卷</h2><p>公共40题 + 专业125题，限时180分钟；按公共20%、专业80%分别归一计分。未作答计零分。同一计算题型每卷最多一道。</p><p class="notice">这是沿用原工具题量的练习配置，考纲只明确20%/80%板块权重。专业内部暂按计算机20、工程力学35、电工35、数学35题练习，不代表官方内部占比或正式命题方案。默认不从未逐题复核的旧库抽题。</p><div class="actions">${btn('开始限时卷','startExam(false)','class="primary"')}${btn('开始不限时卷','startExam(true)')}${state.exam?btn(state.exam.finished?'查看上次结果':'继续上次练习卷','resumeExam()'):''}</div></section>`;
}
function pickFamilies(pool,n){const a=singleFamilies(pool);if(a.length<n)throw new Error('可用独立题型不足');return shuffle(a).slice(0,n);}
function buildPaper(){
 const p=pickFamilies(ALL.filter(q=>q.source==='sgcc2027'),40);
 for(const [s,n] of [['cs',20],['mechanics',35],['electro',35],['math',35]])p.push(...pickFamilies(ALL.filter(q=>q.subject===s&&q.source!=='legacy'),n));
 return shuffle(p);
}
function startExam(untimed){if(state.exam&&!state.exam.finished&&!confirm('新建练习卷会替换尚未交卷的卷子，继续吗？'))return;let p;try{p=buildPaper();}catch(e){alert(e.message);return;}state.exam={ids:p.map(q=>q.id),answers:{},start:Date.now(),untimed,finished:false};save();resumeExam();}
function resumeExam(){const e=state.exam;if(!e){go('exam');return;}if(!Array.isArray(e.ids)||e.ids.some(id=>!MAP.has(id))){alert('该卷包含当前题库没有的题目，无法继续；请导出记录后重新组卷。');return;}cancelAutoNext();list=e.ids.map(id=>MAP.get(id));assignOptionOrders(list);index=0;mode='exam';revealed=false;selected=[];if(e.finished){showResult();return;}renderQuestion();clearInterval(window.quizTimer);if(!e.untimed)window.quizTimer=setInterval(tick,1000);}
function tick(){const e=state.exam,el=document.getElementById('timer');if(!e||e.finished)return;if(e.untimed){if(el)el.textContent='不限时';return;}const left=10800-Math.floor((Date.now()-e.start)/1000);if(left<=0){finishExam(true);return;}if(el)el.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');}
function scorePaper(qs,answers){const g={public:{n:0,correct:0},professional:{n:0,correct:0}};let answered=0;for(const q of qs){const a=answers[q.id]||[];const x=g[q.subject==='public'?'public':'professional'];x.n++;if(a.length)answered++;if(correct(q,a))x.correct++;}return {groups:g,answered,score:(g.public.n?20*g.public.correct/g.public.n:0)+(g.professional.n?80*g.professional.correct/g.professional.n:0)};}
function finishExam(auto=false){if(state.exam.finished){showResult();return;}if(!auto&&!confirm('确定交卷？未作答的题目将计零分。'))return;state.exam.finished=true;state.exam.finishedAt=Date.now();for(const q of list){const a=state.exam.answers[q.id]||[];state.done[q.id]={correct:correct(q,a),answers:a,at:new Date().toISOString()};}save();clearInterval(window.quizTimer);showResult();}
function showResult(){list=state.exam.ids.map(id=>MAP.get(id));result=scorePaper(list,state.exam.answers);const g=result.groups,w=list.filter(q=>!correct(q,state.exam.answers[q.id]||[]));app.innerHTML=`<section><h2>练习卷成绩 ${result.score.toFixed(2)} / 100</h2><p>已答 ${result.answered}/${list.length} · 答对 ${list.length-w.length} · 错误或未答 ${w.length}</p><p>公共：${g.public.correct}/${g.public.n}，折合 ${(g.public.n?20*g.public.correct/g.public.n:0).toFixed(2)}/20；专业：${g.professional.correct}/${g.professional.n}，折合 ${(g.professional.n?80*g.professional.correct/g.professional.n:0).toFixed(2)}/80。</p><div class="actions">${btn('查看错题及未答题',"start(list.filter(q=>!correct(q,state.exam.answers[q.id]||[])),'exam-review',false)")}${btn('重新组卷',"go('exam')")}</div></section>`;}
function coverage(){
 app.innerHTML=`<section><h2>2026 → 2027 考纲变化</h2><p>新增工程力学5项；计算机和数学主体保留，统计补充回归分析，数学应用改为人工智能；电工测量保留并调整名称。电工中未再列出的保护、电子、电机独立专题已从新版专业练习中移出。</p><p>“设备的基本类型与作用”仍可涉及变压器、断路器，不能把所有含设备名称的题一律删除；公共知识明确引用的2027官方832题整体保留，个别内容也可能涉及专业知识。详细区别见 <a href="升级报告.html">升级报告</a>。</p><p class="notice">下面的覆盖表示每个考纲条目已有对应练习，不能据此认定已穷尽该条目的所有子知识点或命题方式。</p><div class="tablewrap"><table><thead><tr><th>考点</th><th>题目（含变式）</th><th>原创设问/题型</th><th>进入练习</th></tr></thead><tbody>${Object.entries(TOPICS).map(([k,v])=>{const qs=ALL.filter(q=>q.topic===k);return `<tr><td><b>${k}</b> ${esc(v)}</td><td>${qs.length}</td><td>${new Set(qs.filter(q=>q.source!=='legacy'&&q.source!=='sgcc2027').map(q=>q.family)).size}</td><td><button onclick="start(ALL.filter(q=>q.topic==='${k}'),'${k}')">练习</button></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function sourcesView(){app.innerHTML=`<section><h2>题目来源与检索记录</h2><p>检索日期：2026-10-19。官方参考题保留原题号、页码与原文答案。原创练习使用公开教材核对知识；联网题源中文改编保留原题条件、题号与页码，并标明许可。两类都不标为国网招聘真题。未取得完整题目及答案的来源没有计入题数。</p><div class="sourcelist">${Object.entries(SOURCES).map(([k,s])=>`<article><h3>${s.url?`<a target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.title)}</a>`:esc(s.title)}</h3><p>${esc(s.role)}</p><small>${esc(s.status||'本地原创')} · ${ALL.filter(q=>q.source===k).length} 题使用此来源标识</small></article>`).join('')}</div></section><section><h3>记录备份</h3><p>2027版使用独立存储空间；浏览器或文件位置改变可能影响本地记录。可随时导出备份，再在相同版本导入。</p><div class="actions">${btn('导出进度','exportProgress()')}<label class="filebutton">导入进度<input type="file" accept="application/json" onchange="importProgress(this.files[0]);this.value=''" hidden></label>${btn('清空本版记录','resetProgress()')}</div></section>`;}
function exportProgress(){const blob=new Blob([JSON.stringify({schema:2,edition:DATA.version,exported:new Date().toISOString(),state},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='国网2027-做题记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function validImported(x){
 if(!x||x.schema!==2||!x.state||!['2027.1.0','2027.1.1',DATA.version].includes(x.edition))throw new Error('文件不是当前2027版本的进度备份');
 const s=x.state;
 for(const k of ['done','fav','pos'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))throw new Error('记录结构不正确');
 const clean={done:{},fav:{},pos:{},exam:null};
 for(const [id,v] of Object.entries(s.done))if(MAP.has(id)&&v&&typeof v.correct==='boolean')clean.done[id]={correct:v.correct,answers:Array.isArray(v.answers)?v.answers.filter(i=>Number.isInteger(i)&&i>=0&&i<MAP.get(id).o.length):[],at:typeof v.at==='string'?v.at:''};
 for(const [id,v] of Object.entries(s.fav))if(MAP.has(id)&&v)clean.fav[id]=true;
 for(const [k,v] of Object.entries(s.pos))if(!['__proto__','constructor','prototype'].includes(k)&&Number.isInteger(v)&&v>=0&&v<ALL.length)clean.pos[k]=v;
 if(s.exam){const e=s.exam;if(Array.isArray(e.ids)&&e.ids.some(id=>!MAP.has(id)))return clean;if(!Array.isArray(e.ids)||e.ids.length!==165||new Set(e.ids).size!==165||e.ids.some(id=>!MAP.has(id))||!e.answers||typeof e.answers!=='object'||!Number.isFinite(e.start)||typeof e.finished!=='boolean')throw new Error('练习卷记录不完整');const answers={};for(const id of e.ids){const a=e.answers[id]||[];if(!Array.isArray(a)||a.some(i=>!Number.isInteger(i)||i<0||i>=MAP.get(id).o.length)||new Set(a).size!==a.length)throw new Error('练习卷答案格式不正确');answers[id]=a;}clean.exam={ids:e.ids,answers,start:e.start,untimed:!!e.untimed,finished:e.finished,finishedAt:e.finishedAt};}
 return clean;
}
async function importProgress(file){if(!file)return;try{if(file.size>10*1024*1024)throw new Error('备份文件过大');const s=validImported(JSON.parse(await file.text()));if(!confirm('导入将替换本版当前做题记录，继续吗？'))return;state=s;save();go('home');}catch(e){alert('导入失败：'+e.message);}}
function resetProgress(){if(confirm('确定清空本2027版本全部记录？建议先导出备份。')){state={done:{},fav:{},pos:{},exam:null};save();go('home');}}
if(state.exam?.ids?.some(id=>!MAP.has(id))){state.retiredExam=state.exam;state.exam=null;save();}
go('home');
