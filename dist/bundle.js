(()=>{var iu=0,fc=1,su=2;var qi=1,ru=2,Ls=3,si=0,Ue=1,$e=2,Xn=0,Cn=1,oi=2,pc=3,mc=4,ou=5;var _i=100,au=101,lu=102,cu=103,hu=104,uu=200,du=201,fu=202,pu=203,wo=204,Ao=205,mu=206,gu=207,xu=208,_u=209,vu=210,yu=211,Mu=212,Su=213,bu=214,Ro=0,Co=1,Po=2,Vi=3,Io=4,Lo=5,Do=6,Uo=7,gc=0,Eu=1,Tu=2,In=0,xc=1,_c=2,vc=3,Ur=4,yc=5,Mc=6,Sc=7;var bc=300,Ei=301,Yi=302,fa=303,pa=304,Nr=306,vi=1e3,Mn=1001,No=1002,ze=1003,wu=1004;var Fr=1005;var Ie=1006,ma=1007;var Ti=1008;var rn=1009,Ec=1010,Tc=1011,Ds=1012,ga=1013,Ln=1014,Sn=1015,qn=1016,xa=1017,_a=1018,Us=1020,wc=35902,Ac=35899,Rc=1021,Cc=1022,on=1023,zn=1026,wi=1027,va=1028,ya=1029,Ai=1030,Ma=1031;var Sa=1033,Or=33776,Br=33777,zr=33778,Vr=33779,ba=35840,Ea=35841,Ta=35842,wa=35843,Aa=36196,Ra=37492,Ca=37496,Pa=37488,Ia=37489,kr=37490,La=37491,Da=37808,Ua=37809,Na=37810,Fa=37811,Oa=37812,Ba=37813,za=37814,Va=37815,ka=37816,Ha=37817,Ga=37818,Wa=37819,Xa=37820,qa=37821,Ya=36492,Za=36494,$a=36495,Ja=36283,Ka=36284,Hr=36285,Qa=36286;var ir=2300,Fo=2301,To=2302,Ql=2303,jl=2400,tc=2401,ec=2402;var Au=3200;var ja=0,Ru=1,ai="",De="srgb",sr="srgb-linear",rr="linear",ue="srgb";var Oi=7680;var nc=519,Cu=512,Pu=513,Iu=514,tl=515,Lu=516,Du=517,el=518,Uu=519,Oo=35044,Pc=35048;var Ic="300 es",Rn=2e3,_s=2001;function mf(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function gf(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function or(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Nu(){let i=or("canvas");return i.style.display="block",i}var bh={},vs=null;function ar(...i){let t="THREE."+i.shift();vs?vs("log",t,...i):console.log(t,...i)}function Fu(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Bt(...i){i=Fu(i);let t="THREE."+i.shift();if(vs)vs("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Ft(...i){i=Fu(i);let t="THREE."+i.shift();if(vs)vs("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function zi(...i){let t=i.join(" ");t in bh||(bh[t]=!0,Bt(...i))}function Ou(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var Bu={[Ro]:Co,[Po]:Do,[Io]:Uo,[Vi]:Lo,[Co]:Ro,[Do]:Po,[Uo]:Io,[Lo]:Vi},Vn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}},qe=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var El=Math.PI/180,Bo=180/Math.PI;function ni(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(qe[i&255]+qe[i>>8&255]+qe[i>>16&255]+qe[i>>24&255]+"-"+qe[t&255]+qe[t>>8&255]+"-"+qe[t>>16&15|64]+qe[t>>24&255]+"-"+qe[e&63|128]+qe[e>>8&255]+"-"+qe[e>>16&255]+qe[e>>24&255]+qe[n&255]+qe[n>>8&255]+qe[n>>16&255]+qe[n>>24&255]).toLowerCase()}function ie(i,t,e){return Math.max(t,Math.min(e,i))}function xf(i,t){return(i%t+t)%t}function Tl(i,t,e){return(1-e)*i+e*t}function Bn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function me(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Oc=class Oc{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ie(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Oc.prototype.isVector2=!0;var it=Oc,Qe=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],d=n[s+3],u=r[o+0],f=r[o+1],g=r[o+2],_=r[o+3];if(d!==_||l!==u||c!==f||h!==g){let p=l*u+c*f+h*g+d*_;p<0&&(u=-u,f=-f,g=-g,_=-_,p=-p);let m=1-a;if(p<.9995){let M=Math.acos(p),S=Math.sin(M);m=Math.sin(m*M)/S,a=Math.sin(a*M)/S,l=l*m+u*a,c=c*m+f*a,h=h*m+g*a,d=d*m+_*a}else{l=l*m+u*a,c=c*m+f*a,h=h*m+g*a,d=d*m+_*a;let M=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=M,c*=M,h*=M,d*=M}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=d}static multiplyQuaternionsFlat(t,e,n,s,r,o){let a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],d=r[o],u=r[o+1],f=r[o+2],g=r[o+3];return t[e]=a*g+h*d+l*f-c*u,t[e+1]=l*g+h*u+c*d-a*f,t[e+2]=c*g+h*f+a*u-l*d,t[e+3]=h*g-a*d-l*u-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),d=a(r/2),u=l(n/2),f=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"YZX":this._x=u*h*d+c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d-u*f*g;break;case"XZY":this._x=u*h*d-c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d+u*f*g;break;default:Bt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],d=e[10],u=n+a+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(o-s)*f}else if(n>a&&n>d){let f=2*Math.sqrt(1+n-a-d);this._w=(h-l)/f,this._x=.25*f,this._y=(s+o)/f,this._z=(r+c)/f}else if(a>d){let f=2*Math.sqrt(1+a-n-d);this._w=(r-c)/f,this._x=(s+o)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+d-n-a);this._w=(o-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(ie(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(n=-n,s=-s,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Bc=class Bc{constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Eh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Eh.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),h=2*(a*e-r*s),d=2*(r*n-o*e);return this.x=e+l*c+o*d-a*h,this.y=n+l*h+a*c-r*d,this.z=s+l*d+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this.z=ie(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this.z=ie(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return wl.copy(this).projectOnVector(t),this.sub(wl)}reflect(t){return this.sub(wl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ie(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Bc.prototype.isVector3=!0;var R=Bc,wl=new R,Eh=new Qe,zc=class zc{constructor(t,e,n,s,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],_=s[0],p=s[3],m=s[6],M=s[1],S=s[4],y=s[7],w=s[2],E=s[5],C=s[8];return r[0]=o*_+a*M+l*w,r[3]=o*p+a*S+l*E,r[6]=o*m+a*y+l*C,r[1]=c*_+h*M+d*w,r[4]=c*p+h*S+d*E,r[7]=c*m+h*y+d*C,r[2]=u*_+f*M+g*w,r[5]=u*p+f*S+g*E,r[8]=u*m+f*y+g*C,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],d=h*o-a*c,u=a*l-h*r,f=c*r-o*l,g=e*d+n*u+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/g;return t[0]=d*_,t[1]=(s*c-h*n)*_,t[2]=(a*n-s*o)*_,t[3]=u*_,t[4]=(h*e-s*l)*_,t[5]=(s*r-a*e)*_,t[6]=f*_,t[7]=(n*l-c*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return zi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Al.makeScale(t,e)),this}rotate(t){return zi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Al.makeRotation(-t)),this}translate(t,e){return zi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Al.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}};zc.prototype.isMatrix3=!0;var Yt=zc,Al=new Yt,Th=new Yt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),wh=new Yt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function _f(){let i={enabled:!0,workingColorSpace:sr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ue&&(s.r=ii(s.r),s.g=ii(s.g),s.b=ii(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ue&&(s.r=xs(s.r),s.g=xs(s.g),s.b=xs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ai?rr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return zi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return zi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[sr]:{primaries:t,whitePoint:n,transfer:rr,toXYZ:Th,fromXYZ:wh,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:De},outputColorSpaceConfig:{drawingBufferColorSpace:De}},[De]:{primaries:t,whitePoint:n,transfer:ue,toXYZ:Th,fromXYZ:wh,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:De}}}),i}var oe=_f();function ii(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function xs(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var ts,zo=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{ts===void 0&&(ts=or("canvas")),ts.width=t.width,ts.height=t.height;let s=ts.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=ts}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=or("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=ii(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(ii(e[n]/255)*255):e[n]=ii(e[n]);return{data:e,width:t.width,height:t.height}}else return Bt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},vf=0,ys=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:vf++}),this.uuid=ni(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Rl(s[o].image)):r.push(Rl(s[o]))}else r=Rl(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Rl(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?zo.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Bt("Texture: Unable to serialize Texture."),{})}var yf=0,Cl=new R,je=class i extends Vn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=Mn,s=Mn,r=Ie,o=Ti,a=on,l=rn,c=i.DEFAULT_ANISOTROPY,h=ai){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:yf++}),this.uuid=ni(),this.name="",this.source=new ys(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new it(0,0),this.repeat=new it(1,1),this.center=new it(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Yt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Cl).x}get height(){return this.source.getSize(Cl).y}get depth(){return this.source.getSize(Cl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Bt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Bt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==bc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case vi:t.x=t.x-Math.floor(t.x);break;case Mn:t.x=t.x<0?0:1;break;case No:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case vi:t.y=t.y-Math.floor(t.y);break;case Mn:t.y=t.y<0?0:1;break;case No:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};je.DEFAULT_IMAGE=null;je.DEFAULT_MAPPING=bc;je.DEFAULT_ANISOTROPY=1;var Vc=class Vc{constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],g=l[9],_=l[2],p=l[6],m=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-_)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+_)<.1&&Math.abs(g+p)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let S=(c+1)/2,y=(f+1)/2,w=(m+1)/2,E=(h+u)/4,C=(d+_)/4,x=(g+p)/4;return S>y&&S>w?S<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(S),s=E/n,r=C/n):y>w?y<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(y),n=E/s,r=x/s):w<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),n=C/r,s=x/r),this.set(n,s,r,e),this}let M=Math.sqrt((p-g)*(p-g)+(d-_)*(d-_)+(u-h)*(u-h));return Math.abs(M)<.001&&(M=1),this.x=(p-g)/M,this.y=(d-_)/M,this.z=(u-h)/M,this.w=Math.acos((c+f+m-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this.z=ie(this.z,t.z,e.z),this.w=ie(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this.z=ie(this.z,t,e),this.w=ie(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Vc.prototype.isVector4=!0;var be=Vc,Vo=class extends Vn{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ie,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new be(0,0,t,e),this.scissorTest=!1,this.viewport=new be(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new je(s),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Ie,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new ys(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},pn=class extends Vo{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},lr=class extends je{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ze,this.minFilter=ze,this.wrapR=Mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var ko=class extends je{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ze,this.minFilter=ze,this.wrapR=Mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var da=class da{constructor(t,e,n,s,r,o,a,l,c,h,d,u,f,g,_,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,h,d,u,f,g,_,p)}set(t,e,n,s,r,o,a,l,c,h,d,u,f,g,_,p){let m=this.elements;return m[0]=t,m[4]=e,m[8]=n,m[12]=s,m[1]=r,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=h,m[10]=d,m[14]=u,m[3]=f,m[7]=g,m[11]=_,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new da().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/es.setFromMatrixColumn(t,0).length(),r=1/es.setFromMatrixColumn(t,1).length(),o=1/es.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),d=Math.sin(r);if(t.order==="XYZ"){let u=o*h,f=o*d,g=a*h,_=a*d;e[0]=l*h,e[4]=-l*d,e[8]=c,e[1]=f+g*c,e[5]=u-_*c,e[9]=-a*l,e[2]=_-u*c,e[6]=g+f*c,e[10]=o*l}else if(t.order==="YXZ"){let u=l*h,f=l*d,g=c*h,_=c*d;e[0]=u+_*a,e[4]=g*a-f,e[8]=o*c,e[1]=o*d,e[5]=o*h,e[9]=-a,e[2]=f*a-g,e[6]=_+u*a,e[10]=o*l}else if(t.order==="ZXY"){let u=l*h,f=l*d,g=c*h,_=c*d;e[0]=u-_*a,e[4]=-o*d,e[8]=g+f*a,e[1]=f+g*a,e[5]=o*h,e[9]=_-u*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let u=o*h,f=o*d,g=a*h,_=a*d;e[0]=l*h,e[4]=g*c-f,e[8]=u*c+_,e[1]=l*d,e[5]=_*c+u,e[9]=f*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let u=o*l,f=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=_-u*d,e[8]=g*d+f,e[1]=d,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=f*d+g,e[10]=u-_*d}else if(t.order==="XZY"){let u=o*l,f=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=-d,e[8]=c*h,e[1]=u*d+_,e[5]=o*h,e[9]=f*d-g,e[2]=g*d-f,e[6]=a*h,e[10]=_*d+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Mf,t,Sf)}lookAt(t,e,n){let s=this.elements;return dn.subVectors(t,e),dn.lengthSq()===0&&(dn.z=1),dn.normalize(),di.crossVectors(n,dn),di.lengthSq()===0&&(Math.abs(n.z)===1?dn.x+=1e-4:dn.z+=1e-4,dn.normalize(),di.crossVectors(n,dn)),di.normalize(),Jr.crossVectors(dn,di),s[0]=di.x,s[4]=Jr.x,s[8]=dn.x,s[1]=di.y,s[5]=Jr.y,s[9]=dn.y,s[2]=di.z,s[6]=Jr.z,s[10]=dn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],_=n[6],p=n[10],m=n[14],M=n[3],S=n[7],y=n[11],w=n[15],E=s[0],C=s[4],x=s[8],T=s[12],P=s[1],I=s[5],U=s[9],G=s[13],X=s[2],F=s[6],W=s[10],k=s[14],K=s[3],Q=s[7],rt=s[11],ot=s[15];return r[0]=o*E+a*P+l*X+c*K,r[4]=o*C+a*I+l*F+c*Q,r[8]=o*x+a*U+l*W+c*rt,r[12]=o*T+a*G+l*k+c*ot,r[1]=h*E+d*P+u*X+f*K,r[5]=h*C+d*I+u*F+f*Q,r[9]=h*x+d*U+u*W+f*rt,r[13]=h*T+d*G+u*k+f*ot,r[2]=g*E+_*P+p*X+m*K,r[6]=g*C+_*I+p*F+m*Q,r[10]=g*x+_*U+p*W+m*rt,r[14]=g*T+_*G+p*k+m*ot,r[3]=M*E+S*P+y*X+w*K,r[7]=M*C+S*I+y*F+w*Q,r[11]=M*x+S*U+y*W+w*rt,r[15]=M*T+S*G+y*k+w*ot,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],d=t[6],u=t[10],f=t[14],g=t[3],_=t[7],p=t[11],m=t[15],M=l*f-c*u,S=a*f-c*d,y=a*u-l*d,w=o*f-c*h,E=o*u-l*h,C=o*d-a*h;return e*(_*M-p*S+m*y)-n*(g*M-p*w+m*E)+s*(g*S-_*w+m*C)-r*(g*y-_*E+p*C)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10];return e*(o*h-a*c)-n*(r*h-a*l)+s*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],d=t[9],u=t[10],f=t[11],g=t[12],_=t[13],p=t[14],m=t[15],M=e*a-n*o,S=e*l-s*o,y=e*c-r*o,w=n*l-s*a,E=n*c-r*a,C=s*c-r*l,x=h*_-d*g,T=h*p-u*g,P=h*m-f*g,I=d*p-u*_,U=d*m-f*_,G=u*m-f*p,X=M*G-S*U+y*I+w*P-E*T+C*x;if(X===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/X;return t[0]=(a*G-l*U+c*I)*F,t[1]=(s*U-n*G-r*I)*F,t[2]=(_*C-p*E+m*w)*F,t[3]=(u*E-d*C-f*w)*F,t[4]=(l*P-o*G-c*T)*F,t[5]=(e*G-s*P+r*T)*F,t[6]=(p*y-g*C-m*S)*F,t[7]=(h*C-u*y+f*S)*F,t[8]=(o*U-a*P+c*x)*F,t[9]=(n*P-e*U-r*x)*F,t[10]=(g*E-_*y+m*M)*F,t[11]=(d*y-h*E-f*M)*F,t[12]=(a*T-o*I-l*x)*F,t[13]=(e*I-n*T+s*x)*F,t[14]=(_*S-g*w-p*M)*F,t[15]=(h*w-d*S+u*M)*F,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,d=a+a,u=r*c,f=r*h,g=r*d,_=o*h,p=o*d,m=a*d,M=l*c,S=l*h,y=l*d,w=n.x,E=n.y,C=n.z;return s[0]=(1-(_+m))*w,s[1]=(f+y)*w,s[2]=(g-S)*w,s[3]=0,s[4]=(f-y)*E,s[5]=(1-(u+m))*E,s[6]=(p+M)*E,s[7]=0,s[8]=(g+S)*C,s[9]=(p-M)*C,s[10]=(1-(u+_))*C,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let o=es.set(s[0],s[1],s[2]).length(),a=es.set(s[4],s[5],s[6]).length(),l=es.set(s[8],s[9],s[10]).length();r<0&&(o=-o),Tn.copy(this);let c=1/o,h=1/a,d=1/l;return Tn.elements[0]*=c,Tn.elements[1]*=c,Tn.elements[2]*=c,Tn.elements[4]*=h,Tn.elements[5]*=h,Tn.elements[6]*=h,Tn.elements[8]*=d,Tn.elements[9]*=d,Tn.elements[10]*=d,e.setFromRotationMatrix(Tn),n.x=o,n.y=a,n.z=l,this}makePerspective(t,e,n,s,r,o,a=Rn,l=!1){let c=this.elements,h=2*r/(e-t),d=2*r/(n-s),u=(e+t)/(e-t),f=(n+s)/(n-s),g,_;if(l)g=r/(o-r),_=o*r/(o-r);else if(a===Rn)g=-(o+r)/(o-r),_=-2*o*r/(o-r);else if(a===_s)g=-o/(o-r),_=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Rn,l=!1){let c=this.elements,h=2/(e-t),d=2/(n-s),u=-(e+t)/(e-t),f=-(n+s)/(n-s),g,_;if(l)g=1/(o-r),_=o/(o-r);else if(a===Rn)g=-2/(o-r),_=-(o+r)/(o-r);else if(a===_s)g=-1/(o-r),_=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}};da.prototype.isMatrix4=!0;var ae=da,es=new R,Tn=new ae,Mf=new R(0,0,0),Sf=new R(1,1,1),di=new R,Jr=new R,dn=new R,Ah=new ae,Rh=new Qe,Pn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],d=s[2],u=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(ie(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ie(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(ie(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-ie(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(ie(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-ie(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Bt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Ah.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Ah,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Rh.setFromEuler(this),this.setFromQuaternion(Rh,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Pn.DEFAULT_ORDER="XYZ";var Ms=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},bf=0,Ch=new R,ns=new Qe,Jn=new ae,Kr=new R,Xs=new R,Ef=new R,Tf=new Qe,Ph=new R(1,0,0),Ih=new R(0,1,0),Lh=new R(0,0,1),Dh={type:"added"},wf={type:"removed"},is={type:"childadded",child:null},Pl={type:"childremoved",child:null},Ve=class i extends Vn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:bf++}),this.uuid=ni(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new R,e=new Pn,n=new Qe,s=new R(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ae},normalMatrix:{value:new Yt}}),this.matrix=new ae,this.matrixWorld=new ae,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ms,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ns.setFromAxisAngle(t,e),this.quaternion.multiply(ns),this}rotateOnWorldAxis(t,e){return ns.setFromAxisAngle(t,e),this.quaternion.premultiply(ns),this}rotateX(t){return this.rotateOnAxis(Ph,t)}rotateY(t){return this.rotateOnAxis(Ih,t)}rotateZ(t){return this.rotateOnAxis(Lh,t)}translateOnAxis(t,e){return Ch.copy(t).applyQuaternion(this.quaternion),this.position.add(Ch.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ph,t)}translateY(t){return this.translateOnAxis(Ih,t)}translateZ(t){return this.translateOnAxis(Lh,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Jn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Kr.copy(t):Kr.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),Xs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Jn.lookAt(Xs,Kr,this.up):Jn.lookAt(Kr,Xs,this.up),this.quaternion.setFromRotationMatrix(Jn),s&&(Jn.extractRotation(s.matrixWorld),ns.setFromRotationMatrix(Jn),this.quaternion.premultiply(ns.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Ft("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Dh),is.child=t,this.dispatchEvent(is),is.child=null):Ft("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(wf),Pl.child=t,this.dispatchEvent(Pl),Pl.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Jn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Jn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Jn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Dh),is.child=t,this.dispatchEvent(is),is.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xs,t,Ef),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xs,Tf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];r(t.shapes,d)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),d=o(t.shapes),u=o(t.skeletons),f=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};Ve.DEFAULT_UP=new R(0,1,0);Ve.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ve.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Se=class extends Ve{constructor(){super(),this.isGroup=!0,this.type="Group"}},Af={type:"move"},Ss=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Se,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Se,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new R,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new R),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Se,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new R,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new R,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let _ of t.hand.values()){let p=e.getJointPose(_,n),m=this._getHandJoint(c,_);p!==null&&(m.matrix.fromArray(p.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=p.radius),m.visible=p!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&u>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Af)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new Se;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},zu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},fi={h:0,s:0,l:0},Qr={h:0,s:0,l:0};function Il(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Ht=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=De){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,oe.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=oe.workingColorSpace){return this.r=t,this.g=e,this.b=n,oe.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=oe.workingColorSpace){if(t=xf(t,1),e=ie(e,0,1),n=ie(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=Il(o,r,t+1/3),this.g=Il(o,r,t),this.b=Il(o,r,t-1/3)}return oe.colorSpaceToWorking(this,s),this}setStyle(t,e=De){function n(r){r!==void 0&&parseFloat(r)<1&&Bt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Bt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);Bt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=De){let n=zu[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Bt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=ii(t.r),this.g=ii(t.g),this.b=ii(t.b),this}copyLinearToSRGB(t){return this.r=xs(t.r),this.g=xs(t.g),this.b=xs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=De){return oe.workingToColorSpace(Ye.copy(this),t),Math.round(ie(Ye.r*255,0,255))*65536+Math.round(ie(Ye.g*255,0,255))*256+Math.round(ie(Ye.b*255,0,255))}getHexString(t=De){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=oe.workingColorSpace){oe.workingToColorSpace(Ye.copy(this),e);let n=Ye.r,s=Ye.g,r=Ye.b,o=Math.max(n,s,r),a=Math.min(n,s,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let d=o-a;switch(c=h<=.5?d/(o+a):d/(2-o-a),o){case n:l=(s-r)/d+(s<r?6:0);break;case s:l=(r-n)/d+2;break;case r:l=(n-s)/d+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=oe.workingColorSpace){return oe.workingToColorSpace(Ye.copy(this),e),t.r=Ye.r,t.g=Ye.g,t.b=Ye.b,t}getStyle(t=De){oe.workingToColorSpace(Ye.copy(this),t);let e=Ye.r,n=Ye.g,s=Ye.b;return t!==De?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(fi),this.setHSL(fi.h+t,fi.s+e,fi.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(fi),t.getHSL(Qr);let n=Tl(fi.h,Qr.h,e),s=Tl(fi.s,Qr.s,e),r=Tl(fi.l,Qr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ye=new Ht;Ht.NAMES=zu;var cr=class i{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ht(t),this.density=e}clone(){return new i(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var hr=class extends Ve{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pn,this.environmentIntensity=1,this.environmentRotation=new Pn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}},wn=new R,Kn=new R,Ll=new R,Qn=new R,ss=new R,rs=new R,Uh=new R,Dl=new R,Ul=new R,Nl=new R,Fl=new be,Ol=new be,Bl=new be,ei=class i{constructor(t=new R,e=new R,n=new R){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),wn.subVectors(t,e),s.cross(wn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){wn.subVectors(s,e),Kn.subVectors(n,e),Ll.subVectors(t,e);let o=wn.dot(wn),a=wn.dot(Kn),l=wn.dot(Ll),c=Kn.dot(Kn),h=Kn.dot(Ll),d=o*c-a*a;if(d===0)return r.set(0,0,0),null;let u=1/d,f=(c*l-a*h)*u,g=(o*h-a*l)*u;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Qn)===null?!1:Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,Qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Qn.x),l.addScaledVector(o,Qn.y),l.addScaledVector(a,Qn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return Fl.setScalar(0),Ol.setScalar(0),Bl.setScalar(0),Fl.fromBufferAttribute(t,e),Ol.fromBufferAttribute(t,n),Bl.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Fl,r.x),o.addScaledVector(Ol,r.y),o.addScaledVector(Bl,r.z),o}static isFrontFacing(t,e,n,s){return wn.subVectors(n,e),Kn.subVectors(t,e),wn.cross(Kn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return wn.subVectors(this.c,this.b),Kn.subVectors(this.a,this.b),wn.cross(Kn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,o,a;ss.subVectors(s,n),rs.subVectors(r,n),Dl.subVectors(t,n);let l=ss.dot(Dl),c=rs.dot(Dl);if(l<=0&&c<=0)return e.copy(n);Ul.subVectors(t,s);let h=ss.dot(Ul),d=rs.dot(Ul);if(h>=0&&d<=h)return e.copy(s);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(n).addScaledVector(ss,o);Nl.subVectors(t,r);let f=ss.dot(Nl),g=rs.dot(Nl);if(g>=0&&f<=g)return e.copy(r);let _=f*c-l*g;if(_<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(rs,a);let p=h*g-f*d;if(p<=0&&d-h>=0&&f-g>=0)return Uh.subVectors(r,s),a=(d-h)/(d-h+(f-g)),e.copy(s).addScaledVector(Uh,a);let m=1/(p+_+u);return o=_*m,a=u*m,e.copy(n).addScaledVector(ss,o).addScaledVector(rs,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},kn=class{constructor(t=new R(1/0,1/0,1/0),e=new R(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(An.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(An.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=An.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,An):An.fromBufferAttribute(r,o),An.applyMatrix4(t.matrixWorld),this.expandByPoint(An);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),jr.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),jr.copy(n.boundingBox)),jr.applyMatrix4(t.matrixWorld),this.union(jr)}let s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,An),An.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(qs),to.subVectors(this.max,qs),os.subVectors(t.a,qs),as.subVectors(t.b,qs),ls.subVectors(t.c,qs),pi.subVectors(as,os),mi.subVectors(ls,as),Di.subVectors(os,ls);let e=[0,-pi.z,pi.y,0,-mi.z,mi.y,0,-Di.z,Di.y,pi.z,0,-pi.x,mi.z,0,-mi.x,Di.z,0,-Di.x,-pi.y,pi.x,0,-mi.y,mi.x,0,-Di.y,Di.x,0];return!zl(e,os,as,ls,to)||(e=[1,0,0,0,1,0,0,0,1],!zl(e,os,as,ls,to))?!1:(eo.crossVectors(pi,mi),e=[eo.x,eo.y,eo.z],zl(e,os,as,ls,to))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,An).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(An).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(jn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},jn=[new R,new R,new R,new R,new R,new R,new R,new R],An=new R,jr=new kn,os=new R,as=new R,ls=new R,pi=new R,mi=new R,Di=new R,qs=new R,to=new R,eo=new R,Ui=new R;function zl(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){Ui.fromArray(i,r);let a=s.x*Math.abs(Ui.x)+s.y*Math.abs(Ui.y)+s.z*Math.abs(Ui.z),l=t.dot(Ui),c=e.dot(Ui),h=n.dot(Ui);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Pe=new R,no=new it,Rf=0,ye=class extends Vn{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Rf++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Oo,this.updateRanges=[],this.gpuType=Sn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)no.fromBufferAttribute(this,e),no.applyMatrix3(t),this.setXY(e,no.x,no.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix3(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix4(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyNormalMatrix(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.transformDirection(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Bn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=me(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Bn(e,this.array)),e}setX(t,e){return this.normalized&&(e=me(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Bn(e,this.array)),e}setY(t,e){return this.normalized&&(e=me(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Bn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=me(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Bn(e,this.array)),e}setW(t,e){return this.normalized&&(e=me(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=me(e,this.array),n=me(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=me(e,this.array),n=me(n,this.array),s=me(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=me(e,this.array),n=me(n,this.array),s=me(s,this.array),r=me(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Oo&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var ur=class extends ye{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var dr=class extends ye{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var qt=class extends ye{constructor(t,e,n){super(new Float32Array(t),e,n)}},Cf=new kn,Ys=new R,Vl=new R,mn=class{constructor(t=new R,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Cf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ys.subVectors(t,this.center);let e=Ys.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(Ys,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Vl.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ys.copy(t.center).add(Vl)),this.expandByPoint(Ys.copy(t.center).sub(Vl))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Pf=0,vn=new ae,kl=new Ve,cs=new R,fn=new kn,Zs=new kn,Be=new R,de=class i extends Vn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Pf++}),this.uuid=ni(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(mf(t)?dr:ur)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Yt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return vn.makeRotationFromQuaternion(t),this.applyMatrix4(vn),this}rotateX(t){return vn.makeRotationX(t),this.applyMatrix4(vn),this}rotateY(t){return vn.makeRotationY(t),this.applyMatrix4(vn),this}rotateZ(t){return vn.makeRotationZ(t),this.applyMatrix4(vn),this}translate(t,e,n){return vn.makeTranslation(t,e,n),this.applyMatrix4(vn),this}scale(t,e,n){return vn.makeScale(t,e,n),this.applyMatrix4(vn),this}lookAt(t){return kl.lookAt(t),kl.updateMatrix(),this.applyMatrix4(kl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(cs).negate(),this.translate(cs.x,cs.y,cs.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new qt(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Bt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new kn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ft("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new R(-1/0,-1/0,-1/0),new R(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];fn.setFromBufferAttribute(r),this.morphTargetsRelative?(Be.addVectors(this.boundingBox.min,fn.min),this.boundingBox.expandByPoint(Be),Be.addVectors(this.boundingBox.max,fn.max),this.boundingBox.expandByPoint(Be)):(this.boundingBox.expandByPoint(fn.min),this.boundingBox.expandByPoint(fn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ft('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new mn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ft("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new R,1/0);return}if(t){let n=this.boundingSphere.center;if(fn.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];Zs.setFromBufferAttribute(a),this.morphTargetsRelative?(Be.addVectors(fn.min,Zs.min),fn.expandByPoint(Be),Be.addVectors(fn.max,Zs.max),fn.expandByPoint(Be)):(fn.expandByPoint(Zs.min),fn.expandByPoint(Zs.max))}fn.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Be.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Be));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Be.fromBufferAttribute(a,c),l&&(cs.fromBufferAttribute(t,c),Be.add(cs)),s=Math.max(s,n.distanceToSquared(Be))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ft('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Ft("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new ye(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let x=0;x<n.count;x++)a[x]=new R,l[x]=new R;let c=new R,h=new R,d=new R,u=new it,f=new it,g=new it,_=new R,p=new R;function m(x,T,P){c.fromBufferAttribute(n,x),h.fromBufferAttribute(n,T),d.fromBufferAttribute(n,P),u.fromBufferAttribute(r,x),f.fromBufferAttribute(r,T),g.fromBufferAttribute(r,P),h.sub(c),d.sub(c),f.sub(u),g.sub(u);let I=1/(f.x*g.y-g.x*f.y);isFinite(I)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(I),p.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(I),a[x].add(_),a[T].add(_),a[P].add(_),l[x].add(p),l[T].add(p),l[P].add(p))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let x=0,T=M.length;x<T;++x){let P=M[x],I=P.start,U=P.count;for(let G=I,X=I+U;G<X;G+=3)m(t.getX(G+0),t.getX(G+1),t.getX(G+2))}let S=new R,y=new R,w=new R,E=new R;function C(x){w.fromBufferAttribute(s,x),E.copy(w);let T=a[x];S.copy(T),S.sub(w.multiplyScalar(w.dot(T))).normalize(),y.crossVectors(E,T);let I=y.dot(l[x])<0?-1:1;o.setXYZW(x,S.x,S.y,S.z,I)}for(let x=0,T=M.length;x<T;++x){let P=M[x],I=P.start,U=P.count;for(let G=I,X=I+U;G<X;G+=3)C(t.getX(G+0)),C(t.getX(G+1)),C(t.getX(G+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new ye(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);let s=new R,r=new R,o=new R,a=new R,l=new R,c=new R,h=new R,d=new R;if(t)for(let u=0,f=t.count;u<f;u+=3){let g=t.getX(u+0),_=t.getX(u+1),p=t.getX(u+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,p),h.subVectors(o,r),d.subVectors(s,r),h.cross(d),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,p),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,f=e.count;u<f;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),o.fromBufferAttribute(e,u+2),h.subVectors(o,r),d.subVectors(s,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Be.fromBufferAttribute(t,e),Be.normalize(),t.setXYZ(e,Be.x,Be.y,Be.z)}toNonIndexed(){function t(a,l){let c=a.array,h=a.itemSize,d=a.normalized,u=new c.constructor(l.length*h),f=0,g=0;for(let _=0,p=l.length;_<p;_++){a.isInterleavedBufferAttribute?f=l[_]*a.data.stride+a.offset:f=l[_]*h;for(let m=0;m<h;m++)u[g++]=c[f++]}return new ye(u,h,d)}if(this.index===null)return Bt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let a in s){let l=s[a],c=t(l,n);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,d=c.length;h<d;h++){let u=c[h],f=t(u,n);l.push(f)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let f=c[d];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],d=r[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,h=o.length;c<h;c++){let d=o[c];this.addGroup(d.start,d.count,d.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},fr=class{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Oo,this.updateRanges=[],this.version=0,this.uuid=ni()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ni()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ni()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Ke=new R,bs=class i{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Ke.fromBufferAttribute(this,e),Ke.applyMatrix4(t),this.setXYZ(e,Ke.x,Ke.y,Ke.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ke.fromBufferAttribute(this,e),Ke.applyNormalMatrix(t),this.setXYZ(e,Ke.x,Ke.y,Ke.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ke.fromBufferAttribute(this,e),Ke.transformDirection(t),this.setXYZ(e,Ke.x,Ke.y,Ke.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=Bn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=me(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=me(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=me(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=me(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=me(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=Bn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=Bn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=Bn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=Bn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=me(e,this.array),n=me(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=me(e,this.array),n=me(n,this.array),s=me(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=me(e,this.array),n=me(n,this.array),s=me(s,this.array),r=me(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){ar("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let n=0;n<this.count;n++){let s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new ye(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new i(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){ar("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let n=0;n<this.count;n++){let s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},If=0,Hn=class extends Vn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:If++}),this.uuid=ni(),this.name="",this.type="Material",this.blending=Cn,this.side=si,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=wo,this.blendDst=Ao,this.blendEquation=_i,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ht(0,0,0),this.blendAlpha=0,this.depthFunc=Vi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=nc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Oi,this.stencilZFail=Oi,this.stencilZPass=Oi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Bt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Bt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Cn&&(n.blending=this.blending),this.side!==si&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==wo&&(n.blendSrc=this.blendSrc),this.blendDst!==Ao&&(n.blendDst=this.blendDst),this.blendEquation!==_i&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Vi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==nc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Oi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Oi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Oi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Ht().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new it().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new it().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}},yi=class extends Hn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Ht(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},hs,$s=new R,us=new R,ds=new R,fs=new it,Js=new it,Vu=new ae,io=new R,Ks=new R,so=new R,Nh=new it,Hl=new it,Fh=new it,ki=class extends Ve{constructor(t=new yi){if(super(),this.isSprite=!0,this.type="Sprite",hs===void 0){hs=new de;let e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new fr(e,5);hs.setIndex([0,1,2,0,2,3]),hs.setAttribute("position",new bs(n,3,0,!1)),hs.setAttribute("uv",new bs(n,2,3,!1))}this.geometry=hs,this.material=t,this.center=new it(.5,.5),this.count=1}raycast(t,e){t.camera===null&&Ft('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),us.setFromMatrixScale(this.matrixWorld),Vu.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),ds.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&us.multiplyScalar(-ds.z);let n=this.material.rotation,s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));let o=this.center;ro(io.set(-.5,-.5,0),ds,o,us,s,r),ro(Ks.set(.5,-.5,0),ds,o,us,s,r),ro(so.set(.5,.5,0),ds,o,us,s,r),Nh.set(0,0),Hl.set(1,0),Fh.set(1,1);let a=t.ray.intersectTriangle(io,Ks,so,!1,$s);if(a===null&&(ro(Ks.set(-.5,.5,0),ds,o,us,s,r),Hl.set(0,1),a=t.ray.intersectTriangle(io,so,Ks,!1,$s),a===null))return;let l=t.ray.origin.distanceTo($s);l<t.near||l>t.far||e.push({distance:l,point:$s.clone(),uv:ei.getInterpolation($s,io,Ks,so,Nh,Hl,Fh,new it),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}};function ro(i,t,e,n,s,r){fs.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(Js.x=r*fs.x-s*fs.y,Js.y=s*fs.x+r*fs.y):Js.copy(fs),i.copy(t),i.x+=Js.x,i.y+=Js.y,i.applyMatrix4(Vu)}var ti=new R,Gl=new R,oo=new R,gi=new R,Wl=new R,ao=new R,Xl=new R,Es=class{constructor(t=new R,e=new R(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,ti)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=ti.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(ti.copy(this.origin).addScaledVector(this.direction,e),ti.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Gl.copy(t).add(e).multiplyScalar(.5),oo.copy(e).sub(t).normalize(),gi.copy(this.origin).sub(Gl);let r=t.distanceTo(e)*.5,o=-this.direction.dot(oo),a=gi.dot(this.direction),l=-gi.dot(oo),c=gi.lengthSq(),h=Math.abs(1-o*o),d,u,f,g;if(h>0)if(d=o*l-a,u=o*a-l,g=r*h,d>=0)if(u>=-g)if(u<=g){let _=1/h;d*=_,u*=_,f=d*(d+o*u+2*a)+u*(o*d+u+2*l)+c}else u=r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;else u=-r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;else u<=-g?(d=Math.max(0,-(-o*r+a)),u=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c):u<=g?(d=0,u=Math.min(Math.max(-r,-l),r),f=u*(u+2*l)+c):(d=Math.max(0,-(o*r+a)),u=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c);else u=o>0?-r:r,d=Math.max(0,-(o*u+a)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(Gl).addScaledVector(oo,u),f}intersectSphere(t,e){ti.subVectors(t.center,this.origin);let n=ti.dot(this.direction),s=ti.dot(ti)-n*n,r=t.radius*t.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,o=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,o=(t.min.y-u.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),d>=0?(a=(t.min.z-u.z)*d,l=(t.max.z-u.z)*d):(a=(t.max.z-u.z)*d,l=(t.min.z-u.z)*d),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,ti)!==null}intersectTriangle(t,e,n,s,r){Wl.subVectors(e,t),ao.subVectors(n,t),Xl.crossVectors(Wl,ao);let o=this.direction.dot(Xl),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;gi.subVectors(this.origin,t);let l=a*this.direction.dot(ao.crossVectors(gi,ao));if(l<0)return null;let c=a*this.direction.dot(Wl.cross(gi));if(c<0||l+c>o)return null;let h=-a*gi.dot(Xl);return h<0?null:this.at(h/o,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Gn=class extends Hn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=gc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},Oh=new ae,Ni=new Es,lo=new mn,Bh=new R,co=new R,ho=new R,uo=new R,ql=new R,fo=new R,zh=new R,po=new R,zt=class extends Ve{constructor(t=new de,e=new Gn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let a=this.morphTargetInfluences;if(r&&a){fo.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],d=r[l];h!==0&&(ql.fromBufferAttribute(d,t),o?fo.addScaledVector(ql,h):fo.addScaledVector(ql.sub(e),h))}e.add(fo)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),lo.copy(n.boundingSphere),lo.applyMatrix4(r),Ni.copy(t.ray).recast(t.near),!(lo.containsPoint(Ni.origin)===!1&&(Ni.intersectSphere(lo,Bh)===null||Ni.origin.distanceToSquared(Bh)>(t.far-t.near)**2))&&(Oh.copy(r).invert(),Ni.copy(t.ray).applyMatrix4(Oh),!(n.boundingBox!==null&&Ni.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ni)))}_computeIntersections(t,e,n){let s,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=u.length;g<_;g++){let p=u[g],m=o[p.materialIndex],M=Math.max(p.start,f.start),S=Math.min(a.count,Math.min(p.start+p.count,f.start+f.count));for(let y=M,w=S;y<w;y+=3){let E=a.getX(y),C=a.getX(y+1),x=a.getX(y+2);s=mo(this,m,t,n,c,h,d,E,C,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),_=Math.min(a.count,f.start+f.count);for(let p=g,m=_;p<m;p+=3){let M=a.getX(p),S=a.getX(p+1),y=a.getX(p+2);s=mo(this,o,t,n,c,h,d,M,S,y),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,_=u.length;g<_;g++){let p=u[g],m=o[p.materialIndex],M=Math.max(p.start,f.start),S=Math.min(l.count,Math.min(p.start+p.count,f.start+f.count));for(let y=M,w=S;y<w;y+=3){let E=y,C=y+1,x=y+2;s=mo(this,m,t,n,c,h,d,E,C,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),_=Math.min(l.count,f.start+f.count);for(let p=g,m=_;p<m;p+=3){let M=p,S=p+1,y=p+2;s=mo(this,o,t,n,c,h,d,M,S,y),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}}};function Lf(i,t,e,n,s,r,o,a){let l;if(t.side===Ue?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===si,a),l===null)return null;po.copy(a),po.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(po);return c<e.near||c>e.far?null:{distance:c,point:po.clone(),object:i}}function mo(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,co),i.getVertexPosition(l,ho),i.getVertexPosition(c,uo);let h=Lf(i,t,e,n,co,ho,uo,zh);if(h){let d=new R;ei.getBarycoord(zh,co,ho,uo,d),s&&(h.uv=ei.getInterpolatedAttribute(s,a,l,c,d,new it)),r&&(h.uv1=ei.getInterpolatedAttribute(r,a,l,c,d,new it)),o&&(h.normal=ei.getInterpolatedAttribute(o,a,l,c,d,new R),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new R,materialIndex:0};ei.getNormal(co,ho,uo,u.normal),h.face=u,h.barycoord=d}return h}var Hi=class extends je{constructor(t=null,e=1,n=1,s,r,o,a,l,c=ze,h=ze,d,u){super(null,o,a,l,c,h,s,r,d,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ts=class extends ye{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},ps=new ae,Vh=new ae,go=[],kh=new kn,Df=new ae,Qs=new zt,js=new mn,pr=class extends zt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Ts(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Df)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new kn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,ps),kh.copy(t.boundingBox).applyMatrix4(ps),this.boundingBox.union(kh)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new mn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,ps),js.copy(t.boundingSphere).applyMatrix4(ps),this.boundingSphere.union(js)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(Qs.geometry=this.geometry,Qs.material=this.material,Qs.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),js.copy(this.boundingSphere),js.applyMatrix4(n),t.ray.intersectsSphere(js)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,ps),Vh.multiplyMatrices(n,ps),Qs.matrixWorld=Vh,Qs.raycast(t,go);for(let o=0,a=go.length;o<a;o++){let l=go[o];l.instanceId=r,l.object=this,e.push(l)}go.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new Ts(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Hi(new Float32Array(s*this.count),s,this.count,va,Sn));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Yl=new R,Uf=new R,Nf=new Yt,yn=class{constructor(t=new R(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Yl.subVectors(n,e).cross(Uf.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Yl),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(s,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Nf.getNormalMatrix(t),s=this.coplanarPoint(Yl).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Fi=new mn,Ff=new it(.5,.5),xo=new R,ws=class{constructor(t=new yn,e=new yn,n=new yn,s=new yn,r=new yn,o=new yn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Rn,n=!1){let s=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],d=r[5],u=r[6],f=r[7],g=r[8],_=r[9],p=r[10],m=r[11],M=r[12],S=r[13],y=r[14],w=r[15];if(s[0].setComponents(c-o,f-h,m-g,w-M).normalize(),s[1].setComponents(c+o,f+h,m+g,w+M).normalize(),s[2].setComponents(c+a,f+d,m+_,w+S).normalize(),s[3].setComponents(c-a,f-d,m-_,w-S).normalize(),n)s[4].setComponents(l,u,p,y).normalize(),s[5].setComponents(c-l,f-u,m-p,w-y).normalize();else if(s[4].setComponents(c-l,f-u,m-p,w-y).normalize(),e===Rn)s[5].setComponents(c+l,f+u,m+p,w+y).normalize();else if(e===_s)s[5].setComponents(l,u,p,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Fi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Fi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Fi)}intersectsSprite(t){Fi.center.set(0,0,0);let e=Ff.distanceTo(t.center);return Fi.radius=.7071067811865476+e,Fi.applyMatrix4(t.matrixWorld),this.intersectsSphere(Fi)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(xo.x=s.normal.x>0?t.max.x:t.min.x,xo.y=s.normal.y>0?t.max.y:t.min.y,xo.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(xo)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Ho=class extends Hn{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ht(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},Hh=new ae,ic=new Es,_o=new mn,vo=new R,Gi=class extends Ve{constructor(t=new de,e=new Ho){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),_o.copy(n.boundingSphere),_o.applyMatrix4(s),_o.radius+=r,t.ray.intersectsSphere(_o)===!1)return;Hh.copy(s).invert(),ic.copy(t.ray).applyMatrix4(Hh);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,d=n.attributes.position;if(c!==null){let u=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=u,_=f;g<_;g++){let p=c.getX(g);vo.fromBufferAttribute(d,p),Gh(vo,p,l,s,t,e,this)}}else{let u=Math.max(0,o.start),f=Math.min(d.count,o.start+o.count);for(let g=u,_=f;g<_;g++)vo.fromBufferAttribute(d,g),Gh(vo,g,l,s,t,e,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function Gh(i,t,e,n,s,r,o){let a=ic.distanceSqToPoint(i);if(a<e){let l=new R;ic.closestPointToPoint(i,l),l.applyMatrix4(n);let c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var mr=class extends je{constructor(t=[],e=Ei,n,s,r,o,a,l,c,h){super(t,e,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},Wi=class extends je{constructor(t,e,n,s,r,o,a,l,c){super(t,e,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var ri=class extends je{constructor(t,e,n=Ln,s,r,o,a=ze,l=ze,c,h=zn,d=1){if(h!==zn&&h!==wi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:d};super(u,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new ys(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},Go=class extends ri{constructor(t,e=Ln,n=Ei,s,r,o=ze,a=ze,l,c=zn){let h={width:t,height:t,depth:1},d=[h,h,h,h,h,h];super(t,t,e,n,s,r,o,a,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},gr=class extends je{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Le=class i extends de{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],d=[],u=0,f=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new qt(c,3)),this.setAttribute("normal",new qt(h,3)),this.setAttribute("uv",new qt(d,2));function g(_,p,m,M,S,y,w,E,C,x,T){let P=y/C,I=w/x,U=y/2,G=w/2,X=E/2,F=C+1,W=x+1,k=0,K=0,Q=new R;for(let rt=0;rt<W;rt++){let ot=rt*I-G;for(let ct=0;ct<F;ct++){let Gt=ct*P-U;Q[_]=Gt*M,Q[p]=ot*S,Q[m]=X,c.push(Q.x,Q.y,Q.z),Q[_]=0,Q[p]=0,Q[m]=E>0?1:-1,h.push(Q.x,Q.y,Q.z),d.push(ct/C),d.push(1-rt/x),k+=1}}for(let rt=0;rt<x;rt++)for(let ot=0;ot<C;ot++){let ct=u+ot+F*rt,Gt=u+ot+F*(rt+1),le=u+(ot+1)+F*(rt+1),te=u+(ot+1)+F*rt;l.push(ct,Gt,te),l.push(Gt,le,te),K+=6}a.addGroup(f,K,T),f+=K,u+=k}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var tn=class i extends de{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],d=[],u=[],f=[],g=0,_=[],p=n/2,m=0;M(),o===!1&&(t>0&&S(!0),e>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new qt(d,3)),this.setAttribute("normal",new qt(u,3)),this.setAttribute("uv",new qt(f,2));function M(){let y=new R,w=new R,E=0,C=(e-t)/n;for(let x=0;x<=r;x++){let T=[],P=x/r,I=P*(e-t)+t;for(let U=0;U<=s;U++){let G=U/s,X=G*l+a,F=Math.sin(X),W=Math.cos(X);w.x=I*F,w.y=-P*n+p,w.z=I*W,d.push(w.x,w.y,w.z),y.set(F,C,W).normalize(),u.push(y.x,y.y,y.z),f.push(G,1-P),T.push(g++)}_.push(T)}for(let x=0;x<s;x++)for(let T=0;T<r;T++){let P=_[T][x],I=_[T+1][x],U=_[T+1][x+1],G=_[T][x+1];(t>0||T!==0)&&(h.push(P,I,G),E+=3),(e>0||T!==r-1)&&(h.push(I,U,G),E+=3)}c.addGroup(m,E,0),m+=E}function S(y){let w=g,E=new it,C=new R,x=0,T=y===!0?t:e,P=y===!0?1:-1;for(let U=1;U<=s;U++)d.push(0,p*P,0),u.push(0,P,0),f.push(.5,.5),g++;let I=g;for(let U=0;U<=s;U++){let X=U/s*l+a,F=Math.cos(X),W=Math.sin(X);C.x=T*W,C.y=p*P,C.z=T*F,d.push(C.x,C.y,C.z),u.push(0,P,0),E.x=F*.5+.5,E.y=W*.5*P+.5,f.push(E.x,E.y),g++}for(let U=0;U<s;U++){let G=w+U,X=I+U;y===!0?h.push(X,X+1,G):h.push(X+1,X,G),x+=3}c.addGroup(m,x,y===!0?1:2),m+=x}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},xr=class i extends tn{constructor(t=1,e=1,n=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,t,e,n,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Wo=class i extends de{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};let r=[],o=[];a(s),c(n),h(),this.setAttribute("position",new qt(r,3)),this.setAttribute("normal",new qt(r.slice(),3)),this.setAttribute("uv",new qt(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(M){let S=new R,y=new R,w=new R;for(let E=0;E<e.length;E+=3)f(e[E+0],S),f(e[E+1],y),f(e[E+2],w),l(S,y,w,M)}function l(M,S,y,w){let E=w+1,C=[];for(let x=0;x<=E;x++){C[x]=[];let T=M.clone().lerp(y,x/E),P=S.clone().lerp(y,x/E),I=E-x;for(let U=0;U<=I;U++)U===0&&x===E?C[x][U]=T:C[x][U]=T.clone().lerp(P,U/I)}for(let x=0;x<E;x++)for(let T=0;T<2*(E-x)-1;T++){let P=Math.floor(T/2);T%2===0?(u(C[x][P+1]),u(C[x+1][P]),u(C[x][P])):(u(C[x][P+1]),u(C[x+1][P+1]),u(C[x+1][P]))}}function c(M){let S=new R;for(let y=0;y<r.length;y+=3)S.x=r[y+0],S.y=r[y+1],S.z=r[y+2],S.normalize().multiplyScalar(M),r[y+0]=S.x,r[y+1]=S.y,r[y+2]=S.z}function h(){let M=new R;for(let S=0;S<r.length;S+=3){M.x=r[S+0],M.y=r[S+1],M.z=r[S+2];let y=p(M)/2/Math.PI+.5,w=m(M)/Math.PI+.5;o.push(y,1-w)}g(),d()}function d(){for(let M=0;M<o.length;M+=6){let S=o[M+0],y=o[M+2],w=o[M+4],E=Math.max(S,y,w),C=Math.min(S,y,w);E>.9&&C<.1&&(S<.2&&(o[M+0]+=1),y<.2&&(o[M+2]+=1),w<.2&&(o[M+4]+=1))}}function u(M){r.push(M.x,M.y,M.z)}function f(M,S){let y=M*3;S.x=t[y+0],S.y=t[y+1],S.z=t[y+2]}function g(){let M=new R,S=new R,y=new R,w=new R,E=new it,C=new it,x=new it;for(let T=0,P=0;T<r.length;T+=9,P+=6){M.set(r[T+0],r[T+1],r[T+2]),S.set(r[T+3],r[T+4],r[T+5]),y.set(r[T+6],r[T+7],r[T+8]),E.set(o[P+0],o[P+1]),C.set(o[P+2],o[P+3]),x.set(o[P+4],o[P+5]),w.copy(M).add(S).add(y).divideScalar(3);let I=p(w);_(E,P+0,M,I),_(C,P+2,S,I),_(x,P+4,y,I)}}function _(M,S,y,w){w<0&&M.x===1&&(o[S]=M.x-1),y.x===0&&y.z===0&&(o[S]=w/2/Math.PI+.5)}function p(M){return Math.atan2(M.z,-M.x)}function m(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.vertices,t.indices,t.radius,t.detail)}};var gn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Bt("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,o;e?o=e:o=t*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=n[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===o)return s/(r-1);let h=n[s],u=n[s+1]-h,f=(o-h)/u;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let o=this.getPoint(s),a=this.getPoint(r),l=e||(o.isVector2?new it:new R);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new R,s=[],r=[],o=[],a=new R,l=new ae;for(let f=0;f<=t;f++){let g=f/t;s[f]=this.getTangentAt(g,new R)}r[0]=new R,o[0]=new R;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),d=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(s[f-1],s[f]),a.length()>Number.EPSILON){a.normalize();let g=Math.acos(ie(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(ie(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],f*g)),o[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},As=class extends gn{constructor(t=0,e=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new it){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);let a=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,f=c-this.aY;l=u*h-f*d+this.aX,c=u*d+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Xo=class extends As{constructor(t,e,n,s,r,o){super(t,e,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function Lc(){let i=0,t=0,e=0,n=0;function s(r,o,a,l){i=r,t=a,e=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,d){let u=(o-r)/c-(a-r)/(c+h)+(a-o)/h,f=(a-o)/h-(l-o)/(h+d)+(l-a)/d;u*=h,f*=h,s(o,a,u,f)},calc:function(r){let o=r*r,a=o*r;return i+t*r+e*o+n*a}}}var Wh=new R,Xh=new R,Zl=new Lc,$l=new Lc,Jl=new Lc,qo=class extends gn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new R){let n=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=s[(a-1)%r]:(Xh.subVectors(s[0],s[1]).add(s[0]),c=Xh);let d=s[a%r],u=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(Wh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Wh),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(d),f),_=Math.pow(d.distanceToSquared(u),f),p=Math.pow(u.distanceToSquared(h),f);_<1e-4&&(_=1),g<1e-4&&(g=_),p<1e-4&&(p=_),Zl.initNonuniformCatmullRom(c.x,d.x,u.x,h.x,g,_,p),$l.initNonuniformCatmullRom(c.y,d.y,u.y,h.y,g,_,p),Jl.initNonuniformCatmullRom(c.z,d.z,u.z,h.z,g,_,p)}else this.curveType==="catmullrom"&&(Zl.initCatmullRom(c.x,d.x,u.x,h.x,this.tension),$l.initCatmullRom(c.y,d.y,u.y,h.y,this.tension),Jl.initCatmullRom(c.z,d.z,u.z,h.z,this.tension));return n.set(Zl.calc(l),$l.calc(l),Jl.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new R().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function qh(i,t,e,n,s){let r=(n-t)*.5,o=(s-e)*.5,a=i*i,l=i*a;return(2*e-2*n+r+o)*l+(-3*e+3*n-2*r-o)*a+r*i+e}function Of(i,t){let e=1-i;return e*e*t}function Bf(i,t){return 2*(1-i)*i*t}function zf(i,t){return i*i*t}function er(i,t,e,n){return Of(i,t)+Bf(i,e)+zf(i,n)}function Vf(i,t){let e=1-i;return e*e*e*t}function kf(i,t){let e=1-i;return 3*e*e*i*t}function Hf(i,t){return 3*(1-i)*i*i*t}function Gf(i,t){return i*i*i*t}function nr(i,t,e,n,s){return Vf(i,t)+kf(i,e)+Hf(i,n)+Gf(i,s)}var _r=class extends gn{constructor(t=new it,e=new it,n=new it,s=new it){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new it){let n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(nr(t,s.x,r.x,o.x,a.x),nr(t,s.y,r.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Yo=class extends gn{constructor(t=new R,e=new R,n=new R,s=new R){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new R){let n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(nr(t,s.x,r.x,o.x,a.x),nr(t,s.y,r.y,o.y,a.y),nr(t,s.z,r.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},vr=class extends gn{constructor(t=new it,e=new it){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new it){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new it){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Zo=class extends gn{constructor(t=new R,e=new R){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new R){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new R){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},yr=class extends gn{constructor(t=new it,e=new it,n=new it){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new it){let n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(er(t,s.x,r.x,o.x),er(t,s.y,r.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},$o=class extends gn{constructor(t=new R,e=new R,n=new R){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new R){let n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(er(t,s.x,r.x,o.x),er(t,s.y,r.y,o.y),er(t,s.z,r.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Mr=class extends gn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new it){let n=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],h=s[o>s.length-2?s.length-1:o+1],d=s[o>s.length-3?s.length-1:o+2];return n.set(qh(a,l.x,c.x,h.x,d.x),qh(a,l.y,c.y,h.y,d.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new it().fromArray(s))}return this}},sc=Object.freeze({__proto__:null,ArcCurve:Xo,CatmullRomCurve3:qo,CubicBezierCurve:_r,CubicBezierCurve3:Yo,EllipseCurve:As,LineCurve:vr,LineCurve3:Zo,QuadraticBezierCurve:yr,QuadraticBezierCurve3:$o,SplineCurve:Mr}),Jo=class extends gn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new sc[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let o=s[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new sc[s.type]().fromJSON(s))}return this}},Sr=class extends Jo{constructor(t){super(),this.type="Path",this.currentPoint=new it,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new vr(this.currentPoint.clone(),new it(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new yr(this.currentPoint.clone(),new it(t,e),new it(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,o){let a=new _r(this.currentPoint.clone(),new it(t,e),new it(n,s),new it(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new Mr(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,n,s,r,o),this}absarc(t,e,n,s,r,o){return this.absellipse(t,e,n,n,s,r,o),this}ellipse(t,e,n,s,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,o,a,l),this}absellipse(t,e,n,s,r,o,a,l){let c=new As(t,e,n,s,r,o,a,l);if(this.curves.length>0){let d=c.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Rs=class extends Sr{constructor(t){super(t),this.uuid=ni(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new Sr().fromJSON(s))}return this}};function Wf(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=ku(i,0,s,e,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(n&&(r=$f(i,t,r,e)),i.length>80*e){a=i[0],l=i[1];let h=a,d=l;for(let u=e;u<s;u+=e){let f=i[u],g=i[u+1];f<a&&(a=f),g<l&&(l=g),f>h&&(h=f),g>d&&(d=g)}c=Math.max(h-a,d-l),c=c!==0?32767/c:0}return br(r,o,e,a,l,c,0),o}function ku(i,t,e,n,s){let r;if(s===op(i,t,e,n)>0)for(let o=t;o<e;o+=n)r=Yh(o/n|0,i[o],i[o+1],r);else for(let o=e-n;o>=t;o-=n)r=Yh(o/n|0,i[o],i[o+1],r);return r&&Cs(r,r.next)&&(Tr(r),r=r.next),r}function Xi(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Cs(e,e.next)||Ee(e.prev,e,e.next)===0)){if(Tr(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function br(i,t,e,n,s,r,o){if(!i)return;!o&&r&&tp(i,n,s,r);let a=i;for(;i.prev!==i.next;){let l=i.prev,c=i.next;if(r?qf(i,n,s,r):Xf(i)){t.push(l.i,i.i,c.i),Tr(i),i=c.next,a=c.next;continue}if(i=c,i===a){o?o===1?(i=Yf(Xi(i),t),br(i,t,e,n,s,r,2)):o===2&&Zf(i,t,e,n,s,r):br(Xi(i),t,e,n,s,r,1);break}}}function Xf(i){let t=i.prev,e=i,n=i.next;if(Ee(t,e,n)>=0)return!1;let s=t.x,r=e.x,o=n.x,a=t.y,l=e.y,c=n.y,h=Math.min(s,r,o),d=Math.min(a,l,c),u=Math.max(s,r,o),f=Math.max(a,l,c),g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=u&&g.y>=d&&g.y<=f&&tr(s,a,r,l,o,c,g.x,g.y)&&Ee(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function qf(i,t,e,n){let s=i.prev,r=i,o=i.next;if(Ee(s,r,o)>=0)return!1;let a=s.x,l=r.x,c=o.x,h=s.y,d=r.y,u=o.y,f=Math.min(a,l,c),g=Math.min(h,d,u),_=Math.max(a,l,c),p=Math.max(h,d,u),m=rc(f,g,t,e,n),M=rc(_,p,t,e,n),S=i.prevZ,y=i.nextZ;for(;S&&S.z>=m&&y&&y.z<=M;){if(S.x>=f&&S.x<=_&&S.y>=g&&S.y<=p&&S!==s&&S!==o&&tr(a,h,l,d,c,u,S.x,S.y)&&Ee(S.prev,S,S.next)>=0||(S=S.prevZ,y.x>=f&&y.x<=_&&y.y>=g&&y.y<=p&&y!==s&&y!==o&&tr(a,h,l,d,c,u,y.x,y.y)&&Ee(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;S&&S.z>=m;){if(S.x>=f&&S.x<=_&&S.y>=g&&S.y<=p&&S!==s&&S!==o&&tr(a,h,l,d,c,u,S.x,S.y)&&Ee(S.prev,S,S.next)>=0)return!1;S=S.prevZ}for(;y&&y.z<=M;){if(y.x>=f&&y.x<=_&&y.y>=g&&y.y<=p&&y!==s&&y!==o&&tr(a,h,l,d,c,u,y.x,y.y)&&Ee(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function Yf(i,t){let e=i;do{let n=e.prev,s=e.next.next;!Cs(n,s)&&Gu(n,e,e.next,s)&&Er(n,s)&&Er(s,n)&&(t.push(n.i,e.i,s.i),Tr(e),Tr(e.next),e=i=s),e=e.next}while(e!==i);return Xi(e)}function Zf(i,t,e,n,s,r){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&ip(o,a)){let l=Wu(o,a);o=Xi(o,o.next),l=Xi(l,l.next),br(o,t,e,n,s,r,0),br(l,t,e,n,s,r,0);return}a=a.next}o=o.next}while(o!==i)}function $f(i,t,e,n){let s=[];for(let r=0,o=t.length;r<o;r++){let a=t[r]*n,l=r<o-1?t[r+1]*n:i.length,c=ku(i,a,l,n,!1);c===c.next&&(c.steiner=!0),s.push(np(c))}s.sort(Jf);for(let r=0;r<s.length;r++)e=Kf(s[r],e);return e}function Jf(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function Kf(i,t){let e=Qf(i,t);if(!e)return t;let n=Wu(e,i);return Xi(n,n.next),Xi(e,e.next)}function Qf(i,t){let e=t,n=i.x,s=i.y,r=-1/0,o;if(Cs(i,e))return e;do{if(Cs(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let d=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=n&&d>r&&(r=d,o=e.x<e.next.x?e:e.next,d===n))return o}e=e.next}while(e!==t);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;e=o;do{if(n>=e.x&&e.x>=l&&n!==e.x&&Hu(s<c?n:r,s,l,c,s<c?r:n,s,e.x,e.y)){let d=Math.abs(s-e.y)/(n-e.x);Er(e,i)&&(d<h||d===h&&(e.x>o.x||e.x===o.x&&jf(o,e)))&&(o=e,h=d)}e=e.next}while(e!==a);return o}function jf(i,t){return Ee(i.prev,i,t.prev)<0&&Ee(t.next,i,i.next)<0}function tp(i,t,e,n){let s=i;do s.z===0&&(s.z=rc(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,ep(s)}function ep(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let o=n,a=0;for(let c=0;c<e&&(a++,o=o.nextZ,!!o);c++);let l=e;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||n.z<=o.z)?(s=n,n=n.nextZ,a--):(s=o,o=o.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=o}r.nextZ=null,e*=2}while(t>1);return i}function rc(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function np(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Hu(i,t,e,n,s,r,o,a){return(s-o)*(t-a)>=(i-o)*(r-a)&&(i-o)*(n-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(s-o)*(n-a)}function tr(i,t,e,n,s,r,o,a){return!(i===o&&t===a)&&Hu(i,t,e,n,s,r,o,a)}function ip(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!sp(i,t)&&(Er(i,t)&&Er(t,i)&&rp(i,t)&&(Ee(i.prev,i,t.prev)||Ee(i,t.prev,t))||Cs(i,t)&&Ee(i.prev,i,i.next)>0&&Ee(t.prev,t,t.next)>0)}function Ee(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Cs(i,t){return i.x===t.x&&i.y===t.y}function Gu(i,t,e,n){let s=Mo(Ee(i,t,e)),r=Mo(Ee(i,t,n)),o=Mo(Ee(e,n,i)),a=Mo(Ee(e,n,t));return!!(s!==r&&o!==a||s===0&&yo(i,e,t)||r===0&&yo(i,n,t)||o===0&&yo(e,i,n)||a===0&&yo(e,t,n))}function yo(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function Mo(i){return i>0?1:i<0?-1:0}function sp(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Gu(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Er(i,t){return Ee(i.prev,i,i.next)<0?Ee(i,t,i.next)>=0&&Ee(i,i.prev,t)>=0:Ee(i,t,i.prev)<0||Ee(i,i.next,t)<0}function rp(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function Wu(i,t){let e=oc(i.i,i.x,i.y),n=oc(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Yh(i,t,e,n){let s=oc(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Tr(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function oc(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function op(i,t,e,n){let s=0;for(let r=t,o=e-n;r<e;r+=n)s+=(i[o]-i[r])*(i[r+1]+i[o+1]),o=r;return s}var ac=class{static triangulate(t,e,n=2){return Wf(t,e,n)}},Bi=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];Zh(t),$h(n,t);let o=t.length;e.forEach(Zh);for(let l=0;l<e.length;l++)s.push(o),o+=e[l].length,$h(n,e[l]);let a=ac.triangulate(n,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function Zh(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function $h(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var wr=class i extends de{constructor(t=new Rs([new it(.5,.5),new it(-.5,.5),new it(-.5,-.5),new it(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let a=0,l=t.length;a<l;a++){let c=t[a];o(c)}this.setAttribute("position",new qt(s,3)),this.setAttribute("uv",new qt(r,2)),this.computeVertexNormals();function o(a){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,d=e.depth!==void 0?e.depth:1,u=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:f-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3,m=e.extrudePath,M=e.UVGenerator!==void 0?e.UVGenerator:ap,S,y=!1,w,E,C,x;if(m){S=m.getSpacedPoints(h),y=!0,u=!1;let j=m.isCatmullRomCurve3?m.closed:!1;w=m.computeFrenetFrames(h,j),E=new R,C=new R,x=new R}u||(p=0,f=0,g=0,_=0);let T=a.extractPoints(c),P=T.shape,I=T.holes;if(!Bi.isClockWise(P)){P=P.reverse();for(let j=0,nt=I.length;j<nt;j++){let st=I[j];Bi.isClockWise(st)&&(I[j]=st.reverse())}}function G(j){let st=10000000000000001e-36,_t=j[0];for(let mt=1;mt<=j.length;mt++){let Ot=mt%j.length,Pt=j[Ot],Wt=Pt.x-_t.x,Zt=Pt.y-_t.y,L=Wt*Wt+Zt*Zt,fe=Math.max(Math.abs(Pt.x),Math.abs(Pt.y),Math.abs(_t.x),Math.abs(_t.y)),se=st*fe*fe;if(L<=se){j.splice(Ot,1),mt--;continue}_t=Pt}}G(P),I.forEach(G);let X=I.length,F=P;for(let j=0;j<X;j++){let nt=I[j];P=P.concat(nt)}function W(j,nt,st){return nt||Ft("ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(nt,st)}let k=P.length;function K(j,nt,st){let _t,mt,Ot,Pt=j.x-nt.x,Wt=j.y-nt.y,Zt=st.x-j.x,L=st.y-j.y,fe=Pt*Pt+Wt*Wt,se=Pt*L-Wt*Zt;if(Math.abs(se)>Number.EPSILON){let A=Math.sqrt(fe),v=Math.sqrt(Zt*Zt+L*L),O=nt.x-Wt/A,V=nt.y+Pt/A,q=st.x-L/v,at=st.y+Zt/v,ht=((q-O)*L-(at-V)*Zt)/(Pt*L-Wt*Zt);_t=O+Pt*ht-j.x,mt=V+Wt*ht-j.y;let Y=_t*_t+mt*mt;if(Y<=2)return new it(_t,mt);Ot=Math.sqrt(Y/2)}else{let A=!1;Pt>Number.EPSILON?Zt>Number.EPSILON&&(A=!0):Pt<-Number.EPSILON?Zt<-Number.EPSILON&&(A=!0):Math.sign(Wt)===Math.sign(L)&&(A=!0),A?(_t=-Wt,mt=Pt,Ot=Math.sqrt(fe)):(_t=Pt,mt=Wt,Ot=Math.sqrt(fe/2))}return new it(_t/Ot,mt/Ot)}let Q=[];for(let j=0,nt=F.length,st=nt-1,_t=j+1;j<nt;j++,st++,_t++)st===nt&&(st=0),_t===nt&&(_t=0),Q[j]=K(F[j],F[st],F[_t]);let rt=[],ot,ct=Q.concat();for(let j=0,nt=X;j<nt;j++){let st=I[j];ot=[];for(let _t=0,mt=st.length,Ot=mt-1,Pt=_t+1;_t<mt;_t++,Ot++,Pt++)Ot===mt&&(Ot=0),Pt===mt&&(Pt=0),ot[_t]=K(st[_t],st[Ot],st[Pt]);rt.push(ot),ct=ct.concat(ot)}let Gt;if(p===0)Gt=Bi.triangulateShape(F,I);else{let j=[],nt=[];for(let st=0;st<p;st++){let _t=st/p,mt=f*Math.cos(_t*Math.PI/2),Ot=g*Math.sin(_t*Math.PI/2)+_;for(let Pt=0,Wt=F.length;Pt<Wt;Pt++){let Zt=W(F[Pt],Q[Pt],Ot);St(Zt.x,Zt.y,-mt),_t===0&&j.push(Zt)}for(let Pt=0,Wt=X;Pt<Wt;Pt++){let Zt=I[Pt];ot=rt[Pt];let L=[];for(let fe=0,se=Zt.length;fe<se;fe++){let A=W(Zt[fe],ot[fe],Ot);St(A.x,A.y,-mt),_t===0&&L.push(A)}_t===0&&nt.push(L)}}Gt=Bi.triangulateShape(j,nt)}let le=Gt.length,te=g+_;for(let j=0;j<k;j++){let nt=u?W(P[j],ct[j],te):P[j];y?(C.copy(w.normals[0]).multiplyScalar(nt.x),E.copy(w.binormals[0]).multiplyScalar(nt.y),x.copy(S[0]).add(C).add(E),St(x.x,x.y,x.z)):St(nt.x,nt.y,0)}for(let j=1;j<=h;j++)for(let nt=0;nt<k;nt++){let st=u?W(P[nt],ct[nt],te):P[nt];y?(C.copy(w.normals[j]).multiplyScalar(st.x),E.copy(w.binormals[j]).multiplyScalar(st.y),x.copy(S[j]).add(C).add(E),St(x.x,x.y,x.z)):St(st.x,st.y,d/h*j)}for(let j=p-1;j>=0;j--){let nt=j/p,st=f*Math.cos(nt*Math.PI/2),_t=g*Math.sin(nt*Math.PI/2)+_;for(let mt=0,Ot=F.length;mt<Ot;mt++){let Pt=W(F[mt],Q[mt],_t);St(Pt.x,Pt.y,d+st)}for(let mt=0,Ot=I.length;mt<Ot;mt++){let Pt=I[mt];ot=rt[mt];for(let Wt=0,Zt=Pt.length;Wt<Zt;Wt++){let L=W(Pt[Wt],ot[Wt],_t);y?St(L.x,L.y+S[h-1].y,S[h-1].x+st):St(L.x,L.y,d+st)}}}Z(),lt();function Z(){let j=s.length/3;if(u){let nt=0,st=k*nt;for(let _t=0;_t<le;_t++){let mt=Gt[_t];wt(mt[2]+st,mt[1]+st,mt[0]+st)}nt=h+p*2,st=k*nt;for(let _t=0;_t<le;_t++){let mt=Gt[_t];wt(mt[0]+st,mt[1]+st,mt[2]+st)}}else{for(let nt=0;nt<le;nt++){let st=Gt[nt];wt(st[2],st[1],st[0])}for(let nt=0;nt<le;nt++){let st=Gt[nt];wt(st[0]+k*h,st[1]+k*h,st[2]+k*h)}}n.addGroup(j,s.length/3-j,0)}function lt(){let j=s.length/3,nt=0;tt(F,nt),nt+=F.length;for(let st=0,_t=I.length;st<_t;st++){let mt=I[st];tt(mt,nt),nt+=mt.length}n.addGroup(j,s.length/3-j,1)}function tt(j,nt){let st=j.length;for(;--st>=0;){let _t=st,mt=st-1;mt<0&&(mt=j.length-1);for(let Ot=0,Pt=h+p*2;Ot<Pt;Ot++){let Wt=k*Ot,Zt=k*(Ot+1),L=nt+_t+Wt,fe=nt+mt+Wt,se=nt+mt+Zt,A=nt+_t+Zt;bt(L,fe,se,A)}}}function St(j,nt,st){l.push(j),l.push(nt),l.push(st)}function wt(j,nt,st){Qt(j),Qt(nt),Qt(st);let _t=s.length/3,mt=M.generateTopUV(n,s,_t-3,_t-2,_t-1);Ut(mt[0]),Ut(mt[1]),Ut(mt[2])}function bt(j,nt,st,_t){Qt(j),Qt(nt),Qt(_t),Qt(nt),Qt(st),Qt(_t);let mt=s.length/3,Ot=M.generateSideWallUV(n,s,mt-6,mt-3,mt-2,mt-1);Ut(Ot[0]),Ut(Ot[1]),Ut(Ot[3]),Ut(Ot[1]),Ut(Ot[2]),Ut(Ot[3])}function Qt(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function Ut(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return lp(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,o=t.shapes.length;r<o;r++){let a=e[t.shapes[r]];n.push(a)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new sc[s.type]().fromJSON(s)),new i(n,t.options)}},ap={generateTopUV:function(i,t,e,n,s){let r=t[e*3],o=t[e*3+1],a=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new it(r,o),new it(a,l),new it(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],d=t[n*3+2],u=t[s*3],f=t[s*3+1],g=t[s*3+2],_=t[r*3],p=t[r*3+1],m=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new it(o,1-l),new it(c,1-d),new it(u,1-g),new it(_,1-m)]:[new it(a,1-l),new it(h,1-d),new it(f,1-g),new it(p,1-m)]}};function lp(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var Ar=class i extends Wo{constructor(t=1,e=0){let n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}},Rr=class i extends de{constructor(t=[new it(0,-.5),new it(.5,0),new it(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=ie(s,0,Math.PI*2);let r=[],o=[],a=[],l=[],c=[],h=1/e,d=new R,u=new it,f=new R,g=new R,_=new R,p=0,m=0;for(let M=0;M<=t.length-1;M++)switch(M){case 0:p=t[M+1].x-t[M].x,m=t[M+1].y-t[M].y,f.x=m*1,f.y=-p,f.z=m*0,_.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(_.x,_.y,_.z);break;default:p=t[M+1].x-t[M].x,m=t[M+1].y-t[M].y,f.x=m*1,f.y=-p,f.z=m*0,g.copy(f),f.x+=_.x,f.y+=_.y,f.z+=_.z,f.normalize(),l.push(f.x,f.y,f.z),_.copy(g)}for(let M=0;M<=e;M++){let S=n+M*h*s,y=Math.sin(S),w=Math.cos(S);for(let E=0;E<=t.length-1;E++){d.x=t[E].x*y,d.y=t[E].y,d.z=t[E].x*w,o.push(d.x,d.y,d.z),u.x=M/e,u.y=E/(t.length-1),a.push(u.x,u.y);let C=l[3*E+0]*y,x=l[3*E+1],T=l[3*E+0]*w;c.push(C,x,T)}}for(let M=0;M<e;M++)for(let S=0;S<t.length-1;S++){let y=S+M*t.length,w=y,E=y+t.length,C=y+t.length+1,x=y+1;r.push(w,E,x),r.push(C,x,E)}this.setIndex(r),this.setAttribute("position",new qt(o,3)),this.setAttribute("uv",new qt(a,2)),this.setAttribute("normal",new qt(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.points,t.segments,t.phiStart,t.phiLength)}};var Wn=class i extends de{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,d=t/a,u=e/l,f=[],g=[],_=[],p=[];for(let m=0;m<h;m++){let M=m*u-o;for(let S=0;S<c;S++){let y=S*d-r;g.push(y,-M,0),_.push(0,0,1),p.push(S/a),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let M=0;M<a;M++){let S=M+c*m,y=M+c*(m+1),w=M+1+c*(m+1),E=M+1+c*m;f.push(S,y,E),f.push(y,w,E)}this.setIndex(f),this.setAttribute("position",new qt(g,3)),this.setAttribute("normal",new qt(_,3)),this.setAttribute("uv",new qt(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var sn=class i extends de{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],d=new R,u=new R,f=[],g=[],_=[],p=[];for(let m=0;m<=n;m++){let M=[],S=m/n,y=o+S*a,w=t*Math.cos(y),E=Math.sqrt(t*t-w*w),C=0;m===0&&o===0?C=.5/e:m===n&&l===Math.PI&&(C=-.5/e);for(let x=0;x<=e;x++){let T=x/e,P=s+T*r;d.x=-E*Math.cos(P),d.y=w,d.z=E*Math.sin(P),g.push(d.x,d.y,d.z),u.copy(d).normalize(),_.push(u.x,u.y,u.z),p.push(T+C,1-S),M.push(c++)}h.push(M)}for(let m=0;m<n;m++)for(let M=0;M<e;M++){let S=h[m][M+1],y=h[m][M],w=h[m+1][M],E=h[m+1][M+1];(m!==0||o>0)&&f.push(S,y,E),(m!==n-1||l<Math.PI)&&f.push(y,w,E)}this.setIndex(f),this.setAttribute("position",new qt(g,3)),this.setAttribute("normal",new qt(_,3)),this.setAttribute("uv",new qt(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Zi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(Jh(s))s.isRenderTargetTexture?(Bt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(Jh(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Je(i){let t={};for(let e=0;e<i.length;e++){let n=Zi(i[e]);for(let s in n)t[s]=n[s]}return t}function Jh(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function cp(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Dc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:oe.workingColorSpace}var Xu={clone:Zi,merge:Je},hp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,up=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ke=class extends Hn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=hp,this.fragmentShader=up,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Zi(t.uniforms),this.uniformsGroups=cp(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Ht().setHex(s.value);break;case"v2":this.uniforms[n].value=new it().fromArray(s.value);break;case"v3":this.uniforms[n].value=new R().fromArray(s.value);break;case"v4":this.uniforms[n].value=new be().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Yt().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ae().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Ko=class extends ke{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},ne=class extends Hn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ht(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=ja,this.normalScale=new it(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var Qo=class extends Hn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Au,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},jo=class extends Hn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function So(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}var Mi=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let o;e:{i:if(!(t<s)){for(let a=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=s,s=e[++n],t<s)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}o=n,n=0;break e}break n}for(;n<o;){let a=n+o>>>1;t<e[a]?o=a:n=a+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let o=0;o!==s;++o)e[o]=n[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},ta=class extends Mi{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:jl,endingEnd:jl}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,o=t+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case tc:r=t,a=2*e-n;break;case ec:r=s.length-2,a=e+s[r]-s[r+1];break;default:r=t,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case tc:o=t,l=2*n-e;break;case ec:o=1,l=n+s[1]-s[0];break;default:o=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,g=(n-e)/(s-e),_=g*g,p=_*g,m=-u*p+2*u*_-u*g,M=(1+u)*p+(-1.5-2*u)*_+(-.5+u)*g+1,S=(-1-f)*p+(1.5+f)*_+.5*g,y=f*p-f*_;for(let w=0;w!==a;++w)r[w]=m*o[h+w]+M*o[c+w]+S*o[l+w]+y*o[d+w];return r}},ea=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=(n-e)/(s-e),d=1-h;for(let u=0;u!==a;++u)r[u]=o[c+u]*d+o[l+u]*h;return r}},na=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},ia=class extends Mi{interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this.inTangents,d=this.outTangents;if(!h||!d){let g=(n-e)/(s-e),_=1-g;for(let p=0;p!==a;++p)r[p]=o[c+p]*_+o[l+p]*g;return r}let u=a*2,f=t-1;for(let g=0;g!==a;++g){let _=o[c+g],p=o[l+g],m=f*u+g*2,M=d[m],S=d[m+1],y=t*u+g*2,w=h[y],E=h[y+1],C=(n-e)/(s-e),x,T,P,I,U;for(let G=0;G<8;G++){x=C*C,T=x*C,P=1-C,I=P*P,U=I*P;let F=U*e+3*I*C*M+3*P*x*w+T*s-n;if(Math.abs(F)<1e-10)break;let W=3*I*(M-e)+6*P*C*(w-M)+3*x*(s-w);if(Math.abs(W)<1e-10)break;C=C-F/W,C=Math.max(0,Math.min(1,C))}r[g]=U*_+3*I*C*S+3*P*x*E+T*p}return r}},xn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=So(e,this.TimeBufferType),this.values=So(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:So(t.times,Array),values:So(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new na(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new ea(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new ta(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new ia(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case ir:e=this.InterpolantFactoryMethodDiscrete;break;case Fo:e=this.InterpolantFactoryMethodLinear;break;case To:e=this.InterpolantFactoryMethodSmooth;break;case Ql:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Bt("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ir;case this.InterpolantFactoryMethodLinear:return Fo;case this.InterpolantFactoryMethodSmooth:return To;case this.InterpolantFactoryMethodBezier:return Ql}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,o=s-1;for(;r!==s&&n[r]<t;)++r;for(;o!==-1&&n[o]>e;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Ft("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Ft("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Ft("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){Ft("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(s!==void 0&&gf(s))for(let a=0,l=s.length;a!==l;++a){let c=s[a];if(isNaN(c)){Ft("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===To,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],h=t[a+1];if(c!==h&&(a!==1||c!==t[0]))if(s)l=!0;else{let d=a*n,u=d-n,f=d+n;for(let g=0;g!==n;++g){let _=e[d+g];if(_!==e[u+g]||_!==e[f+g]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let d=a*n,u=o*n;for(let f=0;f!==n;++f)e[u+f]=e[d+f]}++o}}if(r>0){t[o]=t[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};xn.prototype.ValueTypeName="";xn.prototype.TimeBufferType=Float32Array;xn.prototype.ValueBufferType=Float32Array;xn.prototype.DefaultInterpolation=Fo;var Si=class extends xn{constructor(t,e,n){super(t,e,n)}};Si.prototype.ValueTypeName="bool";Si.prototype.ValueBufferType=Array;Si.prototype.DefaultInterpolation=ir;Si.prototype.InterpolantFactoryMethodLinear=void 0;Si.prototype.InterpolantFactoryMethodSmooth=void 0;var sa=class extends xn{constructor(t,e,n,s){super(t,e,n,s)}};sa.prototype.ValueTypeName="color";var ra=class extends xn{constructor(t,e,n,s){super(t,e,n,s)}};ra.prototype.ValueTypeName="number";var oa=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-e)/(s-e),c=t*a;for(let h=c+a;c!==h;c+=4)Qe.slerpFlat(r,0,o,c-a,o,c,l);return r}},Cr=class extends xn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new oa(this.times,this.values,this.getValueSize(),t)}};Cr.prototype.ValueTypeName="quaternion";Cr.prototype.InterpolantFactoryMethodSmooth=void 0;var bi=class extends xn{constructor(t,e,n){super(t,e,n)}};bi.prototype.ValueTypeName="string";bi.prototype.ValueBufferType=Array;bi.prototype.DefaultInterpolation=ir;bi.prototype.InterpolantFactoryMethodLinear=void 0;bi.prototype.InterpolantFactoryMethodSmooth=void 0;var aa=class extends xn{constructor(t,e,n,s){super(t,e,n,s)}};aa.prototype.ValueTypeName="vector";var la=class{constructor(t,e,n){let s=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){a++,r===!1&&s.onStart!==void 0&&s.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,s.onProgress!==void 0&&s.onProgress(h,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},qu=new la,ca=class{constructor(t){this.manager=t!==void 0?t:qu,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};ca.DEFAULT_MATERIAL_NAME="__DEFAULT";var Pr=class extends Ve{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ht(t),this.intensity=e}dispose(){this.dispatchEvent({type:"dispose"})}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Ir=class extends Pr{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ve.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ht(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Kl=new ae,Kh=new R,Qh=new R,lc=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new it(512,512),this.mapType=rn,this.map=null,this.mapPass=null,this.matrix=new ae,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ws,this._frameExtents=new it(1,1),this._viewportCount=1,this._viewports=[new be(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;Kh.setFromMatrixPosition(t.matrixWorld),e.position.copy(Kh),Qh.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Qh),e.updateMatrixWorld(),Kl.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Kl,e.coordinateSystem,e.reversedDepth),e.coordinateSystem===_s||e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Kl)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},bo=new R,Eo=new Qe,On=new R,Lr=class extends Ve{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ae,this.projectionMatrix=new ae,this.projectionMatrixInverse=new ae,this.coordinateSystem=Rn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(bo,Eo,On),On.x===1&&On.y===1&&On.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,Eo,On.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(bo,Eo,On),On.x===1&&On.y===1&&On.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,Eo,On.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},xi=new R,jh=new it,tu=new it,Ze=class extends Lr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Bo*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(El*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Bo*2*Math.atan(Math.tan(El*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){xi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(xi.x,xi.y).multiplyScalar(-t/xi.z),xi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(xi.x,xi.y).multiplyScalar(-t/xi.z)}getViewSize(t,e){return this.getViewBounds(t,jh,tu),e.subVectors(tu,jh)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(El*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var Ps=class extends Lr{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},cc=class extends lc{constructor(){super(new Ps(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Is=class extends Pr{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ve.DEFAULT_UP),this.updateMatrix(),this.target=new Ve,this.shadow=new cc}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var ms=-90,gs=1,ha=class extends Ve{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Ze(ms,gs,t,e);s.layers=this.layers,this.add(s);let r=new Ze(ms,gs,t,e);r.layers=this.layers,this.add(r);let o=new Ze(ms,gs,t,e);o.layers=this.layers,this.add(o);let a=new Ze(ms,gs,t,e);a.layers=this.layers,this.add(a);let l=new Ze(ms,gs,t,e);l.layers=this.layers,this.add(l);let c=new Ze(ms,gs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===Rn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===_s)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,d=t.getRenderTarget(),u=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let p=!1;t.isWebGLRenderer===!0?p=t.state.buffers.depth.getReversed():p=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,2,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,3,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(d,u,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},ua=class extends Ze{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var Uc="\\[\\]\\.:\\/",dp=new RegExp("["+Uc+"]","g"),Nc="[^"+Uc+"]",fp="[^"+Uc.replace("\\.","")+"]",pp=/((?:WC+[\/:])*)/.source.replace("WC",Nc),mp=/(WCOD+)?/.source.replace("WCOD",fp),gp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Nc),xp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Nc),_p=new RegExp("^"+pp+mp+gp+xp+"$"),vp=["material","materials","bones","map"],hc=class{constructor(t,e,n){let s=n||Me.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},Me=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(dp,"")}static parseTrackName(t){let e=_p.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);vp.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=n(a.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Bt("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Ft("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ft("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ft("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ft("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ft("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Ft("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Ft("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[s];if(o===void 0){let c=e.nodeName;Ft("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ft("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ft("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Me.Composite=hc;Me.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Me.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Me.prototype.GetterByBindingType=[Me.prototype._getValue_direct,Me.prototype._getValue_array,Me.prototype._getValue_arrayElement,Me.prototype._getValue_toArray];Me.prototype.SetterByBindingTypeAndVersioning=[[Me.prototype._setValue_direct,Me.prototype._setValue_direct_setNeedsUpdate,Me.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_array,Me.prototype._setValue_array_setNeedsUpdate,Me.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_arrayElement,Me.prototype._setValue_arrayElement_setNeedsUpdate,Me.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_fromArray,Me.prototype._setValue_fromArray_setNeedsUpdate,Me.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var U_=new Float32Array(1);var eu=new ae,Dr=class{constructor(t,e,n=0,s=1/0){this.ray=new Es(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Ms,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Ft("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return eu.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(eu),this}intersectObject(t,e=!0,n=[]){return uc(t,this,n,e),n.sort(nu),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)uc(t[s],this,n,e);return n.sort(nu),n}};function nu(i,t){return i.distance-t.distance}function uc(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let o=0,a=r.length;o<a;o++)uc(r[o],t,e,!0)}}var kc=class kc{constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};kc.prototype.isMatrix2=!0;var dc=kc;function Fc(i,t,e,n){let s=yp(n);switch(e){case Rc:return i*t;case va:return i*t/s.components*s.byteLength;case ya:return i*t/s.components*s.byteLength;case Ai:return i*t*2/s.components*s.byteLength;case Ma:return i*t*2/s.components*s.byteLength;case Cc:return i*t*3/s.components*s.byteLength;case on:return i*t*4/s.components*s.byteLength;case Sa:return i*t*4/s.components*s.byteLength;case Or:case Br:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case zr:case Vr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ea:case wa:return Math.max(i,16)*Math.max(t,8)/4;case ba:case Ta:return Math.max(i,8)*Math.max(t,8)/2;case Aa:case Ra:case Pa:case Ia:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Ca:case kr:case La:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Da:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ua:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Na:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Fa:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Oa:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Ba:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case za:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Va:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case ka:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Ha:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case Ga:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Wa:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case Xa:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case qa:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Ya:case Za:case $a:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Ja:case Ka:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Hr:case Qa:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function yp(i){switch(i){case rn:case Ec:return{byteLength:1,components:1};case Ds:case Tc:case qn:return{byteLength:2,components:1};case xa:case _a:return{byteLength:2,components:4};case Ln:case ga:case Sn:return{byteLength:4,components:1};case wc:case Ac:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Bt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function md(){let i=null,t=!1,e=null,n=null;function s(r,o){e(r,o),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Tp(i){let t=new WeakMap;function e(a,l){let c=a.array,h=a.usage,d=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),a.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:d}}function n(a,l,c){let h=l.array,d=l.updateRanges;if(i.bindBuffer(c,a),d.length===0)i.bufferSubData(c,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){let g=d[u],_=d[f];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++u,d[u]=_)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){let _=d[f];i.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var wp=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Ap=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Rp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Cp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Pp=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ip=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Lp=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Dp=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Up=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Np=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Fp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Op=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Bp=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,zp=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Vp=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,kp=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Hp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Gp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Wp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Xp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,qp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Yp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Zp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,$p=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Jp=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Kp=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Qp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,jp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,tm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,em=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,nm="gl_FragColor = linearToOutputTexel( gl_FragColor );",im=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,sm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,rm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,om=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,am=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,lm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,cm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,hm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,um=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,dm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,fm=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,pm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,mm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,gm=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,xm=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,_m=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,vm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ym=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Mm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Sm=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,bm=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Em=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Tm=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,wm=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Am=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Rm=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Cm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Pm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Im=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Lm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Dm=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Um=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Nm=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Fm=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Om=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Bm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,zm=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Vm=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,km=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Hm=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Gm=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Wm=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Xm=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,qm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ym=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Zm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,$m=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Jm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Km=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Qm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,jm=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,t0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,e0=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,n0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,i0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,s0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,r0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,o0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,a0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,l0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,c0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,h0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,u0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,d0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,f0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,p0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,m0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,g0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,x0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,_0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,v0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,y0=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,M0=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,S0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,b0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,E0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,T0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,w0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,A0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,R0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,C0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,P0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,I0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,L0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,D0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,U0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,N0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,F0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,O0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,B0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,z0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,V0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,k0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,H0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,G0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,W0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,X0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,q0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Y0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Z0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,$0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,J0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,K0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Q0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,j0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tg=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,eg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,ng=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ig=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sg=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,rg=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,jt={alphahash_fragment:wp,alphahash_pars_fragment:Ap,alphamap_fragment:Rp,alphamap_pars_fragment:Cp,alphatest_fragment:Pp,alphatest_pars_fragment:Ip,aomap_fragment:Lp,aomap_pars_fragment:Dp,batching_pars_vertex:Up,batching_vertex:Np,begin_vertex:Fp,beginnormal_vertex:Op,bsdfs:Bp,iridescence_fragment:zp,bumpmap_pars_fragment:Vp,clipping_planes_fragment:kp,clipping_planes_pars_fragment:Hp,clipping_planes_pars_vertex:Gp,clipping_planes_vertex:Wp,color_fragment:Xp,color_pars_fragment:qp,color_pars_vertex:Yp,color_vertex:Zp,common:$p,cube_uv_reflection_fragment:Jp,defaultnormal_vertex:Kp,displacementmap_pars_vertex:Qp,displacementmap_vertex:jp,emissivemap_fragment:tm,emissivemap_pars_fragment:em,colorspace_fragment:nm,colorspace_pars_fragment:im,envmap_fragment:sm,envmap_common_pars_fragment:rm,envmap_pars_fragment:om,envmap_pars_vertex:am,envmap_physical_pars_fragment:_m,envmap_vertex:lm,fog_vertex:cm,fog_pars_vertex:hm,fog_fragment:um,fog_pars_fragment:dm,gradientmap_pars_fragment:fm,lightmap_pars_fragment:pm,lights_lambert_fragment:mm,lights_lambert_pars_fragment:gm,lights_pars_begin:xm,lights_toon_fragment:vm,lights_toon_pars_fragment:ym,lights_phong_fragment:Mm,lights_phong_pars_fragment:Sm,lights_physical_fragment:bm,lights_physical_pars_fragment:Em,lights_fragment_begin:Tm,lights_fragment_maps:wm,lights_fragment_end:Am,lightprobes_pars_fragment:Rm,logdepthbuf_fragment:Cm,logdepthbuf_pars_fragment:Pm,logdepthbuf_pars_vertex:Im,logdepthbuf_vertex:Lm,map_fragment:Dm,map_pars_fragment:Um,map_particle_fragment:Nm,map_particle_pars_fragment:Fm,metalnessmap_fragment:Om,metalnessmap_pars_fragment:Bm,morphinstance_vertex:zm,morphcolor_vertex:Vm,morphnormal_vertex:km,morphtarget_pars_vertex:Hm,morphtarget_vertex:Gm,normal_fragment_begin:Wm,normal_fragment_maps:Xm,normal_pars_fragment:qm,normal_pars_vertex:Ym,normal_vertex:Zm,normalmap_pars_fragment:$m,clearcoat_normal_fragment_begin:Jm,clearcoat_normal_fragment_maps:Km,clearcoat_pars_fragment:Qm,iridescence_pars_fragment:jm,opaque_fragment:t0,packing:e0,premultiplied_alpha_fragment:n0,project_vertex:i0,dithering_fragment:s0,dithering_pars_fragment:r0,roughnessmap_fragment:o0,roughnessmap_pars_fragment:a0,shadowmap_pars_fragment:l0,shadowmap_pars_vertex:c0,shadowmap_vertex:h0,shadowmask_pars_fragment:u0,skinbase_vertex:d0,skinning_pars_vertex:f0,skinning_vertex:p0,skinnormal_vertex:m0,specularmap_fragment:g0,specularmap_pars_fragment:x0,tonemapping_fragment:_0,tonemapping_pars_fragment:v0,transmission_fragment:y0,transmission_pars_fragment:M0,uv_pars_fragment:S0,uv_pars_vertex:b0,uv_vertex:E0,worldpos_vertex:T0,background_vert:w0,background_frag:A0,backgroundCube_vert:R0,backgroundCube_frag:C0,cube_vert:P0,cube_frag:I0,depth_vert:L0,depth_frag:D0,distance_vert:U0,distance_frag:N0,equirect_vert:F0,equirect_frag:O0,linedashed_vert:B0,linedashed_frag:z0,meshbasic_vert:V0,meshbasic_frag:k0,meshlambert_vert:H0,meshlambert_frag:G0,meshmatcap_vert:W0,meshmatcap_frag:X0,meshnormal_vert:q0,meshnormal_frag:Y0,meshphong_vert:Z0,meshphong_frag:$0,meshphysical_vert:J0,meshphysical_frag:K0,meshtoon_vert:Q0,meshtoon_frag:j0,points_vert:tg,points_frag:eg,shadow_vert:ng,shadow_frag:ig,sprite_vert:sg,sprite_frag:rg},xt={common:{diffuse:{value:new Ht(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Yt},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Yt}},envmap:{envMap:{value:null},envMapRotation:{value:new Yt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Yt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Yt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Yt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Yt},normalScale:{value:new it(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Yt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Yt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Yt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Yt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ht(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new R},probesMax:{value:new R},probesResolution:{value:new R}},points:{diffuse:{value:new Ht(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0},uvTransform:{value:new Yt}},sprite:{diffuse:{value:new Ht(16777215)},opacity:{value:1},center:{value:new it(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Yt},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0}}},Zn={basic:{uniforms:Je([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.fog]),vertexShader:jt.meshbasic_vert,fragmentShader:jt.meshbasic_frag},lambert:{uniforms:Je([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},envMapIntensity:{value:1}}]),vertexShader:jt.meshlambert_vert,fragmentShader:jt.meshlambert_frag},phong:{uniforms:Je([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},specular:{value:new Ht(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:jt.meshphong_vert,fragmentShader:jt.meshphong_frag},standard:{uniforms:Je([xt.common,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.roughnessmap,xt.metalnessmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag},toon:{uniforms:Je([xt.common,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.gradientmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)}}]),vertexShader:jt.meshtoon_vert,fragmentShader:jt.meshtoon_frag},matcap:{uniforms:Je([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,{matcap:{value:null}}]),vertexShader:jt.meshmatcap_vert,fragmentShader:jt.meshmatcap_frag},points:{uniforms:Je([xt.points,xt.fog]),vertexShader:jt.points_vert,fragmentShader:jt.points_frag},dashed:{uniforms:Je([xt.common,xt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jt.linedashed_vert,fragmentShader:jt.linedashed_frag},depth:{uniforms:Je([xt.common,xt.displacementmap]),vertexShader:jt.depth_vert,fragmentShader:jt.depth_frag},normal:{uniforms:Je([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,{opacity:{value:1}}]),vertexShader:jt.meshnormal_vert,fragmentShader:jt.meshnormal_frag},sprite:{uniforms:Je([xt.sprite,xt.fog]),vertexShader:jt.sprite_vert,fragmentShader:jt.sprite_frag},background:{uniforms:{uvTransform:{value:new Yt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jt.background_vert,fragmentShader:jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Yt}},vertexShader:jt.backgroundCube_vert,fragmentShader:jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jt.cube_vert,fragmentShader:jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jt.equirect_vert,fragmentShader:jt.equirect_frag},distance:{uniforms:Je([xt.common,xt.displacementmap,{referencePosition:{value:new R},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jt.distance_vert,fragmentShader:jt.distance_frag},shadow:{uniforms:Je([xt.lights,xt.fog,{color:{value:new Ht(0)},opacity:{value:1}}]),vertexShader:jt.shadow_vert,fragmentShader:jt.shadow_frag}};Zn.physical={uniforms:Je([Zn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Yt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Yt},clearcoatNormalScale:{value:new it(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Yt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Yt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Yt},sheen:{value:0},sheenColor:{value:new Ht(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Yt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Yt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Yt},transmissionSamplerSize:{value:new it},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Yt},attenuationDistance:{value:0},attenuationColor:{value:new Ht(0)},specularColor:{value:new Ht(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Yt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Yt},anisotropyVector:{value:new it},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Yt}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag};var nl={r:0,b:0,g:0},og=new ae,gd=new Yt;gd.set(-1,0,0,0,1,0,0,0,1);function ag(i,t,e,n,s,r){let o=new Ht(0),a=s===!0?0:1,l,c,h=null,d=0,u=null;function f(M){let S=M.isScene===!0?M.background:null;if(S&&S.isTexture){let y=M.backgroundBlurriness>0;S=t.get(S,y)}return S}function g(M){let S=!1,y=f(M);y===null?p(o,a):y&&y.isColor&&(p(y,1),S=!0);let w=i.xr.getEnvironmentBlendMode();w==="additive"?e.buffers.color.setClear(0,0,0,1,r):w==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||S)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function _(M,S){let y=f(S);y&&(y.isCubeTexture||y.mapping===Nr)?(c===void 0&&(c=new zt(new Le(1,1,1),new ke({name:"BackgroundCubeMaterial",uniforms:Zi(Zn.backgroundCube.uniforms),vertexShader:Zn.backgroundCube.vertexShader,fragmentShader:Zn.backgroundCube.fragmentShader,side:Ue,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,E,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(og.makeRotationFromEuler(S.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(gd),c.material.toneMapped=oe.getTransfer(y.colorSpace)!==ue,(h!==y||d!==y.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=y,d=y.version,u=i.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new zt(new Wn(2,2),new ke({name:"BackgroundMaterial",uniforms:Zi(Zn.background.uniforms),vertexShader:Zn.background.vertexShader,fragmentShader:Zn.background.fragmentShader,side:si,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=oe.getTransfer(y.colorSpace)!==ue,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||d!==y.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=y,d=y.version,u=i.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function p(M,S){M.getRGB(nl,Dc(i)),e.buffers.color.setClear(nl.r,nl.g,nl.b,S,r)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,S=1){o.set(M),a=S,p(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,p(o,a)},render:g,addToRenderList:_,dispose:m}}function lg(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null),r=s,o=!1;function a(I,U,G,X,F){let W=!1,k=d(I,X,G,U);r!==k&&(r=k,c(r.object)),W=f(I,X,G,F),W&&g(I,X,G,F),F!==null&&t.update(F,i.ELEMENT_ARRAY_BUFFER),(W||o)&&(o=!1,y(I,U,G,X),F!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(F).buffer))}function l(){return i.createVertexArray()}function c(I){return i.bindVertexArray(I)}function h(I){return i.deleteVertexArray(I)}function d(I,U,G,X){let F=X.wireframe===!0,W=n[U.id];W===void 0&&(W={},n[U.id]=W);let k=I.isInstancedMesh===!0?I.id:0,K=W[k];K===void 0&&(K={},W[k]=K);let Q=K[G.id];Q===void 0&&(Q={},K[G.id]=Q);let rt=Q[F];return rt===void 0&&(rt=u(l()),Q[F]=rt),rt}function u(I){let U=[],G=[],X=[];for(let F=0;F<e;F++)U[F]=0,G[F]=0,X[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:G,attributeDivisors:X,object:I,attributes:{},index:null}}function f(I,U,G,X){let F=r.attributes,W=U.attributes,k=0,K=G.getAttributes();for(let Q in K)if(K[Q].location>=0){let ot=F[Q],ct=W[Q];if(ct===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(ct=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(ct=I.instanceColor)),ot===void 0||ot.attribute!==ct||ct&&ot.data!==ct.data)return!0;k++}return r.attributesNum!==k||r.index!==X}function g(I,U,G,X){let F={},W=U.attributes,k=0,K=G.getAttributes();for(let Q in K)if(K[Q].location>=0){let ot=W[Q];ot===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(ot=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(ot=I.instanceColor));let ct={};ct.attribute=ot,ot&&ot.data&&(ct.data=ot.data),F[Q]=ct,k++}r.attributes=F,r.attributesNum=k,r.index=X}function _(){let I=r.newAttributes;for(let U=0,G=I.length;U<G;U++)I[U]=0}function p(I){m(I,0)}function m(I,U){let G=r.newAttributes,X=r.enabledAttributes,F=r.attributeDivisors;G[I]=1,X[I]===0&&(i.enableVertexAttribArray(I),X[I]=1),F[I]!==U&&(i.vertexAttribDivisor(I,U),F[I]=U)}function M(){let I=r.newAttributes,U=r.enabledAttributes;for(let G=0,X=U.length;G<X;G++)U[G]!==I[G]&&(i.disableVertexAttribArray(G),U[G]=0)}function S(I,U,G,X,F,W,k){k===!0?i.vertexAttribIPointer(I,U,G,F,W):i.vertexAttribPointer(I,U,G,X,F,W)}function y(I,U,G,X){_();let F=X.attributes,W=G.getAttributes(),k=U.defaultAttributeValues;for(let K in W){let Q=W[K];if(Q.location>=0){let rt=F[K];if(rt===void 0&&(K==="instanceMatrix"&&I.instanceMatrix&&(rt=I.instanceMatrix),K==="instanceColor"&&I.instanceColor&&(rt=I.instanceColor)),rt!==void 0){let ot=rt.normalized,ct=rt.itemSize,Gt=t.get(rt);if(Gt===void 0)continue;let le=Gt.buffer,te=Gt.type,Z=Gt.bytesPerElement,lt=te===i.INT||te===i.UNSIGNED_INT||rt.gpuType===ga;if(rt.isInterleavedBufferAttribute){let tt=rt.data,St=tt.stride,wt=rt.offset;if(tt.isInstancedInterleavedBuffer){for(let bt=0;bt<Q.locationSize;bt++)m(Q.location+bt,tt.meshPerAttribute);I.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=tt.meshPerAttribute*tt.count)}else for(let bt=0;bt<Q.locationSize;bt++)p(Q.location+bt);i.bindBuffer(i.ARRAY_BUFFER,le);for(let bt=0;bt<Q.locationSize;bt++)S(Q.location+bt,ct/Q.locationSize,te,ot,St*Z,(wt+ct/Q.locationSize*bt)*Z,lt)}else{if(rt.isInstancedBufferAttribute){for(let tt=0;tt<Q.locationSize;tt++)m(Q.location+tt,rt.meshPerAttribute);I.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=rt.meshPerAttribute*rt.count)}else for(let tt=0;tt<Q.locationSize;tt++)p(Q.location+tt);i.bindBuffer(i.ARRAY_BUFFER,le);for(let tt=0;tt<Q.locationSize;tt++)S(Q.location+tt,ct/Q.locationSize,te,ot,ct*Z,ct/Q.locationSize*tt*Z,lt)}}else if(k!==void 0){let ot=k[K];if(ot!==void 0)switch(ot.length){case 2:i.vertexAttrib2fv(Q.location,ot);break;case 3:i.vertexAttrib3fv(Q.location,ot);break;case 4:i.vertexAttrib4fv(Q.location,ot);break;default:i.vertexAttrib1fv(Q.location,ot)}}}}M()}function w(){T();for(let I in n){let U=n[I];for(let G in U){let X=U[G];for(let F in X){let W=X[F];for(let k in W)h(W[k].object),delete W[k];delete X[F]}}delete n[I]}}function E(I){if(n[I.id]===void 0)return;let U=n[I.id];for(let G in U){let X=U[G];for(let F in X){let W=X[F];for(let k in W)h(W[k].object),delete W[k];delete X[F]}}delete n[I.id]}function C(I){for(let U in n){let G=n[U];for(let X in G){let F=G[X];if(F[I.id]===void 0)continue;let W=F[I.id];for(let k in W)h(W[k].object),delete W[k];delete F[I.id]}}}function x(I){for(let U in n){let G=n[U],X=I.isInstancedMesh===!0?I.id:0,F=G[X];if(F!==void 0){for(let W in F){let k=F[W];for(let K in k)h(k[K].object),delete k[K];delete F[W]}delete G[X],Object.keys(G).length===0&&delete n[U]}}}function T(){P(),o=!0,r!==s&&(r=s,c(r.object))}function P(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:T,resetDefaultState:P,dispose:w,releaseStatesOfGeometry:E,releaseStatesOfObject:x,releaseStatesOfProgram:C,initAttributes:_,enableAttribute:p,disableUnusedAttributes:M}}function cg(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function o(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];e.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function hg(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let C=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(C){return!(C!==on&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){let x=C===qn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==rn&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==Sn&&!x)}function l(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Bt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=e.logarithmicDepthBuffer===!0,u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&u===!1&&Bt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),m=i.getParameter(i.MAX_VERTEX_ATTRIBS),M=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),S=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),w=i.getParameter(i.MAX_SAMPLES),E=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:M,maxVaryings:S,maxFragmentUniforms:y,maxSamples:w,samples:E}}function ug(i){let t=this,e=null,n=0,s=!1,r=!1,o=new yn,a=new Yt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let f=d.length!==0||u||n!==0||s;return s=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){e=h(d,u,0)},this.setState=function(d,u,f){let g=d.clippingPlanes,_=d.clipIntersection,p=d.clipShadows,m=i.get(d);if(!s||g===null||g.length===0||r&&!p)r?h(null):c();else{let M=r?0:n,S=M*4,y=m.clippingState||null;l.value=y,y=h(g,u,S,f);for(let w=0;w!==S;++w)y[w]=e[w];m.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(d,u,f,g){let _=d!==null?d.length:0,p=null;if(_!==0){if(p=l.value,g!==!0||p===null){let m=f+_*4,M=u.matrixWorldInverse;a.getNormalMatrix(M),(p===null||p.length<m)&&(p=new Float32Array(m));for(let S=0,y=f;S!==_;++S,y+=4)o.copy(d[S]).applyMatrix4(M,a),o.normal.toArray(p,y),p[y+3]=o.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}var Ri=4,Yu=[.125,.215,.35,.446,.526,.582],$i=20,dg=256,Gr=new Ps,Zu=new Ht,Hc=null,Gc=0,Wc=0,Xc=!1,fg=new R,sl=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:o=256,position:a=fg}=r;Hc=this._renderer.getRenderTarget(),Gc=this._renderer.getActiveCubeFace(),Wc=this._renderer.getActiveMipmapLevel(),Xc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,s,l,a),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ku(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ju(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(Hc,Gc,Wc),this._renderer.xr.enabled=Xc,t.scissorTest=!1,Ns(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ei||t.mapping===Yi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Hc=this._renderer.getRenderTarget(),Gc=this._renderer.getActiveCubeFace(),Wc=this._renderer.getActiveMipmapLevel(),Xc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Ie,minFilter:Ie,generateMipmaps:!1,type:qn,format:on,colorSpace:sr,depthBuffer:!1},s=$u(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=$u(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=pg(r)),this._blurMaterial=gg(r,t,e),this._ggxMaterial=mg(r,t,e)}return s}_compileMaterial(t){let e=new zt(new de,t);this._renderer.compile(e,Gr)}_sceneToCubeUV(t,e,n,s,r){let l=new Ze(90,1,e,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(Zu),d.toneMapping=In,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new zt(new Le,new Gn({name:"PMREM.Background",side:Ue,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,p=_.material,m=!1,M=t.background;M?M.isColor&&(p.color.copy(M),t.background=null,m=!0):(p.color.copy(Zu),m=!0);for(let S=0;S<6;S++){let y=S%3;y===0?(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[S],r.y,r.z)):y===1?(l.up.set(0,0,c[S]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[S],r.z)):(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[S]));let w=this._cubeSize;Ns(s,y*w,S>2?w:0,w,w),d.setRenderTarget(s),m&&d.render(_,l),d.render(t,l)}d.toneMapping=f,d.autoClear=u,t.background=M}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Ei||t.mapping===Yi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ku()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ju());let r=s?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=t;let l=this._cubeSize;Ns(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(o,Gr)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let l=o.uniforms,c=n/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=0+c*1.25,f=d*u,{_lodMax:g}=this,_=this._sizeLods[n],p=3*_*(n>g-Ri?n-g+Ri:0),m=4*(this._cubeSize-_);l.envMap.value=t.texture,l.roughness.value=f,l.mipInt.value=g-e,Ns(r,p,m,3*_,2*_),s.setRenderTarget(r),s.render(a,Gr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,Ns(t,p,m,3*_,2*_),s.setRenderTarget(t),s.render(a,Gr)}_blur(t,e,n,s,r){let o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,s,"latitudinal",r),this._halfBlur(o,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&Ft("blur direction must be either latitudinal or longitudinal!");let h=3,d=this._lodMeshes[s];d.material=c;let u=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*$i-1),_=r/g,p=isFinite(r)?1+Math.floor(h*_):$i;p>$i&&Bt(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${$i}`);let m=[],M=0;for(let C=0;C<$i;++C){let x=C/_,T=Math.exp(-x*x/2);m.push(T),C===0?M+=T:C<p&&(M+=2*T)}for(let C=0;C<m.length;C++)m[C]=m[C]/M;u.envMap.value=t.texture,u.samples.value=p,u.weights.value=m,u.latitudinal.value=o==="latitudinal",a&&(u.poleAxis.value=a);let{_lodMax:S}=this;u.dTheta.value=g,u.mipInt.value=S-n;let y=this._sizeLods[s],w=3*y*(s>S-Ri?s-S+Ri:0),E=4*(this._cubeSize-y);Ns(e,w,E,3*y,2*y),l.setRenderTarget(e),l.render(d,Gr)}};function pg(i){let t=[],e=[],n=[],s=i,r=i-Ri+1+Yu.length;for(let o=0;o<r;o++){let a=Math.pow(2,s);t.push(a);let l=1/a;o>i-Ri?l=Yu[o-i+Ri-1]:o===0&&(l=0),e.push(l);let c=1/(a-2),h=-c,d=1+c,u=[h,h,d,h,d,d,h,h,d,d,h,d],f=6,g=6,_=3,p=2,m=1,M=new Float32Array(_*g*f),S=new Float32Array(p*g*f),y=new Float32Array(m*g*f);for(let E=0;E<f;E++){let C=E%3*2/3-1,x=E>2?0:-1,T=[C,x,0,C+2/3,x,0,C+2/3,x+1,0,C,x,0,C+2/3,x+1,0,C,x+1,0];M.set(T,_*g*E),S.set(u,p*g*E);let P=[E,E,E,E,E,E];y.set(P,m*g*E)}let w=new de;w.setAttribute("position",new ye(M,_)),w.setAttribute("uv",new ye(S,p)),w.setAttribute("faceIndex",new ye(y,m)),n.push(new zt(w,null)),s>Ri&&s--}return{lodMeshes:n,sizeLods:t,sigmas:e}}function $u(i,t,e){let n=new pn(i,t,e);return n.texture.mapping=Nr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ns(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function mg(i,t,e){return new ke({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:dg,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:al(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function gg(i,t,e){let n=new Float32Array($i),s=new R(0,1,0);return new ke({name:"SphericalGaussianBlur",defines:{n:$i,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:al(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function Ju(){return new ke({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:al(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function Ku(){return new ke({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:al(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function al(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var rl=class extends pn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new mr(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Le(5,5,5),r=new ke({name:"CubemapFromEquirect",uniforms:Zi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ue,blending:Xn});r.uniforms.tEquirect.value=e;let o=new zt(s,r),a=e.minFilter;return e.minFilter===Ti&&(e.minFilter=Ie),new ha(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}};function xg(i){let t=new WeakMap,e=new WeakMap,n=null;function s(u,f=!1){return u==null?null:f?o(u):r(u)}function r(u){if(u&&u.isTexture){let f=u.mapping;if(f===fa||f===pa)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let _=new rl(g.height);return _.fromEquirectangularTexture(i,u),t.set(u,_),u.addEventListener("dispose",c),a(_.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let f=u.mapping,g=f===fa||f===pa,_=f===Ei||f===Yi;if(g||_){let p=e.get(u),m=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==m)return n===null&&(n=new sl(i)),p=g?n.fromEquirectangular(u,p):n.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),p.texture;if(p!==void 0)return p.texture;{let M=u.image;return g&&M&&M.height>0||_&&M&&l(M)?(n===null&&(n=new sl(i)),p=g?n.fromEquirectangular(u):n.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function a(u,f){return f===fa?u.mapping=Ei:f===pa&&(u.mapping=Yi),u}function l(u){let f=0,g=6;for(let _=0;_<g;_++)u[_]!==void 0&&f++;return f===g}function c(u){let f=u.target;f.removeEventListener("dispose",c);let g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function d(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:d}}function _g(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&zi("WebGLRenderer: "+n+" extension not supported."),s}}}function vg(i,t,e,n){let s={},r=new WeakMap;function o(d){let u=d.target;u.index!==null&&t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete s[u.id];let f=r.get(u);f&&(t.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function a(d,u){return s[u.id]===!0||(u.addEventListener("dispose",o),s[u.id]=!0,e.memory.geometries++),u}function l(d){let u=d.attributes;for(let f in u)t.update(u[f],i.ARRAY_BUFFER)}function c(d){let u=[],f=d.index,g=d.attributes.position,_=0;if(g===void 0)return;if(f!==null){let M=f.array;_=f.version;for(let S=0,y=M.length;S<y;S+=3){let w=M[S+0],E=M[S+1],C=M[S+2];u.push(w,E,E,C,C,w)}}else{let M=g.array;_=g.version;for(let S=0,y=M.length/3-1;S<y;S+=3){let w=S+0,E=S+1,C=S+2;u.push(w,E,E,C,C,w)}}let p=new(g.count>=65535?dr:ur)(u,1);p.version=_;let m=r.get(d);m&&t.remove(m),r.set(d,p)}function h(d){let u=r.get(d);if(u){let f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:a,update:l,getWireframeAttribute:h}}function yg(i,t,e){let n;function s(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function l(d,u){i.drawElements(n,u,r,d*o),e.update(u,n,1)}function c(d,u,f){f!==0&&(i.drawElementsInstanced(n,u,r,d*o,f),e.update(u,n,f))}function h(d,u,f){if(f===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let _=0;for(let p=0;p<f;p++)_+=u[p];e.update(_,n,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function Mg(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:Ft("WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Sg(i,t,e){let n=new WeakMap,s=new be;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=h!==void 0?h.length:0,u=n.get(a);if(u===void 0||u.count!==d){let T=function(){C.dispose(),n.delete(a),a.removeEventListener("dispose",T)};u!==void 0&&u.texture.dispose();let f=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],m=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],S=0;f===!0&&(S=1),g===!0&&(S=2),_===!0&&(S=3);let y=a.attributes.position.count*S,w=1;y>t.maxTextureSize&&(w=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);let E=new Float32Array(y*w*4*d),C=new lr(E,y,w,d);C.type=Sn,C.needsUpdate=!0;let x=S*4;for(let P=0;P<d;P++){let I=p[P],U=m[P],G=M[P],X=y*w*4*P;for(let F=0;F<I.count;F++){let W=F*x;f===!0&&(s.fromBufferAttribute(I,F),E[X+W+0]=s.x,E[X+W+1]=s.y,E[X+W+2]=s.z,E[X+W+3]=0),g===!0&&(s.fromBufferAttribute(U,F),E[X+W+4]=s.x,E[X+W+5]=s.y,E[X+W+6]=s.z,E[X+W+7]=0),_===!0&&(s.fromBufferAttribute(G,F),E[X+W+8]=s.x,E[X+W+9]=s.y,E[X+W+10]=s.z,E[X+W+11]=G.itemSize===4?s.w:1)}}u={count:d,texture:C,size:new it(y,w)},n.set(a,u),a.addEventListener("dispose",T)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let f=0;for(let _=0;_<c.length;_++)f+=c[_];let g=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function bg(i,t,e,n,s){let r=new WeakMap;function o(c){let h=s.render.frame,d=c.geometry,u=t.get(c,d);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:o,dispose:a}}var Eg={[xc]:"LINEAR_TONE_MAPPING",[_c]:"REINHARD_TONE_MAPPING",[vc]:"CINEON_TONE_MAPPING",[Ur]:"ACES_FILMIC_TONE_MAPPING",[Mc]:"AGX_TONE_MAPPING",[Sc]:"NEUTRAL_TONE_MAPPING",[yc]:"CUSTOM_TONE_MAPPING"};function Tg(i,t,e,n,s,r){let o=new pn(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new ri(t,e):void 0}),a=new pn(t,e,{type:qn,depthBuffer:!1,stencilBuffer:!1}),l=new de;l.setAttribute("position",new qt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new qt([0,2,0,0,2,0],2));let c=new Ko({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new zt(l,c),d=new Ps(-1,1,1,-1,0,1),u=null,f=null,g=!1,_,p=null,m=[],M=!1;this.setSize=function(S,y){o.setSize(S,y),a.setSize(S,y);for(let w=0;w<m.length;w++){let E=m[w];E.setSize&&E.setSize(S,y)}},this.setEffects=function(S){m=S,M=m.length>0&&m[0].isRenderPass===!0;let y=o.width,w=o.height;for(let E=0;E<m.length;E++){let C=m[E];C.setSize&&C.setSize(y,w)}},this.begin=function(S,y){if(g||S.toneMapping===In&&m.length===0)return!1;if(p=y,y!==null){let w=y.width,E=y.height;(o.width!==w||o.height!==E)&&this.setSize(w,E)}return M===!1&&S.setRenderTarget(o),_=S.toneMapping,S.toneMapping=In,!0},this.hasRenderPass=function(){return M},this.end=function(S,y){S.toneMapping=_,g=!0;let w=o,E=a;for(let C=0;C<m.length;C++){let x=m[C];if(x.enabled!==!1&&(x.render(S,E,w,y),x.needsSwap!==!1)){let T=w;w=E,E=T}}if(u!==S.outputColorSpace||f!==S.toneMapping){u=S.outputColorSpace,f=S.toneMapping,c.defines={},oe.getTransfer(u)===ue&&(c.defines.SRGB_TRANSFER="");let C=Eg[f];C&&(c.defines[C]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=w.texture,S.setRenderTarget(p),S.render(h,d),p=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){o.depthTexture&&o.depthTexture.dispose(),o.dispose(),a.dispose(),l.dispose(),c.dispose()}}var xd=new je,Zc=new ri(1,1),_d=new lr,vd=new ko,yd=new mr,Qu=[],ju=[],td=new Float32Array(16),ed=new Float32Array(9),nd=new Float32Array(4);function Os(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=Qu[s];if(r===void 0&&(r=new Float32Array(s),Qu[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function Ne(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Fe(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function ll(i,t){let e=ju[t];e===void 0&&(e=new Int32Array(t),ju[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function wg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Ag(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ne(e,t))return;i.uniform2fv(this.addr,t),Fe(e,t)}}function Rg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Ne(e,t))return;i.uniform3fv(this.addr,t),Fe(e,t)}}function Cg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ne(e,t))return;i.uniform4fv(this.addr,t),Fe(e,t)}}function Pg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ne(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Fe(e,t)}else{if(Ne(e,n))return;nd.set(n),i.uniformMatrix2fv(this.addr,!1,nd),Fe(e,n)}}function Ig(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ne(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Fe(e,t)}else{if(Ne(e,n))return;ed.set(n),i.uniformMatrix3fv(this.addr,!1,ed),Fe(e,n)}}function Lg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ne(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Fe(e,t)}else{if(Ne(e,n))return;td.set(n),i.uniformMatrix4fv(this.addr,!1,td),Fe(e,n)}}function Dg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Ug(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ne(e,t))return;i.uniform2iv(this.addr,t),Fe(e,t)}}function Ng(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ne(e,t))return;i.uniform3iv(this.addr,t),Fe(e,t)}}function Fg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ne(e,t))return;i.uniform4iv(this.addr,t),Fe(e,t)}}function Og(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Bg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ne(e,t))return;i.uniform2uiv(this.addr,t),Fe(e,t)}}function zg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ne(e,t))return;i.uniform3uiv(this.addr,t),Fe(e,t)}}function Vg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ne(e,t))return;i.uniform4uiv(this.addr,t),Fe(e,t)}}function kg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Zc.compareFunction=e.isReversedDepthBuffer()?el:tl,r=Zc):r=xd,e.setTexture2D(t||r,s)}function Hg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||vd,s)}function Gg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||yd,s)}function Wg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||_d,s)}function Xg(i){switch(i){case 5126:return wg;case 35664:return Ag;case 35665:return Rg;case 35666:return Cg;case 35674:return Pg;case 35675:return Ig;case 35676:return Lg;case 5124:case 35670:return Dg;case 35667:case 35671:return Ug;case 35668:case 35672:return Ng;case 35669:case 35673:return Fg;case 5125:return Og;case 36294:return Bg;case 36295:return zg;case 36296:return Vg;case 35678:case 36198:case 36298:case 36306:case 35682:return kg;case 35679:case 36299:case 36307:return Hg;case 35680:case 36300:case 36308:case 36293:return Gg;case 36289:case 36303:case 36311:case 36292:return Wg}}function qg(i,t){i.uniform1fv(this.addr,t)}function Yg(i,t){let e=Os(t,this.size,2);i.uniform2fv(this.addr,e)}function Zg(i,t){let e=Os(t,this.size,3);i.uniform3fv(this.addr,e)}function $g(i,t){let e=Os(t,this.size,4);i.uniform4fv(this.addr,e)}function Jg(i,t){let e=Os(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function Kg(i,t){let e=Os(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function Qg(i,t){let e=Os(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function jg(i,t){i.uniform1iv(this.addr,t)}function tx(i,t){i.uniform2iv(this.addr,t)}function ex(i,t){i.uniform3iv(this.addr,t)}function nx(i,t){i.uniform4iv(this.addr,t)}function ix(i,t){i.uniform1uiv(this.addr,t)}function sx(i,t){i.uniform2uiv(this.addr,t)}function rx(i,t){i.uniform3uiv(this.addr,t)}function ox(i,t){i.uniform4uiv(this.addr,t)}function ax(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Ne(n,r)||(i.uniform1iv(this.addr,r),Fe(n,r));let o;this.type===i.SAMPLER_2D_SHADOW?o=Zc:o=xd;for(let a=0;a!==s;++a)e.setTexture2D(t[a]||o,r[a])}function lx(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Ne(n,r)||(i.uniform1iv(this.addr,r),Fe(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||vd,r[o])}function cx(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Ne(n,r)||(i.uniform1iv(this.addr,r),Fe(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||yd,r[o])}function hx(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Ne(n,r)||(i.uniform1iv(this.addr,r),Fe(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||_d,r[o])}function ux(i){switch(i){case 5126:return qg;case 35664:return Yg;case 35665:return Zg;case 35666:return $g;case 35674:return Jg;case 35675:return Kg;case 35676:return Qg;case 5124:case 35670:return jg;case 35667:case 35671:return tx;case 35668:case 35672:return ex;case 35669:case 35673:return nx;case 5125:return ix;case 36294:return sx;case 36295:return rx;case 36296:return ox;case 35678:case 36198:case 36298:case 36306:case 35682:return ax;case 35679:case 36299:case 36307:return lx;case 35680:case 36300:case 36308:case 36293:return cx;case 36289:case 36303:case 36311:case 36292:return hx}}var $c=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Xg(e.type)}},Jc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=ux(e.type)}},Kc=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(t,e[a.id],n)}}},qc=/(\w+)(\])?(\[|\.)?/g;function id(i,t){i.seq.push(t),i.map[t.id]=t}function dx(i,t,e){let n=i.name,s=n.length;for(qc.lastIndex=0;;){let r=qc.exec(n),o=qc.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){id(e,c===void 0?new $c(a,i,t):new Jc(a,i,t));break}else{let d=e.map[a];d===void 0&&(d=new Kc(a),id(e,d)),e=d}}}var Fs=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);dx(a,l,this)}let s=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let o=t[s];o.id in e&&n.push(o)}return n}};function sd(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var fx=37297,px=0;function mx(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){let a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}var rd=new Yt;function gx(i){oe._getMatrix(rd,oe.workingColorSpace,i);let t=`mat3( ${rd.elements.map(e=>e.toFixed(4))} )`;switch(oe.getTransfer(i)){case rr:return[t,"LinearTransferOETF"];case ue:return[t,"sRGBTransferOETF"];default:return Bt("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function od(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+mx(i.getShaderSource(t),a)}else return r}function xx(i,t){let e=gx(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var _x={[xc]:"Linear",[_c]:"Reinhard",[vc]:"Cineon",[Ur]:"ACESFilmic",[Mc]:"AgX",[Sc]:"Neutral",[yc]:"Custom"};function vx(i,t){let e=_x[t];return e===void 0?(Bt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var il=new R;function yx(){oe.getLuminanceCoefficients(il);let i=il.x.toFixed(4),t=il.y.toFixed(4),e=il.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Mx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Xr).join(`
`)}function Sx(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function bx(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),o=r.name,a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function Xr(i){return i!==""}function ad(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function ld(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Ex=/^[ \t]*#include +<([\w\d./]+)>/gm;function Qc(i){return i.replace(Ex,wx)}var Tx=new Map;function wx(i,t){let e=jt[t];if(e===void 0){let n=Tx.get(t);if(n!==void 0)e=jt[n],Bt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Qc(e)}var Ax=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function cd(i){return i.replace(Ax,Rx)}function Rx(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function hd(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var Cx={[qi]:"SHADOWMAP_TYPE_PCF",[Ls]:"SHADOWMAP_TYPE_VSM"};function Px(i){return Cx[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Ix={[Ei]:"ENVMAP_TYPE_CUBE",[Yi]:"ENVMAP_TYPE_CUBE",[Nr]:"ENVMAP_TYPE_CUBE_UV"};function Lx(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Ix[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Dx={[Yi]:"ENVMAP_MODE_REFRACTION"};function Ux(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Dx[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Nx={[gc]:"ENVMAP_BLENDING_MULTIPLY",[Eu]:"ENVMAP_BLENDING_MIX",[Tu]:"ENVMAP_BLENDING_ADD"};function Fx(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Nx[i.combine]||"ENVMAP_BLENDING_NONE"}function Ox(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Bx(i,t,e,n){let s=i.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=Px(e),c=Lx(e),h=Ux(e),d=Fx(e),u=Ox(e),f=Mx(e),g=Sx(r),_=s.createProgram(),p,m,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Xr).join(`
`),p.length>0&&(p+=`
`),m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Xr).join(`
`),m.length>0&&(m+=`
`)):(p=[hd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Xr).join(`
`),m=[hd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==In?"#define TONE_MAPPING":"",e.toneMapping!==In?jt.tonemapping_pars_fragment:"",e.toneMapping!==In?vx("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",jt.colorspace_pars_fragment,xx("linearToOutputTexel",e.outputColorSpace),yx(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Xr).join(`
`)),o=Qc(o),o=ad(o,e),o=ld(o,e),a=Qc(a),a=ad(a,e),a=ld(a,e),o=cd(o),a=cd(a),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,p=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,m=["#define varying in",e.glslVersion===Ic?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Ic?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let S=M+p+o,y=M+m+a,w=sd(s,s.VERTEX_SHADER,S),E=sd(s,s.FRAGMENT_SHADER,y);s.attachShader(_,w),s.attachShader(_,E),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function C(I){if(i.debug.checkShaderErrors){let U=s.getProgramInfoLog(_)||"",G=s.getShaderInfoLog(w)||"",X=s.getShaderInfoLog(E)||"",F=U.trim(),W=G.trim(),k=X.trim(),K=!0,Q=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(K=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,w,E);else{let rt=od(s,w,"vertex"),ot=od(s,E,"fragment");Ft("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+F+`
`+rt+`
`+ot)}else F!==""?Bt("WebGLProgram: Program Info Log:",F):(W===""||k==="")&&(Q=!1);Q&&(I.diagnostics={runnable:K,programLog:F,vertexShader:{log:W,prefix:p},fragmentShader:{log:k,prefix:m}})}s.deleteShader(w),s.deleteShader(E),x=new Fs(s,_),T=bx(s,_)}let x;this.getUniforms=function(){return x===void 0&&C(this),x};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let P=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=s.getProgramParameter(_,fx)),P},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=px++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=w,this.fragmentShader=E,this}var zx=0,jc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new th(t),e.set(t,n)),n}},th=class{constructor(t){this.id=zx++,this.code=t,this.usedTimes=0}};function Vx(i){return i===Ai||i===kr||i===Hr}function kx(i,t,e,n,s,r){let o=new Ms,a=new jc,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,u=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(x){return l.add(x),x===0?"uv":`uv${x}`}function _(x,T,P,I,U,G){let X=I.fog,F=U.geometry,W=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?I.environment:null,k=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,K=t.get(x.envMap||W,k),Q=K&&K.mapping===Nr?K.image.height:null,rt=f[x.type];x.precision!==null&&(u=n.getMaxPrecision(x.precision),u!==x.precision&&Bt("WebGLProgram.getParameters:",x.precision,"not supported, using",u,"instead."));let ot=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,ct=ot!==void 0?ot.length:0,Gt=0;F.morphAttributes.position!==void 0&&(Gt=1),F.morphAttributes.normal!==void 0&&(Gt=2),F.morphAttributes.color!==void 0&&(Gt=3);let le,te,Z,lt;if(rt){let At=Zn[rt];le=At.vertexShader,te=At.fragmentShader}else{le=x.vertexShader,te=x.fragmentShader;let At=a.getVertexShaderStage(x),Te=a.getFragmentShaderStage(x);a.update(x,At,Te),Z=At.id,lt=Te.id}let tt=i.getRenderTarget(),St=i.state.buffers.depth.getReversed(),wt=U.isInstancedMesh===!0,bt=U.isBatchedMesh===!0,Qt=!!x.map,Ut=!!x.matcap,j=!!K,nt=!!x.aoMap,st=!!x.lightMap,_t=!!x.bumpMap&&x.wireframe===!1,mt=!!x.normalMap,Ot=!!x.displacementMap,Pt=!!x.emissiveMap,Wt=!!x.metalnessMap,Zt=!!x.roughnessMap,L=x.anisotropy>0,fe=x.clearcoat>0,se=x.dispersion>0,A=x.iridescence>0,v=x.sheen>0,O=x.transmission>0,V=L&&!!x.anisotropyMap,q=fe&&!!x.clearcoatMap,at=fe&&!!x.clearcoatNormalMap,ht=fe&&!!x.clearcoatRoughnessMap,Y=A&&!!x.iridescenceMap,J=A&&!!x.iridescenceThicknessMap,dt=v&&!!x.sheenColorMap,It=v&&!!x.sheenRoughnessMap,gt=!!x.specularMap,ft=!!x.specularColorMap,Nt=!!x.specularIntensityMap,Vt=O&&!!x.transmissionMap,$t=O&&!!x.thicknessMap,D=!!x.gradientMap,ut=!!x.alphaMap,$=x.alphaTest>0,pt=!!x.alphaHash,Mt=!!x.extensions,et=In;x.toneMapped&&(tt===null||tt.isXRRenderTarget===!0)&&(et=i.toneMapping);let Ct={shaderID:rt,shaderType:x.type,shaderName:x.name,vertexShader:le,fragmentShader:te,defines:x.defines,customVertexShaderID:Z,customFragmentShaderID:lt,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:u,batching:bt,batchingColor:bt&&U._colorsTexture!==null,instancing:wt,instancingColor:wt&&U.instanceColor!==null,instancingMorph:wt&&U.morphTexture!==null,outputColorSpace:tt===null?i.outputColorSpace:tt.isXRRenderTarget===!0?tt.texture.colorSpace:oe.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Qt,matcap:Ut,envMap:j,envMapMode:j&&K.mapping,envMapCubeUVHeight:Q,aoMap:nt,lightMap:st,bumpMap:_t,normalMap:mt,displacementMap:Ot,emissiveMap:Pt,normalMapObjectSpace:mt&&x.normalMapType===Ru,normalMapTangentSpace:mt&&x.normalMapType===ja,packedNormalMap:mt&&x.normalMapType===ja&&Vx(x.normalMap.format),metalnessMap:Wt,roughnessMap:Zt,anisotropy:L,anisotropyMap:V,clearcoat:fe,clearcoatMap:q,clearcoatNormalMap:at,clearcoatRoughnessMap:ht,dispersion:se,iridescence:A,iridescenceMap:Y,iridescenceThicknessMap:J,sheen:v,sheenColorMap:dt,sheenRoughnessMap:It,specularMap:gt,specularColorMap:ft,specularIntensityMap:Nt,transmission:O,transmissionMap:Vt,thicknessMap:$t,gradientMap:D,opaque:x.transparent===!1&&x.blending===Cn&&x.alphaToCoverage===!1,alphaMap:ut,alphaTest:$,alphaHash:pt,combine:x.combine,mapUv:Qt&&g(x.map.channel),aoMapUv:nt&&g(x.aoMap.channel),lightMapUv:st&&g(x.lightMap.channel),bumpMapUv:_t&&g(x.bumpMap.channel),normalMapUv:mt&&g(x.normalMap.channel),displacementMapUv:Ot&&g(x.displacementMap.channel),emissiveMapUv:Pt&&g(x.emissiveMap.channel),metalnessMapUv:Wt&&g(x.metalnessMap.channel),roughnessMapUv:Zt&&g(x.roughnessMap.channel),anisotropyMapUv:V&&g(x.anisotropyMap.channel),clearcoatMapUv:q&&g(x.clearcoatMap.channel),clearcoatNormalMapUv:at&&g(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ht&&g(x.clearcoatRoughnessMap.channel),iridescenceMapUv:Y&&g(x.iridescenceMap.channel),iridescenceThicknessMapUv:J&&g(x.iridescenceThicknessMap.channel),sheenColorMapUv:dt&&g(x.sheenColorMap.channel),sheenRoughnessMapUv:It&&g(x.sheenRoughnessMap.channel),specularMapUv:gt&&g(x.specularMap.channel),specularColorMapUv:ft&&g(x.specularColorMap.channel),specularIntensityMapUv:Nt&&g(x.specularIntensityMap.channel),transmissionMapUv:Vt&&g(x.transmissionMap.channel),thicknessMapUv:$t&&g(x.thicknessMap.channel),alphaMapUv:ut&&g(x.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(mt||L),vertexNormals:!!F.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!F.attributes.uv&&(Qt||ut),fog:!!X,useFog:x.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||F.attributes.normal===void 0&&mt===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:St,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:F.attributes.position!==void 0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:ct,morphTextureStride:Gt,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:G.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:et,decodeVideoTexture:Qt&&x.map.isVideoTexture===!0&&oe.getTransfer(x.map.colorSpace)===ue,decodeVideoTextureEmissive:Pt&&x.emissiveMap.isVideoTexture===!0&&oe.getTransfer(x.emissiveMap.colorSpace)===ue,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===$e,flipSided:x.side===Ue,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:Mt&&x.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Mt&&x.extensions.multiDraw===!0||bt)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ct.vertexUv1s=l.has(1),Ct.vertexUv2s=l.has(2),Ct.vertexUv3s=l.has(3),l.clear(),Ct}function p(x){let T=[];if(x.shaderID?T.push(x.shaderID):(T.push(x.customVertexShaderID),T.push(x.customFragmentShaderID)),x.defines!==void 0)for(let P in x.defines)T.push(P),T.push(x.defines[P]);return x.isRawShaderMaterial===!1&&(m(T,x),M(T,x),T.push(i.outputColorSpace)),T.push(x.customProgramCacheKey),T.join()}function m(x,T){x.push(T.precision),x.push(T.outputColorSpace),x.push(T.envMapMode),x.push(T.envMapCubeUVHeight),x.push(T.mapUv),x.push(T.alphaMapUv),x.push(T.lightMapUv),x.push(T.aoMapUv),x.push(T.bumpMapUv),x.push(T.normalMapUv),x.push(T.displacementMapUv),x.push(T.emissiveMapUv),x.push(T.metalnessMapUv),x.push(T.roughnessMapUv),x.push(T.anisotropyMapUv),x.push(T.clearcoatMapUv),x.push(T.clearcoatNormalMapUv),x.push(T.clearcoatRoughnessMapUv),x.push(T.iridescenceMapUv),x.push(T.iridescenceThicknessMapUv),x.push(T.sheenColorMapUv),x.push(T.sheenRoughnessMapUv),x.push(T.specularMapUv),x.push(T.specularColorMapUv),x.push(T.specularIntensityMapUv),x.push(T.transmissionMapUv),x.push(T.thicknessMapUv),x.push(T.combine),x.push(T.fogExp2),x.push(T.sizeAttenuation),x.push(T.morphTargetsCount),x.push(T.morphAttributeCount),x.push(T.numDirLights),x.push(T.numPointLights),x.push(T.numSpotLights),x.push(T.numSpotLightMaps),x.push(T.numHemiLights),x.push(T.numRectAreaLights),x.push(T.numDirLightShadows),x.push(T.numPointLightShadows),x.push(T.numSpotLightShadows),x.push(T.numSpotLightShadowsWithMaps),x.push(T.numLightProbes),x.push(T.shadowMapType),x.push(T.toneMapping),x.push(T.numClippingPlanes),x.push(T.numClipIntersection),x.push(T.depthPacking)}function M(x,T){o.disableAll(),T.instancing&&o.enable(0),T.instancingColor&&o.enable(1),T.instancingMorph&&o.enable(2),T.matcap&&o.enable(3),T.envMap&&o.enable(4),T.normalMapObjectSpace&&o.enable(5),T.normalMapTangentSpace&&o.enable(6),T.clearcoat&&o.enable(7),T.iridescence&&o.enable(8),T.alphaTest&&o.enable(9),T.vertexColors&&o.enable(10),T.vertexAlphas&&o.enable(11),T.vertexUv1s&&o.enable(12),T.vertexUv2s&&o.enable(13),T.vertexUv3s&&o.enable(14),T.vertexTangents&&o.enable(15),T.anisotropy&&o.enable(16),T.alphaHash&&o.enable(17),T.batching&&o.enable(18),T.dispersion&&o.enable(19),T.batchingColor&&o.enable(20),T.gradientMap&&o.enable(21),T.packedNormalMap&&o.enable(22),T.vertexNormals&&o.enable(23),x.push(o.mask),o.disableAll(),T.fog&&o.enable(0),T.useFog&&o.enable(1),T.flatShading&&o.enable(2),T.logarithmicDepthBuffer&&o.enable(3),T.reversedDepthBuffer&&o.enable(4),T.skinning&&o.enable(5),T.morphTargets&&o.enable(6),T.morphNormals&&o.enable(7),T.morphColors&&o.enable(8),T.premultipliedAlpha&&o.enable(9),T.shadowMapEnabled&&o.enable(10),T.doubleSided&&o.enable(11),T.flipSided&&o.enable(12),T.useDepthPacking&&o.enable(13),T.dithering&&o.enable(14),T.transmission&&o.enable(15),T.sheen&&o.enable(16),T.opaque&&o.enable(17),T.pointsUvs&&o.enable(18),T.decodeVideoTexture&&o.enable(19),T.decodeVideoTextureEmissive&&o.enable(20),T.alphaToCoverage&&o.enable(21),T.numLightProbeGrids>0&&o.enable(22),T.hasPositionAttribute&&o.enable(23),x.push(o.mask)}function S(x){let T=f[x.type],P;if(T){let I=Zn[T];P=Xu.clone(I.uniforms)}else P=x.uniforms;return P}function y(x,T){let P=h.get(T);return P!==void 0?++P.usedTimes:(P=new Bx(i,T,x,s),c.push(P),h.set(T,P)),P}function w(x){if(--x.usedTimes===0){let T=c.indexOf(x);c[T]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function E(x){a.remove(x)}function C(){a.dispose()}return{getParameters:_,getProgramCacheKey:p,getUniforms:S,acquireProgram:y,releaseProgram:w,releaseShaderCache:E,programs:c,dispose:C}}function Hx(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Gx(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function ud(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function dd(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function a(u,f,g,_,p,m){let M=i[t];return M===void 0?(M={id:u.id,object:u,geometry:f,material:g,materialVariant:o(u),groupOrder:_,renderOrder:u.renderOrder,z:p,group:m},i[t]=M):(M.id=u.id,M.object=u,M.geometry=f,M.material=g,M.materialVariant=o(u),M.groupOrder=_,M.renderOrder=u.renderOrder,M.z=p,M.group=m),t++,M}function l(u,f,g,_,p,m){let M=a(u,f,g,_,p,m);g.transmission>0?n.push(M):g.transparent===!0?s.push(M):e.push(M)}function c(u,f,g,_,p,m){let M=a(u,f,g,_,p,m);g.transmission>0?n.unshift(M):g.transparent===!0?s.unshift(M):e.unshift(M)}function h(u,f,g){e.length>1&&e.sort(u||Gx),n.length>1&&n.sort(f||ud),s.length>1&&s.sort(f||ud),g&&(e.reverse(),n.reverse(),s.reverse())}function d(){for(let u=t,f=i.length;u<f;u++){let g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:d,sort:h}}function Wx(){let i=new WeakMap;function t(n,s){let r=i.get(n),o;return r===void 0?(o=new dd,i.set(n,[o])):s>=r.length?(o=new dd,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function Xx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new R,color:new Ht};break;case"SpotLight":e={position:new R,direction:new R,color:new Ht,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new R,color:new Ht,distance:0,decay:0};break;case"HemisphereLight":e={direction:new R,skyColor:new Ht,groundColor:new Ht};break;case"RectAreaLight":e={color:new Ht,position:new R,halfWidth:new R,halfHeight:new R};break}return i[t.id]=e,e}}}function qx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new it,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var Yx=0;function Zx(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function $x(i){let t=new Xx,e=qx(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new R);let s=new R,r=new ae,o=new ae;function a(c){let h=0,d=0,u=0;for(let T=0;T<9;T++)n.probe[T].set(0,0,0);let f=0,g=0,_=0,p=0,m=0,M=0,S=0,y=0,w=0,E=0,C=0;c.sort(Zx);for(let T=0,P=c.length;T<P;T++){let I=c[T],U=I.color,G=I.intensity,X=I.distance,F=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===Ai?F=I.shadow.map.texture:F=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)h+=U.r*G,d+=U.g*G,u+=U.b*G;else if(I.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(I.sh.coefficients[W],G);C++}else if(I.isDirectionalLight){let W=t.get(I);if(W.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){let k=I.shadow,K=e.get(I);K.shadowIntensity=k.intensity,K.shadowBias=k.bias,K.shadowNormalBias=k.normalBias,K.shadowRadius=k.radius,K.shadowMapSize=k.mapSize,n.directionalShadow[f]=K,n.directionalShadowMap[f]=F,n.directionalShadowMatrix[f]=I.shadow.matrix,M++}n.directional[f]=W,f++}else if(I.isSpotLight){let W=t.get(I);W.position.setFromMatrixPosition(I.matrixWorld),W.color.copy(U).multiplyScalar(G),W.distance=X,W.coneCos=Math.cos(I.angle),W.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),W.decay=I.decay,n.spot[_]=W;let k=I.shadow;if(I.map&&(n.spotLightMap[w]=I.map,w++,k.updateMatrices(I),I.castShadow&&E++),n.spotLightMatrix[_]=k.matrix,I.castShadow){let K=e.get(I);K.shadowIntensity=k.intensity,K.shadowBias=k.bias,K.shadowNormalBias=k.normalBias,K.shadowRadius=k.radius,K.shadowMapSize=k.mapSize,n.spotShadow[_]=K,n.spotShadowMap[_]=F,y++}_++}else if(I.isRectAreaLight){let W=t.get(I);W.color.copy(U).multiplyScalar(G),W.halfWidth.set(I.width*.5,0,0),W.halfHeight.set(0,I.height*.5,0),n.rectArea[p]=W,p++}else if(I.isPointLight){let W=t.get(I);if(W.color.copy(I.color).multiplyScalar(I.intensity),W.distance=I.distance,W.decay=I.decay,I.castShadow){let k=I.shadow,K=e.get(I);K.shadowIntensity=k.intensity,K.shadowBias=k.bias,K.shadowNormalBias=k.normalBias,K.shadowRadius=k.radius,K.shadowMapSize=k.mapSize,K.shadowCameraNear=k.camera.near,K.shadowCameraFar=k.camera.far,n.pointShadow[g]=K,n.pointShadowMap[g]=F,n.pointShadowMatrix[g]=I.shadow.matrix,S++}n.point[g]=W,g++}else if(I.isHemisphereLight){let W=t.get(I);W.skyColor.copy(I.color).multiplyScalar(G),W.groundColor.copy(I.groundColor).multiplyScalar(G),n.hemi[m]=W,m++}}p>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=xt.LTC_FLOAT_1,n.rectAreaLTC2=xt.LTC_FLOAT_2):(n.rectAreaLTC1=xt.LTC_HALF_1,n.rectAreaLTC2=xt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;let x=n.hash;(x.directionalLength!==f||x.pointLength!==g||x.spotLength!==_||x.rectAreaLength!==p||x.hemiLength!==m||x.numDirectionalShadows!==M||x.numPointShadows!==S||x.numSpotShadows!==y||x.numSpotMaps!==w||x.numLightProbes!==C)&&(n.directional.length=f,n.spot.length=_,n.rectArea.length=p,n.point.length=g,n.hemi.length=m,n.directionalShadow.length=M,n.directionalShadowMap.length=M,n.pointShadow.length=S,n.pointShadowMap.length=S,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=M,n.pointShadowMatrix.length=S,n.spotLightMatrix.length=y+w-E,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=E,n.numLightProbes=C,x.directionalLength=f,x.pointLength=g,x.spotLength=_,x.rectAreaLength=p,x.hemiLength=m,x.numDirectionalShadows=M,x.numPointShadows=S,x.numSpotShadows=y,x.numSpotMaps=w,x.numLightProbes=C,n.version=Yx++)}function l(c,h){let d=0,u=0,f=0,g=0,_=0,p=h.matrixWorldInverse;for(let m=0,M=c.length;m<M;m++){let S=c[m];if(S.isDirectionalLight){let y=n.directional[d];y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(p),d++}else if(S.isSpotLight){let y=n.spot[f];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(p),f++}else if(S.isRectAreaLight){let y=n.rectArea[g];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),o.identity(),r.copy(S.matrixWorld),r.premultiply(p),o.extractRotation(r),y.halfWidth.set(S.width*.5,0,0),y.halfHeight.set(0,S.height*.5,0),y.halfWidth.applyMatrix4(o),y.halfHeight.applyMatrix4(o),g++}else if(S.isPointLight){let y=n.point[u];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),u++}else if(S.isHemisphereLight){let y=n.hemi[_];y.direction.setFromMatrixPosition(S.matrixWorld),y.direction.transformDirection(p),_++}}}return{setup:a,setupView:l,state:n}}function fd(i){let t=new $x(i),e=[],n=[],s=[];function r(u){d.camera=u,e.length=0,n.length=0,s.length=0}function o(u){e.push(u)}function a(u){n.push(u)}function l(u){s.push(u)}function c(){t.setup(e)}function h(u){t.setupView(e,u)}let d={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Jx(i){let t=new WeakMap;function e(s,r=0){let o=t.get(s),a;return o===void 0?(a=new fd(i),t.set(s,[a])):r>=o.length?(a=new fd(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}var Kx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Qx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,jx=[new R(1,0,0),new R(-1,0,0),new R(0,1,0),new R(0,-1,0),new R(0,0,1),new R(0,0,-1)],t_=[new R(0,-1,0),new R(0,-1,0),new R(0,0,1),new R(0,0,-1),new R(0,-1,0),new R(0,-1,0)],pd=new ae,Wr=new R,Yc=new R;function e_(i,t,e){let n=new ws,s=new it,r=new it,o=new be,a=new Qo,l=new jo,c={},h=e.maxTextureSize,d={[si]:Ue,[Ue]:si,[$e]:$e},u=new ke({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new it},radius:{value:4}},vertexShader:Kx,fragmentShader:Qx}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let g=new de;g.setAttribute("position",new ye(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new zt(g,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=qi;let m=this.type;this.render=function(E,C,x){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||E.length===0)return;this.type===ru&&(Bt("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=qi);let T=i.getRenderTarget(),P=i.getActiveCubeFace(),I=i.getActiveMipmapLevel(),U=i.state;U.setBlending(Xn),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let G=m!==this.type;G&&C.traverse(function(X){X.material&&(Array.isArray(X.material)?X.material.forEach(F=>F.needsUpdate=!0):X.material.needsUpdate=!0)});for(let X=0,F=E.length;X<F;X++){let W=E[X],k=W.shadow;if(k===void 0){Bt("WebGLShadowMap:",W,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;s.copy(k.mapSize);let K=k.getFrameExtents();s.multiply(K),r.copy(k.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/K.x),s.x=r.x*K.x,k.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/K.y),s.y=r.y*K.y,k.mapSize.y=r.y));let Q=i.state.buffers.depth.getReversed();if(k.camera._reversedDepth=Q,k.map===null||G===!0){if(k.map!==null&&(k.map.depthTexture!==null&&(k.map.depthTexture.dispose(),k.map.depthTexture=null),k.map.dispose()),this.type===Ls){if(W.isPointLight){Bt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}k.map=new pn(s.x,s.y,{format:Ai,type:qn,minFilter:Ie,magFilter:Ie,generateMipmaps:!1}),k.map.texture.name=W.name+".shadowMap",k.map.depthTexture=new ri(s.x,s.y,Sn),k.map.depthTexture.name=W.name+".shadowMapDepth",k.map.depthTexture.format=zn,k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=ze,k.map.depthTexture.magFilter=ze}else W.isPointLight?(k.map=new rl(s.x),k.map.depthTexture=new Go(s.x,Ln)):(k.map=new pn(s.x,s.y),k.map.depthTexture=new ri(s.x,s.y,Ln)),k.map.depthTexture.name=W.name+".shadowMap",k.map.depthTexture.format=zn,this.type===qi?(k.map.depthTexture.compareFunction=Q?el:tl,k.map.depthTexture.minFilter=Ie,k.map.depthTexture.magFilter=Ie):(k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=ze,k.map.depthTexture.magFilter=ze);k.camera.updateProjectionMatrix()}let rt=k.map.isWebGLCubeRenderTarget?6:1;for(let ot=0;ot<rt;ot++){if(k.map.isWebGLCubeRenderTarget)i.setRenderTarget(k.map,ot),i.clear();else{ot===0&&(i.setRenderTarget(k.map),i.clear());let ct=k.getViewport(ot);o.set(r.x*ct.x,r.y*ct.y,r.x*ct.z,r.y*ct.w),U.viewport(o)}if(W.isPointLight){let ct=k.camera,Gt=k.matrix,le=W.distance||ct.far;le!==ct.far&&(ct.far=le,ct.updateProjectionMatrix()),Wr.setFromMatrixPosition(W.matrixWorld),ct.position.copy(Wr),Yc.copy(ct.position),Yc.add(jx[ot]),ct.up.copy(t_[ot]),ct.lookAt(Yc),ct.updateMatrixWorld(),Gt.makeTranslation(-Wr.x,-Wr.y,-Wr.z),pd.multiplyMatrices(ct.projectionMatrix,ct.matrixWorldInverse),k._frustum.setFromProjectionMatrix(pd,ct.coordinateSystem,ct.reversedDepth)}else k.updateMatrices(W);n=k.getFrustum(),y(C,x,k.camera,W,this.type)}k.isPointLightShadow!==!0&&this.type===Ls&&M(k,x),k.needsUpdate=!1}m=this.type,p.needsUpdate=!1,i.setRenderTarget(T,P,I)};function M(E,C){let x=t.update(_);u.defines.VSM_SAMPLES!==E.blurSamples&&(u.defines.VSM_SAMPLES=E.blurSamples,f.defines.VSM_SAMPLES=E.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new pn(s.x,s.y,{format:Ai,type:qn})),u.uniforms.shadow_pass.value=E.map.depthTexture,u.uniforms.resolution.value=E.mapSize,u.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(C,null,x,u,_,null),f.uniforms.shadow_pass.value=E.mapPass.texture,f.uniforms.resolution.value=E.mapSize,f.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(C,null,x,f,_,null)}function S(E,C,x,T){let P=null,I=x.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(I!==void 0)P=I;else if(P=x.isPointLight===!0?l:a,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){let U=P.uuid,G=C.uuid,X=c[U];X===void 0&&(X={},c[U]=X);let F=X[G];F===void 0&&(F=P.clone(),X[G]=F,C.addEventListener("dispose",w)),P=F}if(P.visible=C.visible,P.wireframe=C.wireframe,T===Ls?P.side=C.shadowSide!==null?C.shadowSide:C.side:P.side=C.shadowSide!==null?C.shadowSide:d[C.side],P.alphaMap=C.alphaMap,P.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,P.map=C.map,P.clipShadows=C.clipShadows,P.clippingPlanes=C.clippingPlanes,P.clipIntersection=C.clipIntersection,P.displacementMap=C.displacementMap,P.displacementScale=C.displacementScale,P.displacementBias=C.displacementBias,P.wireframeLinewidth=C.wireframeLinewidth,P.linewidth=C.linewidth,x.isPointLight===!0&&P.isMeshDistanceMaterial===!0){let U=i.properties.get(P);U.light=x}return P}function y(E,C,x,T,P){if(E.visible===!1)return;if(E.layers.test(C.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&P===Ls)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,E.matrixWorld);let G=t.update(E),X=E.material;if(Array.isArray(X)){let F=G.groups;for(let W=0,k=F.length;W<k;W++){let K=F[W],Q=X[K.materialIndex];if(Q&&Q.visible){let rt=S(E,Q,T,P);E.onBeforeShadow(i,E,C,x,G,rt,K),i.renderBufferDirect(x,null,G,rt,E,K),E.onAfterShadow(i,E,C,x,G,rt,K)}}}else if(X.visible){let F=S(E,X,T,P);E.onBeforeShadow(i,E,C,x,G,F,null),i.renderBufferDirect(x,null,G,F,E,null),E.onAfterShadow(i,E,C,x,G,F,null)}}let U=E.children;for(let G=0,X=U.length;G<X;G++)y(U[G],C,x,T,P)}function w(E){E.target.removeEventListener("dispose",w);for(let x in c){let T=c[x],P=E.target.uuid;P in T&&(T[P].dispose(),delete T[P])}}}function n_(i,t){function e(){let D=!1,ut=new be,$=null,pt=new be(0,0,0,0);return{setMask:function(Mt){$!==Mt&&!D&&(i.colorMask(Mt,Mt,Mt,Mt),$=Mt)},setLocked:function(Mt){D=Mt},setClear:function(Mt,et,Ct,At,Te){Te===!0&&(Mt*=At,et*=At,Ct*=At),ut.set(Mt,et,Ct,At),pt.equals(ut)===!1&&(i.clearColor(Mt,et,Ct,At),pt.copy(ut))},reset:function(){D=!1,$=null,pt.set(-1,0,0,0)}}}function n(){let D=!1,ut=!1,$=null,pt=null,Mt=null;return{setReversed:function(et){if(ut!==et){let Ct=t.get("EXT_clip_control");et?Ct.clipControlEXT(Ct.LOWER_LEFT_EXT,Ct.ZERO_TO_ONE_EXT):Ct.clipControlEXT(Ct.LOWER_LEFT_EXT,Ct.NEGATIVE_ONE_TO_ONE_EXT),ut=et;let At=Mt;Mt=null,this.setClear(At)}},getReversed:function(){return ut},setTest:function(et){et?tt(i.DEPTH_TEST):St(i.DEPTH_TEST)},setMask:function(et){$!==et&&!D&&(i.depthMask(et),$=et)},setFunc:function(et){if(ut&&(et=Bu[et]),pt!==et){switch(et){case Ro:i.depthFunc(i.NEVER);break;case Co:i.depthFunc(i.ALWAYS);break;case Po:i.depthFunc(i.LESS);break;case Vi:i.depthFunc(i.LEQUAL);break;case Io:i.depthFunc(i.EQUAL);break;case Lo:i.depthFunc(i.GEQUAL);break;case Do:i.depthFunc(i.GREATER);break;case Uo:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}pt=et}},setLocked:function(et){D=et},setClear:function(et){Mt!==et&&(Mt=et,ut&&(et=1-et),i.clearDepth(et))},reset:function(){D=!1,$=null,pt=null,Mt=null,ut=!1}}}function s(){let D=!1,ut=null,$=null,pt=null,Mt=null,et=null,Ct=null,At=null,Te=null;return{setTest:function(_e){D||(_e?tt(i.STENCIL_TEST):St(i.STENCIL_TEST))},setMask:function(_e){ut!==_e&&!D&&(i.stencilMask(_e),ut=_e)},setFunc:function(_e,Un,Nn){($!==_e||pt!==Un||Mt!==Nn)&&(i.stencilFunc(_e,Un,Nn),$=_e,pt=Un,Mt=Nn)},setOp:function(_e,Un,Nn){(et!==_e||Ct!==Un||At!==Nn)&&(i.stencilOp(_e,Un,Nn),et=_e,Ct=Un,At=Nn)},setLocked:function(_e){D=_e},setClear:function(_e){Te!==_e&&(i.clearStencil(_e),Te=_e)},reset:function(){D=!1,ut=null,$=null,pt=null,Mt=null,et=null,Ct=null,At=null,Te=null}}}let r=new e,o=new n,a=new s,l=new WeakMap,c=new WeakMap,h={},d={},u={},f=new WeakMap,g=[],_=null,p=!1,m=null,M=null,S=null,y=null,w=null,E=null,C=null,x=new Ht(0,0,0),T=0,P=!1,I=null,U=null,G=null,X=null,F=null,W=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),k=!1,K=0,Q=i.getParameter(i.VERSION);Q.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(Q)[1]),k=K>=1):Q.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),k=K>=2);let rt=null,ot={},ct=i.getParameter(i.SCISSOR_BOX),Gt=i.getParameter(i.VIEWPORT),le=new be().fromArray(ct),te=new be().fromArray(Gt);function Z(D,ut,$,pt){let Mt=new Uint8Array(4),et=i.createTexture();i.bindTexture(D,et),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ct=0;Ct<$;Ct++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(ut,0,i.RGBA,1,1,pt,0,i.RGBA,i.UNSIGNED_BYTE,Mt):i.texImage2D(ut+Ct,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Mt);return et}let lt={};lt[i.TEXTURE_2D]=Z(i.TEXTURE_2D,i.TEXTURE_2D,1),lt[i.TEXTURE_CUBE_MAP]=Z(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),lt[i.TEXTURE_2D_ARRAY]=Z(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),lt[i.TEXTURE_3D]=Z(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),tt(i.DEPTH_TEST),o.setFunc(Vi),_t(!1),mt(fc),tt(i.CULL_FACE),nt(Xn);function tt(D){h[D]!==!0&&(i.enable(D),h[D]=!0)}function St(D){h[D]!==!1&&(i.disable(D),h[D]=!1)}function wt(D,ut){return u[D]!==ut?(i.bindFramebuffer(D,ut),u[D]=ut,D===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ut),D===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ut),!0):!1}function bt(D,ut){let $=g,pt=!1;if(D){$=f.get(ut),$===void 0&&($=[],f.set(ut,$));let Mt=D.textures;if($.length!==Mt.length||$[0]!==i.COLOR_ATTACHMENT0){for(let et=0,Ct=Mt.length;et<Ct;et++)$[et]=i.COLOR_ATTACHMENT0+et;$.length=Mt.length,pt=!0}}else $[0]!==i.BACK&&($[0]=i.BACK,pt=!0);pt&&i.drawBuffers($)}function Qt(D){return _!==D?(i.useProgram(D),_=D,!0):!1}let Ut={[_i]:i.FUNC_ADD,[au]:i.FUNC_SUBTRACT,[lu]:i.FUNC_REVERSE_SUBTRACT};Ut[cu]=i.MIN,Ut[hu]=i.MAX;let j={[uu]:i.ZERO,[du]:i.ONE,[fu]:i.SRC_COLOR,[wo]:i.SRC_ALPHA,[vu]:i.SRC_ALPHA_SATURATE,[xu]:i.DST_COLOR,[mu]:i.DST_ALPHA,[pu]:i.ONE_MINUS_SRC_COLOR,[Ao]:i.ONE_MINUS_SRC_ALPHA,[_u]:i.ONE_MINUS_DST_COLOR,[gu]:i.ONE_MINUS_DST_ALPHA,[yu]:i.CONSTANT_COLOR,[Mu]:i.ONE_MINUS_CONSTANT_COLOR,[Su]:i.CONSTANT_ALPHA,[bu]:i.ONE_MINUS_CONSTANT_ALPHA};function nt(D,ut,$,pt,Mt,et,Ct,At,Te,_e){if(D===Xn){p===!0&&(St(i.BLEND),p=!1);return}if(p===!1&&(tt(i.BLEND),p=!0),D!==ou){if(D!==m||_e!==P){if((M!==_i||w!==_i)&&(i.blendEquation(i.FUNC_ADD),M=_i,w=_i),_e)switch(D){case Cn:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oi:i.blendFunc(i.ONE,i.ONE);break;case pc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case mc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ft("WebGLState: Invalid blending: ",D);break}else switch(D){case Cn:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case pc:Ft("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case mc:Ft("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ft("WebGLState: Invalid blending: ",D);break}S=null,y=null,E=null,C=null,x.set(0,0,0),T=0,m=D,P=_e}return}Mt=Mt||ut,et=et||$,Ct=Ct||pt,(ut!==M||Mt!==w)&&(i.blendEquationSeparate(Ut[ut],Ut[Mt]),M=ut,w=Mt),($!==S||pt!==y||et!==E||Ct!==C)&&(i.blendFuncSeparate(j[$],j[pt],j[et],j[Ct]),S=$,y=pt,E=et,C=Ct),(At.equals(x)===!1||Te!==T)&&(i.blendColor(At.r,At.g,At.b,Te),x.copy(At),T=Te),m=D,P=!1}function st(D,ut){D.side===$e?St(i.CULL_FACE):tt(i.CULL_FACE);let $=D.side===Ue;ut&&($=!$),_t($),D.blending===Cn&&D.transparent===!1?nt(Xn):nt(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),o.setFunc(D.depthFunc),o.setTest(D.depthTest),o.setMask(D.depthWrite),r.setMask(D.colorWrite);let pt=D.stencilWrite;a.setTest(pt),pt&&(a.setMask(D.stencilWriteMask),a.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),a.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),Pt(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?tt(i.SAMPLE_ALPHA_TO_COVERAGE):St(i.SAMPLE_ALPHA_TO_COVERAGE)}function _t(D){I!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),I=D)}function mt(D){D!==iu?(tt(i.CULL_FACE),D!==U&&(D===fc?i.cullFace(i.BACK):D===su?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):St(i.CULL_FACE),U=D}function Ot(D){D!==G&&(k&&i.lineWidth(D),G=D)}function Pt(D,ut,$){D?(tt(i.POLYGON_OFFSET_FILL),(X!==ut||F!==$)&&(X=ut,F=$,o.getReversed()&&(ut=-ut),i.polygonOffset(ut,$))):St(i.POLYGON_OFFSET_FILL)}function Wt(D){D?tt(i.SCISSOR_TEST):St(i.SCISSOR_TEST)}function Zt(D){D===void 0&&(D=i.TEXTURE0+W-1),rt!==D&&(i.activeTexture(D),rt=D)}function L(D,ut,$){$===void 0&&(rt===null?$=i.TEXTURE0+W-1:$=rt);let pt=ot[$];pt===void 0&&(pt={type:void 0,texture:void 0},ot[$]=pt),(pt.type!==D||pt.texture!==ut)&&(rt!==$&&(i.activeTexture($),rt=$),i.bindTexture(D,ut||lt[D]),pt.type=D,pt.texture=ut)}function fe(){let D=ot[rt];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function se(){try{i.compressedTexImage2D(...arguments)}catch(D){Ft("WebGLState:",D)}}function A(){try{i.compressedTexImage3D(...arguments)}catch(D){Ft("WebGLState:",D)}}function v(){try{i.texSubImage2D(...arguments)}catch(D){Ft("WebGLState:",D)}}function O(){try{i.texSubImage3D(...arguments)}catch(D){Ft("WebGLState:",D)}}function V(){try{i.compressedTexSubImage2D(...arguments)}catch(D){Ft("WebGLState:",D)}}function q(){try{i.compressedTexSubImage3D(...arguments)}catch(D){Ft("WebGLState:",D)}}function at(){try{i.texStorage2D(...arguments)}catch(D){Ft("WebGLState:",D)}}function ht(){try{i.texStorage3D(...arguments)}catch(D){Ft("WebGLState:",D)}}function Y(){try{i.texImage2D(...arguments)}catch(D){Ft("WebGLState:",D)}}function J(){try{i.texImage3D(...arguments)}catch(D){Ft("WebGLState:",D)}}function dt(D){return d[D]!==void 0?d[D]:i.getParameter(D)}function It(D,ut){d[D]!==ut&&(i.pixelStorei(D,ut),d[D]=ut)}function gt(D){le.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),le.copy(D))}function ft(D){te.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),te.copy(D))}function Nt(D,ut){let $=c.get(ut);$===void 0&&($=new WeakMap,c.set(ut,$));let pt=$.get(D);pt===void 0&&(pt=i.getUniformBlockIndex(ut,D.name),$.set(D,pt))}function Vt(D,ut){let pt=c.get(ut).get(D);l.get(ut)!==pt&&(i.uniformBlockBinding(ut,pt,D.__bindingPointIndex),l.set(ut,pt))}function $t(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},d={},rt=null,ot={},u={},f=new WeakMap,g=[],_=null,p=!1,m=null,M=null,S=null,y=null,w=null,E=null,C=null,x=new Ht(0,0,0),T=0,P=!1,I=null,U=null,G=null,X=null,F=null,le.set(0,0,i.canvas.width,i.canvas.height),te.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:tt,disable:St,bindFramebuffer:wt,drawBuffers:bt,useProgram:Qt,setBlending:nt,setMaterial:st,setFlipSided:_t,setCullFace:mt,setLineWidth:Ot,setPolygonOffset:Pt,setScissorTest:Wt,activeTexture:Zt,bindTexture:L,unbindTexture:fe,compressedTexImage2D:se,compressedTexImage3D:A,texImage2D:Y,texImage3D:J,pixelStorei:It,getParameter:dt,updateUBOMapping:Nt,uniformBlockBinding:Vt,texStorage2D:at,texStorage3D:ht,texSubImage2D:v,texSubImage3D:O,compressedTexSubImage2D:V,compressedTexSubImage3D:q,scissor:gt,viewport:ft,reset:$t}}function i_(i,t,e,n,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new it,h=new WeakMap,d=new Set,u,f=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(A,v){return g?new OffscreenCanvas(A,v):or("canvas")}function p(A,v,O){let V=1,q=se(A);if((q.width>O||q.height>O)&&(V=O/Math.max(q.width,q.height)),V<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){let at=Math.floor(V*q.width),ht=Math.floor(V*q.height);u===void 0&&(u=_(at,ht));let Y=v?_(at,ht):u;return Y.width=at,Y.height=ht,Y.getContext("2d").drawImage(A,0,0,at,ht),Bt("WebGLRenderer: Texture has been resized from ("+q.width+"x"+q.height+") to ("+at+"x"+ht+")."),Y}else return"data"in A&&Bt("WebGLRenderer: Image in DataTexture is too big ("+q.width+"x"+q.height+")."),A;return A}function m(A){return A.generateMipmaps}function M(A){i.generateMipmap(A)}function S(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(A,v,O,V,q,at=!1){if(A!==null){if(i[A]!==void 0)return i[A];Bt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let ht;V&&(ht=t.get("EXT_texture_norm16"),ht||Bt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Y=v;if(v===i.RED&&(O===i.FLOAT&&(Y=i.R32F),O===i.HALF_FLOAT&&(Y=i.R16F),O===i.UNSIGNED_BYTE&&(Y=i.R8),O===i.UNSIGNED_SHORT&&ht&&(Y=ht.R16_EXT),O===i.SHORT&&ht&&(Y=ht.R16_SNORM_EXT)),v===i.RED_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.R8UI),O===i.UNSIGNED_SHORT&&(Y=i.R16UI),O===i.UNSIGNED_INT&&(Y=i.R32UI),O===i.BYTE&&(Y=i.R8I),O===i.SHORT&&(Y=i.R16I),O===i.INT&&(Y=i.R32I)),v===i.RG&&(O===i.FLOAT&&(Y=i.RG32F),O===i.HALF_FLOAT&&(Y=i.RG16F),O===i.UNSIGNED_BYTE&&(Y=i.RG8),O===i.UNSIGNED_SHORT&&ht&&(Y=ht.RG16_EXT),O===i.SHORT&&ht&&(Y=ht.RG16_SNORM_EXT)),v===i.RG_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RG8UI),O===i.UNSIGNED_SHORT&&(Y=i.RG16UI),O===i.UNSIGNED_INT&&(Y=i.RG32UI),O===i.BYTE&&(Y=i.RG8I),O===i.SHORT&&(Y=i.RG16I),O===i.INT&&(Y=i.RG32I)),v===i.RGB_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RGB8UI),O===i.UNSIGNED_SHORT&&(Y=i.RGB16UI),O===i.UNSIGNED_INT&&(Y=i.RGB32UI),O===i.BYTE&&(Y=i.RGB8I),O===i.SHORT&&(Y=i.RGB16I),O===i.INT&&(Y=i.RGB32I)),v===i.RGBA_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RGBA8UI),O===i.UNSIGNED_SHORT&&(Y=i.RGBA16UI),O===i.UNSIGNED_INT&&(Y=i.RGBA32UI),O===i.BYTE&&(Y=i.RGBA8I),O===i.SHORT&&(Y=i.RGBA16I),O===i.INT&&(Y=i.RGBA32I)),v===i.RGB&&(O===i.UNSIGNED_SHORT&&ht&&(Y=ht.RGB16_EXT),O===i.SHORT&&ht&&(Y=ht.RGB16_SNORM_EXT),O===i.UNSIGNED_INT_5_9_9_9_REV&&(Y=i.RGB9_E5),O===i.UNSIGNED_INT_10F_11F_11F_REV&&(Y=i.R11F_G11F_B10F)),v===i.RGBA){let J=at?rr:oe.getTransfer(q);O===i.FLOAT&&(Y=i.RGBA32F),O===i.HALF_FLOAT&&(Y=i.RGBA16F),O===i.UNSIGNED_BYTE&&(Y=J===ue?i.SRGB8_ALPHA8:i.RGBA8),O===i.UNSIGNED_SHORT&&ht&&(Y=ht.RGBA16_EXT),O===i.SHORT&&ht&&(Y=ht.RGBA16_SNORM_EXT),O===i.UNSIGNED_SHORT_4_4_4_4&&(Y=i.RGBA4),O===i.UNSIGNED_SHORT_5_5_5_1&&(Y=i.RGB5_A1)}return(Y===i.R16F||Y===i.R32F||Y===i.RG16F||Y===i.RG32F||Y===i.RGBA16F||Y===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function w(A,v){let O;return A?v===null||v===Ln||v===Us?O=i.DEPTH24_STENCIL8:v===Sn?O=i.DEPTH32F_STENCIL8:v===Ds&&(O=i.DEPTH24_STENCIL8,Bt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Ln||v===Us?O=i.DEPTH_COMPONENT24:v===Sn?O=i.DEPTH_COMPONENT32F:v===Ds&&(O=i.DEPTH_COMPONENT16),O}function E(A,v){return m(A)===!0||A.isFramebufferTexture&&A.minFilter!==ze&&A.minFilter!==Ie?Math.log2(Math.max(v.width,v.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?v.mipmaps.length:1}function C(A){let v=A.target;v.removeEventListener("dispose",C),T(v),v.isVideoTexture&&h.delete(v),v.isHTMLTexture&&d.delete(v)}function x(A){let v=A.target;v.removeEventListener("dispose",x),I(v)}function T(A){let v=n.get(A);if(v.__webglInit===void 0)return;let O=A.source,V=f.get(O);if(V){let q=V[v.__cacheKey];q.usedTimes--,q.usedTimes===0&&P(A),Object.keys(V).length===0&&f.delete(O)}n.remove(A)}function P(A){let v=n.get(A);i.deleteTexture(v.__webglTexture);let O=A.source,V=f.get(O);delete V[v.__cacheKey],o.memory.textures--}function I(A){let v=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let V=0;V<6;V++){if(Array.isArray(v.__webglFramebuffer[V]))for(let q=0;q<v.__webglFramebuffer[V].length;q++)i.deleteFramebuffer(v.__webglFramebuffer[V][q]);else i.deleteFramebuffer(v.__webglFramebuffer[V]);v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer[V])}else{if(Array.isArray(v.__webglFramebuffer))for(let V=0;V<v.__webglFramebuffer.length;V++)i.deleteFramebuffer(v.__webglFramebuffer[V]);else i.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&i.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let V=0;V<v.__webglColorRenderbuffer.length;V++)v.__webglColorRenderbuffer[V]&&i.deleteRenderbuffer(v.__webglColorRenderbuffer[V]);v.__webglDepthRenderbuffer&&i.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let O=A.textures;for(let V=0,q=O.length;V<q;V++){let at=n.get(O[V]);at.__webglTexture&&(i.deleteTexture(at.__webglTexture),o.memory.textures--),n.remove(O[V])}n.remove(A)}let U=0;function G(){U=0}function X(){return U}function F(A){U=A}function W(){let A=U;return A>=s.maxTextures&&Bt("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),U+=1,A}function k(A){let v=[];return v.push(A.wrapS),v.push(A.wrapT),v.push(A.wrapR||0),v.push(A.magFilter),v.push(A.minFilter),v.push(A.anisotropy),v.push(A.internalFormat),v.push(A.format),v.push(A.type),v.push(A.generateMipmaps),v.push(A.premultiplyAlpha),v.push(A.flipY),v.push(A.unpackAlignment),v.push(A.colorSpace),v.join()}function K(A,v){let O=n.get(A);if(A.isVideoTexture&&L(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&O.__version!==A.version){let V=A.image;if(V===null)Bt("WebGLRenderer: Texture marked for update but no image data found.");else if(V.complete===!1)Bt("WebGLRenderer: Texture marked for update but image is incomplete");else{St(O,A,v);return}}else A.isExternalTexture&&(O.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,O.__webglTexture,i.TEXTURE0+v)}function Q(A,v){let O=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&O.__version!==A.version){St(O,A,v);return}else A.isExternalTexture&&(O.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,O.__webglTexture,i.TEXTURE0+v)}function rt(A,v){let O=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&O.__version!==A.version){St(O,A,v);return}e.bindTexture(i.TEXTURE_3D,O.__webglTexture,i.TEXTURE0+v)}function ot(A,v){let O=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&O.__version!==A.version){wt(O,A,v);return}e.bindTexture(i.TEXTURE_CUBE_MAP,O.__webglTexture,i.TEXTURE0+v)}let ct={[vi]:i.REPEAT,[Mn]:i.CLAMP_TO_EDGE,[No]:i.MIRRORED_REPEAT},Gt={[ze]:i.NEAREST,[wu]:i.NEAREST_MIPMAP_NEAREST,[Fr]:i.NEAREST_MIPMAP_LINEAR,[Ie]:i.LINEAR,[ma]:i.LINEAR_MIPMAP_NEAREST,[Ti]:i.LINEAR_MIPMAP_LINEAR},le={[Cu]:i.NEVER,[Uu]:i.ALWAYS,[Pu]:i.LESS,[tl]:i.LEQUAL,[Iu]:i.EQUAL,[el]:i.GEQUAL,[Lu]:i.GREATER,[Du]:i.NOTEQUAL};function te(A,v){if(v.type===Sn&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===Ie||v.magFilter===ma||v.magFilter===Fr||v.magFilter===Ti||v.minFilter===Ie||v.minFilter===ma||v.minFilter===Fr||v.minFilter===Ti)&&Bt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,ct[v.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,ct[v.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,ct[v.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,Gt[v.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,Gt[v.minFilter]),v.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,le[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===ze||v.minFilter!==Fr&&v.minFilter!==Ti||v.type===Sn&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){let O=t.get("EXT_texture_filter_anisotropic");i.texParameterf(A,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,s.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Z(A,v){let O=!1;A.__webglInit===void 0&&(A.__webglInit=!0,v.addEventListener("dispose",C));let V=v.source,q=f.get(V);q===void 0&&(q={},f.set(V,q));let at=k(v);if(at!==A.__cacheKey){q[at]===void 0&&(q[at]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,O=!0),q[at].usedTimes++;let ht=q[A.__cacheKey];ht!==void 0&&(q[A.__cacheKey].usedTimes--,ht.usedTimes===0&&P(v)),A.__cacheKey=at,A.__webglTexture=q[at].texture}return O}function lt(A,v,O){return Math.floor(Math.floor(A/O)/v)}function tt(A,v,O,V){let at=A.updateRanges;if(at.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,v.width,v.height,O,V,v.data);else{at.sort((It,gt)=>It.start-gt.start);let ht=0;for(let It=1;It<at.length;It++){let gt=at[ht],ft=at[It],Nt=gt.start+gt.count,Vt=lt(ft.start,v.width,4),$t=lt(gt.start,v.width,4);ft.start<=Nt+1&&Vt===$t&&lt(ft.start+ft.count-1,v.width,4)===Vt?gt.count=Math.max(gt.count,ft.start+ft.count-gt.start):(++ht,at[ht]=ft)}at.length=ht+1;let Y=e.getParameter(i.UNPACK_ROW_LENGTH),J=e.getParameter(i.UNPACK_SKIP_PIXELS),dt=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,v.width);for(let It=0,gt=at.length;It<gt;It++){let ft=at[It],Nt=Math.floor(ft.start/4),Vt=Math.ceil(ft.count/4),$t=Nt%v.width,D=Math.floor(Nt/v.width),ut=Vt,$=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,$t),e.pixelStorei(i.UNPACK_SKIP_ROWS,D),e.texSubImage2D(i.TEXTURE_2D,0,$t,D,ut,$,O,V,v.data)}A.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,Y),e.pixelStorei(i.UNPACK_SKIP_PIXELS,J),e.pixelStorei(i.UNPACK_SKIP_ROWS,dt)}}function St(A,v,O){let V=i.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(V=i.TEXTURE_2D_ARRAY),v.isData3DTexture&&(V=i.TEXTURE_3D);let q=Z(A,v),at=v.source;e.bindTexture(V,A.__webglTexture,i.TEXTURE0+O);let ht=n.get(at);if(at.version!==ht.__version||q===!0){if(e.activeTexture(i.TEXTURE0+O),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){let $=oe.getPrimaries(oe.workingColorSpace),pt=v.colorSpace===ai?null:oe.getPrimaries(v.colorSpace),Mt=v.colorSpace===ai||$===pt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Mt)}e.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment);let J=p(v.image,!1,s.maxTextureSize);J=fe(v,J);let dt=r.convert(v.format,v.colorSpace),It=r.convert(v.type),gt=y(v.internalFormat,dt,It,v.normalized,v.colorSpace,v.isVideoTexture);te(V,v);let ft,Nt=v.mipmaps,Vt=v.isVideoTexture!==!0,$t=ht.__version===void 0||q===!0,D=at.dataReady,ut=E(v,J);if(v.isDepthTexture)gt=w(v.format===wi,v.type),$t&&(Vt?e.texStorage2D(i.TEXTURE_2D,1,gt,J.width,J.height):e.texImage2D(i.TEXTURE_2D,0,gt,J.width,J.height,0,dt,It,null));else if(v.isDataTexture)if(Nt.length>0){Vt&&$t&&e.texStorage2D(i.TEXTURE_2D,ut,gt,Nt[0].width,Nt[0].height);for(let $=0,pt=Nt.length;$<pt;$++)ft=Nt[$],Vt?D&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,ft.width,ft.height,dt,It,ft.data):e.texImage2D(i.TEXTURE_2D,$,gt,ft.width,ft.height,0,dt,It,ft.data);v.generateMipmaps=!1}else Vt?($t&&e.texStorage2D(i.TEXTURE_2D,ut,gt,J.width,J.height),D&&tt(v,J,dt,It)):e.texImage2D(i.TEXTURE_2D,0,gt,J.width,J.height,0,dt,It,J.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Vt&&$t&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ut,gt,Nt[0].width,Nt[0].height,J.depth);for(let $=0,pt=Nt.length;$<pt;$++)if(ft=Nt[$],v.format!==on)if(dt!==null)if(Vt){if(D)if(v.layerUpdates.size>0){let Mt=Fc(ft.width,ft.height,v.format,v.type);for(let et of v.layerUpdates){let Ct=ft.data.subarray(et*Mt/ft.data.BYTES_PER_ELEMENT,(et+1)*Mt/ft.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,et,ft.width,ft.height,1,dt,Ct)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,ft.width,ft.height,J.depth,dt,ft.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,$,gt,ft.width,ft.height,J.depth,0,ft.data,0,0);else Bt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Vt?D&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,ft.width,ft.height,J.depth,dt,It,ft.data):e.texImage3D(i.TEXTURE_2D_ARRAY,$,gt,ft.width,ft.height,J.depth,0,dt,It,ft.data)}else{Vt&&$t&&e.texStorage2D(i.TEXTURE_2D,ut,gt,Nt[0].width,Nt[0].height);for(let $=0,pt=Nt.length;$<pt;$++)ft=Nt[$],v.format!==on?dt!==null?Vt?D&&e.compressedTexSubImage2D(i.TEXTURE_2D,$,0,0,ft.width,ft.height,dt,ft.data):e.compressedTexImage2D(i.TEXTURE_2D,$,gt,ft.width,ft.height,0,ft.data):Bt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Vt?D&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,ft.width,ft.height,dt,It,ft.data):e.texImage2D(i.TEXTURE_2D,$,gt,ft.width,ft.height,0,dt,It,ft.data)}else if(v.isDataArrayTexture)if(Vt){if($t&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ut,gt,J.width,J.height,J.depth),D)if(v.layerUpdates.size>0){let $=Fc(J.width,J.height,v.format,v.type);for(let pt of v.layerUpdates){let Mt=J.data.subarray(pt*$/J.data.BYTES_PER_ELEMENT,(pt+1)*$/J.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,pt,J.width,J.height,1,dt,It,Mt)}v.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,dt,It,J.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,gt,J.width,J.height,J.depth,0,dt,It,J.data);else if(v.isData3DTexture)Vt?($t&&e.texStorage3D(i.TEXTURE_3D,ut,gt,J.width,J.height,J.depth),D&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,dt,It,J.data)):e.texImage3D(i.TEXTURE_3D,0,gt,J.width,J.height,J.depth,0,dt,It,J.data);else if(v.isFramebufferTexture){if($t)if(Vt)e.texStorage2D(i.TEXTURE_2D,ut,gt,J.width,J.height);else{let $=J.width,pt=J.height;for(let Mt=0;Mt<ut;Mt++)e.texImage2D(i.TEXTURE_2D,Mt,gt,$,pt,0,dt,It,null),$>>=1,pt>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in i){let $=i.canvas;if($.hasAttribute("layoutsubtree")||$.setAttribute("layoutsubtree","true"),J.parentNode!==$){$.appendChild(J),d.add(v),$.onpaint=pt=>{let Mt=pt.changedElements;for(let et of d)Mt.includes(et.image)&&(et.needsUpdate=!0)},$.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,J);else{let Mt=i.RGBA,et=i.RGBA,Ct=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,Mt,et,Ct,J)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Nt.length>0){if(Vt&&$t){let $=se(Nt[0]);e.texStorage2D(i.TEXTURE_2D,ut,gt,$.width,$.height)}for(let $=0,pt=Nt.length;$<pt;$++)ft=Nt[$],Vt?D&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,dt,It,ft):e.texImage2D(i.TEXTURE_2D,$,gt,dt,It,ft);v.generateMipmaps=!1}else if(Vt){if($t){let $=se(J);e.texStorage2D(i.TEXTURE_2D,ut,gt,$.width,$.height)}D&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,dt,It,J)}else e.texImage2D(i.TEXTURE_2D,0,gt,dt,It,J);m(v)&&M(V),ht.__version=at.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function wt(A,v,O){if(v.image.length!==6)return;let V=Z(A,v),q=v.source;e.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+O);let at=n.get(q);if(q.version!==at.__version||V===!0){e.activeTexture(i.TEXTURE0+O);let ht=oe.getPrimaries(oe.workingColorSpace),Y=v.colorSpace===ai?null:oe.getPrimaries(v.colorSpace),J=v.colorSpace===ai||ht===Y?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);let dt=v.isCompressedTexture||v.image[0].isCompressedTexture,It=v.image[0]&&v.image[0].isDataTexture,gt=[];for(let et=0;et<6;et++)!dt&&!It?gt[et]=p(v.image[et],!0,s.maxCubemapSize):gt[et]=It?v.image[et].image:v.image[et],gt[et]=fe(v,gt[et]);let ft=gt[0],Nt=r.convert(v.format,v.colorSpace),Vt=r.convert(v.type),$t=y(v.internalFormat,Nt,Vt,v.normalized,v.colorSpace),D=v.isVideoTexture!==!0,ut=at.__version===void 0||V===!0,$=q.dataReady,pt=E(v,ft);te(i.TEXTURE_CUBE_MAP,v);let Mt;if(dt){D&&ut&&e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,$t,ft.width,ft.height);for(let et=0;et<6;et++){Mt=gt[et].mipmaps;for(let Ct=0;Ct<Mt.length;Ct++){let At=Mt[Ct];v.format!==on?Nt!==null?D?$&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct,0,0,At.width,At.height,Nt,At.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct,$t,At.width,At.height,0,At.data):Bt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct,0,0,At.width,At.height,Nt,Vt,At.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct,$t,At.width,At.height,0,Nt,Vt,At.data)}}}else{if(Mt=v.mipmaps,D&&ut){Mt.length>0&&pt++;let et=se(gt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,$t,et.width,et.height)}for(let et=0;et<6;et++)if(It){D?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,0,0,gt[et].width,gt[et].height,Nt,Vt,gt[et].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,$t,gt[et].width,gt[et].height,0,Nt,Vt,gt[et].data);for(let Ct=0;Ct<Mt.length;Ct++){let Te=Mt[Ct].image[et].image;D?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct+1,0,0,Te.width,Te.height,Nt,Vt,Te.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct+1,$t,Te.width,Te.height,0,Nt,Vt,Te.data)}}else{D?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,0,0,Nt,Vt,gt[et]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,0,$t,Nt,Vt,gt[et]);for(let Ct=0;Ct<Mt.length;Ct++){let At=Mt[Ct];D?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct+1,0,0,Nt,Vt,At.image[et]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+et,Ct+1,$t,Nt,Vt,At.image[et])}}}m(v)&&M(i.TEXTURE_CUBE_MAP),at.__version=q.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function bt(A,v,O,V,q,at){let ht=r.convert(O.format,O.colorSpace),Y=r.convert(O.type),J=y(O.internalFormat,ht,Y,O.normalized,O.colorSpace),dt=n.get(v),It=n.get(O);if(It.__renderTarget=v,!dt.__hasExternalTextures){let gt=Math.max(1,v.width>>at),ft=Math.max(1,v.height>>at);q===i.TEXTURE_3D||q===i.TEXTURE_2D_ARRAY?e.texImage3D(q,at,J,gt,ft,v.depth,0,ht,Y,null):e.texImage2D(q,at,J,gt,ft,0,ht,Y,null)}e.bindFramebuffer(i.FRAMEBUFFER,A),Zt(v)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,V,q,It.__webglTexture,0,Wt(v)):(q===i.TEXTURE_2D||q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,V,q,It.__webglTexture,at),e.bindFramebuffer(i.FRAMEBUFFER,null)}function Qt(A,v,O){if(i.bindRenderbuffer(i.RENDERBUFFER,A),v.depthBuffer){let V=v.depthTexture,q=V&&V.isDepthTexture?V.type:null,at=w(v.stencilBuffer,q),ht=v.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Zt(v)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Wt(v),at,v.width,v.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,Wt(v),at,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,at,v.width,v.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ht,i.RENDERBUFFER,A)}else{let V=v.textures;for(let q=0;q<V.length;q++){let at=V[q],ht=r.convert(at.format,at.colorSpace),Y=r.convert(at.type),J=y(at.internalFormat,ht,Y,at.normalized,at.colorSpace);Zt(v)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Wt(v),J,v.width,v.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,Wt(v),J,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,J,v.width,v.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Ut(A,v,O){let V=v.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,A),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let q=n.get(v.depthTexture);if(q.__renderTarget=v,(!q.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),V){if(q.__webglInit===void 0&&(q.__webglInit=!0,v.depthTexture.addEventListener("dispose",C)),q.__webglTexture===void 0){q.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),te(i.TEXTURE_CUBE_MAP,v.depthTexture);let dt=r.convert(v.depthTexture.format),It=r.convert(v.depthTexture.type),gt;v.depthTexture.format===zn?gt=i.DEPTH_COMPONENT24:v.depthTexture.format===wi&&(gt=i.DEPTH24_STENCIL8);for(let ft=0;ft<6;ft++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ft,0,gt,v.width,v.height,0,dt,It,null)}}else K(v.depthTexture,0);let at=q.__webglTexture,ht=Wt(v),Y=V?i.TEXTURE_CUBE_MAP_POSITIVE_X+O:i.TEXTURE_2D,J=v.depthTexture.format===wi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(v.depthTexture.format===zn)Zt(v)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,Y,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,J,Y,at,0);else if(v.depthTexture.format===wi)Zt(v)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,Y,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,J,Y,at,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function j(A){let v=n.get(A),O=A.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==A.depthTexture){let V=A.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),V){let q=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,V.removeEventListener("dispose",q)};V.addEventListener("dispose",q),v.__depthDisposeCallback=q}v.__boundDepthTexture=V}if(A.depthTexture&&!v.__autoAllocateDepthBuffer)if(O)for(let V=0;V<6;V++)Ut(v.__webglFramebuffer[V],A,V);else{let V=A.texture.mipmaps;V&&V.length>0?Ut(v.__webglFramebuffer[0],A,0):Ut(v.__webglFramebuffer,A,0)}else if(O){v.__webglDepthbuffer=[];for(let V=0;V<6;V++)if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[V]),v.__webglDepthbuffer[V]===void 0)v.__webglDepthbuffer[V]=i.createRenderbuffer(),Qt(v.__webglDepthbuffer[V],A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=v.__webglDepthbuffer[V];i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,at)}}else{let V=A.texture.mipmaps;if(V&&V.length>0?e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=i.createRenderbuffer(),Qt(v.__webglDepthbuffer,A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=v.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,at)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function nt(A,v,O){let V=n.get(A);v!==void 0&&bt(V.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),O!==void 0&&j(A)}function st(A){let v=A.texture,O=n.get(A),V=n.get(v);A.addEventListener("dispose",x);let q=A.textures,at=A.isWebGLCubeRenderTarget===!0,ht=q.length>1;if(ht||(V.__webglTexture===void 0&&(V.__webglTexture=i.createTexture()),V.__version=v.version,o.memory.textures++),at){O.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer[Y]=[];for(let J=0;J<v.mipmaps.length;J++)O.__webglFramebuffer[Y][J]=i.createFramebuffer()}else O.__webglFramebuffer[Y]=i.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer=[];for(let Y=0;Y<v.mipmaps.length;Y++)O.__webglFramebuffer[Y]=i.createFramebuffer()}else O.__webglFramebuffer=i.createFramebuffer();if(ht)for(let Y=0,J=q.length;Y<J;Y++){let dt=n.get(q[Y]);dt.__webglTexture===void 0&&(dt.__webglTexture=i.createTexture(),o.memory.textures++)}if(A.samples>0&&Zt(A)===!1){O.__webglMultisampledFramebuffer=i.createFramebuffer(),O.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let Y=0;Y<q.length;Y++){let J=q[Y];O.__webglColorRenderbuffer[Y]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,O.__webglColorRenderbuffer[Y]);let dt=r.convert(J.format,J.colorSpace),It=r.convert(J.type),gt=y(J.internalFormat,dt,It,J.normalized,J.colorSpace,A.isXRRenderTarget===!0),ft=Wt(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,ft,gt,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Y,i.RENDERBUFFER,O.__webglColorRenderbuffer[Y])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(O.__webglDepthRenderbuffer=i.createRenderbuffer(),Qt(O.__webglDepthRenderbuffer,A,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(at){e.bindTexture(i.TEXTURE_CUBE_MAP,V.__webglTexture),te(i.TEXTURE_CUBE_MAP,v);for(let Y=0;Y<6;Y++)if(v.mipmaps&&v.mipmaps.length>0)for(let J=0;J<v.mipmaps.length;J++)bt(O.__webglFramebuffer[Y][J],A,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,J);else bt(O.__webglFramebuffer[Y],A,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);m(v)&&M(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(ht){for(let Y=0,J=q.length;Y<J;Y++){let dt=q[Y],It=n.get(dt),gt=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(gt=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(gt,It.__webglTexture),te(gt,dt),bt(O.__webglFramebuffer,A,dt,i.COLOR_ATTACHMENT0+Y,gt,0),m(dt)&&M(gt)}e.unbindTexture()}else{let Y=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(Y=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(Y,V.__webglTexture),te(Y,v),v.mipmaps&&v.mipmaps.length>0)for(let J=0;J<v.mipmaps.length;J++)bt(O.__webglFramebuffer[J],A,v,i.COLOR_ATTACHMENT0,Y,J);else bt(O.__webglFramebuffer,A,v,i.COLOR_ATTACHMENT0,Y,0);m(v)&&M(Y),e.unbindTexture()}A.depthBuffer&&j(A)}function _t(A){let v=A.textures;for(let O=0,V=v.length;O<V;O++){let q=v[O];if(m(q)){let at=S(A),ht=n.get(q).__webglTexture;e.bindTexture(at,ht),M(at),e.unbindTexture()}}}let mt=[],Ot=[];function Pt(A){if(A.samples>0){if(Zt(A)===!1){let v=A.textures,O=A.width,V=A.height,q=i.COLOR_BUFFER_BIT,at=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ht=n.get(A),Y=v.length>1;if(Y)for(let dt=0;dt<v.length;dt++)e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,ht.__webglMultisampledFramebuffer);let J=A.texture.mipmaps;J&&J.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer);for(let dt=0;dt<v.length;dt++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(q|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(q|=i.STENCIL_BUFFER_BIT)),Y){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ht.__webglColorRenderbuffer[dt]);let It=n.get(v[dt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,It,0)}i.blitFramebuffer(0,0,O,V,0,0,O,V,q,i.NEAREST),l===!0&&(mt.length=0,Ot.length=0,mt.push(i.COLOR_ATTACHMENT0+dt),A.depthBuffer&&A.resolveDepthBuffer===!1&&(mt.push(at),Ot.push(at),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Ot)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,mt))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Y)for(let dt=0;dt<v.length;dt++){e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.RENDERBUFFER,ht.__webglColorRenderbuffer[dt]);let It=n.get(v[dt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+dt,i.TEXTURE_2D,It,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){let v=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[v])}}}function Wt(A){return Math.min(s.maxSamples,A.samples)}function Zt(A){let v=n.get(A);return A.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function L(A){let v=o.render.frame;h.get(A)!==v&&(h.set(A,v),A.update())}function fe(A,v){let O=A.colorSpace,V=A.format,q=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||O!==sr&&O!==ai&&(oe.getTransfer(O)===ue?(V!==on||q!==rn)&&Bt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ft("WebGLTextures: Unsupported texture color space:",O)),v}function se(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=W,this.resetTextureUnits=G,this.getTextureUnits=X,this.setTextureUnits=F,this.setTexture2D=K,this.setTexture2DArray=Q,this.setTexture3D=rt,this.setTextureCube=ot,this.rebindTextures=nt,this.setupRenderTarget=st,this.updateRenderTargetMipmap=_t,this.updateMultisampleRenderTarget=Pt,this.setupDepthRenderbuffer=j,this.setupFrameBufferTexture=bt,this.useMultisampledRTT=Zt,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function s_(i,t){function e(n,s=ai){let r,o=oe.getTransfer(s);if(n===rn)return i.UNSIGNED_BYTE;if(n===xa)return i.UNSIGNED_SHORT_4_4_4_4;if(n===_a)return i.UNSIGNED_SHORT_5_5_5_1;if(n===wc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Ac)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Ec)return i.BYTE;if(n===Tc)return i.SHORT;if(n===Ds)return i.UNSIGNED_SHORT;if(n===ga)return i.INT;if(n===Ln)return i.UNSIGNED_INT;if(n===Sn)return i.FLOAT;if(n===qn)return i.HALF_FLOAT;if(n===Rc)return i.ALPHA;if(n===Cc)return i.RGB;if(n===on)return i.RGBA;if(n===zn)return i.DEPTH_COMPONENT;if(n===wi)return i.DEPTH_STENCIL;if(n===va)return i.RED;if(n===ya)return i.RED_INTEGER;if(n===Ai)return i.RG;if(n===Ma)return i.RG_INTEGER;if(n===Sa)return i.RGBA_INTEGER;if(n===Or||n===Br||n===zr||n===Vr)if(o===ue)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Or)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Br)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===zr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Vr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Or)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Br)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===zr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Vr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===ba||n===Ea||n===Ta||n===wa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===ba)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ea)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ta)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===wa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Aa||n===Ra||n===Ca||n===Pa||n===Ia||n===kr||n===La)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Aa||n===Ra)return o===ue?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Ca)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Pa)return r.COMPRESSED_R11_EAC;if(n===Ia)return r.COMPRESSED_SIGNED_R11_EAC;if(n===kr)return r.COMPRESSED_RG11_EAC;if(n===La)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Da||n===Ua||n===Na||n===Fa||n===Oa||n===Ba||n===za||n===Va||n===ka||n===Ha||n===Ga||n===Wa||n===Xa||n===qa)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Da)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ua)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Na)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Fa)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Oa)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ba)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===za)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Va)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ka)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ha)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Ga)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Wa)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Xa)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===qa)return o===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Ya||n===Za||n===$a)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Ya)return o===ue?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Za)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===$a)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Ja||n===Ka||n===Hr||n===Qa)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Ja)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ka)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Hr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Qa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Us?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var r_=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,o_=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,eh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new gr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new ke({vertexShader:r_,fragmentShader:o_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new zt(new Wn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},nh=class extends Vn{constructor(t,e){super();let n=this,s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,g=null,_=typeof XRWebGLBinding<"u",p=new eh,m={},M=e.getContextAttributes(),S=null,y=null,w=[],E=[],C=new it,x=null,T=new Ze;T.viewport=new be;let P=new Ze;P.viewport=new be;let I=[T,P],U=new ua,G=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let lt=w[Z];return lt===void 0&&(lt=new Ss,w[Z]=lt),lt.getTargetRaySpace()},this.getControllerGrip=function(Z){let lt=w[Z];return lt===void 0&&(lt=new Ss,w[Z]=lt),lt.getGripSpace()},this.getHand=function(Z){let lt=w[Z];return lt===void 0&&(lt=new Ss,w[Z]=lt),lt.getHandSpace()};function F(Z){let lt=E.indexOf(Z.inputSource);if(lt===-1)return;let tt=w[lt];tt!==void 0&&(tt.update(Z.inputSource,Z.frame,c||o),tt.dispatchEvent({type:Z.type,data:Z.inputSource}))}function W(){s.removeEventListener("select",F),s.removeEventListener("selectstart",F),s.removeEventListener("selectend",F),s.removeEventListener("squeeze",F),s.removeEventListener("squeezestart",F),s.removeEventListener("squeezeend",F),s.removeEventListener("end",W),s.removeEventListener("inputsourceschange",k);for(let Z=0;Z<w.length;Z++){let lt=E[Z];lt!==null&&(E[Z]=null,w[Z].disconnect(lt))}G=null,X=null,p.reset();for(let Z in m)delete m[Z];t.setRenderTarget(S),f=null,u=null,d=null,s=null,y=null,te.stop(),n.isPresenting=!1,t.setPixelRatio(x),t.setSize(C.width,C.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,n.isPresenting===!0&&Bt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){a=Z,n.isPresenting===!0&&Bt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&_&&(d=new XRWebGLBinding(s,e)),d},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Z){if(s=Z,s!==null){if(S=t.getRenderTarget(),s.addEventListener("select",F),s.addEventListener("selectstart",F),s.addEventListener("selectend",F),s.addEventListener("squeeze",F),s.addEventListener("squeezestart",F),s.addEventListener("squeezeend",F),s.addEventListener("end",W),s.addEventListener("inputsourceschange",k),M.xrCompatible!==!0&&await e.makeXRCompatible(),x=t.getPixelRatio(),t.getSize(C),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let tt=null,St=null,wt=null;M.depth&&(wt=M.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,tt=M.stencil?wi:zn,St=M.stencil?Us:Ln);let bt={colorFormat:e.RGBA8,depthFormat:wt,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(bt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),y=new pn(u.textureWidth,u.textureHeight,{format:on,type:rn,depthTexture:new ri(u.textureWidth,u.textureHeight,St,void 0,void 0,void 0,void 0,void 0,void 0,tt),stencilBuffer:M.stencil,colorSpace:t.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let tt={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,tt),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new pn(f.framebufferWidth,f.framebufferHeight,{format:on,type:rn,colorSpace:t.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),te.setContext(s),te.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function k(Z){for(let lt=0;lt<Z.removed.length;lt++){let tt=Z.removed[lt],St=E.indexOf(tt);St>=0&&(E[St]=null,w[St].disconnect(tt))}for(let lt=0;lt<Z.added.length;lt++){let tt=Z.added[lt],St=E.indexOf(tt);if(St===-1){for(let bt=0;bt<w.length;bt++)if(bt>=E.length){E.push(tt),St=bt;break}else if(E[bt]===null){E[bt]=tt,St=bt;break}if(St===-1)break}let wt=w[St];wt&&wt.connect(tt)}}let K=new R,Q=new R;function rt(Z,lt,tt){K.setFromMatrixPosition(lt.matrixWorld),Q.setFromMatrixPosition(tt.matrixWorld);let St=K.distanceTo(Q),wt=lt.projectionMatrix.elements,bt=tt.projectionMatrix.elements,Qt=wt[14]/(wt[10]-1),Ut=wt[14]/(wt[10]+1),j=(wt[9]+1)/wt[5],nt=(wt[9]-1)/wt[5],st=(wt[8]-1)/wt[0],_t=(bt[8]+1)/bt[0],mt=Qt*st,Ot=Qt*_t,Pt=St/(-st+_t),Wt=Pt*-st;if(lt.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(Wt),Z.translateZ(Pt),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),wt[10]===-1)Z.projectionMatrix.copy(lt.projectionMatrix),Z.projectionMatrixInverse.copy(lt.projectionMatrixInverse);else{let Zt=Qt+Pt,L=Ut+Pt,fe=mt-Wt,se=Ot+(St-Wt),A=j*Ut/L*Zt,v=nt*Ut/L*Zt;Z.projectionMatrix.makePerspective(fe,se,A,v,Zt,L),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function ot(Z,lt){lt===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(lt.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(s===null)return;let lt=Z.near,tt=Z.far;p.texture!==null&&(p.depthNear>0&&(lt=p.depthNear),p.depthFar>0&&(tt=p.depthFar)),U.near=P.near=T.near=lt,U.far=P.far=T.far=tt,(G!==U.near||X!==U.far)&&(s.updateRenderState({depthNear:U.near,depthFar:U.far}),G=U.near,X=U.far),U.layers.mask=Z.layers.mask|6,T.layers.mask=U.layers.mask&-5,P.layers.mask=U.layers.mask&-3;let St=Z.parent,wt=U.cameras;ot(U,St);for(let bt=0;bt<wt.length;bt++)ot(wt[bt],St);wt.length===2?rt(U,T,P):U.projectionMatrix.copy(T.projectionMatrix),ct(Z,U,St)};function ct(Z,lt,tt){tt===null?Z.matrix.copy(lt.matrixWorld):(Z.matrix.copy(tt.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(lt.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(lt.projectionMatrix),Z.projectionMatrixInverse.copy(lt.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Bo*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return U},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Z)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(U)},this.getCameraTexture=function(Z){return m[Z]};let Gt=null;function le(Z,lt){if(h=lt.getViewerPose(c||o),g=lt,h!==null){let tt=h.views;f!==null&&(t.setRenderTargetFramebuffer(y,f.framebuffer),t.setRenderTarget(y));let St=!1;tt.length!==U.cameras.length&&(U.cameras.length=0,St=!0);for(let Ut=0;Ut<tt.length;Ut++){let j=tt[Ut],nt=null;if(f!==null)nt=f.getViewport(j);else{let _t=d.getViewSubImage(u,j);nt=_t.viewport,Ut===0&&(t.setRenderTargetTextures(y,_t.colorTexture,_t.depthStencilTexture),t.setRenderTarget(y))}let st=I[Ut];st===void 0&&(st=new Ze,st.layers.enable(Ut),st.viewport=new be,I[Ut]=st),st.matrix.fromArray(j.transform.matrix),st.matrix.decompose(st.position,st.quaternion,st.scale),st.projectionMatrix.fromArray(j.projectionMatrix),st.projectionMatrixInverse.copy(st.projectionMatrix).invert(),st.viewport.set(nt.x,nt.y,nt.width,nt.height),Ut===0&&(U.matrix.copy(st.matrix),U.matrix.decompose(U.position,U.quaternion,U.scale)),St===!0&&U.cameras.push(st)}let wt=s.enabledFeatures;if(wt&&wt.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&_){d=n.getBinding();let Ut=d.getDepthInformation(tt[0]);Ut&&Ut.isValid&&Ut.texture&&p.init(Ut,s.renderState)}if(wt&&wt.includes("camera-access")&&_){t.state.unbindTexture(),d=n.getBinding();for(let Ut=0;Ut<tt.length;Ut++){let j=tt[Ut].camera;if(j){let nt=m[j];nt||(nt=new gr,m[j]=nt);let st=d.getCameraImage(j);nt.sourceTexture=st}}}}for(let tt=0;tt<w.length;tt++){let St=E[tt],wt=w[tt];St!==null&&wt!==void 0&&wt.update(St,lt,c||o)}Gt&&Gt(Z,lt),lt.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:lt}),g=null}let te=new md;te.setAnimationLoop(le),this.setAnimationLoop=function(Z){Gt=Z},this.dispose=function(){}}},a_=new ae,Md=new Yt;Md.set(-1,0,0,0,1,0,0,0,1);function l_(i,t){function e(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function n(p,m){m.color.getRGB(p.fogColor.value,Dc(i)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function s(p,m,M,S,y){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?r(p,m):m.isMeshLambertMaterial?(r(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(r(p,m),d(p,m)):m.isMeshPhongMaterial?(r(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(r(p,m),u(p,m),m.isMeshPhysicalMaterial&&f(p,m,y)):m.isMeshMatcapMaterial?(r(p,m),g(p,m)):m.isMeshDepthMaterial?r(p,m):m.isMeshDistanceMaterial?(r(p,m),_(p,m)):m.isMeshNormalMaterial?r(p,m):m.isLineBasicMaterial?(o(p,m),m.isLineDashedMaterial&&a(p,m)):m.isPointsMaterial?l(p,m,M,S):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,e(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===Ue&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,e(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===Ue&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,e(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,e(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,e(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);let M=t.get(m),S=M.envMap,y=M.envMapRotation;S&&(p.envMap.value=S,p.envMapRotation.value.setFromMatrix4(a_.makeRotationFromEuler(y)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(Md),p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,e(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,e(m.aoMap,p.aoMapTransform))}function o(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform))}function a(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,M,S){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*M,p.scale.value=S*.5,m.map&&(p.map.value=m.map,e(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function d(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function u(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,e(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,e(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function f(p,m,M){p.ior.value=m.ior,m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,e(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,e(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,e(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,e(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,e(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===Ue&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,e(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,e(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=M.texture,p.transmissionSamplerSize.value.set(M.width,M.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,e(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,e(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,e(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,e(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,e(m.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,m){m.matcap&&(p.matcap.value=m.matcap)}function _(p,m){let M=t.get(m).light;p.referencePosition.value.setFromMatrixPosition(M.matrixWorld),p.nearDistance.value=M.shadow.camera.near,p.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function c_(i,t,e,n){let s={},r={},o=[],a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,w){let E=w.program;n.uniformBlockBinding(y,E)}function c(y,w){let E=s[y.id];E===void 0&&(p(y),E=h(y),s[y.id]=E,y.addEventListener("dispose",M));let C=w.program;n.updateUBOMapping(y,C);let x=t.render.frame;r[y.id]!==x&&(u(y),r[y.id]=x)}function h(y){let w=d();y.__bindingPointIndex=w;let E=i.createBuffer(),C=y.__size,x=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,C,x),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,w,E),E}function d(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return Ft("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let w=s[y.id],E=y.uniforms,C=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,w);for(let x=0,T=E.length;x<T;x++){let P=E[x];if(Array.isArray(P))for(let I=0,U=P.length;I<U;I++)f(P[I],x,I,C);else f(P,x,0,C)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(y,w,E,C){if(_(y,w,E,C)===!0){let x=y.__offset,T=y.value;if(Array.isArray(T)){let P=0;for(let I=0;I<T.length;I++){let U=T[I],G=m(U);g(U,y.__data,P),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(P+=G.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(T,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,x,y.__data)}}function g(y,w,E){typeof y=="number"||typeof y=="boolean"?w[0]=y:y.isMatrix3?(w[0]=y.elements[0],w[1]=y.elements[1],w[2]=y.elements[2],w[3]=0,w[4]=y.elements[3],w[5]=y.elements[4],w[6]=y.elements[5],w[7]=0,w[8]=y.elements[6],w[9]=y.elements[7],w[10]=y.elements[8],w[11]=0):ArrayBuffer.isView(y)?w.set(new y.constructor(y.buffer,y.byteOffset,w.length)):y.toArray(w,E)}function _(y,w,E,C){let x=y.value,T=w+"_"+E;if(C[T]===void 0)return typeof x=="number"||typeof x=="boolean"?C[T]=x:ArrayBuffer.isView(x)?C[T]=x.slice():C[T]=x.clone(),!0;{let P=C[T];if(typeof x=="number"||typeof x=="boolean"){if(P!==x)return C[T]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(P.equals(x)===!1)return P.copy(x),!0}}return!1}function p(y){let w=y.uniforms,E=0,C=16;for(let T=0,P=w.length;T<P;T++){let I=Array.isArray(w[T])?w[T]:[w[T]];for(let U=0,G=I.length;U<G;U++){let X=I[U],F=Array.isArray(X.value)?X.value:[X.value];for(let W=0,k=F.length;W<k;W++){let K=F[W],Q=m(K),rt=E%C,ot=rt%Q.boundary,ct=rt+ot;E+=ot,ct!==0&&C-ct<Q.storage&&(E+=C-ct),X.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),X.__offset=E,E+=Q.storage}}}let x=E%C;return x>0&&(E+=C-x),y.__size=E,y.__cache={},this}function m(y){let w={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(w.boundary=4,w.storage=4):y.isVector2?(w.boundary=8,w.storage=8):y.isVector3||y.isColor?(w.boundary=16,w.storage=12):y.isVector4?(w.boundary=16,w.storage=16):y.isMatrix3?(w.boundary=48,w.storage=48):y.isMatrix4?(w.boundary=64,w.storage=64):y.isTexture?Bt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(w.boundary=16,w.storage=y.byteLength):Bt("WebGLRenderer: Unsupported uniform value type.",y),w}function M(y){let w=y.target;w.removeEventListener("dispose",M);let E=o.indexOf(w.__bindingPointIndex);o.splice(E,1),i.deleteBuffer(s[w.id]),delete s[w.id],delete r[w.id]}function S(){for(let y in s)i.deleteBuffer(s[y]);o=[],s={},r={}}return{bind:l,update:c,dispose:S}}var h_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Yn=null;function u_(){return Yn===null&&(Yn=new Hi(h_,16,16,Ai,qn),Yn.name="DFG_LUT",Yn.minFilter=Ie,Yn.magFilter=Ie,Yn.wrapS=Mn,Yn.wrapT=Mn,Yn.generateMipmaps=!1,Yn.needsUpdate=!0),Yn}var ol=class{constructor(t={}){let{canvas:e=Nu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=rn}=t;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=o;let _=f,p=new Set([Sa,Ma,ya]),m=new Set([rn,Ln,Ds,Us,xa,_a]),M=new Uint32Array(4),S=new Int32Array(4),y=new R,w=null,E=null,C=[],x=[],T=null;this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=In,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let P=this,I=!1,U=null,G=null,X=null,F=null;this._outputColorSpace=De;let W=0,k=0,K=null,Q=-1,rt=null,ot=new be,ct=new be,Gt=null,le=new Ht(0),te=0,Z=e.width,lt=e.height,tt=1,St=null,wt=null,bt=new be(0,0,Z,lt),Qt=new be(0,0,Z,lt),Ut=!1,j=new ws,nt=!1,st=!1,_t=new ae,mt=new R,Ot=new be,Pt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Wt=!1;function Zt(){return K===null?tt:1}let L=n;function fe(b,N){return e.getContext(b,N)}try{let b={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"185"}`),e.addEventListener("webglcontextlost",Te,!1),e.addEventListener("webglcontextrestored",_e,!1),e.addEventListener("webglcontextcreationerror",Un,!1),L===null){let N="webgl2";if(L=fe(N,b),L===null)throw fe(N)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(b){throw Ft("WebGLRenderer: "+b.message),b}let se,A,v,O,V,q,at,ht,Y,J,dt,It,gt,ft,Nt,Vt,$t,D,ut,$,pt,Mt,et;function Ct(){se=new _g(L),se.init(),pt=new s_(L,se),A=new hg(L,se,t,pt),v=new n_(L,se),A.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),G=L.createFramebuffer(),X=L.createFramebuffer(),F=L.createFramebuffer(),O=new Mg(L),V=new Hx,q=new i_(L,se,v,V,A,pt,O),at=new xg(P),ht=new Tp(L),Mt=new lg(L,ht),Y=new vg(L,ht,O,Mt),J=new bg(L,Y,ht,Mt,O),D=new Sg(L,A,q),Nt=new ug(V),dt=new kx(P,at,se,A,Mt,Nt),It=new l_(P,V),gt=new Wx,ft=new Jx(se),$t=new ag(P,at,v,J,g,l),Vt=new e_(P,J,A),et=new c_(L,O,A,v),ut=new cg(L,se,O),$=new yg(L,se,O),O.programs=dt.programs,P.capabilities=A,P.extensions=se,P.properties=V,P.renderLists=gt,P.shadowMap=Vt,P.state=v,P.info=O}Ct(),_!==rn&&(T=new Tg(_,e.width,e.height,a,s,r));let At=new nh(P,L);this.xr=At,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let b=se.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=se.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return tt},this.setPixelRatio=function(b){b!==void 0&&(tt=b,this.setSize(Z,lt,!1))},this.getSize=function(b){return b.set(Z,lt)},this.setSize=function(b,N,H=!0){if(At.isPresenting){Bt("WebGLRenderer: Can't change size while VR device is presenting.");return}Z=b,lt=N,e.width=Math.floor(b*tt),e.height=Math.floor(N*tt),H===!0&&(e.style.width=b+"px",e.style.height=N+"px"),T!==null&&T.setSize(e.width,e.height),this.setViewport(0,0,b,N)},this.getDrawingBufferSize=function(b){return b.set(Z*tt,lt*tt).floor()},this.setDrawingBufferSize=function(b,N,H){Z=b,lt=N,tt=H,e.width=Math.floor(b*H),e.height=Math.floor(N*H),this.setViewport(0,0,b,N)},this.setEffects=function(b){if(_===rn){Ft("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let N=0;N<b.length;N++)if(b[N].isOutputPass===!0){Bt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(ot)},this.getViewport=function(b){return b.copy(bt)},this.setViewport=function(b,N,H,B){b.isVector4?bt.set(b.x,b.y,b.z,b.w):bt.set(b,N,H,B),v.viewport(ot.copy(bt).multiplyScalar(tt).round())},this.getScissor=function(b){return b.copy(Qt)},this.setScissor=function(b,N,H,B){b.isVector4?Qt.set(b.x,b.y,b.z,b.w):Qt.set(b,N,H,B),v.scissor(ct.copy(Qt).multiplyScalar(tt).round())},this.getScissorTest=function(){return Ut},this.setScissorTest=function(b){v.setScissorTest(Ut=b)},this.setOpaqueSort=function(b){St=b},this.setTransparentSort=function(b){wt=b},this.getClearColor=function(b){return b.copy($t.getClearColor())},this.setClearColor=function(){$t.setClearColor(...arguments)},this.getClearAlpha=function(){return $t.getClearAlpha()},this.setClearAlpha=function(){$t.setClearAlpha(...arguments)},this.clear=function(b=!0,N=!0,H=!0){let B=0;if(b){let z=!1;if(K!==null){let yt=K.texture.format;z=p.has(yt)}if(z){let yt=K.texture.type,Tt=m.has(yt),vt=$t.getClearColor(),Rt=$t.getClearAlpha(),Lt=vt.r,Jt=vt.g,ee=vt.b;Tt?(M[0]=Lt,M[1]=Jt,M[2]=ee,M[3]=Rt,L.clearBufferuiv(L.COLOR,0,M)):(S[0]=Lt,S[1]=Jt,S[2]=ee,S[3]=Rt,L.clearBufferiv(L.COLOR,0,S))}else B|=L.COLOR_BUFFER_BIT}N&&(B|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),H&&(B|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B!==0&&L.clear(B)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),U=b},this.dispose=function(){e.removeEventListener("webglcontextlost",Te,!1),e.removeEventListener("webglcontextrestored",_e,!1),e.removeEventListener("webglcontextcreationerror",Un,!1),$t.dispose(),gt.dispose(),ft.dispose(),V.dispose(),at.dispose(),J.dispose(),Mt.dispose(),et.dispose(),dt.dispose(),At.dispose(),At.removeEventListener("sessionstart",mh),At.removeEventListener("sessionend",gh),Li.stop()};function Te(b){b.preventDefault(),ar("WebGLRenderer: Context Lost."),I=!0}function _e(){ar("WebGLRenderer: Context Restored."),I=!1;let b=O.autoReset,N=Vt.enabled,H=Vt.autoUpdate,B=Vt.needsUpdate,z=Vt.type;Ct(),O.autoReset=b,Vt.enabled=N,Vt.autoUpdate=H,Vt.needsUpdate=B,Vt.type=z}function Un(b){Ft("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function Nn(b){let N=b.target;N.removeEventListener("dispose",Nn),lf(N)}function lf(b){cf(b),V.remove(b)}function cf(b){let N=V.get(b).programs;N!==void 0&&(N.forEach(function(H){dt.releaseProgram(H)}),b.isShaderMaterial&&dt.releaseShaderCache(b))}this.renderBufferDirect=function(b,N,H,B,z,yt){N===null&&(N=Pt);let Tt=z.isMesh&&z.matrixWorld.determinantAffine()<0,vt=df(b,N,H,B,z);v.setMaterial(B,Tt);let Rt=H.index,Lt=1;if(B.wireframe===!0){if(Rt=Y.getWireframeAttribute(H),Rt===void 0)return;Lt=2}let Jt=H.drawRange,ee=H.attributes.position,Dt=Jt.start*Lt,pe=(Jt.start+Jt.count)*Lt;yt!==null&&(Dt=Math.max(Dt,yt.start*Lt),pe=Math.min(pe,(yt.start+yt.count)*Lt)),Rt!==null?(Dt=Math.max(Dt,0),pe=Math.min(pe,Rt.count)):ee!=null&&(Dt=Math.max(Dt,0),pe=Math.min(pe,ee.count));let Re=pe-Dt;if(Re<0||Re===1/0)return;Mt.setup(z,B,vt,H,Rt);let we,ge=ut;if(Rt!==null&&(we=ht.get(Rt),ge=$,ge.setIndex(we)),z.isMesh)B.wireframe===!0?(v.setLineWidth(B.wireframeLinewidth*Zt()),ge.setMode(L.LINES)):ge.setMode(L.TRIANGLES);else if(z.isLine){let Xe=B.linewidth;Xe===void 0&&(Xe=1),v.setLineWidth(Xe*Zt()),z.isLineSegments?ge.setMode(L.LINES):z.isLineLoop?ge.setMode(L.LINE_LOOP):ge.setMode(L.LINE_STRIP)}else z.isPoints?ge.setMode(L.POINTS):z.isSprite&&ge.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(se.get("WEBGL_multi_draw"))ge.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let Xe=z._multiDrawStarts,Et=z._multiDrawCounts,un=z._multiDrawCount,he=Rt?ht.get(Rt).bytesPerElement:1,_n=V.get(B).currentProgram.getUniforms();for(let Fn=0;Fn<un;Fn++)_n.setValue(L,"_gl_DrawID",Fn),ge.render(Xe[Fn]/he,Et[Fn])}else if(z.isInstancedMesh)ge.renderInstances(Dt,Re,z.count);else if(H.isInstancedBufferGeometry){let Xe=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,Et=Math.min(H.instanceCount,Xe);ge.renderInstances(Dt,Re,Et)}else ge.render(Dt,Re)};function ph(b,N,H){b.transparent===!0&&b.side===$e&&b.forceSinglePass===!1?(b.side=Ue,b.needsUpdate=!0,$r(b,N,H),b.side=si,b.needsUpdate=!0,$r(b,N,H),b.side=$e):$r(b,N,H)}this.compile=function(b,N,H=null){H===null&&(H=b),E=ft.get(H),E.init(N),x.push(E),H.traverseVisible(function(z){z.isLight&&z.layers.test(N.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),b!==H&&b.traverseVisible(function(z){z.isLight&&z.layers.test(N.layers)&&(E.pushLight(z),z.castShadow&&E.pushShadow(z))}),E.setupLights();let B=new Set;return b.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let yt=z.material;if(yt)if(Array.isArray(yt))for(let Tt=0;Tt<yt.length;Tt++){let vt=yt[Tt];ph(vt,H,z),B.add(vt)}else ph(yt,H,z),B.add(yt)}),E=x.pop(),B},this.compileAsync=function(b,N,H=null){let B=this.compile(b,N,H);return new Promise(z=>{function yt(){if(B.forEach(function(Tt){V.get(Tt).currentProgram.isReady()&&B.delete(Tt)}),B.size===0){z(b);return}setTimeout(yt,10)}se.get("KHR_parallel_shader_compile")!==null?yt():setTimeout(yt,10)})};let Sl=null;function hf(b){Sl&&Sl(b)}function mh(){Li.stop()}function gh(){Li.start()}let Li=new md;Li.setAnimationLoop(hf),typeof self<"u"&&Li.setContext(self),this.setAnimationLoop=function(b){Sl=b,At.setAnimationLoop(b),b===null?Li.stop():Li.start()},At.addEventListener("sessionstart",mh),At.addEventListener("sessionend",gh),this.render=function(b,N){if(N!==void 0&&N.isCamera!==!0){Ft("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;U!==null&&U.renderStart(b,N);let H=At.enabled===!0&&At.isPresenting===!0,B=T!==null&&(K===null||H)&&T.begin(P,K);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),At.enabled===!0&&At.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(At.cameraAutoUpdate===!0&&At.updateCamera(N),N=At.getCamera()),b.isScene===!0&&b.onBeforeRender(P,b,N,K),E=ft.get(b,x.length),E.init(N),E.state.textureUnits=q.getTextureUnits(),x.push(E),_t.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),j.setFromProjectionMatrix(_t,Rn,N.reversedDepth),st=this.localClippingEnabled,nt=Nt.init(this.clippingPlanes,st),w=gt.get(b,C.length),w.init(),C.push(w),At.enabled===!0&&At.isPresenting===!0){let Tt=P.xr.getDepthSensingMesh();Tt!==null&&bl(Tt,N,-1/0,P.sortObjects)}bl(b,N,0,P.sortObjects),w.finish(),P.sortObjects===!0&&w.sort(St,wt,N.reversedDepth),Wt=At.enabled===!1||At.isPresenting===!1||At.hasDepthSensing()===!1,Wt&&$t.addToRenderList(w,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),nt===!0&&Nt.beginShadows();let z=E.state.shadowsArray;if(Vt.render(z,b,N),nt===!0&&Nt.endShadows(),(B&&T.hasRenderPass())===!1){let Tt=w.opaque,vt=w.transmissive;if(E.setupLights(),N.isArrayCamera){let Rt=N.cameras;if(vt.length>0)for(let Lt=0,Jt=Rt.length;Lt<Jt;Lt++){let ee=Rt[Lt];_h(Tt,vt,b,ee)}Wt&&$t.render(b);for(let Lt=0,Jt=Rt.length;Lt<Jt;Lt++){let ee=Rt[Lt];xh(w,b,ee,ee.viewport)}}else vt.length>0&&_h(Tt,vt,b,N),Wt&&$t.render(b),xh(w,b,N)}K!==null&&k===0&&(q.updateMultisampleRenderTarget(K),q.updateRenderTargetMipmap(K)),B&&T.end(P),b.isScene===!0&&b.onAfterRender(P,b,N),Mt.resetDefaultState(),Q=-1,rt=null,x.pop(),x.length>0?(E=x[x.length-1],q.setTextureUnits(E.state.textureUnits),nt===!0&&Nt.setGlobalState(P.clippingPlanes,E.state.camera)):E=null,C.pop(),C.length>0?w=C[C.length-1]:w=null,U!==null&&U.renderEnd()};function bl(b,N,H,B){if(b.visible===!1)return;if(b.layers.test(N.layers)){if(b.isGroup)H=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(N);else if(b.isLightProbeGrid)E.pushLightProbeGrid(b);else if(b.isLight)E.pushLight(b),b.castShadow&&E.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||j.intersectsSprite(b)){B&&Ot.setFromMatrixPosition(b.matrixWorld).applyMatrix4(_t);let Tt=J.update(b),vt=b.material;vt.visible&&w.push(b,Tt,vt,H,Ot.z,null)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||j.intersectsObject(b))){let Tt=J.update(b),vt=b.material;if(B&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),Ot.copy(b.boundingSphere.center)):(Tt.boundingSphere===null&&Tt.computeBoundingSphere(),Ot.copy(Tt.boundingSphere.center)),Ot.applyMatrix4(b.matrixWorld).applyMatrix4(_t)),Array.isArray(vt)){let Rt=Tt.groups;for(let Lt=0,Jt=Rt.length;Lt<Jt;Lt++){let ee=Rt[Lt],Dt=vt[ee.materialIndex];Dt&&Dt.visible&&w.push(b,Tt,Dt,H,Ot.z,ee)}}else vt.visible&&w.push(b,Tt,vt,H,Ot.z,null)}}let yt=b.children;for(let Tt=0,vt=yt.length;Tt<vt;Tt++)bl(yt[Tt],N,H,B)}function xh(b,N,H,B){let{opaque:z,transmissive:yt,transparent:Tt}=b;E.setupLightsView(H),nt===!0&&Nt.setGlobalState(P.clippingPlanes,H),B&&v.viewport(ot.copy(B)),z.length>0&&Zr(z,N,H),yt.length>0&&Zr(yt,N,H),Tt.length>0&&Zr(Tt,N,H),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function _h(b,N,H,B){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[B.id]===void 0){let Dt=se.has("EXT_color_buffer_half_float")||se.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[B.id]=new pn(1,1,{generateMipmaps:!0,type:Dt?qn:rn,minFilter:Ti,samples:Math.max(4,A.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:oe.workingColorSpace})}let yt=E.state.transmissionRenderTarget[B.id],Tt=B.viewport||ot;yt.setSize(Tt.z*P.transmissionResolutionScale,Tt.w*P.transmissionResolutionScale);let vt=P.getRenderTarget(),Rt=P.getActiveCubeFace(),Lt=P.getActiveMipmapLevel();P.setRenderTarget(yt),P.getClearColor(le),te=P.getClearAlpha(),te<1&&P.setClearColor(16777215,.5),P.clear(),Wt&&$t.render(H);let Jt=P.toneMapping;P.toneMapping=In;let ee=B.viewport;if(B.viewport!==void 0&&(B.viewport=void 0),E.setupLightsView(B),nt===!0&&Nt.setGlobalState(P.clippingPlanes,B),Zr(b,H,B),q.updateMultisampleRenderTarget(yt),q.updateRenderTargetMipmap(yt),se.has("WEBGL_multisampled_render_to_texture")===!1){let Dt=!1;for(let pe=0,Re=N.length;pe<Re;pe++){let we=N[pe],{object:ge,geometry:Xe,material:Et,group:un}=we;if(Et.side===$e&&ge.layers.test(B.layers)){let he=Et.side;Et.side=Ue,Et.needsUpdate=!0,vh(ge,H,B,Xe,Et,un),Et.side=he,Et.needsUpdate=!0,Dt=!0}}Dt===!0&&(q.updateMultisampleRenderTarget(yt),q.updateRenderTargetMipmap(yt))}P.setRenderTarget(vt,Rt,Lt),P.setClearColor(le,te),ee!==void 0&&(B.viewport=ee),P.toneMapping=Jt}function Zr(b,N,H){let B=N.isScene===!0?N.overrideMaterial:null;for(let z=0,yt=b.length;z<yt;z++){let Tt=b[z],{object:vt,geometry:Rt,group:Lt}=Tt,Jt=Tt.material;Jt.allowOverride===!0&&B!==null&&(Jt=B),vt.layers.test(H.layers)&&vh(vt,N,H,Rt,Jt,Lt)}}function vh(b,N,H,B,z,yt){b.onBeforeRender(P,N,H,B,z,yt),b.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),z.onBeforeRender(P,N,H,B,b,yt),z.transparent===!0&&z.side===$e&&z.forceSinglePass===!1?(z.side=Ue,z.needsUpdate=!0,P.renderBufferDirect(H,N,B,z,b,yt),z.side=si,z.needsUpdate=!0,P.renderBufferDirect(H,N,B,z,b,yt),z.side=$e):P.renderBufferDirect(H,N,B,z,b,yt),b.onAfterRender(P,N,H,B,z,yt)}function $r(b,N,H){N.isScene!==!0&&(N=Pt);let B=V.get(b),z=E.state.lights,yt=E.state.shadowsArray,Tt=z.state.version,vt=dt.getParameters(b,z.state,yt,N,H,E.state.lightProbeGridArray),Rt=dt.getProgramCacheKey(vt),Lt=B.programs;B.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?N.environment:null,B.fog=N.fog;let Jt=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;B.envMap=at.get(b.envMap||B.environment,Jt),B.envMapRotation=B.environment!==null&&b.envMap===null?N.environmentRotation:b.envMapRotation,Lt===void 0&&(b.addEventListener("dispose",Nn),Lt=new Map,B.programs=Lt);let ee=Lt.get(Rt);if(ee!==void 0){if(B.currentProgram===ee&&B.lightsStateVersion===Tt)return Mh(b,vt),ee}else vt.uniforms=dt.getUniforms(b),U!==null&&b.isNodeMaterial&&U.build(b,H,vt),b.onBeforeCompile(vt,P),ee=dt.acquireProgram(vt,Rt),Lt.set(Rt,ee),B.uniforms=vt.uniforms;let Dt=B.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(Dt.clippingPlanes=Nt.uniform),Mh(b,vt),B.needsLights=pf(b),B.lightsStateVersion=Tt,B.needsLights&&(Dt.ambientLightColor.value=z.state.ambient,Dt.lightProbe.value=z.state.probe,Dt.directionalLights.value=z.state.directional,Dt.directionalLightShadows.value=z.state.directionalShadow,Dt.spotLights.value=z.state.spot,Dt.spotLightShadows.value=z.state.spotShadow,Dt.rectAreaLights.value=z.state.rectArea,Dt.ltc_1.value=z.state.rectAreaLTC1,Dt.ltc_2.value=z.state.rectAreaLTC2,Dt.pointLights.value=z.state.point,Dt.pointLightShadows.value=z.state.pointShadow,Dt.hemisphereLights.value=z.state.hemi,Dt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Dt.spotLightMatrix.value=z.state.spotLightMatrix,Dt.spotLightMap.value=z.state.spotLightMap,Dt.pointShadowMatrix.value=z.state.pointShadowMatrix),B.lightProbeGrid=E.state.lightProbeGridArray.length>0,B.currentProgram=ee,B.uniformsList=null,ee}function yh(b){if(b.uniformsList===null){let N=b.currentProgram.getUniforms();b.uniformsList=Fs.seqWithValue(N.seq,b.uniforms)}return b.uniformsList}function Mh(b,N){let H=V.get(b);H.outputColorSpace=N.outputColorSpace,H.batching=N.batching,H.batchingColor=N.batchingColor,H.instancing=N.instancing,H.instancingColor=N.instancingColor,H.instancingMorph=N.instancingMorph,H.skinning=N.skinning,H.morphTargets=N.morphTargets,H.morphNormals=N.morphNormals,H.morphColors=N.morphColors,H.morphTargetsCount=N.morphTargetsCount,H.numClippingPlanes=N.numClippingPlanes,H.numIntersection=N.numClipIntersection,H.vertexAlphas=N.vertexAlphas,H.vertexTangents=N.vertexTangents,H.toneMapping=N.toneMapping}function uf(b,N){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;y.setFromMatrixPosition(N.matrixWorld);for(let H=0,B=b.length;H<B;H++){let z=b[H];if(z.texture!==null&&z.boundingBox.containsPoint(y))return z}return null}function df(b,N,H,B,z){N.isScene!==!0&&(N=Pt),q.resetTextureUnits();let yt=N.fog,Tt=B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial?N.environment:null,vt=K===null?P.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:oe.workingColorSpace,Rt=B.isMeshStandardMaterial||B.isMeshLambertMaterial&&!B.envMap||B.isMeshPhongMaterial&&!B.envMap,Lt=at.get(B.envMap||Tt,Rt),Jt=B.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,ee=!!H.attributes.tangent&&(!!B.normalMap||B.anisotropy>0),Dt=!!H.morphAttributes.position,pe=!!H.morphAttributes.normal,Re=!!H.morphAttributes.color,we=In;B.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(we=P.toneMapping);let ge=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,Xe=ge!==void 0?ge.length:0,Et=V.get(B),un=E.state.lights;if(nt===!0&&(st===!0||b!==rt)){let ve=b===rt&&B.id===Q;Nt.setState(B,b,ve)}let he=!1;B.version===Et.__version?(Et.needsLights&&Et.lightsStateVersion!==un.state.version||Et.outputColorSpace!==vt||z.isBatchedMesh&&Et.batching===!1||!z.isBatchedMesh&&Et.batching===!0||z.isBatchedMesh&&Et.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Et.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Et.instancing===!1||!z.isInstancedMesh&&Et.instancing===!0||z.isSkinnedMesh&&Et.skinning===!1||!z.isSkinnedMesh&&Et.skinning===!0||z.isInstancedMesh&&Et.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Et.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Et.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Et.instancingMorph===!1&&z.morphTexture!==null||Et.envMap!==Lt||B.fog===!0&&Et.fog!==yt||Et.numClippingPlanes!==void 0&&(Et.numClippingPlanes!==Nt.numPlanes||Et.numIntersection!==Nt.numIntersection)||Et.vertexAlphas!==Jt||Et.vertexTangents!==ee||Et.morphTargets!==Dt||Et.morphNormals!==pe||Et.morphColors!==Re||Et.toneMapping!==we||Et.morphTargetsCount!==Xe||!!Et.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(he=!0):(he=!0,Et.__version=B.version);let _n=Et.currentProgram;he===!0&&(_n=$r(B,N,z),U&&B.isNodeMaterial&&U.onUpdateProgram(B,_n,Et));let Fn=!1,ci=!1,Qi=!1,xe=_n.getUniforms(),Ce=Et.uniforms;if(v.useProgram(_n.program)&&(Fn=!0,ci=!0,Qi=!0),B.id!==Q&&(Q=B.id,ci=!0),Et.needsLights){let ve=uf(E.state.lightProbeGridArray,z);Et.lightProbeGrid!==ve&&(Et.lightProbeGrid=ve,ci=!0)}if(Fn||rt!==b){v.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),xe.setValue(L,"projectionMatrix",b.projectionMatrix),xe.setValue(L,"viewMatrix",b.matrixWorldInverse);let ui=xe.map.cameraPosition;ui!==void 0&&ui.setValue(L,mt.setFromMatrixPosition(b.matrixWorld)),A.logarithmicDepthBuffer&&xe.setValue(L,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(B.isMeshPhongMaterial||B.isMeshToonMaterial||B.isMeshLambertMaterial||B.isMeshBasicMaterial||B.isMeshStandardMaterial||B.isShaderMaterial)&&xe.setValue(L,"isOrthographic",b.isOrthographicCamera===!0),rt!==b&&(rt=b,ci=!0,Qi=!0)}if(Et.needsLights&&(un.state.directionalShadowMap.length>0&&xe.setValue(L,"directionalShadowMap",un.state.directionalShadowMap,q),un.state.spotShadowMap.length>0&&xe.setValue(L,"spotShadowMap",un.state.spotShadowMap,q),un.state.pointShadowMap.length>0&&xe.setValue(L,"pointShadowMap",un.state.pointShadowMap,q)),z.isSkinnedMesh){xe.setOptional(L,z,"bindMatrix"),xe.setOptional(L,z,"bindMatrixInverse");let ve=z.skeleton;ve&&(ve.boneTexture===null&&ve.computeBoneTexture(),xe.setValue(L,"boneTexture",ve.boneTexture,q))}z.isBatchedMesh&&(xe.setOptional(L,z,"batchingTexture"),xe.setValue(L,"batchingTexture",z._matricesTexture,q),xe.setOptional(L,z,"batchingIdTexture"),xe.setValue(L,"batchingIdTexture",z._indirectTexture,q),xe.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&xe.setValue(L,"batchingColorTexture",z._colorsTexture,q));let hi=H.morphAttributes;if((hi.position!==void 0||hi.normal!==void 0||hi.color!==void 0)&&D.update(z,H,_n),(ci||Et.receiveShadow!==z.receiveShadow)&&(Et.receiveShadow=z.receiveShadow,xe.setValue(L,"receiveShadow",z.receiveShadow)),(B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial)&&B.envMap===null&&N.environment!==null&&(Ce.envMapIntensity.value=N.environmentIntensity),Ce.dfgLUT!==void 0&&(Ce.dfgLUT.value=u_()),ci){if(xe.setValue(L,"toneMappingExposure",P.toneMappingExposure),Et.needsLights&&ff(Ce,Qi),yt&&B.fog===!0&&It.refreshFogUniforms(Ce,yt),It.refreshMaterialUniforms(Ce,B,tt,lt,E.state.transmissionRenderTarget[b.id]),Et.needsLights&&Et.lightProbeGrid){let ve=Et.lightProbeGrid;Ce.probesSH.value=ve.texture,Ce.probesMin.value.copy(ve.boundingBox.min),Ce.probesMax.value.copy(ve.boundingBox.max),Ce.probesResolution.value.copy(ve.resolution)}Fs.upload(L,yh(Et),Ce,q)}if(B.isShaderMaterial&&B.uniformsNeedUpdate===!0&&(Fs.upload(L,yh(Et),Ce,q),B.uniformsNeedUpdate=!1),B.isSpriteMaterial&&xe.setValue(L,"center",z.center),xe.setValue(L,"modelViewMatrix",z.modelViewMatrix),xe.setValue(L,"normalMatrix",z.normalMatrix),xe.setValue(L,"modelMatrix",z.matrixWorld),B.uniformsGroups!==void 0){let ve=B.uniformsGroups;for(let ui=0,ji=ve.length;ui<ji;ui++){let Sh=ve[ui];et.update(Sh,_n),et.bind(Sh,_n)}}return _n}function ff(b,N){b.ambientLightColor.needsUpdate=N,b.lightProbe.needsUpdate=N,b.directionalLights.needsUpdate=N,b.directionalLightShadows.needsUpdate=N,b.pointLights.needsUpdate=N,b.pointLightShadows.needsUpdate=N,b.spotLights.needsUpdate=N,b.spotLightShadows.needsUpdate=N,b.rectAreaLights.needsUpdate=N,b.hemisphereLights.needsUpdate=N}function pf(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return W},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return K},this.setRenderTargetTextures=function(b,N,H){let B=V.get(b);B.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,B.__autoAllocateDepthBuffer===!1&&(B.__useRenderToTexture=!1),V.get(b.texture).__webglTexture=N,V.get(b.depthTexture).__webglTexture=B.__autoAllocateDepthBuffer?void 0:H,B.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,N){let H=V.get(b);H.__webglFramebuffer=N,H.__useDefaultFramebuffer=N===void 0},this.setRenderTarget=function(b,N=0,H=0){K=b,W=N,k=H;let B=null,z=!1,yt=!1;if(b){let vt=V.get(b);if(vt.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(L.FRAMEBUFFER,vt.__webglFramebuffer),ot.copy(b.viewport),ct.copy(b.scissor),Gt=b.scissorTest,v.viewport(ot),v.scissor(ct),v.setScissorTest(Gt),Q=-1;return}else if(vt.__webglFramebuffer===void 0)q.setupRenderTarget(b);else if(vt.__hasExternalTextures)q.rebindTextures(b,V.get(b.texture).__webglTexture,V.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Jt=b.depthTexture;if(vt.__boundDepthTexture!==Jt){if(Jt!==null&&V.has(Jt)&&(b.width!==Jt.image.width||b.height!==Jt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(b)}}let Rt=b.texture;(Rt.isData3DTexture||Rt.isDataArrayTexture||Rt.isCompressedArrayTexture)&&(yt=!0);let Lt=V.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(Lt[N])?B=Lt[N][H]:B=Lt[N],z=!0):b.samples>0&&q.useMultisampledRTT(b)===!1?B=V.get(b).__webglMultisampledFramebuffer:Array.isArray(Lt)?B=Lt[H]:B=Lt,ot.copy(b.viewport),ct.copy(b.scissor),Gt=b.scissorTest}else ot.copy(bt).multiplyScalar(tt).floor(),ct.copy(Qt).multiplyScalar(tt).floor(),Gt=Ut;if(H!==0&&(B=G),v.bindFramebuffer(L.FRAMEBUFFER,B)&&v.drawBuffers(b,B),v.viewport(ot),v.scissor(ct),v.setScissorTest(Gt),z){let vt=V.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+N,vt.__webglTexture,H)}else if(yt){let vt=N;for(let Rt=0;Rt<b.textures.length;Rt++){let Lt=V.get(b.textures[Rt]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+Rt,Lt.__webglTexture,H,vt)}}else if(b!==null&&H!==0){let vt=V.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,vt.__webglTexture,H)}Q=-1},this.readRenderTargetPixels=function(b,N,H,B,z,yt,Tt,vt=0){if(!(b&&b.isWebGLRenderTarget)){Ft("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Rt=V.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&Tt!==void 0&&(Rt=Rt[Tt]),Rt){v.bindFramebuffer(L.FRAMEBUFFER,Rt);try{let Lt=b.textures[vt],Jt=Lt.format,ee=Lt.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+vt),!A.textureFormatReadable(Jt)){Ft("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!A.textureTypeReadable(ee)){Ft("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=b.width-B&&H>=0&&H<=b.height-z&&L.readPixels(N,H,B,z,pt.convert(Jt),pt.convert(ee),yt)}finally{let Lt=K!==null?V.get(K).__webglFramebuffer:null;v.bindFramebuffer(L.FRAMEBUFFER,Lt)}}},this.readRenderTargetPixelsAsync=async function(b,N,H,B,z,yt,Tt,vt=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Rt=V.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&Tt!==void 0&&(Rt=Rt[Tt]),Rt)if(N>=0&&N<=b.width-B&&H>=0&&H<=b.height-z){v.bindFramebuffer(L.FRAMEBUFFER,Rt);let Lt=b.textures[vt],Jt=Lt.format,ee=Lt.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+vt),!A.textureFormatReadable(Jt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!A.textureTypeReadable(ee))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Dt=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Dt),L.bufferData(L.PIXEL_PACK_BUFFER,yt.byteLength,L.STREAM_READ),L.readPixels(N,H,B,z,pt.convert(Jt),pt.convert(ee),0);let pe=K!==null?V.get(K).__webglFramebuffer:null;v.bindFramebuffer(L.FRAMEBUFFER,pe);let Re=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Ou(L,Re,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Dt),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,yt),L.deleteBuffer(Dt),L.deleteSync(Re),yt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,N=null,H=0){let B=Math.pow(2,-H),z=Math.floor(b.image.width*B),yt=Math.floor(b.image.height*B),Tt=N!==null?N.x:0,vt=N!==null?N.y:0;q.setTexture2D(b,0),L.copyTexSubImage2D(L.TEXTURE_2D,H,0,0,Tt,vt,z,yt),v.unbindTexture()},this.copyTextureToTexture=function(b,N,H=null,B=null,z=0,yt=0){let Tt,vt,Rt,Lt,Jt,ee,Dt,pe,Re,we=b.isCompressedTexture?b.mipmaps[yt]:b.image;if(H!==null)Tt=H.max.x-H.min.x,vt=H.max.y-H.min.y,Rt=H.isBox3?H.max.z-H.min.z:1,Lt=H.min.x,Jt=H.min.y,ee=H.isBox3?H.min.z:0;else{let Ce=Math.pow(2,-z);Tt=Math.floor(we.width*Ce),vt=Math.floor(we.height*Ce),b.isDataArrayTexture?Rt=we.depth:b.isData3DTexture?Rt=Math.floor(we.depth*Ce):Rt=1,Lt=0,Jt=0,ee=0}B!==null?(Dt=B.x,pe=B.y,Re=B.z):(Dt=0,pe=0,Re=0);let ge=pt.convert(N.format),Xe=pt.convert(N.type),Et;N.isData3DTexture?(q.setTexture3D(N,0),Et=L.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(q.setTexture2DArray(N,0),Et=L.TEXTURE_2D_ARRAY):(q.setTexture2D(N,0),Et=L.TEXTURE_2D),v.activeTexture(L.TEXTURE0),v.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,N.flipY),v.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),v.pixelStorei(L.UNPACK_ALIGNMENT,N.unpackAlignment);let un=v.getParameter(L.UNPACK_ROW_LENGTH),he=v.getParameter(L.UNPACK_IMAGE_HEIGHT),_n=v.getParameter(L.UNPACK_SKIP_PIXELS),Fn=v.getParameter(L.UNPACK_SKIP_ROWS),ci=v.getParameter(L.UNPACK_SKIP_IMAGES);v.pixelStorei(L.UNPACK_ROW_LENGTH,we.width),v.pixelStorei(L.UNPACK_IMAGE_HEIGHT,we.height),v.pixelStorei(L.UNPACK_SKIP_PIXELS,Lt),v.pixelStorei(L.UNPACK_SKIP_ROWS,Jt),v.pixelStorei(L.UNPACK_SKIP_IMAGES,ee);let Qi=b.isDataArrayTexture||b.isData3DTexture,xe=N.isDataArrayTexture||N.isData3DTexture;if(b.isDepthTexture){let Ce=V.get(b),hi=V.get(N),ve=V.get(Ce.__renderTarget),ui=V.get(hi.__renderTarget);v.bindFramebuffer(L.READ_FRAMEBUFFER,ve.__webglFramebuffer),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,ui.__webglFramebuffer);for(let ji=0;ji<Rt;ji++)Qi&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,V.get(b).__webglTexture,z,ee+ji),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,V.get(N).__webglTexture,yt,Re+ji)),L.blitFramebuffer(Lt,Jt,Tt,vt,Dt,pe,Tt,vt,L.DEPTH_BUFFER_BIT,L.NEAREST);v.bindFramebuffer(L.READ_FRAMEBUFFER,null),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(z!==0||b.isRenderTargetTexture||V.has(b)){let Ce=V.get(b),hi=V.get(N);v.bindFramebuffer(L.READ_FRAMEBUFFER,X),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,F);for(let ve=0;ve<Rt;ve++)Qi?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Ce.__webglTexture,z,ee+ve):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Ce.__webglTexture,z),xe?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,hi.__webglTexture,yt,Re+ve):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,hi.__webglTexture,yt),z!==0?L.blitFramebuffer(Lt,Jt,Tt,vt,Dt,pe,Tt,vt,L.COLOR_BUFFER_BIT,L.NEAREST):xe?L.copyTexSubImage3D(Et,yt,Dt,pe,Re+ve,Lt,Jt,Tt,vt):L.copyTexSubImage2D(Et,yt,Dt,pe,Lt,Jt,Tt,vt);v.bindFramebuffer(L.READ_FRAMEBUFFER,null),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else xe?b.isDataTexture||b.isData3DTexture?L.texSubImage3D(Et,yt,Dt,pe,Re,Tt,vt,Rt,ge,Xe,we.data):N.isCompressedArrayTexture?L.compressedTexSubImage3D(Et,yt,Dt,pe,Re,Tt,vt,Rt,ge,we.data):L.texSubImage3D(Et,yt,Dt,pe,Re,Tt,vt,Rt,ge,Xe,we):b.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,yt,Dt,pe,Tt,vt,ge,Xe,we.data):b.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,yt,Dt,pe,we.width,we.height,ge,we.data):L.texSubImage2D(L.TEXTURE_2D,yt,Dt,pe,Tt,vt,ge,Xe,we);v.pixelStorei(L.UNPACK_ROW_LENGTH,un),v.pixelStorei(L.UNPACK_IMAGE_HEIGHT,he),v.pixelStorei(L.UNPACK_SKIP_PIXELS,_n),v.pixelStorei(L.UNPACK_SKIP_ROWS,Fn),v.pixelStorei(L.UNPACK_SKIP_IMAGES,ci),yt===0&&N.generateMipmaps&&L.generateMipmap(Et),v.unbindTexture()},this.initRenderTarget=function(b){V.get(b).__webglFramebuffer===void 0&&q.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?q.setTextureCube(b,0):b.isData3DTexture?q.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?q.setTexture2DArray(b,0):q.setTexture2D(b,0),v.unbindTexture()},this.resetState=function(){W=0,k=0,K=null,v.reset(),Mt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=oe._getDrawingBufferColorSpace(t),e.unpackColorSpace=oe._getUnpackColorSpace()}};var Ji=(i,t,e)=>i<t?t:i>e?e:i,ce=i=>i<0?0:i>1?1:i,Xt=(i,t,e)=>i+(t-i)*e;var bn=(i,t,e)=>{let n=ce((e-i)/(t-i));return n*n*(3-2*n)};var an=(i,t,e,n)=>Xt(i,t,1-Math.exp(-e*n)),ih=i=>1-Math.pow(1-i,3),En=i=>i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2,bd=i=>1+2.70158*Math.pow(i-1,3)+1.70158*Math.pow(i-1,2);function Oe(i=1234){let t=i>>>0;return function(){return t^=t<<13,t>>>=0,t^=t>>17,t^=t<<5,t>>>=0,t/4294967296}}var li=new Uint8Array(512);{let i=Oe(20260819),t=new Uint8Array(256);for(let e=0;e<256;e++)t[e]=e;for(let e=255;e>0;e--){let n=i()*(e+1)|0,s=t[e];t[e]=t[n],t[n]=s}for(let e=0;e<512;e++)li[e]=t[e&255]}var Sd=i=>i*i*i*(i*(i*6-15)+10),cl=(i,t,e)=>{switch(i&7){case 0:return t+e;case 1:return t-e;case 2:return-t+e;case 3:return-t-e;case 4:return t;case 5:return-t;case 6:return e;default:return-e}};function Ed(i,t){let e=Math.floor(i)&255,n=Math.floor(t)&255,s=i-Math.floor(i),r=t-Math.floor(t),o=Sd(s),a=Sd(r),l=li[li[e]+n],c=li[li[e]+n+1],h=li[li[e+1]+n],d=li[li[e+1]+n+1],u=Xt(cl(l,s,r),cl(h,s-1,r),o),f=Xt(cl(c,s,r-1),cl(d,s-1,r-1),o);return Xt(u,f,a)}function Ki(i,t,e){let n=(i%e+e)%e,s=(t%e+e)%e;return Ed(n,s)}function ln(i,t,e=4,n=2,s=.5){let r=.5,o=1,a=0,l=0;for(let c=0;c<e;c++)a+=r*Ed(i*o,t*o),l+=r,r*=s,o*=n;return a/l}function en(i,t){let e=document.createElement("canvas");return e.width=i,e.height=t,e}function nn(i,{repeat:t=1,srgb:e=!0,aniso:n=4}={}){let s=new Wi(i);return s.wrapS=s.wrapT=vi,s.repeat.set(t,t),s.anisotropy=n,e&&(s.colorSpace=De),s.needsUpdate=!0,s}function hl(i=512){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=Oe(9911),o=16;for(let l=0;l<i;l++)for(let c=0;c<i;c++){let h=c/i*o,d=l/i*o,u=0,f=.5,g=1;for(let m=0;m<4;m++)u+=f*Ki(h*g,d*g,o*g),f*=.55,g*=2.1;let _=Ki(h*.35,d*.35,o*.35)*.7+Ki(h*.8,d*.8,o*.8)*.3,p=(l*i+c)*4;s[p]=ce(u*.9+.5)*255,s[p+1]=ce(_*.8+.5)*255,s[p+2]=0,s[p+3]=255}let a=Math.floor(i*i*.0016);for(let l=0;l<a;l++){let c=r()*i|0,h=r()*i|0,d=(h*i+c)*4;s[d+2]=200+r()*55;let u=(h*i+(c+1)%i)*4;s[u+2]=Math.max(s[u+2],90)}return e.putImageData(n,0,0),nn(t,{srgb:!1,repeat:1})}function Td(i=512){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=10;for(let a=0;a<i;a++)for(let l=0;l<i;l++){let c=l/i*r,h=a/i*r,d=0,u=.5,f=1;for(let y=0;y<5;y++)d+=u*Ki(c*f,h*f,r*f),u*=.55,f*=2;let g=Math.abs(Ki(c*3.1,h*3.1,r*3.1)),_=ce(d*.8+.5),p=Xt(74,164,_)+g*28,m=Xt(55,122,_)+g*21,M=Xt(41,88,_)+g*14,S=(a*i+l)*4;s[S]=p,s[S+1]=m,s[S+2]=M,s[S+3]=255}e.putImageData(n,0,0);let o=Oe(4242);for(let a=0;a<i*.9;a++){let l=o()*i,c=o()*i,h=1+o()*3.2,d=70+o()*60;e.fillStyle=`rgba(${d},${d*.94},${d*.86},${.35+o()*.4})`,e.beginPath(),e.ellipse(l,c,h,h*(.6+o()*.5),o()*6.28,0,6.28),e.fill()}for(let a=0;a<i*.18;a++){let l=o()*i,c=o()*i,h=o()*6.28,d=5+o()*22;e.strokeStyle=`rgba(${120+o()*50},${100+o()*40},${60+o()*30},${.2+o()*.35})`,e.lineWidth=.7+o()*1.1,e.beginPath(),e.moveTo(l,c),e.lineTo(l+Math.cos(h)*d,c+Math.sin(h)*d),e.stroke()}return nn(t,{repeat:1})}function wd(i=256){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=10;for(let o=0;o<i;o++)for(let a=0;a<i;a++){let l=a/i*r,c=o/i*r,h=0,d=.5,u=1;for(let _=0;_<4;_++)h+=d*Ki(l*u,c*u,r*u),d*=.5,u*=2.3;let f=ce(h+.5)*255,g=(o*i+a)*4;s[g]=s[g+1]=s[g+2]=f,s[g+3]=255}return e.putImageData(n,0,0),nn(t,{srgb:!1})}function Ad(i=256,t=512){let e=en(i,t),n=e.getContext("2d"),s=Oe(777),r=n.createLinearGradient(0,0,0,t);r.addColorStop(0,"#6f9138"),r.addColorStop(.04,"#d4641a"),r.addColorStop(.11,"#fb7207"),r.addColorStop(.4,"#ff8b06"),r.addColorStop(.72,"#fd7a0a"),r.addColorStop(.92,"#f4801d"),r.addColorStop(1,"#ea8b33"),n.fillStyle=r,n.fillRect(0,0,i,t);let o=n.createLinearGradient(0,0,i,0);o.addColorStop(0,"rgba(96,42,8,0.34)"),o.addColorStop(.22,"rgba(255,230,196,0.18)"),o.addColorStop(.5,"rgba(126,58,12,0.07)"),o.addColorStop(.78,"rgba(255,230,196,0.16)"),o.addColorStop(1,"rgba(96,42,8,0.34)"),n.fillStyle=o,n.fillRect(0,0,i,t),n.globalAlpha=.1;for(let a=0;a<i*1.6;a++){let l=s()*i;n.strokeStyle=s()>.5?"#ffd9a0":"#b4560c",n.lineWidth=.6+s()*1,n.beginPath(),n.moveTo(l,s()*t*.2),n.lineTo(l+(s()-.5)*8,t),n.stroke()}n.globalAlpha=1;for(let a=t*.045;a<t;){let l=.1+s()*.16;n.strokeStyle=`rgba(150,70,12,${l})`,n.lineWidth=.8+s()*1.4,n.beginPath();for(let c=0;c<=i;c+=8){let h=a+Math.sin(c/i*Math.PI*2+a)*1.6;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke(),n.strokeStyle=`rgba(255,214,160,${l*.55})`,n.beginPath();for(let c=0;c<=i;c+=8){let h=a+1.8+Math.sin(c/i*Math.PI*2+a)*1.6;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke(),a+=9+s()*12*(1-a/t)+3}for(let a=0;a<220;a++){let l=s()*i,c=t*.06+s()*t*.9,h=.9+s()*1.8;n.fillStyle=`rgba(140,66,12,${.25+s()*.4})`,n.beginPath(),n.ellipse(l,c,h*1.5,h*.7,0,0,6.28),n.fill()}n.strokeStyle="rgba(160,90,30,0.35)";for(let a=0;a<40;a++){let l=s()*i,c=t*(.55+s()*.45);n.lineWidth=.6,n.beginPath(),n.moveTo(l,c),n.lineTo(l+(s()-.5)*14,c+3+s()*8),n.stroke()}return nn(e,{repeat:1})}function Rd(i=256,t=512){let e=en(i,t),n=e.getContext("2d"),s=Oe(31337);n.clearRect(0,0,i,t);for(let r=0;r<260;r++){let o=Math.pow(s(),.6)*t,a=s()*i,l=.25+.75*(o/t),c=(6+s()*34)*l,h=n.createRadialGradient(a,o,0,a,o,c),d=(.1+s()*.5)*l;h.addColorStop(0,`rgba(74,52,33,${d})`),h.addColorStop(.6,`rgba(62,43,28,${d*.6})`),h.addColorStop(1,"rgba(60,42,27,0)"),n.fillStyle=h,n.beginPath(),n.ellipse(a,o,c,c*(.5+s()*.6),s()*6.28,0,6.28),n.fill()}for(let r=0;r<500;r++){let o=Math.pow(s(),.5)*t,a=s()*i;n.fillStyle=`rgba(${50+s()*40},${36+s()*26},${24+s()*18},${.3+s()*.5})`,n.beginPath(),n.arc(a,o,.6+s()*2.2,0,6.28),n.fill()}return nn(e,{repeat:1})}function ul(i=256,t=5){let e=i,n=i*2,s=en(e,n),r=s.getContext("2d"),o=Oe(t*7919+13);r.clearRect(0,0,e,n);let a=e*.5,l=n*.06,c=f=>{let g=Xt(38,122,f),_=Xt(84,190,f),p=Xt(26,78,f);return`rgb(${g|0},${_|0},${p|0})`};function h(f,g,_,p,m,M){r.save(),r.translate(f,g),r.rotate(p),r.fillStyle=c(M),r.beginPath(),r.moveTo(0,0),r.bezierCurveTo(m,-_*.28,m*.75,-_*.78,0,-_),r.bezierCurveTo(-m*.75,-_*.78,-m,-_*.28,0,0),r.fill(),r.strokeStyle=c(M*.5),r.lineWidth=.9,r.beginPath(),r.moveTo(0,0),r.lineTo(0,-_*.9),r.stroke(),r.restore()}function d(f,g,_,p,m){let S=f+_*p*.8,y=g-p*.72;r.strokeStyle=c(m*.75),r.lineWidth=2.1,r.beginPath(),r.moveTo(f,g),r.quadraticCurveTo(f+_*p*.5,g-p*.34,S,y),r.stroke();for(let w=1;w<=8;w++){let E=w/8,C=Xt(f,S,E)+_*Math.sin(E*2.4)*3,x=Xt(g,y,E),T=p*(.56-.26*E)+6,P=m*(.88+o()*.24);h(C,x,T,_*(1.05-E*.42)+(o()-.5)*.22,T*.34,P),h(C,x,T*.86,-_*(.3+E*.36)+(o()-.5)*.2,T*.3,P*.86),h(C,x,T*.7,_*(.15+E*.2),T*.26,P*1.04)}}r.lineCap="round",r.strokeStyle=c(.5),r.lineWidth=5.4,r.beginPath(),r.moveTo(a,n),r.quadraticCurveTo(a+(o()-.5)*16,n*.5,a,l),r.stroke(),r.strokeStyle=c(.82),r.lineWidth=1.8,r.beginPath(),r.moveTo(a-1.1,n),r.quadraticCurveTo(a+(o()-.5)*14,n*.5,a-1.1,l),r.stroke();let u=8;for(let f=0;f<u;f++){let g=f/(u-1),_=Xt(n*.8,l+16,g),p=Xt(e*.5,e*.24,g)*(.9+o()*.24),m=.4+g*.42+o()*.12;d(a,_,1,p,m),d(a,_-p*.07,-1,p*(.92+o()*.16),m*.95)}return d(a,l+8,1,e*.2,.92),d(a,l+8,-1,e*.2,.9),nn(s,{repeat:1})}function Cd(i=512,t={}){let{planks:e=5,base:n=[150,116,78],vertical:s=!1}=t,r=en(i,i),o=r.getContext("2d"),a=Oe(1717);o.fillStyle=`rgb(${n[0]},${n[1]},${n[2]})`,o.fillRect(0,0,i,i);let l=o.getImageData(0,0,i,i),c=l.data;for(let h=0;h<i;h++)for(let d=0;d<i;d++){let u=s?h/i:d/i,f=s?d/i:h/i,g=ln(u*26,f*2.2,4)*.5+ln(u*90,f*5,2)*.25,_=Math.sin((f*7+g*5)*Math.PI*2)*.5+.5,p=.72+g*.45+_*.14,m=(h*i+d)*4;c[m]=ce(c[m]*p/255)*255,c[m+1]=ce(c[m+1]*p/255)*255,c[m+2]=ce(c[m+2]*p/255)*255}o.putImageData(l,0,0),o.globalAlpha=1;for(let h=1;h<e;h++){let d=h/e*i;o.fillStyle="rgba(40,26,14,0.55)",s?o.fillRect(d-1.5,0,3,i):o.fillRect(0,d-1.5,i,3),o.fillStyle="rgba(255,240,215,0.10)",s?o.fillRect(d+1.5,0,2,i):o.fillRect(0,d+1.5,i,2)}for(let h=0;h<24;h++){let d=a()*i,u=a()*i;o.fillStyle="rgba(60,48,38,0.5)",o.beginPath(),o.arc(d,u,2.2,0,6.28),o.fill(),o.fillStyle="rgba(220,210,195,0.25)",o.beginPath(),o.arc(d-.6,u-.6,1.1,0,6.28),o.fill()}return nn(r,{repeat:1})}function Pd(i=512,t=512){let e=en(i,t),n=e.getContext("2d"),s=n.createLinearGradient(0,0,0,t);s.addColorStop(0,"#2a6cbd"),s.addColorStop(.28,"#5f9bd9"),s.addColorStop(.52,"#9cc4e9"),s.addColorStop(.7,"#c9dcee"),s.addColorStop(.84,"#e4e8ea"),s.addColorStop(1,"#dfe2e2"),n.fillStyle=s,n.fillRect(0,0,i,t);let r=n.getImageData(0,0,i,t),o=r.data;for(let a=0;a<t;a++){let l=bn(.05,.35,a/t)*(1-bn(.6,.95,a/t));for(let c=0;c<i;c++){let h=ln(c/i*7,a/t*13,5),d=ce((h*.5+.5-.42)*2.6)*l,u=(a*i+c)*4;o[u]=Xt(o[u],252,d*.75),o[u+1]=Xt(o[u+1],250,d*.75),o[u+2]=Xt(o[u+2],246,d*.7)}}return n.putImageData(r,0,0),nn(e,{repeat:1})}function Id(i=64){let t=en(i,i),e=t.getContext("2d"),n=e.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);return n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.35,"rgba(255,255,255,0.75)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,i,i),nn(t,{repeat:1})}function sh(i=64,t=[255,255,255]){let e=en(i,i),n=e.getContext("2d"),s=n.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);return s.addColorStop(0,`rgba(${t[0]},${t[1]},${t[2]},1)`),s.addColorStop(.5,`rgba(${t[0]},${t[1]},${t[2]},0.45)`),s.addColorStop(1,`rgba(${t[0]},${t[1]},${t[2]},0)`),n.fillStyle=s,n.fillRect(0,0,i,i),nn(e,{repeat:1})}function dl(i=128){let t=en(i,i),e=t.getContext("2d"),n=i/2,s=e.createRadialGradient(n,n,0,n,n,n*.34);s.addColorStop(0,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=s,e.fillRect(0,0,i,i),e.strokeStyle="rgba(255,255,255,0.9)",e.lineCap="round";for(let r=0;r<4;r++){let o=r/4*Math.PI,a=r%2===0?n*.92:n*.5,l=e.createLinearGradient(n-Math.cos(o)*a,n-Math.sin(o)*a,n+Math.cos(o)*a,n+Math.sin(o)*a);l.addColorStop(0,"rgba(255,255,255,0)"),l.addColorStop(.5,"rgba(255,255,255,0.95)"),l.addColorStop(1,"rgba(255,255,255,0)"),e.strokeStyle=l,e.lineWidth=r%2===0?3.5:2,e.beginPath(),e.moveTo(n-Math.cos(o)*a,n-Math.sin(o)*a),e.lineTo(n+Math.cos(o)*a,n+Math.sin(o)*a),e.stroke()}return nn(t,{repeat:1})}function Ld(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/256;e.translate(i*.46,i*.3),e.scale(n*.92,n*.92),e.lineJoin="round",e.lineCap="round";let s=new Path2D;s.moveTo(-16,-66),s.quadraticCurveTo(-16,-82,-2,-82),s.quadraticCurveTo(12,-82,12,-66),s.lineTo(12,-18),s.quadraticCurveTo(20,-26,28,-22),s.quadraticCurveTo(34,-19,33,-8),s.quadraticCurveTo(41,-12,47,-6),s.quadraticCurveTo(51,-2,49,8),s.quadraticCurveTo(56,4,60,12),s.quadraticCurveTo(63,19,58,30),s.quadraticCurveTo(48,62,20,70),s.quadraticCurveTo(-10,77,-32,58),s.quadraticCurveTo(-48,42,-58,18),s.quadraticCurveTo(-64,5,-54,-2),s.quadraticCurveTo(-44,-8,-34,6),s.lineTo(-16,26),s.closePath(),e.shadowColor="rgba(22,46,80,0.42)",e.shadowBlur=16,e.shadowOffsetY=6,e.fillStyle="rgba(255,255,255,0.97)",e.fill(s),e.shadowColor="transparent",e.strokeStyle="rgba(58,96,142,0.9)",e.lineWidth=6,e.stroke(s),e.strokeStyle="rgba(58,96,142,0.55)",e.lineWidth=3.4;for(let[r,o]of[[24,-14],[40,2],[50,18]])e.beginPath(),e.moveTo(r,o),e.quadraticCurveTo(r-12,o+6,r-20,o+4),e.stroke();return nn(t,{repeat:1})}function Dd(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/256;e.translate(i/2,i/2),e.scale(n,n);let s=new Path2D;return s.moveTo(0,-92),s.lineTo(66,-14),s.lineTo(28,-14),s.lineTo(28,88),s.lineTo(-28,88),s.lineTo(-28,-14),s.lineTo(-66,-14),s.closePath(),e.shadowColor="rgba(20,40,70,0.4)",e.shadowBlur=16,e.fillStyle="rgba(255,255,255,0.96)",e.fill(s),e.shadowColor="transparent",e.strokeStyle="rgba(70,120,180,0.9)",e.lineWidth=6,e.lineJoin="round",e.stroke(s),nn(t,{repeat:1})}function Ud(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/2,s=e.createRadialGradient(n,n,n*.3,n,n,n*.5);return s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.55,"rgba(255,246,225,0.85)"),s.addColorStop(.8,"rgba(255,214,150,0.55)"),s.addColorStop(1,"rgba(255,200,120,0)"),e.fillStyle=s,e.fillRect(0,0,i,i),nn(t,{repeat:1})}function Nd(i=128){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data;for(let r=0;r<i;r++)for(let o=0;o<i;o++){let l=.55+ln(o/i*4,r/i*30,4)*.6,c=(r*i+o)*4;s[c]=92*l,s[c+1]=78*l,s[c+2]=68*l,s[c+3]=255}return e.putImageData(n,0,0),nn(t,{repeat:1})}var Ge=2.2,We=3,Vs=.34,Ae=132,He=180,Fd=112,Od=152,Bs=-Ge/2,zs=-We/2,d_=.006,Ci=.05;function Dn(i,t){return .048*Math.cos(i*12.566)+.014*Math.sin(t*1.9+.7)+.01*Math.sin(t*4.7+i*2.6+2.1)+.006*Math.sin(t*9.7-i*6.3+.4)+.003*Math.sin(t*19+i*17)}var rh=2*Math.PI/12.566;function oh(i,t,e=1){let n=.5-.5*Math.cos(i*12.566),s=.5+e*n*.17+e*ln(i*1.1,t*1.1,4)*.1+e*ln(i*3.7,t*3.7,3)*.045;return Vs*ce(s)}var f_=`
float soilH(vec2 p){
  return 0.048 * cos(p.x * 12.566)
       + 0.014 * sin(p.y * 1.9 + 0.7)
       + 0.010 * sin(p.y * 4.7 + p.x * 2.6 + 2.1)
       + 0.006 * sin(p.y * 9.7 - p.x * 6.3 + 0.4)
       + 0.003 * sin(p.y * 19.0 + p.x * 17.0);
}
`;function Bd(i,t){return Math.max(Math.max(Math.abs(i)-Ge/2,0),Math.max(Math.abs(t)-We/2,0))*.6}var fl=class{constructor(t){this.data=new Uint8Array(Ae*He*4),this.snow=new Float32Array(Ae*He),this.loose=new Float32Array(Ae*He),this.scuff=new Float32Array(Ae*He),this.dirty=!0,this.removedSinceLast=0,this.tex=new Hi(this.data,Ae,He,on),this.tex.magFilter=Ie,this.tex.minFilter=Ie,this.tex.wrapS=this.tex.wrapT=Mn,this.tex.needsUpdate=!0;let e=t.capabilities.getMaxAnisotropy();this.grain=hl(512),this.grain.anisotropy=Math.min(8,e),this.soilMap=Td(512),this.soilMap.anisotropy=Math.min(8,e),this.soilBump=wd(256),this.uniforms={uField:{value:this.tex},uOrigin:{value:new it(Bs,zs)},uSize:{value:new it(Ge,We)},uMaxSnow:{value:Vs},uGrain:{value:this.grain},uCut:{value:d_},uTime:{value:0}},this.reset(!0),this.group=new Se,this.buildSoil(),this.buildSnow()}computeTarget(t=[]){this.targetSnow||(this.targetSnow=new Float32Array(Ae*He));for(let e=0;e<He;e++)for(let n=0;n<Ae;n++){let s=e*Ae+n,r=Bs+(n+.5)/Ae*Ge,o=zs+(e+.5)/He*We,a=oh(r,o)/Vs;for(let l of t){let c=Math.hypot(r-l.x,o-l.z);a+=.045*Math.exp(-(c*c)/(2*.15*.15));let h=Math.round(c/l.bin);if(h<l.prof.length){let u=(l.baseY+l.prof[h]+l.margin-Dn(r,o))/Vs;u>a&&(a=u)}}this.targetSnow[s]=ce(a)}}reset(t=!1,e=[]){this.computeTarget(e),this.snow.set(this.targetSnow),this.loose.fill(0),this.scuff.fill(0),this.regrowing=!1,this.dirty=!0,this.sync()}startRegrow(t=[]){this.computeTarget(t),this.regrowing=!0}sync(){let t=this.data;for(let e=0,n=0;e<Ae*He;e++,n+=4)t[n]=this.snow[e]*255,t[n+1]=this.loose[e]*255,t[n+2]=this.scuff[e]*255,t[n+3]=255;this.tex.needsUpdate=!0,this.dirty=!1}worldToTexel(t,e){return[(t-Bs)/Ge*Ae-.5,(e-zs)/We*He-.5]}brush(t,e,n,s){let[r,o]=this.worldToTexel(t,e),a=n/Ge*Ae,l=n/We*He,c=Math.max(0,Math.floor(r-a*1.8)),h=Math.min(Ae-1,Math.ceil(r+a*1.8)),d=Math.max(0,Math.floor(o-l*1.8)),u=Math.min(He-1,Math.ceil(o+l*1.8)),f=0,g=[];for(let _=d;_<=u;_++)for(let p=c;p<=h;p++){let m=(p-r)/a,M=(_-o)/l,S=Math.sqrt(m*m+M*M),y=_*Ae+p;if(S<1){let w=Math.pow(Math.cos(S*Math.PI*.5),.85),E=Math.min(this.snow[y],s*w);E>0&&(this.snow[y]-=E,f+=E),this.scuff[y]=Math.min(1,this.scuff[y]+s*w*2.2)}else S<1.75&&g.push(y)}if(f>0&&g.length){let _=f*.3/g.length;for(let p of g)this.snow[p]=Math.min(1.25,this.snow[p]+_)}return f>0&&(this.dirty=!0,this.removedSinceLast+=f),f}scrub(t,e,n,s){let[r,o]=this.worldToTexel(t,e),a=n/Ge*Ae,l=n/We*He,c=Math.max(0,Math.floor(r-a)),h=Math.min(Ae-1,Math.ceil(r+a)),d=Math.max(0,Math.floor(o-l)),u=Math.min(He-1,Math.ceil(o+l));for(let f=d;f<=u;f++)for(let g=c;g<=h;g++){let _=(g-r)/a,p=(f-o)/l,m=_*_+p*p;if(m<1){let M=f*Ae+g,S=1-m;this.loose[M]=Math.min(1,this.loose[M]+s*S*3)}}this.dirty=!0}snowAround(t,e,n){let[s,r]=this.worldToTexel(t,e),o=n/Ge*Ae,a=n/We*He,l=Math.max(0,Math.floor(s-o)),c=Math.min(Ae-1,Math.ceil(s+o)),h=Math.max(0,Math.floor(r-a)),d=Math.min(He-1,Math.ceil(r+a)),u=0,f=0;for(let g=h;g<=d;g++)for(let _=l;_<=c;_++){let p=(_-s)/o,m=(g-r)/a;p*p+m*m<1&&(u+=this.snow[g*Ae+_],f++)}return f?u/f*Vs:0}snowAt(t,e){let[n,s]=this.worldToTexel(t,e),r=Ji(Math.round(n),0,Ae-1),o=Ji(Math.round(s),0,He-1);return this.snow[o*Ae+r]*Vs}surfaceY(t,e){return Dn(t,e)+this.snowAt(t,e)}inside(t,e){return t>Bs&&t<Bs+Ge&&e>zs&&e<zs+We}buildSoil(){let t=new Wn(Ge+Ci*2,We+Ci*2,(Fd>>1)+2,(Od>>1)+2);t.rotateX(-Math.PI/2);let e=t.attributes.position;for(let a=0;a<e.count;a++){let l=e.getX(a),c=e.getZ(a);e.setY(a,Dn(l,c)-Bd(l,c))}t.computeVertexNormals();let n=this.soilMap.clone();n.repeat.set(Ge/.18,We/.18),n.needsUpdate=!0;let s=this.soilBump.clone();s.repeat.copy(n.repeat),s.needsUpdate=!0;let r=new ne({map:n,bumpMap:s,bumpScale:.85,roughness:.94,metalness:0,color:16777215});r.customProgramCacheKey=()=>"bedsoil",r.onBeforeCompile=a=>{Object.assign(a.uniforms,this.uniforms),a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vWPos;`).replace("#include <fog_vertex>",`#include <fog_vertex>
  vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`
          #include <common>
          varying vec3 vWPos;
          uniform sampler2D uField;
          uniform vec2 uOrigin;
          uniform vec2 uSize;
          uniform float uMaxSnow;
        `).replace("#include <map_fragment>",`
          #include <map_fragment>
          vec2 fuv = (vWPos.xz - uOrigin) / uSize;
          vec4 fld = texture2D(uField, clamp(fuv, 0.002, 0.998));
          // a narrow contact shade where the snow wall still stands over the soil
          float occ = 0.0;
          occ += texture2D(uField, clamp(fuv + vec2( 0.006, 0.0), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2(-0.006, 0.0), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2( 0.0, 0.0045), 0.002, 0.998)).r;
          occ += texture2D(uField, clamp(fuv + vec2( 0.0,-0.0045), 0.002, 0.998)).r;
          occ = clamp(occ * 0.25, 0.0, 1.0);
          float shade = 1.0 - smoothstep(0.05, 0.75, occ) * 0.38;
          // freshly uncovered earth is damp: darker, cooler, glossier
          float wet = clamp(fld.b * 0.6 + fld.g * 0.8, 0.0, 1.0);
          vec3 damp = diffuseColor.rgb * vec3(0.70, 0.66, 0.66);
          diffuseColor.rgb = mix(diffuseColor.rgb, damp, wet * 0.75);
          diffuseColor.rgb *= shade;
          // a dusting of snow grains left behind in the hollows
          float dust = (1.0 - fld.b) * smoothstep(0.0, 0.10, fld.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82,0.85,0.90), dust * 0.30);
        `).replace("#include <roughnessmap_fragment>",`
          #include <roughnessmap_fragment>
          roughnessFactor *= mix(1.0, 0.55, clamp(fld.b * 0.6 + fld.g * 0.8, 0.0, 1.0));
        `)},this.soilMat=r;let o=new zt(t,r);o.receiveShadow=!0,o.name="soil",this.soilMesh=o,this.group.add(o),this.buildSkirt(n,s)}buildSkirt(t,e){let r=Bs-Ci,o=zs-Ci,a=Ge+Ci*2,l=We+Ci*2,c=[],h=[],d=[],u=[];for(let _=0;_<=40;_++)u.push([r+_/40*a,o]);for(let _=1;_<=40;_++)u.push([r+a,o+_/40*l]);for(let _=1;_<=40;_++)u.push([r+a-_/40*a,o+l]);for(let _=1;_<=40;_++)u.push([r,o+l-_/40*l]);for(let _=0;_<u.length;_++){let[p,m]=u[_],M=Dn(p,m)-Bd(p,m)+.02;c.push(p,M,m,p,-.42,m);let S=_/40;h.push(S,1,S,0)}for(let _=0;_<u.length-1;_++){let p=_*2,m=p+1,M=p+2,S=p+3;d.push(p,m,M,m,S,M)}let f=new de;f.setAttribute("position",new qt(c,3)),f.setAttribute("uv",new qt(h,2)),f.setIndex(d),f.computeVertexNormals();let g=new zt(f,new ne({map:t,bumpMap:e,bumpScale:.4,color:9407106,roughness:.95,metalness:0,side:$e}));g.name="bedSkirt",this.group.add(g)}buildSnow(){let t=new Wn(Ge+Ci*2,We+Ci*2,Fd+6,Od+6);t.rotateX(-Math.PI/2);let e=this.grain.clone();e.repeat.set(Ge/.42,We/.42),e.needsUpdate=!0;let n=this.grain.clone();n.repeat.set(Ge/.05,We/.05),n.needsUpdate=!0;let s=new ne({color:16120061,roughness:.6,metalness:0,bumpMap:n,bumpScale:.32});s.customProgramCacheKey=()=>"snowfield",s.onBeforeCompile=o=>{Object.assign(o.uniforms,this.uniforms),o.uniforms.uGrainMap={value:e},o.vertexShader=o.vertexShader.replace("#include <common>",`
          #include <common>
          uniform sampler2D uField;
          uniform vec2 uOrigin;
          uniform vec2 uSize;
          uniform float uMaxSnow;
          varying float vDepth;
          varying vec3 vWPos;
          varying float vScuff;
          varying vec3 vWN;
          ${f_}
          float snowAt(vec2 p){
            vec2 uvv = clamp((p - uOrigin) / uSize, 0.002, 0.998);
            return texture2D(uField, uvv).r * uMaxSnow;
          }
          float surfH(vec2 p){ return soilH(p) + snowAt(p); }
        `).replace("#include <beginnormal_vertex>",`
          vec2 wp2 = position.xz;
          float e = 0.022;
          float hL = surfH(wp2 - vec2(e,0.0));
          float hR = surfH(wp2 + vec2(e,0.0));
          float hD = surfH(wp2 - vec2(0.0,e));
          float hU = surfH(wp2 + vec2(0.0,e));
          vec3 objectNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
          vWN = objectNormal;
        `).replace("#include <begin_vertex>",`
          vec2 fuv = clamp((wp2 - uOrigin) / uSize, 0.002, 0.998);
          vec4 fld = texture2D(uField, fuv);
          vDepth = fld.r * uMaxSnow;
          vScuff = fld.b;
          // outside the bed proper the surface tucks just under the field mesh
          float rim = max(max(abs(wp2.x) - uSize.x * 0.5, 0.0),
                          max(abs(wp2.y) - uSize.y * 0.5, 0.0));
          vec3 transformed = vec3(position.x, soilH(wp2) + vDepth - rim * 0.6, position.z);
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `),o.fragmentShader=o.fragmentShader.replace("#include <common>",`
          #include <common>
          varying float vDepth;
          varying float vScuff;
          varying vec3 vWPos;
          varying vec3 vWN;
          uniform sampler2D uGrainMap;
          uniform float uCut;
        `).replace("#include <map_fragment>",`
          #include <map_fragment>
          vec2 guv = vWPos.xz / 0.42;
          // the grain map is projected straight down, so fade it out on the
          // steep cut faces of the hollow where it would smear into streaks
          float flatness = smoothstep(0.35, 0.88, vWN.y);
          vec4 grn = texture2D(uGrainMap, guv);
          vec4 grn2 = texture2D(uGrainMap, guv * 4.7 + 0.31);
          // granular edge: the last few millimetres crumble away as specks
          float edgeN = grn2.r * 0.7 + grn.r * 0.3;
          if (vDepth < uCut + edgeN * 0.011) discard;
          float thin = smoothstep(0.10, 0.006, vDepth);
          // packed snow in the drifts, softer powder where untouched
          vec3 snowLit = vec3(0.98, 0.988, 1.0);
          vec3 snowShade = vec3(0.80, 0.855, 0.95);
          float tone = (grn.g * 0.22 + grn2.r * 0.16) * flatness + vScuff * 0.14;
          diffuseColor.rgb *= mix(snowLit, snowShade, clamp(tone, 0.0, 1.0));
          // same faint row banding the surrounding field carries, so the bed
          // is indistinguishable from the rest of the snow until it is dug
          float row = 0.5 + 0.5 * cos(vWPos.x * 12.566);
          diffuseColor.rgb *= mix(0.925, 1.0, row);
          // light bleeding through where the layer is thin: warms toward soil
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.60, 0.55), thin * 0.55);
        `).replace("#include <roughnessmap_fragment>",`
          #include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.34, clamp(vScuff, 0.0, 1.0) * 0.5);
        `).replace("#include <emissivemap_fragment>",`
          #include <emissivemap_fragment>
          // ice crystals catching the low winter sun
          vec3 V = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normalize(normal), V), 0.0, 1.0), 2.0);
          float spark = smoothstep(0.55, 0.95, texture2D(uGrainMap, guv * 8.3).b);
          spark *= smoothstep(0.62, 0.98, texture2D(uGrainMap, guv * 3.1 + 0.7).b + 0.25);
          spark *= flatness;
          totalEmissiveRadiance += vec3(1.0, 0.99, 0.95) * spark * (0.35 + fres * 1.5);
        `)},this.snowMat=s;let r=new zt(t,s);r.receiveShadow=!0,r.frustumCulled=!1,r.name="snow",this.snowMesh=r,this.group.add(r)}update(t){if(this.uniforms.uTime.value+=t,this.regrowing){let e=1-Math.exp(-1.35*t),n=0;for(let s=0;s<this.snow.length;s++){let r=this.targetSnow[s]-this.snow[s];this.snow[s]+=r*e,Math.abs(r)>n&&(n=Math.abs(r)),this.loose[s]*=1-e,this.scuff[s]*=1-e}this.dirty=!0,n<.004&&(this.snow.set(this.targetSnow),this.loose.fill(0),this.scuff.fill(0),this.regrowing=!1)}this.dirty&&this.sync()}};function Vd(i,t=!1){let e=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},o={},a=i[0].morphTargetsRelative,l=new de,c=0;for(let h=0;h<i.length;++h){let d=i[h],u=0;if(e!==(d.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let f in d.attributes){if(!n.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+f+'" attribute exists among all geometries, or in none of them.'),null;r[f]===void 0&&(r[f]=[]),r[f].push(d.attributes[f]),u++}if(u!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==d.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let f in d.morphAttributes){if(!s.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[f]===void 0&&(o[f]=[]),o[f].push(d.morphAttributes[f])}if(t){let f;if(e)f=d.index.count;else if(d.attributes.position!==void 0)f=d.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,f,h),c+=f}}if(e){let h=0,d=[];for(let u=0;u<i.length;++u){let f=i[u].index;for(let g=0;g<f.count;++g)d.push(f.getX(g)+h);h+=i[u].attributes.position.count}l.setIndex(d)}for(let h in r){let d=zd(r[h]);if(!d)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,d)}for(let h in o){let d=o[h][0].length;if(d!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let u=0;u<d;++u){let f=[];for(let _=0;_<o[h].length;++_)f.push(o[h][_][u]);let g=zd(f);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(g)}}}return l}function zd(i){let t,e,n,s=-1,r=0;for(let c=0;c<i.length;++c){let h=i[c];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=h.gpuType),s!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*e}let o=new t(r),a=new ye(o,e,n),l=0;for(let c=0;c<i.length;++c){let h=i[c];if(h.isInterleavedBufferAttribute){let d=l/e;for(let u=0,f=h.count;u<f;u++)for(let g=0;g<e;g++){let _=h.getComponent(u,g);a.setComponent(u+d,g,_)}}else o.set(h.array,l);l+=h.count*e}return s!==void 0&&(a.gpuType=s),a}function cn(i,t){let e=Math.hypot(i,t),n=1-bn(3.4,5,e),s=1-bn(60,130,e),r=ln(i*.045,t*.045,3)*.85+ln(i*.16,t*.16,2)*.15;return Dn(i,t)*n+oh(i,t,n)+r*bn(3.2,18,e)*s-p_(i,t)}var kd=(()=>{let i=[];for(let t=0;t<9;t++){let e=t/8,n=Xt(3.1,1.72,e)+(t%2?.1:-.1),s=Xt(3.4,.98,e);i.push([n,s,Math.atan2(-1.38,-2.42)])}return i})();function p_(i,t){let e=0;for(let n=0;n<kd.length;n++){let s=kd[n],r=i-s[0],o=t-s[1],a=Math.cos(s[2]),l=Math.sin(s[2]),c=(r*a+o*l)/.155,h=(-r*l+o*a)/.085,d=c*c+h*h;d<4&&(e+=.075*Math.exp(-d*1.5))}return e}function Hd(i,t,e,n){let s=Math.max(4,Math.round(i*2/n)),r=Math.max(2,Math.round((t-i)/n)),o=[];for(let d=1;d<=r;d++)o.push(i+(t-i)*d/r);let a=26,l=Math.pow(e/t,1/a),c=t;for(let d=0;d<a;d++)c*=l,o.push(Math.min(c,e));let h=[];for(let d=o.length-1;d>=0;d--)h.push(-o[d]);for(let d=0;d<=s;d++)h.push(-i+2*i*d/s);for(let d of o)h.push(d);return h}function m_(i,t,e){let n=e.w/2,s=e.d/2,r=5.6/Math.max(40,t*.62),o=Hd(n,5,i,r),a=Hd(s,5,i,r),l=[],c=[],h=[],d=[],u=[],f=.02;for(let p=0;p<a.length;p++)for(let m=0;m<o.length;m++){let M=o[m],S=a[p],y=Math.max(Math.abs(M)-n,Math.abs(S)-s),w=y<.075?.015*(1-Math.max(0,y)/.075):0;l.push(M,cn(M,S)-w,S),c.push(M,S);let E=cn(M+f,S)-cn(M-f,S),C=cn(M,S+f)-cn(M,S-f),x=1/Math.hypot(E,2*f,C);d.push(-E*x,2*f*x,-C*x),h.push(.97,.99,1)}let g=o.length;for(let p=0;p<a.length-1;p++)for(let m=0;m<o.length-1;m++){if(o[m]>=-n-1e-6&&o[m+1]<=n+1e-6&&a[p]>=-s-1e-6&&a[p+1]<=s+1e-6)continue;let M=p*g+m,S=M+1,y=M+g,w=y+1;u.push(M,y,S,S,y,w)}let _=new de;return _.setAttribute("position",new qt(l,3)),_.setAttribute("uv",new qt(c,2)),_.setAttribute("color",new qt(h,3)),_.setAttribute("normal",new qt(d,3)),_.setIndex(u),_}function g_(i=256){let t=document.createElement("canvas");t.width=t.height=i;let e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data;for(let o=0;o<i;o++)for(let a=0;a<i;a++){let l=a/i,c=Math.cos(l*Math.PI*2)*.5+.5,h=ln(a/i*5,o/i*5,3)*.5+.5,d=.925+c*.075+h*.03,u=(o*i+a)*4;s[u]=244*d*(.985+c*.02),s[u+1]=248*d,s[u+2]=255*d,s[u+3]=255}e.putImageData(n,0,0);let r=new Wi(t);return r.wrapS=r.wrapT=vi,r.colorSpace=De,r}function pl(i){let t=new Map;for(let{geometry:n,matrix:s,material:r}of i){let o=n.clone();o.applyMatrix4(s),t.has(r)||t.set(r,[]),t.get(r).push(o)}let e=new Se;for(let[n,s]of t){let r=Vd(s,!1);if(s.forEach(a=>a.dispose()),!r)continue;let o=new zt(r,n);e.add(o)}return e}function x_(i,t=2.4){let e=i.clone();return e.repeat.set(t,t),e.needsUpdate=!0,new ne({color:16054268,roughness:.66,metalness:0,bumpMap:e,bumpScale:.9,vertexColors:!1})}var __=.5;function ah(i){let t=Oe(i),e=[],n=[],s=[],r=[],o=new Ht(4866104),a=new Ht(15265527);function l(h,d,u,f,g){let _=g>1?5:4,p=h.clone().addScaledVector(d,u),m=Math.abs(d.y)>.9?new R(1,0,0):new R(0,1,0),M=new R().crossVectors(d,m).normalize(),S=new R().crossVectors(d,M).normalize(),y=e.length/3;for(let E=0;E<_;E++){let C=E/_*Math.PI*2,x=Math.cos(C),T=Math.sin(C),P=M.clone().multiplyScalar(x).addScaledVector(S,T).normalize();for(let I=0;I<2;I++){let U=I===0?h:p,G=I===0?f:f*.62;e.push(U.x+P.x*G,U.y+P.y*G,U.z+P.z*G),n.push(P.x,P.y,P.z);let X=ce(P.y*.9+d.y*.35)*(g<=2?.85:.4),F=o.clone().lerp(a,X);s.push(F.r,F.g,F.b)}}for(let E=0;E<_;E++){let C=y+E*2,x=y+E*2+1,T=y+(E+1)%_*2,P=T+1;r.push(C,T,x,x,T,P)}if(g<=0||u<.28)return;let w=g>2?2:2+(t()>.55?1:0);for(let E=0;E<w;E++){let C=d.clone(),x=new R(t()-.5,t()*.2,t()-.5).normalize();C.applyAxisAngle(x,.42+t()*.55).normalize(),C.y=Math.max(C.y,.1),C.normalize(),l(p,C,u*(.58+t()*.22),f*.6,g-1)}}l(new R(0,0,0),new R(0,1,0),2.1+t()*.9,.15+t()*.05,4);let c=new de;return c.setAttribute("position",new qt(e,3)),c.setAttribute("normal",new qt(n,3)),c.setAttribute("color",new qt(s,3)),c.setIndex(r),c.computeBoundingSphere(),c}function v_(i,t){let e=new Se,n=3.8,s=2.35,r=3,o=new ne({map:(()=>{let p=i.clone();return p.repeat.set(2.2,1.6),p.needsUpdate=!0,p})(),color:10259316,roughness:.92,metalness:0}),a=new zt(new Le(n,s,r),o);a.position.y=s/2,e.add(a);let l=new ne({map:(()=>{let p=i.clone();return p.repeat.set(3,1),p.needsUpdate=!0,p})(),color:7166792,roughness:.95}),c=new ne({color:16185855,roughness:.7,bumpMap:(()=>{let p=t.clone();return p.repeat.set(3,2),p.needsUpdate=!0,p})(),bumpScale:.6}),h=Math.sqrt((r/2)**2+.85**2);for(let p of[-1,1]){let m=new zt(new Le(n+.35,.09,h),l);m.position.set(0,s+.42,p*r/4),m.rotation.x=p*Math.atan2(.85,r/2),e.add(m);let M=new zt(new Le(n+.42,.13,h*.99),c);M.position.set(0,s+.52,p*r/4),M.rotation.x=m.rotation.x,e.add(M)}let d=new Rs;d.moveTo(-n/2,0),d.lineTo(n/2,0),d.lineTo(0,.85),d.closePath();let u=new wr(d,{depth:.12,bevelEnabled:!1});for(let p of[-1,1]){let m=new zt(u,o);m.position.set(0,s,p*(r/2)-(p>0?0:.12)),e.add(m)}let f=new zt(new Le(.95,1.75,.08),new ne({color:5062448,roughness:.9}));f.position.set(-.6,.88,r/2+.02),e.add(f);let g=new zt(new Le(.62,.5,.06),new ne({color:2833226,roughness:.25,metalness:.1}));g.position.set(.85,1.45,r/2+.02),e.add(g);let _=new zt(new tn(n*.62,n*.78,.34,16),c);return _.position.y=.12,_.scale.set(1,1,r/n*1.15),e.add(_),e.traverse(p=>{p.isMesh&&(p.castShadow=!1,p.receiveShadow=!1)}),e}function y_(i,t){let e=new Se,n=.46,s=.32,r=.24,o=.014,a=new ne({map:(()=>{let p=i.clone();return p.repeat.set(1.6,.9),p.needsUpdate=!0,p})(),color:12887937,roughness:.88,metalness:0}),l=new ne({map:(()=>{let p=i.clone();return p.repeat.set(.8,.6),p.needsUpdate=!0,p})(),color:12163958,roughness:.88,metalness:0}),c=[],h=[],d=(p,m,M,S,y=a,w=!1)=>{let E=new ae().makeTranslation(m,M,S);(w?h:c).push({geometry:p,matrix:E,material:y})},u=.085;for(let p of[-1,1])for(let m=0;m<2;m++)d(new Le(n,u,o),0,.045+m*.115,p*(s/2-o/2));for(let p of[-1,1])for(let m=0;m<2;m++)d(new Le(o,u,s-o*2),p*(n/2-o/2),.045+m*.115,0);for(let p of[-1,1])for(let m of[-1,1])d(new Le(.03,r,.03),p*(n/2-.015),r/2-.03,m*(s/2-.015),l);for(let p=0;p<3;p++)d(new Le(n-.03,o,s/3-.012),0,.007,(p-1)*(s/3));let f=new ne({color:16251646,roughness:.7,bumpMap:(()=>{let p=t.clone();return p.repeat.set(4,4),p.needsUpdate=!0,p})(),bumpScale:.5});for(let p of[-1,1])d(new Le(n+.01,.018,o+.012),0,.196,p*(s/2-o/2),f,!0);for(let p of[-1,1])d(new Le(o+.012,.018,s-o),p*(n/2-o/2),.196,0,f,!0);let g=pl(c);g.traverse(p=>{p.isMesh&&(p.castShadow=!0,p.receiveShadow=!0)}),e.add(g);let _=pl(h);return _.traverse(p=>{p.isMesh&&(p.castShadow=!1,p.receiveShadow=!0)}),e.add(_),e.userData.inner={w:n-.06,d:s-.06,floor:.02},e}function M_(i){let t=new Se,e=new ne({map:(()=>{let o=i.clone();return o.repeat.set(3,1),o.needsUpdate=!0,o})(),color:12622442,roughness:.8}),n=new zt(new Le(.19,.035,.06),e);n.position.y=.035,t.add(n);let s=new zt(new tn(.014,.016,.16,8),e);s.rotation.z=Math.PI/2,s.position.set(.15,.045,0),t.add(s);let r=new zt(new Le(.18,.038,.055),new ne({color:10124110,roughness:1}));return r.position.y=0,t.add(r),t.traverse(o=>{o.isMesh&&(o.castShadow=!0)}),t}function S_(i){let t=new Se,e=new ne({color:12173512,roughness:.42,metalness:.65}),n=new zt(new sn(.1,14,10,0,Math.PI*2,0,Math.PI*.5),e);n.scale.set(1,.55,1.25),n.rotation.x=Math.PI,n.position.y=.055,t.add(n);let s=new zt(new tn(.015,.017,.34,8),new ne({map:(()=>{let r=i.clone();return r.repeat.set(4,1),r.needsUpdate=!0,r})(),color:13215864,roughness:.82}));return s.rotation.z=Math.PI/2.6,s.position.set(.18,.11,0),t.add(s),t.traverse(r=>{r.isMesh&&(r.castShadow=!0)}),t}function b_(i=480){let t=new de,e=new Float32Array(i*3),n=new Float32Array(i),s=new Float32Array(i),r=Oe(2468),o=16,a=11;for(let h=0;h<i;h++)e[h*3]=(r()*2-1)*o,e[h*3+1]=r()*a,e[h*3+2]=(r()*2-1)*o,n[h]=r()*100,s[h]=.012+r()*.03;t.setAttribute("position",new ye(e,3)),t.setAttribute("aSeed",new ye(n,1)),t.setAttribute("aSize",new ye(s,1)),t.boundingSphere=new mn(new R,60);let l=new ke({uniforms:{uTime:{value:0},uMap:{value:Id(64)},uOrigin:{value:new R},uHeight:{value:a},uSpan:{value:o},uIntensity:{value:1},uPixelRatio:{value:1}},vertexShader:`
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform vec3 uOrigin;
      uniform float uHeight;
      uniform float uSpan;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        float fall = 0.34 + fract(aSeed) * 0.5;
        p.y = mod(p.y - uTime * fall, uHeight);
        p.x += sin(uTime * 0.5 + aSeed * 6.0) * 0.55 + uTime * 0.12;
        p.z += cos(uTime * 0.37 + aSeed * 4.3) * 0.45;
        // keep the flurry centred on the camera
        p.x = mod(p.x - uOrigin.x + uSpan, uSpan * 2.0) - uSpan + uOrigin.x;
        p.z = mod(p.z - uOrigin.z + uSpan, uSpan * 2.0) - uSpan + uOrigin.z;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vAlpha = smoothstep(0.35, 1.4, d) * (1.0 - smoothstep(9.0, 17.0, d));
        gl_PointSize = aSize * 620.0 * uPixelRatio / max(d, 0.25);
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform sampler2D uMap;
      uniform float uIntensity;
      varying float vAlpha;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        float a = t.a * vAlpha * uIntensity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0), a * 0.85);
      }
    `,transparent:!0,depthWrite:!1,blending:Cn}),c=new Gi(t,l);return c.frustumCulled=!1,c.renderOrder=5,c}function Gd(i,t,e){let n=Math.min(8,t.capabilities.getMaxAnisotropy()),s=hl(e.texBig);s.anisotropy=n;let r=Cd(e.texBig,{planks:5});r.anisotropy=n,i.fog=new cr(13885678,.0165),i.background=null;let o=new zt(new sn(320,24,16),new Gn({map:Pd(512,512),side:Ue,fog:!1,depthWrite:!1}));o.renderOrder=-10,i.add(o);let a=new Ir(10339314,9676477,.7);i.add(a);let l=new Is(16773325,3.15);l.position.set(-5.6,2.5,4.6),l.target.position.set(0,0,0),i.add(l.target),l.castShadow=!0,l.shadow.mapSize.set(e.shadowMap,e.shadowMap);let c=l.shadow.camera;c.left=-2.6,c.right=2.6,c.top=3.2,c.bottom=-3.2,c.near=.5,c.far=22,l.shadow.bias=-8e-4,l.shadow.normalBias=.018,i.add(l);let h=new Is(13820671,.3);h.position.set(5,2,-5.5),i.add(h);let d=m_(300,e.groundSeg,{w:Ge,d:We}),u=x_(s,22);u.vertexColors=!0,u.polygonOffset=!0,u.polygonOffsetFactor=-1,u.polygonOffsetUnits=-2;let f=g_(256);f.repeat.set(1/__,.07),f.anisotropy=n,u.map=f;let g=new zt(d,u);g.receiveShadow=!0,i.add(g);let _=new Se;for(let[Q,rt,ot,ct]of[[135,20,12899300,5],[215,36,13688041,17]]){let le=[],te=[],Z=[],lt=new Ht(14345455);for(let wt=0;wt<=220;wt++){let bt=wt/220*Math.PI*2,Qt=ln(Math.cos(bt)*1.7+ct,Math.sin(bt)*1.7,3)*.5+.5,Ut=ln(Math.cos(bt)*4.6+ct*2,Math.sin(bt)*4.6,2)*.5+.5,j=rt*(.3+Qt*.8+Ut*.22);le.push(Math.cos(bt)*Q,-3,Math.sin(bt)*Q),Z.push(lt.r,lt.g,lt.b),le.push(Math.cos(bt)*Q,j,Math.sin(bt)*Q);let nt=new Ht(ot);Z.push(nt.r,nt.g,nt.b)}for(let wt=0;wt<220;wt++){let bt=wt*2,Qt=bt+1,Ut=bt+2,j=bt+3;te.push(bt,Qt,Ut,Qt,j,Ut)}let tt=new de;tt.setAttribute("position",new qt(le,3)),tt.setAttribute("color",new qt(Z,3)),tt.setIndex(te),tt.computeVertexNormals();let St=new zt(tt,new Gn({vertexColors:!0,side:$e,fog:!0}));_.add(St)}i.add(_);let p=[ah(11),ah(23),ah(41)],m=new ne({vertexColors:!0,roughness:.95,metalness:0}),M=new Se,S=Oe(99),y=[[-12.5,-15.5],[-16,-19],[10.5,-17.5],[15,-13],[-20,-8],[19.5,-21],[-9,-24],[24,-6],[3,-26]],w=new sn(.6,10,6,0,Math.PI*2,0,Math.PI*.5),E=new ne({color:15922940,roughness:.8}),C=[],x=new ae;for(let[Q,rt]of y){let ot=new zt(p[S()*3|0],m),ct=.9+S()*.7;ot.scale.setScalar(ct),ot.position.set(Q,cn(Q,rt)-.1,rt),ot.rotation.y=S()*6.28,M.add(ot),x.compose(new R(Q,cn(Q,rt)-.12,rt),new Qe,new R(ct,ct*.35,ct)),C.push({geometry:w,matrix:x.clone(),material:E})}M.add(pl(C)),w.dispose(),i.add(M);let T=v_(r,s);T.position.set(-8.6,cn(-8.6,-12.5)-.18,-12.5),T.rotation.y=.42,i.add(T);let P=new ne({map:(()=>{let Q=Nd(128);return Q.repeat.set(1,2),Q})(),color:9075302,roughness:.95}),I=new ne({color:6975351,roughness:.6,metalness:.3}),U=new ne({color:16185855,roughness:.7});{let Q=new tn(.045,.055,1.05,6),rt=new sn(.055,7,5),ot=new tn(.008,.008,1,4),ct=[],Gt=new ae,le=new Qe,te=new R(0,1,0),Z=tt=>{let St=-3.4-tt*.06,wt=-2.6-tt*1.85;return new R(St,cn(St,wt)-.14,wt)};for(let tt=0;tt<16;tt++){let St=Z(tt);if(Gt.compose(new R(St.x,St.y+.525,St.z),le.setFromAxisAngle(new R(0,0,1),Math.sin(tt*2.1)*.05),new R(1,1,1)),ct.push({geometry:Q,matrix:Gt.clone(),material:P}),Gt.compose(new R(St.x,St.y+1.05,St.z),le.identity(),new R(1,.6,1)),ct.push({geometry:rt,matrix:Gt.clone(),material:U}),tt>0){let wt=Z(tt-1);for(let bt of[.42,.78]){let Qt=new R(wt.x,wt.y+bt,wt.z),Ut=new R(St.x,St.y+bt,St.z),j=Qt.distanceTo(Ut);Gt.compose(Qt.clone().lerp(Ut,.5),le.setFromUnitVectors(te,Ut.clone().sub(Qt).normalize()),new R(1,j,1)),ct.push({geometry:ot,matrix:Gt.clone(),material:I})}}}let lt=pl(ct);Q.dispose(),rt.dispose(),ot.dispose(),i.add(lt)}let G=y_(r,s),X=1.46,F=.72;G.position.set(X,cn(X,F)-.055,F),G.rotation.y=-.52,i.add(G);let W=M_(r);W.position.set(-1.44,cn(-1.44,.95)-.02,.95),W.rotation.set(.06,1.1,.02),i.add(W);let k=S_(r);k.position.set(1.72,cn(1.72,-.35)-.03,-.35),k.rotation.set(0,-.85,.1),i.add(k);let K=b_(e.snowflakes);return i.add(K),{sky:o,sun:l,fill:h,hemi:a,ground:g,crate:G,snowfall:K,grain:s,wood:r,trees:M,shed:T,setSnowfallIntensity(Q){K.material.uniforms.uIntensity.value=Q},update(Q,rt,ot){let ct=K.material.uniforms;ct.uTime.value+=Q,ct.uOrigin.value.copy(rt.position),ct.uPixelRatio.value=ot,o.position.set(rt.position.x,0,rt.position.z)}}}var ks=.175,E_=.0215,Hs=null,lh=null;function Wd(i=4){if(!lh){let t=Ad(256,512),e=Rd(256,512);t.anisotropy=i,lh={skin:t,dirt:e,leaves:[ul(256,3),ul(256,11),ul(256,29)]}}return lh}function T_(i,t){let e=t*(.04+.96*Math.pow(i,.4));return e*=1-.1*Math.pow(i,3),i>.955&&(e*=Math.sqrt(Math.max(0,1-Math.pow((i-.955)/.045,2)*.82))),Math.max(6e-4,e)}function Xd(i=7){let t=Oe(i),e=46,n=[];for(let l=0;l<e;l++){let c=l/(e-1);n.push(new it(T_(c,E_),c*ks))}let s=new Rr(n,20),r=s.attributes.position,o=new R,a=new it(.9,.44).normalize();for(let l=0;l<r.count;l++){o.fromBufferAttribute(r,l);let c=ce(o.y/ks),h=Math.pow(1-c,2.1)*.026,d=Math.atan2(o.z,o.x),u=1+.055*Math.sin(d*3+c*11)*(.35+c)+.03*Math.sin(d*7-c*23)+.022*Math.sin(c*47);o.x*=u,o.z*=u,o.x+=a.x*h,o.z+=a.y*h,r.setXYZ(l,o.x,o.y,o.z)}return s.computeVertexNormals(),s.translate(0,-ks,0),s}function w_(i,t,e,n,s,r,o,a){let c=Math.cos(t),h=Math.sin(t),d=new R,u=new R,f=new R,g=new R,_=new R(0,1,0),p=new R,m=(S,y)=>{let w=-.016+e*(1.06*S-.06*S*S*S)*(1-.1*S*S),E=n*(S*S*(.55+.45*S))+.008;return y.set(c*E,w,h*E),y},M=i.position.length/3;for(let S=0;S<=8;S++){let y=S/8;m(y,d),m(Math.max(0,y-.02),u),f.subVectors(d,u).normalize(),f.lengthSq()<1e-6&&f.copy(_),g.set(-h,0,c);let w=r*y,E=f;g.applyAxisAngle(E,w).normalize(),p.crossVectors(f,g).normalize();let C=s*(.62+.5*Math.sin(Math.PI*Math.pow(y,.85)))*.5;for(let x=-1;x<=1;x+=2)i.position.push(d.x+g.x*C*x,d.y+g.y*C*x,d.z+g.z*C*x),i.normal.push(p.x,p.y,p.z),i.uv.push(x<0?0:1,y),i.color.push(o.r,o.g,o.b),i.texid.push(a)}for(let S=0;S<8;S++){let y=M+S*2,w=y+1,E=y+2,C=y+3;i.index.push(y,E,w,w,E,C)}}function A_(i,t,e){let n=Oe(i),s={position:[],normal:[],uv:[],color:[],index:[],texid:[]};for(let o=0;o<t;o++){let a=o/t*Math.PI*2+n()*.55,l=o%3!==0,c=e*(l?.7+n()*.3:.92+n()*.22),h=l?.085+n()*.085:.024+n()*.045,d=.09+n()*.055,u=(n()-.5)*1.5,f=.82+n()*.36,g=new Ht(f*(.86+n()*.2),f,f*(.72+n()*.2));w_(s,a,c,h,d,u,g,o%3)}let r=new de;return r.setAttribute("position",new qt(s.position,3)),r.setAttribute("normal",new qt(s.normal,3)),r.setAttribute("uv",new qt(s.uv,2)),r.setAttribute("color",new qt(s.color,3)),r.setIndex(s.index),r.computeBoundingSphere(),r}function qd(i={}){let{seed:t=1,aniso:e=4,leafHeight:n=.225,fronds:s=14}=i,r=Wd(e);Hs||(Hs=Xd());let o=new Se,a=new ne({map:r.skin,roughness:.62,metalness:0});a.userData.uDirt={value:.8},a.customProgramCacheKey=()=>"carrotbody",a.onBeforeCompile=_=>{_.uniforms.uDirtMap={value:r.dirt},_.uniforms.uDirt=a.userData.uDirt,_.fragmentShader=_.fragmentShader.replace("#include <common>",`
        #include <common>
        uniform sampler2D uDirtMap;
        uniform float uDirt;
        float gDirtAmt;
      `).replace("#include <map_fragment>",`
        #include <map_fragment>
        vec4 dirtTex = texture2D(uDirtMap, vMapUv);
        gDirtAmt = dirtTex.a * uDirt;
        diffuseColor.rgb = mix(diffuseColor.rgb, dirtTex.rgb * 0.92, gDirtAmt);
      `).replace("#include <roughnessmap_fragment>",`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.95, gDirtAmt);
      `)};let l=new zt(Hs,a);l.castShadow=!0,l.name="carrotBody",o.add(l);let c=A_(t*131+7,s,n),h=new ne({map:r.leaves[t%r.leaves.length],alphaTest:.3,side:$e,roughness:.8,metalness:0,vertexColors:!0,emissive:new Ht(1915410),emissiveIntensity:1});h.userData.uStretch={value:0},h.userData.uWind={value:0},h.customProgramCacheKey=()=>"carrotleaf",h.onBeforeCompile=_=>{_.uniforms.uStretch=h.userData.uStretch,_.uniforms.uWind=h.userData.uWind,_.vertexShader=_.vertexShader.replace("#include <common>",`#include <common>
uniform float uStretch;
uniform float uWind;`).replace("#include <begin_vertex>",`
        #include <begin_vertex>
        float lt = clamp(transformed.y / 0.24, 0.0, 1.0);
        // gathered and stretched while the child hauls on them
        transformed.xz *= mix(1.0, 0.55, uStretch * lt);
        transformed.y *= 1.0 + uStretch * 0.30 * lt;
        transformed.x += sin(uWind * 1.7 + transformed.z * 9.0) * 0.006 * lt;
        transformed.z += cos(uWind * 1.3 + transformed.x * 8.0) * 0.006 * lt;
      `)};let d=new zt(c,h);d.castShadow=!0,d.name="carrotLeaves",o.add(d);let u=.03,f=.62,g=[];{let _=[],p=c.attributes.position;for(let M=0;M<p.count;M++){let S=p.getX(M),y=p.getY(M),w=p.getZ(M),E=Math.round(Math.hypot(S,w)/u);for(;_.length<=E;)_.push(0);y>_[E]&&(_[E]=y)}let m=Math.ceil(Math.max(..._)/f/u)+_.length+1;for(let M=0;M<m;M++){let S=0;for(let y=0;y<_.length;y++){let w=_[y]-Math.abs(M-y)*u*f;w>S&&(S=w)}g.push(S)}for(let M=g.length-2;M>=0;M--)g[M]=Math.max(g[M],g[M+1])}return o.userData={body:l,leaves:d,bodyMat:a,leafMat:h,leafProfile:{bin:u,max:g},setDirt:_=>{a.userData.uDirt.value=_},setStretch:_=>{h.userData.uStretch.value=_},setWind:_=>{h.userData.uWind.value=_},leafHeight:n},o}function Yd(i,t){let e=new sn(.1,20,10,0,Math.PI*2,0,Math.PI*.5),n=e.attributes.position,s=new R;for(let c=0;c<n.count;c++){s.fromBufferAttribute(n,c);let h=1+.13*Math.sin(s.x*62)*Math.cos(s.z*55)+.07*Math.sin(s.y*90);s.multiplyScalar(h),s.y*=.55,n.setXYZ(c,s.x,s.y,s.z)}e.computeVertexNormals();let r=i.clone();r.repeat.set(3,3),r.needsUpdate=!0;let o=t.clone();o.repeat.set(3,3),o.needsUpdate=!0;let a=new ne({map:r,bumpMap:o,bumpScale:.4,roughness:.9,metalness:0,color:12169380}),l=new zt(e,a);return l.castShadow=!0,l.receiveShadow=!0,l.name="soilCap",l}function Zd(i){let t=new tn(.036,.014,.12,20,3,!0);t.translate(0,-.055,0);let e=i.clone();e.repeat.set(2,1),e.needsUpdate=!0;let n=new ne({map:e,color:7035979,side:Ue,roughness:.98,metalness:0}),s=new zt(t,n);return s.name="hole",s}var qr=null;function $d(i=4){if(!qr){let s=Wd(i);Hs||(Hs=Xd()),qr={bodyMat:new ne({map:s.skin,roughness:.66}),stubGeo:new xr(.012,.05,8),stubMat:new ne({color:6060595,roughness:.8})}}let t=new Se,e=new zt(Hs,qr.bodyMat);e.castShadow=!0,t.add(e);let n=new zt(qr.stubGeo,qr.stubMat);return n.position.y=.022,t.add(n),t}var re=Oe(5150),ml=class{constructor(t,e,n,s){this.max=t,this.count=0,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.life=new Float32Array(t),this.maxLife=new Float32Array(t),this.size=new Float32Array(t),this.alpha=new Float32Array(t),this.col=new Float32Array(t*3),this.spin=new Float32Array(t),this.gravity=s;let r=new de;r.setAttribute("position",new ye(this.pos,3)),r.setAttribute("aSize",new ye(this.size,1)),r.setAttribute("aAlpha",new ye(this.alpha,1)),r.setAttribute("aColor",new ye(this.col,3)),r.setDrawRange(0,0),r.boundingSphere=new mn(new R,30);let o=new ke({uniforms:{uMap:{value:e},uPixelRatio:{value:1}},vertexShader:`
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uPixelRatio;
        varying float vA;
        varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 900.0 * uPixelRatio / max(-mv.z, 0.12);
          gl_Position = projectionMatrix * mv;
        }
      `,fragmentShader:`
        uniform sampler2D uMap;
        varying float vA;
        varying vec3 vC;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC * t.rgb, a);
        }
      `,transparent:!0,depthWrite:!1,blending:n});this.points=new Gi(r,o),this.points.frustumCulled=!1,this.points.renderOrder=6,this.geo=r}spawn(t,e,n,s,r,o,a,l,c){let h=this.count;h>=this.max?h=this._rr=((this._rr||0)+1)%this.max:this.count++;let d=h*3;this.pos[d]=t,this.pos[d+1]=e,this.pos[d+2]=n,this.vel[d]=s,this.vel[d+1]=r,this.vel[d+2]=o,this.life[h]=l,this.maxLife[h]=l,this.size[h]=a,this.alpha[h]=1,this.col[d]=c[0],this.col[d+1]=c[1],this.col[d+2]=c[2]}update(t){let e=this.count;for(let n=0;n<e;n++){if(this.life[n]<=0){this.alpha[n]=0;continue}this.life[n]-=t;let s=n*3;this.vel[s+1]+=this.gravity*t,this.vel[s]*=1-1.9*t,this.vel[s+2]*=1-1.9*t,this.pos[s]+=this.vel[s]*t,this.pos[s+1]+=this.vel[s+1]*t,this.pos[s+2]+=this.vel[s+2]*t;let r=ce(this.life[n]/this.maxLife[n]);this.alpha[n]=r*r*(3-2*r)}this.geo.setDrawRange(0,e),this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0}},ch=class{constructor(t,e){this.max=t,this.mesh=new pr(new Ar(.0075,0),e,t),this.mesh.instanceMatrix.setUsage(Pc),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.rot=new Float32Array(t*3),this.rotV=new Float32Array(t*3),this.life=new Float32Array(t),this.scale=new Float32Array(t),this.head=0,this.m=new ae,this.q=new Qe,this.e=new Pn,this.v=new R,this.s=new R;for(let n=0;n<t;n++)this.m.makeScale(0,0,0),this.mesh.setMatrixAt(n,this.m)}spawn(t,e,n,s,r,o,a,l){let c=this.head=(this.head+1)%this.max,h=c*3;this.pos[h]=t,this.pos[h+1]=e,this.pos[h+2]=n,this.vel[h]=s,this.vel[h+1]=r,this.vel[h+2]=o,this.rot[h]=re()*6.28,this.rot[h+1]=re()*6.28,this.rot[h+2]=re()*6.28,this.rotV[h]=(re()-.5)*14,this.rotV[h+1]=(re()-.5)*14,this.rotV[h+2]=(re()-.5)*14,this.life[c]=l,this.scale[c]=a}update(t,e){let n=!1;for(let s=0;s<this.max;s++){if(this.life[s]<=0)continue;n=!0,this.life[s]-=t;let r=s*3;this.vel[r+1]-=6.2*t,this.pos[r]+=this.vel[r]*t,this.pos[r+1]+=this.vel[r+1]*t,this.pos[r+2]+=this.vel[r+2]*t;let o=e(this.pos[r],this.pos[r+2]);this.pos[r+1]<o&&(this.pos[r+1]=o,this.vel[r+1]*=-.22,this.vel[r]*=.5,this.vel[r+2]*=.5,this.rotV[r]*=.4,this.rotV[r+1]*=.4,this.rotV[r+2]*=.4),this.rot[r]+=this.rotV[r]*t,this.rot[r+1]+=this.rotV[r+1]*t,this.rot[r+2]+=this.rotV[r+2]*t;let a=ce(this.life[s]/.5);this.e.set(this.rot[r],this.rot[r+1],this.rot[r+2]),this.q.setFromEuler(this.e),this.v.set(this.pos[r],this.pos[r+1],this.pos[r+2]);let l=this.scale[s]*a;this.s.set(l,l,l),this.m.compose(this.v,this.q,this.s),this.mesh.setMatrixAt(s,this.m),this.life[s]<=0&&(this.m.makeScale(0,0,0),this.mesh.setMatrixAt(s,this.m))}n&&(this.mesh.instanceMatrix.needsUpdate=!0)}},gl=class{constructor(t,e){this.snow=new ml(320,sh(64),Cn,-3.2),this.sparkle=new ml(140,dl(128),oi,-.35),t.add(this.snow.points),t.add(this.sparkle.points);let n=new ne({map:e,color:9073496,roughness:.96,metalness:0});this.clods=new ch(90,n),t.add(this.clods.mesh);let s=new yi({map:sh(128,[255,226,178]),blending:oi,transparent:!0,depthWrite:!1,depthTest:!1,opacity:0});this.flare=new ki(s),this.flare.scale.setScalar(.6),this.flare.renderOrder=4,this.flare.visible=!1,t.add(this.flare),this.flareT=0}puffSnow(t,e,n,s,r,o){let a=Math.min(9,1+Math.floor(o*90));for(let l=0;l<a;l++){let c=.25+re()*.75;this.snow.spawn(t+(re()-.5)*.09,e+.008+re()*.03,n+(re()-.5)*.09,s*c+(re()-.5)*.4,.32+re()*.75,r*c+(re()-.5)*.4,.01+re()*.024,.45+re()*.5,[1,1,1])}}puffSoil(t,e,n,s,r=1){let o=Math.min(7,1+Math.floor(s*40));for(let a=0;a<o;a++)this.clods.spawn(t+(re()-.5)*.05,e+.01,n+(re()-.5)*.05,(re()-.5)*.9*r,.5+re()*1.3*r,(re()-.5)*.9*r,.5+re()*1.1,.9+re()*.7);for(let a=0;a<o;a++)this.snow.spawn(t+(re()-.5)*.06,e+.01,n+(re()-.5)*.06,(re()-.5)*.5,.25+re()*.5,(re()-.5)*.5,.008+re()*.012,.35+re()*.3,[.42,.33,.24])}burstSparkle(t,e,n,s=26,r=.9){for(let o=0;o<s;o++){let a=re()*6.28,l=re()*1.3,c=(.5+re()*1.5)*r;this.sparkle.spawn(t+(re()-.5)*.05,e+(re()-.5)*.05,n+(re()-.5)*.05,Math.cos(a)*Math.cos(l)*c,Math.sin(l)*c*1.1,Math.sin(a)*Math.cos(l)*c,.011+re()*.021,.5+re()*.5,[1,.95,.86])}}popFlare(t){this.flare.position.copy(t),this.flare.visible=!0,this.flareT=1}update(t,e,n){if(this.snow.update(t),this.sparkle.update(t),this.clods.update(t,e),this.snow.points.material.uniforms.uPixelRatio.value=n,this.sparkle.points.material.uniforms.uPixelRatio.value=n,this.flareT>0){this.flareT=Math.max(0,this.flareT-t*1.5);let s=this.flareT;this.flare.material.opacity=Math.sin(Math.PI*Math.min(1,(1-s)*3.2+s*.1))*.55*s,this.flare.scale.setScalar(.35+(1-s)*.95),this.flareT<=0&&(this.flare.visible=!1)}}};var xl=class{constructor(t){this.camera=t,this.pos=new R(0,2.4,4.2),this.look=new R(0,.2,0),this.fov=t.fov,this.fromPos=this.pos.clone(),this.fromLook=this.look.clone(),this.fromFov=this.fov,this.toPos=this.pos.clone(),this.toLook=this.look.clone(),this.toFov=this.fov,this.t=1,this.dur=1,this.ease=En,this.driftT=Math.random()*10,this.driftAmp=.02,this.shake=0,this._v=new R}set(t,e,n){this.pos.copy(t),this.look.copy(e),n&&(this.fov=n),this.toPos.copy(t),this.toLook.copy(e),this.toFov=this.fov,this.t=1,this.apply()}goTo(t,e,n=1.4,s=En,r=null){this.fromPos.copy(this.pos),this.fromLook.copy(this.look),this.fromFov=this.fov,this.toPos.copy(t),this.toLook.copy(e),this.toFov=r??this.fov,this.t=0,this.dur=Math.max(1e-4,n),this.ease=s}get moving(){return this.t<1}addShake(t){this.shake=Math.min(1,this.shake+t)}update(t){if(this.t<1){this.t=ce(this.t+t/this.dur);let e=this.ease(this.t);this.pos.lerpVectors(this.fromPos,this.toPos,e),this.look.lerpVectors(this.fromLook,this.toLook,e),this.fov=Xt(this.fromFov,this.toFov,e)}this.driftT+=t,this.shake=Math.max(0,this.shake-t*2.6),this.apply()}apply(){let t=this.camera,e=this.driftT,n=Math.sin(e*.37)*this.driftAmp+Math.sin(e*.91)*this.driftAmp*.4,s=Math.sin(e*.53+1.3)*this.driftAmp*.6,r=this.shake*this.shake;t.position.set(this.pos.x+n+(Math.random()-.5)*r*.05,this.pos.y+s+(Math.random()-.5)*r*.05,this.pos.z+n*.5),this._v.copy(this.look),this._v.y+=s*.25,t.lookAt(this._v),Math.abs(t.fov-this.fov)>.01&&(t.fov=this.fov,t.updateProjectionMatrix())}};function Gs(i,t,e,n,s,r=.3){let o=s.fov*.5*Math.PI/180,a=Math.atan(Math.tan(o)*s.aspect),l=Math.max(r,n/Math.max(.08,Math.tan(a))),c=e*Math.PI/180,h=l*Math.cos(c);return{pos:new R(i.x+Math.sin(t)*h,i.y+l*Math.sin(c),i.z+Math.cos(t)*h),look:i.clone(),dist:l}}var Yr=class{constructor(t){let e=Ud(256),n=new Gn({map:e,transparent:!0,depthWrite:!1,blending:oi,opacity:0,fog:!1});this.mesh=new zt(new Wn(1,1),n),this.mesh.rotation.x=-Math.PI/2,this.mesh.renderOrder=3,this.mesh.visible=!1,t.add(this.mesh);let s=new yi({map:dl(128),transparent:!0,depthWrite:!1,blending:oi,opacity:0,fog:!1});this.stars=[];for(let r=0;r<3;r++){let o=new ki(s.clone());o.scale.setScalar(.07),o.renderOrder=4,o.visible=!1,t.add(o),this.stars.push(o)}this.t=Math.random()*6,this.strength=0}setAt(t,e,n){this.mesh.position.set(t,e+.012,n),this.base=new R(t,e,n)}show(t,e=1){this.target=t?e:0}update(t){this.t+=t,this.strength=Xt(this.strength,this.target||0,1-Math.exp(-6*t));let e=this.strength>.01;if(this.mesh.visible=e,!e){this.stars.forEach(r=>r.visible=!1);return}let n=.5+.5*Math.sin(this.t*2.3);this.mesh.material.opacity=this.strength*(.3+n*.42);let s=.44+n*.11;this.mesh.scale.set(s,s,s);for(let r=0;r<this.stars.length;r++){let o=this.stars[r];o.visible=!0;let a=this.t*(.8+r*.27)+r*2.1,l=.1+.05*Math.sin(this.t*1.7+r);o.position.set(this.base.x+Math.cos(a)*l,this.base.y+.05+.045*Math.sin(this.t*2.2+r*1.9),this.base.z+Math.sin(a)*l),o.material.opacity=this.strength*(.35+.4*(.5+.5*Math.sin(this.t*3+r*2))),o.scale.setScalar(.05+.02*(.5+.5*Math.sin(this.t*2.6+r)))}}},_l=class{constructor(t){this.el=document.createElement("div"),this.el.className="hint-layer",t.appendChild(this.el),this.hand=document.createElement("img"),this.hand.src=Ld(256).image.toDataURL(),this.hand.className="hint hint-hand",this.el.appendChild(this.hand),this.arrow=document.createElement("img"),this.arrow.src=Dd(256).image.toDataURL(),this.arrow.className="hint hint-arrow",this.el.appendChild(this.arrow),this.mode="none",this.t=0,this.anchor={x:0,y:0},this.opacity=0,this.target=0}set(t,e){e&&(this.anchor=e),t!==this.mode&&(this.mode=t,this.t=0),this.target=t==="none"?0:1}setAnchor(t,e){this.anchor.x=t,this.anchor.y=e}setSecondary(t,e){this.secondary={x:t,y:e}}update(t){if(this.t+=t,this.opacity=Xt(this.opacity,this.target,1-Math.exp(-5*t)),this.opacity<.02){this.hand.style.opacity="0",this.arrow.style.opacity="0";return}let e=this.anchor,n=e.x,s=e.y,r=0,o=1,a=!1,l=e.x,c=e.y,h=0,d=1,u=f=>this.t%f/f;if(this.mode==="sweep"){let f=u(1.9),g=Math.sin(f*Math.PI*2),_=bn(0,.12,f)*(1-bn(.88,1,f));n=e.x+g*62,s=e.y+Math.abs(Math.cos(f*Math.PI*2))*8,r=g*14,o=.95+.06*Math.cos(f*Math.PI*4),this.hand.style.opacity=String(this.opacity*(.35+_*.6)),this.arrow.style.opacity="0"}else if(this.mode==="pull"){let f=u(1.5),g=bn(.08,.72,f);s=e.y-g*92,n=e.x,o=1-g*.06,this.hand.style.opacity=String(this.opacity*(.35+(1-Math.abs(f*2-1))*.6)),a=!0,c=e.y-132-Math.sin(f*Math.PI)*18,d=.78,this.arrow.style.opacity=String(this.opacity*(.55+.35*Math.sin(f*Math.PI*2)))}else if(this.mode==="carry"){let f=this.secondary||e,g=u(1.8),_=bn(.1,.85,g);n=Xt(e.x,f.x,_),s=Xt(e.y,f.y,_),this.hand.style.opacity=String(this.opacity*(.3+(1-Math.abs(g*2-1))*.6)),a=!0,l=f.x,c=f.y-76,h=180,d=.66,this.arrow.style.opacity=String(this.opacity*.6)}else if(this.mode==="tap"){let f=u(1.3),g=Math.max(0,Math.sin(f*Math.PI*2));o=1-g*.13,s=e.y+g*10,this.hand.style.opacity=String(this.opacity*.85),this.arrow.style.opacity="0"}else this.hand.style.opacity=String(this.opacity*.5),this.arrow.style.opacity=String(this.opacity*.4);this.hand.style.transform=`translate(${n-44}px, ${s-8}px) rotate(${r}deg) scale(${o})`,a&&(this.arrow.style.transform=`translate(${l-40}px, ${c-40}px) rotate(${h}deg) scale(${d})`)}};function Jd(i){let t=new Se,e=i.clone();e.repeat.set(9,9),e.needsUpdate=!0;let n=new ne({color:12597547,roughness:1,metalness:0,bumpMap:e,bumpScale:.55}),s=new ne({color:15920611,roughness:1,metalness:0,bumpMap:e,bumpScale:.9}),r=new zt(new sn(1,18,14),n);r.scale.set(.038,.024,.052),r.position.set(0,0,-.009),t.add(r);let o=new zt(new sn(1,16,12),n);o.scale.set(.033,.02,.026),o.position.set(0,-.0015,-.053),t.add(o);let a=new zt(new sn(1,12,10),n);a.scale.set(.014,.013,.025),a.position.set(-.035,-.0015,-.015),a.rotation.y=.42,t.add(a);let l=new zt(new tn(.033,.037,.042,16),s);l.rotation.x=Math.PI/2,l.position.set(0,.003,.037),t.add(l);let c=new zt(new tn(.034,.042,.3,14),new ne({color:3104650,roughness:.95}));return c.rotation.x=Math.PI/2+.3,c.position.set(0,.03,.19),t.add(c),t.traverse(h=>{h.isMesh&&(h.castShadow=!0,h.receiveShadow=!1)}),t.visible=!1,t}var vl=class{constructor(t){this.mesh=t,this.pos=new R,this.target=new R,this.dir=new it(0,-1),this.speed=0,this.press=0,this.want=0,this.grip=0,this.wantGrip=0,this.yaw=0,this._up=new R(0,1,0)}show(t){this.want=t?1:0}setGrip(t){this.wantGrip=t}moveTo(t,e,n,s,r,o){this.target.set(t,e,n),Math.abs(s)+Math.abs(r)>1e-4&&this.dir.set(s,r).normalize(),this.speed=o}update(t,e){if(this.press=an(this.press,this.want,9,t),this.grip=an(this.grip,this.wantGrip,10,t),this.mesh.visible=this.press>.02,!this.mesh.visible)return;this.pos.x=an(this.pos.x,this.target.x,22,t),this.pos.y=an(this.pos.y,this.target.y,18,t),this.pos.z=an(this.pos.z,this.target.z,22,t);let n=Xt(.045,.013,this.press)+(1-this.press)*.08;this.mesh.position.set(this.pos.x,this.pos.y+n+this.grip*.02,this.pos.z);let s=Math.atan2(e.position.x-this.pos.x,e.position.z-this.pos.z),r=Math.atan2(this.dir.x,this.dir.y),o=ce(this.speed*2.2),l=Xt(s+.55,r,.55*o)-this.yaw;for(;l>Math.PI;)l-=Math.PI*2;for(;l<-Math.PI;)l+=Math.PI*2;this.yaw+=l*(1-Math.exp(-12*t)),this.mesh.rotation.set(0,this.yaw,0),this.mesh.rotateX(Xt(.55,.12,this.grip)-ce(this.speed)*.12),this.mesh.rotateZ(Math.sin(this.pos.x*3)*.05);let c=1+ce(this.speed)*.05-this.grip*.06;this.mesh.scale.set(1/c,c,1/c)}};var kt=null,hn=null,Qd=null,R_=null,Ii=!1;function C_(i=2){let t=Math.floor(kt.sampleRate*i),e=kt.createBuffer(1,t,kt.sampleRate),n=e.getChannelData(0),s=0;for(let r=0;r<t;r++){let o=Math.random()*2-1;s=(s+.02*o)/1.02,n[r]=o*.75+s*3}return e}function jd(){if(Ii)return kt.state==="suspended"&&kt.resume(),!0;let i=window.AudioContext||window.webkitAudioContext;if(!i)return!1;try{kt=new i}catch{return!1}hn=kt.createGain(),hn.gain.value=.85,hn.connect(kt.destination),Qd=C_(2),Ii=!0,kt.state==="suspended"&&kt.resume(),P_();let t=kt.createOscillator(),e=kt.createGain();return e.gain.value=1e-4,t.connect(e),e.connect(hn),t.start(),t.stop(kt.currentTime+.02),!0}function tf(){kt&&kt.state==="suspended"&&kt.resume()}function Ws(){let i=kt.createBufferSource();return i.buffer=Qd,i.loop=!0,i.playbackRate.value=.8+Math.random()*.5,i}function P_(){let i=Ws(),t=kt.createBiquadFilter();t.type="lowpass",t.frequency.value=340,t.Q.value=.4;let e=kt.createGain();e.gain.value=0,i.connect(t),t.connect(e),e.connect(hn),i.start();let n=kt.createOscillator();n.type="sine",n.frequency.value=.06;let s=kt.createGain();s.gain.value=.022,n.connect(s),s.connect(e.gain),n.start(),e.gain.setTargetAtTime(.035,kt.currentTime,3),R_={src:i,g:e}}var Kd=0;function hh(i=.5,t=0){if(!Ii)return;let e=kt.currentTime;if(e-Kd<.055)return;Kd=e;let n=I_(i),s=Ws(),r=kt.createBiquadFilter();r.type="bandpass";let o=(2600+n*3400)*(1-t*.62);r.frequency.value=o,r.Q.value=.8+t*1.6;let a=kt.createBiquadFilter();a.type="highpass",a.frequency.value=t>.5?180:700;let l=kt.createGain(),c=.1+n*.13,h=(.055+n*.16)*(1-t*.15);l.gain.setValueAtTime(1e-4,e),l.gain.linearRampToValueAtTime(h,e+.012+n*.01),l.gain.exponentialRampToValueAtTime(1e-4,e+c),s.connect(a),a.connect(r),r.connect(l),l.connect(hn),r.frequency.setValueAtTime(o,e),r.frequency.exponentialRampToValueAtTime(Math.max(220,o*.45),e+c),s.start(e),s.stop(e+c+.02)}function ef(){if(!Ii)return;let i=kt.currentTime,t=kt.createOscillator();t.type="sine",t.frequency.setValueAtTime(112,i),t.frequency.exponentialRampToValueAtTime(430,i+.048),t.frequency.exponentialRampToValueAtTime(250,i+.16);let e=kt.createGain();e.gain.setValueAtTime(1e-4,i),e.gain.linearRampToValueAtTime(.5,i+.006),e.gain.exponentialRampToValueAtTime(1e-4,i+.2),t.connect(e),e.connect(hn),t.start(i),t.stop(i+.24);let n=Ws(),s=kt.createBiquadFilter();s.type="bandpass",s.frequency.setValueAtTime(1500,i),s.frequency.exponentialRampToValueAtTime(3200,i+.05),s.Q.value=2.4;let r=kt.createGain();r.gain.setValueAtTime(1e-4,i),r.gain.linearRampToValueAtTime(.2,i+.005),r.gain.exponentialRampToValueAtTime(1e-4,i+.1),n.connect(s),s.connect(r),r.connect(hn),n.start(i),n.stop(i+.14);let o=Ws(),a=kt.createBiquadFilter();a.type="lowpass",a.frequency.setValueAtTime(1400,i+.03),a.frequency.exponentialRampToValueAtTime(320,i+.42);let l=kt.createGain();l.gain.setValueAtTime(1e-4,i+.03),l.gain.linearRampToValueAtTime(.075,i+.06),l.gain.exponentialRampToValueAtTime(1e-4,i+.45),o.connect(a),a.connect(l),l.connect(hn),o.start(i+.03),o.stop(i+.5)}function nf(){if(!Ii)return;let i=kt.currentTime;[784,1047,1319].forEach((e,n)=>{let s=i+n*.085,r=kt.createOscillator();r.type="sine",r.frequency.value=e;let o=kt.createOscillator();o.type="triangle",o.frequency.value=e*2.01;let a=kt.createGain();a.gain.setValueAtTime(1e-4,s),a.gain.linearRampToValueAtTime(.13-n*.022,s+.012),a.gain.exponentialRampToValueAtTime(1e-4,s+.75);let l=kt.createGain();l.gain.value=.22,r.connect(a),o.connect(l),l.connect(a),a.connect(hn),r.start(s),r.stop(s+.8),o.start(s),o.stop(s+.8)})}function sf(){if(!Ii)return;let i=kt.currentTime;[[196,.34,.13],[430,.2,.085],[720,.1,.055]].forEach(([s,r,o])=>{let a=kt.createOscillator();a.type="triangle",a.frequency.setValueAtTime(s*1.06,i),a.frequency.exponentialRampToValueAtTime(s,i+.03);let l=kt.createGain();l.gain.setValueAtTime(1e-4,i),l.gain.linearRampToValueAtTime(r,i+.004),l.gain.exponentialRampToValueAtTime(1e-4,i+o),a.connect(l),l.connect(hn),a.start(i),a.stop(i+o+.05)});let t=Ws(),e=kt.createBiquadFilter();e.type="bandpass",e.frequency.value=2100,e.Q.value=1.2;let n=kt.createGain();n.gain.setValueAtTime(1e-4,i),n.gain.linearRampToValueAtTime(.16,i+.003),n.gain.exponentialRampToValueAtTime(1e-4,i+.055),t.connect(e),e.connect(n),n.connect(hn),t.start(i),t.stop(i+.08)}function uh(i=1){if(!Ii)return;let t=kt.currentTime,e=kt.createOscillator();e.type="sine",e.frequency.setValueAtTime(1180*i,t),e.frequency.exponentialRampToValueAtTime(1760*i,t+.12);let n=kt.createGain();n.gain.setValueAtTime(1e-4,t),n.gain.linearRampToValueAtTime(.07,t+.02),n.gain.exponentialRampToValueAtTime(1e-4,t+.35),e.connect(n),n.connect(hn),e.start(t),e.stop(t+.4)}var Pi=null;function yl(i){if(!Ii)return;if(i<=.001){if(Pi){Pi.g.gain.setTargetAtTime(1e-4,kt.currentTime,.05);let e=Pi;Pi=null,setTimeout(()=>{try{e.src.stop()}catch{}},400)}return}if(!Pi){let e=Ws(),n=kt.createBiquadFilter();n.type="bandpass",n.frequency.value=420,n.Q.value=2.2;let s=kt.createGain();s.gain.value=1e-4,e.connect(n),n.connect(s),s.connect(hn),e.start(),Pi={src:e,bp:n,g:s}}let t=kt.currentTime;Pi.g.gain.setTargetAtTime(.02+i*.1,t,.04),Pi.bp.frequency.setTargetAtTime(360+i*620,t,.06)}function I_(i){return i<0?0:i>1?1:i}var Kt={INTRO:"intro",OVERVIEW:"overview",APPROACH:"approach",DIG:"dig",GRAB:"grab",PULL:"pull",POP:"pop",CARRY:"carry",BOX:"box",REFILL:"refill"},rf=.135,dh=4,of=12,Ml=class{constructor({renderer:t,scene:e,camera:n,container:s,quality:r}){this.renderer=t,this.scene=e,this.camera=n,this.container=s,this.quality=r,this.rng=Oe(20260819),this.field=new fl(t),e.add(this.field.group),this.world=Gd(e,t,r),this.fx=new gl(e,this.field.soilMap),this.rig=new xl(n),this.hint=new _l(s),this.mitten=Jd(this.field.grain),e.add(this.mitten),this.hand=new vl(this.mitten),this.spots=[];for(let a=0;a<dh;a++){let l=qd({seed:a+1,aniso:Math.min(8,t.capabilities.getMaxAnisotropy()),leafHeight:.125+this.rng()*.032,fronds:13+(this.rng()*4|0)});e.add(l);let c=Yd(this.field.soilMap,this.field.soilBump);e.add(c);let h=Zd(this.field.soilMap);h.visible=!1,e.add(h),this.spots.push({x:0,z:0,y:0,plant:l,cap:c,hole:h,marker:new Yr(e),leafHeight:l.userData.leafHeight,capAmount:1,done:!0,revealed:!1,rise:0})}this.crate=this.world.crate,this.cratePile=new Se,this.crate.add(this.cratePile),this.crateCount=0,this.crateMarker=new Yr(e);let o=new R;this.crate.getWorldPosition(o),this.crateMarker.setAt(o.x,o.y+.24,o.z),this.raycaster=new Dr,this.ndc=new it,this.pointer={down:!1,x:0,y:0,px:0,py:0,moved:0},this.lastWorld=new R,this.hasLastWorld=!1,this.timeScale=1,this.timeScaleTarget=1,this.freezeT=0,this.idleT=0,this.state=Kt.INTRO,this.stateT=0,this.active=null,this.pullPx=0,this.pullProgress=0,this.digUp=0,this.digSide=0,this.shortcuts=0,this.carried=!1,this.audioStarted=!1,this.tmpV=new R,this.tmpV2=new R,this.plane=new yn,this._up=new R(0,1,0),this.cratePos=new R,this.newRound(!0),this.enterIntro()}get aspect(){return this.container.clientWidth/this.container.clientHeight}newRound(t=!1){let e=[-rh,0,rh],n=[],s=0;for(;n.length<dh&&s++<500;){let o=e[this.rng()*e.length|0],a=-1.02+this.rng()*2.04;n.some(l=>Math.hypot(l.x-o,l.z-a)<.52)||n.push({x:o,z:a})}for(;n.length<dh;)n.push({x:e[n.length%3],z:-.9+n.length*.6});n.sort((o,a)=>a.z-o.z);for(let o=0;o<this.spots.length;o++){let a=this.spots[o];a.x=n[o].x,a.z=n[o].z,a.y=Dn(a.x,a.z),a.done=!1,a.revealed=!1,a.capAmount=1,a.rise=0,a.plant.position.set(a.x,a.y+.011,a.z),a.plant.rotation.set(0,this.rng()*6.28,0),a.plant.scale.setScalar(1),a.plant.visible=t,a.plant.userData.setStretch(0),a.plant.userData.setDirt(.8),a.cap.position.set(a.x,a.y-.004,a.z),a.cap.rotation.y=this.rng()*6.28,a.cap.scale.setScalar(1),a.cap.visible=t,a.hole.position.set(a.x,a.y+.005,a.z),a.hole.visible=!1,a.marker.setAt(a.x,a.y+.22,a.z),a.marker.show(!1)}let r=this.spots.map(o=>{let a=o.plant.userData.leafProfile;return{x:o.x,z:o.z,baseY:o.plant.position.y,bin:a.bin,prof:a.max,margin:.028}});t?this.field.reset(!0,r):this.field.startRegrow(r)}get remaining(){return this.spots.filter(t=>!t.done)}overviewPose(){return Gs(new R(0,.16,-.1),.03,25,.78,this.camera,2.25)}workPose(t){return Gs(new R(t.x,t.y+.06,t.z),.16+t.x*.18,45,.3,this.camera,.72)}closePose(t){return Gs(new R(t.x,t.y+.07,t.z),.2+t.x*.18,38,.215,this.camera,.58)}pullPose(t){return Gs(new R(t.x,t.y+.095,t.z),.22+t.x*.16,30,.195,this.camera,.54)}carryPose(t){let e=new R;this.crate.getWorldPosition(e);let n=t.x-e.x,s=t.z-e.z,r=Math.max(.6,Math.hypot(n,s)),o=Math.atan2(n,s),a=new R((t.x+e.x)/2,t.y+.3,(t.z+e.z)/2),l=.58*r+.95,c=32*Math.PI/180;return{pos:new R(a.x+Math.sin(o)*l*Math.cos(c),a.y+l*Math.sin(c),a.z+Math.cos(o)*l*Math.cos(c)),look:a.clone()}}currentPose(){let t=this.active;switch(this.state){case Kt.INTRO:case Kt.OVERVIEW:case Kt.REFILL:return this.overviewPose();case Kt.APPROACH:case Kt.DIG:return t?t.revealed?this.closePose(t):this.workPose(t):this.overviewPose();case Kt.GRAB:case Kt.PULL:case Kt.POP:return t?this.pullPose(t):this.overviewPose();case Kt.CARRY:case Kt.BOX:return t?this.carryPose(t):this.overviewPose();default:return this.overviewPose()}}refreshPose(){let t=this.currentPose();this.rig.goTo(t.pos,t.look,.35,En)}setState(t){this.state=t,this.stateT=0}enterIntro(){let t=this.overviewPose();this.rig.set(new R(t.pos.x+2.6,t.pos.y*1.75+.5,t.pos.z*1.55),new R(-2.2,.5,-3.4),this.camera.fov),this.rig.goTo(t.pos,t.look,5.5,En),this.setState(Kt.INTRO),this.hint.set("none")}enterOverview(t=1.5){let e=this.overviewPose();this.rig.goTo(e.pos,e.look,t,En),this.setState(Kt.OVERVIEW),this.hand.show(!1);for(let n of this.spots)n.marker.show(!n.done);this.crateMarker.show(!1),this.hint.set("tap"),this.idleT=0}selectSpot(t){this.active=t;for(let n of this.spots)n.marker.show(!1);let e=this.workPose(t);this.rig.goTo(e.pos,e.look,1.35,En),this.setState(Kt.APPROACH),uh(1.1)}enterDig(){this.setState(Kt.DIG),this.hand.setGrip(0);let t=this.active;this.hand.pos.set(t.x,t.y+.3,t.z+.12),this.hand.target.copy(this.hand.pos),this.hint.set("sweep"),this.idleT=0}enterGrab(){let t=this.active;this.hand.show(!1);let e=this.pullPose(t);this.rig.goTo(e.pos,e.look,1,En),this.setState(Kt.GRAB),this.pullPx=0,this.pullProgress=0,this.hand.setGrip(1),this.hint.set("pull"),this.idleT=0,t.marker.show(!1),uh(1.3)}enterPull(){this.setState(Kt.PULL),this.hint.set("none"),this.hand.setGrip(1)}enterPop(){let t=this.active;this.setState(Kt.POP),this.hint.set("none"),this.hand.show(!1),yl(0),ef();let e=t.x,n=t.z,s=t.y;this.fx.popFlare(new R(e,s+.1,n)),this.fx.burstSparkle(e,s+.1,n,18,1.3),this.fx.puffSoil(e,s+.02,n,.25,1.6),this.fx.puffSnow(e,s+.04,n,0,0,.12),this.rig.addShake(.5),t.hole.visible=!0,t.plant.userData.setStretch(0),t.plant.userData.setDirt(.54),t.cap.visible=!1,this.popFrom=t.rise,this.popT=0,this.held=!1;let r=Gs(new R(t.x,t.y+.13,t.z),.22+t.x*.16,26,.17,this.camera,.48);this.rig.goTo(r.pos,r.look,2.2,ih)}enterCarry(){let t=this.active;this.setState(Kt.CARRY);let e=this.carryPose(t);this.rig.goTo(e.pos,e.look,1.3,En),this.crateMarker.show(!0),this.carried=!1,this.idleT=0,this.carryPos=new R(t.x,t.y+.3,t.z),this.hint.set("carry")}enterBox(){this.setState(Kt.BOX),this.hint.set("none"),this.crateMarker.show(!1);let t=this.active,e=new R;this.crate.getWorldPosition(e),this.boxFrom=this.carryPos.clone(),this.boxTo=e.clone(),this.boxTo.y+=.16,this.boxT=0}enterRefill(){this.setState(Kt.REFILL),this.hint.set("none");let t=this.overviewPose();this.rig.goTo(new R(t.pos.x,t.pos.y*1.18,t.pos.z*1.12),new R(0,.25,-.2),2,En),this.world.setSnowfallIntensity(3.2),this.newRound(!1)}surfaceHeight(t,e){return this.field.inside(t,e)?Dn(t,e)+this.field.snowAt(t,e):cn(t,e)}raySurface(t){let e=this.raycaster.ray,n=e.origin,s=e.direction,r=.02,o=16;s.y<-1e-4&&(r=Math.max(r,(.55-n.y)/s.y),o=Math.min(o,(-.45-n.y)/s.y)),o>r||(r=.02,o=16);let a=d=>{let u=n.x+s.x*d,f=n.y+s.y*d,g=n.z+s.z*d;return f-this.surfaceHeight(u,g)},l=r,c=a(r),h=64;for(let d=1;d<=h;d++){let u=r+(o-r)*d/h,f=a(u);if(c>0&&f<=0){let g=l,_=u;for(let m=0;m<12;m++){let M=(g+_)/2;a(M)>0?g=M:_=M}let p=(g+_)/2;return t.set(n.x+s.x*p,n.y+s.y*p,n.z+s.z*p),!0}l=u,c=f}return!1}setRayFromScreen(t,e){let n=this.container.clientWidth,s=this.container.clientHeight;this.ndc.set(t/n*2-1,-(e/s)*2+1),this.raycaster.setFromCamera(this.ndc,this.camera)}toScreen(t){let e=this.container.clientWidth,n=this.container.clientHeight;return this.tmpV2.copy(t).project(this.camera),{x:(this.tmpV2.x*.5+.5)*e,y:(-this.tmpV2.y*.5+.5)*n}}onDown(t,e){if(this.audioStarted||(this.audioStarted=jd()),tf(),this.pointer.down=!0,this.pointer.x=this.pointer.px=t,this.pointer.y=this.pointer.py=e,this.pointer.moved=0,this.digUp=0,this.digSide=0,this.hasLastWorld=!1,this.idleT=0,this.state===Kt.INTRO){this.enterOverview(1.1);return}if(this.state===Kt.OVERVIEW&&!this.rig.moving){this.setRayFromScreen(t,e);let n=this.raySurface(this.tmpV),s=this.remaining;if(!s.length)return;let r=s[0],o=1/0;for(let a of s){let l=n?Math.hypot(a.x-this.tmpV.x,a.z-this.tmpV.z):Math.hypot(this.toScreen(new R(a.x,a.y+.1,a.z)).x-t,this.toScreen(new R(a.x,a.y+.1,a.z)).y-e);l<o&&(o=l,r=a)}this.selectSpot(r);return}if(this.state===Kt.GRAB){this.enterPull();return}this.state===Kt.CARRY&&(this.carried=!0,this.hint.set("none"))}onMove(t,e){let n=t-this.pointer.x,s=e-this.pointer.y;this.pointer.px=this.pointer.x,this.pointer.py=this.pointer.y,this.pointer.x=t,this.pointer.y=e,this.pointer.down&&(this.pointer.moved+=Math.hypot(n,s),this.idleT=0,this.state===Kt.DIG?(this.sweep(t,e),s<0&&(this.digUp+=-s),this.digSide+=Math.abs(n),this.active&&this.active.revealed&&this.digUp>this.pullNeed()*.42&&this.digUp>this.digSide*.9&&(this.shortcuts++,this.forceUncover())):this.state===Kt.PULL?(s<0&&(this.pullPx+=-s),this.pullPx+=Math.abs(n)*.18):this.state===Kt.CARRY&&this.carried&&this.dragCarrot(t,e))}onUp(){this.pointer.down=!1,this.hasLastWorld=!1,yl(0),this.state===Kt.PULL&&(this.pullPx*=.72,this.setState(Kt.GRAB),this.hint.set("pull")),this.state===Kt.CARRY&&(this.carried=!1)}sweep(t,e){if(this.setRayFromScreen(t,e),!this.raySurface(this.tmpV))return;let n=this.tmpV,s=this.active,r=n.x,o=n.z,a=1;if(this.hasLastWorld){let u=Math.hypot(n.x-this.lastWorld.x,n.z-this.lastWorld.z);a=Ji(Math.ceil(u/.028),1,14)}let l=0,c=0,h=0;for(let u=1;u<=a;u++){let f=a===1?1:u/a,g=this.hasLastWorld?Xt(this.lastWorld.x,n.x,f):n.x,_=this.hasLastWorld?Xt(this.lastWorld.z,n.z,f):n.z;if(!this.field.inside(g,_))continue;let p=this.hasLastWorld?.03:.016;this.field.snowAt(g,_)>.004?l+=this.field.brush(g,_,rf,p):(this.field.scrub(g,_,rf*.8,p*1.2),this.rng()<.16&&this.fx.puffSoil(g,Dn(g,_),_,.04,.45),l+=4e-4),r=g,o=_}this.hasLastWorld&&(c=n.x-this.lastWorld.x,h=n.z-this.lastWorld.z);let d=Math.hypot(c,h)*60;if(s&&Math.hypot(r-s.x,o-s.z)<.19&&this.field.snowAround(s.x,s.z,.075)<.055&&s.capAmount>0){let f=s.capAmount;s.capAmount=Math.max(0,s.capAmount-(.01+Math.min(.05,d*.02))),f>s.capAmount&&this.fx.puffSoil(r,Dn(r,o)+.01,o,.05,.6)}if(l>15e-5){let u=this.field.snowAt(r,o)<=.006;this.fx.puffSnow(r,this.surfaceHeight(r,o),o,c*8,h*8,Math.min(.05,l*(u?.2:1))),hh(ce(d*.55),u?.9:0)}this.hand.moveTo(r,this.surfaceHeight(r,o),o,c,h,Math.min(1,d*.5)),this.lastWorld.set(n.x,n.y,n.z),this.hasLastWorld=!0}forceUncover(){let t=this.active;for(let n=0;n<24;n++){let s=n/24*Math.PI*2;for(let r=0;r<=6;r++)this.field.brush(t.x+Math.cos(s)*r*.026,t.z+Math.sin(s)*r*.026,.105,.8)}this.field.scrub(t.x,t.z,.15,.5),t.capAmount=0,this.fx.puffSnow(t.x,this.surfaceHeight(t.x,t.z),t.z,0,0,.07),this.fx.puffSoil(t.x,t.y+.012,t.z,.09,.8),hh(1,.35);let e=this.digUp;this.enterGrab(),this.enterPull(),this.pullPx=e}dragCarrot(t,e){this.setRayFromScreen(t,e),this.plane.set(this._up,-this.carryPos.y);let n=this.tmpV2;this.raycaster.ray.intersectPlane(this.plane,n)&&(this.carryPos.x=Xt(this.carryPos.x,n.x,.6),this.carryPos.z=Xt(this.carryPos.z,n.z,.6));let s=this.surfaceHeight(this.carryPos.x,this.carryPos.z)+.24;this.carryPos.y=an(this.carryPos.y,s,7,1/60)}crateSlot(t){let e=t%of,n=Math.floor(e/6),s=e%6,r=s%3,o=Math.floor(s/3);return new R(-.13+r*.13+(n?.045:0),.035+n*.045,-.06+o*.115+(n?.02:0))}addToCrate(){let t=$d(4),e=this.crateSlot(this.crateCount);if(t.position.copy(e),t.rotation.set(Math.PI/2+(this.rng()-.5)*.4,this.rng()*6.28,(this.rng()-.5)*.5),this.cratePile.add(t),this.crateCount++,this.cratePile.children.length>of){let n=this.cratePile.children[0];this.cratePile.remove(n)}}update(t){this.freezeT>0&&(this.freezeT-=t,this.freezeT<=0&&(this.timeScaleTarget=1)),this.timeScale=an(this.timeScale,this.timeScaleTarget,9,t);let e=t*this.timeScale;this.stateT+=t,this.pointer.down||(this.idleT+=t),this.field.update(e),this.world.update(e,this.camera,this.renderer.getPixelRatio()),this.fx.update(e,(n,s)=>this.surfaceHeight(n,s),this.renderer.getPixelRatio());for(let n of this.spots)n.marker.update(e);this.crateMarker.update(e),this.hand.update(t,this.camera),this.rig.update(t);for(let n of this.spots)!n.done&&n.plant.visible&&n.plant.userData.setWind(this.stateT+n.x*3);switch(this.state){case Kt.INTRO:this.tickIntro(t);break;case Kt.OVERVIEW:this.tickOverview(t);break;case Kt.APPROACH:this.tickApproach(t);break;case Kt.DIG:this.tickDig(t);break;case Kt.GRAB:this.tickGrab(t);break;case Kt.PULL:this.tickPull(t);break;case Kt.POP:this.tickPop(t);break;case Kt.CARRY:this.tickCarry(t);break;case Kt.BOX:this.tickBox(t);break;case Kt.REFILL:this.tickRefill(t);break}this.hint.update(t)}tickIntro(){this.stateT>5.2&&this.enterOverview(1.2)}tickOverview(t){if(this.rig.moving)return;let e=this.remaining;if(!e.length){this.enterRefill();return}let n=e[0],s=this.toScreen(this.tmpV.set(n.x,this.field.surfaceY(n.x,n.z)+.02,n.z));this.hint.set("tap",s),this.hint.setAnchor(s.x,s.y),this.idleT>11&&this.selectSpot(n)}tickApproach(){this.rig.moving||this.enterDig()}tickDig(t){let e=this.active,n=this.field.snowAround(e.x,e.z,.075),s=ce(e.capAmount);if(e.cap.visible=s>.04,e.cap.scale.set(Xt(.55,1,s),Xt(.15,1,s),Xt(.55,1,s)),!e.revealed&&n<e.leafHeight-.004){e.revealed=!0,nf(),this.fx.burstSparkle(e.x,e.y+e.leafHeight*.85,e.z,12,.45);let o=this.closePose(e);this.rig.goTo(o.pos,o.look,1.5,En)}let r=this.toScreen(this.tmpV.set(e.x,e.y+n+.015,e.z));this.hint.setAnchor(r.x,r.y),this.hint.set(this.pointer.moved>40&&this.idleT<2.2?"none":"sweep"),this.hand.show(this.pointer.down),e.marker.show(!e.revealed,.55),n<.014&&e.capAmount<=.08&&this.enterGrab()}tickGrab(t){let e=this.active,n=this.toScreen(this.tmpV.set(e.x,e.y+e.leafHeight*.62,e.z));this.hint.setAnchor(n.x,n.y),this.hand.show(!1),this.pullProgress=an(this.pullProgress,this.pullPx/this.pullNeed(),6,t),this.applyRise(e,this.pullProgress)}pullNeed(){return Math.max(120,this.container.clientHeight*.2)}riseCurve(t){return t<.28?.055*(t/.28):t<.82?.055+.36*Math.pow((t-.28)/.54,1.25):.415+.3*((t-.82)/.18)}applyRise(t,e){let n=ce(e);t.rise=this.riseCurve(n)*ks;let s=n>.2?(Math.random()-.5)*.0022*n:0;t.plant.position.set(t.x+s,t.y+.004+t.rise,t.z+s*.6),t.plant.userData.setStretch(n*.85),n>.05&&(t.hole.visible=!0,t.hole.scale.setScalar(Xt(.35,1,ce(n*1.4))))}tickPull(t){let e=this.active;this.pointer.down&&(this.pullPx+=t*this.pullNeed()*.16);let n=this.pullPx/this.pullNeed(),s=this.pullProgress;this.pullProgress=an(this.pullProgress,n,14,t),this.applyRise(e,this.pullProgress),yl(ce(this.pullProgress*1.1)),this.pullProgress-s>.0025&&(this.rng()<.55&&this.fx.puffSoil(e.x,e.y+.01,e.z,.03,.35),this.field.scrub(e.x,e.z,.11,.02),this.rig.addShake(.05));let r=this.toScreen(this.tmpV.set(e.x,e.y+e.leafHeight*.55+e.rise,e.z));this.hint.setAnchor(r.x,r.y),this.pullProgress>=.995&&this.enterPop()}tickPop(t){let e=this.active;this.popT+=t;let n=ce(this.popT/.34),s=bd(n),r=ks*1.06+.045;e.rise=Xt(this.popFrom,r,s),e.plant.position.set(e.x,e.y+.004+e.rise,e.z),e.plant.rotation.z=Math.sin(n*Math.PI)*.22,e.plant.rotation.x=Math.sin(n*Math.PI*1.4)*.1,e.plant.userData.setStretch(Xt(.85,0,n)),!this.held&&n>=1&&(this.held=!0,this.freezeT=.62,this.timeScaleTarget=.14),this.stateT>2&&this.enterCarry()}tickCarry(t){let e=this.active,n=this.cratePos;this.crate.getWorldPosition(n),this.carried||(this.carryPos.y=an(this.carryPos.y,e.y+.34,4,t)+Math.sin(this.stateT*2.4)*.0016),(!this.carried&&this.idleT>2.2||this.stateT>7)&&this.carryPos.lerp(this.tmpV.set(n.x,n.y+.3,n.z),1-Math.exp(-2*t)),e.plant.position.copy(this.carryPos),e.plant.rotation.x=an(e.plant.rotation.x,.16,5,t),e.plant.rotation.z=an(e.plant.rotation.z,Math.sin(this.stateT*1.6)*.12,5,t),e.plant.userData.setStretch(Math.min(.7,this.stateT*1.1));let s=this.toScreen(this.carryPos),r=this.toScreen(this.tmpV.set(n.x,n.y+.22,n.z));this.hint.setAnchor(s.x,s.y),this.hint.setSecondary(r.x,r.y),!this.carried&&this.idleT>.8&&this.hint.set("carry"),Math.hypot(this.carryPos.x-n.x,this.carryPos.z-n.z)<.42&&this.stateT>.5&&this.enterBox()}tickBox(t){let e=this.active;this.boxT+=t;let n=ce(this.boxT/.5),s=ih(n);if(e.plant.position.lerpVectors(this.boxFrom,this.boxTo,s),e.plant.position.y+=Math.sin(n*Math.PI)*.09,e.plant.rotation.x=Xt(e.plant.rotation.x,Math.PI*.5,s*.6),e.plant.scale.setScalar(Xt(1,.85,s)),n>=1&&!e.done){e.done=!0,e.plant.visible=!1,e.hole.visible=!1,e.cap.visible=!1,sf(),this.addToCrate();let r=this.boxTo;this.fx.burstSparkle(r.x,r.y,r.z,16,.55),this.rig.addShake(.14)}this.boxT>1.15&&(this.remaining.length?this.enterOverview(1.6):this.enterRefill())}tickRefill(t){if(this.world.setSnowfallIntensity(Xt(1,3.4,Math.sin(ce(this.stateT/3.4)*Math.PI))),this.stateT>2.2)for(let e of this.spots)e.plant.visible=!0,e.cap.visible=!0;this.stateT>4.2&&(this.world.setSnowfallIntensity(1),this.enterOverview(1.6))}};var fh={low:{texBig:256,shadowMap:512,groundSeg:86,snowflakes:220,maxDpr:1.5,shadows:!0},mid:{texBig:512,shadowMap:1024,groundSeg:130,snowflakes:380,maxDpr:2,shadows:!0},high:{texBig:512,shadowMap:2048,groundSeg:172,snowflakes:560,maxDpr:2,shadows:!0}};function D_(){let i=navigator.userAgent,t=/iPad|iPhone|iPod/.test(i)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,e=/Android/i.test(i),n=t||e,s=navigator.deviceMemory||(n?4:8),r=navigator.hardwareConcurrency||4,o="high";return n&&(o=s>=4&&r>=6?"mid":"low"),!n&&(r<=4||s<=4)&&(o="mid"),{tier:o,...fh[o],mobile:n,iOS:t}}function af(){let i=document.getElementById("app"),t=document.getElementById("loader"),e=new URLSearchParams(location.search),n=D_(),s=e.get("q");s&&fh[s]&&Object.assign(n,fh[s],{tier:s});let r;try{r=new ol({antialias:n.tier!=="low",alpha:!1,stencil:!1,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1})}catch{document.getElementById("fallback").style.display="flex",t.style.display="none";return}if(!r.getContext()){document.getElementById("fallback").style.display="flex",t.style.display="none";return}let o=parseFloat(e.get("dpr")),a=o>0?o:Math.min(window.devicePixelRatio||1,n.maxDpr),l=o>0;r.setPixelRatio(a),r.outputColorSpace=De,r.toneMapping=Ur,r.toneMappingExposure=.9,r.shadowMap.enabled=n.shadows,r.shadowMap.type=qi,r.domElement.id="view",i.appendChild(r.domElement);let c=new hr,h=new Ze(46,1,.04,620),d=null,u=0;function f(){let x=i.clientWidth||window.innerWidth,T=i.clientHeight||window.innerHeight;r.setSize(x,T,!1);let P=x/T;h.aspect=P,h.fov=P<1?Ji(46+(1-P)*20,46,62):46,h.updateProjectionMatrix(),d&&(d.rig.fov=h.fov,Math.abs(P-u)>.01&&d.refreshPose()),u=P}f(),d=new Ml({renderer:r,scene:c,camera:h,container:i,quality:n}),d.rig.fov=h.fov,window.addEventListener("resize",f),window.addEventListener("orientationchange",()=>setTimeout(f,120)),window.visualViewport&&window.visualViewport.addEventListener("resize",f);let g=r.domElement,_=null,p=x=>{let T=g.getBoundingClientRect();return[x.clientX-T.left,x.clientY-T.top]};g.addEventListener("pointerdown",x=>{if(_!==null&&_!==x.pointerId){try{g.releasePointerCapture(_)}catch{}d.onUp()}_=x.pointerId;try{g.setPointerCapture(x.pointerId)}catch{}let[T,P]=p(x);d.onDown(T,P),x.preventDefault()},{passive:!1}),g.addEventListener("pointermove",x=>{if(_!==x.pointerId)return;let[T,P]=p(x);d.onMove(T,P),x.preventDefault()},{passive:!1});let m=x=>{_===x.pointerId&&(_=null,d.onUp(),x.preventDefault())};g.addEventListener("pointerup",m,{passive:!1}),g.addEventListener("pointercancel",m,{passive:!1}),document.addEventListener("touchmove",x=>x.preventDefault(),{passive:!1}),document.addEventListener("gesturestart",x=>x.preventDefault()),g.addEventListener("contextmenu",x=>x.preventDefault());let M=performance.now(),S=0,y=0,w=0,E=!0;document.addEventListener("visibilitychange",()=>{E=!document.hidden,M=performance.now()});function C(){if(requestAnimationFrame(C),!E)return;let x=performance.now(),T=Math.min((x-M)/1e3,1/20);if(M=x,d.update(T),r.render(c,h),!l&&(S+=T,y++,y>=45)){let P=S/y,I=Math.min(window.devicePixelRatio||1,n.maxDpr);P>.0235&&a>1?(w++,w>=2&&(a=Math.max(1,a-.25),r.setPixelRatio(a),f(),w=0)):(P<.0142&&a<I&&(a=Math.min(I,a+.25),r.setPixelRatio(a),f()),w=0),S=0,y=0}}r.compile(c,h),r.render(c,h),C(),t.classList.add("gone"),setTimeout(()=>{t.style.display="none"},700),window.__step=(x=1/60,T=1)=>{for(let P=0;P<T;P++)d.update(x);M=performance.now()},window.__render=()=>r.render(c,h),window.__game=d,window.__renderer=r}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",af):af();})();
