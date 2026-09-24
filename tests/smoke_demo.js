/* Uji profil_demo.html (semua tertanam) di jsdom: muat data uji -> buat PPTX. Pemakaian: node tests/smoke_demo.js <profil_demo.html> <keluaran.pptx> */
const fs=require('fs');const {JSDOM}=require('jsdom');const _is=require('image-size'),sizeOf=_is.imageSize||_is.default||_is;
const html=fs.readFileSync(process.argv[2],'utf8'),blobs=[],saved=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  /* PizZip TIDAK disuntikkan: harus datang dari skrip yang tertanam di halaman */ w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:t/'+blobs.length;};
  w.createImageBitmap=async blob=>{const d=sizeOf(Buffer.from(await blob.arrayBuffer()));return {width:d.width,height:d.height,close(){}};};
  w.HTMLAnchorElement.prototype.click=function(){};
  w.claude={use:async n=>n==='downloads'?{save:async r=>{saved.push(r);return {status:'saved'};}}:null};}});   // meniru viewer artifact
const w=dom.window,$=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await sleep(300);$('btnSample').click();await sleep(1200);console.log('rencana:',$('planBox').textContent);
 $('btnGen').click();await sleep(3000);const big=saved.length?saved[saved.length-1].data:blobs.filter(b=>b.size>5e5).pop();console.log('jalur simpan:',saved.length?'downloads.save -> '+saved[0].filename:'anchor');console.log('hasil:',$('genMsg').textContent.slice(0,120));
 if(!big)process.exit(1);fs.writeFileSync(process.argv[3],Buffer.from(await big.arrayBuffer()));console.log('PPTX',(big.size/1048576).toFixed(1),'MB');process.exit(0);})();
