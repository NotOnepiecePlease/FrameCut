// Browser integration checks. No packages. Optional real-image fixture:
// node verify.cjs --portable --image C:/path/to/comic.png
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const root = __dirname;
const browser = [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(p => fs.existsSync(p));
if (!browser) throw new Error('Chrome/Edge not found. Set BROWSER_PATH.');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'entrequadros-qa-'));
const imageArg = process.argv.indexOf('--image');
const fixture = imageArg >= 0 ? fs.readFileSync(process.argv[imageArg + 1]).toString('base64') : null;
const storyFixtures = process.argv.flatMap((arg, index) => arg === '--story-image' ? [fs.readFileSync(process.argv[index + 1]).toString('base64')] : []);
const artworkArg = process.argv.indexOf('--artwork-image');
const artworkFixture = artworkArg >= 0 ? fs.readFileSync(process.argv[artworkArg + 1]).toString('base64') : null;
const gridArg=process.argv.indexOf('--grid-image');
const gridFixture=gridArg>=0?fs.readFileSync(process.argv[gridArg+1]).toString('base64'):null;
const framesArg=process.argv.indexOf('--frames-image');
const framesFixture=framesArg>=0?fs.readFileSync(process.argv[framesArg+1]).toString('base64'):null;
const assertions = `
window.addEventListener('load', async () => {
const results = [], artifacts = {}; window.addEventListener('unhandledrejection',e=>results.push({unhandled:String(e.reason),stack:e.reason?.stack})); window.addEventListener('error',e=>results.push({runtime:e.message}));
const check = (name, ok, detail) => { results.push({name,ok:Boolean(ok),...(detail?{detail}: {})}); if (!ok) throw new Error(name); };
const $ = id => document.getElementById(id), engine = window.EntrequadrosEngine;
const click = selector => document.querySelector(selector).click();
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate) { for(let i=0;i<300;i++) { if(predicate()) return; await pause(20); } throw new Error('Timed out waiting for UI: '+$('status').textContent+' '+$('batchInfo').textContent+' '+$('queue').textContent); }
const canvas = $('canvas'), context = canvas.getContext('2d');
const pixel = (x,y) => [...context.getImageData(x,y,1,1).data];
const pointer = (type,x,y,extra={}) => { const r=canvas.getBoundingClientRect(); canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:r.left+x*r.width/canvas.width,clientY:r.top+y*r.height/canvas.height,pointerId:1,button:0,...extra})); };
canvas.setPointerCapture=()=>{};
const blobs=new Map(), downloads=[];
const originalURL=URL.createObjectURL.bind(URL);
URL.createObjectURL=blob=>{const url=originalURL(blob);blobs.set(url,blob);return url;};
HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download,blob:blobs.get(this.href)});};
async function importFiles(files) { const dt=new DataTransfer(); for(const file of files)dt.items.add(file); $('file').files=dt.files; $('file').dispatchEvent(new Event('change')); await until(()=>!$('processAll').disabled && $('queue').children.length===files.length && $('queue').querySelector('span')?.textContent===files[0].name); }
async function b64(blob){return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);});}
try {
check('Multiple selection enabled', $('file').multiple);
check('Reference dimensions are the default', $('width').value==='608' && $('height').value==='1600' && $('fitHeight').checked);
check('Export disabled before import', $('export').disabled);
check('Automatic balloon cleanup enabled by default', $('emptyBalloons').checked);
const bubble=document.createElement('canvas');bubble.width=600;bubble.height=600;const bc=bubble.getContext('2d');
bc.fillStyle='#43829f';bc.fillRect(0,0,600,600);bc.fillStyle='#e0edfa';bc.strokeStyle='#000';bc.lineWidth=4;bc.beginPath();bc.ellipse(300,180,220,105,0,0,Math.PI*2);bc.fill();bc.stroke();bc.fillStyle='#000';bc.textAlign='center';bc.font='bold 26px Georgia';bc.fillText('HELLO WORLD',300,185);
const cleanedBubble=window.BalloonCleaner.clean(bubble);
check('Synthetic balloon detected',cleanedBubble.balloons===1);
const before=bc.getImageData(180,160,240,30).data,after=cleanedBubble.canvas.getContext('2d').getImageData(180,160,240,30).data;
check('Synthetic text erased',Array.from(before).filter((v,i)=>i%4!==3&&v<100).length>100&&Array.from(after).filter((v,i)=>i%4!==3&&v<100).length===0);
check('Outside drawing preserved exactly',Array.from(bc.getImageData(20,20,1,1).data).join()===Array.from(cleanedBubble.canvas.getContext('2d').getImageData(20,20,1,1).data).join());
check('Black balloon border preserved',Array.from(bc.getImageData(300,75,1,1).data).join()===Array.from(cleanedBubble.canvas.getContext('2d').getImageData(300,75,1,1).data).join());
const decorated=document.createElement('canvas');decorated.width=600;decorated.height=600;
const dc=decorated.getContext('2d');dc.fillStyle='#43829f';dc.fillRect(0,0,600,600);dc.fillStyle='#fff';dc.beginPath();dc.ellipse(300,180,220,105,0,0,Math.PI*2);dc.fill();
dc.fillStyle='#111';dc.fillRect(210,150,25,35);dc.fillRect(365,150,25,35);
dc.fillStyle='#c52ed3';dc.beginPath();dc.arc(300,200,15,0,Math.PI*2);dc.fill();
const decoratedClean=window.BalloonCleaner.clean(decorated,{closedBalloonsOnly:true});
check('Colored artwork in a white shape prevents erasing black facial details',decoratedClean.balloons===0&&decorated.toDataURL()===decoratedClean.canvas.toDataURL());
bc.fillStyle='#e0edfa';bc.fillRect(180,155,240,40);bc.fillStyle='#000';bc.fillText('OK',300,185);
check('Short ambiguous text skipped automatically',window.BalloonCleaner.clean(bubble).balloons===0);
check('Short text can be cleaned with one click',window.BalloonCleaner.clean(bubble,{point:{x:300,y:210}}).balloons===1);
const shortBlob=await new Promise(resolve=>bubble.toBlob(resolve)); await importFiles([new File([shortBlob],'curto.png',{type:'image/png'})]);
click('[data-tool="bubble"]');pointer('pointerdown',300,210);pointer('pointerup',300,210);
const darkCount=()=>Array.from(context.getImageData(250,160,100,30).data).filter((v,i)=>i%4!==3&&v<100).length;
check('One-click cleanup works through the interface',darkCount()===0);click('#undo');check('One-click cleanup can be undone',darkCount()>30);
const fixture=document.createElement('canvas'); fixture.width=600;fixture.height=900;
const c=fixture.getContext('2d'); c.fillStyle='#000';c.fillRect(0,0,600,900);
for(let i=0;i<3;i++){c.fillStyle=['#d8edf4','#f4deed','#fff0b5'][i];c.fillRect(0,30+i*280,600,280);}
c.fillStyle='#000';c.fillRect(0,307,600,6);c.fillRect(0,587,600,6);
c.fillStyle='#f4deed';c.strokeStyle='#000';c.lineWidth=3;c.beginPath();c.ellipse(300,315,70,42,0,0,Math.PI*2);c.fill();c.stroke();
c.fillStyle='#000';c.font='bold 20px Georgia';c.fillText('KEEP THIS TEXT',220,325);
const report=engine.detect(fixture,3);
check('Two separators detected automatically',report.lines.length===2,report.separators);
check('Detection accepted with confidence',report.confident,report.warnings);
check('Bubble outline traced above separator',Math.min(...report.lines[0].map(p=>p.y))<283);
check('Separator stays near original border at edge',Math.abs(report.lines[0][0].y-310)<6);
const rendered=document.createElement('canvas');engine.compose(fixture,report.lines,{width:600,targetHeight:1600},rendered);
check('Engine produces exact final size',rendered.width===600 && rendered.height===1600);
check('Bubble area removed from upper panel',rendered.getContext('2d').getImageData(300,295,1,1).data.slice(0,3).every(v=>v===255));
check('Original text remains in second panel',Array.from(rendered.getContext('2d').getImageData(240,655,130,20).data).filter((v,i)=>i%4!==3&&v<60).length>60);
const blank=document.createElement('canvas');blank.width=600;blank.height=900;blank.getContext('2d').fillStyle='#fff';blank.getContext('2d').fillRect(0,0,600,900);
check('Missing separators require review',!engine.detect(blank,3).confident && engine.detect(blank,3).lines.length===0);
const grid=document.createElement('canvas');grid.width=600;grid.height=900;const gc=grid.getContext('2d');gc.fillStyle='#000';gc.fillRect(0,0,600,900);
for(const [color,x,y,w,h] of [['#eeaaaa',0,0,380,430],['#aaeeaa',410,0,190,430],['#aaaaff',0,460,380,440],['#eeeeaa',410,460,190,440]]){gc.fillStyle=color;gc.fillRect(x,y,w,h);}
const four=engine.detect(grid);check('Two-by-two grid counted automatically',four.confident&&four.panels.length===4);
check('Two-by-two order is by row rather than column',four.panels[0].x===0&&four.panels[1].x>0&&four.panels[1].y===0&&four.panels[2].x===0&&four.panels[2].y>0);
check('Extra grid divisions are flagged for a forced count',!engine.detect(grid,3).confident);
const blob=await new Promise(resolve=>fixture.toBlob(resolve));
await importFiles([new File([blob],'página.png',{type:'image/png'}),new File([blob],'página.png',{type:'image/png'})]);
check('Batch processes both files without marking cuts', [...$('queue').querySelectorAll('small')].every(s=>s.textContent.startsWith('Pronta')));
check('Automatic result is the initial view', $('previewTab').getAttribute('aria-pressed')==='true');
check('Preview has reference dimensions',canvas.width===608 && canvas.height===1600);
check('Panel count is automatic', $('panelCount').textContent==='3 quadros');
// Capture the visible handle positions to verify actual UI dragging, without
// exposing or depending on the editor's private state.
function handles(){const points=[],arc=context.arc;context.arc=function(x,y,...args){points.push({x,y});return arc.call(this,x,y,...args);};click('#editTab');context.arc=arc;return points;}
const initialHandles=handles();const handleIndex=initialHandles.findIndex((p,i)=>i>0&&p.x>240&&p.x<360&&p.y<300&&initialHandles[i+1]?.x>p.x+4);
check('Contour fixture has an internal draggable handle',handleIndex>=0);
for(const [mode,shift] of [['point',false],['point',true],['cut',false]]){
 click('[data-tool="'+mode+'"]');const before=handles(),chosen=before[handleIndex];
 pointer('pointerdown',chosen.x,chosen.y,{shiftKey:shift});pointer('pointermove',chosen.x+2,chosen.y-9,{shiftKey:shift});pointer('pointerup',chosen.x+2,chosen.y-9,{shiftKey:shift});
 const after=handles();const changed=after.map((p,i)=>Math.abs(p.x-before[i]?.x)>.01||Math.abs(p.y-before[i]?.y)>.01).filter(Boolean).length;
 check('Existing handle moved without insertion: '+mode+(shift?' + Shift':''),after.length===before.length&&changed===1&&Math.abs(after[handleIndex].y-chosen.y+9)<1.1);
 check('Internal handle can move horizontally: '+mode+(shift?' + Shift':''),after[handleIndex].x>chosen.x);
 click('#undo');check('Undo restores handle geometry: '+mode+(shift?' + Shift':''),JSON.stringify(handles())===JSON.stringify(before));
}
// Reproduce the reported flow: edit a handle, then reprocess without
// manually switching tabs. Both downloads must use the edited geometry.
click('[data-tool="point"]');const beforeReprocess=handles(),reprocessHandle=beforeReprocess[handleIndex];
pointer('pointerdown',reprocessHandle.x,reprocessHandle.y);pointer('pointermove',reprocessHandle.x+2,reprocessHandle.y-15);pointer('pointerup',reprocessHandle.x+2,reprocessHandle.y-15);
const editedHandles=handles();click('#previewTab');const expectedEditedPreview=canvas.toDataURL();click('#editTab');
click('#processAll');await until(()=>!$('processAll').disabled);
check('Reprocessing opens the updated result automatically',$('previewTab').getAttribute('aria-pressed')==='true');
check('Reprocessed preview uses the moved cut',canvas.toDataURL()===expectedEditedPreview);
check('Reprocessing preserves manual handle positions',JSON.stringify(handles())===JSON.stringify(editedHandles));click('#previewTab');
const downloadStart=downloads.length;click('#export');await until(()=>downloads.length>downloadStart);
async function pngPixels(blob){const image=await createImageBitmap(blob),out=document.createElement('canvas');out.width=image.width;out.height=image.height;out.getContext('2d').drawImage(image,0,0);return out.toDataURL();}
check('Single PNG after reprocessing matches edited preview',await pngPixels(downloads.at(-1).blob)===expectedEditedPreview);
click('#downloadZip');await until(()=>downloads.length>downloadStart+1);
const zipBytes=await downloads.at(-1).blob.arrayBuffer(),zipView=new DataView(zipBytes),zipNameSize=zipView.getUint16(26,true),zipExtraSize=zipView.getUint16(28,true),pngOffset=30+zipNameSize+zipExtraSize;
const zippedPng=new Blob([zipBytes.slice(pngOffset,pngOffset+zipView.getUint32(18,true))],{type:'image/png'});
check('ZIP after reprocessing matches edited preview',await pngPixels(zippedPng)===expectedEditedPreview);
downloads.splice(downloadStart);click('#undo');check('Reprocessing preserves undo history',JSON.stringify(handles())===JSON.stringify(beforeReprocess));
click('#processAll');await until(()=>!$('processAll').disabled);
click('#previewTab');
check('ZIP enabled after batch',!$('downloadZip').disabled);
click('#downloadZip');await until(()=>downloads.some(d=>d.name.endsWith('.zip')));
const zip=downloads.find(d=>d.name.endsWith('.zip')); artifacts.zip=await b64(zip.blob);
check('ZIP signature',new DataView(await zip.blob.arrayBuffer()).getUint32(0,true)===0x04034b50);
click('#editTab');check('Original available for review',canvas.width===600 && canvas.height===900);
click('[data-tool="rectangle"]');$('color').value='#ffffff';$('autoColor').checked=false;
pointer('pointerdown',225,308);pointer('pointermove',390,332);pointer('pointerup',390,332);
check('Manual cleanup retained as optional tool',pixel(270,320).slice(0,3).every(v=>v===255));
click('#undo');check('Undo restores original text/background',pixel(270,320).slice(0,3).some(v=>v!==255));
// Switch images and verify optional pixel edits survive the switch.
pointer('pointerdown',225,308);pointer('pointermove',390,332);pointer('pointerup',390,332);
$('queue').children[1].click();await until(()=>$('queue').children[1].classList.contains('current'));
$('queue').children[0].click();await until(()=>$('queue').children[0].classList.contains('current'));click('#editTab');
check('Edits survive switching between batch items',pixel(270,320).slice(0,3).every(v=>v===255));
$('fitHeight').checked=false;$('fitHeight').dispatchEvent(new Event('change'));
$('width').value=600;$('gap').value=100;$('width').dispatchEvent(new Event('change'));click('#previewTab');
check('Fixed spacing mode',canvas.width===600 && canvas.height===1100);
click('#export');await until(()=>downloads.some(d=>d.name.endsWith('.png')));
const png=downloads.find(d=>d.name.endsWith('.png')); const bitmap=await createImageBitmap(png.blob);
check('Single PNG exact export dimensions',bitmap.width===600 && bitmap.height===1100);
click('#downloadZip');await until(()=>downloads.filter(d=>d.name.endsWith('.zip')).length===2);
artifacts.changedZip=await b64(downloads.filter(d=>d.name.endsWith('.zip'))[1].blob);
check('Changed settings reprocess the ZIP', [...$('queue').querySelectorAll('small')].every(s=>s.textContent.startsWith('Pronta')));
$('fitHeight').checked=true;$('height').value=200;$('fitHeight').dispatchEvent(new Event('change'));
check('Too-small final height rejected clearly',$('status').textContent.includes('Padrão atualizado'));
click('#previewTab');check('Invalid dimensions show error',$('status').textContent.includes('pequena'));
$('height').value=1600;$('width').value=608;$('height').dispatchEvent(new Event('change'));
const blankBlob=await new Promise(resolve=>blank.toBlob(resolve));
await importFiles([new File([blankBlob],'sem-divisoes.png',{type:'image/png'})]);
check('Uncertain image flagged in batch',$('queue').querySelector('small').textContent==='Revisar');
check('Uncertain image excluded from ZIP',$('downloadZip').disabled);
if(${JSON.stringify(fixture)} !== null) {
 const bytes=Uint8Array.from(atob(${JSON.stringify(fixture)}),ch=>ch.charCodeAt(0));
 await importFiles([new File([bytes],'referencia.png',{type:'image/png'})]);
 check('User reference automatically accepted',$('queue').querySelector('small').textContent.startsWith('Pronta'),$('queue').querySelector('button').title);
 check('User reference output dimensions',canvas.width===608&&canvas.height===1600);
 artifacts.reference=canvas.toDataURL('image/png').split(',')[1]; artifacts.cleanedOutput=artifacts.reference;
 check('Batch reports five cleaned reference balloons',$('queue').querySelector('small').textContent.includes('5 balões'));
 const downloadsBefore=downloads.length;click('#downloadZip');await until(()=>downloads.length>downloadsBefore);artifacts.cleanZip=await b64(downloads.at(-1).blob);
 $('emptyBalloons').checked=false;$('emptyBalloons').dispatchEvent(new Event('change'));click('#previewTab');
 artifacts.reference=canvas.toDataURL('image/png').split(',')[1];
 check('Cleanup can be disabled without destroying text',artifacts.reference!==artifacts.cleanedOutput);
 click('#editTab'); const original=document.createElement('canvas'); original.width=canvas.width;original.height=canvas.height;
 const image=await createImageBitmap(new Blob([bytes]));original.getContext('2d').drawImage(image,0,0);
 const realReport=engine.detect(original,3);artifacts.report=realReport;
 check('User reference separator locations',Math.abs(realReport.separators[0].y-570)<8&&Math.abs(realReport.separators[1].y-1025)<8,realReport.separators);
 check('User reference bubble cap preserved',Math.min(...realReport.lines[0].map(p=>p.y))<553);
 const clean=window.BalloonCleaner.clean(original); artifacts.clean=clean.canvas.toDataURL('image/png').split(',')[1]; artifacts.cleanReport={balloons:clean.balloons,changed:clean.changed,regions:clean.regions};
 check('All five reference balloons detected',clean.balloons===5,artifacts.cleanReport);
 const cp=clean.canvas.getContext('2d'),op=original.getContext('2d');
 const boxes=[[720,235,250,35],[405,592,180,105],[435,838,180,35],[460,923,150,38],[525,1045,150,95]];
 check('Dark text removed from all five balloons',boxes.every(([x,y,w,h])=>Array.from(cp.getImageData(x,y,w,h).data).filter((v,i)=>i%4!==3&&v<100).length<30));
 check('Faces and eyes preserved pixel for pixel',[[300,260,180,130],[80,680,230,160],[780,700,250,140],[810,1070,220,360]].every(([x,y,w,h])=>{const a=op.getImageData(x,y,w,h).data,b=cp.getImageData(x,y,w,h).data;return a.every((v,i)=>v===b[i]);}));
 const repeated=window.BalloonCleaner.clean(clean.canvas);check('Repeated cleanup leaves blank balloons unchanged',repeated.changed===0);
}

if(${JSON.stringify(gridFixture)} !== null) {
 const bytes=Uint8Array.from(atob(${JSON.stringify(gridFixture)}),ch=>ch.charCodeAt(0));
 $('count').value='0';$('emptyBalloons').checked=false;$('width').value=426;$('height').value=1600;$('width').dispatchEvent(new Event('change'));
 await importFiles([new File([bytes],'misto.png',{type:'image/png'})]);
 check('Mixed layout accepted automatically',$('queue').querySelector('small').textContent.startsWith('Pronta'),$('queue').querySelector('button').title);
 check('Mixed layout has three panels',$('panelCount').textContent.startsWith('3 quadros'));
 const image=await createImageBitmap(new Blob([bytes]));const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;raw.getContext('2d').drawImage(image,0,0);
 const report=engine.detect(raw);check('Mixed layout detected as rectangles',report.layout==='mixed'&&report.panels.length===3,report);
 const [a,b,c]=report.panels;
 check('Mixed reading order: top left, top right, bottom',a.x===0&&b.x>a.x&&b.y===a.y&&c.x===0&&c.y>a.y&&c.width===raw.width);
 check('Mixed cuts fall in actual black gutters',a.width>635&&a.width<675&&a.height>830&&a.height<875);
 const result=document.createElement('canvas');const info=engine.compose(raw,report,{width:426,targetHeight:1600,referenceSpacing:true},result);
 check('Narrow mixed panels centered without enlargement',info.positions[0].width<426&&info.positions[1].width<info.positions[0].width&&Math.abs(info.positions[0].x*2+info.positions[0].width-426)<.01&&info.positions[2].width===426);
 check('Original image partitioned without gaps or duplication',Math.abs(report.panels.reduce((n,p)=>n+p.width*p.height,0)-raw.width*raw.height)<1);
 const originalPreview=canvas.toDataURL();artifacts.mixed=originalPreview.split(',')[1];
 click('[data-tool="cut"]');pointer('pointerdown',a.width,400);pointer('pointermove',a.width-15,400);pointer('pointerup',a.width-15,400);click('#previewTab');
 check('Mixed rectangle boundary can be adjusted',canvas.toDataURL()!==originalPreview);click('#undo');check('Mixed rectangle undo restores output',canvas.toDataURL()===originalPreview);
 const before=downloads.length;click('#export');await until(()=>downloads.length>before);const bitmap=await createImageBitmap(downloads.at(-1).blob);check('Mixed PNG export dimensions',bitmap.width===426&&bitmap.height===1600);
 artifacts.mixedReport={panels:report.panels,positions:info.positions};
 const cleaned=window.BalloonCleaner.clean(raw);artifacts.mixedCleanRaw=cleaned.canvas.toDataURL().split(',')[1];
 const cleanOut=document.createElement('canvas');engine.compose(cleaned.canvas,report,{width:426,targetHeight:1600,referenceSpacing:true},cleanOut);artifacts.mixedClean=cleanOut.toDataURL().split(',')[1];
 check('Three translucent utterances cleaned as complete groups',cleaned.balloons===3,{balloons:cleaned.balloons,warnings:cleaned.warnings,regions:cleaned.regions});
 const rc=raw.getContext('2d'),cc=cleaned.canvas.getContext('2d');
 const equalRect=(x,y,w,h)=>{const a=rc.getImageData(x,y,w,h).data,b=cc.getImageData(x,y,w,h).data;return a.every((v,i)=>v===b[i]);};
 check('All cans and their logos preserved pixel for pixel',equalRect(24,935,1075,280));
 check('Shirt lettering preserved pixel for pixel',equalRect(220,495,245,85));
 check('Translucent example face preserved pixel for pixel',equalRect(90,95,350,380));
 const boxes=[[295,605,120,43],[281,678,150,45],[240,750,237,49],[913,515,190,65],[918,615,185,60],[279,1345,551,117]];
 check('No dark letter strokes left in translucent utterances',boxes.every(([x,y,w,h])=>Array.from(cc.getImageData(x,y,w,h).data).filter((v,i)=>i%4!==3&&v<30).length<8));
 $('emptyBalloons').checked=true;$('emptyBalloons').dispatchEvent(new Event('change'));click('#previewTab');
 check('Translucent cleanup in application matches tested output',canvas.toDataURL()===cleanOut.toDataURL());
 const jpegBlob=await new Promise(resolve=>raw.toBlob(resolve,'image/jpeg',.85));const jpegBitmap=await createImageBitmap(jpegBlob);const jpeg=document.createElement('canvas');jpeg.width=raw.width;jpeg.height=raw.height;jpeg.getContext('2d').drawImage(jpegBitmap,0,0);const jpegClean=window.BalloonCleaner.clean(jpeg);
 check('JPEG translucent example cleans all three utterances',jpegClean.balloons===3);
 const ja=jpeg.getContext('2d').getImageData(24,935,1075,280).data,jb=jpegClean.canvas.getContext('2d').getImageData(24,935,1075,280).data;check('JPEG can drawings remain unchanged',ja.every((v,i)=>v===jb[i]));
 $('emptyBalloons').checked=false;$('emptyBalloons').dispatchEvent(new Event('change'));
}
if(${JSON.stringify(framesFixture)} !== null) {
 const bytes=Uint8Array.from(atob(${JSON.stringify(framesFixture)}),ch=>ch.charCodeAt(0));
 $('count').value='0';$('emptyBalloons').checked=false;$('width').value=378;$('width').dispatchEvent(new Event('change'));
 await importFiles([new File([bytes],'quatro.png',{type:'image/png'})]);
 check('Four framed panels accepted automatically',$('queue').querySelector('small').textContent.startsWith('Pronta'),$('queue').querySelector('button').title);
 check('Four framed panels counted without configuration',$('panelCount').textContent.startsWith('4 quadros'));
 const image=await createImageBitmap(new Blob([bytes]));const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;raw.getContext('2d').drawImage(image,0,0);
 const report=engine.detect(raw);check('Four independent frames detected',report.layout==='framed'&&report.panels.length===4,report);
 check('Original side margins retained',report.panels.every(p=>p.x===0&&p.width===raw.width));
 check('Top margin and bottom credit retained',report.panels[0].y===0&&Math.abs(report.panels.at(-1).y+report.panels.at(-1).height-raw.height)<.01);
 check('Four-panel reference dimensions',canvas.width===378&&canvas.height===1600);artifacts.frames=canvas.toDataURL().split(',')[1];
 const cleaned=window.BalloonCleaner.clean(raw);artifacts.framesCleanRaw=cleaned.canvas.toDataURL().split(',')[1];
 const cleanOut=document.createElement('canvas');engine.compose(cleaned.canvas,report,{width:378,targetHeight:1600,referenceSpacing:true},cleanOut);artifacts.framesClean=cleanOut.toDataURL().split(',')[1];
 check('Eight white balloons cleaned including tall and joined balloons',cleaned.balloons===8,{balloons:cleaned.balloons,warnings:cleaned.warnings,regions:cleaned.regions});
 const rc=raw.getContext('2d'),cc=cleaned.canvas.getContext('2d');
 const boxes=[[130,288,72,23],[580,134,58,49],[165,503,62,65],[135,601,81,75],[535,524,53,47],[585,504,61,17],[526,878,91,65],[127,1005,81,77],[549,1276,76,97],[127,1367,84,138]];
 check('No dark letters left in white speech interiors',boxes.every(([x,y,w,h])=>Array.from(cc.getImageData(x,y,w,h).data).filter((v,i)=>i%4!==3&&v<70).length<20));
 const jpegBlob=await new Promise(resolve=>raw.toBlob(resolve,'image/jpeg',.85));const jpegBitmap=await createImageBitmap(jpegBlob);const jpeg=document.createElement('canvas');jpeg.width=raw.width;jpeg.height=raw.height;jpeg.getContext('2d').drawImage(jpegBitmap,0,0);check('JPEG white-balloon example cleans all eight regions',window.BalloonCleaner.clean(jpeg).balloons===8);
 check('White-balloon example characters preserved pixel for pixel',[[240,120,77,205],[447,116,90,94],[250,500,95,185],[409,473,88,180],[245,925,85,220],[370,868,75,210],[270,1245,90,260]].every(([x,y,w,h])=>{const a=rc.getImageData(x,y,w,h).data,b=cc.getImageData(x,y,w,h).data;return a.every((v,i)=>v===b[i]);}));
 const wrong=engine.detect(raw,3);check('Incorrect forced count requires review',!wrong.confident&&wrong.panels.length===4);
 if(${JSON.stringify(gridFixture)}!==null){const other=Uint8Array.from(atob(${JSON.stringify(gridFixture)}),ch=>ch.charCodeAt(0));await importFiles([new File([other],'lote-misto.png',{type:'image/png'}),new File([bytes],'lote-quatro.png',{type:'image/png'})]);check('Different layouts and counts work in the same batch',[...$('queue').querySelectorAll('small')].every(s=>s.textContent.startsWith('Pronta')));$('queue').children[1].click();await until(()=>$('queue').children[1].classList.contains('current'));check('Stored four-panel geometry restored on selection',$('panelCount').textContent.startsWith('4 quadros'));$('queue').children[0].click();await until(()=>$('queue').children[0].classList.contains('current'));check('Stored mixed geometry restored on selection',$('panelCount').textContent.startsWith('3 quadros'));}
}
// Clipboard and independent-panel assembly use the actual UI event handlers.
async function pasteImages(files) {
 const data=new DataTransfer();files.forEach(file=>data.items.add(file));
 const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});
 document.dispatchEvent(event);return event.defaultPrevented;
}
const priorPageCount=$('queue').children.length;
check('Clipboard image paste is handled',await pasteImages([new File([blob],'clipboard.png',{type:'image/png'})]));
await until(()=>!$('processAll').disabled&&$('queue').children.length===priorPageCount+1);
check('Page clipboard paste appends rather than replacing the batch',$('queue').children.length===priorPageCount+1);
const textData=new DataTransfer();textData.setData('text/plain','608');
const textPaste=new ClipboardEvent('paste',{clipboardData:textData,bubbles:true,cancelable:true});$('width').dispatchEvent(textPaste);
check('Ordinary text paste remains native',!textPaste.defaultPrevented);
click('#storyMode');await until(()=>$('storyMode').getAttribute('aria-pressed')==='true');
check('Story mode hides page detection and ZIP controls',$('count').closest('label').hidden&&$('downloadZip').hidden&&document.querySelector('.advanced').hidden);
check('Story defaults to fixed spacing to fit any panel count',!$('fitHeight').checked);
$('width').value=300;$('gap').value=20;$('emptyBalloons').checked=false;
$('gap').dispatchEvent(new Event('change'));
async function solidFile(color,name,width=600,height=600){const raw=document.createElement('canvas');raw.width=width;raw.height=height;const rc=raw.getContext('2d');rc.fillStyle=color;rc.fillRect(0,0,width,height);return new File([await new Promise(resolve=>raw.toBlob(resolve))],name,{type:'image/png'});}
const red=await solidFile('#ff0000','red.png'),green=await solidFile('#00ff00','green.png'),blue=await solidFile('#0000ff','blue.png');
const storyData=new DataTransfer();[red,green,blue].forEach(file=>storyData.items.add(file));$('file').files=storyData.files;$('file').dispatchEvent(new Event('change'));
await until(()=>!$('processAll').disabled&&$('queue').children.length===3);
check('Story preserves full independent panels without separator detection',canvas.width===300&&canvas.height===940);
check('Story follows import order',pixel(20,20)[0]===255&&pixel(20,340)[1]===255&&pixel(20,660)[2]===255);
check('Story adds white gaps between panels',pixel(20,310).slice(0,3).every(v=>v===255));
check('Story queue includes thumbnails and numbered names',$('queue').querySelectorAll('img').length===3&&$('queue').children[0].textContent.includes('1. red.png'));
// Queue two paste events without waiting for the first build to finish.
await pasteImages([red]);await pasteImages([blue]);
await until(()=>!$('processAll').disabled&&$('queue').children.length===5);
check('Rapid Ctrl+V pastes append every frame in order',canvas.height===1580&&pixel(20,980)[0]===255&&pixel(20,1300)[2]===255);
$('queue').children[4].querySelector('button').click();await until(()=>!$('processAll').disabled);
check('Arrow buttons reorder the generated story',pixel(20,980)[2]===255&&pixel(20,1300)[0]===255);
const drag=new DataTransfer(),first=$('queue').children[0],last=$('queue').children[4];
first.dispatchEvent(new DragEvent('dragstart',{dataTransfer:drag,bubbles:true}));last.dispatchEvent(new DragEvent('drop',{dataTransfer:drag,bubbles:true,cancelable:true}));
await until(()=>!$('processAll').disabled);
check('Dragging reorders panels',pixel(20,20)[1]===255&&pixel(20,1300)[0]===255);
$('queue').children[4].querySelectorAll('button')[2].click();await until(()=>!$('processAll').disabled);
check('Removing a panel rebuilds the story',$('queue').children.length===4&&canvas.height===1260);
const storyDownloadStart=downloads.length;click('#export');await until(()=>downloads.length>storyDownloadStart);
check('Story exports one complete PNG',downloads.at(-1).name==='historia-preparada.png'&&await pngPixels(downloads.at(-1).blob)===canvas.toDataURL());
click('#pagesMode');await until(()=>$('pagesMode').getAttribute('aria-pressed')==='true');
check('Switching back preserves the page batch',$('queue').children.length===priorPageCount+1&&!$('downloadZip').hidden&&!$('count').closest('label').hidden);
click('#storyMode');await until(()=>!$('processAll').disabled);
check('Switching modes preserves story panels and settings',$('queue').children.length===4&&$('width').value==='300'&&$('gap').value==='20');
$('fitHeight').checked=true;$('height').value=300;$('fitHeight').dispatchEvent(new Event('change'));click('#processAll');await until(()=>!$('processAll').disabled);
check('Insufficient story height is reported without stale preview',$('status').textContent.includes('altura final é pequena')&&canvas.hidden);
$('fitHeight').checked=false;$('fitHeight').dispatchEvent(new Event('change'));click('#processAll');await until(()=>!$('processAll').disabled);
check('Story recovers after invalid dimensions',!canvas.hidden&&canvas.height===1260);
click('#clearStory');check('New story clears panels and disables export',$('queue').children.length===0&&$('export').disabled&&canvas.hidden);
bc.fillStyle='#fff';bc.beginPath();bc.ellipse(300,180,220,105,0,0,Math.PI*2);bc.fill();bc.stroke();bc.fillStyle='#000';bc.fillText('HELLO WORLD',300,185);
const speech=new File([await new Promise(resolve=>bubble.toBlob(resolve))],'speech.png',{type:'image/png'});
$('width').value=600;$('emptyBalloons').checked=true;$('emptyBalloons').dispatchEvent(new Event('change'));
await pasteImages([speech]);await until(()=>!$('processAll').disabled&&$('queue').children.length===1);
check('A single story panel exports without needing separators',canvas.width===600&&canvas.height===600);
check('Story reuses automatic balloon cleanup',Array.from(context.getImageData(180,160,240,30).data).filter((v,i)=>i%4!==3&&v<100).length===0&&$('cleanupInfo').textContent.includes('1 balões'));
$('emptyBalloons').checked=false;$('emptyBalloons').dispatchEvent(new Event('change'));click('#processAll');await until(()=>!$('processAll').disabled);
check('Turning story cleanup off restores the original text',Array.from(context.getImageData(180,160,240,30).data).filter((v,i)=>i%4!==3&&v<100).length>100);
const wide=await solidFile('#00ff00','wide.png',600,300);await pasteImages([wide]);await until(()=>!$('processAll').disabled&&$('queue').children.length===2);
check('Mixed aspect ratios are preserved',canvas.width===600&&canvas.height===920);
// Clipboard imports also wait for a rebuild started with the button.
click('#processAll');await pasteImages([red]);await until(()=>!$('processAll').disabled&&$('queue').children.length===3);
check('Pasting during a manual story build does not drop the new panel',$('queue').children.length===3);
const storyExamples=${JSON.stringify(storyFixtures)};
const artworkExample=${JSON.stringify(artworkFixture)};
if(artworkExample){
 const file=new File([Uint8Array.from(atob(artworkExample),c=>c.charCodeAt(0))],'mascara-sem-falas.png',{type:'image/png'});
 const image=await createImageBitmap(file),raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;raw.getContext('2d').drawImage(image,0,0);
 const rawPixels=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
 for(const quality of [null,.85]){
  const input=quality===null?raw:document.createElement('canvas');
  if(quality!==null){input.width=raw.width;input.height=raw.height;input.getContext('2d').drawImage(await createImageBitmap(await new Promise(resolve=>raw.toBlob(resolve,'image/jpeg',quality))),0,0);}
  const before=input.getContext('2d').getImageData(0,0,input.width,input.height).data,clean=window.BalloonCleaner.clean(input,{closedBalloonsOnly:true});
  const after=clean.canvas.getContext('2d').getImageData(0,0,input.width,input.height).data;
  check('Decorated mask artwork is preserved pixel for pixel'+(quality===null?' (PNG)':' (JPEG)'),before.every((v,i)=>v===after[i]),{balloons:clean.balloons});
 }
 click('#clearStory');$('width').value=raw.width;$('emptyBalloons').checked=true;$('emptyBalloons').dispatchEvent(new Event('change'));
 await pasteImages([file]);await until(()=>!$('processAll').disabled&&$('queue').children.length===1);
 check('Story preview preserves the complete mask dimensions',canvas.width===raw.width&&canvas.height===raw.height);
 const previewPixels=context.getImageData(0,0,canvas.width,canvas.height).data;
 check('Story artwork pixels match the source exactly',rawPixels.every((v,i)=>v===previewPixels[i]));
 const start=downloads.length;click('#export');await until(()=>downloads.length>start);
 check('Exported story PNG preserves the mask',await pngPixels(downloads.at(-1).blob)===raw.toDataURL());
 artifacts.maskPreview=canvas.toDataURL().split(',')[1];
}
if(storyExamples.length){
 const artworkBoxes=[[100,230,170,250],[100,190,170,280],[100,170,170,300],[70,170,160,340],[90,190,145,350]];
 for(let index=0;index<storyExamples.length;index++){
  const image=await createImageBitmap(new Blob([Uint8Array.from(atob(storyExamples[index]),c=>c.charCodeAt(0))]));
  const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;raw.getContext('2d').drawImage(image,0,0);
  const clean=window.BalloonCleaner.clean(raw,{closedBalloonsOnly:true});
  if(artworkBoxes[index]&&image.width>550&&image.height>550){
   const box=artworkBoxes[index],before=raw.getContext('2d').getImageData(...box).data,after=clean.canvas.getContext('2d').getImageData(...box).data;
   check('Real story panel '+(index+1)+' preserves faces and artwork pixel for pixel',before.every((v,i)=>v===after[i]));
  }
 }
 click('#clearStory');$('width').value=400;$('gap').value=100;$('emptyBalloons').checked=true;$('gap').dispatchEvent(new Event('change'));
 await pasteImages(storyExamples.map((encoded,index)=>new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'quadro-'+(index+1)+'.png',{type:'image/png'})));
 await until(()=>!$('processAll').disabled&&$('queue').children.length===storyExamples.length);
 check('Provided real comic panels assemble into one story',canvas.width===400&&!canvas.hidden&&$('status').textContent.includes('História pronta'));
 artifacts.storyPreview=canvas.toDataURL().split(',')[1];
}
} catch(error){results.push({error:error.message,stack:error.stack});}
document.body.innerHTML='<pre id="qa-results">'+JSON.stringify({results,artifacts})+'</pre>';
});`;
for(const file of ['style.css','app.js','automation.js','balloon-cleaner.js','story.js'])fs.copyFileSync(path.join(root,file),path.join(dir,file));
fs.writeFileSync(path.join(dir,'test.js'),assertions);
const entry=process.argv.includes('--portable')?'Entrequadros.html':'index.html';
fs.writeFileSync(path.join(dir,'index.html'),fs.readFileSync(path.join(root,entry),'utf8').replace('</head>','<script src="test.js" defer></script></head>'));

