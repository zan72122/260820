'use strict';
const $=s=>document.querySelector(s), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const scenes=[
['鋳型をみる','観察','砂型の厚み、締め金具、湯口を同じ空間で読む','画面をゆっくり動かして工房を見る'],
['取鍋を支える','重量','二人の職人の姿勢と長柄が取鍋の重さを伝える','上下にドラッグして持ち上げる'],
['湯口へ寄せる','慎重さ','取鍋と身体を一緒に寄せ、注湯盆の真上へ置く','左右にドラッグして位置を合わせる'],
['最初の一筋','驚き','傾きから自然に生まれる最初の溶湯。直線にはしない','下へゆっくりドラッグして傾ける'],
['太さを保つ','流体制御','流量・脈動・着地点が傾きに追従する','指を止め、流れを静かに保つ'],
['止め際を読む','タイミング','流れを細くし、最後の一滴を切る','上へゆっくり戻して流れを止める'],
['型へ楔を入れる','手応え','砂型と鉄輪に荷重が伝わり、亀裂が少しずつ走る','3回タップして楔を送る'],
['型を開く','発見','厚い砂型が左右へ離れ、黒い鋳物が現れる','左右へドラッグして型を開く'],
['砂を落とす','掃除＋露出','鋳物に残る砂を払うほど粗い鋳肌が現れる','鉄瓶の表面を何度もなぞる'],
['鋳肌を整える','材質変化','粉っぽい鋳肌から締まった黒へ変化する','表面を往復して磨く'],
['黒い艶を育てる','仕上げ','刷毛跡と反射が指の軌跡に沿って増える','ゆっくり塗り重ねる'],
['鉉を据える','組付け','重い鉉を環付へ収め、形が完成する','上から下へドラッグして据える'],
['最初の一杯','達成','作ったものが初めて道具として働く','鉄瓶を傾けて湯を注ぐ']
];
const state={scene:0,progress:0,drag:false,lastX:0,lastY:0,yaw:0.08,pitch:0.04,ladleX:-1.45,ladleY:2.0,tilt:0,streamOn:0,moldOpen:0,clean:0,finish:0,handle:0,pour:0,wedge:0};
const settings={scale:100,camY:100,fov:47,exposure:92,dark:76,rough:88,weight:82,shake:38,exaggerate:28,assist:62,speed:82,reward:38,ui:34,visc:72,turb:31,stream:78,glow:92};
try{Object.assign(settings,JSON.parse(localStorage.getItem('nambu3d-settings')||'{}'))}catch(e){}
if(!window.THREE){document.body.innerHTML='<div style="padding:30px;color:white">Three.js の読み込みに失敗しました。ネットワーク接続を確認してください。</div>';throw new Error('Three.js unavailable')}
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0907);scene.fog=new THREE.FogExp2(0x0a0907,.032);
const camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,.05,80);camera.position.set(5.6,3.05,7.9);
const root=new THREE.Group();scene.add(root);
function texNoise(base,grain=35,streak=false){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<6500;i++){const a=Math.random()*.13;x.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?255:0},${Math.random()<.5?255:0},${a})`;const s=Math.random()*2.4;x.fillRect(Math.random()*256,Math.random()*256,streak?s*5:s,streak?.5+s:s)}return new THREE.CanvasTexture(c)}
const sandTex=texNoise('#6c6253',55), ironTex=texNoise('#242321',60), wallTex=texNoise('#29251f',28,true), floorTex=texNoise('#2a241d',35,true);for(const t of [sandTex,ironTex,wallTex,floorTex]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace}
sandTex.repeat.set(4,4);floorTex.repeat.set(6,6);wallTex.repeat.set(5,3);ironTex.repeat.set(3,3);
const mat={sand:new THREE.MeshStandardMaterial({map:sandTex,color:0x756a59,roughness:.95,metalness:0}),sandDark:new THREE.MeshStandardMaterial({map:sandTex,color:0x51493e,roughness:.98}),iron:new THREE.MeshStandardMaterial({map:ironTex,color:0x242522,roughness:.72,metalness:.72}),ironHot:new THREE.MeshStandardMaterial({color:0x6a1d08,roughness:.6,metalness:.55,emissive:0xff4c08,emissiveIntensity:.22}),steel:new THREE.MeshStandardMaterial({color:0x343538,roughness:.5,metalness:.9}),wood:new THREE.MeshStandardMaterial({color:0x4d3524,roughness:.82}),brick:new THREE.MeshStandardMaterial({color:0x39271e,roughness:.94}),worker:new THREE.MeshStandardMaterial({color:0x24211c,roughness:.88}),cloth:new THREE.MeshStandardMaterial({color:0x50483f,roughness:.95}),leather:new THREE.MeshStandardMaterial({color:0x3a2a20,roughness:.92})};
function mesh(g,m,p=[0,0,0],r=[0,0,0],cast=true,recv=true){const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.castShadow=cast;o.receiveShadow=recv;return o}