(async()=>{
 const profile=path.join(dir,'profile');
 const child=spawn(browser,['--headless','--disable-gpu','--no-sandbox','--no-first-run','--no-default-browser-check','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<100&&!fs.existsSync(portFile);i++)await pause(100);
  if(!fs.existsSync(portFile))throw new Error('Browser debug port not ready');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0].trim();
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();
  ws.addEventListener('message',event=>{const response=JSON.parse(event.data);if(response.id&&pending.has(response.id)){const {resolve,reject}=pending.get(response.id);pending.delete(response.id);response.error?reject(new Error(JSON.stringify(response.error))):resolve(response.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');
  await send('Page.navigate',{url:'file:///'+path.join(dir,'index.html').replaceAll('\\','/')});
  let result;
  for(let i=0;i<300;i++){
   const response=await send('Runtime.evaluate',{expression:'document.getElementById("qa-results")?.textContent',returnByValue:true});
   if(response.result.value){result=JSON.parse(response.result.value);break;}await pause(100);
  }
  if(!result)throw new Error('Browser assertions timed out');
  const {results,artifacts}=result;
  if(artifacts.storyPreview){fs.writeFileSync(path.join(root,'exemplo-historia.png'),Buffer.from(artifacts.storyPreview,'base64'));console.log('Story output: exemplo-historia.png');}
  if(artifacts.maskPreview)fs.writeFileSync(path.join(root,'exemplo-mascara-preservada.png'),Buffer.from(artifacts.maskPreview,'base64'));
  for(const r of results)console.log(r.name?(r.ok?'PASS ':'FAIL ')+r.name+(r.detail?' '+JSON.stringify(r.detail):''):JSON.stringify(r));
  for(const [key,name] of [['mixedCleanRaw','exemplo-transparente-limpo-original.png'],['mixedClean','exemplo-transparente-limpo.png'],['framesCleanRaw','exemplo-brancos-limpo-original.png'],['framesClean','exemplo-brancos-limpo.png']])if(artifacts[key])fs.writeFileSync(path.join(root,name),Buffer.from(artifacts[key],'base64'));
  if(artifacts.mixed){fs.writeFileSync(path.join(root,'exemplo-layout-misto.png'),Buffer.from(artifacts.mixed,'base64'));console.log('Mixed output: exemplo-layout-misto.png '+JSON.stringify(artifacts.mixedReport));}
  if(artifacts.frames){fs.writeFileSync(path.join(root,'exemplo-quatro-quadros.png'),Buffer.from(artifacts.frames,'base64'));console.log('Framed output: exemplo-quatro-quadros.png');}
  if(artifacts.zip){fs.writeFileSync(path.join(dir,'test.zip'),Buffer.from(artifacts.zip,'base64'));console.log('ZIP fixture: '+path.join(dir,'test.zip'));}
  if(artifacts.changedZip){fs.writeFileSync(path.join(dir,'changed.zip'),Buffer.from(artifacts.changedZip,'base64'));console.log('Changed ZIP fixture: '+path.join(dir,'changed.zip'));}
  if(artifacts.cleanZip){fs.writeFileSync(path.join(dir,'clean.zip'),Buffer.from(artifacts.cleanZip,'base64'));console.log('Clean ZIP fixture: '+path.join(dir,'clean.zip'));}
  if(artifacts.cleanedOutput)fs.writeFileSync(path.join(root,'exemplo-sem-texto.png'),Buffer.from(artifacts.cleanedOutput,'base64'));
  if(artifacts.clean){fs.writeFileSync(path.join(root,'exemplo-sem-texto-original.png'),Buffer.from(artifacts.clean,'base64'));console.log('Cleanup report: '+JSON.stringify(artifacts.cleanReport));}
  if(artifacts.reference){fs.writeFileSync(path.join(root,'exemplo-automatico.png'),Buffer.from(artifacts.reference,'base64'));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(artifacts.report));console.log('Reference output: exemplo-automatico.png');}
  if(results.some(r=>r.ok===false||r.error||r.unhandled||r.runtime))process.exitCode=1;
  try{await send('Browser.close');}catch{}
 }catch(error){console.error(error);process.exitCode=1;}
 finally{ws?.close();child.kill();}
})();
