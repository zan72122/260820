(()=>{var eu=0,dc=1,nu=2;var qi=1,iu=2,Ps=3,si=0,Ue=1,Je=2,Xn=0,Cn=1,ai=2,fc=3,pc=4,su=5;var _i=100,ru=101,au=102,ou=103,lu=104,cu=200,hu=201,uu=202,du=203,Ea=204,Ta=205,fu=206,pu=207,mu=208,gu=209,xu=210,_u=211,vu=212,yu=213,Mu=214,wa=0,Aa=1,Ra=2,Vi=3,Ca=4,Pa=5,Ia=6,La=7,mc=0,Su=1,bu=2,In=0,gc=1,xc=2,_c=3,Dr=4,vc=5,yc=6,Mc=7;var Sc=300,Ei=301,Yi=302,fo=303,po=304,Nr=306,vi=1e3,yn=1001,Da=1002,ze=1003,Eu=1004;var Ur=1005;var Ie=1006,mo=1007;var Ti=1008;var rn=1009,bc=1010,Ec=1011,Is=1012,go=1013,Ln=1014,Sn=1015,qn=1016,xo=1017,_o=1018,Ls=1020,Tc=35902,wc=35899,Ac=1021,Rc=1022,an=1023,zn=1026,wi=1027,vo=1028,yo=1029,Ai=1030,Mo=1031;var So=1033,Fr=33776,Or=33777,Br=33778,zr=33779,bo=35840,Eo=35841,To=35842,wo=35843,Ao=36196,Ro=37492,Co=37496,Po=37488,Io=37489,Vr=37490,Lo=37491,Do=37808,No=37809,Uo=37810,Fo=37811,Oo=37812,Bo=37813,zo=37814,Vo=37815,ko=37816,Ho=37817,Go=37818,Wo=37819,Xo=37820,qo=37821,Yo=36492,Zo=36494,$o=36495,Jo=36283,Ko=36284,kr=36285,Qo=36286;var er=2300,Na=2301,ba=2302,Kl=2303,Ql=2400,jl=2401,tc=2402;var Tu=3200;var jo=0,wu=1,oi="",Ne="srgb",nr="srgb-linear",ir="linear",ue="srgb";var Oi=7680;var ec=519,Au=512,Ru=513,Cu=514,tl=515,Pu=516,Iu=517,el=518,Lu=519,Ua=35044,Cc=35048;var Pc="300 es",Rn=2e3,_s=2001;function df(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function ff(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function sr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Du(){let i=sr("canvas");return i.style.display="block",i}var Mh={},vs=null;function rr(...i){let t="THREE."+i.shift();vs?vs("log",t,...i):console.log(t,...i)}function Nu(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Ot(...i){i=Nu(i);let t="THREE."+i.shift();if(vs)vs("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Ut(...i){i=Nu(i);let t="THREE."+i.shift();if(vs)vs("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function zi(...i){let t=i.join(" ");t in Mh||(Mh[t]=!0,Ot(...i))}function Uu(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var Fu={[wa]:Aa,[Ra]:Ia,[Ca]:La,[Vi]:Pa,[Aa]:wa,[Ia]:Ra,[La]:Ca,[Pa]:Vi},Vn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Ye=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var bl=Math.PI/180,Fa=180/Math.PI;function ni(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ye[i&255]+Ye[i>>8&255]+Ye[i>>16&255]+Ye[i>>24&255]+"-"+Ye[t&255]+Ye[t>>8&255]+"-"+Ye[t>>16&15|64]+Ye[t>>24&255]+"-"+Ye[e&63|128]+Ye[e>>8&255]+"-"+Ye[e>>16&255]+Ye[e>>24&255]+Ye[n&255]+Ye[n>>8&255]+Ye[n>>16&255]+Ye[n>>24&255]).toLowerCase()}function ne(i,t,e){return Math.max(t,Math.min(e,i))}function pf(i,t){return(i%t+t)%t}function El(i,t,e){return(1-e)*i+e*t}function Bn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function pe(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Fc=class Fc{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=ne(this.x,t.x,e.x),this.y=ne(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=ne(this.x,t,e),this.y=ne(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ne(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ne(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Fc.prototype.isVector2=!0;var et=Fc,Mn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],d=n[s+3],u=r[a+0],f=r[a+1],g=r[a+2],_=r[a+3];if(d!==_||l!==u||c!==f||h!==g){let p=l*u+c*f+h*g+d*_;p<0&&(u=-u,f=-f,g=-g,_=-_,p=-p);let m=1-o;if(p<.9995){let M=Math.acos(p),S=Math.sin(M);m=Math.sin(m*M)/S,o=Math.sin(o*M)/S,l=l*m+u*o,c=c*m+f*o,h=h*m+g*o,d=d*m+_*o}else{l=l*m+u*o,c=c*m+f*o,h=h*m+g*o,d=d*m+_*o;let M=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=M,c*=M,h*=M,d*=M}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=d}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],d=r[a],u=r[a+1],f=r[a+2],g=r[a+3];return t[e]=o*g+h*d+l*f-c*u,t[e+1]=l*g+h*u+c*d-o*f,t[e+2]=c*g+h*f+o*u-l*d,t[e+3]=h*g-o*d-l*u-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),d=o(r/2),u=l(n/2),f=l(s/2),g=l(r/2);switch(a){case"XYZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"YXZ":this._x=u*h*d+c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"ZXY":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d-u*f*g;break;case"ZYX":this._x=u*h*d-c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d+u*f*g;break;case"YZX":this._x=u*h*d+c*f*g,this._y=c*f*d+u*h*g,this._z=c*h*g-u*f*d,this._w=c*h*d-u*f*g;break;case"XZY":this._x=u*h*d-c*f*g,this._y=c*f*d-u*h*g,this._z=c*h*g+u*f*d,this._w=c*h*d+u*f*g;break;default:Ot("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],d=e[10],u=n+o+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(n>o&&n>d){let f=2*Math.sqrt(1+n-o-d);this._w=(h-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>d){let f=2*Math.sqrt(1+o-n-d);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+d-n-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(ne(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=this.dot(t);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-e;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},Oc=class Oc{constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Sh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Sh.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),h=2*(o*e-r*s),d=2*(r*n-a*e);return this.x=e+l*c+a*d-o*h,this.y=n+l*h+o*c-r*d,this.z=s+l*d+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=ne(this.x,t.x,e.x),this.y=ne(this.y,t.y,e.y),this.z=ne(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=ne(this.x,t,e),this.y=ne(this.y,t,e),this.z=ne(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ne(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Tl.copy(this).projectOnVector(t),this.sub(Tl)}reflect(t){return this.sub(Tl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ne(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Oc.prototype.isVector3=!0;var C=Oc,Tl=new C,Sh=new Mn,Bc=class Bc{constructor(t,e,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],g=n[8],_=s[0],p=s[3],m=s[6],M=s[1],S=s[4],y=s[7],w=s[2],E=s[5],R=s[8];return r[0]=a*_+o*M+l*w,r[3]=a*p+o*S+l*E,r[6]=a*m+o*y+l*R,r[1]=c*_+h*M+d*w,r[4]=c*p+h*S+d*E,r[7]=c*m+h*y+d*R,r[2]=u*_+f*M+g*w,r[5]=u*p+f*S+g*E,r[8]=u*m+f*y+g*R,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],d=h*a-o*c,u=o*l-h*r,f=c*r-a*l,g=e*d+n*u+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/g;return t[0]=d*_,t[1]=(s*c-h*n)*_,t[2]=(o*n-s*a)*_,t[3]=u*_,t[4]=(h*e-s*l)*_,t[5]=(s*r-o*e)*_,t[6]=f*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*r)*_,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return zi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(wl.makeScale(t,e)),this}rotate(t){return zi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(wl.makeRotation(-t)),this}translate(t,e){return zi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(wl.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}};Bc.prototype.isMatrix3=!0;var Xt=Bc,wl=new Xt,bh=new Xt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Eh=new Xt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function mf(){let i={enabled:!0,workingColorSpace:nr,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ue&&(s.r=ii(s.r),s.g=ii(s.g),s.b=ii(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ue&&(s.r=xs(s.r),s.g=xs(s.g),s.b=xs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===oi?ir:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return zi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return zi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[nr]:{primaries:t,whitePoint:n,transfer:ir,toXYZ:bh,fromXYZ:Eh,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Ne},outputColorSpaceConfig:{drawingBufferColorSpace:Ne}},[Ne]:{primaries:t,whitePoint:n,transfer:ue,toXYZ:bh,fromXYZ:Eh,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Ne}}}),i}var ae=mf();function ii(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function xs(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var ts,Oa=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{ts===void 0&&(ts=sr("canvas")),ts.width=t.width,ts.height=t.height;let s=ts.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=ts}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=sr("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=ii(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(ii(e[n]/255)*255):e[n]=ii(e[n]);return{data:e,width:t.width,height:t.height}}else return Ot("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},gf=0,ys=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:gf++}),this.uuid=ni(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(Al(s[a].image)):r.push(Al(s[a]))}else r=Al(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Al(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Oa.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Ot("Texture: Unable to serialize Texture."),{})}var xf=0,Rl=new C,je=class i extends Vn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=yn,s=yn,r=Ie,a=Ti,o=an,l=rn,c=i.DEFAULT_ANISOTROPY,h=oi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xf++}),this.uuid=ni(),this.name="",this.source=new ys(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new et(0,0),this.repeat=new et(1,1),this.center=new et(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Xt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Rl).x}get height(){return this.source.getSize(Rl).y}get depth(){return this.source.getSize(Rl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Ot(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Ot(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Sc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case vi:t.x=t.x-Math.floor(t.x);break;case yn:t.x=t.x<0?0:1;break;case Da:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case vi:t.y=t.y-Math.floor(t.y);break;case yn:t.y=t.y<0?0:1;break;case Da:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};je.DEFAULT_IMAGE=null;je.DEFAULT_MAPPING=Sc;je.DEFAULT_ANISOTROPY=1;var zc=class zc{constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],g=l[9],_=l[2],p=l[6],m=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-_)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+_)<.1&&Math.abs(g+p)<.1&&Math.abs(c+f+m-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let S=(c+1)/2,y=(f+1)/2,w=(m+1)/2,E=(h+u)/4,R=(d+_)/4,x=(g+p)/4;return S>y&&S>w?S<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(S),s=E/n,r=R/n):y>w?y<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(y),n=E/s,r=x/s):w<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),n=R/r,s=x/r),this.set(n,s,r,e),this}let M=Math.sqrt((p-g)*(p-g)+(d-_)*(d-_)+(u-h)*(u-h));return Math.abs(M)<.001&&(M=1),this.x=(p-g)/M,this.y=(d-_)/M,this.z=(u-h)/M,this.w=Math.acos((c+f+m-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=ne(this.x,t.x,e.x),this.y=ne(this.y,t.y,e.y),this.z=ne(this.z,t.z,e.z),this.w=ne(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=ne(this.x,t,e),this.y=ne(this.y,t,e),this.z=ne(this.z,t,e),this.w=ne(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ne(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};zc.prototype.isVector4=!0;var be=zc,Ba=class extends Vn{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ie,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new be(0,0,t,e),this.scissorTest=!1,this.viewport=new be(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new je(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Ie,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new ys(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},dn=class extends Ba{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},ar=class extends je{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ze,this.minFilter=ze,this.wrapR=yn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var za=class extends je{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ze,this.minFilter=ze,this.wrapR=yn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var uo=class uo{constructor(t,e,n,s,r,a,o,l,c,h,d,u,f,g,_,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,h,d,u,f,g,_,p)}set(t,e,n,s,r,a,o,l,c,h,d,u,f,g,_,p){let m=this.elements;return m[0]=t,m[4]=e,m[8]=n,m[12]=s,m[1]=r,m[5]=a,m[9]=o,m[13]=l,m[2]=c,m[6]=h,m[10]=d,m[14]=u,m[3]=f,m[7]=g,m[11]=_,m[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new uo().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/es.setFromMatrixColumn(t,0).length(),r=1/es.setFromMatrixColumn(t,1).length(),a=1/es.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),d=Math.sin(r);if(t.order==="XYZ"){let u=a*h,f=a*d,g=o*h,_=o*d;e[0]=l*h,e[4]=-l*d,e[8]=c,e[1]=f+g*c,e[5]=u-_*c,e[9]=-o*l,e[2]=_-u*c,e[6]=g+f*c,e[10]=a*l}else if(t.order==="YXZ"){let u=l*h,f=l*d,g=c*h,_=c*d;e[0]=u+_*o,e[4]=g*o-f,e[8]=a*c,e[1]=a*d,e[5]=a*h,e[9]=-o,e[2]=f*o-g,e[6]=_+u*o,e[10]=a*l}else if(t.order==="ZXY"){let u=l*h,f=l*d,g=c*h,_=c*d;e[0]=u-_*o,e[4]=-a*d,e[8]=g+f*o,e[1]=f+g*o,e[5]=a*h,e[9]=_-u*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){let u=a*h,f=a*d,g=o*h,_=o*d;e[0]=l*h,e[4]=g*c-f,e[8]=u*c+_,e[1]=l*d,e[5]=_*c+u,e[9]=f*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){let u=a*l,f=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=_-u*d,e[8]=g*d+f,e[1]=d,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*d+g,e[10]=u-_*d}else if(t.order==="XZY"){let u=a*l,f=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=-d,e[8]=c*h,e[1]=u*d+_,e[5]=a*h,e[9]=f*d-g,e[2]=g*d-f,e[6]=o*h,e[10]=_*d+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(_f,t,vf)}lookAt(t,e,n){let s=this.elements;return hn.subVectors(t,e),hn.lengthSq()===0&&(hn.z=1),hn.normalize(),di.crossVectors(n,hn),di.lengthSq()===0&&(Math.abs(n.z)===1?hn.x+=1e-4:hn.z+=1e-4,hn.normalize(),di.crossVectors(n,hn)),di.normalize(),$r.crossVectors(hn,di),s[0]=di.x,s[4]=$r.x,s[8]=hn.x,s[1]=di.y,s[5]=$r.y,s[9]=hn.y,s[2]=di.z,s[6]=$r.z,s[10]=hn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],g=n[2],_=n[6],p=n[10],m=n[14],M=n[3],S=n[7],y=n[11],w=n[15],E=s[0],R=s[4],x=s[8],T=s[12],P=s[1],I=s[5],U=s[9],W=s[13],X=s[2],D=s[6],z=s[10],B=s[14],$=s[3],Q=s[7],ot=s[11],lt=s[15];return r[0]=a*E+o*P+l*X+c*$,r[4]=a*R+o*I+l*D+c*Q,r[8]=a*x+o*U+l*z+c*ot,r[12]=a*T+o*W+l*B+c*lt,r[1]=h*E+d*P+u*X+f*$,r[5]=h*R+d*I+u*D+f*Q,r[9]=h*x+d*U+u*z+f*ot,r[13]=h*T+d*W+u*B+f*lt,r[2]=g*E+_*P+p*X+m*$,r[6]=g*R+_*I+p*D+m*Q,r[10]=g*x+_*U+p*z+m*ot,r[14]=g*T+_*W+p*B+m*lt,r[3]=M*E+S*P+y*X+w*$,r[7]=M*R+S*I+y*D+w*Q,r[11]=M*x+S*U+y*z+w*ot,r[15]=M*T+S*W+y*B+w*lt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],d=t[6],u=t[10],f=t[14],g=t[3],_=t[7],p=t[11],m=t[15],M=l*f-c*u,S=o*f-c*d,y=o*u-l*d,w=a*f-c*h,E=a*u-l*h,R=a*d-o*h;return e*(_*M-p*S+m*y)-n*(g*M-p*w+m*E)+s*(g*S-_*w+m*R)-r*(g*y-_*E+p*R)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],a=t[5],o=t[9],l=t[2],c=t[6],h=t[10];return e*(a*h-o*c)-n*(r*h-o*l)+s*(r*c-a*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],d=t[9],u=t[10],f=t[11],g=t[12],_=t[13],p=t[14],m=t[15],M=e*o-n*a,S=e*l-s*a,y=e*c-r*a,w=n*l-s*o,E=n*c-r*o,R=s*c-r*l,x=h*_-d*g,T=h*p-u*g,P=h*m-f*g,I=d*p-u*_,U=d*m-f*_,W=u*m-f*p,X=M*W-S*U+y*I+w*P-E*T+R*x;if(X===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let D=1/X;return t[0]=(o*W-l*U+c*I)*D,t[1]=(s*U-n*W-r*I)*D,t[2]=(_*R-p*E+m*w)*D,t[3]=(u*E-d*R-f*w)*D,t[4]=(l*P-a*W-c*T)*D,t[5]=(e*W-s*P+r*T)*D,t[6]=(p*y-g*R-m*S)*D,t[7]=(h*R-u*y+f*S)*D,t[8]=(a*U-o*P+c*x)*D,t[9]=(n*P-e*U-r*x)*D,t[10]=(g*E-_*y+m*M)*D,t[11]=(d*y-h*E-f*M)*D,t[12]=(o*T-a*I-l*x)*D,t[13]=(e*I-n*T+s*x)*D,t[14]=(_*S-g*w-p*M)*D,t[15]=(h*w-d*S+u*M)*D,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,d=o+o,u=r*c,f=r*h,g=r*d,_=a*h,p=a*d,m=o*d,M=l*c,S=l*h,y=l*d,w=n.x,E=n.y,R=n.z;return s[0]=(1-(_+m))*w,s[1]=(f+y)*w,s[2]=(g-S)*w,s[3]=0,s[4]=(f-y)*E,s[5]=(1-(u+m))*E,s[6]=(p+M)*E,s[7]=0,s[8]=(g+S)*R,s[9]=(p-M)*R,s[10]=(1-(u+_))*R,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let a=es.set(s[0],s[1],s[2]).length(),o=es.set(s[4],s[5],s[6]).length(),l=es.set(s[8],s[9],s[10]).length();r<0&&(a=-a),Tn.copy(this);let c=1/a,h=1/o,d=1/l;return Tn.elements[0]*=c,Tn.elements[1]*=c,Tn.elements[2]*=c,Tn.elements[4]*=h,Tn.elements[5]*=h,Tn.elements[6]*=h,Tn.elements[8]*=d,Tn.elements[9]*=d,Tn.elements[10]*=d,e.setFromRotationMatrix(Tn),n.x=a,n.y=o,n.z=l,this}makePerspective(t,e,n,s,r,a,o=Rn,l=!1){let c=this.elements,h=2*r/(e-t),d=2*r/(n-s),u=(e+t)/(e-t),f=(n+s)/(n-s),g,_;if(l)g=r/(a-r),_=a*r/(a-r);else if(o===Rn)g=-(a+r)/(a-r),_=-2*a*r/(a-r);else if(o===_s)g=-a/(a-r),_=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=Rn,l=!1){let c=this.elements,h=2/(e-t),d=2/(n-s),u=-(e+t)/(e-t),f=-(n+s)/(n-s),g,_;if(l)g=1/(a-r),_=a/(a-r);else if(o===Rn)g=-2/(a-r),_=-(a+r)/(a-r);else if(o===_s)g=-1/(a-r),_=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}};uo.prototype.isMatrix4=!0;var ce=uo,es=new C,Tn=new ce,_f=new C(0,0,0),vf=new C(1,1,1),di=new C,$r=new C,hn=new C,Th=new ce,wh=new Mn,Pn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],d=s[2],u=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(ne(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ne(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(ne(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-ne(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(ne(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-ne(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Ot("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return Th.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Th,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return wh.setFromEuler(this),this.setFromQuaternion(wh,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Pn.DEFAULT_ORDER="XYZ";var Ms=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},yf=0,Ah=new C,ns=new Mn,Jn=new ce,Jr=new C,Gs=new C,Mf=new C,Sf=new Mn,Rh=new C(1,0,0),Ch=new C(0,1,0),Ph=new C(0,0,1),Ih={type:"added"},bf={type:"removed"},is={type:"childadded",child:null},Cl={type:"childremoved",child:null},Ve=class i extends Vn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:yf++}),this.uuid=ni(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new C,e=new Pn,n=new Mn,s=new C(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ce},normalMatrix:{value:new Xt}}),this.matrix=new ce,this.matrixWorld=new ce,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ms,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ns.setFromAxisAngle(t,e),this.quaternion.multiply(ns),this}rotateOnWorldAxis(t,e){return ns.setFromAxisAngle(t,e),this.quaternion.premultiply(ns),this}rotateX(t){return this.rotateOnAxis(Rh,t)}rotateY(t){return this.rotateOnAxis(Ch,t)}rotateZ(t){return this.rotateOnAxis(Ph,t)}translateOnAxis(t,e){return Ah.copy(t).applyQuaternion(this.quaternion),this.position.add(Ah.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Rh,t)}translateY(t){return this.translateOnAxis(Ch,t)}translateZ(t){return this.translateOnAxis(Ph,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Jn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Jr.copy(t):Jr.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),Gs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Jn.lookAt(Gs,Jr,this.up):Jn.lookAt(Jr,Gs,this.up),this.quaternion.setFromRotationMatrix(Jn),s&&(Jn.extractRotation(s.matrixWorld),ns.setFromRotationMatrix(Jn),this.quaternion.premultiply(ns.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Ut("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Ih),is.child=t,this.dispatchEvent(is),is.child=null):Ut("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(bf),Cl.child=t,this.dispatchEvent(Cl),Cl.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Jn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Jn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Jn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Ih),is.child=t,this.dispatchEvent(is),is.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gs,t,Mf),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Gs,Sf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];r(t.shapes,d)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){let o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),d=a(t.shapes),u=a(t.skeletons),f=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};Ve.DEFAULT_UP=new C(0,1,0);Ve.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ve.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Me=class extends Ve{constructor(){super(),this.isGroup=!0,this.type="Group"}},Ef={type:"move"},Ss=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Me,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Me,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new C,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new C),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Me,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new C,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new C,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(let _ of t.hand.values()){let p=e.getJointPose(_,n),m=this._getHandJoint(c,_);p!==null&&(m.matrix.fromArray(p.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=p.radius),m.visible=p!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,g=.005;c.inputState.pinching&&u>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Ef)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new Me;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},Ou={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},fi={h:0,s:0,l:0},Kr={h:0,s:0,l:0};function Pl(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Ht=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ne){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ae.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=ae.workingColorSpace){return this.r=t,this.g=e,this.b=n,ae.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=ae.workingColorSpace){if(t=pf(t,1),e=ne(e,0,1),n=ne(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=Pl(a,r,t+1/3),this.g=Pl(a,r,t),this.b=Pl(a,r,t-1/3)}return ae.colorSpaceToWorking(this,s),this}setStyle(t,e=Ne){function n(r){r!==void 0&&parseFloat(r)<1&&Ot("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Ot("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);Ot("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ne){let n=Ou[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Ot("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=ii(t.r),this.g=ii(t.g),this.b=ii(t.b),this}copyLinearToSRGB(t){return this.r=xs(t.r),this.g=xs(t.g),this.b=xs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ne){return ae.workingToColorSpace(Ze.copy(this),t),Math.round(ne(Ze.r*255,0,255))*65536+Math.round(ne(Ze.g*255,0,255))*256+Math.round(ne(Ze.b*255,0,255))}getHexString(t=Ne){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ae.workingColorSpace){ae.workingToColorSpace(Ze.copy(this),e);let n=Ze.r,s=Ze.g,r=Ze.b,a=Math.max(n,s,r),o=Math.min(n,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let d=a-o;switch(c=h<=.5?d/(a+o):d/(2-a-o),a){case n:l=(s-r)/d+(s<r?6:0);break;case s:l=(r-n)/d+2;break;case r:l=(n-s)/d+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=ae.workingColorSpace){return ae.workingToColorSpace(Ze.copy(this),e),t.r=Ze.r,t.g=Ze.g,t.b=Ze.b,t}getStyle(t=Ne){ae.workingToColorSpace(Ze.copy(this),t);let e=Ze.r,n=Ze.g,s=Ze.b;return t!==Ne?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(fi),this.setHSL(fi.h+t,fi.s+e,fi.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(fi),t.getHSL(Kr);let n=El(fi.h,Kr.h,e),s=El(fi.s,Kr.s,e),r=El(fi.l,Kr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ze=new Ht;Ht.NAMES=Ou;var or=class i{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Ht(t),this.density=e}clone(){return new i(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var lr=class extends Ve{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pn,this.environmentIntensity=1,this.environmentRotation=new Pn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}},wn=new C,Kn=new C,Il=new C,Qn=new C,ss=new C,rs=new C,Lh=new C,Ll=new C,Dl=new C,Nl=new C,Ul=new be,Fl=new be,Ol=new be,ei=class i{constructor(t=new C,e=new C,n=new C){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),wn.subVectors(t,e),s.cross(wn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){wn.subVectors(s,e),Kn.subVectors(n,e),Il.subVectors(t,e);let a=wn.dot(wn),o=wn.dot(Kn),l=wn.dot(Il),c=Kn.dot(Kn),h=Kn.dot(Il),d=a*c-o*o;if(d===0)return r.set(0,0,0),null;let u=1/d,f=(c*l-o*h)*u,g=(a*h-o*l)*u;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Qn)===null?!1:Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,Qn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Qn.x),l.addScaledVector(a,Qn.y),l.addScaledVector(o,Qn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return Ul.setScalar(0),Fl.setScalar(0),Ol.setScalar(0),Ul.fromBufferAttribute(t,e),Fl.fromBufferAttribute(t,n),Ol.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(Ul,r.x),a.addScaledVector(Fl,r.y),a.addScaledVector(Ol,r.z),a}static isFrontFacing(t,e,n,s){return wn.subVectors(n,e),Kn.subVectors(t,e),wn.cross(Kn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return wn.subVectors(this.c,this.b),Kn.subVectors(this.a,this.b),wn.cross(Kn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;ss.subVectors(s,n),rs.subVectors(r,n),Ll.subVectors(t,n);let l=ss.dot(Ll),c=rs.dot(Ll);if(l<=0&&c<=0)return e.copy(n);Dl.subVectors(t,s);let h=ss.dot(Dl),d=rs.dot(Dl);if(h>=0&&d<=h)return e.copy(s);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(ss,a);Nl.subVectors(t,r);let f=ss.dot(Nl),g=rs.dot(Nl);if(g>=0&&f<=g)return e.copy(r);let _=f*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(rs,o);let p=h*g-f*d;if(p<=0&&d-h>=0&&f-g>=0)return Lh.subVectors(r,s),o=(d-h)/(d-h+(f-g)),e.copy(s).addScaledVector(Lh,o);let m=1/(p+_+u);return a=_*m,o=u*m,e.copy(n).addScaledVector(ss,a).addScaledVector(rs,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},kn=class{constructor(t=new C(1/0,1/0,1/0),e=new C(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(An.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(An.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=An.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,An):An.fromBufferAttribute(r,a),An.applyMatrix4(t.matrixWorld),this.expandByPoint(An);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Qr.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Qr.copy(n.boundingBox)),Qr.applyMatrix4(t.matrixWorld),this.union(Qr)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,An),An.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ws),jr.subVectors(this.max,Ws),as.subVectors(t.a,Ws),os.subVectors(t.b,Ws),ls.subVectors(t.c,Ws),pi.subVectors(os,as),mi.subVectors(ls,os),Di.subVectors(as,ls);let e=[0,-pi.z,pi.y,0,-mi.z,mi.y,0,-Di.z,Di.y,pi.z,0,-pi.x,mi.z,0,-mi.x,Di.z,0,-Di.x,-pi.y,pi.x,0,-mi.y,mi.x,0,-Di.y,Di.x,0];return!Bl(e,as,os,ls,jr)||(e=[1,0,0,0,1,0,0,0,1],!Bl(e,as,os,ls,jr))?!1:(ta.crossVectors(pi,mi),e=[ta.x,ta.y,ta.z],Bl(e,as,os,ls,jr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,An).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(An).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(jn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},jn=[new C,new C,new C,new C,new C,new C,new C,new C],An=new C,Qr=new kn,as=new C,os=new C,ls=new C,pi=new C,mi=new C,Di=new C,Ws=new C,jr=new C,ta=new C,Ni=new C;function Bl(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Ni.fromArray(i,r);let o=s.x*Math.abs(Ni.x)+s.y*Math.abs(Ni.y)+s.z*Math.abs(Ni.z),l=t.dot(Ni),c=e.dot(Ni),h=n.dot(Ni);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var Pe=new C,ea=new et,Tf=0,Se=class extends Vn{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Tf++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Ua,this.updateRanges=[],this.gpuType=Sn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ea.fromBufferAttribute(this,e),ea.applyMatrix3(t),this.setXY(e,ea.x,ea.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix3(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix4(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.applyNormalMatrix(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Pe.fromBufferAttribute(this,e),Pe.transformDirection(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Bn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=pe(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Bn(e,this.array)),e}setX(t,e){return this.normalized&&(e=pe(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Bn(e,this.array)),e}setY(t,e){return this.normalized&&(e=pe(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Bn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=pe(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Bn(e,this.array)),e}setW(t,e){return this.normalized&&(e=pe(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array),s=pe(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array),s=pe(s,this.array),r=pe(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Ua&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var cr=class extends Se{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var hr=class extends Se{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var Yt=class extends Se{constructor(t,e,n){super(new Float32Array(t),e,n)}},wf=new kn,Xs=new C,zl=new C,fn=class{constructor(t=new C,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):wf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Xs.subVectors(t,this.center);let e=Xs.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(Xs,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(zl.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Xs.copy(t.center).add(zl)),this.expandByPoint(Xs.copy(t.center).sub(zl))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Af=0,_n=new ce,Vl=new Ve,cs=new C,un=new kn,qs=new kn,Be=new C,me=class i extends Vn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Af++}),this.uuid=ni(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(df(t)?hr:cr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Xt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return _n.makeRotationFromQuaternion(t),this.applyMatrix4(_n),this}rotateX(t){return _n.makeRotationX(t),this.applyMatrix4(_n),this}rotateY(t){return _n.makeRotationY(t),this.applyMatrix4(_n),this}rotateZ(t){return _n.makeRotationZ(t),this.applyMatrix4(_n),this}translate(t,e,n){return _n.makeTranslation(t,e,n),this.applyMatrix4(_n),this}scale(t,e,n){return _n.makeScale(t,e,n),this.applyMatrix4(_n),this}lookAt(t){return Vl.lookAt(t),Vl.updateMatrix(),this.applyMatrix4(Vl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(cs).negate(),this.translate(cs.x,cs.y,cs.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Yt(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Ot("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new kn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ut("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new C(-1/0,-1/0,-1/0),new C(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];un.setFromBufferAttribute(r),this.morphTargetsRelative?(Be.addVectors(this.boundingBox.min,un.min),this.boundingBox.expandByPoint(Be),Be.addVectors(this.boundingBox.max,un.max),this.boundingBox.expandByPoint(Be)):(this.boundingBox.expandByPoint(un.min),this.boundingBox.expandByPoint(un.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ut('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new fn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ut("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new C,1/0);return}if(t){let n=this.boundingSphere.center;if(un.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];qs.setFromBufferAttribute(o),this.morphTargetsRelative?(Be.addVectors(un.min,qs.min),un.expandByPoint(Be),Be.addVectors(un.max,qs.max),un.expandByPoint(Be)):(un.expandByPoint(qs.min),un.expandByPoint(qs.max))}un.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Be.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Be));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Be.fromBufferAttribute(o,c),l&&(cs.fromBufferAttribute(t,c),Be.add(cs)),s=Math.max(s,n.distanceToSquared(Be))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ut('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Ut("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Se(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let x=0;x<n.count;x++)o[x]=new C,l[x]=new C;let c=new C,h=new C,d=new C,u=new et,f=new et,g=new et,_=new C,p=new C;function m(x,T,P){c.fromBufferAttribute(n,x),h.fromBufferAttribute(n,T),d.fromBufferAttribute(n,P),u.fromBufferAttribute(r,x),f.fromBufferAttribute(r,T),g.fromBufferAttribute(r,P),h.sub(c),d.sub(c),f.sub(u),g.sub(u);let I=1/(f.x*g.y-g.x*f.y);isFinite(I)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(d,-f.y).multiplyScalar(I),p.copy(d).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(I),o[x].add(_),o[T].add(_),o[P].add(_),l[x].add(p),l[T].add(p),l[P].add(p))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let x=0,T=M.length;x<T;++x){let P=M[x],I=P.start,U=P.count;for(let W=I,X=I+U;W<X;W+=3)m(t.getX(W+0),t.getX(W+1),t.getX(W+2))}let S=new C,y=new C,w=new C,E=new C;function R(x){w.fromBufferAttribute(s,x),E.copy(w);let T=o[x];S.copy(T),S.sub(w.multiplyScalar(w.dot(T))).normalize(),y.crossVectors(E,T);let I=y.dot(l[x])<0?-1:1;a.setXYZW(x,S.x,S.y,S.z,I)}for(let x=0,T=M.length;x<T;++x){let P=M[x],I=P.start,U=P.count;for(let W=I,X=I+U;W<X;W+=3)R(t.getX(W+0)),R(t.getX(W+1)),R(t.getX(W+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new Se(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);let s=new C,r=new C,a=new C,o=new C,l=new C,c=new C,h=new C,d=new C;if(t)for(let u=0,f=t.count;u<f;u+=3){let g=t.getX(u+0),_=t.getX(u+1),p=t.getX(u+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),a.fromBufferAttribute(e,p),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,p),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,f=e.count;u<f;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),a.fromBufferAttribute(e,u+2),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Be.fromBufferAttribute(t,e),Be.normalize(),t.setXYZ(e,Be.x,Be.y,Be.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,d=o.normalized,u=new c.constructor(l.length*h),f=0,g=0;for(let _=0,p=l.length;_<p;_++){o.isInterleavedBufferAttribute?f=l[_]*o.data.stride+o.offset:f=l[_]*h;for(let m=0;m<h;m++)u[g++]=c[f++]}return new Se(u,h,d)}if(this.index===null)return Ot("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,n);e.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,d=c.length;h<d;h++){let u=c[h],f=t(u,n);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let f=c[d];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],d=r[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let c=0,h=a.length;c<h;c++){let d=a[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},Va=class{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Ua,this.updateRanges=[],this.version=0,this.uuid=ni()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ni()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=ni()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Qe=new C,ur=class i{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Qe.fromBufferAttribute(this,e),Qe.applyMatrix4(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Qe.fromBufferAttribute(this,e),Qe.applyNormalMatrix(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Qe.fromBufferAttribute(this,e),Qe.transformDirection(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=Bn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=pe(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=pe(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=pe(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=pe(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=pe(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=Bn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=Bn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=Bn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=Bn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array),s=pe(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=pe(e,this.array),n=pe(n,this.array),s=pe(s,this.array),r=pe(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){rr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let n=0;n<this.count;n++){let s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new Se(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new i(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){rr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let n=0;n<this.count;n++){let s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},Rf=0,Hn=class extends Vn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Rf++}),this.uuid=ni(),this.name="",this.type="Material",this.blending=Cn,this.side=si,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ea,this.blendDst=Ta,this.blendEquation=_i,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ht(0,0,0),this.blendAlpha=0,this.depthFunc=Vi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ec,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Oi,this.stencilZFail=Oi,this.stencilZPass=Oi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Ot(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Ot(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Cn&&(n.blending=this.blending),this.side!==si&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Ea&&(n.blendSrc=this.blendSrc),this.blendDst!==Ta&&(n.blendDst=this.blendDst),this.blendEquation!==_i&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Vi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ec&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Oi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Oi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Oi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Ht().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new et().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new et().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}},yi=class extends Hn{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Ht(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},hs,Ys=new C,us=new C,ds=new C,fs=new et,Zs=new et,Bu=new ce,na=new C,$s=new C,ia=new C,Dh=new et,kl=new et,Nh=new et,ki=class extends Ve{constructor(t=new yi){if(super(),this.isSprite=!0,this.type="Sprite",hs===void 0){hs=new me;let e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Va(e,5);hs.setIndex([0,1,2,0,2,3]),hs.setAttribute("position",new ur(n,3,0,!1)),hs.setAttribute("uv",new ur(n,2,3,!1))}this.geometry=hs,this.material=t,this.center=new et(.5,.5),this.count=1}raycast(t,e){t.camera===null&&Ut('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),us.setFromMatrixScale(this.matrixWorld),Bu.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),ds.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&us.multiplyScalar(-ds.z);let n=this.material.rotation,s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));let a=this.center;sa(na.set(-.5,-.5,0),ds,a,us,s,r),sa($s.set(.5,-.5,0),ds,a,us,s,r),sa(ia.set(.5,.5,0),ds,a,us,s,r),Dh.set(0,0),kl.set(1,0),Nh.set(1,1);let o=t.ray.intersectTriangle(na,$s,ia,!1,Ys);if(o===null&&(sa($s.set(-.5,.5,0),ds,a,us,s,r),kl.set(0,1),o=t.ray.intersectTriangle(na,ia,$s,!1,Ys),o===null))return;let l=t.ray.origin.distanceTo(Ys);l<t.near||l>t.far||e.push({distance:l,point:Ys.clone(),uv:ei.getInterpolation(Ys,na,$s,ia,Dh,kl,Nh,new et),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}};function sa(i,t,e,n,s,r){fs.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(Zs.x=r*fs.x-s*fs.y,Zs.y=s*fs.x+r*fs.y):Zs.copy(fs),i.copy(t),i.x+=Zs.x,i.y+=Zs.y,i.applyMatrix4(Bu)}var ti=new C,Hl=new C,ra=new C,gi=new C,Gl=new C,aa=new C,Wl=new C,bs=class{constructor(t=new C,e=new C(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,ti)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=ti.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(ti.copy(this.origin).addScaledVector(this.direction,e),ti.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Hl.copy(t).add(e).multiplyScalar(.5),ra.copy(e).sub(t).normalize(),gi.copy(this.origin).sub(Hl);let r=t.distanceTo(e)*.5,a=-this.direction.dot(ra),o=gi.dot(this.direction),l=-gi.dot(ra),c=gi.lengthSq(),h=Math.abs(1-a*a),d,u,f,g;if(h>0)if(d=a*l-o,u=a*o-l,g=r*h,d>=0)if(u>=-g)if(u<=g){let _=1/h;d*=_,u*=_,f=d*(d+a*u+2*o)+u*(a*d+u+2*l)+c}else u=r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u=-r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u<=-g?(d=Math.max(0,-(-a*r+o)),u=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c):u<=g?(d=0,u=Math.min(Math.max(-r,-l),r),f=u*(u+2*l)+c):(d=Math.max(0,-(a*r+o)),u=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c);else u=a>0?-r:r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(Hl).addScaledVector(ra,u),f}intersectSphere(t,e){ti.subVectors(t.center,this.origin);let n=ti.dot(this.direction),s=ti.dot(ti)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,a=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,a=(t.min.y-u.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),d>=0?(o=(t.min.z-u.z)*d,l=(t.max.z-u.z)*d):(o=(t.max.z-u.z)*d,l=(t.min.z-u.z)*d),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,ti)!==null}intersectTriangle(t,e,n,s,r){Gl.subVectors(e,t),aa.subVectors(n,t),Wl.crossVectors(Gl,aa);let a=this.direction.dot(Wl),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;gi.subVectors(this.origin,t);let l=o*this.direction.dot(aa.crossVectors(gi,aa));if(l<0)return null;let c=o*this.direction.dot(Gl.cross(gi));if(c<0||l+c>a)return null;let h=-o*gi.dot(Wl);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Gn=class extends Hn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=mc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},Uh=new ce,Ui=new bs,oa=new fn,Fh=new C,la=new C,ca=new C,ha=new C,Xl=new C,ua=new C,Oh=new C,da=new C,Lt=class extends Ve{constructor(t=new me,e=new Gn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){ua.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],d=r[l];h!==0&&(Xl.fromBufferAttribute(d,t),a?ua.addScaledVector(Xl,h):ua.addScaledVector(Xl.sub(e),h))}e.add(ua)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),oa.copy(n.boundingSphere),oa.applyMatrix4(r),Ui.copy(t.ray).recast(t.near),!(oa.containsPoint(Ui.origin)===!1&&(Ui.intersectSphere(oa,Fh)===null||Ui.origin.distanceToSquared(Fh)>(t.far-t.near)**2))&&(Uh.copy(r).invert(),Ui.copy(t.ray).applyMatrix4(Uh),!(n.boundingBox!==null&&Ui.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ui)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=u.length;g<_;g++){let p=u[g],m=a[p.materialIndex],M=Math.max(p.start,f.start),S=Math.min(o.count,Math.min(p.start+p.count,f.start+f.count));for(let y=M,w=S;y<w;y+=3){let E=o.getX(y),R=o.getX(y+1),x=o.getX(y+2);s=fa(this,m,t,n,c,h,d,E,R,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),_=Math.min(o.count,f.start+f.count);for(let p=g,m=_;p<m;p+=3){let M=o.getX(p),S=o.getX(p+1),y=o.getX(p+2);s=fa(this,a,t,n,c,h,d,M,S,y),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=u.length;g<_;g++){let p=u[g],m=a[p.materialIndex],M=Math.max(p.start,f.start),S=Math.min(l.count,Math.min(p.start+p.count,f.start+f.count));for(let y=M,w=S;y<w;y+=3){let E=y,R=y+1,x=y+2;s=fa(this,m,t,n,c,h,d,E,R,x),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let g=Math.max(0,f.start),_=Math.min(l.count,f.start+f.count);for(let p=g,m=_;p<m;p+=3){let M=p,S=p+1,y=p+2;s=fa(this,a,t,n,c,h,d,M,S,y),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}}};function Cf(i,t,e,n,s,r,a,o){let l;if(t.side===Ue?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===si,o),l===null)return null;da.copy(o),da.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(da);return c<e.near||c>e.far?null:{distance:c,point:da.clone(),object:i}}function fa(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,la),i.getVertexPosition(l,ca),i.getVertexPosition(c,ha);let h=Cf(i,t,e,n,la,ca,ha,Oh);if(h){let d=new C;ei.getBarycoord(Oh,la,ca,ha,d),s&&(h.uv=ei.getInterpolatedAttribute(s,o,l,c,d,new et)),r&&(h.uv1=ei.getInterpolatedAttribute(r,o,l,c,d,new et)),a&&(h.normal=ei.getInterpolatedAttribute(a,o,l,c,d,new C),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new C,materialIndex:0};ei.getNormal(la,ca,ha,u.normal),h.face=u,h.barycoord=d}return h}var Hi=class extends je{constructor(t=null,e=1,n=1,s,r,a,o,l,c=ze,h=ze,d,u){super(null,a,o,l,c,h,s,r,d,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var dr=class extends Se{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},ps=new ce,Bh=new ce,pa=[],zh=new kn,Pf=new ce,Js=new Lt,Ks=new fn,fr=class extends Lt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new dr(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Pf)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new kn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,ps),zh.copy(t.boundingBox).applyMatrix4(ps),this.boundingBox.union(zh)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new fn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,ps),Ks.copy(t.boundingSphere).applyMatrix4(ps),this.boundingSphere.union(Ks)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=t*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(Js.geometry=this.geometry,Js.material=this.material,Js.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Ks.copy(this.boundingSphere),Ks.applyMatrix4(n),t.ray.intersectsSphere(Ks)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,ps),Bh.multiplyMatrices(n,ps),Js.matrixWorld=Bh,Js.raycast(t,pa);for(let a=0,o=pa.length;a<o;a++){let l=pa[a];l.instanceId=r,l.object=this,e.push(l)}pa.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new dr(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Hi(new Float32Array(s*this.count),s,this.count,vo,Sn));let r=this.morphTexture.source.data.data,a=0;for(let c=0;c<n.length;c++)a+=n[c];let o=this.geometry.morphTargetsRelative?1:1-a,l=s*t;return r[l]=o,r.set(n,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},ql=new C,If=new C,Lf=new Xt,vn=class{constructor(t=new C(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=ql.subVectors(n,e).cross(If.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(ql),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let a=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:e.copy(t.start).addScaledVector(s,a)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Lf.getNormalMatrix(t),s=this.coplanarPoint(ql).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Fi=new fn,Df=new et(.5,.5),ma=new C,Es=class{constructor(t=new vn,e=new vn,n=new vn,s=new vn,r=new vn,a=new vn){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Rn,n=!1){let s=this.planes,r=t.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],d=r[5],u=r[6],f=r[7],g=r[8],_=r[9],p=r[10],m=r[11],M=r[12],S=r[13],y=r[14],w=r[15];if(s[0].setComponents(c-a,f-h,m-g,w-M).normalize(),s[1].setComponents(c+a,f+h,m+g,w+M).normalize(),s[2].setComponents(c+o,f+d,m+_,w+S).normalize(),s[3].setComponents(c-o,f-d,m-_,w-S).normalize(),n)s[4].setComponents(l,u,p,y).normalize(),s[5].setComponents(c-l,f-u,m-p,w-y).normalize();else if(s[4].setComponents(c-l,f-u,m-p,w-y).normalize(),e===Rn)s[5].setComponents(c+l,f+u,m+p,w+y).normalize();else if(e===_s)s[5].setComponents(l,u,p,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Fi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Fi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Fi)}intersectsSprite(t){Fi.center.set(0,0,0);let e=Df.distanceTo(t.center);return Fi.radius=.7071067811865476+e,Fi.applyMatrix4(t.matrixWorld),this.intersectsSphere(Fi)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(ma.x=s.normal.x>0?t.max.x:t.min.x,ma.y=s.normal.y>0?t.max.y:t.min.y,ma.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(ma)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var ka=class extends Hn{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ht(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},Vh=new ce,nc=new bs,ga=new fn,xa=new C,Gi=class extends Ve{constructor(t=new me,e=new ka){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ga.copy(n.boundingSphere),ga.applyMatrix4(s),ga.radius+=r,t.ray.intersectsSphere(ga)===!1)return;Vh.copy(s).invert(),nc.copy(t.ray).applyMatrix4(Vh);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,d=n.attributes.position;if(c!==null){let u=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let g=u,_=f;g<_;g++){let p=c.getX(g);xa.fromBufferAttribute(d,p),kh(xa,p,l,s,t,e,this)}}else{let u=Math.max(0,a.start),f=Math.min(d.count,a.start+a.count);for(let g=u,_=f;g<_;g++)xa.fromBufferAttribute(d,g),kh(xa,g,l,s,t,e,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function kh(i,t,e,n,s,r,a){let o=nc.distanceSqToPoint(i);if(o<e){let l=new C;nc.closestPointToPoint(i,l),l.applyMatrix4(n);let c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}var pr=class extends je{constructor(t=[],e=Ei,n,s,r,a,o,l,c,h){super(t,e,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},Wi=class extends je{constructor(t,e,n,s,r,a,o,l,c){super(t,e,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var ri=class extends je{constructor(t,e,n=Ln,s,r,a,o=ze,l=ze,c,h=zn,d=1){if(h!==zn&&h!==wi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:d};super(u,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new ys(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},Ha=class extends ri{constructor(t,e=Ln,n=Ei,s,r,a=ze,o=ze,l,c=zn){let h={width:t,height:t,depth:1},d=[h,h,h,h,h,h];super(t,t,e,n,s,r,a,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},mr=class extends je{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Le=class i extends me{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],d=[],u=0,f=0;g("z","y","x",-1,-1,n,e,t,a,r,0),g("z","y","x",1,-1,n,e,-t,a,r,1),g("x","z","y",1,1,t,n,e,s,a,2),g("x","z","y",1,-1,t,n,-e,s,a,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Yt(c,3)),this.setAttribute("normal",new Yt(h,3)),this.setAttribute("uv",new Yt(d,2));function g(_,p,m,M,S,y,w,E,R,x,T){let P=y/R,I=w/x,U=y/2,W=w/2,X=E/2,D=R+1,z=x+1,B=0,$=0,Q=new C;for(let ot=0;ot<z;ot++){let lt=ot*I-W;for(let pt=0;pt<D;pt++){let Zt=pt*P-U;Q[_]=Zt*M,Q[p]=lt*S,Q[m]=X,c.push(Q.x,Q.y,Q.z),Q[_]=0,Q[p]=0,Q[m]=E>0?1:-1,h.push(Q.x,Q.y,Q.z),d.push(pt/R),d.push(1-ot/x),B+=1}}for(let ot=0;ot<x;ot++)for(let lt=0;lt<R;lt++){let pt=u+lt+D*ot,Zt=u+lt+D*(ot+1),ie=u+(lt+1)+D*(ot+1),Qt=u+(lt+1)+D*ot;l.push(pt,Zt,Qt),l.push(Zt,ie,Qt),$+=6}o.addGroup(f,$,T),f+=$,u+=B}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var tn=class i extends me{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],d=[],u=[],f=[],g=0,_=[],p=n/2,m=0;M(),a===!1&&(t>0&&S(!0),e>0&&S(!1)),this.setIndex(h),this.setAttribute("position",new Yt(d,3)),this.setAttribute("normal",new Yt(u,3)),this.setAttribute("uv",new Yt(f,2));function M(){let y=new C,w=new C,E=0,R=(e-t)/n;for(let x=0;x<=r;x++){let T=[],P=x/r,I=P*(e-t)+t;for(let U=0;U<=s;U++){let W=U/s,X=W*l+o,D=Math.sin(X),z=Math.cos(X);w.x=I*D,w.y=-P*n+p,w.z=I*z,d.push(w.x,w.y,w.z),y.set(D,R,z).normalize(),u.push(y.x,y.y,y.z),f.push(W,1-P),T.push(g++)}_.push(T)}for(let x=0;x<s;x++)for(let T=0;T<r;T++){let P=_[T][x],I=_[T+1][x],U=_[T+1][x+1],W=_[T][x+1];(t>0||T!==0)&&(h.push(P,I,W),E+=3),(e>0||T!==r-1)&&(h.push(I,U,W),E+=3)}c.addGroup(m,E,0),m+=E}function S(y){let w=g,E=new et,R=new C,x=0,T=y===!0?t:e,P=y===!0?1:-1;for(let U=1;U<=s;U++)d.push(0,p*P,0),u.push(0,P,0),f.push(.5,.5),g++;let I=g;for(let U=0;U<=s;U++){let X=U/s*l+o,D=Math.cos(X),z=Math.sin(X);R.x=T*z,R.y=p*P,R.z=T*D,d.push(R.x,R.y,R.z),u.push(0,P,0),E.x=D*.5+.5,E.y=z*.5*P+.5,f.push(E.x,E.y),g++}for(let U=0;U<s;U++){let W=w+U,X=I+U;y===!0?h.push(X,X+1,W):h.push(X+1,X,W),x+=3}c.addGroup(m,x,y===!0?1:2),m+=x}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},gr=class i extends tn{constructor(t=1,e=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Ga=class i extends me{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};let r=[],a=[];o(s),c(n),h(),this.setAttribute("position",new Yt(r,3)),this.setAttribute("normal",new Yt(r.slice(),3)),this.setAttribute("uv",new Yt(a,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(M){let S=new C,y=new C,w=new C;for(let E=0;E<e.length;E+=3)f(e[E+0],S),f(e[E+1],y),f(e[E+2],w),l(S,y,w,M)}function l(M,S,y,w){let E=w+1,R=[];for(let x=0;x<=E;x++){R[x]=[];let T=M.clone().lerp(y,x/E),P=S.clone().lerp(y,x/E),I=E-x;for(let U=0;U<=I;U++)U===0&&x===E?R[x][U]=T:R[x][U]=T.clone().lerp(P,U/I)}for(let x=0;x<E;x++)for(let T=0;T<2*(E-x)-1;T++){let P=Math.floor(T/2);T%2===0?(u(R[x][P+1]),u(R[x+1][P]),u(R[x][P])):(u(R[x][P+1]),u(R[x+1][P+1]),u(R[x+1][P]))}}function c(M){let S=new C;for(let y=0;y<r.length;y+=3)S.x=r[y+0],S.y=r[y+1],S.z=r[y+2],S.normalize().multiplyScalar(M),r[y+0]=S.x,r[y+1]=S.y,r[y+2]=S.z}function h(){let M=new C;for(let S=0;S<r.length;S+=3){M.x=r[S+0],M.y=r[S+1],M.z=r[S+2];let y=p(M)/2/Math.PI+.5,w=m(M)/Math.PI+.5;a.push(y,1-w)}g(),d()}function d(){for(let M=0;M<a.length;M+=6){let S=a[M+0],y=a[M+2],w=a[M+4],E=Math.max(S,y,w),R=Math.min(S,y,w);E>.9&&R<.1&&(S<.2&&(a[M+0]+=1),y<.2&&(a[M+2]+=1),w<.2&&(a[M+4]+=1))}}function u(M){r.push(M.x,M.y,M.z)}function f(M,S){let y=M*3;S.x=t[y+0],S.y=t[y+1],S.z=t[y+2]}function g(){let M=new C,S=new C,y=new C,w=new C,E=new et,R=new et,x=new et;for(let T=0,P=0;T<r.length;T+=9,P+=6){M.set(r[T+0],r[T+1],r[T+2]),S.set(r[T+3],r[T+4],r[T+5]),y.set(r[T+6],r[T+7],r[T+8]),E.set(a[P+0],a[P+1]),R.set(a[P+2],a[P+3]),x.set(a[P+4],a[P+5]),w.copy(M).add(S).add(y).divideScalar(3);let I=p(w);_(E,P+0,M,I),_(R,P+2,S,I),_(x,P+4,y,I)}}function _(M,S,y,w){w<0&&M.x===1&&(a[S]=M.x-1),y.x===0&&y.z===0&&(a[S]=w/2/Math.PI+.5)}function p(M){return Math.atan2(M.z,-M.x)}function m(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.vertices,t.indices,t.radius,t.detail)}};var pn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ot("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);let h=n[s],u=n[s+1]-h,f=(a-h)/u;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),l=e||(a.isVector2?new et:new C);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new C,s=[],r=[],a=[],o=new C,l=new ce;for(let f=0;f<=t;f++){let g=f/t;s[f]=this.getTangentAt(g,new C)}r[0]=new C,a[0]=new C;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),d=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();let g=Math.acos(ne(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(o,g))}a[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(ne(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],f*g)),a[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Ts=class extends pn{constructor(t=0,e=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new et){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,f=c-this.aY;l=u*h-f*d+this.aX,c=u*d+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Wa=class extends Ts{constructor(t,e,n,s,r,a){super(t,e,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function Ic(){let i=0,t=0,e=0,n=0;function s(r,a,o,l){i=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,d){let u=(a-r)/c-(o-r)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+d)+(l-o)/d;u*=h,f*=h,s(a,o,u,f)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var Hh=new C,Gh=new C,Yl=new Ic,Zl=new Ic,$l=new Ic,Xa=class extends pn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new C){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(Gh.subVectors(s[0],s[1]).add(s[0]),c=Gh);let d=s[o%r],u=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(Hh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Hh),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,g=Math.pow(c.distanceToSquared(d),f),_=Math.pow(d.distanceToSquared(u),f),p=Math.pow(u.distanceToSquared(h),f);_<1e-4&&(_=1),g<1e-4&&(g=_),p<1e-4&&(p=_),Yl.initNonuniformCatmullRom(c.x,d.x,u.x,h.x,g,_,p),Zl.initNonuniformCatmullRom(c.y,d.y,u.y,h.y,g,_,p),$l.initNonuniformCatmullRom(c.z,d.z,u.z,h.z,g,_,p)}else this.curveType==="catmullrom"&&(Yl.initCatmullRom(c.x,d.x,u.x,h.x,this.tension),Zl.initCatmullRom(c.y,d.y,u.y,h.y,this.tension),$l.initCatmullRom(c.z,d.z,u.z,h.z,this.tension));return n.set(Yl.calc(l),Zl.calc(l),$l.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new C().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function Wh(i,t,e,n,s){let r=(n-t)*.5,a=(s-e)*.5,o=i*i,l=i*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*i+e}function Nf(i,t){let e=1-i;return e*e*t}function Uf(i,t){return 2*(1-i)*i*t}function Ff(i,t){return i*i*t}function js(i,t,e,n){return Nf(i,t)+Uf(i,e)+Ff(i,n)}function Of(i,t){let e=1-i;return e*e*e*t}function Bf(i,t){let e=1-i;return 3*e*e*i*t}function zf(i,t){return 3*(1-i)*i*i*t}function Vf(i,t){return i*i*i*t}function tr(i,t,e,n,s){return Of(i,t)+Bf(i,e)+zf(i,n)+Vf(i,s)}var xr=class extends pn{constructor(t=new et,e=new et,n=new et,s=new et){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new et){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(tr(t,s.x,r.x,a.x,o.x),tr(t,s.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},qa=class extends pn{constructor(t=new C,e=new C,n=new C,s=new C){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new C){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(tr(t,s.x,r.x,a.x,o.x),tr(t,s.y,r.y,a.y,o.y),tr(t,s.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},_r=class extends pn{constructor(t=new et,e=new et){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new et){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new et){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ya=class extends pn{constructor(t=new C,e=new C){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new C){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new C){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},vr=class extends pn{constructor(t=new et,e=new et,n=new et){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new et){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(js(t,s.x,r.x,a.x),js(t,s.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Za=class extends pn{constructor(t=new C,e=new C,n=new C){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new C){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(js(t,s.x,r.x,a.x),js(t,s.y,r.y,a.y),js(t,s.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},yr=class extends pn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new et){let n=e,s=this.points,r=(s.length-1)*t,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],d=s[a>s.length-3?s.length-1:a+2];return n.set(Wh(o,l.x,c.x,h.x,d.x),Wh(o,l.y,c.y,h.y,d.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new et().fromArray(s))}return this}},ic=Object.freeze({__proto__:null,ArcCurve:Wa,CatmullRomCurve3:Xa,CubicBezierCurve:xr,CubicBezierCurve3:qa,EllipseCurve:Ts,LineCurve:_r,LineCurve3:Ya,QuadraticBezierCurve:vr,QuadraticBezierCurve3:Za,SplineCurve:yr}),$a=class extends pn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new ic[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new ic[s.type]().fromJSON(s))}return this}},Mr=class extends $a{constructor(t){super(),this.type="Path",this.currentPoint=new et,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new _r(this.currentPoint.clone(),new et(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new vr(this.currentPoint.clone(),new et(t,e),new et(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,a){let o=new xr(this.currentPoint.clone(),new et(t,e),new et(n,s),new et(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new yr(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,a){let o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,s,r,a),this}absarc(t,e,n,s,r,a){return this.absellipse(t,e,n,n,s,r,a),this}ellipse(t,e,n,s,r,a,o,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,a,o,l),this}absellipse(t,e,n,s,r,a,o,l){let c=new Ts(t,e,n,s,r,a,o,l);if(this.curves.length>0){let d=c.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},ws=class extends Mr{constructor(t){super(t),this.uuid=ni(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new Mr().fromJSON(s))}return this}};function kf(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=zu(i,0,s,e,!0),a=[];if(!r||r.next===r.prev)return a;let o,l,c;if(n&&(r=qf(i,t,r,e)),i.length>80*e){o=i[0],l=i[1];let h=o,d=l;for(let u=e;u<s;u+=e){let f=i[u],g=i[u+1];f<o&&(o=f),g<l&&(l=g),f>h&&(h=f),g>d&&(d=g)}c=Math.max(h-o,d-l),c=c!==0?32767/c:0}return Sr(r,a,e,o,l,c,0),a}function zu(i,t,e,n,s){let r;if(s===ip(i,t,e,n)>0)for(let a=t;a<e;a+=n)r=Xh(a/n|0,i[a],i[a+1],r);else for(let a=e-n;a>=t;a-=n)r=Xh(a/n|0,i[a],i[a+1],r);return r&&As(r,r.next)&&(Er(r),r=r.next),r}function Xi(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(As(e,e.next)||Ee(e.prev,e,e.next)===0)){if(Er(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Sr(i,t,e,n,s,r,a){if(!i)return;!a&&r&&Kf(i,n,s,r);let o=i;for(;i.prev!==i.next;){let l=i.prev,c=i.next;if(r?Gf(i,n,s,r):Hf(i)){t.push(l.i,i.i,c.i),Er(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=Wf(Xi(i),t),Sr(i,t,e,n,s,r,2)):a===2&&Xf(i,t,e,n,s,r):Sr(Xi(i),t,e,n,s,r,1);break}}}function Hf(i){let t=i.prev,e=i,n=i.next;if(Ee(t,e,n)>=0)return!1;let s=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=Math.min(s,r,a),d=Math.min(o,l,c),u=Math.max(s,r,a),f=Math.max(o,l,c),g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=u&&g.y>=d&&g.y<=f&&Qs(s,o,r,l,a,c,g.x,g.y)&&Ee(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Gf(i,t,e,n){let s=i.prev,r=i,a=i.next;if(Ee(s,r,a)>=0)return!1;let o=s.x,l=r.x,c=a.x,h=s.y,d=r.y,u=a.y,f=Math.min(o,l,c),g=Math.min(h,d,u),_=Math.max(o,l,c),p=Math.max(h,d,u),m=sc(f,g,t,e,n),M=sc(_,p,t,e,n),S=i.prevZ,y=i.nextZ;for(;S&&S.z>=m&&y&&y.z<=M;){if(S.x>=f&&S.x<=_&&S.y>=g&&S.y<=p&&S!==s&&S!==a&&Qs(o,h,l,d,c,u,S.x,S.y)&&Ee(S.prev,S,S.next)>=0||(S=S.prevZ,y.x>=f&&y.x<=_&&y.y>=g&&y.y<=p&&y!==s&&y!==a&&Qs(o,h,l,d,c,u,y.x,y.y)&&Ee(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;S&&S.z>=m;){if(S.x>=f&&S.x<=_&&S.y>=g&&S.y<=p&&S!==s&&S!==a&&Qs(o,h,l,d,c,u,S.x,S.y)&&Ee(S.prev,S,S.next)>=0)return!1;S=S.prevZ}for(;y&&y.z<=M;){if(y.x>=f&&y.x<=_&&y.y>=g&&y.y<=p&&y!==s&&y!==a&&Qs(o,h,l,d,c,u,y.x,y.y)&&Ee(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function Wf(i,t){let e=i;do{let n=e.prev,s=e.next.next;!As(n,s)&&ku(n,e,e.next,s)&&br(n,s)&&br(s,n)&&(t.push(n.i,e.i,s.i),Er(e),Er(e.next),e=i=s),e=e.next}while(e!==i);return Xi(e)}function Xf(i,t,e,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&tp(a,o)){let l=Hu(a,o);a=Xi(a,a.next),l=Xi(l,l.next),Sr(a,t,e,n,s,r,0),Sr(l,t,e,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function qf(i,t,e,n){let s=[];for(let r=0,a=t.length;r<a;r++){let o=t[r]*n,l=r<a-1?t[r+1]*n:i.length,c=zu(i,o,l,n,!1);c===c.next&&(c.steiner=!0),s.push(jf(c))}s.sort(Yf);for(let r=0;r<s.length;r++)e=Zf(s[r],e);return e}function Yf(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function Zf(i,t){let e=$f(i,t);if(!e)return t;let n=Hu(e,i);return Xi(n,n.next),Xi(e,e.next)}function $f(i,t){let e=t,n=i.x,s=i.y,r=-1/0,a;if(As(i,e))return e;do{if(As(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let d=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=n&&d>r&&(r=d,a=e.x<e.next.x?e:e.next,d===n))return a}e=e.next}while(e!==t);if(!a)return null;let o=a,l=a.x,c=a.y,h=1/0;e=a;do{if(n>=e.x&&e.x>=l&&n!==e.x&&Vu(s<c?n:r,s,l,c,s<c?r:n,s,e.x,e.y)){let d=Math.abs(s-e.y)/(n-e.x);br(e,i)&&(d<h||d===h&&(e.x>a.x||e.x===a.x&&Jf(a,e)))&&(a=e,h=d)}e=e.next}while(e!==o);return a}function Jf(i,t){return Ee(i.prev,i,t.prev)<0&&Ee(t.next,i,i.next)<0}function Kf(i,t,e,n){let s=i;do s.z===0&&(s.z=sc(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,Qf(s)}function Qf(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let a=n,o=0;for(let c=0;c<e&&(o++,a=a.nextZ,!!a);c++);let l=e;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,e*=2}while(t>1);return i}function sc(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function jf(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Vu(i,t,e,n,s,r,a,o){return(s-a)*(t-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(s-a)*(n-o)}function Qs(i,t,e,n,s,r,a,o){return!(i===a&&t===o)&&Vu(i,t,e,n,s,r,a,o)}function tp(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!ep(i,t)&&(br(i,t)&&br(t,i)&&np(i,t)&&(Ee(i.prev,i,t.prev)||Ee(i,t.prev,t))||As(i,t)&&Ee(i.prev,i,i.next)>0&&Ee(t.prev,t,t.next)>0)}function Ee(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function As(i,t){return i.x===t.x&&i.y===t.y}function ku(i,t,e,n){let s=va(Ee(i,t,e)),r=va(Ee(i,t,n)),a=va(Ee(e,n,i)),o=va(Ee(e,n,t));return!!(s!==r&&a!==o||s===0&&_a(i,e,t)||r===0&&_a(i,n,t)||a===0&&_a(e,i,n)||o===0&&_a(e,t,n))}function _a(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function va(i){return i>0?1:i<0?-1:0}function ep(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&ku(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function br(i,t){return Ee(i.prev,i,i.next)<0?Ee(i,t,i.next)>=0&&Ee(i,i.prev,t)>=0:Ee(i,t,i.prev)<0||Ee(i,i.next,t)<0}function np(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function Hu(i,t){let e=rc(i.i,i.x,i.y),n=rc(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Xh(i,t,e,n){let s=rc(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Er(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function rc(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function ip(i,t,e,n){let s=0;for(let r=t,a=e-n;r<e;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var ac=class{static triangulate(t,e,n=2){return kf(t,e,n)}},Bi=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];qh(t),Yh(n,t);let a=t.length;e.forEach(qh);for(let l=0;l<e.length;l++)s.push(a),a+=e[l].length,Yh(n,e[l]);let o=ac.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}};function qh(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function Yh(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Tr=class i extends me{constructor(t=new ws([new et(.5,.5),new et(-.5,.5),new et(-.5,-.5),new et(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let o=0,l=t.length;o<l;o++){let c=t[o];a(c)}this.setAttribute("position",new Yt(s,3)),this.setAttribute("uv",new Yt(r,2)),this.computeVertexNormals();function a(o){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,d=e.depth!==void 0?e.depth:1,u=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:f-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3,m=e.extrudePath,M=e.UVGenerator!==void 0?e.UVGenerator:sp,S,y=!1,w,E,R,x;if(m){S=m.getSpacedPoints(h),y=!0,u=!1;let j=m.isCatmullRomCurve3?m.closed:!1;w=m.computeFrenetFrames(h,j),E=new C,R=new C,x=new C}u||(p=0,f=0,g=0,_=0);let T=o.extractPoints(c),P=T.shape,I=T.holes;if(!Bi.isClockWise(P)){P=P.reverse();for(let j=0,rt=I.length;j<rt;j++){let it=I[j];Bi.isClockWise(it)&&(I[j]=it.reverse())}}function W(j){let it=10000000000000001e-36,_t=j[0];for(let mt=1;mt<=j.length;mt++){let Ft=mt%j.length,Rt=j[Ft],kt=Rt.x-_t.x,qt=Rt.y-_t.y,L=kt*kt+qt*qt,de=Math.max(Math.abs(Rt.x),Math.abs(Rt.y),Math.abs(_t.x),Math.abs(_t.y)),se=it*de*de;if(L<=se){j.splice(Ft,1),mt--;continue}_t=Rt}}W(P),I.forEach(W);let X=I.length,D=P;for(let j=0;j<X;j++){let rt=I[j];P=P.concat(rt)}function z(j,rt,it){return rt||Ut("ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(rt,it)}let B=P.length;function $(j,rt,it){let _t,mt,Ft,Rt=j.x-rt.x,kt=j.y-rt.y,qt=it.x-j.x,L=it.y-j.y,de=Rt*Rt+kt*kt,se=Rt*L-kt*qt;if(Math.abs(se)>Number.EPSILON){let A=Math.sqrt(de),v=Math.sqrt(qt*qt+L*L),O=rt.x-kt/A,H=rt.y+Rt/A,q=it.x-L/v,at=it.y+qt/v,ct=((q-O)*L-(at-H)*qt)/(Rt*L-kt*qt);_t=O+Rt*ct-j.x,mt=H+kt*ct-j.y;let Y=_t*_t+mt*mt;if(Y<=2)return new et(_t,mt);Ft=Math.sqrt(Y/2)}else{let A=!1;Rt>Number.EPSILON?qt>Number.EPSILON&&(A=!0):Rt<-Number.EPSILON?qt<-Number.EPSILON&&(A=!0):Math.sign(kt)===Math.sign(L)&&(A=!0),A?(_t=-kt,mt=Rt,Ft=Math.sqrt(de)):(_t=Rt,mt=kt,Ft=Math.sqrt(de/2))}return new et(_t/Ft,mt/Ft)}let Q=[];for(let j=0,rt=D.length,it=rt-1,_t=j+1;j<rt;j++,it++,_t++)it===rt&&(it=0),_t===rt&&(_t=0),Q[j]=$(D[j],D[it],D[_t]);let ot=[],lt,pt=Q.concat();for(let j=0,rt=X;j<rt;j++){let it=I[j];lt=[];for(let _t=0,mt=it.length,Ft=mt-1,Rt=_t+1;_t<mt;_t++,Ft++,Rt++)Ft===mt&&(Ft=0),Rt===mt&&(Rt=0),lt[_t]=$(it[_t],it[Ft],it[Rt]);ot.push(lt),pt=pt.concat(lt)}let Zt;if(p===0)Zt=Bi.triangulateShape(D,I);else{let j=[],rt=[];for(let it=0;it<p;it++){let _t=it/p,mt=f*Math.cos(_t*Math.PI/2),Ft=g*Math.sin(_t*Math.PI/2)+_;for(let Rt=0,kt=D.length;Rt<kt;Rt++){let qt=z(D[Rt],Q[Rt],Ft);Et(qt.x,qt.y,-mt),_t===0&&j.push(qt)}for(let Rt=0,kt=X;Rt<kt;Rt++){let qt=I[Rt];lt=ot[Rt];let L=[];for(let de=0,se=qt.length;de<se;de++){let A=z(qt[de],lt[de],Ft);Et(A.x,A.y,-mt),_t===0&&L.push(A)}_t===0&&rt.push(L)}}Zt=Bi.triangulateShape(j,rt)}let ie=Zt.length,Qt=g+_;for(let j=0;j<B;j++){let rt=u?z(P[j],pt[j],Qt):P[j];y?(R.copy(w.normals[0]).multiplyScalar(rt.x),E.copy(w.binormals[0]).multiplyScalar(rt.y),x.copy(S[0]).add(R).add(E),Et(x.x,x.y,x.z)):Et(rt.x,rt.y,0)}for(let j=1;j<=h;j++)for(let rt=0;rt<B;rt++){let it=u?z(P[rt],pt[rt],Qt):P[rt];y?(R.copy(w.normals[j]).multiplyScalar(it.x),E.copy(w.binormals[j]).multiplyScalar(it.y),x.copy(S[j]).add(R).add(E),Et(x.x,x.y,x.z)):Et(it.x,it.y,d/h*j)}for(let j=p-1;j>=0;j--){let rt=j/p,it=f*Math.cos(rt*Math.PI/2),_t=g*Math.sin(rt*Math.PI/2)+_;for(let mt=0,Ft=D.length;mt<Ft;mt++){let Rt=z(D[mt],Q[mt],_t);Et(Rt.x,Rt.y,d+it)}for(let mt=0,Ft=I.length;mt<Ft;mt++){let Rt=I[mt];lt=ot[mt];for(let kt=0,qt=Rt.length;kt<qt;kt++){let L=z(Rt[kt],lt[kt],_t);y?Et(L.x,L.y+S[h-1].y,S[h-1].x+it):Et(L.x,L.y,d+it)}}}Z(),st();function Z(){let j=s.length/3;if(u){let rt=0,it=B*rt;for(let _t=0;_t<ie;_t++){let mt=Zt[_t];Vt(mt[2]+it,mt[1]+it,mt[0]+it)}rt=h+p*2,it=B*rt;for(let _t=0;_t<ie;_t++){let mt=Zt[_t];Vt(mt[0]+it,mt[1]+it,mt[2]+it)}}else{for(let rt=0;rt<ie;rt++){let it=Zt[rt];Vt(it[2],it[1],it[0])}for(let rt=0;rt<ie;rt++){let it=Zt[rt];Vt(it[0]+B*h,it[1]+B*h,it[2]+B*h)}}n.addGroup(j,s.length/3-j,0)}function st(){let j=s.length/3,rt=0;nt(D,rt),rt+=D.length;for(let it=0,_t=I.length;it<_t;it++){let mt=I[it];nt(mt,rt),rt+=mt.length}n.addGroup(j,s.length/3-j,1)}function nt(j,rt){let it=j.length;for(;--it>=0;){let _t=it,mt=it-1;mt<0&&(mt=j.length-1);for(let Ft=0,Rt=h+p*2;Ft<Rt;Ft++){let kt=B*Ft,qt=B*(Ft+1),L=rt+_t+kt,de=rt+mt+kt,se=rt+mt+qt,A=rt+_t+qt;Nt(L,de,se,A)}}}function Et(j,rt,it){l.push(j),l.push(rt),l.push(it)}function Vt(j,rt,it){he(j),he(rt),he(it);let _t=s.length/3,mt=M.generateTopUV(n,s,_t-3,_t-2,_t-1);Gt(mt[0]),Gt(mt[1]),Gt(mt[2])}function Nt(j,rt,it,_t){he(j),he(rt),he(_t),he(rt),he(it),he(_t);let mt=s.length/3,Ft=M.generateSideWallUV(n,s,mt-6,mt-3,mt-2,mt-1);Gt(Ft[0]),Gt(Ft[1]),Gt(Ft[3]),Gt(Ft[1]),Gt(Ft[2]),Gt(Ft[3])}function he(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function Gt(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return rp(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,a=t.shapes.length;r<a;r++){let o=e[t.shapes[r]];n.push(o)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new ic[s.type]().fromJSON(s)),new i(n,t.options)}},sp={generateTopUV:function(i,t,e,n,s){let r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new et(r,a),new et(o,l),new et(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],d=t[n*3+2],u=t[s*3],f=t[s*3+1],g=t[s*3+2],_=t[r*3],p=t[r*3+1],m=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new et(a,1-l),new et(c,1-d),new et(u,1-g),new et(_,1-m)]:[new et(o,1-l),new et(h,1-d),new et(f,1-g),new et(p,1-m)]}};function rp(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var wr=class i extends Ga{constructor(t=1,e=0){let n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new i(t.radius,t.detail)}},Ar=class i extends me{constructor(t=[new et(0,-.5),new et(.5,0),new et(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=ne(s,0,Math.PI*2);let r=[],a=[],o=[],l=[],c=[],h=1/e,d=new C,u=new et,f=new C,g=new C,_=new C,p=0,m=0;for(let M=0;M<=t.length-1;M++)switch(M){case 0:p=t[M+1].x-t[M].x,m=t[M+1].y-t[M].y,f.x=m*1,f.y=-p,f.z=m*0,_.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(_.x,_.y,_.z);break;default:p=t[M+1].x-t[M].x,m=t[M+1].y-t[M].y,f.x=m*1,f.y=-p,f.z=m*0,g.copy(f),f.x+=_.x,f.y+=_.y,f.z+=_.z,f.normalize(),l.push(f.x,f.y,f.z),_.copy(g)}for(let M=0;M<=e;M++){let S=n+M*h*s,y=Math.sin(S),w=Math.cos(S);for(let E=0;E<=t.length-1;E++){d.x=t[E].x*y,d.y=t[E].y,d.z=t[E].x*w,a.push(d.x,d.y,d.z),u.x=M/e,u.y=E/(t.length-1),o.push(u.x,u.y);let R=l[3*E+0]*y,x=l[3*E+1],T=l[3*E+0]*w;c.push(R,x,T)}}for(let M=0;M<e;M++)for(let S=0;S<t.length-1;S++){let y=S+M*t.length,w=y,E=y+t.length,R=y+t.length+1,x=y+1;r.push(w,E,x),r.push(R,x,E)}this.setIndex(r),this.setAttribute("position",new Yt(a,3)),this.setAttribute("uv",new Yt(o,2)),this.setAttribute("normal",new Yt(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.points,t.segments,t.phiStart,t.phiLength)}};var Wn=class i extends me{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,d=t/o,u=e/l,f=[],g=[],_=[],p=[];for(let m=0;m<h;m++){let M=m*u-a;for(let S=0;S<c;S++){let y=S*d-r;g.push(y,-M,0),_.push(0,0,1),p.push(S/o),p.push(1-m/l)}}for(let m=0;m<l;m++)for(let M=0;M<o;M++){let S=M+c*m,y=M+c*(m+1),w=M+1+c*(m+1),E=M+1+c*m;f.push(S,y,E),f.push(y,w,E)}this.setIndex(f),this.setAttribute("position",new Yt(g,3)),this.setAttribute("normal",new Yt(_,3)),this.setAttribute("uv",new Yt(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var sn=class i extends me{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],d=new C,u=new C,f=[],g=[],_=[],p=[];for(let m=0;m<=n;m++){let M=[],S=m/n,y=a+S*o,w=t*Math.cos(y),E=Math.sqrt(t*t-w*w),R=0;m===0&&a===0?R=.5/e:m===n&&l===Math.PI&&(R=-.5/e);for(let x=0;x<=e;x++){let T=x/e,P=s+T*r;d.x=-E*Math.cos(P),d.y=w,d.z=E*Math.sin(P),g.push(d.x,d.y,d.z),u.copy(d).normalize(),_.push(u.x,u.y,u.z),p.push(T+R,1-S),M.push(c++)}h.push(M)}for(let m=0;m<n;m++)for(let M=0;M<e;M++){let S=h[m][M+1],y=h[m][M],w=h[m+1][M],E=h[m+1][M+1];(m!==0||a>0)&&f.push(S,y,E),(m!==n-1||l<Math.PI)&&f.push(y,w,E)}this.setIndex(f),this.setAttribute("position",new Yt(g,3)),this.setAttribute("normal",new Yt(_,3)),this.setAttribute("uv",new Yt(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Zi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(Zh(s))s.isRenderTargetTexture?(Ot("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(Zh(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Ke(i){let t={};for(let e=0;e<i.length;e++){let n=Zi(i[e]);for(let s in n)t[s]=n[s]}return t}function Zh(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function ap(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Lc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ae.workingColorSpace}var Gu={clone:Zi,merge:Ke},op=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,lp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ke=class extends Hn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=op,this.fragmentShader=lp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Zi(t.uniforms),this.uniformsGroups=ap(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Ht().setHex(s.value);break;case"v2":this.uniforms[n].value=new et().fromArray(s.value);break;case"v3":this.uniforms[n].value=new C().fromArray(s.value);break;case"v4":this.uniforms[n].value=new be().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Xt().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ce().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Ja=class extends ke{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},ee=class extends Hn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ht(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jo,this.normalScale=new et(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var Ka=class extends Hn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Tu,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},Qa=class extends Hn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function ya(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}var Mi=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},ja=class extends Mi{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ql,endingEnd:Ql}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case jl:r=t,o=2*e-n;break;case tc:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case jl:a=t,l=2*n-e;break;case tc:a=1,l=n+s[1]-s[0];break;default:a=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,g=(n-e)/(s-e),_=g*g,p=_*g,m=-u*p+2*u*_-u*g,M=(1+u)*p+(-1.5-2*u)*_+(-.5+u)*g+1,S=(-1-f)*p+(1.5+f)*_+.5*g,y=f*p-f*_;for(let w=0;w!==o;++w)r[w]=m*a[h+w]+M*a[c+w]+S*a[l+w]+y*a[d+w];return r}},to=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(s-e),d=1-h;for(let u=0;u!==o;++u)r[u]=a[c+u]*d+a[l+u]*h;return r}},eo=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},no=class extends Mi{interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this.inTangents,d=this.outTangents;if(!h||!d){let g=(n-e)/(s-e),_=1-g;for(let p=0;p!==o;++p)r[p]=a[c+p]*_+a[l+p]*g;return r}let u=o*2,f=t-1;for(let g=0;g!==o;++g){let _=a[c+g],p=a[l+g],m=f*u+g*2,M=d[m],S=d[m+1],y=t*u+g*2,w=h[y],E=h[y+1],R=(n-e)/(s-e),x,T,P,I,U;for(let W=0;W<8;W++){x=R*R,T=x*R,P=1-R,I=P*P,U=I*P;let D=U*e+3*I*R*M+3*P*x*w+T*s-n;if(Math.abs(D)<1e-10)break;let z=3*I*(M-e)+6*P*R*(w-M)+3*x*(s-w);if(Math.abs(z)<1e-10)break;R=R-D/z,R=Math.max(0,Math.min(1,R))}r[g]=U*_+3*I*R*S+3*P*x*E+T*p}return r}},mn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=ya(e,this.TimeBufferType),this.values=ya(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:ya(t.times,Array),values:ya(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new eo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new to(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new ja(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new no(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case er:e=this.InterpolantFactoryMethodDiscrete;break;case Na:e=this.InterpolantFactoryMethodLinear;break;case ba:e=this.InterpolantFactoryMethodSmooth;break;case Kl:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Ot("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return er;case this.InterpolantFactoryMethodLinear:return Na;case this.InterpolantFactoryMethodSmooth:return ba;case this.InterpolantFactoryMethodBezier:return Kl}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Ut("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Ut("KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){Ut("KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){Ut("KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(s!==void 0&&ff(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Ut("KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===ba,r=t.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let d=o*n,u=d-n,f=d+n;for(let g=0;g!==n;++g){let _=e[d+g];if(_!==e[u+g]||_!==e[f+g]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];let d=o*n,u=a*n;for(let f=0;f!==n;++f)e[u+f]=e[d+f]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};mn.prototype.ValueTypeName="";mn.prototype.TimeBufferType=Float32Array;mn.prototype.ValueBufferType=Float32Array;mn.prototype.DefaultInterpolation=Na;var Si=class extends mn{constructor(t,e,n){super(t,e,n)}};Si.prototype.ValueTypeName="bool";Si.prototype.ValueBufferType=Array;Si.prototype.DefaultInterpolation=er;Si.prototype.InterpolantFactoryMethodLinear=void 0;Si.prototype.InterpolantFactoryMethodSmooth=void 0;var io=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};io.prototype.ValueTypeName="color";var so=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};so.prototype.ValueTypeName="number";var ro=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(s-e),c=t*o;for(let h=c+o;c!==h;c+=4)Mn.slerpFlat(r,0,a,c-o,a,c,l);return r}},Rr=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new ro(this.times,this.values,this.getValueSize(),t)}};Rr.prototype.ValueTypeName="quaternion";Rr.prototype.InterpolantFactoryMethodSmooth=void 0;var bi=class extends mn{constructor(t,e,n){super(t,e,n)}};bi.prototype.ValueTypeName="string";bi.prototype.ValueBufferType=Array;bi.prototype.DefaultInterpolation=er;bi.prototype.InterpolantFactoryMethodLinear=void 0;bi.prototype.InterpolantFactoryMethodSmooth=void 0;var ao=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};ao.prototype.ValueTypeName="vector";var oo=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let f=c[d],g=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Wu=new oo,lo=class{constructor(t){this.manager=t!==void 0?t:Wu,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};lo.DEFAULT_MATERIAL_NAME="__DEFAULT";var Cr=class extends Ve{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ht(t),this.intensity=e}dispose(){this.dispatchEvent({type:"dispose"})}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Pr=class extends Cr{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ve.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ht(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Jl=new ce,$h=new C,Jh=new C,oc=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new et(512,512),this.mapType=rn,this.map=null,this.mapPass=null,this.matrix=new ce,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Es,this._frameExtents=new et(1,1),this._viewportCount=1,this._viewports=[new be(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;$h.setFromMatrixPosition(t.matrixWorld),e.position.copy($h),Jh.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Jh),e.updateMatrixWorld(),Jl.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Jl,e.coordinateSystem,e.reversedDepth),e.coordinateSystem===_s||e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Jl)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},Ma=new C,Sa=new Mn,On=new C,Ir=class extends Ve{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ce,this.projectionMatrix=new ce,this.projectionMatrixInverse=new ce,this.coordinateSystem=Rn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Ma,Sa,On),On.x===1&&On.y===1&&On.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ma,Sa,On.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(Ma,Sa,On),On.x===1&&On.y===1&&On.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ma,Sa,On.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},xi=new C,Kh=new et,Qh=new et,$e=class extends Ir{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Fa*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(bl*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Fa*2*Math.atan(Math.tan(bl*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){xi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(xi.x,xi.y).multiplyScalar(-t/xi.z),xi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(xi.x,xi.y).multiplyScalar(-t/xi.z)}getViewSize(t,e){return this.getViewBounds(t,Kh,Qh),e.subVectors(Qh,Kh)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(bl*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var Rs=class extends Ir{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},lc=class extends oc{constructor(){super(new Rs(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Cs=class extends Cr{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ve.DEFAULT_UP),this.updateMatrix(),this.target=new Ve,this.shadow=new lc}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var ms=-90,gs=1,co=class extends Ve{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new $e(ms,gs,t,e);s.layers=this.layers,this.add(s);let r=new $e(ms,gs,t,e);r.layers=this.layers,this.add(r);let a=new $e(ms,gs,t,e);a.layers=this.layers,this.add(a);let o=new $e(ms,gs,t,e);o.layers=this.layers,this.add(o);let l=new $e(ms,gs,t,e);l.layers=this.layers,this.add(l);let c=new $e(ms,gs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(let c of e)this.remove(c);if(t===Rn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===_s)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,d=t.getRenderTarget(),u=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let p=!1;t.isWebGLRenderer===!0?p=t.state.buffers.depth.getReversed():p=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,2,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,3,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(d,u,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},ho=class extends $e{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var Dc="\\[\\]\\.:\\/",cp=new RegExp("["+Dc+"]","g"),Nc="[^"+Dc+"]",hp="[^"+Dc.replace("\\.","")+"]",up=/((?:WC+[\/:])*)/.source.replace("WC",Nc),dp=/(WCOD+)?/.source.replace("WCOD",hp),fp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Nc),pp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Nc),mp=new RegExp("^"+up+dp+fp+pp+"$"),gp=["material","materials","bones","map"],cc=class{constructor(t,e,n){let s=n||ye.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},ye=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(cp,"")}static parseTrackName(t){let e=mp.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);gp.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let l=n(o.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Ot("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Ut("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ut("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ut("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ut("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ut("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Ut("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Ut("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let a=t[s];if(a===void 0){let c=e.nodeName;Ut("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ut("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ut("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};ye.Composite=cc;ye.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ye.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ye.prototype.GetterByBindingType=[ye.prototype._getValue_direct,ye.prototype._getValue_array,ye.prototype._getValue_arrayElement,ye.prototype._getValue_toArray];ye.prototype.SetterByBindingTypeAndVersioning=[[ye.prototype._setValue_direct,ye.prototype._setValue_direct_setNeedsUpdate,ye.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ye.prototype._setValue_array,ye.prototype._setValue_array_setNeedsUpdate,ye.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ye.prototype._setValue_arrayElement,ye.prototype._setValue_arrayElement_setNeedsUpdate,ye.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ye.prototype._setValue_fromArray,ye.prototype._setValue_fromArray_setNeedsUpdate,ye.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var R_=new Float32Array(1);var jh=new ce,Lr=class{constructor(t,e,n=0,s=1/0){this.ray=new bs(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Ms,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Ut("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return jh.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(jh),this}intersectObject(t,e=!0,n=[]){return hc(t,this,n,e),n.sort(tu),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)hc(t[s],this,n,e);return n.sort(tu),n}};function tu(i,t){return i.distance-t.distance}function hc(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)hc(r[a],t,e,!0)}}var Vc=class Vc{constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};Vc.prototype.isMatrix2=!0;var uc=Vc;function Uc(i,t,e,n){let s=xp(n);switch(e){case Ac:return i*t;case vo:return i*t/s.components*s.byteLength;case yo:return i*t/s.components*s.byteLength;case Ai:return i*t*2/s.components*s.byteLength;case Mo:return i*t*2/s.components*s.byteLength;case Rc:return i*t*3/s.components*s.byteLength;case an:return i*t*4/s.components*s.byteLength;case So:return i*t*4/s.components*s.byteLength;case Fr:case Or:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Br:case zr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Eo:case wo:return Math.max(i,16)*Math.max(t,8)/4;case bo:case To:return Math.max(i,8)*Math.max(t,8)/2;case Ao:case Ro:case Po:case Io:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Co:case Vr:case Lo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Do:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case No:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Uo:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Fo:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Oo:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Bo:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case zo:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Vo:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case ko:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Ho:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case Go:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Wo:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case Xo:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case qo:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Yo:case Zo:case $o:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Jo:case Ko:return Math.ceil(i/4)*Math.ceil(t/4)*8;case kr:case Qo:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function xp(i){switch(i){case rn:case bc:return{byteLength:1,components:1};case Is:case Ec:case qn:return{byteLength:2,components:1};case xo:case _o:return{byteLength:2,components:4};case Ln:case go:case Sn:return{byteLength:4,components:1};case Tc:case wc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?Ot("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function fd(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function vp(i){let t=new WeakMap;function e(o,l){let c=o.array,h=o.usage,d=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,l,c){let h=l.array,d=l.updateRanges;if(i.bindBuffer(c,o),d.length===0)i.bufferSubData(c,0,h);else{d.sort((f,g)=>f.start-g.start);let u=0;for(let f=1;f<d.length;f++){let g=d[u],_=d[f];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++u,d[u]=_)}d.length=u+1;for(let f=0,g=d.length;f<g;f++){let _=d[f];i.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var yp=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Mp=`#ifdef USE_ALPHAHASH
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
#endif`,Sp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,bp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ep=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Tp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,wp=`#ifdef USE_AOMAP
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
#endif`,Ap=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Rp=`#ifdef USE_BATCHING
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
#endif`,Cp=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Pp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Ip=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Lp=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Dp=`#ifdef USE_IRIDESCENCE
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
#endif`,Np=`#ifdef USE_BUMPMAP
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
#endif`,Up=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Fp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Op=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Bp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,zp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Vp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,kp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Hp=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Gp=`#define PI 3.141592653589793
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
} // validated`,Wp=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Xp=`vec3 transformedNormal = objectNormal;
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
#endif`,qp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Yp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Zp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,$p=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Jp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Kp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Qp=`#ifdef USE_ENVMAP
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
#endif`,jp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,tm=`#ifdef USE_ENVMAP
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
#endif`,em=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,nm=`#ifdef USE_ENVMAP
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
#endif`,im=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,sm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,rm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,am=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,om=`#ifdef USE_GRADIENTMAP
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
}`,lm=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,cm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,hm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,um=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,dm=`#ifdef USE_ENVMAP
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
#endif`,fm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,pm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,mm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,gm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,xm=`PhysicalMaterial material;
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
#endif`,_m=`uniform sampler2D dfgLUT;
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
}`,vm=`
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
#endif`,ym=`#if defined( RE_IndirectDiffuse )
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
#endif`,Mm=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Sm=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,bm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Em=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Tm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Am=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Rm=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Cm=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Pm=`#if defined( USE_POINTS_UV )
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
#endif`,Im=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Lm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Dm=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Nm=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Um=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fm=`#ifdef USE_MORPHTARGETS
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
#endif`,Om=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Bm=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,zm=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Vm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,km=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Gm=`#ifdef USE_NORMALMAP
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
#endif`,Wm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Xm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,qm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Ym=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Zm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,$m=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Jm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Km=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Qm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,jm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,t0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,e0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,n0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,i0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,s0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,r0=`float getShadowMask() {
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
}`,a0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,o0=`#ifdef USE_SKINNING
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
#endif`,l0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,c0=`#ifdef USE_SKINNING
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
#endif`,h0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,u0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,d0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,f0=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,p0=`#ifdef USE_TRANSMISSION
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
#endif`,m0=`#ifdef USE_TRANSMISSION
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
#endif`,g0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,x0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,_0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,v0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,y0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,M0=`uniform sampler2D t2D;
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
}`,S0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,b0=`#ifdef ENVMAP_TYPE_CUBE
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
}`,E0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,T0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,w0=`#include <common>
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
}`,A0=`#if DEPTH_PACKING == 3200
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
}`,R0=`#define DISTANCE
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
}`,C0=`#define DISTANCE
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
}`,P0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,I0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,L0=`uniform float scale;
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
}`,D0=`uniform vec3 diffuse;
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
}`,N0=`#include <common>
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
}`,U0=`uniform vec3 diffuse;
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
}`,F0=`#define LAMBERT
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
}`,O0=`#define LAMBERT
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
}`,B0=`#define MATCAP
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
}`,z0=`#define MATCAP
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
}`,V0=`#define NORMAL
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
}`,k0=`#define NORMAL
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
}`,H0=`#define PHONG
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
}`,G0=`#define PHONG
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
}`,W0=`#define STANDARD
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
}`,X0=`#define STANDARD
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
}`,q0=`#define TOON
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
}`,Y0=`#define TOON
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
}`,Z0=`uniform float size;
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
}`,$0=`uniform vec3 diffuse;
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
}`,J0=`#include <common>
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
}`,K0=`uniform vec3 color;
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
}`,Q0=`uniform float rotation;
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
}`,j0=`uniform vec3 diffuse;
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
}`,jt={alphahash_fragment:yp,alphahash_pars_fragment:Mp,alphamap_fragment:Sp,alphamap_pars_fragment:bp,alphatest_fragment:Ep,alphatest_pars_fragment:Tp,aomap_fragment:wp,aomap_pars_fragment:Ap,batching_pars_vertex:Rp,batching_vertex:Cp,begin_vertex:Pp,beginnormal_vertex:Ip,bsdfs:Lp,iridescence_fragment:Dp,bumpmap_pars_fragment:Np,clipping_planes_fragment:Up,clipping_planes_pars_fragment:Fp,clipping_planes_pars_vertex:Op,clipping_planes_vertex:Bp,color_fragment:zp,color_pars_fragment:Vp,color_pars_vertex:kp,color_vertex:Hp,common:Gp,cube_uv_reflection_fragment:Wp,defaultnormal_vertex:Xp,displacementmap_pars_vertex:qp,displacementmap_vertex:Yp,emissivemap_fragment:Zp,emissivemap_pars_fragment:$p,colorspace_fragment:Jp,colorspace_pars_fragment:Kp,envmap_fragment:Qp,envmap_common_pars_fragment:jp,envmap_pars_fragment:tm,envmap_pars_vertex:em,envmap_physical_pars_fragment:dm,envmap_vertex:nm,fog_vertex:im,fog_pars_vertex:sm,fog_fragment:rm,fog_pars_fragment:am,gradientmap_pars_fragment:om,lightmap_pars_fragment:lm,lights_lambert_fragment:cm,lights_lambert_pars_fragment:hm,lights_pars_begin:um,lights_toon_fragment:fm,lights_toon_pars_fragment:pm,lights_phong_fragment:mm,lights_phong_pars_fragment:gm,lights_physical_fragment:xm,lights_physical_pars_fragment:_m,lights_fragment_begin:vm,lights_fragment_maps:ym,lights_fragment_end:Mm,lightprobes_pars_fragment:Sm,logdepthbuf_fragment:bm,logdepthbuf_pars_fragment:Em,logdepthbuf_pars_vertex:Tm,logdepthbuf_vertex:wm,map_fragment:Am,map_pars_fragment:Rm,map_particle_fragment:Cm,map_particle_pars_fragment:Pm,metalnessmap_fragment:Im,metalnessmap_pars_fragment:Lm,morphinstance_vertex:Dm,morphcolor_vertex:Nm,morphnormal_vertex:Um,morphtarget_pars_vertex:Fm,morphtarget_vertex:Om,normal_fragment_begin:Bm,normal_fragment_maps:zm,normal_pars_fragment:Vm,normal_pars_vertex:km,normal_vertex:Hm,normalmap_pars_fragment:Gm,clearcoat_normal_fragment_begin:Wm,clearcoat_normal_fragment_maps:Xm,clearcoat_pars_fragment:qm,iridescence_pars_fragment:Ym,opaque_fragment:Zm,packing:$m,premultiplied_alpha_fragment:Jm,project_vertex:Km,dithering_fragment:Qm,dithering_pars_fragment:jm,roughnessmap_fragment:t0,roughnessmap_pars_fragment:e0,shadowmap_pars_fragment:n0,shadowmap_pars_vertex:i0,shadowmap_vertex:s0,shadowmask_pars_fragment:r0,skinbase_vertex:a0,skinning_pars_vertex:o0,skinning_vertex:l0,skinnormal_vertex:c0,specularmap_fragment:h0,specularmap_pars_fragment:u0,tonemapping_fragment:d0,tonemapping_pars_fragment:f0,transmission_fragment:p0,transmission_pars_fragment:m0,uv_pars_fragment:g0,uv_pars_vertex:x0,uv_vertex:_0,worldpos_vertex:v0,background_vert:y0,background_frag:M0,backgroundCube_vert:S0,backgroundCube_frag:b0,cube_vert:E0,cube_frag:T0,depth_vert:w0,depth_frag:A0,distance_vert:R0,distance_frag:C0,equirect_vert:P0,equirect_frag:I0,linedashed_vert:L0,linedashed_frag:D0,meshbasic_vert:N0,meshbasic_frag:U0,meshlambert_vert:F0,meshlambert_frag:O0,meshmatcap_vert:B0,meshmatcap_frag:z0,meshnormal_vert:V0,meshnormal_frag:k0,meshphong_vert:H0,meshphong_frag:G0,meshphysical_vert:W0,meshphysical_frag:X0,meshtoon_vert:q0,meshtoon_frag:Y0,points_vert:Z0,points_frag:$0,shadow_vert:J0,shadow_frag:K0,sprite_vert:Q0,sprite_frag:j0},xt={common:{diffuse:{value:new Ht(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Xt}},envmap:{envMap:{value:null},envMapRotation:{value:new Xt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Xt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Xt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Xt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Xt},normalScale:{value:new et(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Xt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Xt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Xt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Xt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ht(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new C},probesMax:{value:new C},probesResolution:{value:new C}},points:{diffuse:{value:new Ht(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0},uvTransform:{value:new Xt}},sprite:{diffuse:{value:new Ht(16777215)},opacity:{value:1},center:{value:new et(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Xt},alphaMap:{value:null},alphaMapTransform:{value:new Xt},alphaTest:{value:0}}},Zn={basic:{uniforms:Ke([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.fog]),vertexShader:jt.meshbasic_vert,fragmentShader:jt.meshbasic_frag},lambert:{uniforms:Ke([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},envMapIntensity:{value:1}}]),vertexShader:jt.meshlambert_vert,fragmentShader:jt.meshlambert_frag},phong:{uniforms:Ke([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},specular:{value:new Ht(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:jt.meshphong_vert,fragmentShader:jt.meshphong_frag},standard:{uniforms:Ke([xt.common,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.roughnessmap,xt.metalnessmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag},toon:{uniforms:Ke([xt.common,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.gradientmap,xt.fog,xt.lights,{emissive:{value:new Ht(0)}}]),vertexShader:jt.meshtoon_vert,fragmentShader:jt.meshtoon_frag},matcap:{uniforms:Ke([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,{matcap:{value:null}}]),vertexShader:jt.meshmatcap_vert,fragmentShader:jt.meshmatcap_frag},points:{uniforms:Ke([xt.points,xt.fog]),vertexShader:jt.points_vert,fragmentShader:jt.points_frag},dashed:{uniforms:Ke([xt.common,xt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jt.linedashed_vert,fragmentShader:jt.linedashed_frag},depth:{uniforms:Ke([xt.common,xt.displacementmap]),vertexShader:jt.depth_vert,fragmentShader:jt.depth_frag},normal:{uniforms:Ke([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,{opacity:{value:1}}]),vertexShader:jt.meshnormal_vert,fragmentShader:jt.meshnormal_frag},sprite:{uniforms:Ke([xt.sprite,xt.fog]),vertexShader:jt.sprite_vert,fragmentShader:jt.sprite_frag},background:{uniforms:{uvTransform:{value:new Xt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jt.background_vert,fragmentShader:jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Xt}},vertexShader:jt.backgroundCube_vert,fragmentShader:jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jt.cube_vert,fragmentShader:jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jt.equirect_vert,fragmentShader:jt.equirect_frag},distance:{uniforms:Ke([xt.common,xt.displacementmap,{referencePosition:{value:new C},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jt.distance_vert,fragmentShader:jt.distance_frag},shadow:{uniforms:Ke([xt.lights,xt.fog,{color:{value:new Ht(0)},opacity:{value:1}}]),vertexShader:jt.shadow_vert,fragmentShader:jt.shadow_frag}};Zn.physical={uniforms:Ke([Zn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Xt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Xt},clearcoatNormalScale:{value:new et(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Xt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Xt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Xt},sheen:{value:0},sheenColor:{value:new Ht(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Xt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Xt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Xt},transmissionSamplerSize:{value:new et},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Xt},attenuationDistance:{value:0},attenuationColor:{value:new Ht(0)},specularColor:{value:new Ht(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Xt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Xt},anisotropyVector:{value:new et},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Xt}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag};var nl={r:0,b:0,g:0},tg=new ce,pd=new Xt;pd.set(-1,0,0,0,1,0,0,0,1);function eg(i,t,e,n,s,r){let a=new Ht(0),o=s===!0?0:1,l,c,h=null,d=0,u=null;function f(M){let S=M.isScene===!0?M.background:null;if(S&&S.isTexture){let y=M.backgroundBlurriness>0;S=t.get(S,y)}return S}function g(M){let S=!1,y=f(M);y===null?p(a,o):y&&y.isColor&&(p(y,1),S=!0);let w=i.xr.getEnvironmentBlendMode();w==="additive"?e.buffers.color.setClear(0,0,0,1,r):w==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||S)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function _(M,S){let y=f(S);y&&(y.isCubeTexture||y.mapping===Nr)?(c===void 0&&(c=new Lt(new Le(1,1,1),new ke({name:"BackgroundCubeMaterial",uniforms:Zi(Zn.backgroundCube.uniforms),vertexShader:Zn.backgroundCube.vertexShader,fragmentShader:Zn.backgroundCube.fragmentShader,side:Ue,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,E,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(tg.makeRotationFromEuler(S.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(pd),c.material.toneMapped=ae.getTransfer(y.colorSpace)!==ue,(h!==y||d!==y.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=y,d=y.version,u=i.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new Lt(new Wn(2,2),new ke({name:"BackgroundMaterial",uniforms:Zi(Zn.background.uniforms),vertexShader:Zn.background.vertexShader,fragmentShader:Zn.background.fragmentShader,side:si,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=ae.getTransfer(y.colorSpace)!==ue,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||d!==y.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=y,d=y.version,u=i.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function p(M,S){M.getRGB(nl,Lc(i)),e.buffers.color.setClear(nl.r,nl.g,nl.b,S,r)}function m(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(M,S=1){a.set(M),o=S,p(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(M){o=M,p(a,o)},render:g,addToRenderList:_,dispose:m}}function ng(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null),r=s,a=!1;function o(I,U,W,X,D){let z=!1,B=d(I,X,W,U);r!==B&&(r=B,c(r.object)),z=f(I,X,W,D),z&&g(I,X,W,D),D!==null&&t.update(D,i.ELEMENT_ARRAY_BUFFER),(z||a)&&(a=!1,y(I,U,W,X),D!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(D).buffer))}function l(){return i.createVertexArray()}function c(I){return i.bindVertexArray(I)}function h(I){return i.deleteVertexArray(I)}function d(I,U,W,X){let D=X.wireframe===!0,z=n[U.id];z===void 0&&(z={},n[U.id]=z);let B=I.isInstancedMesh===!0?I.id:0,$=z[B];$===void 0&&($={},z[B]=$);let Q=$[W.id];Q===void 0&&(Q={},$[W.id]=Q);let ot=Q[D];return ot===void 0&&(ot=u(l()),Q[D]=ot),ot}function u(I){let U=[],W=[],X=[];for(let D=0;D<e;D++)U[D]=0,W[D]=0,X[D]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:U,enabledAttributes:W,attributeDivisors:X,object:I,attributes:{},index:null}}function f(I,U,W,X){let D=r.attributes,z=U.attributes,B=0,$=W.getAttributes();for(let Q in $)if($[Q].location>=0){let lt=D[Q],pt=z[Q];if(pt===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(pt=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(pt=I.instanceColor)),lt===void 0||lt.attribute!==pt||pt&&lt.data!==pt.data)return!0;B++}return r.attributesNum!==B||r.index!==X}function g(I,U,W,X){let D={},z=U.attributes,B=0,$=W.getAttributes();for(let Q in $)if($[Q].location>=0){let lt=z[Q];lt===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(lt=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(lt=I.instanceColor));let pt={};pt.attribute=lt,lt&&lt.data&&(pt.data=lt.data),D[Q]=pt,B++}r.attributes=D,r.attributesNum=B,r.index=X}function _(){let I=r.newAttributes;for(let U=0,W=I.length;U<W;U++)I[U]=0}function p(I){m(I,0)}function m(I,U){let W=r.newAttributes,X=r.enabledAttributes,D=r.attributeDivisors;W[I]=1,X[I]===0&&(i.enableVertexAttribArray(I),X[I]=1),D[I]!==U&&(i.vertexAttribDivisor(I,U),D[I]=U)}function M(){let I=r.newAttributes,U=r.enabledAttributes;for(let W=0,X=U.length;W<X;W++)U[W]!==I[W]&&(i.disableVertexAttribArray(W),U[W]=0)}function S(I,U,W,X,D,z,B){B===!0?i.vertexAttribIPointer(I,U,W,D,z):i.vertexAttribPointer(I,U,W,X,D,z)}function y(I,U,W,X){_();let D=X.attributes,z=W.getAttributes(),B=U.defaultAttributeValues;for(let $ in z){let Q=z[$];if(Q.location>=0){let ot=D[$];if(ot===void 0&&($==="instanceMatrix"&&I.instanceMatrix&&(ot=I.instanceMatrix),$==="instanceColor"&&I.instanceColor&&(ot=I.instanceColor)),ot!==void 0){let lt=ot.normalized,pt=ot.itemSize,Zt=t.get(ot);if(Zt===void 0)continue;let ie=Zt.buffer,Qt=Zt.type,Z=Zt.bytesPerElement,st=Qt===i.INT||Qt===i.UNSIGNED_INT||ot.gpuType===go;if(ot.isInterleavedBufferAttribute){let nt=ot.data,Et=nt.stride,Vt=ot.offset;if(nt.isInstancedInterleavedBuffer){for(let Nt=0;Nt<Q.locationSize;Nt++)m(Q.location+Nt,nt.meshPerAttribute);I.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=nt.meshPerAttribute*nt.count)}else for(let Nt=0;Nt<Q.locationSize;Nt++)p(Q.location+Nt);i.bindBuffer(i.ARRAY_BUFFER,ie);for(let Nt=0;Nt<Q.locationSize;Nt++)S(Q.location+Nt,pt/Q.locationSize,Qt,lt,Et*Z,(Vt+pt/Q.locationSize*Nt)*Z,st)}else{if(ot.isInstancedBufferAttribute){for(let nt=0;nt<Q.locationSize;nt++)m(Q.location+nt,ot.meshPerAttribute);I.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=ot.meshPerAttribute*ot.count)}else for(let nt=0;nt<Q.locationSize;nt++)p(Q.location+nt);i.bindBuffer(i.ARRAY_BUFFER,ie);for(let nt=0;nt<Q.locationSize;nt++)S(Q.location+nt,pt/Q.locationSize,Qt,lt,pt*Z,pt/Q.locationSize*nt*Z,st)}}else if(B!==void 0){let lt=B[$];if(lt!==void 0)switch(lt.length){case 2:i.vertexAttrib2fv(Q.location,lt);break;case 3:i.vertexAttrib3fv(Q.location,lt);break;case 4:i.vertexAttrib4fv(Q.location,lt);break;default:i.vertexAttrib1fv(Q.location,lt)}}}}M()}function w(){T();for(let I in n){let U=n[I];for(let W in U){let X=U[W];for(let D in X){let z=X[D];for(let B in z)h(z[B].object),delete z[B];delete X[D]}}delete n[I]}}function E(I){if(n[I.id]===void 0)return;let U=n[I.id];for(let W in U){let X=U[W];for(let D in X){let z=X[D];for(let B in z)h(z[B].object),delete z[B];delete X[D]}}delete n[I.id]}function R(I){for(let U in n){let W=n[U];for(let X in W){let D=W[X];if(D[I.id]===void 0)continue;let z=D[I.id];for(let B in z)h(z[B].object),delete z[B];delete D[I.id]}}}function x(I){for(let U in n){let W=n[U],X=I.isInstancedMesh===!0?I.id:0,D=W[X];if(D!==void 0){for(let z in D){let B=D[z];for(let $ in B)h(B[$].object),delete B[$];delete D[z]}delete W[X],Object.keys(W).length===0&&delete n[U]}}}function T(){P(),a=!0,r!==s&&(r=s,c(r.object))}function P(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:T,resetDefaultState:P,dispose:w,releaseStatesOfGeometry:E,releaseStatesOfObject:x,releaseStatesOfProgram:R,initAttributes:_,enableAttribute:p,disableUnusedAttributes:M}}function ig(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function a(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function o(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];e.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function sg(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let R=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==an&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){let x=R===qn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==rn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==Sn&&!x)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Ot("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=e.logarithmicDepthBuffer===!0,u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&u===!1&&Ot("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),m=i.getParameter(i.MAX_VERTEX_ATTRIBS),M=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),S=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),w=i.getParameter(i.MAX_SAMPLES),E=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:p,maxAttributes:m,maxVertexUniforms:M,maxVaryings:S,maxFragmentUniforms:y,maxSamples:w,samples:E}}function rg(i){let t=this,e=null,n=0,s=!1,r=!1,a=new vn,o=new Xt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let f=d.length!==0||u||n!==0||s;return s=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){e=h(d,u,0)},this.setState=function(d,u,f){let g=d.clippingPlanes,_=d.clipIntersection,p=d.clipShadows,m=i.get(d);if(!s||g===null||g.length===0||r&&!p)r?h(null):c();else{let M=r?0:n,S=M*4,y=m.clippingState||null;l.value=y,y=h(g,u,S,f);for(let w=0;w!==S;++w)y[w]=e[w];m.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(d,u,f,g){let _=d!==null?d.length:0,p=null;if(_!==0){if(p=l.value,g!==!0||p===null){let m=f+_*4,M=u.matrixWorldInverse;o.getNormalMatrix(M),(p===null||p.length<m)&&(p=new Float32Array(m));for(let S=0,y=f;S!==_;++S,y+=4)a.copy(d[S]).applyMatrix4(M,o),a.normal.toArray(p,y),p[y+3]=a.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}var Ri=4,Xu=[.125,.215,.35,.446,.526,.582],$i=20,ag=256,Hr=new Rs,qu=new Ht,kc=null,Hc=0,Gc=0,Wc=!1,og=new C,sl=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:a=256,position:o=og}=r;kc=this._renderer.getRenderTarget(),Hc=this._renderer.getActiveCubeFace(),Gc=this._renderer.getActiveMipmapLevel(),Wc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,s,l,o),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=$u(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Zu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(kc,Hc,Gc),this._renderer.xr.enabled=Wc,t.scissorTest=!1,Ds(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ei||t.mapping===Yi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),kc=this._renderer.getRenderTarget(),Hc=this._renderer.getActiveCubeFace(),Gc=this._renderer.getActiveMipmapLevel(),Wc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Ie,minFilter:Ie,generateMipmaps:!1,type:qn,format:an,colorSpace:nr,depthBuffer:!1},s=Yu(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Yu(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=lg(r)),this._blurMaterial=hg(r,t,e),this._ggxMaterial=cg(r,t,e)}return s}_compileMaterial(t){let e=new Lt(new me,t);this._renderer.compile(e,Hr)}_sceneToCubeUV(t,e,n,s,r){let l=new $e(90,1,e,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(qu),d.toneMapping=In,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Lt(new Le,new Gn({name:"PMREM.Background",side:Ue,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,p=_.material,m=!1,M=t.background;M?M.isColor&&(p.color.copy(M),t.background=null,m=!0):(p.color.copy(qu),m=!0);for(let S=0;S<6;S++){let y=S%3;y===0?(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[S],r.y,r.z)):y===1?(l.up.set(0,0,c[S]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[S],r.z)):(l.up.set(0,c[S],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[S]));let w=this._cubeSize;Ds(s,y*w,S>2?w:0,w,w),d.setRenderTarget(s),m&&d.render(_,l),d.render(t,l)}d.toneMapping=f,d.autoClear=u,t.background=M}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Ei||t.mapping===Yi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=$u()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Zu());let r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;let o=r.uniforms;o.envMap.value=t;let l=this._cubeSize;Ds(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Hr)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let l=a.uniforms,c=n/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=0+c*1.25,f=d*u,{_lodMax:g}=this,_=this._sizeLods[n],p=3*_*(n>g-Ri?n-g+Ri:0),m=4*(this._cubeSize-_);l.envMap.value=t.texture,l.roughness.value=f,l.mipInt.value=g-e,Ds(r,p,m,3*_,2*_),s.setRenderTarget(r),s.render(o,Hr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,Ds(t,p,m,3*_,2*_),s.setRenderTarget(t),s.render(o,Hr)}_blur(t,e,n,s,r){let a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Ut("blur direction must be either latitudinal or longitudinal!");let h=3,d=this._lodMeshes[s];d.material=c;let u=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*$i-1),_=r/g,p=isFinite(r)?1+Math.floor(h*_):$i;p>$i&&Ot(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${$i}`);let m=[],M=0;for(let R=0;R<$i;++R){let x=R/_,T=Math.exp(-x*x/2);m.push(T),R===0?M+=T:R<p&&(M+=2*T)}for(let R=0;R<m.length;R++)m[R]=m[R]/M;u.envMap.value=t.texture,u.samples.value=p,u.weights.value=m,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:S}=this;u.dTheta.value=g,u.mipInt.value=S-n;let y=this._sizeLods[s],w=3*y*(s>S-Ri?s-S+Ri:0),E=4*(this._cubeSize-y);Ds(e,w,E,3*y,2*y),l.setRenderTarget(e),l.render(d,Hr)}};function lg(i){let t=[],e=[],n=[],s=i,r=i-Ri+1+Xu.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);t.push(o);let l=1/o;a>i-Ri?l=Xu[a-i+Ri-1]:a===0&&(l=0),e.push(l);let c=1/(o-2),h=-c,d=1+c,u=[h,h,d,h,d,d,h,h,d,d,h,d],f=6,g=6,_=3,p=2,m=1,M=new Float32Array(_*g*f),S=new Float32Array(p*g*f),y=new Float32Array(m*g*f);for(let E=0;E<f;E++){let R=E%3*2/3-1,x=E>2?0:-1,T=[R,x,0,R+2/3,x,0,R+2/3,x+1,0,R,x,0,R+2/3,x+1,0,R,x+1,0];M.set(T,_*g*E),S.set(u,p*g*E);let P=[E,E,E,E,E,E];y.set(P,m*g*E)}let w=new me;w.setAttribute("position",new Se(M,_)),w.setAttribute("uv",new Se(S,p)),w.setAttribute("faceIndex",new Se(y,m)),n.push(new Lt(w,null)),s>Ri&&s--}return{lodMeshes:n,sizeLods:t,sigmas:e}}function Yu(i,t,e){let n=new dn(i,t,e);return n.texture.mapping=Nr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ds(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function cg(i,t,e){return new ke({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:ag,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:ol(),fragmentShader:`

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
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function hg(i,t,e){let n=new Float32Array($i),s=new C(0,1,0);return new ke({name:"SphericalGaussianBlur",defines:{n:$i,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:ol(),fragmentShader:`

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
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function Zu(){return new ke({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ol(),fragmentShader:`

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
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function $u(){return new ke({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ol(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Xn,depthTest:!1,depthWrite:!1})}function ol(){return`

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
	`}var rl=class extends dn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new pr(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Le(5,5,5),r=new ke({name:"CubemapFromEquirect",uniforms:Zi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ue,blending:Xn});r.uniforms.tEquirect.value=e;let a=new Lt(s,r),o=e.minFilter;return e.minFilter===Ti&&(e.minFilter=Ie),new co(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}};function ug(i){let t=new WeakMap,e=new WeakMap,n=null;function s(u,f=!1){return u==null?null:f?a(u):r(u)}function r(u){if(u&&u.isTexture){let f=u.mapping;if(f===fo||f===po)if(t.has(u)){let g=t.get(u).texture;return o(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let _=new rl(g.height);return _.fromEquirectangularTexture(i,u),t.set(u,_),u.addEventListener("dispose",c),o(_.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){let f=u.mapping,g=f===fo||f===po,_=f===Ei||f===Yi;if(g||_){let p=e.get(u),m=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==m)return n===null&&(n=new sl(i)),p=g?n.fromEquirectangular(u,p):n.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),p.texture;if(p!==void 0)return p.texture;{let M=u.image;return g&&M&&M.height>0||_&&M&&l(M)?(n===null&&(n=new sl(i)),p=g?n.fromEquirectangular(u):n.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function o(u,f){return f===fo?u.mapping=Ei:f===po&&(u.mapping=Yi),u}function l(u){let f=0,g=6;for(let _=0;_<g;_++)u[_]!==void 0&&f++;return f===g}function c(u){let f=u.target;f.removeEventListener("dispose",c);let g=t.get(f);g!==void 0&&(t.delete(f),g.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let g=e.get(f);g!==void 0&&(e.delete(f),g.dispose())}function d(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:d}}function dg(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&zi("WebGLRenderer: "+n+" extension not supported."),s}}}function fg(i,t,e,n){let s={},r=new WeakMap;function a(d){let u=d.target;u.index!==null&&t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",a),delete s[u.id];let f=r.get(u);f&&(t.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function o(d,u){return s[u.id]===!0||(u.addEventListener("dispose",a),s[u.id]=!0,e.memory.geometries++),u}function l(d){let u=d.attributes;for(let f in u)t.update(u[f],i.ARRAY_BUFFER)}function c(d){let u=[],f=d.index,g=d.attributes.position,_=0;if(g===void 0)return;if(f!==null){let M=f.array;_=f.version;for(let S=0,y=M.length;S<y;S+=3){let w=M[S+0],E=M[S+1],R=M[S+2];u.push(w,E,E,R,R,w)}}else{let M=g.array;_=g.version;for(let S=0,y=M.length/3-1;S<y;S+=3){let w=S+0,E=S+1,R=S+2;u.push(w,E,E,R,R,w)}}let p=new(g.count>=65535?hr:cr)(u,1);p.version=_;let m=r.get(d);m&&t.remove(m),r.set(d,p)}function h(d){let u=r.get(d);if(u){let f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:o,update:l,getWireframeAttribute:h}}function pg(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,u){i.drawElements(n,u,r,d*a),e.update(u,n,1)}function c(d,u,f){f!==0&&(i.drawElementsInstanced(n,u,r,d*a,f),e.update(u,n,f))}function h(d,u,f){if(f===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let _=0;for(let p=0;p<f;p++)_+=u[p];e.update(_,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function mg(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:Ut("WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function gg(i,t,e){let n=new WeakMap,s=new be;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0,u=n.get(o);if(u===void 0||u.count!==d){let T=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",T)};u!==void 0&&u.texture.dispose();let f=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,_=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],m=o.morphAttributes.normal||[],M=o.morphAttributes.color||[],S=0;f===!0&&(S=1),g===!0&&(S=2),_===!0&&(S=3);let y=o.attributes.position.count*S,w=1;y>t.maxTextureSize&&(w=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);let E=new Float32Array(y*w*4*d),R=new ar(E,y,w,d);R.type=Sn,R.needsUpdate=!0;let x=S*4;for(let P=0;P<d;P++){let I=p[P],U=m[P],W=M[P],X=y*w*4*P;for(let D=0;D<I.count;D++){let z=D*x;f===!0&&(s.fromBufferAttribute(I,D),E[X+z+0]=s.x,E[X+z+1]=s.y,E[X+z+2]=s.z,E[X+z+3]=0),g===!0&&(s.fromBufferAttribute(U,D),E[X+z+4]=s.x,E[X+z+5]=s.y,E[X+z+6]=s.z,E[X+z+7]=0),_===!0&&(s.fromBufferAttribute(W,D),E[X+z+8]=s.x,E[X+z+9]=s.y,E[X+z+10]=s.z,E[X+z+11]=W.itemSize===4?s.w:1)}}u={count:d,texture:R,size:new et(y,w)},n.set(o,u),o.addEventListener("dispose",T)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let f=0;for(let _=0;_<c.length;_++)f+=c[_];let g=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function xg(i,t,e,n,s){let r=new WeakMap;function a(c){let h=s.render.frame,d=c.geometry,u=t.get(c,d);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function o(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:a,dispose:o}}var _g={[gc]:"LINEAR_TONE_MAPPING",[xc]:"REINHARD_TONE_MAPPING",[_c]:"CINEON_TONE_MAPPING",[Dr]:"ACES_FILMIC_TONE_MAPPING",[yc]:"AGX_TONE_MAPPING",[Mc]:"NEUTRAL_TONE_MAPPING",[vc]:"CUSTOM_TONE_MAPPING"};function vg(i,t,e,n,s,r){let a=new dn(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new ri(t,e):void 0}),o=new dn(t,e,{type:qn,depthBuffer:!1,stencilBuffer:!1}),l=new me;l.setAttribute("position",new Yt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new Yt([0,2,0,0,2,0],2));let c=new Ja({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),h=new Lt(l,c),d=new Rs(-1,1,1,-1,0,1),u=null,f=null,g=!1,_,p=null,m=[],M=!1;this.setSize=function(S,y){a.setSize(S,y),o.setSize(S,y);for(let w=0;w<m.length;w++){let E=m[w];E.setSize&&E.setSize(S,y)}},this.setEffects=function(S){m=S,M=m.length>0&&m[0].isRenderPass===!0;let y=a.width,w=a.height;for(let E=0;E<m.length;E++){let R=m[E];R.setSize&&R.setSize(y,w)}},this.begin=function(S,y){if(g||S.toneMapping===In&&m.length===0)return!1;if(p=y,y!==null){let w=y.width,E=y.height;(a.width!==w||a.height!==E)&&this.setSize(w,E)}return M===!1&&S.setRenderTarget(a),_=S.toneMapping,S.toneMapping=In,!0},this.hasRenderPass=function(){return M},this.end=function(S,y){S.toneMapping=_,g=!0;let w=a,E=o;for(let R=0;R<m.length;R++){let x=m[R];if(x.enabled!==!1&&(x.render(S,E,w,y),x.needsSwap!==!1)){let T=w;w=E,E=T}}if(u!==S.outputColorSpace||f!==S.toneMapping){u=S.outputColorSpace,f=S.toneMapping,c.defines={},ae.getTransfer(u)===ue&&(c.defines.SRGB_TRANSFER="");let R=_g[f];R&&(c.defines[R]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=w.texture,S.setRenderTarget(p),S.render(h,d),p=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}var md=new je,Yc=new ri(1,1),gd=new ar,xd=new za,_d=new pr,Ju=[],Ku=[],Qu=new Float32Array(16),ju=new Float32Array(9),td=new Float32Array(4);function Us(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=Ju[s];if(r===void 0&&(r=new Float32Array(s),Ju[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function Fe(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Oe(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function ll(i,t){let e=Ku[t];e===void 0&&(e=new Int32Array(t),Ku[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function yg(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Mg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2fv(this.addr,t),Oe(e,t)}}function Sg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Fe(e,t))return;i.uniform3fv(this.addr,t),Oe(e,t)}}function bg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4fv(this.addr,t),Oe(e,t)}}function Eg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;td.set(n),i.uniformMatrix2fv(this.addr,!1,td),Oe(e,n)}}function Tg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;ju.set(n),i.uniformMatrix3fv(this.addr,!1,ju),Oe(e,n)}}function wg(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;Qu.set(n),i.uniformMatrix4fv(this.addr,!1,Qu),Oe(e,n)}}function Ag(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Rg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2iv(this.addr,t),Oe(e,t)}}function Cg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;i.uniform3iv(this.addr,t),Oe(e,t)}}function Pg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4iv(this.addr,t),Oe(e,t)}}function Ig(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Lg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2uiv(this.addr,t),Oe(e,t)}}function Dg(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;i.uniform3uiv(this.addr,t),Oe(e,t)}}function Ng(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4uiv(this.addr,t),Oe(e,t)}}function Ug(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Yc.compareFunction=e.isReversedDepthBuffer()?el:tl,r=Yc):r=md,e.setTexture2D(t||r,s)}function Fg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||xd,s)}function Og(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||_d,s)}function Bg(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||gd,s)}function zg(i){switch(i){case 5126:return yg;case 35664:return Mg;case 35665:return Sg;case 35666:return bg;case 35674:return Eg;case 35675:return Tg;case 35676:return wg;case 5124:case 35670:return Ag;case 35667:case 35671:return Rg;case 35668:case 35672:return Cg;case 35669:case 35673:return Pg;case 5125:return Ig;case 36294:return Lg;case 36295:return Dg;case 36296:return Ng;case 35678:case 36198:case 36298:case 36306:case 35682:return Ug;case 35679:case 36299:case 36307:return Fg;case 35680:case 36300:case 36308:case 36293:return Og;case 36289:case 36303:case 36311:case 36292:return Bg}}function Vg(i,t){i.uniform1fv(this.addr,t)}function kg(i,t){let e=Us(t,this.size,2);i.uniform2fv(this.addr,e)}function Hg(i,t){let e=Us(t,this.size,3);i.uniform3fv(this.addr,e)}function Gg(i,t){let e=Us(t,this.size,4);i.uniform4fv(this.addr,e)}function Wg(i,t){let e=Us(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function Xg(i,t){let e=Us(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function qg(i,t){let e=Us(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function Yg(i,t){i.uniform1iv(this.addr,t)}function Zg(i,t){i.uniform2iv(this.addr,t)}function $g(i,t){i.uniform3iv(this.addr,t)}function Jg(i,t){i.uniform4iv(this.addr,t)}function Kg(i,t){i.uniform1uiv(this.addr,t)}function Qg(i,t){i.uniform2uiv(this.addr,t)}function jg(i,t){i.uniform3uiv(this.addr,t)}function tx(i,t){i.uniform4uiv(this.addr,t)}function ex(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=Yc:a=md;for(let o=0;o!==s;++o)e.setTexture2D(t[o]||a,r[o])}function nx(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||xd,r[a])}function ix(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||_d,r[a])}function sx(i,t,e){let n=this.cache,s=t.length,r=ll(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||gd,r[a])}function rx(i){switch(i){case 5126:return Vg;case 35664:return kg;case 35665:return Hg;case 35666:return Gg;case 35674:return Wg;case 35675:return Xg;case 35676:return qg;case 5124:case 35670:return Yg;case 35667:case 35671:return Zg;case 35668:case 35672:return $g;case 35669:case 35673:return Jg;case 5125:return Kg;case 36294:return Qg;case 36295:return jg;case 36296:return tx;case 35678:case 36198:case 36298:case 36306:case 35682:return ex;case 35679:case 36299:case 36307:return nx;case 35680:case 36300:case 36308:case 36293:return ix;case 36289:case 36303:case 36311:case 36292:return sx}}var Zc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=zg(e.type)}},$c=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=rx(e.type)}},Jc=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},Xc=/(\w+)(\])?(\[|\.)?/g;function ed(i,t){i.seq.push(t),i.map[t.id]=t}function ax(i,t,e){let n=i.name,s=n.length;for(Xc.lastIndex=0;;){let r=Xc.exec(n),a=Xc.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){ed(e,c===void 0?new Zc(o,i,t):new $c(o,i,t));break}else{let d=e.map[o];d===void 0&&(d=new Jc(o),ed(e,d)),e=d}}}var Ns=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=t.getActiveUniform(e,a),l=t.getUniformLocation(e,o.name);ax(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===t.SAMPLER_2D_SHADOW||a.type===t.SAMPLER_CUBE_SHADOW||a.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function nd(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var ox=37297,lx=0;function cx(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var id=new Xt;function hx(i){ae._getMatrix(id,ae.workingColorSpace,i);let t=`mat3( ${id.elements.map(e=>e.toFixed(4))} )`;switch(ae.getTransfer(i)){case ir:return[t,"LinearTransferOETF"];case ue:return[t,"sRGBTransferOETF"];default:return Ot("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function sd(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return e.toUpperCase()+`

`+r+`

`+cx(i.getShaderSource(t),o)}else return r}function ux(i,t){let e=hx(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var dx={[gc]:"Linear",[xc]:"Reinhard",[_c]:"Cineon",[Dr]:"ACESFilmic",[yc]:"AgX",[Mc]:"Neutral",[vc]:"Custom"};function fx(i,t){let e=dx[t];return e===void 0?(Ot("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var il=new C;function px(){ae.getLuminanceCoefficients(il);let i=il.x.toFixed(4),t=il.y.toFixed(4),e=il.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function mx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Wr).join(`
`)}function gx(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function xx(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function Wr(i){return i!==""}function rd(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function ad(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var _x=/^[ \t]*#include +<([\w\d./]+)>/gm;function Kc(i){return i.replace(_x,yx)}var vx=new Map;function yx(i,t){let e=jt[t];if(e===void 0){let n=vx.get(t);if(n!==void 0)e=jt[n],Ot('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Kc(e)}var Mx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function od(i){return i.replace(Mx,Sx)}function Sx(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function ld(i){let t=`precision ${i.precision} float;
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
#define LOW_PRECISION`),t}var bx={[qi]:"SHADOWMAP_TYPE_PCF",[Ps]:"SHADOWMAP_TYPE_VSM"};function Ex(i){return bx[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Tx={[Ei]:"ENVMAP_TYPE_CUBE",[Yi]:"ENVMAP_TYPE_CUBE",[Nr]:"ENVMAP_TYPE_CUBE_UV"};function wx(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Tx[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Ax={[Yi]:"ENVMAP_MODE_REFRACTION"};function Rx(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Ax[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Cx={[mc]:"ENVMAP_BLENDING_MULTIPLY",[Su]:"ENVMAP_BLENDING_MIX",[bu]:"ENVMAP_BLENDING_ADD"};function Px(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Cx[i.combine]||"ENVMAP_BLENDING_NONE"}function Ix(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Lx(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,l=Ex(e),c=wx(e),h=Rx(e),d=Px(e),u=Ix(e),f=mx(e),g=gx(r),_=s.createProgram(),p,m,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Wr).join(`
`),p.length>0&&(p+=`
`),m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Wr).join(`
`),m.length>0&&(m+=`
`)):(p=[ld(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Wr).join(`
`),m=[ld(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==In?"#define TONE_MAPPING":"",e.toneMapping!==In?jt.tonemapping_pars_fragment:"",e.toneMapping!==In?fx("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",jt.colorspace_pars_fragment,ux("linearToOutputTexel",e.outputColorSpace),px(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Wr).join(`
`)),a=Kc(a),a=rd(a,e),a=ad(a,e),o=Kc(o),o=rd(o,e),o=ad(o,e),a=od(a),o=od(o),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,p=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,m=["#define varying in",e.glslVersion===Pc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Pc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let S=M+p+a,y=M+m+o,w=nd(s,s.VERTEX_SHADER,S),E=nd(s,s.FRAGMENT_SHADER,y);s.attachShader(_,w),s.attachShader(_,E),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function R(I){if(i.debug.checkShaderErrors){let U=s.getProgramInfoLog(_)||"",W=s.getShaderInfoLog(w)||"",X=s.getShaderInfoLog(E)||"",D=U.trim(),z=W.trim(),B=X.trim(),$=!0,Q=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if($=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,w,E);else{let ot=sd(s,w,"vertex"),lt=sd(s,E,"fragment");Ut("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+D+`
`+ot+`
`+lt)}else D!==""?Ot("WebGLProgram: Program Info Log:",D):(z===""||B==="")&&(Q=!1);Q&&(I.diagnostics={runnable:$,programLog:D,vertexShader:{log:z,prefix:p},fragmentShader:{log:B,prefix:m}})}s.deleteShader(w),s.deleteShader(E),x=new Ns(s,_),T=xx(s,_)}let x;this.getUniforms=function(){return x===void 0&&R(this),x};let T;this.getAttributes=function(){return T===void 0&&R(this),T};let P=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=s.getProgramParameter(_,ox)),P},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=lx++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=w,this.fragmentShader=E,this}var Dx=0,Qc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new jc(t),e.set(t,n)),n}},jc=class{constructor(t){this.id=Dx++,this.code=t,this.usedTimes=0}};function Nx(i){return i===Ai||i===Vr||i===kr}function Ux(i,t,e,n,s,r){let a=new Ms,o=new Qc,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,u=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(x){return l.add(x),x===0?"uv":`uv${x}`}function _(x,T,P,I,U,W){let X=I.fog,D=U.geometry,z=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?I.environment:null,B=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,$=t.get(x.envMap||z,B),Q=$&&$.mapping===Nr?$.image.height:null,ot=f[x.type];x.precision!==null&&(u=n.getMaxPrecision(x.precision),u!==x.precision&&Ot("WebGLProgram.getParameters:",x.precision,"not supported, using",u,"instead."));let lt=D.morphAttributes.position||D.morphAttributes.normal||D.morphAttributes.color,pt=lt!==void 0?lt.length:0,Zt=0;D.morphAttributes.position!==void 0&&(Zt=1),D.morphAttributes.normal!==void 0&&(Zt=2),D.morphAttributes.color!==void 0&&(Zt=3);let ie,Qt,Z,st;if(ot){let Tt=Zn[ot];ie=Tt.vertexShader,Qt=Tt.fragmentShader}else{ie=x.vertexShader,Qt=x.fragmentShader;let Tt=o.getVertexShaderStage(x),Te=o.getFragmentShaderStage(x);o.update(x,Tt,Te),Z=Tt.id,st=Te.id}let nt=i.getRenderTarget(),Et=i.state.buffers.depth.getReversed(),Vt=U.isInstancedMesh===!0,Nt=U.isBatchedMesh===!0,he=!!x.map,Gt=!!x.matcap,j=!!$,rt=!!x.aoMap,it=!!x.lightMap,_t=!!x.bumpMap&&x.wireframe===!1,mt=!!x.normalMap,Ft=!!x.displacementMap,Rt=!!x.emissiveMap,kt=!!x.metalnessMap,qt=!!x.roughnessMap,L=x.anisotropy>0,de=x.clearcoat>0,se=x.dispersion>0,A=x.iridescence>0,v=x.sheen>0,O=x.transmission>0,H=L&&!!x.anisotropyMap,q=de&&!!x.clearcoatMap,at=de&&!!x.clearcoatNormalMap,ct=de&&!!x.clearcoatRoughnessMap,Y=A&&!!x.iridescenceMap,K=A&&!!x.iridescenceThicknessMap,ut=v&&!!x.sheenColorMap,Ct=v&&!!x.sheenRoughnessMap,gt=!!x.specularMap,dt=!!x.specularColorMap,Dt=!!x.specularIntensityMap,Bt=O&&!!x.transmissionMap,$t=O&&!!x.thicknessMap,N=!!x.gradientMap,ht=!!x.alphaMap,J=x.alphaTest>0,ft=!!x.alphaHash,Mt=!!x.extensions,tt=In;x.toneMapped&&(nt===null||nt.isXRRenderTarget===!0)&&(tt=i.toneMapping);let At={shaderID:ot,shaderType:x.type,shaderName:x.name,vertexShader:ie,fragmentShader:Qt,defines:x.defines,customVertexShaderID:Z,customFragmentShaderID:st,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:u,batching:Nt,batchingColor:Nt&&U._colorsTexture!==null,instancing:Vt,instancingColor:Vt&&U.instanceColor!==null,instancingMorph:Vt&&U.morphTexture!==null,outputColorSpace:nt===null?i.outputColorSpace:nt.isXRRenderTarget===!0?nt.texture.colorSpace:ae.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:he,matcap:Gt,envMap:j,envMapMode:j&&$.mapping,envMapCubeUVHeight:Q,aoMap:rt,lightMap:it,bumpMap:_t,normalMap:mt,displacementMap:Ft,emissiveMap:Rt,normalMapObjectSpace:mt&&x.normalMapType===wu,normalMapTangentSpace:mt&&x.normalMapType===jo,packedNormalMap:mt&&x.normalMapType===jo&&Nx(x.normalMap.format),metalnessMap:kt,roughnessMap:qt,anisotropy:L,anisotropyMap:H,clearcoat:de,clearcoatMap:q,clearcoatNormalMap:at,clearcoatRoughnessMap:ct,dispersion:se,iridescence:A,iridescenceMap:Y,iridescenceThicknessMap:K,sheen:v,sheenColorMap:ut,sheenRoughnessMap:Ct,specularMap:gt,specularColorMap:dt,specularIntensityMap:Dt,transmission:O,transmissionMap:Bt,thicknessMap:$t,gradientMap:N,opaque:x.transparent===!1&&x.blending===Cn&&x.alphaToCoverage===!1,alphaMap:ht,alphaTest:J,alphaHash:ft,combine:x.combine,mapUv:he&&g(x.map.channel),aoMapUv:rt&&g(x.aoMap.channel),lightMapUv:it&&g(x.lightMap.channel),bumpMapUv:_t&&g(x.bumpMap.channel),normalMapUv:mt&&g(x.normalMap.channel),displacementMapUv:Ft&&g(x.displacementMap.channel),emissiveMapUv:Rt&&g(x.emissiveMap.channel),metalnessMapUv:kt&&g(x.metalnessMap.channel),roughnessMapUv:qt&&g(x.roughnessMap.channel),anisotropyMapUv:H&&g(x.anisotropyMap.channel),clearcoatMapUv:q&&g(x.clearcoatMap.channel),clearcoatNormalMapUv:at&&g(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ct&&g(x.clearcoatRoughnessMap.channel),iridescenceMapUv:Y&&g(x.iridescenceMap.channel),iridescenceThicknessMapUv:K&&g(x.iridescenceThicknessMap.channel),sheenColorMapUv:ut&&g(x.sheenColorMap.channel),sheenRoughnessMapUv:Ct&&g(x.sheenRoughnessMap.channel),specularMapUv:gt&&g(x.specularMap.channel),specularColorMapUv:dt&&g(x.specularColorMap.channel),specularIntensityMapUv:Dt&&g(x.specularIntensityMap.channel),transmissionMapUv:Bt&&g(x.transmissionMap.channel),thicknessMapUv:$t&&g(x.thicknessMap.channel),alphaMapUv:ht&&g(x.alphaMap.channel),vertexTangents:!!D.attributes.tangent&&(mt||L),vertexNormals:!!D.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!D.attributes.color&&D.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!D.attributes.uv&&(he||ht),fog:!!X,useFog:x.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||D.attributes.normal===void 0&&mt===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:Et,skinning:U.isSkinnedMesh===!0,hasPositionAttribute:D.attributes.position!==void 0,morphTargets:D.morphAttributes.position!==void 0,morphNormals:D.morphAttributes.normal!==void 0,morphColors:D.morphAttributes.color!==void 0,morphTargetsCount:pt,morphTextureStride:Zt,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:tt,decodeVideoTexture:he&&x.map.isVideoTexture===!0&&ae.getTransfer(x.map.colorSpace)===ue,decodeVideoTextureEmissive:Rt&&x.emissiveMap.isVideoTexture===!0&&ae.getTransfer(x.emissiveMap.colorSpace)===ue,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Je,flipSided:x.side===Ue,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:Mt&&x.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Mt&&x.extensions.multiDraw===!0||Nt)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return At.vertexUv1s=l.has(1),At.vertexUv2s=l.has(2),At.vertexUv3s=l.has(3),l.clear(),At}function p(x){let T=[];if(x.shaderID?T.push(x.shaderID):(T.push(x.customVertexShaderID),T.push(x.customFragmentShaderID)),x.defines!==void 0)for(let P in x.defines)T.push(P),T.push(x.defines[P]);return x.isRawShaderMaterial===!1&&(m(T,x),M(T,x),T.push(i.outputColorSpace)),T.push(x.customProgramCacheKey),T.join()}function m(x,T){x.push(T.precision),x.push(T.outputColorSpace),x.push(T.envMapMode),x.push(T.envMapCubeUVHeight),x.push(T.mapUv),x.push(T.alphaMapUv),x.push(T.lightMapUv),x.push(T.aoMapUv),x.push(T.bumpMapUv),x.push(T.normalMapUv),x.push(T.displacementMapUv),x.push(T.emissiveMapUv),x.push(T.metalnessMapUv),x.push(T.roughnessMapUv),x.push(T.anisotropyMapUv),x.push(T.clearcoatMapUv),x.push(T.clearcoatNormalMapUv),x.push(T.clearcoatRoughnessMapUv),x.push(T.iridescenceMapUv),x.push(T.iridescenceThicknessMapUv),x.push(T.sheenColorMapUv),x.push(T.sheenRoughnessMapUv),x.push(T.specularMapUv),x.push(T.specularColorMapUv),x.push(T.specularIntensityMapUv),x.push(T.transmissionMapUv),x.push(T.thicknessMapUv),x.push(T.combine),x.push(T.fogExp2),x.push(T.sizeAttenuation),x.push(T.morphTargetsCount),x.push(T.morphAttributeCount),x.push(T.numDirLights),x.push(T.numPointLights),x.push(T.numSpotLights),x.push(T.numSpotLightMaps),x.push(T.numHemiLights),x.push(T.numRectAreaLights),x.push(T.numDirLightShadows),x.push(T.numPointLightShadows),x.push(T.numSpotLightShadows),x.push(T.numSpotLightShadowsWithMaps),x.push(T.numLightProbes),x.push(T.shadowMapType),x.push(T.toneMapping),x.push(T.numClippingPlanes),x.push(T.numClipIntersection),x.push(T.depthPacking)}function M(x,T){a.disableAll(),T.instancing&&a.enable(0),T.instancingColor&&a.enable(1),T.instancingMorph&&a.enable(2),T.matcap&&a.enable(3),T.envMap&&a.enable(4),T.normalMapObjectSpace&&a.enable(5),T.normalMapTangentSpace&&a.enable(6),T.clearcoat&&a.enable(7),T.iridescence&&a.enable(8),T.alphaTest&&a.enable(9),T.vertexColors&&a.enable(10),T.vertexAlphas&&a.enable(11),T.vertexUv1s&&a.enable(12),T.vertexUv2s&&a.enable(13),T.vertexUv3s&&a.enable(14),T.vertexTangents&&a.enable(15),T.anisotropy&&a.enable(16),T.alphaHash&&a.enable(17),T.batching&&a.enable(18),T.dispersion&&a.enable(19),T.batchingColor&&a.enable(20),T.gradientMap&&a.enable(21),T.packedNormalMap&&a.enable(22),T.vertexNormals&&a.enable(23),x.push(a.mask),a.disableAll(),T.fog&&a.enable(0),T.useFog&&a.enable(1),T.flatShading&&a.enable(2),T.logarithmicDepthBuffer&&a.enable(3),T.reversedDepthBuffer&&a.enable(4),T.skinning&&a.enable(5),T.morphTargets&&a.enable(6),T.morphNormals&&a.enable(7),T.morphColors&&a.enable(8),T.premultipliedAlpha&&a.enable(9),T.shadowMapEnabled&&a.enable(10),T.doubleSided&&a.enable(11),T.flipSided&&a.enable(12),T.useDepthPacking&&a.enable(13),T.dithering&&a.enable(14),T.transmission&&a.enable(15),T.sheen&&a.enable(16),T.opaque&&a.enable(17),T.pointsUvs&&a.enable(18),T.decodeVideoTexture&&a.enable(19),T.decodeVideoTextureEmissive&&a.enable(20),T.alphaToCoverage&&a.enable(21),T.numLightProbeGrids>0&&a.enable(22),T.hasPositionAttribute&&a.enable(23),x.push(a.mask)}function S(x){let T=f[x.type],P;if(T){let I=Zn[T];P=Gu.clone(I.uniforms)}else P=x.uniforms;return P}function y(x,T){let P=h.get(T);return P!==void 0?++P.usedTimes:(P=new Lx(i,T,x,s),c.push(P),h.set(T,P)),P}function w(x){if(--x.usedTimes===0){let T=c.indexOf(x);c[T]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function E(x){o.remove(x)}function R(){o.dispose()}return{getParameters:_,getProgramCacheKey:p,getUniforms:S,acquireProgram:y,releaseProgram:w,releaseShaderCache:E,programs:c,dispose:R}}function Fx(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Ox(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function cd(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function hd(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function o(u,f,g,_,p,m){let M=i[t];return M===void 0?(M={id:u.id,object:u,geometry:f,material:g,materialVariant:a(u),groupOrder:_,renderOrder:u.renderOrder,z:p,group:m},i[t]=M):(M.id=u.id,M.object=u,M.geometry=f,M.material=g,M.materialVariant=a(u),M.groupOrder=_,M.renderOrder=u.renderOrder,M.z=p,M.group=m),t++,M}function l(u,f,g,_,p,m){let M=o(u,f,g,_,p,m);g.transmission>0?n.push(M):g.transparent===!0?s.push(M):e.push(M)}function c(u,f,g,_,p,m){let M=o(u,f,g,_,p,m);g.transmission>0?n.unshift(M):g.transparent===!0?s.unshift(M):e.unshift(M)}function h(u,f,g){e.length>1&&e.sort(u||Ox),n.length>1&&n.sort(f||cd),s.length>1&&s.sort(f||cd),g&&(e.reverse(),n.reverse(),s.reverse())}function d(){for(let u=t,f=i.length;u<f;u++){let g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:d,sort:h}}function Bx(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new hd,i.set(n,[a])):s>=r.length?(a=new hd,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function zx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new C,color:new Ht};break;case"SpotLight":e={position:new C,direction:new C,color:new Ht,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new C,color:new Ht,distance:0,decay:0};break;case"HemisphereLight":e={direction:new C,skyColor:new Ht,groundColor:new Ht};break;case"RectAreaLight":e={color:new Ht,position:new C,halfWidth:new C,halfHeight:new C};break}return i[t.id]=e,e}}}function Vx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new et};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new et};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new et,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var kx=0;function Hx(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Gx(i){let t=new zx,e=Vx(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new C);let s=new C,r=new ce,a=new ce;function o(c){let h=0,d=0,u=0;for(let T=0;T<9;T++)n.probe[T].set(0,0,0);let f=0,g=0,_=0,p=0,m=0,M=0,S=0,y=0,w=0,E=0,R=0;c.sort(Hx);for(let T=0,P=c.length;T<P;T++){let I=c[T],U=I.color,W=I.intensity,X=I.distance,D=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===Ai?D=I.shadow.map.texture:D=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)h+=U.r*W,d+=U.g*W,u+=U.b*W;else if(I.isLightProbe){for(let z=0;z<9;z++)n.probe[z].addScaledVector(I.sh.coefficients[z],W);R++}else if(I.isDirectionalLight){let z=t.get(I);if(z.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){let B=I.shadow,$=e.get(I);$.shadowIntensity=B.intensity,$.shadowBias=B.bias,$.shadowNormalBias=B.normalBias,$.shadowRadius=B.radius,$.shadowMapSize=B.mapSize,n.directionalShadow[f]=$,n.directionalShadowMap[f]=D,n.directionalShadowMatrix[f]=I.shadow.matrix,M++}n.directional[f]=z,f++}else if(I.isSpotLight){let z=t.get(I);z.position.setFromMatrixPosition(I.matrixWorld),z.color.copy(U).multiplyScalar(W),z.distance=X,z.coneCos=Math.cos(I.angle),z.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),z.decay=I.decay,n.spot[_]=z;let B=I.shadow;if(I.map&&(n.spotLightMap[w]=I.map,w++,B.updateMatrices(I),I.castShadow&&E++),n.spotLightMatrix[_]=B.matrix,I.castShadow){let $=e.get(I);$.shadowIntensity=B.intensity,$.shadowBias=B.bias,$.shadowNormalBias=B.normalBias,$.shadowRadius=B.radius,$.shadowMapSize=B.mapSize,n.spotShadow[_]=$,n.spotShadowMap[_]=D,y++}_++}else if(I.isRectAreaLight){let z=t.get(I);z.color.copy(U).multiplyScalar(W),z.halfWidth.set(I.width*.5,0,0),z.halfHeight.set(0,I.height*.5,0),n.rectArea[p]=z,p++}else if(I.isPointLight){let z=t.get(I);if(z.color.copy(I.color).multiplyScalar(I.intensity),z.distance=I.distance,z.decay=I.decay,I.castShadow){let B=I.shadow,$=e.get(I);$.shadowIntensity=B.intensity,$.shadowBias=B.bias,$.shadowNormalBias=B.normalBias,$.shadowRadius=B.radius,$.shadowMapSize=B.mapSize,$.shadowCameraNear=B.camera.near,$.shadowCameraFar=B.camera.far,n.pointShadow[g]=$,n.pointShadowMap[g]=D,n.pointShadowMatrix[g]=I.shadow.matrix,S++}n.point[g]=z,g++}else if(I.isHemisphereLight){let z=t.get(I);z.skyColor.copy(I.color).multiplyScalar(W),z.groundColor.copy(I.groundColor).multiplyScalar(W),n.hemi[m]=z,m++}}p>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=xt.LTC_FLOAT_1,n.rectAreaLTC2=xt.LTC_FLOAT_2):(n.rectAreaLTC1=xt.LTC_HALF_1,n.rectAreaLTC2=xt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;let x=n.hash;(x.directionalLength!==f||x.pointLength!==g||x.spotLength!==_||x.rectAreaLength!==p||x.hemiLength!==m||x.numDirectionalShadows!==M||x.numPointShadows!==S||x.numSpotShadows!==y||x.numSpotMaps!==w||x.numLightProbes!==R)&&(n.directional.length=f,n.spot.length=_,n.rectArea.length=p,n.point.length=g,n.hemi.length=m,n.directionalShadow.length=M,n.directionalShadowMap.length=M,n.pointShadow.length=S,n.pointShadowMap.length=S,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=M,n.pointShadowMatrix.length=S,n.spotLightMatrix.length=y+w-E,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=E,n.numLightProbes=R,x.directionalLength=f,x.pointLength=g,x.spotLength=_,x.rectAreaLength=p,x.hemiLength=m,x.numDirectionalShadows=M,x.numPointShadows=S,x.numSpotShadows=y,x.numSpotMaps=w,x.numLightProbes=R,n.version=kx++)}function l(c,h){let d=0,u=0,f=0,g=0,_=0,p=h.matrixWorldInverse;for(let m=0,M=c.length;m<M;m++){let S=c[m];if(S.isDirectionalLight){let y=n.directional[d];y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(p),d++}else if(S.isSpotLight){let y=n.spot[f];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),y.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),y.direction.sub(s),y.direction.transformDirection(p),f++}else if(S.isRectAreaLight){let y=n.rectArea[g];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),a.identity(),r.copy(S.matrixWorld),r.premultiply(p),a.extractRotation(r),y.halfWidth.set(S.width*.5,0,0),y.halfHeight.set(0,S.height*.5,0),y.halfWidth.applyMatrix4(a),y.halfHeight.applyMatrix4(a),g++}else if(S.isPointLight){let y=n.point[u];y.position.setFromMatrixPosition(S.matrixWorld),y.position.applyMatrix4(p),u++}else if(S.isHemisphereLight){let y=n.hemi[_];y.direction.setFromMatrixPosition(S.matrixWorld),y.direction.transformDirection(p),_++}}}return{setup:o,setupView:l,state:n}}function ud(i){let t=new Gx(i),e=[],n=[],s=[];function r(u){d.camera=u,e.length=0,n.length=0,s.length=0}function a(u){e.push(u)}function o(u){n.push(u)}function l(u){s.push(u)}function c(){t.setup(e)}function h(u){t.setupView(e,u)}let d={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Wx(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new ud(i),t.set(s,[o])):r>=a.length?(o=new ud(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var Xx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,qx=`uniform sampler2D shadow_pass;
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
}`,Yx=[new C(1,0,0),new C(-1,0,0),new C(0,1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1)],Zx=[new C(0,-1,0),new C(0,-1,0),new C(0,0,1),new C(0,0,-1),new C(0,-1,0),new C(0,-1,0)],dd=new ce,Gr=new C,qc=new C;function $x(i,t,e){let n=new Es,s=new et,r=new et,a=new be,o=new Ka,l=new Qa,c={},h=e.maxTextureSize,d={[si]:Ue,[Ue]:si,[Je]:Je},u=new ke({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new et},radius:{value:4}},vertexShader:Xx,fragmentShader:qx}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let g=new me;g.setAttribute("position",new Se(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new Lt(g,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=qi;let m=this.type;this.render=function(E,R,x){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||E.length===0)return;this.type===iu&&(Ot("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=qi);let T=i.getRenderTarget(),P=i.getActiveCubeFace(),I=i.getActiveMipmapLevel(),U=i.state;U.setBlending(Xn),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);let W=m!==this.type;W&&R.traverse(function(X){X.material&&(Array.isArray(X.material)?X.material.forEach(D=>D.needsUpdate=!0):X.material.needsUpdate=!0)});for(let X=0,D=E.length;X<D;X++){let z=E[X],B=z.shadow;if(B===void 0){Ot("WebGLShadowMap:",z,"has no shadow.");continue}if(B.autoUpdate===!1&&B.needsUpdate===!1)continue;s.copy(B.mapSize);let $=B.getFrameExtents();s.multiply($),r.copy(B.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/$.x),s.x=r.x*$.x,B.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/$.y),s.y=r.y*$.y,B.mapSize.y=r.y));let Q=i.state.buffers.depth.getReversed();if(B.camera._reversedDepth=Q,B.map===null||W===!0){if(B.map!==null&&(B.map.depthTexture!==null&&(B.map.depthTexture.dispose(),B.map.depthTexture=null),B.map.dispose()),this.type===Ps){if(z.isPointLight){Ot("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}B.map=new dn(s.x,s.y,{format:Ai,type:qn,minFilter:Ie,magFilter:Ie,generateMipmaps:!1}),B.map.texture.name=z.name+".shadowMap",B.map.depthTexture=new ri(s.x,s.y,Sn),B.map.depthTexture.name=z.name+".shadowMapDepth",B.map.depthTexture.format=zn,B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=ze,B.map.depthTexture.magFilter=ze}else z.isPointLight?(B.map=new rl(s.x),B.map.depthTexture=new Ha(s.x,Ln)):(B.map=new dn(s.x,s.y),B.map.depthTexture=new ri(s.x,s.y,Ln)),B.map.depthTexture.name=z.name+".shadowMap",B.map.depthTexture.format=zn,this.type===qi?(B.map.depthTexture.compareFunction=Q?el:tl,B.map.depthTexture.minFilter=Ie,B.map.depthTexture.magFilter=Ie):(B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=ze,B.map.depthTexture.magFilter=ze);B.camera.updateProjectionMatrix()}let ot=B.map.isWebGLCubeRenderTarget?6:1;for(let lt=0;lt<ot;lt++){if(B.map.isWebGLCubeRenderTarget)i.setRenderTarget(B.map,lt),i.clear();else{lt===0&&(i.setRenderTarget(B.map),i.clear());let pt=B.getViewport(lt);a.set(r.x*pt.x,r.y*pt.y,r.x*pt.z,r.y*pt.w),U.viewport(a)}if(z.isPointLight){let pt=B.camera,Zt=B.matrix,ie=z.distance||pt.far;ie!==pt.far&&(pt.far=ie,pt.updateProjectionMatrix()),Gr.setFromMatrixPosition(z.matrixWorld),pt.position.copy(Gr),qc.copy(pt.position),qc.add(Yx[lt]),pt.up.copy(Zx[lt]),pt.lookAt(qc),pt.updateMatrixWorld(),Zt.makeTranslation(-Gr.x,-Gr.y,-Gr.z),dd.multiplyMatrices(pt.projectionMatrix,pt.matrixWorldInverse),B._frustum.setFromProjectionMatrix(dd,pt.coordinateSystem,pt.reversedDepth)}else B.updateMatrices(z);n=B.getFrustum(),y(R,x,B.camera,z,this.type)}B.isPointLightShadow!==!0&&this.type===Ps&&M(B,x),B.needsUpdate=!1}m=this.type,p.needsUpdate=!1,i.setRenderTarget(T,P,I)};function M(E,R){let x=t.update(_);u.defines.VSM_SAMPLES!==E.blurSamples&&(u.defines.VSM_SAMPLES=E.blurSamples,f.defines.VSM_SAMPLES=E.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new dn(s.x,s.y,{format:Ai,type:qn})),u.uniforms.shadow_pass.value=E.map.depthTexture,u.uniforms.resolution.value=E.mapSize,u.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(R,null,x,u,_,null),f.uniforms.shadow_pass.value=E.mapPass.texture,f.uniforms.resolution.value=E.mapSize,f.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(R,null,x,f,_,null)}function S(E,R,x,T){let P=null,I=x.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(I!==void 0)P=I;else if(P=x.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){let U=P.uuid,W=R.uuid,X=c[U];X===void 0&&(X={},c[U]=X);let D=X[W];D===void 0&&(D=P.clone(),X[W]=D,R.addEventListener("dispose",w)),P=D}if(P.visible=R.visible,P.wireframe=R.wireframe,T===Ps?P.side=R.shadowSide!==null?R.shadowSide:R.side:P.side=R.shadowSide!==null?R.shadowSide:d[R.side],P.alphaMap=R.alphaMap,P.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,P.map=R.map,P.clipShadows=R.clipShadows,P.clippingPlanes=R.clippingPlanes,P.clipIntersection=R.clipIntersection,P.displacementMap=R.displacementMap,P.displacementScale=R.displacementScale,P.displacementBias=R.displacementBias,P.wireframeLinewidth=R.wireframeLinewidth,P.linewidth=R.linewidth,x.isPointLight===!0&&P.isMeshDistanceMaterial===!0){let U=i.properties.get(P);U.light=x}return P}function y(E,R,x,T,P){if(E.visible===!1)return;if(E.layers.test(R.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&P===Ps)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,E.matrixWorld);let W=t.update(E),X=E.material;if(Array.isArray(X)){let D=W.groups;for(let z=0,B=D.length;z<B;z++){let $=D[z],Q=X[$.materialIndex];if(Q&&Q.visible){let ot=S(E,Q,T,P);E.onBeforeShadow(i,E,R,x,W,ot,$),i.renderBufferDirect(x,null,W,ot,E,$),E.onAfterShadow(i,E,R,x,W,ot,$)}}}else if(X.visible){let D=S(E,X,T,P);E.onBeforeShadow(i,E,R,x,W,D,null),i.renderBufferDirect(x,null,W,D,E,null),E.onAfterShadow(i,E,R,x,W,D,null)}}let U=E.children;for(let W=0,X=U.length;W<X;W++)y(U[W],R,x,T,P)}function w(E){E.target.removeEventListener("dispose",w);for(let x in c){let T=c[x],P=E.target.uuid;P in T&&(T[P].dispose(),delete T[P])}}}function Jx(i,t){function e(){let N=!1,ht=new be,J=null,ft=new be(0,0,0,0);return{setMask:function(Mt){J!==Mt&&!N&&(i.colorMask(Mt,Mt,Mt,Mt),J=Mt)},setLocked:function(Mt){N=Mt},setClear:function(Mt,tt,At,Tt,Te){Te===!0&&(Mt*=Tt,tt*=Tt,At*=Tt),ht.set(Mt,tt,At,Tt),ft.equals(ht)===!1&&(i.clearColor(Mt,tt,At,Tt),ft.copy(ht))},reset:function(){N=!1,J=null,ft.set(-1,0,0,0)}}}function n(){let N=!1,ht=!1,J=null,ft=null,Mt=null;return{setReversed:function(tt){if(ht!==tt){let At=t.get("EXT_clip_control");tt?At.clipControlEXT(At.LOWER_LEFT_EXT,At.ZERO_TO_ONE_EXT):At.clipControlEXT(At.LOWER_LEFT_EXT,At.NEGATIVE_ONE_TO_ONE_EXT),ht=tt;let Tt=Mt;Mt=null,this.setClear(Tt)}},getReversed:function(){return ht},setTest:function(tt){tt?nt(i.DEPTH_TEST):Et(i.DEPTH_TEST)},setMask:function(tt){J!==tt&&!N&&(i.depthMask(tt),J=tt)},setFunc:function(tt){if(ht&&(tt=Fu[tt]),ft!==tt){switch(tt){case wa:i.depthFunc(i.NEVER);break;case Aa:i.depthFunc(i.ALWAYS);break;case Ra:i.depthFunc(i.LESS);break;case Vi:i.depthFunc(i.LEQUAL);break;case Ca:i.depthFunc(i.EQUAL);break;case Pa:i.depthFunc(i.GEQUAL);break;case Ia:i.depthFunc(i.GREATER);break;case La:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ft=tt}},setLocked:function(tt){N=tt},setClear:function(tt){Mt!==tt&&(Mt=tt,ht&&(tt=1-tt),i.clearDepth(tt))},reset:function(){N=!1,J=null,ft=null,Mt=null,ht=!1}}}function s(){let N=!1,ht=null,J=null,ft=null,Mt=null,tt=null,At=null,Tt=null,Te=null;return{setTest:function(_e){N||(_e?nt(i.STENCIL_TEST):Et(i.STENCIL_TEST))},setMask:function(_e){ht!==_e&&!N&&(i.stencilMask(_e),ht=_e)},setFunc:function(_e,Nn,Un){(J!==_e||ft!==Nn||Mt!==Un)&&(i.stencilFunc(_e,Nn,Un),J=_e,ft=Nn,Mt=Un)},setOp:function(_e,Nn,Un){(tt!==_e||At!==Nn||Tt!==Un)&&(i.stencilOp(_e,Nn,Un),tt=_e,At=Nn,Tt=Un)},setLocked:function(_e){N=_e},setClear:function(_e){Te!==_e&&(i.clearStencil(_e),Te=_e)},reset:function(){N=!1,ht=null,J=null,ft=null,Mt=null,tt=null,At=null,Tt=null,Te=null}}}let r=new e,a=new n,o=new s,l=new WeakMap,c=new WeakMap,h={},d={},u={},f=new WeakMap,g=[],_=null,p=!1,m=null,M=null,S=null,y=null,w=null,E=null,R=null,x=new Ht(0,0,0),T=0,P=!1,I=null,U=null,W=null,X=null,D=null,z=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),B=!1,$=0,Q=i.getParameter(i.VERSION);Q.indexOf("WebGL")!==-1?($=parseFloat(/^WebGL (\d)/.exec(Q)[1]),B=$>=1):Q.indexOf("OpenGL ES")!==-1&&($=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),B=$>=2);let ot=null,lt={},pt=i.getParameter(i.SCISSOR_BOX),Zt=i.getParameter(i.VIEWPORT),ie=new be().fromArray(pt),Qt=new be().fromArray(Zt);function Z(N,ht,J,ft){let Mt=new Uint8Array(4),tt=i.createTexture();i.bindTexture(N,tt),i.texParameteri(N,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(N,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let At=0;At<J;At++)N===i.TEXTURE_3D||N===i.TEXTURE_2D_ARRAY?i.texImage3D(ht,0,i.RGBA,1,1,ft,0,i.RGBA,i.UNSIGNED_BYTE,Mt):i.texImage2D(ht+At,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Mt);return tt}let st={};st[i.TEXTURE_2D]=Z(i.TEXTURE_2D,i.TEXTURE_2D,1),st[i.TEXTURE_CUBE_MAP]=Z(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),st[i.TEXTURE_2D_ARRAY]=Z(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),st[i.TEXTURE_3D]=Z(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),nt(i.DEPTH_TEST),a.setFunc(Vi),_t(!1),mt(dc),nt(i.CULL_FACE),rt(Xn);function nt(N){h[N]!==!0&&(i.enable(N),h[N]=!0)}function Et(N){h[N]!==!1&&(i.disable(N),h[N]=!1)}function Vt(N,ht){return u[N]!==ht?(i.bindFramebuffer(N,ht),u[N]=ht,N===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ht),N===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ht),!0):!1}function Nt(N,ht){let J=g,ft=!1;if(N){J=f.get(ht),J===void 0&&(J=[],f.set(ht,J));let Mt=N.textures;if(J.length!==Mt.length||J[0]!==i.COLOR_ATTACHMENT0){for(let tt=0,At=Mt.length;tt<At;tt++)J[tt]=i.COLOR_ATTACHMENT0+tt;J.length=Mt.length,ft=!0}}else J[0]!==i.BACK&&(J[0]=i.BACK,ft=!0);ft&&i.drawBuffers(J)}function he(N){return _!==N?(i.useProgram(N),_=N,!0):!1}let Gt={[_i]:i.FUNC_ADD,[ru]:i.FUNC_SUBTRACT,[au]:i.FUNC_REVERSE_SUBTRACT};Gt[ou]=i.MIN,Gt[lu]=i.MAX;let j={[cu]:i.ZERO,[hu]:i.ONE,[uu]:i.SRC_COLOR,[Ea]:i.SRC_ALPHA,[xu]:i.SRC_ALPHA_SATURATE,[mu]:i.DST_COLOR,[fu]:i.DST_ALPHA,[du]:i.ONE_MINUS_SRC_COLOR,[Ta]:i.ONE_MINUS_SRC_ALPHA,[gu]:i.ONE_MINUS_DST_COLOR,[pu]:i.ONE_MINUS_DST_ALPHA,[_u]:i.CONSTANT_COLOR,[vu]:i.ONE_MINUS_CONSTANT_COLOR,[yu]:i.CONSTANT_ALPHA,[Mu]:i.ONE_MINUS_CONSTANT_ALPHA};function rt(N,ht,J,ft,Mt,tt,At,Tt,Te,_e){if(N===Xn){p===!0&&(Et(i.BLEND),p=!1);return}if(p===!1&&(nt(i.BLEND),p=!0),N!==su){if(N!==m||_e!==P){if((M!==_i||w!==_i)&&(i.blendEquation(i.FUNC_ADD),M=_i,w=_i),_e)switch(N){case Cn:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ai:i.blendFunc(i.ONE,i.ONE);break;case fc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case pc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ut("WebGLState: Invalid blending: ",N);break}else switch(N){case Cn:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case ai:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case fc:Ut("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case pc:Ut("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ut("WebGLState: Invalid blending: ",N);break}S=null,y=null,E=null,R=null,x.set(0,0,0),T=0,m=N,P=_e}return}Mt=Mt||ht,tt=tt||J,At=At||ft,(ht!==M||Mt!==w)&&(i.blendEquationSeparate(Gt[ht],Gt[Mt]),M=ht,w=Mt),(J!==S||ft!==y||tt!==E||At!==R)&&(i.blendFuncSeparate(j[J],j[ft],j[tt],j[At]),S=J,y=ft,E=tt,R=At),(Tt.equals(x)===!1||Te!==T)&&(i.blendColor(Tt.r,Tt.g,Tt.b,Te),x.copy(Tt),T=Te),m=N,P=!1}function it(N,ht){N.side===Je?Et(i.CULL_FACE):nt(i.CULL_FACE);let J=N.side===Ue;ht&&(J=!J),_t(J),N.blending===Cn&&N.transparent===!1?rt(Xn):rt(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),a.setFunc(N.depthFunc),a.setTest(N.depthTest),a.setMask(N.depthWrite),r.setMask(N.colorWrite);let ft=N.stencilWrite;o.setTest(ft),ft&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),Rt(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?nt(i.SAMPLE_ALPHA_TO_COVERAGE):Et(i.SAMPLE_ALPHA_TO_COVERAGE)}function _t(N){I!==N&&(N?i.frontFace(i.CW):i.frontFace(i.CCW),I=N)}function mt(N){N!==eu?(nt(i.CULL_FACE),N!==U&&(N===dc?i.cullFace(i.BACK):N===nu?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Et(i.CULL_FACE),U=N}function Ft(N){N!==W&&(B&&i.lineWidth(N),W=N)}function Rt(N,ht,J){N?(nt(i.POLYGON_OFFSET_FILL),(X!==ht||D!==J)&&(X=ht,D=J,a.getReversed()&&(ht=-ht),i.polygonOffset(ht,J))):Et(i.POLYGON_OFFSET_FILL)}function kt(N){N?nt(i.SCISSOR_TEST):Et(i.SCISSOR_TEST)}function qt(N){N===void 0&&(N=i.TEXTURE0+z-1),ot!==N&&(i.activeTexture(N),ot=N)}function L(N,ht,J){J===void 0&&(ot===null?J=i.TEXTURE0+z-1:J=ot);let ft=lt[J];ft===void 0&&(ft={type:void 0,texture:void 0},lt[J]=ft),(ft.type!==N||ft.texture!==ht)&&(ot!==J&&(i.activeTexture(J),ot=J),i.bindTexture(N,ht||st[N]),ft.type=N,ft.texture=ht)}function de(){let N=lt[ot];N!==void 0&&N.type!==void 0&&(i.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function se(){try{i.compressedTexImage2D(...arguments)}catch(N){Ut("WebGLState:",N)}}function A(){try{i.compressedTexImage3D(...arguments)}catch(N){Ut("WebGLState:",N)}}function v(){try{i.texSubImage2D(...arguments)}catch(N){Ut("WebGLState:",N)}}function O(){try{i.texSubImage3D(...arguments)}catch(N){Ut("WebGLState:",N)}}function H(){try{i.compressedTexSubImage2D(...arguments)}catch(N){Ut("WebGLState:",N)}}function q(){try{i.compressedTexSubImage3D(...arguments)}catch(N){Ut("WebGLState:",N)}}function at(){try{i.texStorage2D(...arguments)}catch(N){Ut("WebGLState:",N)}}function ct(){try{i.texStorage3D(...arguments)}catch(N){Ut("WebGLState:",N)}}function Y(){try{i.texImage2D(...arguments)}catch(N){Ut("WebGLState:",N)}}function K(){try{i.texImage3D(...arguments)}catch(N){Ut("WebGLState:",N)}}function ut(N){return d[N]!==void 0?d[N]:i.getParameter(N)}function Ct(N,ht){d[N]!==ht&&(i.pixelStorei(N,ht),d[N]=ht)}function gt(N){ie.equals(N)===!1&&(i.scissor(N.x,N.y,N.z,N.w),ie.copy(N))}function dt(N){Qt.equals(N)===!1&&(i.viewport(N.x,N.y,N.z,N.w),Qt.copy(N))}function Dt(N,ht){let J=c.get(ht);J===void 0&&(J=new WeakMap,c.set(ht,J));let ft=J.get(N);ft===void 0&&(ft=i.getUniformBlockIndex(ht,N.name),J.set(N,ft))}function Bt(N,ht){let ft=c.get(ht).get(N);l.get(ht)!==ft&&(i.uniformBlockBinding(ht,ft,N.__bindingPointIndex),l.set(ht,ft))}function $t(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},d={},ot=null,lt={},u={},f=new WeakMap,g=[],_=null,p=!1,m=null,M=null,S=null,y=null,w=null,E=null,R=null,x=new Ht(0,0,0),T=0,P=!1,I=null,U=null,W=null,X=null,D=null,ie.set(0,0,i.canvas.width,i.canvas.height),Qt.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:nt,disable:Et,bindFramebuffer:Vt,drawBuffers:Nt,useProgram:he,setBlending:rt,setMaterial:it,setFlipSided:_t,setCullFace:mt,setLineWidth:Ft,setPolygonOffset:Rt,setScissorTest:kt,activeTexture:qt,bindTexture:L,unbindTexture:de,compressedTexImage2D:se,compressedTexImage3D:A,texImage2D:Y,texImage3D:K,pixelStorei:Ct,getParameter:ut,updateUBOMapping:Dt,uniformBlockBinding:Bt,texStorage2D:at,texStorage3D:ct,texSubImage2D:v,texSubImage3D:O,compressedTexSubImage2D:H,compressedTexSubImage3D:q,scissor:gt,viewport:dt,reset:$t}}function Kx(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new et,h=new WeakMap,d=new Set,u,f=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(A,v){return g?new OffscreenCanvas(A,v):sr("canvas")}function p(A,v,O){let H=1,q=se(A);if((q.width>O||q.height>O)&&(H=O/Math.max(q.width,q.height)),H<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){let at=Math.floor(H*q.width),ct=Math.floor(H*q.height);u===void 0&&(u=_(at,ct));let Y=v?_(at,ct):u;return Y.width=at,Y.height=ct,Y.getContext("2d").drawImage(A,0,0,at,ct),Ot("WebGLRenderer: Texture has been resized from ("+q.width+"x"+q.height+") to ("+at+"x"+ct+")."),Y}else return"data"in A&&Ot("WebGLRenderer: Image in DataTexture is too big ("+q.width+"x"+q.height+")."),A;return A}function m(A){return A.generateMipmaps}function M(A){i.generateMipmap(A)}function S(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(A,v,O,H,q,at=!1){if(A!==null){if(i[A]!==void 0)return i[A];Ot("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let ct;H&&(ct=t.get("EXT_texture_norm16"),ct||Ot("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Y=v;if(v===i.RED&&(O===i.FLOAT&&(Y=i.R32F),O===i.HALF_FLOAT&&(Y=i.R16F),O===i.UNSIGNED_BYTE&&(Y=i.R8),O===i.UNSIGNED_SHORT&&ct&&(Y=ct.R16_EXT),O===i.SHORT&&ct&&(Y=ct.R16_SNORM_EXT)),v===i.RED_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.R8UI),O===i.UNSIGNED_SHORT&&(Y=i.R16UI),O===i.UNSIGNED_INT&&(Y=i.R32UI),O===i.BYTE&&(Y=i.R8I),O===i.SHORT&&(Y=i.R16I),O===i.INT&&(Y=i.R32I)),v===i.RG&&(O===i.FLOAT&&(Y=i.RG32F),O===i.HALF_FLOAT&&(Y=i.RG16F),O===i.UNSIGNED_BYTE&&(Y=i.RG8),O===i.UNSIGNED_SHORT&&ct&&(Y=ct.RG16_EXT),O===i.SHORT&&ct&&(Y=ct.RG16_SNORM_EXT)),v===i.RG_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RG8UI),O===i.UNSIGNED_SHORT&&(Y=i.RG16UI),O===i.UNSIGNED_INT&&(Y=i.RG32UI),O===i.BYTE&&(Y=i.RG8I),O===i.SHORT&&(Y=i.RG16I),O===i.INT&&(Y=i.RG32I)),v===i.RGB_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RGB8UI),O===i.UNSIGNED_SHORT&&(Y=i.RGB16UI),O===i.UNSIGNED_INT&&(Y=i.RGB32UI),O===i.BYTE&&(Y=i.RGB8I),O===i.SHORT&&(Y=i.RGB16I),O===i.INT&&(Y=i.RGB32I)),v===i.RGBA_INTEGER&&(O===i.UNSIGNED_BYTE&&(Y=i.RGBA8UI),O===i.UNSIGNED_SHORT&&(Y=i.RGBA16UI),O===i.UNSIGNED_INT&&(Y=i.RGBA32UI),O===i.BYTE&&(Y=i.RGBA8I),O===i.SHORT&&(Y=i.RGBA16I),O===i.INT&&(Y=i.RGBA32I)),v===i.RGB&&(O===i.UNSIGNED_SHORT&&ct&&(Y=ct.RGB16_EXT),O===i.SHORT&&ct&&(Y=ct.RGB16_SNORM_EXT),O===i.UNSIGNED_INT_5_9_9_9_REV&&(Y=i.RGB9_E5),O===i.UNSIGNED_INT_10F_11F_11F_REV&&(Y=i.R11F_G11F_B10F)),v===i.RGBA){let K=at?ir:ae.getTransfer(q);O===i.FLOAT&&(Y=i.RGBA32F),O===i.HALF_FLOAT&&(Y=i.RGBA16F),O===i.UNSIGNED_BYTE&&(Y=K===ue?i.SRGB8_ALPHA8:i.RGBA8),O===i.UNSIGNED_SHORT&&ct&&(Y=ct.RGBA16_EXT),O===i.SHORT&&ct&&(Y=ct.RGBA16_SNORM_EXT),O===i.UNSIGNED_SHORT_4_4_4_4&&(Y=i.RGBA4),O===i.UNSIGNED_SHORT_5_5_5_1&&(Y=i.RGB5_A1)}return(Y===i.R16F||Y===i.R32F||Y===i.RG16F||Y===i.RG32F||Y===i.RGBA16F||Y===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function w(A,v){let O;return A?v===null||v===Ln||v===Ls?O=i.DEPTH24_STENCIL8:v===Sn?O=i.DEPTH32F_STENCIL8:v===Is&&(O=i.DEPTH24_STENCIL8,Ot("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Ln||v===Ls?O=i.DEPTH_COMPONENT24:v===Sn?O=i.DEPTH_COMPONENT32F:v===Is&&(O=i.DEPTH_COMPONENT16),O}function E(A,v){return m(A)===!0||A.isFramebufferTexture&&A.minFilter!==ze&&A.minFilter!==Ie?Math.log2(Math.max(v.width,v.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?v.mipmaps.length:1}function R(A){let v=A.target;v.removeEventListener("dispose",R),T(v),v.isVideoTexture&&h.delete(v),v.isHTMLTexture&&d.delete(v)}function x(A){let v=A.target;v.removeEventListener("dispose",x),I(v)}function T(A){let v=n.get(A);if(v.__webglInit===void 0)return;let O=A.source,H=f.get(O);if(H){let q=H[v.__cacheKey];q.usedTimes--,q.usedTimes===0&&P(A),Object.keys(H).length===0&&f.delete(O)}n.remove(A)}function P(A){let v=n.get(A);i.deleteTexture(v.__webglTexture);let O=A.source,H=f.get(O);delete H[v.__cacheKey],a.memory.textures--}function I(A){let v=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let H=0;H<6;H++){if(Array.isArray(v.__webglFramebuffer[H]))for(let q=0;q<v.__webglFramebuffer[H].length;q++)i.deleteFramebuffer(v.__webglFramebuffer[H][q]);else i.deleteFramebuffer(v.__webglFramebuffer[H]);v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer[H])}else{if(Array.isArray(v.__webglFramebuffer))for(let H=0;H<v.__webglFramebuffer.length;H++)i.deleteFramebuffer(v.__webglFramebuffer[H]);else i.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&i.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let H=0;H<v.__webglColorRenderbuffer.length;H++)v.__webglColorRenderbuffer[H]&&i.deleteRenderbuffer(v.__webglColorRenderbuffer[H]);v.__webglDepthRenderbuffer&&i.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let O=A.textures;for(let H=0,q=O.length;H<q;H++){let at=n.get(O[H]);at.__webglTexture&&(i.deleteTexture(at.__webglTexture),a.memory.textures--),n.remove(O[H])}n.remove(A)}let U=0;function W(){U=0}function X(){return U}function D(A){U=A}function z(){let A=U;return A>=s.maxTextures&&Ot("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),U+=1,A}function B(A){let v=[];return v.push(A.wrapS),v.push(A.wrapT),v.push(A.wrapR||0),v.push(A.magFilter),v.push(A.minFilter),v.push(A.anisotropy),v.push(A.internalFormat),v.push(A.format),v.push(A.type),v.push(A.generateMipmaps),v.push(A.premultiplyAlpha),v.push(A.flipY),v.push(A.unpackAlignment),v.push(A.colorSpace),v.join()}function $(A,v){let O=n.get(A);if(A.isVideoTexture&&L(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&O.__version!==A.version){let H=A.image;if(H===null)Ot("WebGLRenderer: Texture marked for update but no image data found.");else if(H.complete===!1)Ot("WebGLRenderer: Texture marked for update but image is incomplete");else{Et(O,A,v);return}}else A.isExternalTexture&&(O.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,O.__webglTexture,i.TEXTURE0+v)}function Q(A,v){let O=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&O.__version!==A.version){Et(O,A,v);return}else A.isExternalTexture&&(O.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,O.__webglTexture,i.TEXTURE0+v)}function ot(A,v){let O=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&O.__version!==A.version){Et(O,A,v);return}e.bindTexture(i.TEXTURE_3D,O.__webglTexture,i.TEXTURE0+v)}function lt(A,v){let O=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&O.__version!==A.version){Vt(O,A,v);return}e.bindTexture(i.TEXTURE_CUBE_MAP,O.__webglTexture,i.TEXTURE0+v)}let pt={[vi]:i.REPEAT,[yn]:i.CLAMP_TO_EDGE,[Da]:i.MIRRORED_REPEAT},Zt={[ze]:i.NEAREST,[Eu]:i.NEAREST_MIPMAP_NEAREST,[Ur]:i.NEAREST_MIPMAP_LINEAR,[Ie]:i.LINEAR,[mo]:i.LINEAR_MIPMAP_NEAREST,[Ti]:i.LINEAR_MIPMAP_LINEAR},ie={[Au]:i.NEVER,[Lu]:i.ALWAYS,[Ru]:i.LESS,[tl]:i.LEQUAL,[Cu]:i.EQUAL,[el]:i.GEQUAL,[Pu]:i.GREATER,[Iu]:i.NOTEQUAL};function Qt(A,v){if(v.type===Sn&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===Ie||v.magFilter===mo||v.magFilter===Ur||v.magFilter===Ti||v.minFilter===Ie||v.minFilter===mo||v.minFilter===Ur||v.minFilter===Ti)&&Ot("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,pt[v.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,pt[v.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,pt[v.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,Zt[v.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,Zt[v.minFilter]),v.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,ie[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===ze||v.minFilter!==Ur&&v.minFilter!==Ti||v.type===Sn&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){let O=t.get("EXT_texture_filter_anisotropic");i.texParameterf(A,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,s.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Z(A,v){let O=!1;A.__webglInit===void 0&&(A.__webglInit=!0,v.addEventListener("dispose",R));let H=v.source,q=f.get(H);q===void 0&&(q={},f.set(H,q));let at=B(v);if(at!==A.__cacheKey){q[at]===void 0&&(q[at]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,O=!0),q[at].usedTimes++;let ct=q[A.__cacheKey];ct!==void 0&&(q[A.__cacheKey].usedTimes--,ct.usedTimes===0&&P(v)),A.__cacheKey=at,A.__webglTexture=q[at].texture}return O}function st(A,v,O){return Math.floor(Math.floor(A/O)/v)}function nt(A,v,O,H){let at=A.updateRanges;if(at.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,v.width,v.height,O,H,v.data);else{at.sort((Ct,gt)=>Ct.start-gt.start);let ct=0;for(let Ct=1;Ct<at.length;Ct++){let gt=at[ct],dt=at[Ct],Dt=gt.start+gt.count,Bt=st(dt.start,v.width,4),$t=st(gt.start,v.width,4);dt.start<=Dt+1&&Bt===$t&&st(dt.start+dt.count-1,v.width,4)===Bt?gt.count=Math.max(gt.count,dt.start+dt.count-gt.start):(++ct,at[ct]=dt)}at.length=ct+1;let Y=e.getParameter(i.UNPACK_ROW_LENGTH),K=e.getParameter(i.UNPACK_SKIP_PIXELS),ut=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,v.width);for(let Ct=0,gt=at.length;Ct<gt;Ct++){let dt=at[Ct],Dt=Math.floor(dt.start/4),Bt=Math.ceil(dt.count/4),$t=Dt%v.width,N=Math.floor(Dt/v.width),ht=Bt,J=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,$t),e.pixelStorei(i.UNPACK_SKIP_ROWS,N),e.texSubImage2D(i.TEXTURE_2D,0,$t,N,ht,J,O,H,v.data)}A.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,Y),e.pixelStorei(i.UNPACK_SKIP_PIXELS,K),e.pixelStorei(i.UNPACK_SKIP_ROWS,ut)}}function Et(A,v,O){let H=i.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(H=i.TEXTURE_2D_ARRAY),v.isData3DTexture&&(H=i.TEXTURE_3D);let q=Z(A,v),at=v.source;e.bindTexture(H,A.__webglTexture,i.TEXTURE0+O);let ct=n.get(at);if(at.version!==ct.__version||q===!0){if(e.activeTexture(i.TEXTURE0+O),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){let J=ae.getPrimaries(ae.workingColorSpace),ft=v.colorSpace===oi?null:ae.getPrimaries(v.colorSpace),Mt=v.colorSpace===oi||J===ft?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Mt)}e.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment);let K=p(v.image,!1,s.maxTextureSize);K=de(v,K);let ut=r.convert(v.format,v.colorSpace),Ct=r.convert(v.type),gt=y(v.internalFormat,ut,Ct,v.normalized,v.colorSpace,v.isVideoTexture);Qt(H,v);let dt,Dt=v.mipmaps,Bt=v.isVideoTexture!==!0,$t=ct.__version===void 0||q===!0,N=at.dataReady,ht=E(v,K);if(v.isDepthTexture)gt=w(v.format===wi,v.type),$t&&(Bt?e.texStorage2D(i.TEXTURE_2D,1,gt,K.width,K.height):e.texImage2D(i.TEXTURE_2D,0,gt,K.width,K.height,0,ut,Ct,null));else if(v.isDataTexture)if(Dt.length>0){Bt&&$t&&e.texStorage2D(i.TEXTURE_2D,ht,gt,Dt[0].width,Dt[0].height);for(let J=0,ft=Dt.length;J<ft;J++)dt=Dt[J],Bt?N&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,dt.width,dt.height,ut,Ct,dt.data):e.texImage2D(i.TEXTURE_2D,J,gt,dt.width,dt.height,0,ut,Ct,dt.data);v.generateMipmaps=!1}else Bt?($t&&e.texStorage2D(i.TEXTURE_2D,ht,gt,K.width,K.height),N&&nt(v,K,ut,Ct)):e.texImage2D(i.TEXTURE_2D,0,gt,K.width,K.height,0,ut,Ct,K.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Bt&&$t&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ht,gt,Dt[0].width,Dt[0].height,K.depth);for(let J=0,ft=Dt.length;J<ft;J++)if(dt=Dt[J],v.format!==an)if(ut!==null)if(Bt){if(N)if(v.layerUpdates.size>0){let Mt=Uc(dt.width,dt.height,v.format,v.type);for(let tt of v.layerUpdates){let At=dt.data.subarray(tt*Mt/dt.data.BYTES_PER_ELEMENT,(tt+1)*Mt/dt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,tt,dt.width,dt.height,1,ut,At)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,dt.width,dt.height,K.depth,ut,dt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,J,gt,dt.width,dt.height,K.depth,0,dt.data,0,0);else Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Bt?N&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,dt.width,dt.height,K.depth,ut,Ct,dt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,J,gt,dt.width,dt.height,K.depth,0,ut,Ct,dt.data)}else{Bt&&$t&&e.texStorage2D(i.TEXTURE_2D,ht,gt,Dt[0].width,Dt[0].height);for(let J=0,ft=Dt.length;J<ft;J++)dt=Dt[J],v.format!==an?ut!==null?Bt?N&&e.compressedTexSubImage2D(i.TEXTURE_2D,J,0,0,dt.width,dt.height,ut,dt.data):e.compressedTexImage2D(i.TEXTURE_2D,J,gt,dt.width,dt.height,0,dt.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Bt?N&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,dt.width,dt.height,ut,Ct,dt.data):e.texImage2D(i.TEXTURE_2D,J,gt,dt.width,dt.height,0,ut,Ct,dt.data)}else if(v.isDataArrayTexture)if(Bt){if($t&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ht,gt,K.width,K.height,K.depth),N)if(v.layerUpdates.size>0){let J=Uc(K.width,K.height,v.format,v.type);for(let ft of v.layerUpdates){let Mt=K.data.subarray(ft*J/K.data.BYTES_PER_ELEMENT,(ft+1)*J/K.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,ft,K.width,K.height,1,ut,Ct,Mt)}v.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ut,Ct,K.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,gt,K.width,K.height,K.depth,0,ut,Ct,K.data);else if(v.isData3DTexture)Bt?($t&&e.texStorage3D(i.TEXTURE_3D,ht,gt,K.width,K.height,K.depth),N&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ut,Ct,K.data)):e.texImage3D(i.TEXTURE_3D,0,gt,K.width,K.height,K.depth,0,ut,Ct,K.data);else if(v.isFramebufferTexture){if($t)if(Bt)e.texStorage2D(i.TEXTURE_2D,ht,gt,K.width,K.height);else{let J=K.width,ft=K.height;for(let Mt=0;Mt<ht;Mt++)e.texImage2D(i.TEXTURE_2D,Mt,gt,J,ft,0,ut,Ct,null),J>>=1,ft>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in i){let J=i.canvas;if(J.hasAttribute("layoutsubtree")||J.setAttribute("layoutsubtree","true"),K.parentNode!==J){J.appendChild(K),d.add(v),J.onpaint=ft=>{let Mt=ft.changedElements;for(let tt of d)Mt.includes(tt.image)&&(tt.needsUpdate=!0)},J.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,K);else{let Mt=i.RGBA,tt=i.RGBA,At=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,Mt,tt,At,K)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Dt.length>0){if(Bt&&$t){let J=se(Dt[0]);e.texStorage2D(i.TEXTURE_2D,ht,gt,J.width,J.height)}for(let J=0,ft=Dt.length;J<ft;J++)dt=Dt[J],Bt?N&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,ut,Ct,dt):e.texImage2D(i.TEXTURE_2D,J,gt,ut,Ct,dt);v.generateMipmaps=!1}else if(Bt){if($t){let J=se(K);e.texStorage2D(i.TEXTURE_2D,ht,gt,J.width,J.height)}N&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,ut,Ct,K)}else e.texImage2D(i.TEXTURE_2D,0,gt,ut,Ct,K);m(v)&&M(H),ct.__version=at.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function Vt(A,v,O){if(v.image.length!==6)return;let H=Z(A,v),q=v.source;e.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+O);let at=n.get(q);if(q.version!==at.__version||H===!0){e.activeTexture(i.TEXTURE0+O);let ct=ae.getPrimaries(ae.workingColorSpace),Y=v.colorSpace===oi?null:ae.getPrimaries(v.colorSpace),K=v.colorSpace===oi||ct===Y?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ut=v.isCompressedTexture||v.image[0].isCompressedTexture,Ct=v.image[0]&&v.image[0].isDataTexture,gt=[];for(let tt=0;tt<6;tt++)!ut&&!Ct?gt[tt]=p(v.image[tt],!0,s.maxCubemapSize):gt[tt]=Ct?v.image[tt].image:v.image[tt],gt[tt]=de(v,gt[tt]);let dt=gt[0],Dt=r.convert(v.format,v.colorSpace),Bt=r.convert(v.type),$t=y(v.internalFormat,Dt,Bt,v.normalized,v.colorSpace),N=v.isVideoTexture!==!0,ht=at.__version===void 0||H===!0,J=q.dataReady,ft=E(v,dt);Qt(i.TEXTURE_CUBE_MAP,v);let Mt;if(ut){N&&ht&&e.texStorage2D(i.TEXTURE_CUBE_MAP,ft,$t,dt.width,dt.height);for(let tt=0;tt<6;tt++){Mt=gt[tt].mipmaps;for(let At=0;At<Mt.length;At++){let Tt=Mt[At];v.format!==an?Dt!==null?N?J&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At,0,0,Tt.width,Tt.height,Dt,Tt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At,$t,Tt.width,Tt.height,0,Tt.data):Ot("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?J&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At,0,0,Tt.width,Tt.height,Dt,Bt,Tt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At,$t,Tt.width,Tt.height,0,Dt,Bt,Tt.data)}}}else{if(Mt=v.mipmaps,N&&ht){Mt.length>0&&ft++;let tt=se(gt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,ft,$t,tt.width,tt.height)}for(let tt=0;tt<6;tt++)if(Ct){N?J&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,0,0,gt[tt].width,gt[tt].height,Dt,Bt,gt[tt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,$t,gt[tt].width,gt[tt].height,0,Dt,Bt,gt[tt].data);for(let At=0;At<Mt.length;At++){let Te=Mt[At].image[tt].image;N?J&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At+1,0,0,Te.width,Te.height,Dt,Bt,Te.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At+1,$t,Te.width,Te.height,0,Dt,Bt,Te.data)}}else{N?J&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,0,0,Dt,Bt,gt[tt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0,$t,Dt,Bt,gt[tt]);for(let At=0;At<Mt.length;At++){let Tt=Mt[At];N?J&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At+1,0,0,Dt,Bt,Tt.image[tt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,At+1,$t,Dt,Bt,Tt.image[tt])}}}m(v)&&M(i.TEXTURE_CUBE_MAP),at.__version=q.version,v.onUpdate&&v.onUpdate(v)}A.__version=v.version}function Nt(A,v,O,H,q,at){let ct=r.convert(O.format,O.colorSpace),Y=r.convert(O.type),K=y(O.internalFormat,ct,Y,O.normalized,O.colorSpace),ut=n.get(v),Ct=n.get(O);if(Ct.__renderTarget=v,!ut.__hasExternalTextures){let gt=Math.max(1,v.width>>at),dt=Math.max(1,v.height>>at);q===i.TEXTURE_3D||q===i.TEXTURE_2D_ARRAY?e.texImage3D(q,at,K,gt,dt,v.depth,0,ct,Y,null):e.texImage2D(q,at,K,gt,dt,0,ct,Y,null)}e.bindFramebuffer(i.FRAMEBUFFER,A),qt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,H,q,Ct.__webglTexture,0,kt(v)):(q===i.TEXTURE_2D||q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,H,q,Ct.__webglTexture,at),e.bindFramebuffer(i.FRAMEBUFFER,null)}function he(A,v,O){if(i.bindRenderbuffer(i.RENDERBUFFER,A),v.depthBuffer){let H=v.depthTexture,q=H&&H.isDepthTexture?H.type:null,at=w(v.stencilBuffer,q),ct=v.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;qt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,kt(v),at,v.width,v.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,kt(v),at,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,at,v.width,v.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ct,i.RENDERBUFFER,A)}else{let H=v.textures;for(let q=0;q<H.length;q++){let at=H[q],ct=r.convert(at.format,at.colorSpace),Y=r.convert(at.type),K=y(at.internalFormat,ct,Y,at.normalized,at.colorSpace);qt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,kt(v),K,v.width,v.height):O?i.renderbufferStorageMultisample(i.RENDERBUFFER,kt(v),K,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,K,v.width,v.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Gt(A,v,O){let H=v.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,A),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let q=n.get(v.depthTexture);if(q.__renderTarget=v,(!q.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),H){if(q.__webglInit===void 0&&(q.__webglInit=!0,v.depthTexture.addEventListener("dispose",R)),q.__webglTexture===void 0){q.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),Qt(i.TEXTURE_CUBE_MAP,v.depthTexture);let ut=r.convert(v.depthTexture.format),Ct=r.convert(v.depthTexture.type),gt;v.depthTexture.format===zn?gt=i.DEPTH_COMPONENT24:v.depthTexture.format===wi&&(gt=i.DEPTH24_STENCIL8);for(let dt=0;dt<6;dt++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+dt,0,gt,v.width,v.height,0,ut,Ct,null)}}else $(v.depthTexture,0);let at=q.__webglTexture,ct=kt(v),Y=H?i.TEXTURE_CUBE_MAP_POSITIVE_X+O:i.TEXTURE_2D,K=v.depthTexture.format===wi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(v.depthTexture.format===zn)qt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,Y,at,0,ct):i.framebufferTexture2D(i.FRAMEBUFFER,K,Y,at,0);else if(v.depthTexture.format===wi)qt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,Y,at,0,ct):i.framebufferTexture2D(i.FRAMEBUFFER,K,Y,at,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function j(A){let v=n.get(A),O=A.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==A.depthTexture){let H=A.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),H){let q=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,H.removeEventListener("dispose",q)};H.addEventListener("dispose",q),v.__depthDisposeCallback=q}v.__boundDepthTexture=H}if(A.depthTexture&&!v.__autoAllocateDepthBuffer)if(O)for(let H=0;H<6;H++)Gt(v.__webglFramebuffer[H],A,H);else{let H=A.texture.mipmaps;H&&H.length>0?Gt(v.__webglFramebuffer[0],A,0):Gt(v.__webglFramebuffer,A,0)}else if(O){v.__webglDepthbuffer=[];for(let H=0;H<6;H++)if(e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[H]),v.__webglDepthbuffer[H]===void 0)v.__webglDepthbuffer[H]=i.createRenderbuffer(),he(v.__webglDepthbuffer[H],A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=v.__webglDepthbuffer[H];i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,at)}}else{let H=A.texture.mipmaps;if(H&&H.length>0?e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=i.createRenderbuffer(),he(v.__webglDepthbuffer,A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=v.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,at)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function rt(A,v,O){let H=n.get(A);v!==void 0&&Nt(H.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),O!==void 0&&j(A)}function it(A){let v=A.texture,O=n.get(A),H=n.get(v);A.addEventListener("dispose",x);let q=A.textures,at=A.isWebGLCubeRenderTarget===!0,ct=q.length>1;if(ct||(H.__webglTexture===void 0&&(H.__webglTexture=i.createTexture()),H.__version=v.version,a.memory.textures++),at){O.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer[Y]=[];for(let K=0;K<v.mipmaps.length;K++)O.__webglFramebuffer[Y][K]=i.createFramebuffer()}else O.__webglFramebuffer[Y]=i.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){O.__webglFramebuffer=[];for(let Y=0;Y<v.mipmaps.length;Y++)O.__webglFramebuffer[Y]=i.createFramebuffer()}else O.__webglFramebuffer=i.createFramebuffer();if(ct)for(let Y=0,K=q.length;Y<K;Y++){let ut=n.get(q[Y]);ut.__webglTexture===void 0&&(ut.__webglTexture=i.createTexture(),a.memory.textures++)}if(A.samples>0&&qt(A)===!1){O.__webglMultisampledFramebuffer=i.createFramebuffer(),O.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let Y=0;Y<q.length;Y++){let K=q[Y];O.__webglColorRenderbuffer[Y]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,O.__webglColorRenderbuffer[Y]);let ut=r.convert(K.format,K.colorSpace),Ct=r.convert(K.type),gt=y(K.internalFormat,ut,Ct,K.normalized,K.colorSpace,A.isXRRenderTarget===!0),dt=kt(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,dt,gt,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Y,i.RENDERBUFFER,O.__webglColorRenderbuffer[Y])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(O.__webglDepthRenderbuffer=i.createRenderbuffer(),he(O.__webglDepthRenderbuffer,A,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(at){e.bindTexture(i.TEXTURE_CUBE_MAP,H.__webglTexture),Qt(i.TEXTURE_CUBE_MAP,v);for(let Y=0;Y<6;Y++)if(v.mipmaps&&v.mipmaps.length>0)for(let K=0;K<v.mipmaps.length;K++)Nt(O.__webglFramebuffer[Y][K],A,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,K);else Nt(O.__webglFramebuffer[Y],A,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);m(v)&&M(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(ct){for(let Y=0,K=q.length;Y<K;Y++){let ut=q[Y],Ct=n.get(ut),gt=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(gt=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(gt,Ct.__webglTexture),Qt(gt,ut),Nt(O.__webglFramebuffer,A,ut,i.COLOR_ATTACHMENT0+Y,gt,0),m(ut)&&M(gt)}e.unbindTexture()}else{let Y=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(Y=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(Y,H.__webglTexture),Qt(Y,v),v.mipmaps&&v.mipmaps.length>0)for(let K=0;K<v.mipmaps.length;K++)Nt(O.__webglFramebuffer[K],A,v,i.COLOR_ATTACHMENT0,Y,K);else Nt(O.__webglFramebuffer,A,v,i.COLOR_ATTACHMENT0,Y,0);m(v)&&M(Y),e.unbindTexture()}A.depthBuffer&&j(A)}function _t(A){let v=A.textures;for(let O=0,H=v.length;O<H;O++){let q=v[O];if(m(q)){let at=S(A),ct=n.get(q).__webglTexture;e.bindTexture(at,ct),M(at),e.unbindTexture()}}}let mt=[],Ft=[];function Rt(A){if(A.samples>0){if(qt(A)===!1){let v=A.textures,O=A.width,H=A.height,q=i.COLOR_BUFFER_BIT,at=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ct=n.get(A),Y=v.length>1;if(Y)for(let ut=0;ut<v.length;ut++)e.bindFramebuffer(i.FRAMEBUFFER,ct.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,ct.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,ct.__webglMultisampledFramebuffer);let K=A.texture.mipmaps;K&&K.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ct.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ct.__webglFramebuffer);for(let ut=0;ut<v.length;ut++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(q|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(q|=i.STENCIL_BUFFER_BIT)),Y){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ct.__webglColorRenderbuffer[ut]);let Ct=n.get(v[ut]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ct,0)}i.blitFramebuffer(0,0,O,H,0,0,O,H,q,i.NEAREST),l===!0&&(mt.length=0,Ft.length=0,mt.push(i.COLOR_ATTACHMENT0+ut),A.depthBuffer&&A.resolveDepthBuffer===!1&&(mt.push(at),Ft.push(at),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Ft)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,mt))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Y)for(let ut=0;ut<v.length;ut++){e.bindFramebuffer(i.FRAMEBUFFER,ct.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,ct.__webglColorRenderbuffer[ut]);let Ct=n.get(v[ut]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,ct.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,Ct,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ct.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){let v=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[v])}}}function kt(A){return Math.min(s.maxSamples,A.samples)}function qt(A){let v=n.get(A);return A.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function L(A){let v=a.render.frame;h.get(A)!==v&&(h.set(A,v),A.update())}function de(A,v){let O=A.colorSpace,H=A.format,q=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||O!==nr&&O!==oi&&(ae.getTransfer(O)===ue?(H!==an||q!==rn)&&Ot("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ut("WebGLTextures: Unsupported texture color space:",O)),v}function se(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=z,this.resetTextureUnits=W,this.getTextureUnits=X,this.setTextureUnits=D,this.setTexture2D=$,this.setTexture2DArray=Q,this.setTexture3D=ot,this.setTextureCube=lt,this.rebindTextures=rt,this.setupRenderTarget=it,this.updateRenderTargetMipmap=_t,this.updateMultisampleRenderTarget=Rt,this.setupDepthRenderbuffer=j,this.setupFrameBufferTexture=Nt,this.useMultisampledRTT=qt,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function Qx(i,t){function e(n,s=oi){let r,a=ae.getTransfer(s);if(n===rn)return i.UNSIGNED_BYTE;if(n===xo)return i.UNSIGNED_SHORT_4_4_4_4;if(n===_o)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Tc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===wc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===bc)return i.BYTE;if(n===Ec)return i.SHORT;if(n===Is)return i.UNSIGNED_SHORT;if(n===go)return i.INT;if(n===Ln)return i.UNSIGNED_INT;if(n===Sn)return i.FLOAT;if(n===qn)return i.HALF_FLOAT;if(n===Ac)return i.ALPHA;if(n===Rc)return i.RGB;if(n===an)return i.RGBA;if(n===zn)return i.DEPTH_COMPONENT;if(n===wi)return i.DEPTH_STENCIL;if(n===vo)return i.RED;if(n===yo)return i.RED_INTEGER;if(n===Ai)return i.RG;if(n===Mo)return i.RG_INTEGER;if(n===So)return i.RGBA_INTEGER;if(n===Fr||n===Or||n===Br||n===zr)if(a===ue)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Fr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Or)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Br)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===zr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Fr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Or)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Br)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===zr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===bo||n===Eo||n===To||n===wo)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===bo)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Eo)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===To)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===wo)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ao||n===Ro||n===Co||n===Po||n===Io||n===Vr||n===Lo)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ao||n===Ro)return a===ue?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Co)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Po)return r.COMPRESSED_R11_EAC;if(n===Io)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Vr)return r.COMPRESSED_RG11_EAC;if(n===Lo)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Do||n===No||n===Uo||n===Fo||n===Oo||n===Bo||n===zo||n===Vo||n===ko||n===Ho||n===Go||n===Wo||n===Xo||n===qo)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Do)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===No)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Uo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Fo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Oo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Bo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===zo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Vo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ko)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ho)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Go)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Wo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Xo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===qo)return a===ue?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Yo||n===Zo||n===$o)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Yo)return a===ue?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Zo)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===$o)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Jo||n===Ko||n===kr||n===Qo)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Jo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ko)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===kr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Qo)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ls?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var jx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,t_=`
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

}`,th=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new mr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new ke({vertexShader:jx,fragmentShader:t_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Lt(new Wn(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},eh=class extends Vn{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,g=null,_=typeof XRWebGLBinding<"u",p=new th,m={},M=e.getContextAttributes(),S=null,y=null,w=[],E=[],R=new et,x=null,T=new $e;T.viewport=new be;let P=new $e;P.viewport=new be;let I=[T,P],U=new ho,W=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let st=w[Z];return st===void 0&&(st=new Ss,w[Z]=st),st.getTargetRaySpace()},this.getControllerGrip=function(Z){let st=w[Z];return st===void 0&&(st=new Ss,w[Z]=st),st.getGripSpace()},this.getHand=function(Z){let st=w[Z];return st===void 0&&(st=new Ss,w[Z]=st),st.getHandSpace()};function D(Z){let st=E.indexOf(Z.inputSource);if(st===-1)return;let nt=w[st];nt!==void 0&&(nt.update(Z.inputSource,Z.frame,c||a),nt.dispatchEvent({type:Z.type,data:Z.inputSource}))}function z(){s.removeEventListener("select",D),s.removeEventListener("selectstart",D),s.removeEventListener("selectend",D),s.removeEventListener("squeeze",D),s.removeEventListener("squeezestart",D),s.removeEventListener("squeezeend",D),s.removeEventListener("end",z),s.removeEventListener("inputsourceschange",B);for(let Z=0;Z<w.length;Z++){let st=E[Z];st!==null&&(E[Z]=null,w[Z].disconnect(st))}W=null,X=null,p.reset();for(let Z in m)delete m[Z];t.setRenderTarget(S),f=null,u=null,d=null,s=null,y=null,Qt.stop(),n.isPresenting=!1,t.setPixelRatio(x),t.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,n.isPresenting===!0&&Ot("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){o=Z,n.isPresenting===!0&&Ot("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&_&&(d=new XRWebGLBinding(s,e)),d},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Z){if(s=Z,s!==null){if(S=t.getRenderTarget(),s.addEventListener("select",D),s.addEventListener("selectstart",D),s.addEventListener("selectend",D),s.addEventListener("squeeze",D),s.addEventListener("squeezestart",D),s.addEventListener("squeezeend",D),s.addEventListener("end",z),s.addEventListener("inputsourceschange",B),M.xrCompatible!==!0&&await e.makeXRCompatible(),x=t.getPixelRatio(),t.getSize(R),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let nt=null,Et=null,Vt=null;M.depth&&(Vt=M.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,nt=M.stencil?wi:zn,Et=M.stencil?Ls:Ln);let Nt={colorFormat:e.RGBA8,depthFormat:Vt,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(Nt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),y=new dn(u.textureWidth,u.textureHeight,{format:an,type:rn,depthTexture:new ri(u.textureWidth,u.textureHeight,Et,void 0,void 0,void 0,void 0,void 0,void 0,nt),stencilBuffer:M.stencil,colorSpace:t.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let nt={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,nt),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new dn(f.framebufferWidth,f.framebufferHeight,{format:an,type:rn,colorSpace:t.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Qt.setContext(s),Qt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function B(Z){for(let st=0;st<Z.removed.length;st++){let nt=Z.removed[st],Et=E.indexOf(nt);Et>=0&&(E[Et]=null,w[Et].disconnect(nt))}for(let st=0;st<Z.added.length;st++){let nt=Z.added[st],Et=E.indexOf(nt);if(Et===-1){for(let Nt=0;Nt<w.length;Nt++)if(Nt>=E.length){E.push(nt),Et=Nt;break}else if(E[Nt]===null){E[Nt]=nt,Et=Nt;break}if(Et===-1)break}let Vt=w[Et];Vt&&Vt.connect(nt)}}let $=new C,Q=new C;function ot(Z,st,nt){$.setFromMatrixPosition(st.matrixWorld),Q.setFromMatrixPosition(nt.matrixWorld);let Et=$.distanceTo(Q),Vt=st.projectionMatrix.elements,Nt=nt.projectionMatrix.elements,he=Vt[14]/(Vt[10]-1),Gt=Vt[14]/(Vt[10]+1),j=(Vt[9]+1)/Vt[5],rt=(Vt[9]-1)/Vt[5],it=(Vt[8]-1)/Vt[0],_t=(Nt[8]+1)/Nt[0],mt=he*it,Ft=he*_t,Rt=Et/(-it+_t),kt=Rt*-it;if(st.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(kt),Z.translateZ(Rt),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),Vt[10]===-1)Z.projectionMatrix.copy(st.projectionMatrix),Z.projectionMatrixInverse.copy(st.projectionMatrixInverse);else{let qt=he+Rt,L=Gt+Rt,de=mt-kt,se=Ft+(Et-kt),A=j*Gt/L*qt,v=rt*Gt/L*qt;Z.projectionMatrix.makePerspective(de,se,A,v,qt,L),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function lt(Z,st){st===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(st.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(s===null)return;let st=Z.near,nt=Z.far;p.texture!==null&&(p.depthNear>0&&(st=p.depthNear),p.depthFar>0&&(nt=p.depthFar)),U.near=P.near=T.near=st,U.far=P.far=T.far=nt,(W!==U.near||X!==U.far)&&(s.updateRenderState({depthNear:U.near,depthFar:U.far}),W=U.near,X=U.far),U.layers.mask=Z.layers.mask|6,T.layers.mask=U.layers.mask&-5,P.layers.mask=U.layers.mask&-3;let Et=Z.parent,Vt=U.cameras;lt(U,Et);for(let Nt=0;Nt<Vt.length;Nt++)lt(Vt[Nt],Et);Vt.length===2?ot(U,T,P):U.projectionMatrix.copy(T.projectionMatrix),pt(Z,U,Et)};function pt(Z,st,nt){nt===null?Z.matrix.copy(st.matrixWorld):(Z.matrix.copy(nt.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(st.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(st.projectionMatrix),Z.projectionMatrixInverse.copy(st.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Fa*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return U},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Z)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(U)},this.getCameraTexture=function(Z){return m[Z]};let Zt=null;function ie(Z,st){if(h=st.getViewerPose(c||a),g=st,h!==null){let nt=h.views;f!==null&&(t.setRenderTargetFramebuffer(y,f.framebuffer),t.setRenderTarget(y));let Et=!1;nt.length!==U.cameras.length&&(U.cameras.length=0,Et=!0);for(let Gt=0;Gt<nt.length;Gt++){let j=nt[Gt],rt=null;if(f!==null)rt=f.getViewport(j);else{let _t=d.getViewSubImage(u,j);rt=_t.viewport,Gt===0&&(t.setRenderTargetTextures(y,_t.colorTexture,_t.depthStencilTexture),t.setRenderTarget(y))}let it=I[Gt];it===void 0&&(it=new $e,it.layers.enable(Gt),it.viewport=new be,I[Gt]=it),it.matrix.fromArray(j.transform.matrix),it.matrix.decompose(it.position,it.quaternion,it.scale),it.projectionMatrix.fromArray(j.projectionMatrix),it.projectionMatrixInverse.copy(it.projectionMatrix).invert(),it.viewport.set(rt.x,rt.y,rt.width,rt.height),Gt===0&&(U.matrix.copy(it.matrix),U.matrix.decompose(U.position,U.quaternion,U.scale)),Et===!0&&U.cameras.push(it)}let Vt=s.enabledFeatures;if(Vt&&Vt.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&_){d=n.getBinding();let Gt=d.getDepthInformation(nt[0]);Gt&&Gt.isValid&&Gt.texture&&p.init(Gt,s.renderState)}if(Vt&&Vt.includes("camera-access")&&_){t.state.unbindTexture(),d=n.getBinding();for(let Gt=0;Gt<nt.length;Gt++){let j=nt[Gt].camera;if(j){let rt=m[j];rt||(rt=new mr,m[j]=rt);let it=d.getCameraImage(j);rt.sourceTexture=it}}}}for(let nt=0;nt<w.length;nt++){let Et=E[nt],Vt=w[nt];Et!==null&&Vt!==void 0&&Vt.update(Et,st,c||a)}Zt&&Zt(Z,st),st.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:st}),g=null}let Qt=new fd;Qt.setAnimationLoop(ie),this.setAnimationLoop=function(Z){Zt=Z},this.dispose=function(){}}},e_=new ce,vd=new Xt;vd.set(-1,0,0,0,1,0,0,0,1);function n_(i,t){function e(p,m){p.matrixAutoUpdate===!0&&p.updateMatrix(),m.value.copy(p.matrix)}function n(p,m){m.color.getRGB(p.fogColor.value,Lc(i)),m.isFog?(p.fogNear.value=m.near,p.fogFar.value=m.far):m.isFogExp2&&(p.fogDensity.value=m.density)}function s(p,m,M,S,y){m.isNodeMaterial?m.uniformsNeedUpdate=!1:m.isMeshBasicMaterial?r(p,m):m.isMeshLambertMaterial?(r(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshToonMaterial?(r(p,m),d(p,m)):m.isMeshPhongMaterial?(r(p,m),h(p,m),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)):m.isMeshStandardMaterial?(r(p,m),u(p,m),m.isMeshPhysicalMaterial&&f(p,m,y)):m.isMeshMatcapMaterial?(r(p,m),g(p,m)):m.isMeshDepthMaterial?r(p,m):m.isMeshDistanceMaterial?(r(p,m),_(p,m)):m.isMeshNormalMaterial?r(p,m):m.isLineBasicMaterial?(a(p,m),m.isLineDashedMaterial&&o(p,m)):m.isPointsMaterial?l(p,m,M,S):m.isSpriteMaterial?c(p,m):m.isShadowMaterial?(p.color.value.copy(m.color),p.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(p,m){p.opacity.value=m.opacity,m.color&&p.diffuse.value.copy(m.color),m.emissive&&p.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.bumpMap&&(p.bumpMap.value=m.bumpMap,e(m.bumpMap,p.bumpMapTransform),p.bumpScale.value=m.bumpScale,m.side===Ue&&(p.bumpScale.value*=-1)),m.normalMap&&(p.normalMap.value=m.normalMap,e(m.normalMap,p.normalMapTransform),p.normalScale.value.copy(m.normalScale),m.side===Ue&&p.normalScale.value.negate()),m.displacementMap&&(p.displacementMap.value=m.displacementMap,e(m.displacementMap,p.displacementMapTransform),p.displacementScale.value=m.displacementScale,p.displacementBias.value=m.displacementBias),m.emissiveMap&&(p.emissiveMap.value=m.emissiveMap,e(m.emissiveMap,p.emissiveMapTransform)),m.specularMap&&(p.specularMap.value=m.specularMap,e(m.specularMap,p.specularMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest);let M=t.get(m),S=M.envMap,y=M.envMapRotation;S&&(p.envMap.value=S,p.envMapRotation.value.setFromMatrix4(e_.makeRotationFromEuler(y)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(vd),p.reflectivity.value=m.reflectivity,p.ior.value=m.ior,p.refractionRatio.value=m.refractionRatio),m.lightMap&&(p.lightMap.value=m.lightMap,p.lightMapIntensity.value=m.lightMapIntensity,e(m.lightMap,p.lightMapTransform)),m.aoMap&&(p.aoMap.value=m.aoMap,p.aoMapIntensity.value=m.aoMapIntensity,e(m.aoMap,p.aoMapTransform))}function a(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform))}function o(p,m){p.dashSize.value=m.dashSize,p.totalSize.value=m.dashSize+m.gapSize,p.scale.value=m.scale}function l(p,m,M,S){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.size.value=m.size*M,p.scale.value=S*.5,m.map&&(p.map.value=m.map,e(m.map,p.uvTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function c(p,m){p.diffuse.value.copy(m.color),p.opacity.value=m.opacity,p.rotation.value=m.rotation,m.map&&(p.map.value=m.map,e(m.map,p.mapTransform)),m.alphaMap&&(p.alphaMap.value=m.alphaMap,e(m.alphaMap,p.alphaMapTransform)),m.alphaTest>0&&(p.alphaTest.value=m.alphaTest)}function h(p,m){p.specular.value.copy(m.specular),p.shininess.value=Math.max(m.shininess,1e-4)}function d(p,m){m.gradientMap&&(p.gradientMap.value=m.gradientMap)}function u(p,m){p.metalness.value=m.metalness,m.metalnessMap&&(p.metalnessMap.value=m.metalnessMap,e(m.metalnessMap,p.metalnessMapTransform)),p.roughness.value=m.roughness,m.roughnessMap&&(p.roughnessMap.value=m.roughnessMap,e(m.roughnessMap,p.roughnessMapTransform)),m.envMap&&(p.envMapIntensity.value=m.envMapIntensity)}function f(p,m,M){p.ior.value=m.ior,m.sheen>0&&(p.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),p.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(p.sheenColorMap.value=m.sheenColorMap,e(m.sheenColorMap,p.sheenColorMapTransform)),m.sheenRoughnessMap&&(p.sheenRoughnessMap.value=m.sheenRoughnessMap,e(m.sheenRoughnessMap,p.sheenRoughnessMapTransform))),m.clearcoat>0&&(p.clearcoat.value=m.clearcoat,p.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(p.clearcoatMap.value=m.clearcoatMap,e(m.clearcoatMap,p.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,e(m.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(p.clearcoatNormalMap.value=m.clearcoatNormalMap,e(m.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===Ue&&p.clearcoatNormalScale.value.negate())),m.dispersion>0&&(p.dispersion.value=m.dispersion),m.iridescence>0&&(p.iridescence.value=m.iridescence,p.iridescenceIOR.value=m.iridescenceIOR,p.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(p.iridescenceMap.value=m.iridescenceMap,e(m.iridescenceMap,p.iridescenceMapTransform)),m.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=m.iridescenceThicknessMap,e(m.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),m.transmission>0&&(p.transmission.value=m.transmission,p.transmissionSamplerMap.value=M.texture,p.transmissionSamplerSize.value.set(M.width,M.height),m.transmissionMap&&(p.transmissionMap.value=m.transmissionMap,e(m.transmissionMap,p.transmissionMapTransform)),p.thickness.value=m.thickness,m.thicknessMap&&(p.thicknessMap.value=m.thicknessMap,e(m.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=m.attenuationDistance,p.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(p.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(p.anisotropyMap.value=m.anisotropyMap,e(m.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=m.specularIntensity,p.specularColor.value.copy(m.specularColor),m.specularColorMap&&(p.specularColorMap.value=m.specularColorMap,e(m.specularColorMap,p.specularColorMapTransform)),m.specularIntensityMap&&(p.specularIntensityMap.value=m.specularIntensityMap,e(m.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,m){m.matcap&&(p.matcap.value=m.matcap)}function _(p,m){let M=t.get(m).light;p.referencePosition.value.setFromMatrixPosition(M.matrixWorld),p.nearDistance.value=M.shadow.camera.near,p.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function i_(i,t,e,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,w){let E=w.program;n.uniformBlockBinding(y,E)}function c(y,w){let E=s[y.id];E===void 0&&(p(y),E=h(y),s[y.id]=E,y.addEventListener("dispose",M));let R=w.program;n.updateUBOMapping(y,R);let x=t.render.frame;r[y.id]!==x&&(u(y),r[y.id]=x)}function h(y){let w=d();y.__bindingPointIndex=w;let E=i.createBuffer(),R=y.__size,x=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,R,x),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,w,E),E}function d(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return Ut("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let w=s[y.id],E=y.uniforms,R=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,w);for(let x=0,T=E.length;x<T;x++){let P=E[x];if(Array.isArray(P))for(let I=0,U=P.length;I<U;I++)f(P[I],x,I,R);else f(P,x,0,R)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(y,w,E,R){if(_(y,w,E,R)===!0){let x=y.__offset,T=y.value;if(Array.isArray(T)){let P=0;for(let I=0;I<T.length;I++){let U=T[I],W=m(U);g(U,y.__data,P),typeof U!="number"&&typeof U!="boolean"&&!U.isMatrix3&&!ArrayBuffer.isView(U)&&(P+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(T,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,x,y.__data)}}function g(y,w,E){typeof y=="number"||typeof y=="boolean"?w[0]=y:y.isMatrix3?(w[0]=y.elements[0],w[1]=y.elements[1],w[2]=y.elements[2],w[3]=0,w[4]=y.elements[3],w[5]=y.elements[4],w[6]=y.elements[5],w[7]=0,w[8]=y.elements[6],w[9]=y.elements[7],w[10]=y.elements[8],w[11]=0):ArrayBuffer.isView(y)?w.set(new y.constructor(y.buffer,y.byteOffset,w.length)):y.toArray(w,E)}function _(y,w,E,R){let x=y.value,T=w+"_"+E;if(R[T]===void 0)return typeof x=="number"||typeof x=="boolean"?R[T]=x:ArrayBuffer.isView(x)?R[T]=x.slice():R[T]=x.clone(),!0;{let P=R[T];if(typeof x=="number"||typeof x=="boolean"){if(P!==x)return R[T]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(P.equals(x)===!1)return P.copy(x),!0}}return!1}function p(y){let w=y.uniforms,E=0,R=16;for(let T=0,P=w.length;T<P;T++){let I=Array.isArray(w[T])?w[T]:[w[T]];for(let U=0,W=I.length;U<W;U++){let X=I[U],D=Array.isArray(X.value)?X.value:[X.value];for(let z=0,B=D.length;z<B;z++){let $=D[z],Q=m($),ot=E%R,lt=ot%Q.boundary,pt=ot+lt;E+=lt,pt!==0&&R-pt<Q.storage&&(E+=R-pt),X.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),X.__offset=E,E+=Q.storage}}}let x=E%R;return x>0&&(E+=R-x),y.__size=E,y.__cache={},this}function m(y){let w={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(w.boundary=4,w.storage=4):y.isVector2?(w.boundary=8,w.storage=8):y.isVector3||y.isColor?(w.boundary=16,w.storage=12):y.isVector4?(w.boundary=16,w.storage=16):y.isMatrix3?(w.boundary=48,w.storage=48):y.isMatrix4?(w.boundary=64,w.storage=64):y.isTexture?Ot("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(w.boundary=16,w.storage=y.byteLength):Ot("WebGLRenderer: Unsupported uniform value type.",y),w}function M(y){let w=y.target;w.removeEventListener("dispose",M);let E=a.indexOf(w.__bindingPointIndex);a.splice(E,1),i.deleteBuffer(s[w.id]),delete s[w.id],delete r[w.id]}function S(){for(let y in s)i.deleteBuffer(s[y]);a=[],s={},r={}}return{bind:l,update:c,dispose:S}}var s_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Yn=null;function r_(){return Yn===null&&(Yn=new Hi(s_,16,16,Ai,qn),Yn.name="DFG_LUT",Yn.minFilter=Ie,Yn.magFilter=Ie,Yn.wrapS=yn,Yn.wrapT=yn,Yn.generateMipmaps=!1,Yn.needsUpdate=!0),Yn}var al=class{constructor(t={}){let{canvas:e=Du(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=rn}=t;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=a;let _=f,p=new Set([So,Mo,yo]),m=new Set([rn,Ln,Is,Ls,xo,_o]),M=new Uint32Array(4),S=new Int32Array(4),y=new C,w=null,E=null,R=[],x=[],T=null;this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=In,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let P=this,I=!1,U=null,W=null,X=null,D=null;this._outputColorSpace=Ne;let z=0,B=0,$=null,Q=-1,ot=null,lt=new be,pt=new be,Zt=null,ie=new Ht(0),Qt=0,Z=e.width,st=e.height,nt=1,Et=null,Vt=null,Nt=new be(0,0,Z,st),he=new be(0,0,Z,st),Gt=!1,j=new Es,rt=!1,it=!1,_t=new ce,mt=new C,Ft=new be,Rt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},kt=!1;function qt(){return $===null?nt:1}let L=n;function de(b,F){return e.getContext(b,F)}try{let b={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"185"}`),e.addEventListener("webglcontextlost",Te,!1),e.addEventListener("webglcontextrestored",_e,!1),e.addEventListener("webglcontextcreationerror",Nn,!1),L===null){let F="webgl2";if(L=de(F,b),L===null)throw de(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(b){throw Ut("WebGLRenderer: "+b.message),b}let se,A,v,O,H,q,at,ct,Y,K,ut,Ct,gt,dt,Dt,Bt,$t,N,ht,J,ft,Mt,tt;function At(){se=new dg(L),se.init(),ft=new Qx(L,se),A=new sg(L,se,t,ft),v=new Jx(L,se),A.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),W=L.createFramebuffer(),X=L.createFramebuffer(),D=L.createFramebuffer(),O=new mg(L),H=new Fx,q=new Kx(L,se,v,H,A,ft,O),at=new ug(P),ct=new vp(L),Mt=new ng(L,ct),Y=new fg(L,ct,O,Mt),K=new xg(L,Y,ct,Mt,O),N=new gg(L,A,q),Dt=new rg(H),ut=new Ux(P,at,se,A,Mt,Dt),Ct=new n_(P,H),gt=new Bx,dt=new Wx(se),$t=new eg(P,at,v,K,g,l),Bt=new $x(P,K,A),tt=new i_(L,O,A,v),ht=new ig(L,se,O),J=new pg(L,se,O),O.programs=ut.programs,P.capabilities=A,P.extensions=se,P.properties=H,P.renderLists=gt,P.shadowMap=Bt,P.state=v,P.info=O}At(),_!==rn&&(T=new vg(_,e.width,e.height,o,s,r));let Tt=new eh(P,L);this.xr=Tt,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let b=se.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=se.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return nt},this.setPixelRatio=function(b){b!==void 0&&(nt=b,this.setSize(Z,st,!1))},this.getSize=function(b){return b.set(Z,st)},this.setSize=function(b,F,G=!0){if(Tt.isPresenting){Ot("WebGLRenderer: Can't change size while VR device is presenting.");return}Z=b,st=F,e.width=Math.floor(b*nt),e.height=Math.floor(F*nt),G===!0&&(e.style.width=b+"px",e.style.height=F+"px"),T!==null&&T.setSize(e.width,e.height),this.setViewport(0,0,b,F)},this.getDrawingBufferSize=function(b){return b.set(Z*nt,st*nt).floor()},this.setDrawingBufferSize=function(b,F,G){Z=b,st=F,nt=G,e.width=Math.floor(b*G),e.height=Math.floor(F*G),this.setViewport(0,0,b,F)},this.setEffects=function(b){if(_===rn){Ut("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let F=0;F<b.length;F++)if(b[F].isOutputPass===!0){Ot("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(lt)},this.getViewport=function(b){return b.copy(Nt)},this.setViewport=function(b,F,G,V){b.isVector4?Nt.set(b.x,b.y,b.z,b.w):Nt.set(b,F,G,V),v.viewport(lt.copy(Nt).multiplyScalar(nt).round())},this.getScissor=function(b){return b.copy(he)},this.setScissor=function(b,F,G,V){b.isVector4?he.set(b.x,b.y,b.z,b.w):he.set(b,F,G,V),v.scissor(pt.copy(he).multiplyScalar(nt).round())},this.getScissorTest=function(){return Gt},this.setScissorTest=function(b){v.setScissorTest(Gt=b)},this.setOpaqueSort=function(b){Et=b},this.setTransparentSort=function(b){Vt=b},this.getClearColor=function(b){return b.copy($t.getClearColor())},this.setClearColor=function(){$t.setClearColor(...arguments)},this.getClearAlpha=function(){return $t.getClearAlpha()},this.setClearAlpha=function(){$t.setClearAlpha(...arguments)},this.clear=function(b=!0,F=!0,G=!0){let V=0;if(b){let k=!1;if($!==null){let yt=$.texture.format;k=p.has(yt)}if(k){let yt=$.texture.type,bt=m.has(yt),vt=$t.getClearColor(),wt=$t.getClearAlpha(),Pt=vt.r,Jt=vt.g,te=vt.b;bt?(M[0]=Pt,M[1]=Jt,M[2]=te,M[3]=wt,L.clearBufferuiv(L.COLOR,0,M)):(S[0]=Pt,S[1]=Jt,S[2]=te,S[3]=wt,L.clearBufferiv(L.COLOR,0,S))}else V|=L.COLOR_BUFFER_BIT}F&&(V|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),G&&(V|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),V!==0&&L.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),U=b},this.dispose=function(){e.removeEventListener("webglcontextlost",Te,!1),e.removeEventListener("webglcontextrestored",_e,!1),e.removeEventListener("webglcontextcreationerror",Nn,!1),$t.dispose(),gt.dispose(),dt.dispose(),H.dispose(),at.dispose(),K.dispose(),Mt.dispose(),tt.dispose(),ut.dispose(),Tt.dispose(),Tt.removeEventListener("sessionstart",fh),Tt.removeEventListener("sessionend",ph),Li.stop()};function Te(b){b.preventDefault(),rr("WebGLRenderer: Context Lost."),I=!0}function _e(){rr("WebGLRenderer: Context Restored."),I=!1;let b=O.autoReset,F=Bt.enabled,G=Bt.autoUpdate,V=Bt.needsUpdate,k=Bt.type;At(),O.autoReset=b,Bt.enabled=F,Bt.autoUpdate=G,Bt.needsUpdate=V,Bt.type=k}function Nn(b){Ut("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function Un(b){let F=b.target;F.removeEventListener("dispose",Un),rf(F)}function rf(b){af(b),H.remove(b)}function af(b){let F=H.get(b).programs;F!==void 0&&(F.forEach(function(G){ut.releaseProgram(G)}),b.isShaderMaterial&&ut.releaseShaderCache(b))}this.renderBufferDirect=function(b,F,G,V,k,yt){F===null&&(F=Rt);let bt=k.isMesh&&k.matrixWorld.determinantAffine()<0,vt=cf(b,F,G,V,k);v.setMaterial(V,bt);let wt=G.index,Pt=1;if(V.wireframe===!0){if(wt=Y.getWireframeAttribute(G),wt===void 0)return;Pt=2}let Jt=G.drawRange,te=G.attributes.position,It=Jt.start*Pt,fe=(Jt.start+Jt.count)*Pt;yt!==null&&(It=Math.max(It,yt.start*Pt),fe=Math.min(fe,(yt.start+yt.count)*Pt)),wt!==null?(It=Math.max(It,0),fe=Math.min(fe,wt.count)):te!=null&&(It=Math.max(It,0),fe=Math.min(fe,te.count));let Re=fe-It;if(Re<0||Re===1/0)return;Mt.setup(k,V,vt,G,wt);let we,ge=ht;if(wt!==null&&(we=ct.get(wt),ge=J,ge.setIndex(we)),k.isMesh)V.wireframe===!0?(v.setLineWidth(V.wireframeLinewidth*qt()),ge.setMode(L.LINES)):ge.setMode(L.TRIANGLES);else if(k.isLine){let qe=V.linewidth;qe===void 0&&(qe=1),v.setLineWidth(qe*qt()),k.isLineSegments?ge.setMode(L.LINES):k.isLineLoop?ge.setMode(L.LINE_LOOP):ge.setMode(L.LINE_STRIP)}else k.isPoints?ge.setMode(L.POINTS):k.isSprite&&ge.setMode(L.TRIANGLES);if(k.isBatchedMesh)if(se.get("WEBGL_multi_draw"))ge.renderMultiDraw(k._multiDrawStarts,k._multiDrawCounts,k._multiDrawCount);else{let qe=k._multiDrawStarts,St=k._multiDrawCounts,cn=k._multiDrawCount,le=wt?ct.get(wt).bytesPerElement:1,xn=H.get(V).currentProgram.getUniforms();for(let Fn=0;Fn<cn;Fn++)xn.setValue(L,"_gl_DrawID",Fn),ge.render(qe[Fn]/le,St[Fn])}else if(k.isInstancedMesh)ge.renderInstances(It,Re,k.count);else if(G.isInstancedBufferGeometry){let qe=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,St=Math.min(G.instanceCount,qe);ge.renderInstances(It,Re,St)}else ge.render(It,Re)};function dh(b,F,G){b.transparent===!0&&b.side===Je&&b.forceSinglePass===!1?(b.side=Ue,b.needsUpdate=!0,Zr(b,F,G),b.side=si,b.needsUpdate=!0,Zr(b,F,G),b.side=Je):Zr(b,F,G)}this.compile=function(b,F,G=null){G===null&&(G=b),E=dt.get(G),E.init(F),x.push(E),G.traverseVisible(function(k){k.isLight&&k.layers.test(F.layers)&&(E.pushLight(k),k.castShadow&&E.pushShadow(k))}),b!==G&&b.traverseVisible(function(k){k.isLight&&k.layers.test(F.layers)&&(E.pushLight(k),k.castShadow&&E.pushShadow(k))}),E.setupLights();let V=new Set;return b.traverse(function(k){if(!(k.isMesh||k.isPoints||k.isLine||k.isSprite))return;let yt=k.material;if(yt)if(Array.isArray(yt))for(let bt=0;bt<yt.length;bt++){let vt=yt[bt];dh(vt,G,k),V.add(vt)}else dh(yt,G,k),V.add(yt)}),E=x.pop(),V},this.compileAsync=function(b,F,G=null){let V=this.compile(b,F,G);return new Promise(k=>{function yt(){if(V.forEach(function(bt){H.get(bt).currentProgram.isReady()&&V.delete(bt)}),V.size===0){k(b);return}setTimeout(yt,10)}se.get("KHR_parallel_shader_compile")!==null?yt():setTimeout(yt,10)})};let Ml=null;function of(b){Ml&&Ml(b)}function fh(){Li.stop()}function ph(){Li.start()}let Li=new fd;Li.setAnimationLoop(of),typeof self<"u"&&Li.setContext(self),this.setAnimationLoop=function(b){Ml=b,Tt.setAnimationLoop(b),b===null?Li.stop():Li.start()},Tt.addEventListener("sessionstart",fh),Tt.addEventListener("sessionend",ph),this.render=function(b,F){if(F!==void 0&&F.isCamera!==!0){Ut("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;U!==null&&U.renderStart(b,F);let G=Tt.enabled===!0&&Tt.isPresenting===!0,V=T!==null&&($===null||G)&&T.begin(P,$);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),Tt.enabled===!0&&Tt.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(Tt.cameraAutoUpdate===!0&&Tt.updateCamera(F),F=Tt.getCamera()),b.isScene===!0&&b.onBeforeRender(P,b,F,$),E=dt.get(b,x.length),E.init(F),E.state.textureUnits=q.getTextureUnits(),x.push(E),_t.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),j.setFromProjectionMatrix(_t,Rn,F.reversedDepth),it=this.localClippingEnabled,rt=Dt.init(this.clippingPlanes,it),w=gt.get(b,R.length),w.init(),R.push(w),Tt.enabled===!0&&Tt.isPresenting===!0){let bt=P.xr.getDepthSensingMesh();bt!==null&&Sl(bt,F,-1/0,P.sortObjects)}Sl(b,F,0,P.sortObjects),w.finish(),P.sortObjects===!0&&w.sort(Et,Vt,F.reversedDepth),kt=Tt.enabled===!1||Tt.isPresenting===!1||Tt.hasDepthSensing()===!1,kt&&$t.addToRenderList(w,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),rt===!0&&Dt.beginShadows();let k=E.state.shadowsArray;if(Bt.render(k,b,F),rt===!0&&Dt.endShadows(),(V&&T.hasRenderPass())===!1){let bt=w.opaque,vt=w.transmissive;if(E.setupLights(),F.isArrayCamera){let wt=F.cameras;if(vt.length>0)for(let Pt=0,Jt=wt.length;Pt<Jt;Pt++){let te=wt[Pt];gh(bt,vt,b,te)}kt&&$t.render(b);for(let Pt=0,Jt=wt.length;Pt<Jt;Pt++){let te=wt[Pt];mh(w,b,te,te.viewport)}}else vt.length>0&&gh(bt,vt,b,F),kt&&$t.render(b),mh(w,b,F)}$!==null&&B===0&&(q.updateMultisampleRenderTarget($),q.updateRenderTargetMipmap($)),V&&T.end(P),b.isScene===!0&&b.onAfterRender(P,b,F),Mt.resetDefaultState(),Q=-1,ot=null,x.pop(),x.length>0?(E=x[x.length-1],q.setTextureUnits(E.state.textureUnits),rt===!0&&Dt.setGlobalState(P.clippingPlanes,E.state.camera)):E=null,R.pop(),R.length>0?w=R[R.length-1]:w=null,U!==null&&U.renderEnd()};function Sl(b,F,G,V){if(b.visible===!1)return;if(b.layers.test(F.layers)){if(b.isGroup)G=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(F);else if(b.isLightProbeGrid)E.pushLightProbeGrid(b);else if(b.isLight)E.pushLight(b),b.castShadow&&E.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||j.intersectsSprite(b)){V&&Ft.setFromMatrixPosition(b.matrixWorld).applyMatrix4(_t);let bt=K.update(b),vt=b.material;vt.visible&&w.push(b,bt,vt,G,Ft.z,null)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||j.intersectsObject(b))){let bt=K.update(b),vt=b.material;if(V&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),Ft.copy(b.boundingSphere.center)):(bt.boundingSphere===null&&bt.computeBoundingSphere(),Ft.copy(bt.boundingSphere.center)),Ft.applyMatrix4(b.matrixWorld).applyMatrix4(_t)),Array.isArray(vt)){let wt=bt.groups;for(let Pt=0,Jt=wt.length;Pt<Jt;Pt++){let te=wt[Pt],It=vt[te.materialIndex];It&&It.visible&&w.push(b,bt,It,G,Ft.z,te)}}else vt.visible&&w.push(b,bt,vt,G,Ft.z,null)}}let yt=b.children;for(let bt=0,vt=yt.length;bt<vt;bt++)Sl(yt[bt],F,G,V)}function mh(b,F,G,V){let{opaque:k,transmissive:yt,transparent:bt}=b;E.setupLightsView(G),rt===!0&&Dt.setGlobalState(P.clippingPlanes,G),V&&v.viewport(lt.copy(V)),k.length>0&&Yr(k,F,G),yt.length>0&&Yr(yt,F,G),bt.length>0&&Yr(bt,F,G),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function gh(b,F,G,V){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[V.id]===void 0){let It=se.has("EXT_color_buffer_half_float")||se.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[V.id]=new dn(1,1,{generateMipmaps:!0,type:It?qn:rn,minFilter:Ti,samples:Math.max(4,A.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ae.workingColorSpace})}let yt=E.state.transmissionRenderTarget[V.id],bt=V.viewport||lt;yt.setSize(bt.z*P.transmissionResolutionScale,bt.w*P.transmissionResolutionScale);let vt=P.getRenderTarget(),wt=P.getActiveCubeFace(),Pt=P.getActiveMipmapLevel();P.setRenderTarget(yt),P.getClearColor(ie),Qt=P.getClearAlpha(),Qt<1&&P.setClearColor(16777215,.5),P.clear(),kt&&$t.render(G);let Jt=P.toneMapping;P.toneMapping=In;let te=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),E.setupLightsView(V),rt===!0&&Dt.setGlobalState(P.clippingPlanes,V),Yr(b,G,V),q.updateMultisampleRenderTarget(yt),q.updateRenderTargetMipmap(yt),se.has("WEBGL_multisampled_render_to_texture")===!1){let It=!1;for(let fe=0,Re=F.length;fe<Re;fe++){let we=F[fe],{object:ge,geometry:qe,material:St,group:cn}=we;if(St.side===Je&&ge.layers.test(V.layers)){let le=St.side;St.side=Ue,St.needsUpdate=!0,xh(ge,G,V,qe,St,cn),St.side=le,St.needsUpdate=!0,It=!0}}It===!0&&(q.updateMultisampleRenderTarget(yt),q.updateRenderTargetMipmap(yt))}P.setRenderTarget(vt,wt,Pt),P.setClearColor(ie,Qt),te!==void 0&&(V.viewport=te),P.toneMapping=Jt}function Yr(b,F,G){let V=F.isScene===!0?F.overrideMaterial:null;for(let k=0,yt=b.length;k<yt;k++){let bt=b[k],{object:vt,geometry:wt,group:Pt}=bt,Jt=bt.material;Jt.allowOverride===!0&&V!==null&&(Jt=V),vt.layers.test(G.layers)&&xh(vt,F,G,wt,Jt,Pt)}}function xh(b,F,G,V,k,yt){b.onBeforeRender(P,F,G,V,k,yt),b.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),k.onBeforeRender(P,F,G,V,b,yt),k.transparent===!0&&k.side===Je&&k.forceSinglePass===!1?(k.side=Ue,k.needsUpdate=!0,P.renderBufferDirect(G,F,V,k,b,yt),k.side=si,k.needsUpdate=!0,P.renderBufferDirect(G,F,V,k,b,yt),k.side=Je):P.renderBufferDirect(G,F,V,k,b,yt),b.onAfterRender(P,F,G,V,k,yt)}function Zr(b,F,G){F.isScene!==!0&&(F=Rt);let V=H.get(b),k=E.state.lights,yt=E.state.shadowsArray,bt=k.state.version,vt=ut.getParameters(b,k.state,yt,F,G,E.state.lightProbeGridArray),wt=ut.getProgramCacheKey(vt),Pt=V.programs;V.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?F.environment:null,V.fog=F.fog;let Jt=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;V.envMap=at.get(b.envMap||V.environment,Jt),V.envMapRotation=V.environment!==null&&b.envMap===null?F.environmentRotation:b.envMapRotation,Pt===void 0&&(b.addEventListener("dispose",Un),Pt=new Map,V.programs=Pt);let te=Pt.get(wt);if(te!==void 0){if(V.currentProgram===te&&V.lightsStateVersion===bt)return vh(b,vt),te}else vt.uniforms=ut.getUniforms(b),U!==null&&b.isNodeMaterial&&U.build(b,G,vt),b.onBeforeCompile(vt,P),te=ut.acquireProgram(vt,wt),Pt.set(wt,te),V.uniforms=vt.uniforms;let It=V.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(It.clippingPlanes=Dt.uniform),vh(b,vt),V.needsLights=uf(b),V.lightsStateVersion=bt,V.needsLights&&(It.ambientLightColor.value=k.state.ambient,It.lightProbe.value=k.state.probe,It.directionalLights.value=k.state.directional,It.directionalLightShadows.value=k.state.directionalShadow,It.spotLights.value=k.state.spot,It.spotLightShadows.value=k.state.spotShadow,It.rectAreaLights.value=k.state.rectArea,It.ltc_1.value=k.state.rectAreaLTC1,It.ltc_2.value=k.state.rectAreaLTC2,It.pointLights.value=k.state.point,It.pointLightShadows.value=k.state.pointShadow,It.hemisphereLights.value=k.state.hemi,It.directionalShadowMatrix.value=k.state.directionalShadowMatrix,It.spotLightMatrix.value=k.state.spotLightMatrix,It.spotLightMap.value=k.state.spotLightMap,It.pointShadowMatrix.value=k.state.pointShadowMatrix),V.lightProbeGrid=E.state.lightProbeGridArray.length>0,V.currentProgram=te,V.uniformsList=null,te}function _h(b){if(b.uniformsList===null){let F=b.currentProgram.getUniforms();b.uniformsList=Ns.seqWithValue(F.seq,b.uniforms)}return b.uniformsList}function vh(b,F){let G=H.get(b);G.outputColorSpace=F.outputColorSpace,G.batching=F.batching,G.batchingColor=F.batchingColor,G.instancing=F.instancing,G.instancingColor=F.instancingColor,G.instancingMorph=F.instancingMorph,G.skinning=F.skinning,G.morphTargets=F.morphTargets,G.morphNormals=F.morphNormals,G.morphColors=F.morphColors,G.morphTargetsCount=F.morphTargetsCount,G.numClippingPlanes=F.numClippingPlanes,G.numIntersection=F.numClipIntersection,G.vertexAlphas=F.vertexAlphas,G.vertexTangents=F.vertexTangents,G.toneMapping=F.toneMapping}function lf(b,F){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;y.setFromMatrixPosition(F.matrixWorld);for(let G=0,V=b.length;G<V;G++){let k=b[G];if(k.texture!==null&&k.boundingBox.containsPoint(y))return k}return null}function cf(b,F,G,V,k){F.isScene!==!0&&(F=Rt),q.resetTextureUnits();let yt=F.fog,bt=V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial?F.environment:null,vt=$===null?P.outputColorSpace:$.isXRRenderTarget===!0?$.texture.colorSpace:ae.workingColorSpace,wt=V.isMeshStandardMaterial||V.isMeshLambertMaterial&&!V.envMap||V.isMeshPhongMaterial&&!V.envMap,Pt=at.get(V.envMap||bt,wt),Jt=V.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,te=!!G.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),It=!!G.morphAttributes.position,fe=!!G.morphAttributes.normal,Re=!!G.morphAttributes.color,we=In;V.toneMapped&&($===null||$.isXRRenderTarget===!0)&&(we=P.toneMapping);let ge=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,qe=ge!==void 0?ge.length:0,St=H.get(V),cn=E.state.lights;if(rt===!0&&(it===!0||b!==ot)){let ve=b===ot&&V.id===Q;Dt.setState(V,b,ve)}let le=!1;V.version===St.__version?(St.needsLights&&St.lightsStateVersion!==cn.state.version||St.outputColorSpace!==vt||k.isBatchedMesh&&St.batching===!1||!k.isBatchedMesh&&St.batching===!0||k.isBatchedMesh&&St.batchingColor===!0&&k.colorTexture===null||k.isBatchedMesh&&St.batchingColor===!1&&k.colorTexture!==null||k.isInstancedMesh&&St.instancing===!1||!k.isInstancedMesh&&St.instancing===!0||k.isSkinnedMesh&&St.skinning===!1||!k.isSkinnedMesh&&St.skinning===!0||k.isInstancedMesh&&St.instancingColor===!0&&k.instanceColor===null||k.isInstancedMesh&&St.instancingColor===!1&&k.instanceColor!==null||k.isInstancedMesh&&St.instancingMorph===!0&&k.morphTexture===null||k.isInstancedMesh&&St.instancingMorph===!1&&k.morphTexture!==null||St.envMap!==Pt||V.fog===!0&&St.fog!==yt||St.numClippingPlanes!==void 0&&(St.numClippingPlanes!==Dt.numPlanes||St.numIntersection!==Dt.numIntersection)||St.vertexAlphas!==Jt||St.vertexTangents!==te||St.morphTargets!==It||St.morphNormals!==fe||St.morphColors!==Re||St.toneMapping!==we||St.morphTargetsCount!==qe||!!St.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(le=!0):(le=!0,St.__version=V.version);let xn=St.currentProgram;le===!0&&(xn=Zr(V,F,k),U&&V.isNodeMaterial&&U.onUpdateProgram(V,xn,St));let Fn=!1,ci=!1,Qi=!1,xe=xn.getUniforms(),Ce=St.uniforms;if(v.useProgram(xn.program)&&(Fn=!0,ci=!0,Qi=!0),V.id!==Q&&(Q=V.id,ci=!0),St.needsLights){let ve=lf(E.state.lightProbeGridArray,k);St.lightProbeGrid!==ve&&(St.lightProbeGrid=ve,ci=!0)}if(Fn||ot!==b){v.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),xe.setValue(L,"projectionMatrix",b.projectionMatrix),xe.setValue(L,"viewMatrix",b.matrixWorldInverse);let ui=xe.map.cameraPosition;ui!==void 0&&ui.setValue(L,mt.setFromMatrixPosition(b.matrixWorld)),A.logarithmicDepthBuffer&&xe.setValue(L,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&xe.setValue(L,"isOrthographic",b.isOrthographicCamera===!0),ot!==b&&(ot=b,ci=!0,Qi=!0)}if(St.needsLights&&(cn.state.directionalShadowMap.length>0&&xe.setValue(L,"directionalShadowMap",cn.state.directionalShadowMap,q),cn.state.spotShadowMap.length>0&&xe.setValue(L,"spotShadowMap",cn.state.spotShadowMap,q),cn.state.pointShadowMap.length>0&&xe.setValue(L,"pointShadowMap",cn.state.pointShadowMap,q)),k.isSkinnedMesh){xe.setOptional(L,k,"bindMatrix"),xe.setOptional(L,k,"bindMatrixInverse");let ve=k.skeleton;ve&&(ve.boneTexture===null&&ve.computeBoneTexture(),xe.setValue(L,"boneTexture",ve.boneTexture,q))}k.isBatchedMesh&&(xe.setOptional(L,k,"batchingTexture"),xe.setValue(L,"batchingTexture",k._matricesTexture,q),xe.setOptional(L,k,"batchingIdTexture"),xe.setValue(L,"batchingIdTexture",k._indirectTexture,q),xe.setOptional(L,k,"batchingColorTexture"),k._colorsTexture!==null&&xe.setValue(L,"batchingColorTexture",k._colorsTexture,q));let hi=G.morphAttributes;if((hi.position!==void 0||hi.normal!==void 0||hi.color!==void 0)&&N.update(k,G,xn),(ci||St.receiveShadow!==k.receiveShadow)&&(St.receiveShadow=k.receiveShadow,xe.setValue(L,"receiveShadow",k.receiveShadow)),(V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial)&&V.envMap===null&&F.environment!==null&&(Ce.envMapIntensity.value=F.environmentIntensity),Ce.dfgLUT!==void 0&&(Ce.dfgLUT.value=r_()),ci){if(xe.setValue(L,"toneMappingExposure",P.toneMappingExposure),St.needsLights&&hf(Ce,Qi),yt&&V.fog===!0&&Ct.refreshFogUniforms(Ce,yt),Ct.refreshMaterialUniforms(Ce,V,nt,st,E.state.transmissionRenderTarget[b.id]),St.needsLights&&St.lightProbeGrid){let ve=St.lightProbeGrid;Ce.probesSH.value=ve.texture,Ce.probesMin.value.copy(ve.boundingBox.min),Ce.probesMax.value.copy(ve.boundingBox.max),Ce.probesResolution.value.copy(ve.resolution)}Ns.upload(L,_h(St),Ce,q)}if(V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(Ns.upload(L,_h(St),Ce,q),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&xe.setValue(L,"center",k.center),xe.setValue(L,"modelViewMatrix",k.modelViewMatrix),xe.setValue(L,"normalMatrix",k.normalMatrix),xe.setValue(L,"modelMatrix",k.matrixWorld),V.uniformsGroups!==void 0){let ve=V.uniformsGroups;for(let ui=0,ji=ve.length;ui<ji;ui++){let yh=ve[ui];tt.update(yh,xn),tt.bind(yh,xn)}}return xn}function hf(b,F){b.ambientLightColor.needsUpdate=F,b.lightProbe.needsUpdate=F,b.directionalLights.needsUpdate=F,b.directionalLightShadows.needsUpdate=F,b.pointLights.needsUpdate=F,b.pointLightShadows.needsUpdate=F,b.spotLights.needsUpdate=F,b.spotLightShadows.needsUpdate=F,b.rectAreaLights.needsUpdate=F,b.hemisphereLights.needsUpdate=F}function uf(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return z},this.getActiveMipmapLevel=function(){return B},this.getRenderTarget=function(){return $},this.setRenderTargetTextures=function(b,F,G){let V=H.get(b);V.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,V.__autoAllocateDepthBuffer===!1&&(V.__useRenderToTexture=!1),H.get(b.texture).__webglTexture=F,H.get(b.depthTexture).__webglTexture=V.__autoAllocateDepthBuffer?void 0:G,V.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,F){let G=H.get(b);G.__webglFramebuffer=F,G.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(b,F=0,G=0){$=b,z=F,B=G;let V=null,k=!1,yt=!1;if(b){let vt=H.get(b);if(vt.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(L.FRAMEBUFFER,vt.__webglFramebuffer),lt.copy(b.viewport),pt.copy(b.scissor),Zt=b.scissorTest,v.viewport(lt),v.scissor(pt),v.setScissorTest(Zt),Q=-1;return}else if(vt.__webglFramebuffer===void 0)q.setupRenderTarget(b);else if(vt.__hasExternalTextures)q.rebindTextures(b,H.get(b.texture).__webglTexture,H.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Jt=b.depthTexture;if(vt.__boundDepthTexture!==Jt){if(Jt!==null&&H.has(Jt)&&(b.width!==Jt.image.width||b.height!==Jt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(b)}}let wt=b.texture;(wt.isData3DTexture||wt.isDataArrayTexture||wt.isCompressedArrayTexture)&&(yt=!0);let Pt=H.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(Pt[F])?V=Pt[F][G]:V=Pt[F],k=!0):b.samples>0&&q.useMultisampledRTT(b)===!1?V=H.get(b).__webglMultisampledFramebuffer:Array.isArray(Pt)?V=Pt[G]:V=Pt,lt.copy(b.viewport),pt.copy(b.scissor),Zt=b.scissorTest}else lt.copy(Nt).multiplyScalar(nt).floor(),pt.copy(he).multiplyScalar(nt).floor(),Zt=Gt;if(G!==0&&(V=W),v.bindFramebuffer(L.FRAMEBUFFER,V)&&v.drawBuffers(b,V),v.viewport(lt),v.scissor(pt),v.setScissorTest(Zt),k){let vt=H.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+F,vt.__webglTexture,G)}else if(yt){let vt=F;for(let wt=0;wt<b.textures.length;wt++){let Pt=H.get(b.textures[wt]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+wt,Pt.__webglTexture,G,vt)}}else if(b!==null&&G!==0){let vt=H.get(b.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,vt.__webglTexture,G)}Q=-1},this.readRenderTargetPixels=function(b,F,G,V,k,yt,bt,vt=0){if(!(b&&b.isWebGLRenderTarget)){Ut("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let wt=H.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&bt!==void 0&&(wt=wt[bt]),wt){v.bindFramebuffer(L.FRAMEBUFFER,wt);try{let Pt=b.textures[vt],Jt=Pt.format,te=Pt.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+vt),!A.textureFormatReadable(Jt)){Ut("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!A.textureTypeReadable(te)){Ut("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=b.width-V&&G>=0&&G<=b.height-k&&L.readPixels(F,G,V,k,ft.convert(Jt),ft.convert(te),yt)}finally{let Pt=$!==null?H.get($).__webglFramebuffer:null;v.bindFramebuffer(L.FRAMEBUFFER,Pt)}}},this.readRenderTargetPixelsAsync=async function(b,F,G,V,k,yt,bt,vt=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let wt=H.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&bt!==void 0&&(wt=wt[bt]),wt)if(F>=0&&F<=b.width-V&&G>=0&&G<=b.height-k){v.bindFramebuffer(L.FRAMEBUFFER,wt);let Pt=b.textures[vt],Jt=Pt.format,te=Pt.type;if(b.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+vt),!A.textureFormatReadable(Jt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!A.textureTypeReadable(te))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let It=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,It),L.bufferData(L.PIXEL_PACK_BUFFER,yt.byteLength,L.STREAM_READ),L.readPixels(F,G,V,k,ft.convert(Jt),ft.convert(te),0);let fe=$!==null?H.get($).__webglFramebuffer:null;v.bindFramebuffer(L.FRAMEBUFFER,fe);let Re=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await Uu(L,Re,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,It),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,yt),L.deleteBuffer(It),L.deleteSync(Re),yt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,F=null,G=0){let V=Math.pow(2,-G),k=Math.floor(b.image.width*V),yt=Math.floor(b.image.height*V),bt=F!==null?F.x:0,vt=F!==null?F.y:0;q.setTexture2D(b,0),L.copyTexSubImage2D(L.TEXTURE_2D,G,0,0,bt,vt,k,yt),v.unbindTexture()},this.copyTextureToTexture=function(b,F,G=null,V=null,k=0,yt=0){let bt,vt,wt,Pt,Jt,te,It,fe,Re,we=b.isCompressedTexture?b.mipmaps[yt]:b.image;if(G!==null)bt=G.max.x-G.min.x,vt=G.max.y-G.min.y,wt=G.isBox3?G.max.z-G.min.z:1,Pt=G.min.x,Jt=G.min.y,te=G.isBox3?G.min.z:0;else{let Ce=Math.pow(2,-k);bt=Math.floor(we.width*Ce),vt=Math.floor(we.height*Ce),b.isDataArrayTexture?wt=we.depth:b.isData3DTexture?wt=Math.floor(we.depth*Ce):wt=1,Pt=0,Jt=0,te=0}V!==null?(It=V.x,fe=V.y,Re=V.z):(It=0,fe=0,Re=0);let ge=ft.convert(F.format),qe=ft.convert(F.type),St;F.isData3DTexture?(q.setTexture3D(F,0),St=L.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(q.setTexture2DArray(F,0),St=L.TEXTURE_2D_ARRAY):(q.setTexture2D(F,0),St=L.TEXTURE_2D),v.activeTexture(L.TEXTURE0),v.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,F.flipY),v.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),v.pixelStorei(L.UNPACK_ALIGNMENT,F.unpackAlignment);let cn=v.getParameter(L.UNPACK_ROW_LENGTH),le=v.getParameter(L.UNPACK_IMAGE_HEIGHT),xn=v.getParameter(L.UNPACK_SKIP_PIXELS),Fn=v.getParameter(L.UNPACK_SKIP_ROWS),ci=v.getParameter(L.UNPACK_SKIP_IMAGES);v.pixelStorei(L.UNPACK_ROW_LENGTH,we.width),v.pixelStorei(L.UNPACK_IMAGE_HEIGHT,we.height),v.pixelStorei(L.UNPACK_SKIP_PIXELS,Pt),v.pixelStorei(L.UNPACK_SKIP_ROWS,Jt),v.pixelStorei(L.UNPACK_SKIP_IMAGES,te);let Qi=b.isDataArrayTexture||b.isData3DTexture,xe=F.isDataArrayTexture||F.isData3DTexture;if(b.isDepthTexture){let Ce=H.get(b),hi=H.get(F),ve=H.get(Ce.__renderTarget),ui=H.get(hi.__renderTarget);v.bindFramebuffer(L.READ_FRAMEBUFFER,ve.__webglFramebuffer),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,ui.__webglFramebuffer);for(let ji=0;ji<wt;ji++)Qi&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(b).__webglTexture,k,te+ji),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,H.get(F).__webglTexture,yt,Re+ji)),L.blitFramebuffer(Pt,Jt,bt,vt,It,fe,bt,vt,L.DEPTH_BUFFER_BIT,L.NEAREST);v.bindFramebuffer(L.READ_FRAMEBUFFER,null),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(k!==0||b.isRenderTargetTexture||H.has(b)){let Ce=H.get(b),hi=H.get(F);v.bindFramebuffer(L.READ_FRAMEBUFFER,X),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,D);for(let ve=0;ve<wt;ve++)Qi?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Ce.__webglTexture,k,te+ve):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Ce.__webglTexture,k),xe?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,hi.__webglTexture,yt,Re+ve):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,hi.__webglTexture,yt),k!==0?L.blitFramebuffer(Pt,Jt,bt,vt,It,fe,bt,vt,L.COLOR_BUFFER_BIT,L.NEAREST):xe?L.copyTexSubImage3D(St,yt,It,fe,Re+ve,Pt,Jt,bt,vt):L.copyTexSubImage2D(St,yt,It,fe,Pt,Jt,bt,vt);v.bindFramebuffer(L.READ_FRAMEBUFFER,null),v.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else xe?b.isDataTexture||b.isData3DTexture?L.texSubImage3D(St,yt,It,fe,Re,bt,vt,wt,ge,qe,we.data):F.isCompressedArrayTexture?L.compressedTexSubImage3D(St,yt,It,fe,Re,bt,vt,wt,ge,we.data):L.texSubImage3D(St,yt,It,fe,Re,bt,vt,wt,ge,qe,we):b.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,yt,It,fe,bt,vt,ge,qe,we.data):b.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,yt,It,fe,we.width,we.height,ge,we.data):L.texSubImage2D(L.TEXTURE_2D,yt,It,fe,bt,vt,ge,qe,we);v.pixelStorei(L.UNPACK_ROW_LENGTH,cn),v.pixelStorei(L.UNPACK_IMAGE_HEIGHT,le),v.pixelStorei(L.UNPACK_SKIP_PIXELS,xn),v.pixelStorei(L.UNPACK_SKIP_ROWS,Fn),v.pixelStorei(L.UNPACK_SKIP_IMAGES,ci),yt===0&&F.generateMipmaps&&L.generateMipmap(St),v.unbindTexture()},this.initRenderTarget=function(b){H.get(b).__webglFramebuffer===void 0&&q.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?q.setTextureCube(b,0):b.isData3DTexture?q.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?q.setTexture2DArray(b,0):q.setTexture2D(b,0),v.unbindTexture()},this.resetState=function(){z=0,B=0,$=null,v.reset(),Mt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=ae._getDrawingBufferColorSpace(t),e.unpackColorSpace=ae._getUnpackColorSpace()}};var Ji=(i,t,e)=>i<t?t:i>e?e:i,oe=i=>i<0?0:i>1?1:i,Wt=(i,t,e)=>i+(t-i)*e;var bn=(i,t,e)=>{let n=oe((e-i)/(t-i));return n*n*(3-2*n)};var on=(i,t,e,n)=>Wt(i,t,1-Math.exp(-e*n)),nh=i=>1-Math.pow(1-i,3),En=i=>i<.5?4*i*i*i:1-Math.pow(-2*i+2,3)/2,Md=i=>1+2.70158*Math.pow(i-1,3)+1.70158*Math.pow(i-1,2);function De(i=1234){let t=i>>>0;return function(){return t^=t<<13,t>>>=0,t^=t>>17,t^=t<<5,t>>>=0,t/4294967296}}var li=new Uint8Array(512);{let i=De(20260819),t=new Uint8Array(256);for(let e=0;e<256;e++)t[e]=e;for(let e=255;e>0;e--){let n=i()*(e+1)|0,s=t[e];t[e]=t[n],t[n]=s}for(let e=0;e<512;e++)li[e]=t[e&255]}var yd=i=>i*i*i*(i*(i*6-15)+10),cl=(i,t,e)=>{switch(i&7){case 0:return t+e;case 1:return t-e;case 2:return-t+e;case 3:return-t-e;case 4:return t;case 5:return-t;case 6:return e;default:return-e}};function Sd(i,t){let e=Math.floor(i)&255,n=Math.floor(t)&255,s=i-Math.floor(i),r=t-Math.floor(t),a=yd(s),o=yd(r),l=li[li[e]+n],c=li[li[e]+n+1],h=li[li[e+1]+n],d=li[li[e+1]+n+1],u=Wt(cl(l,s,r),cl(h,s-1,r),a),f=Wt(cl(c,s,r-1),cl(d,s-1,r-1),a);return Wt(u,f,o)}function Ki(i,t,e){let n=(i%e+e)%e,s=(t%e+e)%e;return Sd(n,s)}function gn(i,t,e=4,n=2,s=.5){let r=.5,a=1,o=0,l=0;for(let c=0;c<e;c++)o+=r*Sd(i*a,t*a),l+=r,r*=s,a*=n;return o/l}function en(i,t){let e=document.createElement("canvas");return e.width=i,e.height=t,e}function nn(i,{repeat:t=1,srgb:e=!0,aniso:n=4}={}){let s=new Wi(i);return s.wrapS=s.wrapT=vi,s.repeat.set(t,t),s.anisotropy=n,e&&(s.colorSpace=Ne),s.needsUpdate=!0,s}function hl(i=512){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=De(9911),a=16;for(let l=0;l<i;l++)for(let c=0;c<i;c++){let h=c/i*a,d=l/i*a,u=0,f=.5,g=1;for(let m=0;m<4;m++)u+=f*Ki(h*g,d*g,a*g),f*=.55,g*=2.1;let _=Ki(h*.35,d*.35,a*.35)*.7+Ki(h*.8,d*.8,a*.8)*.3,p=(l*i+c)*4;s[p]=oe(u*.9+.5)*255,s[p+1]=oe(_*.8+.5)*255,s[p+2]=0,s[p+3]=255}let o=Math.floor(i*i*.0016);for(let l=0;l<o;l++){let c=r()*i|0,h=r()*i|0,d=(h*i+c)*4;s[d+2]=200+r()*55;let u=(h*i+(c+1)%i)*4;s[u+2]=Math.max(s[u+2],90)}return e.putImageData(n,0,0),nn(t,{srgb:!1,repeat:1})}function bd(i=512){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=10;for(let o=0;o<i;o++)for(let l=0;l<i;l++){let c=l/i*r,h=o/i*r,d=0,u=.5,f=1;for(let y=0;y<5;y++)d+=u*Ki(c*f,h*f,r*f),u*=.55,f*=2;let g=Math.abs(Ki(c*3.1,h*3.1,r*3.1)),_=oe(d*.8+.5),p=Wt(66,152,_)+g*26,m=Wt(48,112,_)+g*19,M=Wt(35,80,_)+g*13,S=(o*i+l)*4;s[S]=p,s[S+1]=m,s[S+2]=M,s[S+3]=255}e.putImageData(n,0,0);let a=De(4242);for(let o=0;o<i*.9;o++){let l=a()*i,c=a()*i,h=1+a()*3.2,d=70+a()*60;e.fillStyle=`rgba(${d},${d*.94},${d*.86},${.35+a()*.4})`,e.beginPath(),e.ellipse(l,c,h,h*(.6+a()*.5),a()*6.28,0,6.28),e.fill()}for(let o=0;o<i*.18;o++){let l=a()*i,c=a()*i,h=a()*6.28,d=5+a()*22;e.strokeStyle=`rgba(${120+a()*50},${100+a()*40},${60+a()*30},${.2+a()*.35})`,e.lineWidth=.7+a()*1.1,e.beginPath(),e.moveTo(l,c),e.lineTo(l+Math.cos(h)*d,c+Math.sin(h)*d),e.stroke()}return nn(t,{repeat:1})}function Ed(i=256){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data,r=10;for(let a=0;a<i;a++)for(let o=0;o<i;o++){let l=o/i*r,c=a/i*r,h=0,d=.5,u=1;for(let _=0;_<4;_++)h+=d*Ki(l*u,c*u,r*u),d*=.5,u*=2.3;let f=oe(h+.5)*255,g=(a*i+o)*4;s[g]=s[g+1]=s[g+2]=f,s[g+3]=255}return e.putImageData(n,0,0),nn(t,{srgb:!1})}function Td(i=256,t=512){let e=en(i,t),n=e.getContext("2d"),s=De(777),r=n.createLinearGradient(0,0,0,t);r.addColorStop(0,"#6f9138"),r.addColorStop(.04,"#d4641a"),r.addColorStop(.11,"#fb7207"),r.addColorStop(.4,"#ff8b06"),r.addColorStop(.72,"#fd7a0a"),r.addColorStop(.92,"#f4801d"),r.addColorStop(1,"#ea8b33"),n.fillStyle=r,n.fillRect(0,0,i,t);let a=n.createLinearGradient(0,0,i,0);a.addColorStop(0,"rgba(96,42,8,0.34)"),a.addColorStop(.22,"rgba(255,230,196,0.18)"),a.addColorStop(.5,"rgba(126,58,12,0.07)"),a.addColorStop(.78,"rgba(255,230,196,0.16)"),a.addColorStop(1,"rgba(96,42,8,0.34)"),n.fillStyle=a,n.fillRect(0,0,i,t),n.globalAlpha=.1;for(let o=0;o<i*1.6;o++){let l=s()*i;n.strokeStyle=s()>.5?"#ffd9a0":"#b4560c",n.lineWidth=.6+s()*1,n.beginPath(),n.moveTo(l,s()*t*.2),n.lineTo(l+(s()-.5)*8,t),n.stroke()}n.globalAlpha=1;for(let o=t*.045;o<t;){let l=.1+s()*.16;n.strokeStyle=`rgba(150,70,12,${l})`,n.lineWidth=.8+s()*1.4,n.beginPath();for(let c=0;c<=i;c+=8){let h=o+Math.sin(c/i*Math.PI*2+o)*1.6;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke(),n.strokeStyle=`rgba(255,214,160,${l*.55})`,n.beginPath();for(let c=0;c<=i;c+=8){let h=o+1.8+Math.sin(c/i*Math.PI*2+o)*1.6;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke(),o+=9+s()*12*(1-o/t)+3}for(let o=0;o<220;o++){let l=s()*i,c=t*.06+s()*t*.9,h=.9+s()*1.8;n.fillStyle=`rgba(140,66,12,${.25+s()*.4})`,n.beginPath(),n.ellipse(l,c,h*1.5,h*.7,0,0,6.28),n.fill()}n.strokeStyle="rgba(160,90,30,0.35)";for(let o=0;o<40;o++){let l=s()*i,c=t*(.55+s()*.45);n.lineWidth=.6,n.beginPath(),n.moveTo(l,c),n.lineTo(l+(s()-.5)*14,c+3+s()*8),n.stroke()}return nn(e,{repeat:1})}function wd(i=256,t=512){let e=en(i,t),n=e.getContext("2d"),s=De(31337);n.clearRect(0,0,i,t);for(let r=0;r<260;r++){let a=Math.pow(s(),.6)*t,o=s()*i,l=.25+.75*(a/t),c=(6+s()*34)*l,h=n.createRadialGradient(o,a,0,o,a,c),d=(.1+s()*.5)*l;h.addColorStop(0,`rgba(74,52,33,${d})`),h.addColorStop(.6,`rgba(62,43,28,${d*.6})`),h.addColorStop(1,"rgba(60,42,27,0)"),n.fillStyle=h,n.beginPath(),n.ellipse(o,a,c,c*(.5+s()*.6),s()*6.28,0,6.28),n.fill()}for(let r=0;r<500;r++){let a=Math.pow(s(),.5)*t,o=s()*i;n.fillStyle=`rgba(${50+s()*40},${36+s()*26},${24+s()*18},${.3+s()*.5})`,n.beginPath(),n.arc(o,a,.6+s()*2.2,0,6.28),n.fill()}return nn(e,{repeat:1})}function ul(i=256,t=5){let e=i,n=i*2,s=en(e,n),r=s.getContext("2d"),a=De(t*7919+13);r.clearRect(0,0,e,n);let o=e*.5,l=n*.06,c=f=>{let g=Wt(38,122,f),_=Wt(84,190,f),p=Wt(26,78,f);return`rgb(${g|0},${_|0},${p|0})`};function h(f,g,_,p,m,M){r.save(),r.translate(f,g),r.rotate(p),r.fillStyle=c(M),r.beginPath(),r.moveTo(0,0),r.bezierCurveTo(m,-_*.28,m*.75,-_*.78,0,-_),r.bezierCurveTo(-m*.75,-_*.78,-m,-_*.28,0,0),r.fill(),r.strokeStyle=c(M*.5),r.lineWidth=.9,r.beginPath(),r.moveTo(0,0),r.lineTo(0,-_*.9),r.stroke(),r.restore()}function d(f,g,_,p,m){let S=f+_*p*.8,y=g-p*.72;r.strokeStyle=c(m*.75),r.lineWidth=2.1,r.beginPath(),r.moveTo(f,g),r.quadraticCurveTo(f+_*p*.5,g-p*.34,S,y),r.stroke();for(let w=1;w<=8;w++){let E=w/8,R=Wt(f,S,E)+_*Math.sin(E*2.4)*3,x=Wt(g,y,E),T=p*(.56-.26*E)+6,P=m*(.88+a()*.24);h(R,x,T,_*(1.05-E*.42)+(a()-.5)*.22,T*.34,P),h(R,x,T*.86,-_*(.3+E*.36)+(a()-.5)*.2,T*.3,P*.86),h(R,x,T*.7,_*(.15+E*.2),T*.26,P*1.04)}}r.lineCap="round",r.strokeStyle=c(.5),r.lineWidth=5.4,r.beginPath(),r.moveTo(o,n),r.quadraticCurveTo(o+(a()-.5)*16,n*.5,o,l),r.stroke(),r.strokeStyle=c(.82),r.lineWidth=1.8,r.beginPath(),r.moveTo(o-1.1,n),r.quadraticCurveTo(o+(a()-.5)*14,n*.5,o-1.1,l),r.stroke();let u=8;for(let f=0;f<u;f++){let g=f/(u-1),_=Wt(n*.8,l+16,g),p=Wt(e*.5,e*.24,g)*(.9+a()*.24),m=.4+g*.42+a()*.12;d(o,_,1,p,m),d(o,_-p*.07,-1,p*(.92+a()*.16),m*.95)}return d(o,l+8,1,e*.2,.92),d(o,l+8,-1,e*.2,.9),nn(s,{repeat:1})}function Ad(i=512,t={}){let{planks:e=5,base:n=[150,116,78],vertical:s=!1}=t,r=en(i,i),a=r.getContext("2d"),o=De(1717);a.fillStyle=`rgb(${n[0]},${n[1]},${n[2]})`,a.fillRect(0,0,i,i);let l=a.getImageData(0,0,i,i),c=l.data;for(let h=0;h<i;h++)for(let d=0;d<i;d++){let u=s?h/i:d/i,f=s?d/i:h/i,g=gn(u*26,f*2.2,4)*.5+gn(u*90,f*5,2)*.25,_=Math.sin((f*7+g*5)*Math.PI*2)*.5+.5,p=.72+g*.45+_*.14,m=(h*i+d)*4;c[m]=oe(c[m]*p/255)*255,c[m+1]=oe(c[m+1]*p/255)*255,c[m+2]=oe(c[m+2]*p/255)*255}a.putImageData(l,0,0),a.globalAlpha=1;for(let h=1;h<e;h++){let d=h/e*i;a.fillStyle="rgba(40,26,14,0.55)",s?a.fillRect(d-1.5,0,3,i):a.fillRect(0,d-1.5,i,3),a.fillStyle="rgba(255,240,215,0.10)",s?a.fillRect(d+1.5,0,2,i):a.fillRect(0,d+1.5,i,2)}for(let h=0;h<24;h++){let d=o()*i,u=o()*i;a.fillStyle="rgba(60,48,38,0.5)",a.beginPath(),a.arc(d,u,2.2,0,6.28),a.fill(),a.fillStyle="rgba(220,210,195,0.25)",a.beginPath(),a.arc(d-.6,u-.6,1.1,0,6.28),a.fill()}return nn(r,{repeat:1})}function Rd(i=512,t=512){let e=en(i,t),n=e.getContext("2d"),s=n.createLinearGradient(0,0,0,t);s.addColorStop(0,"#3f7fc4"),s.addColorStop(.28,"#78a9dc"),s.addColorStop(.52,"#b9d3ec"),s.addColorStop(.7,"#e2ecf5"),s.addColorStop(.84,"#f4f2ee"),s.addColorStop(1,"#eceae4"),n.fillStyle=s,n.fillRect(0,0,i,t);let r=n.getImageData(0,0,i,t),a=r.data;for(let o=0;o<t;o++){let l=bn(.05,.35,o/t)*(1-bn(.6,.95,o/t));for(let c=0;c<i;c++){let h=gn(c/i*7,o/t*13,5),d=oe((h*.5+.5-.42)*2.6)*l,u=(o*i+c)*4;a[u]=Wt(a[u],252,d*.75),a[u+1]=Wt(a[u+1],250,d*.75),a[u+2]=Wt(a[u+2],246,d*.7)}}return n.putImageData(r,0,0),nn(e,{repeat:1})}function Cd(i=64){let t=en(i,i),e=t.getContext("2d"),n=e.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);return n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.35,"rgba(255,255,255,0.75)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,i,i),nn(t,{repeat:1})}function ih(i=64,t=[255,255,255]){let e=en(i,i),n=e.getContext("2d"),s=n.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2);return s.addColorStop(0,`rgba(${t[0]},${t[1]},${t[2]},1)`),s.addColorStop(.5,`rgba(${t[0]},${t[1]},${t[2]},0.45)`),s.addColorStop(1,`rgba(${t[0]},${t[1]},${t[2]},0)`),n.fillStyle=s,n.fillRect(0,0,i,i),nn(e,{repeat:1})}function dl(i=128){let t=en(i,i),e=t.getContext("2d"),n=i/2,s=e.createRadialGradient(n,n,0,n,n,n*.34);s.addColorStop(0,"rgba(255,255,255,1)"),s.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=s,e.fillRect(0,0,i,i),e.strokeStyle="rgba(255,255,255,0.9)",e.lineCap="round";for(let r=0;r<4;r++){let a=r/4*Math.PI,o=r%2===0?n*.92:n*.5,l=e.createLinearGradient(n-Math.cos(a)*o,n-Math.sin(a)*o,n+Math.cos(a)*o,n+Math.sin(a)*o);l.addColorStop(0,"rgba(255,255,255,0)"),l.addColorStop(.5,"rgba(255,255,255,0.95)"),l.addColorStop(1,"rgba(255,255,255,0)"),e.strokeStyle=l,e.lineWidth=r%2===0?3.5:2,e.beginPath(),e.moveTo(n-Math.cos(a)*o,n-Math.sin(a)*o),e.lineTo(n+Math.cos(a)*o,n+Math.sin(a)*o),e.stroke()}return nn(t,{repeat:1})}function Pd(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/256;e.translate(i*.46,i*.3),e.scale(n*.92,n*.92),e.lineJoin="round",e.lineCap="round";let s=new Path2D;s.moveTo(-16,-66),s.quadraticCurveTo(-16,-82,-2,-82),s.quadraticCurveTo(12,-82,12,-66),s.lineTo(12,-18),s.quadraticCurveTo(20,-26,28,-22),s.quadraticCurveTo(34,-19,33,-8),s.quadraticCurveTo(41,-12,47,-6),s.quadraticCurveTo(51,-2,49,8),s.quadraticCurveTo(56,4,60,12),s.quadraticCurveTo(63,19,58,30),s.quadraticCurveTo(48,62,20,70),s.quadraticCurveTo(-10,77,-32,58),s.quadraticCurveTo(-48,42,-58,18),s.quadraticCurveTo(-64,5,-54,-2),s.quadraticCurveTo(-44,-8,-34,6),s.lineTo(-16,26),s.closePath(),e.shadowColor="rgba(22,46,80,0.42)",e.shadowBlur=16,e.shadowOffsetY=6,e.fillStyle="rgba(255,255,255,0.97)",e.fill(s),e.shadowColor="transparent",e.strokeStyle="rgba(58,96,142,0.9)",e.lineWidth=6,e.stroke(s),e.strokeStyle="rgba(58,96,142,0.55)",e.lineWidth=3.4;for(let[r,a]of[[24,-14],[40,2],[50,18]])e.beginPath(),e.moveTo(r,a),e.quadraticCurveTo(r-12,a+6,r-20,a+4),e.stroke();return nn(t,{repeat:1})}function Id(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/256;e.translate(i/2,i/2),e.scale(n,n);let s=new Path2D;return s.moveTo(0,-92),s.lineTo(66,-14),s.lineTo(28,-14),s.lineTo(28,88),s.lineTo(-28,88),s.lineTo(-28,-14),s.lineTo(-66,-14),s.closePath(),e.shadowColor="rgba(20,40,70,0.4)",e.shadowBlur=16,e.fillStyle="rgba(255,255,255,0.96)",e.fill(s),e.shadowColor="transparent",e.strokeStyle="rgba(70,120,180,0.9)",e.lineWidth=6,e.lineJoin="round",e.stroke(s),nn(t,{repeat:1})}function Ld(i=256){let t=en(i,i),e=t.getContext("2d"),n=i/2,s=e.createRadialGradient(n,n,n*.3,n,n,n*.5);return s.addColorStop(0,"rgba(255,255,255,0)"),s.addColorStop(.55,"rgba(255,246,225,0.85)"),s.addColorStop(.8,"rgba(255,214,150,0.55)"),s.addColorStop(1,"rgba(255,200,120,0)"),e.fillStyle=s,e.fillRect(0,0,i,i),nn(t,{repeat:1})}function Dd(i=128){let t=en(i,i),e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data;for(let r=0;r<i;r++)for(let a=0;a<i;a++){let l=.55+gn(a/i*4,r/i*30,4)*.6,c=(r*i+a)*4;s[c]=92*l,s[c+1]=78*l,s[c+2]=68*l,s[c+3]=255}return e.putImageData(n,0,0),nn(t,{repeat:1})}var Ge=2.2,We=3,Bs=.34,Ae=132,He=180,Nd=112,Ud=152,Fs=-Ge/2,Os=-We/2,a_=.006,Ci=.05;function Dn(i,t){return .048*Math.cos(i*12.566)+.014*Math.sin(t*1.9+.7)+.01*Math.sin(t*4.7+i*2.6+2.1)+.006*Math.sin(t*9.7-i*6.3+.4)+.003*Math.sin(t*19+i*17)}var sh=2*Math.PI/12.566;function rh(i,t,e=1){let n=.5-.5*Math.cos(i*12.566),s=.5+e*n*.17+e*gn(i*1.1,t*1.1,4)*.1+e*gn(i*3.7,t*3.7,3)*.045;return Bs*oe(s)}var o_=`
float soilH(vec2 p){
  return 0.048 * cos(p.x * 12.566)
       + 0.014 * sin(p.y * 1.9 + 0.7)
       + 0.010 * sin(p.y * 4.7 + p.x * 2.6 + 2.1)
       + 0.006 * sin(p.y * 9.7 - p.x * 6.3 + 0.4)
       + 0.003 * sin(p.y * 19.0 + p.x * 17.0);
}
`;function Fd(i,t){return Math.max(Math.max(Math.abs(i)-Ge/2,0),Math.max(Math.abs(t)-We/2,0))*.6}var fl=class{constructor(t){this.data=new Uint8Array(Ae*He*4),this.snow=new Float32Array(Ae*He),this.loose=new Float32Array(Ae*He),this.scuff=new Float32Array(Ae*He),this.dirty=!0,this.removedSinceLast=0,this.tex=new Hi(this.data,Ae,He,an),this.tex.magFilter=Ie,this.tex.minFilter=Ie,this.tex.wrapS=this.tex.wrapT=yn,this.tex.needsUpdate=!0;let e=t.capabilities.getMaxAnisotropy();this.grain=hl(512),this.grain.anisotropy=Math.min(8,e),this.soilMap=bd(512),this.soilMap.anisotropy=Math.min(8,e),this.soilBump=Ed(256),this.uniforms={uField:{value:this.tex},uOrigin:{value:new et(Fs,Os)},uSize:{value:new et(Ge,We)},uMaxSnow:{value:Bs},uGrain:{value:this.grain},uCut:{value:a_},uTime:{value:0}},this.reset(!0),this.group=new Me,this.buildSoil(),this.buildSnow()}computeTarget(t=[]){this.targetSnow||(this.targetSnow=new Float32Array(Ae*He));for(let e=0;e<He;e++)for(let n=0;n<Ae;n++){let s=e*Ae+n,r=Fs+(n+.5)/Ae*Ge,a=Os+(e+.5)/He*We,o=rh(r,a)/Bs;for(let l of t){let c=Math.hypot(r-l.x,a-l.z);o+=.045*Math.exp(-(c*c)/(2*.15*.15));let h=Math.round(c/l.bin);if(h<l.prof.length){let u=(l.baseY+l.prof[h]+l.margin-Dn(r,a))/Bs;u>o&&(o=u)}}this.targetSnow[s]=oe(o)}}reset(t=!1,e=[]){this.computeTarget(e),this.snow.set(this.targetSnow),this.loose.fill(0),this.scuff.fill(0),this.regrowing=!1,this.dirty=!0,this.sync()}startRegrow(t=[]){this.computeTarget(t),this.regrowing=!0}sync(){let t=this.data;for(let e=0,n=0;e<Ae*He;e++,n+=4)t[n]=this.snow[e]*255,t[n+1]=this.loose[e]*255,t[n+2]=this.scuff[e]*255,t[n+3]=255;this.tex.needsUpdate=!0,this.dirty=!1}worldToTexel(t,e){return[(t-Fs)/Ge*Ae-.5,(e-Os)/We*He-.5]}brush(t,e,n,s){let[r,a]=this.worldToTexel(t,e),o=n/Ge*Ae,l=n/We*He,c=Math.max(0,Math.floor(r-o*1.8)),h=Math.min(Ae-1,Math.ceil(r+o*1.8)),d=Math.max(0,Math.floor(a-l*1.8)),u=Math.min(He-1,Math.ceil(a+l*1.8)),f=0,g=[];for(let _=d;_<=u;_++)for(let p=c;p<=h;p++){let m=(p-r)/o,M=(_-a)/l,S=Math.sqrt(m*m+M*M),y=_*Ae+p;if(S<1){let w=Math.pow(Math.cos(S*Math.PI*.5),.85),E=Math.min(this.snow[y],s*w);E>0&&(this.snow[y]-=E,f+=E),this.scuff[y]=Math.min(1,this.scuff[y]+s*w*2.2)}else S<1.75&&g.push(y)}if(f>0&&g.length){let _=f*.3/g.length;for(let p of g)this.snow[p]=Math.min(1.25,this.snow[p]+_)}return f>0&&(this.dirty=!0,this.removedSinceLast+=f),f}scrub(t,e,n,s){let[r,a]=this.worldToTexel(t,e),o=n/Ge*Ae,l=n/We*He,c=Math.max(0,Math.floor(r-o)),h=Math.min(Ae-1,Math.ceil(r+o)),d=Math.max(0,Math.floor(a-l)),u=Math.min(He-1,Math.ceil(a+l));for(let f=d;f<=u;f++)for(let g=c;g<=h;g++){let _=(g-r)/o,p=(f-a)/l,m=_*_+p*p;if(m<1){let M=f*Ae+g,S=1-m;this.loose[M]=Math.min(1,this.loose[M]+s*S*3)}}this.dirty=!0}snowAround(t,e,n){let[s,r]=this.worldToTexel(t,e),a=n/Ge*Ae,o=n/We*He,l=Math.max(0,Math.floor(s-a)),c=Math.min(Ae-1,Math.ceil(s+a)),h=Math.max(0,Math.floor(r-o)),d=Math.min(He-1,Math.ceil(r+o)),u=0,f=0;for(let g=h;g<=d;g++)for(let _=l;_<=c;_++){let p=(_-s)/a,m=(g-r)/o;p*p+m*m<1&&(u+=this.snow[g*Ae+_],f++)}return f?u/f*Bs:0}snowAt(t,e){let[n,s]=this.worldToTexel(t,e),r=Ji(Math.round(n),0,Ae-1),a=Ji(Math.round(s),0,He-1);return this.snow[a*Ae+r]*Bs}surfaceY(t,e){return Dn(t,e)+this.snowAt(t,e)}inside(t,e){return t>Fs&&t<Fs+Ge&&e>Os&&e<Os+We}buildSoil(){let t=new Wn(Ge+Ci*2,We+Ci*2,(Nd>>1)+2,(Ud>>1)+2);t.rotateX(-Math.PI/2);let e=t.attributes.position;for(let o=0;o<e.count;o++){let l=e.getX(o),c=e.getZ(o);e.setY(o,Dn(l,c)-Fd(l,c))}t.computeVertexNormals();let n=this.soilMap.clone();n.repeat.set(Ge/.18,We/.18),n.needsUpdate=!0;let s=this.soilBump.clone();s.repeat.copy(n.repeat),s.needsUpdate=!0;let r=new ee({map:n,bumpMap:s,bumpScale:.85,roughness:.94,metalness:0,color:16777215});r.customProgramCacheKey=()=>"bedsoil",r.onBeforeCompile=o=>{Object.assign(o.uniforms,this.uniforms),o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vWPos;`).replace("#include <fog_vertex>",`#include <fog_vertex>
  vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;`),o.fragmentShader=o.fragmentShader.replace("#include <common>",`
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
        `)},this.soilMat=r;let a=new Lt(t,r);a.receiveShadow=!0,a.name="soil",this.soilMesh=a,this.group.add(a),this.buildSkirt(n,s)}buildSkirt(t,e){let r=Fs-Ci,a=Os-Ci,o=Ge+Ci*2,l=We+Ci*2,c=[],h=[],d=[],u=[];for(let _=0;_<=40;_++)u.push([r+_/40*o,a]);for(let _=1;_<=40;_++)u.push([r+o,a+_/40*l]);for(let _=1;_<=40;_++)u.push([r+o-_/40*o,a+l]);for(let _=1;_<=40;_++)u.push([r,a+l-_/40*l]);for(let _=0;_<u.length;_++){let[p,m]=u[_],M=Dn(p,m)-Fd(p,m)+.02;c.push(p,M,m,p,-.42,m);let S=_/40;h.push(S,1,S,0)}for(let _=0;_<u.length-1;_++){let p=_*2,m=p+1,M=p+2,S=p+3;d.push(p,m,M,m,S,M)}let f=new me;f.setAttribute("position",new Yt(c,3)),f.setAttribute("uv",new Yt(h,2)),f.setIndex(d),f.computeVertexNormals();let g=new Lt(f,new ee({map:t,bumpMap:e,bumpScale:.4,color:9407106,roughness:.95,metalness:0,side:Je}));g.name="bedSkirt",this.group.add(g)}buildSnow(){let t=new Wn(Ge+Ci*2,We+Ci*2,Nd+6,Ud+6);t.rotateX(-Math.PI/2);let e=this.grain.clone();e.repeat.set(Ge/.42,We/.42),e.needsUpdate=!0;let n=this.grain.clone();n.repeat.set(Ge/.05,We/.05),n.needsUpdate=!0;let s=new ee({color:16120061,roughness:.6,metalness:0,bumpMap:n,bumpScale:.32});s.customProgramCacheKey=()=>"snowfield",s.onBeforeCompile=a=>{Object.assign(a.uniforms,this.uniforms),a.uniforms.uGrainMap={value:e},a.vertexShader=a.vertexShader.replace("#include <common>",`
          #include <common>
          uniform sampler2D uField;
          uniform vec2 uOrigin;
          uniform vec2 uSize;
          uniform float uMaxSnow;
          varying float vDepth;
          varying vec3 vWPos;
          varying float vScuff;
          varying vec3 vWN;
          ${o_}
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
        `),a.fragmentShader=a.fragmentShader.replace("#include <common>",`
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
        `)},this.snowMat=s;let r=new Lt(t,s);r.receiveShadow=!0,r.frustumCulled=!1,r.name="snow",this.snowMesh=r,this.group.add(r)}update(t){if(this.uniforms.uTime.value+=t,this.regrowing){let e=1-Math.exp(-1.35*t),n=0;for(let s=0;s<this.snow.length;s++){let r=this.targetSnow[s]-this.snow[s];this.snow[s]+=r*e,Math.abs(r)>n&&(n=Math.abs(r)),this.loose[s]*=1-e,this.scuff[s]*=1-e}this.dirty=!0,n<.004&&(this.snow.set(this.targetSnow),this.loose.fill(0),this.scuff.fill(0),this.regrowing=!1)}this.dirty&&this.sync()}};function Xe(i,t){let e=Math.hypot(i,t),n=1-bn(3.4,5,e),s=1-bn(60,130,e),r=gn(i*.045,t*.045,3)*.85+gn(i*.16,t*.16,2)*.15;return Dn(i,t)*n+rh(i,t,n)+r*bn(3.2,18,e)*s-l_(i,t)}var Od=(()=>{let i=[];for(let t=0;t<9;t++){let e=t/8,n=Wt(3.1,1.72,e)+(t%2?.1:-.1),s=Wt(3.4,.98,e);i.push([n,s,Math.atan2(-1.38,-2.42)])}return i})();function l_(i,t){let e=0;for(let n=0;n<Od.length;n++){let s=Od[n],r=i-s[0],a=t-s[1],o=Math.cos(s[2]),l=Math.sin(s[2]),c=(r*o+a*l)/.155,h=(-r*l+a*o)/.085,d=c*c+h*h;d<4&&(e+=.075*Math.exp(-d*1.5))}return e}function Bd(i,t,e,n){let s=Math.max(4,Math.round(i*2/n)),r=Math.max(2,Math.round((t-i)/n)),a=[];for(let d=1;d<=r;d++)a.push(i+(t-i)*d/r);let o=26,l=Math.pow(e/t,1/o),c=t;for(let d=0;d<o;d++)c*=l,a.push(Math.min(c,e));let h=[];for(let d=a.length-1;d>=0;d--)h.push(-a[d]);for(let d=0;d<=s;d++)h.push(-i+2*i*d/s);for(let d of a)h.push(d);return h}function c_(i,t,e){let n=e.w/2,s=e.d/2,r=5.6/Math.max(40,t*.62),a=Bd(n,5,i,r),o=Bd(s,5,i,r),l=[],c=[],h=[],d=[],u=[],f=.02;for(let p=0;p<o.length;p++)for(let m=0;m<a.length;m++){let M=a[m],S=o[p],y=Math.max(Math.abs(M)-n,Math.abs(S)-s),w=y<.075?.015*(1-Math.max(0,y)/.075):0;l.push(M,Xe(M,S)-w,S),c.push(M,S);let E=Xe(M+f,S)-Xe(M-f,S),R=Xe(M,S+f)-Xe(M,S-f),x=1/Math.hypot(E,2*f,R);d.push(-E*x,2*f*x,-R*x),h.push(.97,.99,1)}let g=a.length;for(let p=0;p<o.length-1;p++)for(let m=0;m<a.length-1;m++){if(a[m]>=-n-1e-6&&a[m+1]<=n+1e-6&&o[p]>=-s-1e-6&&o[p+1]<=s+1e-6)continue;let M=p*g+m,S=M+1,y=M+g,w=y+1;u.push(M,y,S,S,y,w)}let _=new me;return _.setAttribute("position",new Yt(l,3)),_.setAttribute("uv",new Yt(c,2)),_.setAttribute("color",new Yt(h,3)),_.setAttribute("normal",new Yt(d,3)),_.setIndex(u),_}function h_(i=256){let t=document.createElement("canvas");t.width=t.height=i;let e=t.getContext("2d"),n=e.createImageData(i,i),s=n.data;for(let a=0;a<i;a++)for(let o=0;o<i;o++){let l=o/i,c=Math.cos(l*Math.PI*2)*.5+.5,h=gn(o/i*5,a/i*5,3)*.5+.5,d=.925+c*.075+h*.03,u=(a*i+o)*4;s[u]=244*d*(.985+c*.02),s[u+1]=248*d,s[u+2]=255*d,s[u+3]=255}e.putImageData(n,0,0);let r=new Wi(t);return r.wrapS=r.wrapT=vi,r.colorSpace=Ne,r}function u_(i,t=2.4){let e=i.clone();return e.repeat.set(t,t),e.needsUpdate=!0,new ee({color:16054268,roughness:.66,metalness:0,bumpMap:e,bumpScale:.9,vertexColors:!1})}var d_=.5;function ah(i){let t=De(i),e=[],n=[],s=[],r=[],a=new Ht(4866104),o=new Ht(15265527);function l(h,d,u,f,g){let _=g>1?5:4,p=h.clone().addScaledVector(d,u),m=Math.abs(d.y)>.9?new C(1,0,0):new C(0,1,0),M=new C().crossVectors(d,m).normalize(),S=new C().crossVectors(d,M).normalize(),y=e.length/3;for(let E=0;E<_;E++){let R=E/_*Math.PI*2,x=Math.cos(R),T=Math.sin(R),P=M.clone().multiplyScalar(x).addScaledVector(S,T).normalize();for(let I=0;I<2;I++){let U=I===0?h:p,W=I===0?f:f*.62;e.push(U.x+P.x*W,U.y+P.y*W,U.z+P.z*W),n.push(P.x,P.y,P.z);let X=oe(P.y*.9+d.y*.35)*(g<=2?.85:.4),D=a.clone().lerp(o,X);s.push(D.r,D.g,D.b)}}for(let E=0;E<_;E++){let R=y+E*2,x=y+E*2+1,T=y+(E+1)%_*2,P=T+1;r.push(R,T,x,x,T,P)}if(g<=0||u<.28)return;let w=g>2?2:2+(t()>.55?1:0);for(let E=0;E<w;E++){let R=d.clone(),x=new C(t()-.5,t()*.2,t()-.5).normalize();R.applyAxisAngle(x,.42+t()*.55).normalize(),R.y=Math.max(R.y,.1),R.normalize(),l(p,R,u*(.58+t()*.22),f*.6,g-1)}}l(new C(0,0,0),new C(0,1,0),2.1+t()*.9,.15+t()*.05,4);let c=new me;return c.setAttribute("position",new Yt(e,3)),c.setAttribute("normal",new Yt(n,3)),c.setAttribute("color",new Yt(s,3)),c.setIndex(r),c.computeBoundingSphere(),c}function f_(i,t){let e=new Me,n=3.8,s=2.35,r=3,a=new ee({map:(()=>{let p=i.clone();return p.repeat.set(2.2,1.6),p.needsUpdate=!0,p})(),color:10259316,roughness:.92,metalness:0}),o=new Lt(new Le(n,s,r),a);o.position.y=s/2,e.add(o);let l=new ee({map:(()=>{let p=i.clone();return p.repeat.set(3,1),p.needsUpdate=!0,p})(),color:7166792,roughness:.95}),c=new ee({color:16185855,roughness:.7,bumpMap:(()=>{let p=t.clone();return p.repeat.set(3,2),p.needsUpdate=!0,p})(),bumpScale:.6}),h=Math.sqrt((r/2)**2+.85**2);for(let p of[-1,1]){let m=new Lt(new Le(n+.35,.09,h),l);m.position.set(0,s+.42,p*r/4),m.rotation.x=p*Math.atan2(.85,r/2),e.add(m);let M=new Lt(new Le(n+.42,.13,h*.99),c);M.position.set(0,s+.52,p*r/4),M.rotation.x=m.rotation.x,e.add(M)}let d=new ws;d.moveTo(-n/2,0),d.lineTo(n/2,0),d.lineTo(0,.85),d.closePath();let u=new Tr(d,{depth:.12,bevelEnabled:!1});for(let p of[-1,1]){let m=new Lt(u,a);m.position.set(0,s,p*(r/2)-(p>0?0:.12)),e.add(m)}let f=new Lt(new Le(.95,1.75,.08),new ee({color:5062448,roughness:.9}));f.position.set(-.6,.88,r/2+.02),e.add(f);let g=new Lt(new Le(.62,.5,.06),new ee({color:2833226,roughness:.25,metalness:.1}));g.position.set(.85,1.45,r/2+.02),e.add(g);let _=new Lt(new tn(n*.62,n*.78,.34,16),c);return _.position.y=.12,_.scale.set(1,1,r/n*1.15),e.add(_),e.traverse(p=>{p.isMesh&&(p.castShadow=!1,p.receiveShadow=!1)}),e}function p_(i,t){let e=new Me,n=.46,s=.32,r=.24,a=.014,o=new ee({map:(()=>{let u=i.clone();return u.repeat.set(1.6,.9),u.needsUpdate=!0,u})(),color:12887937,roughness:.88,metalness:0}),l=new ee({map:(()=>{let u=i.clone();return u.repeat.set(.8,.6),u.needsUpdate=!0,u})(),color:12163958,roughness:.88,metalness:0}),c=(u,f,g,_,p=o)=>{let m=new Lt(u,p);return m.position.set(f,g,_),m.castShadow=!0,m.receiveShadow=!0,e.add(m),m},h=.085;for(let u of[-1,1])for(let f=0;f<2;f++)c(new Le(n,h,a),0,.045+f*.115,u*(s/2-a/2));for(let u of[-1,1])for(let f=0;f<2;f++)c(new Le(a,h,s-a*2),u*(n/2-a/2),.045+f*.115,0);for(let u of[-1,1])for(let f of[-1,1])c(new Le(.03,r,.03),u*(n/2-.015),r/2-.03,f*(s/2-.015),l);for(let u=0;u<3;u++)c(new Le(n-.03,a,s/3-.012),0,.007,(u-1)*(s/3));let d=new ee({color:16251646,roughness:.7,bumpMap:(()=>{let u=t.clone();return u.repeat.set(4,4),u.needsUpdate=!0,u})(),bumpScale:.5});for(let u of[-1,1]){let f=c(new Le(n+.01,.018,a+.012),0,.196,u*(s/2-a/2),d);f.castShadow=!1}for(let u of[-1,1]){let f=c(new Le(a+.012,.018,s-a),u*(n/2-a/2),.196,0,d);f.castShadow=!1}return e.userData.inner={w:n-.06,d:s-.06,floor:.02},e}function m_(i){let t=new Me,e=new ee({map:(()=>{let a=i.clone();return a.repeat.set(3,1),a.needsUpdate=!0,a})(),color:12622442,roughness:.8}),n=new Lt(new Le(.19,.035,.06),e);n.position.y=.035,t.add(n);let s=new Lt(new tn(.014,.016,.16,8),e);s.rotation.z=Math.PI/2,s.position.set(.15,.045,0),t.add(s);let r=new Lt(new Le(.18,.038,.055),new ee({color:10124110,roughness:1}));return r.position.y=0,t.add(r),t.traverse(a=>{a.isMesh&&(a.castShadow=!0)}),t}function g_(i){let t=new Me,e=new ee({color:12173512,roughness:.42,metalness:.65}),n=new Lt(new sn(.1,14,10,0,Math.PI*2,0,Math.PI*.5),e);n.scale.set(1,.55,1.25),n.rotation.x=Math.PI,n.position.y=.055,t.add(n);let s=new Lt(new tn(.015,.017,.34,8),new ee({map:(()=>{let r=i.clone();return r.repeat.set(4,1),r.needsUpdate=!0,r})(),color:13215864,roughness:.82}));return s.rotation.z=Math.PI/2.6,s.position.set(.18,.11,0),t.add(s),t.traverse(r=>{r.isMesh&&(r.castShadow=!0)}),t}function x_(i=480){let t=new me,e=new Float32Array(i*3),n=new Float32Array(i),s=new Float32Array(i),r=De(2468),a=16,o=11;for(let h=0;h<i;h++)e[h*3]=(r()*2-1)*a,e[h*3+1]=r()*o,e[h*3+2]=(r()*2-1)*a,n[h]=r()*100,s[h]=.012+r()*.03;t.setAttribute("position",new Se(e,3)),t.setAttribute("aSeed",new Se(n,1)),t.setAttribute("aSize",new Se(s,1)),t.boundingSphere=new fn(new C,60);let l=new ke({uniforms:{uTime:{value:0},uMap:{value:Cd(64)},uOrigin:{value:new C},uHeight:{value:o},uSpan:{value:a},uIntensity:{value:1},uPixelRatio:{value:1}},vertexShader:`
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
    `,transparent:!0,depthWrite:!1,blending:Cn}),c=new Gi(t,l);return c.frustumCulled=!1,c.renderOrder=5,c}function zd(i,t,e){let n=Math.min(8,t.capabilities.getMaxAnisotropy()),s=hl(e.texBig);s.anisotropy=n;let r=Ad(e.texBig,{planks:5});r.anisotropy=n,i.fog=new or(14674162,.0165),i.background=null;let a=new Lt(new sn(320,24,16),new Gn({map:Rd(512,512),side:Ue,fog:!1,depthWrite:!1}));a.renderOrder=-10,i.add(a);let o=new Pr(12375797,10662596,.74);i.add(o);let l=new Cs(16773590,2.9);l.position.set(-5.6,2.5,4.6),l.target.position.set(0,0,0),i.add(l.target),l.castShadow=!0,l.shadow.mapSize.set(e.shadowMap,e.shadowMap);let c=l.shadow.camera;c.left=-2.6,c.right=2.6,c.top=3.2,c.bottom=-3.2,c.near=.5,c.far=22,l.shadow.bias=-8e-4,l.shadow.normalBias=.018,i.add(l);let h=new Cs(13820671,.3);h.position.set(5,2,-5.5),i.add(h);let d=c_(300,e.groundSeg,{w:Ge,d:We}),u=u_(s,22);u.vertexColors=!0,u.polygonOffset=!0,u.polygonOffsetFactor=-1,u.polygonOffsetUnits=-2;let f=h_(256);f.repeat.set(1/d_,.07),f.anisotropy=n,u.map=f;let g=new Lt(d,u);g.receiveShadow=!0,i.add(g);let _=new Me;for(let[D,z,B,$]of[[150,26,12176352,5],[230,44,13228006,17]]){let ot=[],lt=[],pt=[],Zt=De($);for(let Z=0;Z<=96;Z++){let st=Z/96*Math.PI*2,nt=z*(.35+Math.pow(Math.abs(gn(Math.cos(st)*2.2+$,Math.sin(st)*2.2,4)),.8)*1.9)*(.7+.5*Math.abs(Math.sin(st*3.1+$)));ot.push(Math.cos(st)*D,-2,Math.sin(st)*D),pt.push(.86,.9,.96),ot.push(Math.cos(st)*D,nt,Math.sin(st)*D);let Et=new Ht(B);pt.push(Et.r,Et.g,Et.b)}for(let Z=0;Z<96;Z++){let st=Z*2,nt=st+1,Et=st+2,Vt=st+3;lt.push(st,nt,Et,nt,Vt,Et)}let ie=new me;ie.setAttribute("position",new Yt(ot,3)),ie.setAttribute("color",new Yt(pt,3)),ie.setIndex(lt),ie.computeVertexNormals();let Qt=new Lt(ie,new Gn({vertexColors:!0,side:Je,fog:!0}));_.add(Qt)}i.add(_);let p=[ah(11),ah(23),ah(41)],m=new ee({vertexColors:!0,roughness:.95,metalness:0}),M=new Me,S=De(99),y=[[-12.5,-15.5],[-16,-19],[10.5,-17.5],[15,-13],[-20,-8],[19.5,-21],[-9,-24],[24,-6],[3,-26]];for(let[D,z]of y){let B=new Lt(p[S()*3|0],m),$=.9+S()*.7;B.scale.setScalar($),B.position.set(D,Xe(D,z)-.1,z),B.rotation.y=S()*6.28,M.add(B);let Q=new Lt(new sn(.6*$,10,6,0,Math.PI*2,0,Math.PI*.5),new ee({color:15922940,roughness:.8}));Q.scale.y=.35,Q.position.set(D,Xe(D,z)-.12,z),M.add(Q)}i.add(M);let w=f_(r,s);w.position.set(-8.6,Xe(-8.6,-12.5)-.18,-12.5),w.rotation.y=.42,i.add(w);let E=new Me,R=new ee({map:(()=>{let D=Dd(128);return D.repeat.set(1,2),D})(),color:9075302,roughness:.95}),x=new ee({color:6975351,roughness:.6,metalness:.3});for(let D=0;D<16;D++){let z=-3.4-D*.06,B=-2.6-D*1.85,$=1.05,Q=new Lt(new tn(.045,.055,$,6),R);Q.position.set(z,Xe(z,B)+$/2-.14,B),Q.rotation.z=Math.sin(D*2.1)*.05,E.add(Q);let ot=new Lt(new sn(.055,7,5),new ee({color:16185855,roughness:.7}));if(ot.scale.y=.6,ot.position.set(z,Xe(z,B)+$-.14,B),E.add(ot),D>0){let lt=-3.4-(D-1)*.06,pt=-2.6-(D-1)*1.85;for(let Zt of[.42,.78]){let ie=new C(lt,Xe(lt,pt)+Zt-.14,pt),Qt=new C(z,Xe(z,B)+Zt-.14,B),Z=ie.distanceTo(Qt),st=new Lt(new tn(.008,.008,Z,4),x);st.position.copy(ie).lerp(Qt,.5),st.quaternion.setFromUnitVectors(new C(0,1,0),Qt.clone().sub(ie).normalize()),E.add(st)}}}i.add(E);let T=p_(r,s),P=1.46,I=.72;T.position.set(P,Xe(P,I)-.055,I),T.rotation.y=-.52,i.add(T);let U=m_(r);U.position.set(-1.44,Xe(-1.44,.95)-.02,.95),U.rotation.set(.06,1.1,.02),i.add(U);let W=g_(r);W.position.set(1.72,Xe(1.72,-.35)-.03,-.35),W.rotation.set(0,-.85,.1),i.add(W);let X=x_(e.snowflakes);return i.add(X),{sky:a,sun:l,fill:h,hemi:o,ground:g,crate:T,snowfall:X,grain:s,wood:r,trees:M,shed:w,setSnowfallIntensity(D){X.material.uniforms.uIntensity.value=D},update(D,z,B){let $=X.material.uniforms;$.uTime.value+=D,$.uOrigin.value.copy(z.position),$.uPixelRatio.value=B,a.position.set(z.position.x,0,z.position.z)}}}var zs=.175,__=.0215,Vs=null,oh=null;function Vd(i=4){if(!oh){let t=Td(256,512),e=wd(256,512);t.anisotropy=i,oh={skin:t,dirt:e,leaves:[ul(256,3),ul(256,11),ul(256,29)]}}return oh}function v_(i,t){let e=t*(.04+.96*Math.pow(i,.4));return e*=1-.1*Math.pow(i,3),i>.955&&(e*=Math.sqrt(Math.max(0,1-Math.pow((i-.955)/.045,2)*.82))),Math.max(6e-4,e)}function kd(i=7){let t=De(i),e=46,n=[];for(let l=0;l<e;l++){let c=l/(e-1);n.push(new et(v_(c,__),c*zs))}let s=new Ar(n,20),r=s.attributes.position,a=new C,o=new et(.9,.44).normalize();for(let l=0;l<r.count;l++){a.fromBufferAttribute(r,l);let c=oe(a.y/zs),h=Math.pow(1-c,2.1)*.026,d=Math.atan2(a.z,a.x),u=1+.055*Math.sin(d*3+c*11)*(.35+c)+.03*Math.sin(d*7-c*23)+.022*Math.sin(c*47);a.x*=u,a.z*=u,a.x+=o.x*h,a.z+=o.y*h,r.setXYZ(l,a.x,a.y,a.z)}return s.computeVertexNormals(),s.translate(0,-zs,0),s}function y_(i,t,e,n,s,r,a,o){let c=Math.cos(t),h=Math.sin(t),d=new C,u=new C,f=new C,g=new C,_=new C(0,1,0),p=new C,m=(S,y)=>{let w=e*(1.06*S-.06*S*S*S)*(1-.1*S*S),E=n*(S*S*(.55+.45*S))+.01;return y.set(c*E,w,h*E),y},M=i.position.length/3;for(let S=0;S<=8;S++){let y=S/8;m(y,d),m(Math.max(0,y-.02),u),f.subVectors(d,u).normalize(),f.lengthSq()<1e-6&&f.copy(_),g.set(-h,0,c);let w=r*y,E=f;g.applyAxisAngle(E,w).normalize(),p.crossVectors(f,g).normalize();let R=s*(.62+.5*Math.sin(Math.PI*Math.pow(y,.85)))*.5;for(let x=-1;x<=1;x+=2)i.position.push(d.x+g.x*R*x,d.y+g.y*R*x,d.z+g.z*R*x),i.normal.push(p.x,p.y,p.z),i.uv.push(x<0?0:1,y),i.color.push(a.r,a.g,a.b),i.texid.push(o)}for(let S=0;S<8;S++){let y=M+S*2,w=y+1,E=y+2,R=y+3;i.index.push(y,E,w,w,E,R)}}function M_(i,t,e){let n=De(i),s={position:[],normal:[],uv:[],color:[],index:[],texid:[]};for(let a=0;a<t;a++){let o=a/t*Math.PI*2+n()*.55,l=a%3!==0,c=e*(l?.7+n()*.3:.92+n()*.22),h=l?.085+n()*.085:.024+n()*.045,d=.09+n()*.055,u=(n()-.5)*1.5,f=.82+n()*.36,g=new Ht(f*(.86+n()*.2),f,f*(.72+n()*.2));y_(s,o,c,h,d,u,g,a%3)}let r=new me;return r.setAttribute("position",new Yt(s.position,3)),r.setAttribute("normal",new Yt(s.normal,3)),r.setAttribute("uv",new Yt(s.uv,2)),r.setAttribute("color",new Yt(s.color,3)),r.setIndex(s.index),r.computeBoundingSphere(),r}function Hd(i={}){let{seed:t=1,aniso:e=4,leafHeight:n=.225,fronds:s=14}=i,r=Vd(e);Vs||(Vs=kd());let a=new Me,o=new ee({map:r.skin,roughness:.62,metalness:0});o.userData.uDirt={value:.8},o.customProgramCacheKey=()=>"carrotbody",o.onBeforeCompile=_=>{_.uniforms.uDirtMap={value:r.dirt},_.uniforms.uDirt=o.userData.uDirt,_.fragmentShader=_.fragmentShader.replace("#include <common>",`
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
      `)};let l=new Lt(Vs,o);l.castShadow=!0,l.name="carrotBody",a.add(l);let c=M_(t*131+7,s,n),h=new ee({map:r.leaves[t%r.leaves.length],alphaTest:.3,side:Je,roughness:.8,metalness:0,vertexColors:!0,emissive:new Ht(1915410),emissiveIntensity:1});h.userData.uStretch={value:0},h.userData.uWind={value:0},h.customProgramCacheKey=()=>"carrotleaf",h.onBeforeCompile=_=>{_.uniforms.uStretch=h.userData.uStretch,_.uniforms.uWind=h.userData.uWind,_.vertexShader=_.vertexShader.replace("#include <common>",`#include <common>
uniform float uStretch;
uniform float uWind;`).replace("#include <begin_vertex>",`
        #include <begin_vertex>
        float lt = clamp(transformed.y / 0.24, 0.0, 1.0);
        // gathered and stretched while the child hauls on them
        transformed.xz *= mix(1.0, 0.55, uStretch * lt);
        transformed.y *= 1.0 + uStretch * 0.30 * lt;
        transformed.x += sin(uWind * 1.7 + transformed.z * 9.0) * 0.006 * lt;
        transformed.z += cos(uWind * 1.3 + transformed.x * 8.0) * 0.006 * lt;
      `)};let d=new Lt(c,h);d.castShadow=!0,d.name="carrotLeaves",a.add(d);let u=.03,f=.62,g=[];{let _=[],p=c.attributes.position;for(let M=0;M<p.count;M++){let S=p.getX(M),y=p.getY(M),w=p.getZ(M),E=Math.round(Math.hypot(S,w)/u);for(;_.length<=E;)_.push(0);y>_[E]&&(_[E]=y)}let m=Math.ceil(Math.max(..._)/f/u)+_.length+1;for(let M=0;M<m;M++){let S=0;for(let y=0;y<_.length;y++){let w=_[y]-Math.abs(M-y)*u*f;w>S&&(S=w)}g.push(S)}for(let M=g.length-2;M>=0;M--)g[M]=Math.max(g[M],g[M+1])}return a.userData={body:l,leaves:d,bodyMat:o,leafMat:h,leafProfile:{bin:u,max:g},setDirt:_=>{o.userData.uDirt.value=_},setStretch:_=>{h.userData.uStretch.value=_},setWind:_=>{h.userData.uWind.value=_},leafHeight:n},a}function Gd(i,t){let e=new sn(.1,20,10,0,Math.PI*2,0,Math.PI*.5),n=e.attributes.position,s=new C;for(let c=0;c<n.count;c++){s.fromBufferAttribute(n,c);let h=1+.13*Math.sin(s.x*62)*Math.cos(s.z*55)+.07*Math.sin(s.y*90);s.multiplyScalar(h),s.y*=.55,n.setXYZ(c,s.x,s.y,s.z)}e.computeVertexNormals();let r=i.clone();r.repeat.set(3,3),r.needsUpdate=!0;let a=t.clone();a.repeat.set(3,3),a.needsUpdate=!0;let o=new ee({map:r,bumpMap:a,bumpScale:.4,roughness:.9,metalness:0,color:12169380}),l=new Lt(e,o);return l.castShadow=!0,l.receiveShadow=!0,l.name="soilCap",l}function Wd(i){let t=new tn(.036,.014,.12,20,3,!0);t.translate(0,-.055,0);let e=i.clone();e.repeat.set(2,1),e.needsUpdate=!0;let n=new ee({map:e,color:7035979,side:Ue,roughness:.98,metalness:0}),s=new Lt(t,n);return s.name="hole",s}var Xr=null;function Xd(i=4){if(!Xr){let s=Vd(i);Vs||(Vs=kd()),Xr={bodyMat:new ee({map:s.skin,roughness:.66}),stubGeo:new gr(.012,.05,8),stubMat:new ee({color:6060595,roughness:.8})}}let t=new Me,e=new Lt(Vs,Xr.bodyMat);e.castShadow=!0,t.add(e);let n=new Lt(Xr.stubGeo,Xr.stubMat);return n.position.y=.022,t.add(n),t}var re=De(5150),pl=class{constructor(t,e,n,s){this.max=t,this.count=0,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.life=new Float32Array(t),this.maxLife=new Float32Array(t),this.size=new Float32Array(t),this.alpha=new Float32Array(t),this.col=new Float32Array(t*3),this.spin=new Float32Array(t),this.gravity=s;let r=new me;r.setAttribute("position",new Se(this.pos,3)),r.setAttribute("aSize",new Se(this.size,1)),r.setAttribute("aAlpha",new Se(this.alpha,1)),r.setAttribute("aColor",new Se(this.col,3)),r.setDrawRange(0,0),r.boundingSphere=new fn(new C,30);let a=new ke({uniforms:{uMap:{value:e},uPixelRatio:{value:1}},vertexShader:`
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
      `,transparent:!0,depthWrite:!1,blending:n});this.points=new Gi(r,a),this.points.frustumCulled=!1,this.points.renderOrder=6,this.geo=r}spawn(t,e,n,s,r,a,o,l,c){let h=this.count;h>=this.max?h=this._rr=((this._rr||0)+1)%this.max:this.count++;let d=h*3;this.pos[d]=t,this.pos[d+1]=e,this.pos[d+2]=n,this.vel[d]=s,this.vel[d+1]=r,this.vel[d+2]=a,this.life[h]=l,this.maxLife[h]=l,this.size[h]=o,this.alpha[h]=1,this.col[d]=c[0],this.col[d+1]=c[1],this.col[d+2]=c[2]}update(t){let e=this.count;for(let n=0;n<e;n++){if(this.life[n]<=0){this.alpha[n]=0;continue}this.life[n]-=t;let s=n*3;this.vel[s+1]+=this.gravity*t,this.vel[s]*=1-1.9*t,this.vel[s+2]*=1-1.9*t,this.pos[s]+=this.vel[s]*t,this.pos[s+1]+=this.vel[s+1]*t,this.pos[s+2]+=this.vel[s+2]*t;let r=oe(this.life[n]/this.maxLife[n]);this.alpha[n]=r*r*(3-2*r)}this.geo.setDrawRange(0,e),this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0}},lh=class{constructor(t,e){this.max=t,this.mesh=new fr(new wr(.0075,0),e,t),this.mesh.instanceMatrix.setUsage(Cc),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.rot=new Float32Array(t*3),this.rotV=new Float32Array(t*3),this.life=new Float32Array(t),this.scale=new Float32Array(t),this.head=0,this.m=new ce,this.q=new Mn,this.e=new Pn,this.v=new C,this.s=new C;for(let n=0;n<t;n++)this.m.makeScale(0,0,0),this.mesh.setMatrixAt(n,this.m)}spawn(t,e,n,s,r,a,o,l){let c=this.head=(this.head+1)%this.max,h=c*3;this.pos[h]=t,this.pos[h+1]=e,this.pos[h+2]=n,this.vel[h]=s,this.vel[h+1]=r,this.vel[h+2]=a,this.rot[h]=re()*6.28,this.rot[h+1]=re()*6.28,this.rot[h+2]=re()*6.28,this.rotV[h]=(re()-.5)*14,this.rotV[h+1]=(re()-.5)*14,this.rotV[h+2]=(re()-.5)*14,this.life[c]=l,this.scale[c]=o}update(t,e){let n=!1;for(let s=0;s<this.max;s++){if(this.life[s]<=0)continue;n=!0,this.life[s]-=t;let r=s*3;this.vel[r+1]-=6.2*t,this.pos[r]+=this.vel[r]*t,this.pos[r+1]+=this.vel[r+1]*t,this.pos[r+2]+=this.vel[r+2]*t;let a=e(this.pos[r],this.pos[r+2]);this.pos[r+1]<a&&(this.pos[r+1]=a,this.vel[r+1]*=-.22,this.vel[r]*=.5,this.vel[r+2]*=.5,this.rotV[r]*=.4,this.rotV[r+1]*=.4,this.rotV[r+2]*=.4),this.rot[r]+=this.rotV[r]*t,this.rot[r+1]+=this.rotV[r+1]*t,this.rot[r+2]+=this.rotV[r+2]*t;let o=oe(this.life[s]/.5);this.e.set(this.rot[r],this.rot[r+1],this.rot[r+2]),this.q.setFromEuler(this.e),this.v.set(this.pos[r],this.pos[r+1],this.pos[r+2]);let l=this.scale[s]*o;this.s.set(l,l,l),this.m.compose(this.v,this.q,this.s),this.mesh.setMatrixAt(s,this.m),this.life[s]<=0&&(this.m.makeScale(0,0,0),this.mesh.setMatrixAt(s,this.m))}n&&(this.mesh.instanceMatrix.needsUpdate=!0)}},ml=class{constructor(t,e){this.snow=new pl(320,ih(64),Cn,-3.2),this.sparkle=new pl(140,dl(128),ai,-.35),t.add(this.snow.points),t.add(this.sparkle.points);let n=new ee({map:e,color:9073496,roughness:.96,metalness:0});this.clods=new lh(90,n),t.add(this.clods.mesh);let s=new yi({map:ih(128,[255,226,178]),blending:ai,transparent:!0,depthWrite:!1,depthTest:!1,opacity:0});this.flare=new ki(s),this.flare.scale.setScalar(.6),this.flare.renderOrder=4,this.flare.visible=!1,t.add(this.flare),this.flareT=0}puffSnow(t,e,n,s,r,a){let o=Math.min(9,1+Math.floor(a*90));for(let l=0;l<o;l++){let c=.25+re()*.75;this.snow.spawn(t+(re()-.5)*.09,e+.008+re()*.03,n+(re()-.5)*.09,s*c+(re()-.5)*.4,.32+re()*.75,r*c+(re()-.5)*.4,.01+re()*.024,.45+re()*.5,[1,1,1])}}puffSoil(t,e,n,s,r=1){let a=Math.min(7,1+Math.floor(s*40));for(let o=0;o<a;o++)this.clods.spawn(t+(re()-.5)*.05,e+.01,n+(re()-.5)*.05,(re()-.5)*.9*r,.5+re()*1.3*r,(re()-.5)*.9*r,.5+re()*1.1,.9+re()*.7);for(let o=0;o<a;o++)this.snow.spawn(t+(re()-.5)*.06,e+.01,n+(re()-.5)*.06,(re()-.5)*.5,.25+re()*.5,(re()-.5)*.5,.008+re()*.012,.35+re()*.3,[.42,.33,.24])}burstSparkle(t,e,n,s=26,r=.9){for(let a=0;a<s;a++){let o=re()*6.28,l=re()*1.3,c=(.5+re()*1.5)*r;this.sparkle.spawn(t+(re()-.5)*.05,e+(re()-.5)*.05,n+(re()-.5)*.05,Math.cos(o)*Math.cos(l)*c,Math.sin(l)*c*1.1,Math.sin(o)*Math.cos(l)*c,.011+re()*.021,.5+re()*.5,[1,.95,.86])}}popFlare(t){this.flare.position.copy(t),this.flare.visible=!0,this.flareT=1}update(t,e,n){if(this.snow.update(t),this.sparkle.update(t),this.clods.update(t,e),this.snow.points.material.uniforms.uPixelRatio.value=n,this.sparkle.points.material.uniforms.uPixelRatio.value=n,this.flareT>0){this.flareT=Math.max(0,this.flareT-t*1.5);let s=this.flareT;this.flare.material.opacity=Math.sin(Math.PI*Math.min(1,(1-s)*3.2+s*.1))*.55*s,this.flare.scale.setScalar(.35+(1-s)*.95),this.flareT<=0&&(this.flare.visible=!1)}}};var gl=class{constructor(t){this.camera=t,this.pos=new C(0,2.4,4.2),this.look=new C(0,.2,0),this.fov=t.fov,this.fromPos=this.pos.clone(),this.fromLook=this.look.clone(),this.fromFov=this.fov,this.toPos=this.pos.clone(),this.toLook=this.look.clone(),this.toFov=this.fov,this.t=1,this.dur=1,this.ease=En,this.driftT=Math.random()*10,this.driftAmp=.02,this.shake=0,this._v=new C}set(t,e,n){this.pos.copy(t),this.look.copy(e),n&&(this.fov=n),this.toPos.copy(t),this.toLook.copy(e),this.toFov=this.fov,this.t=1,this.apply()}goTo(t,e,n=1.4,s=En,r=null){this.fromPos.copy(this.pos),this.fromLook.copy(this.look),this.fromFov=this.fov,this.toPos.copy(t),this.toLook.copy(e),this.toFov=r??this.fov,this.t=0,this.dur=Math.max(1e-4,n),this.ease=s}get moving(){return this.t<1}addShake(t){this.shake=Math.min(1,this.shake+t)}update(t){if(this.t<1){this.t=oe(this.t+t/this.dur);let e=this.ease(this.t);this.pos.lerpVectors(this.fromPos,this.toPos,e),this.look.lerpVectors(this.fromLook,this.toLook,e),this.fov=Wt(this.fromFov,this.toFov,e)}this.driftT+=t,this.shake=Math.max(0,this.shake-t*2.6),this.apply()}apply(){let t=this.camera,e=this.driftT,n=Math.sin(e*.37)*this.driftAmp+Math.sin(e*.91)*this.driftAmp*.4,s=Math.sin(e*.53+1.3)*this.driftAmp*.6,r=this.shake*this.shake;t.position.set(this.pos.x+n+(Math.random()-.5)*r*.05,this.pos.y+s+(Math.random()-.5)*r*.05,this.pos.z+n*.5),this._v.copy(this.look),this._v.y+=s*.25,t.lookAt(this._v),Math.abs(t.fov-this.fov)>.01&&(t.fov=this.fov,t.updateProjectionMatrix())}};function ks(i,t,e,n,s,r=.3){let a=s.fov*.5*Math.PI/180,o=Math.atan(Math.tan(a)*s.aspect),l=Math.max(r,n/Math.max(.08,Math.tan(o))),c=e*Math.PI/180,h=l*Math.cos(c);return{pos:new C(i.x+Math.sin(t)*h,i.y+l*Math.sin(c),i.z+Math.cos(t)*h),look:i.clone(),dist:l}}var qr=class{constructor(t){let e=Ld(256),n=new Gn({map:e,transparent:!0,depthWrite:!1,blending:ai,opacity:0,fog:!1});this.mesh=new Lt(new Wn(1,1),n),this.mesh.rotation.x=-Math.PI/2,this.mesh.renderOrder=3,this.mesh.visible=!1,t.add(this.mesh);let s=new yi({map:dl(128),transparent:!0,depthWrite:!1,blending:ai,opacity:0,fog:!1});this.stars=[];for(let r=0;r<3;r++){let a=new ki(s.clone());a.scale.setScalar(.07),a.renderOrder=4,a.visible=!1,t.add(a),this.stars.push(a)}this.t=Math.random()*6,this.strength=0}setAt(t,e,n){this.mesh.position.set(t,e+.012,n),this.base=new C(t,e,n)}show(t,e=1){this.target=t?e:0}update(t){this.t+=t,this.strength=Wt(this.strength,this.target||0,1-Math.exp(-6*t));let e=this.strength>.01;if(this.mesh.visible=e,!e){this.stars.forEach(r=>r.visible=!1);return}let n=.5+.5*Math.sin(this.t*2.3);this.mesh.material.opacity=this.strength*(.3+n*.42);let s=.44+n*.11;this.mesh.scale.set(s,s,s);for(let r=0;r<this.stars.length;r++){let a=this.stars[r];a.visible=!0;let o=this.t*(.8+r*.27)+r*2.1,l=.1+.05*Math.sin(this.t*1.7+r);a.position.set(this.base.x+Math.cos(o)*l,this.base.y+.05+.045*Math.sin(this.t*2.2+r*1.9),this.base.z+Math.sin(o)*l),a.material.opacity=this.strength*(.35+.4*(.5+.5*Math.sin(this.t*3+r*2))),a.scale.setScalar(.05+.02*(.5+.5*Math.sin(this.t*2.6+r)))}}},xl=class{constructor(t){this.el=document.createElement("div"),this.el.className="hint-layer",t.appendChild(this.el),this.hand=document.createElement("img"),this.hand.src=Pd(256).image.toDataURL(),this.hand.className="hint hint-hand",this.el.appendChild(this.hand),this.arrow=document.createElement("img"),this.arrow.src=Id(256).image.toDataURL(),this.arrow.className="hint hint-arrow",this.el.appendChild(this.arrow),this.mode="none",this.t=0,this.anchor={x:0,y:0},this.opacity=0,this.target=0}set(t,e){e&&(this.anchor=e),t!==this.mode&&(this.mode=t,this.t=0),this.target=t==="none"?0:1}setAnchor(t,e){this.anchor.x=t,this.anchor.y=e}setSecondary(t,e){this.secondary={x:t,y:e}}update(t){if(this.t+=t,this.opacity=Wt(this.opacity,this.target,1-Math.exp(-5*t)),this.opacity<.02){this.hand.style.opacity="0",this.arrow.style.opacity="0";return}let e=this.anchor,n=e.x,s=e.y,r=0,a=1,o=!1,l=e.x,c=e.y,h=0,d=1,u=f=>this.t%f/f;if(this.mode==="sweep"){let f=u(1.9),g=Math.sin(f*Math.PI*2),_=bn(0,.12,f)*(1-bn(.88,1,f));n=e.x+g*62,s=e.y+Math.abs(Math.cos(f*Math.PI*2))*8,r=g*14,a=.95+.06*Math.cos(f*Math.PI*4),this.hand.style.opacity=String(this.opacity*(.35+_*.6)),this.arrow.style.opacity="0"}else if(this.mode==="pull"){let f=u(1.5),g=bn(.08,.72,f);s=e.y-g*92,n=e.x,a=1-g*.06,this.hand.style.opacity=String(this.opacity*(.35+(1-Math.abs(f*2-1))*.6)),o=!0,c=e.y-132-Math.sin(f*Math.PI)*18,d=.78,this.arrow.style.opacity=String(this.opacity*(.55+.35*Math.sin(f*Math.PI*2)))}else if(this.mode==="carry"){let f=this.secondary||e,g=u(1.8),_=bn(.1,.85,g);n=Wt(e.x,f.x,_),s=Wt(e.y,f.y,_),this.hand.style.opacity=String(this.opacity*(.3+(1-Math.abs(g*2-1))*.6)),o=!0,l=f.x,c=f.y-76,h=180,d=.66,this.arrow.style.opacity=String(this.opacity*.6)}else if(this.mode==="tap"){let f=u(1.3),g=Math.max(0,Math.sin(f*Math.PI*2));a=1-g*.13,s=e.y+g*10,this.hand.style.opacity=String(this.opacity*.85),this.arrow.style.opacity="0"}else this.hand.style.opacity=String(this.opacity*.5),this.arrow.style.opacity=String(this.opacity*.4);this.hand.style.transform=`translate(${n-44}px, ${s-8}px) rotate(${r}deg) scale(${a})`,o&&(this.arrow.style.transform=`translate(${l-40}px, ${c-40}px) rotate(${h}deg) scale(${d})`)}};function qd(i){let t=new Me,e=i.clone();e.repeat.set(9,9),e.needsUpdate=!0;let n=new ee({color:12597547,roughness:1,metalness:0,bumpMap:e,bumpScale:.55}),s=new ee({color:15920611,roughness:1,metalness:0,bumpMap:e,bumpScale:.9}),r=new Lt(new sn(1,18,14),n);r.scale.set(.038,.024,.052),r.position.set(0,0,-.009),t.add(r);let a=new Lt(new sn(1,16,12),n);a.scale.set(.033,.02,.026),a.position.set(0,-.0015,-.053),t.add(a);let o=new Lt(new sn(1,12,10),n);o.scale.set(.014,.013,.025),o.position.set(-.035,-.0015,-.015),o.rotation.y=.42,t.add(o);let l=new Lt(new tn(.033,.037,.042,16),s);l.rotation.x=Math.PI/2,l.position.set(0,.003,.037),t.add(l);let c=new Lt(new tn(.034,.042,.3,14),new ee({color:3104650,roughness:.95}));return c.rotation.x=Math.PI/2+.3,c.position.set(0,.03,.19),t.add(c),t.traverse(h=>{h.isMesh&&(h.castShadow=!0,h.receiveShadow=!1)}),t.visible=!1,t}var _l=class{constructor(t){this.mesh=t,this.pos=new C,this.target=new C,this.dir=new et(0,-1),this.speed=0,this.press=0,this.want=0,this.grip=0,this.wantGrip=0,this.yaw=0,this._up=new C(0,1,0)}show(t){this.want=t?1:0}setGrip(t){this.wantGrip=t}moveTo(t,e,n,s,r,a){this.target.set(t,e,n),Math.abs(s)+Math.abs(r)>1e-4&&this.dir.set(s,r).normalize(),this.speed=a}update(t,e){if(this.press=on(this.press,this.want,9,t),this.grip=on(this.grip,this.wantGrip,10,t),this.mesh.visible=this.press>.02,!this.mesh.visible)return;this.pos.x=on(this.pos.x,this.target.x,22,t),this.pos.y=on(this.pos.y,this.target.y,18,t),this.pos.z=on(this.pos.z,this.target.z,22,t);let n=Wt(.045,.013,this.press)+(1-this.press)*.08;this.mesh.position.set(this.pos.x,this.pos.y+n+this.grip*.02,this.pos.z);let s=Math.atan2(e.position.x-this.pos.x,e.position.z-this.pos.z),r=Math.atan2(this.dir.x,this.dir.y),a=oe(this.speed*2.2),l=Wt(s+.55,r,.55*a)-this.yaw;for(;l>Math.PI;)l-=Math.PI*2;for(;l<-Math.PI;)l+=Math.PI*2;this.yaw+=l*(1-Math.exp(-12*t)),this.mesh.rotation.set(0,this.yaw,0),this.mesh.rotateX(Wt(.55,.12,this.grip)-oe(this.speed)*.12),this.mesh.rotateZ(Math.sin(this.pos.x*3)*.05);let c=1+oe(this.speed)*.05-this.grip*.06;this.mesh.scale.set(1/c,c,1/c)}};var zt=null,ln=null,Zd=null,S_=null,Ii=!1;function b_(i=2){let t=Math.floor(zt.sampleRate*i),e=zt.createBuffer(1,t,zt.sampleRate),n=e.getChannelData(0),s=0;for(let r=0;r<t;r++){let a=Math.random()*2-1;s=(s+.02*a)/1.02,n[r]=a*.75+s*3}return e}function $d(){if(Ii)return zt.state==="suspended"&&zt.resume(),!0;let i=window.AudioContext||window.webkitAudioContext;if(!i)return!1;try{zt=new i}catch{return!1}ln=zt.createGain(),ln.gain.value=.85,ln.connect(zt.destination),Zd=b_(2),Ii=!0,zt.state==="suspended"&&zt.resume(),E_();let t=zt.createOscillator(),e=zt.createGain();return e.gain.value=1e-4,t.connect(e),e.connect(ln),t.start(),t.stop(zt.currentTime+.02),!0}function Jd(){zt&&zt.state==="suspended"&&zt.resume()}function Hs(){let i=zt.createBufferSource();return i.buffer=Zd,i.loop=!0,i.playbackRate.value=.8+Math.random()*.5,i}function E_(){let i=Hs(),t=zt.createBiquadFilter();t.type="lowpass",t.frequency.value=340,t.Q.value=.4;let e=zt.createGain();e.gain.value=0,i.connect(t),t.connect(e),e.connect(ln),i.start();let n=zt.createOscillator();n.type="sine",n.frequency.value=.06;let s=zt.createGain();s.gain.value=.022,n.connect(s),s.connect(e.gain),n.start(),e.gain.setTargetAtTime(.035,zt.currentTime,3),S_={src:i,g:e}}var Yd=0;function Kd(i=.5,t=0){if(!Ii)return;let e=zt.currentTime;if(e-Yd<.055)return;Yd=e;let n=T_(i),s=Hs(),r=zt.createBiquadFilter();r.type="bandpass";let a=(2600+n*3400)*(1-t*.62);r.frequency.value=a,r.Q.value=.8+t*1.6;let o=zt.createBiquadFilter();o.type="highpass",o.frequency.value=t>.5?180:700;let l=zt.createGain(),c=.1+n*.13,h=(.055+n*.16)*(1-t*.15);l.gain.setValueAtTime(1e-4,e),l.gain.linearRampToValueAtTime(h,e+.012+n*.01),l.gain.exponentialRampToValueAtTime(1e-4,e+c),s.connect(o),o.connect(r),r.connect(l),l.connect(ln),r.frequency.setValueAtTime(a,e),r.frequency.exponentialRampToValueAtTime(Math.max(220,a*.45),e+c),s.start(e),s.stop(e+c+.02)}function Qd(){if(!Ii)return;let i=zt.currentTime,t=zt.createOscillator();t.type="sine",t.frequency.setValueAtTime(112,i),t.frequency.exponentialRampToValueAtTime(430,i+.048),t.frequency.exponentialRampToValueAtTime(250,i+.16);let e=zt.createGain();e.gain.setValueAtTime(1e-4,i),e.gain.linearRampToValueAtTime(.5,i+.006),e.gain.exponentialRampToValueAtTime(1e-4,i+.2),t.connect(e),e.connect(ln),t.start(i),t.stop(i+.24);let n=Hs(),s=zt.createBiquadFilter();s.type="bandpass",s.frequency.setValueAtTime(1500,i),s.frequency.exponentialRampToValueAtTime(3200,i+.05),s.Q.value=2.4;let r=zt.createGain();r.gain.setValueAtTime(1e-4,i),r.gain.linearRampToValueAtTime(.2,i+.005),r.gain.exponentialRampToValueAtTime(1e-4,i+.1),n.connect(s),s.connect(r),r.connect(ln),n.start(i),n.stop(i+.14);let a=Hs(),o=zt.createBiquadFilter();o.type="lowpass",o.frequency.setValueAtTime(1400,i+.03),o.frequency.exponentialRampToValueAtTime(320,i+.42);let l=zt.createGain();l.gain.setValueAtTime(1e-4,i+.03),l.gain.linearRampToValueAtTime(.075,i+.06),l.gain.exponentialRampToValueAtTime(1e-4,i+.45),a.connect(o),o.connect(l),l.connect(ln),a.start(i+.03),a.stop(i+.5)}function jd(){if(!Ii)return;let i=zt.currentTime;[784,1047,1319].forEach((e,n)=>{let s=i+n*.085,r=zt.createOscillator();r.type="sine",r.frequency.value=e;let a=zt.createOscillator();a.type="triangle",a.frequency.value=e*2.01;let o=zt.createGain();o.gain.setValueAtTime(1e-4,s),o.gain.linearRampToValueAtTime(.13-n*.022,s+.012),o.gain.exponentialRampToValueAtTime(1e-4,s+.75);let l=zt.createGain();l.gain.value=.22,r.connect(o),a.connect(l),l.connect(o),o.connect(ln),r.start(s),r.stop(s+.8),a.start(s),a.stop(s+.8)})}function tf(){if(!Ii)return;let i=zt.currentTime;[[196,.34,.13],[430,.2,.085],[720,.1,.055]].forEach(([s,r,a])=>{let o=zt.createOscillator();o.type="triangle",o.frequency.setValueAtTime(s*1.06,i),o.frequency.exponentialRampToValueAtTime(s,i+.03);let l=zt.createGain();l.gain.setValueAtTime(1e-4,i),l.gain.linearRampToValueAtTime(r,i+.004),l.gain.exponentialRampToValueAtTime(1e-4,i+a),o.connect(l),l.connect(ln),o.start(i),o.stop(i+a+.05)});let t=Hs(),e=zt.createBiquadFilter();e.type="bandpass",e.frequency.value=2100,e.Q.value=1.2;let n=zt.createGain();n.gain.setValueAtTime(1e-4,i),n.gain.linearRampToValueAtTime(.16,i+.003),n.gain.exponentialRampToValueAtTime(1e-4,i+.055),t.connect(e),e.connect(n),n.connect(ln),t.start(i),t.stop(i+.08)}function ch(i=1){if(!Ii)return;let t=zt.currentTime,e=zt.createOscillator();e.type="sine",e.frequency.setValueAtTime(1180*i,t),e.frequency.exponentialRampToValueAtTime(1760*i,t+.12);let n=zt.createGain();n.gain.setValueAtTime(1e-4,t),n.gain.linearRampToValueAtTime(.07,t+.02),n.gain.exponentialRampToValueAtTime(1e-4,t+.35),e.connect(n),n.connect(ln),e.start(t),e.stop(t+.4)}var Pi=null;function vl(i){if(!Ii)return;if(i<=.001){if(Pi){Pi.g.gain.setTargetAtTime(1e-4,zt.currentTime,.05);let e=Pi;Pi=null,setTimeout(()=>{try{e.src.stop()}catch{}},400)}return}if(!Pi){let e=Hs(),n=zt.createBiquadFilter();n.type="bandpass",n.frequency.value=420,n.Q.value=2.2;let s=zt.createGain();s.gain.value=1e-4,e.connect(n),n.connect(s),s.connect(ln),e.start(),Pi={src:e,bp:n,g:s}}let t=zt.currentTime;Pi.g.gain.setTargetAtTime(.02+i*.1,t,.04),Pi.bp.frequency.setTargetAtTime(360+i*620,t,.06)}function T_(i){return i<0?0:i>1?1:i}var Kt={INTRO:"intro",OVERVIEW:"overview",APPROACH:"approach",DIG:"dig",GRAB:"grab",PULL:"pull",POP:"pop",CARRY:"carry",BOX:"box",REFILL:"refill"},ef=.135,hh=4,nf=12,yl=class{constructor({renderer:t,scene:e,camera:n,container:s,quality:r}){this.renderer=t,this.scene=e,this.camera=n,this.container=s,this.quality=r,this.rng=De(20260819),this.field=new fl(t),e.add(this.field.group),this.world=zd(e,t,r),this.fx=new ml(e,this.field.soilMap),this.rig=new gl(n),this.hint=new xl(s),this.mitten=qd(this.field.grain),e.add(this.mitten),this.hand=new _l(this.mitten),this.spots=[];for(let o=0;o<hh;o++){let l=Hd({seed:o+1,aniso:Math.min(8,t.capabilities.getMaxAnisotropy()),leafHeight:.125+this.rng()*.032,fronds:13+(this.rng()*4|0)});e.add(l);let c=Gd(this.field.soilMap,this.field.soilBump);e.add(c);let h=Wd(this.field.soilMap);h.visible=!1,e.add(h),this.spots.push({x:0,z:0,y:0,plant:l,cap:c,hole:h,marker:new qr(e),leafHeight:l.userData.leafHeight,capAmount:1,done:!0,revealed:!1,rise:0})}this.crate=this.world.crate,this.cratePile=new Me,this.crate.add(this.cratePile),this.crateCount=0,this.crateMarker=new qr(e);let a=new C;this.crate.getWorldPosition(a),this.crateMarker.setAt(a.x,a.y+.24,a.z),this.raycaster=new Lr,this.ndc=new et,this.pointer={down:!1,x:0,y:0,px:0,py:0,moved:0},this.lastWorld=new C,this.hasLastWorld=!1,this.timeScale=1,this.timeScaleTarget=1,this.freezeT=0,this.idleT=0,this.state=Kt.INTRO,this.stateT=0,this.active=null,this.pullPx=0,this.pullProgress=0,this.carried=!1,this.audioStarted=!1,this.tmpV=new C,this.tmpV2=new C,this.plane=new vn,this._up=new C(0,1,0),this.cratePos=new C,this.newRound(!0),this.enterIntro()}get aspect(){return this.container.clientWidth/this.container.clientHeight}newRound(t=!1){let e=[-sh,0,sh],n=[],s=0;for(;n.length<hh&&s++<500;){let a=e[this.rng()*e.length|0],o=-1.02+this.rng()*2.04;n.some(l=>Math.hypot(l.x-a,l.z-o)<.52)||n.push({x:a,z:o})}for(;n.length<hh;)n.push({x:e[n.length%3],z:-.9+n.length*.6});n.sort((a,o)=>o.z-a.z);for(let a=0;a<this.spots.length;a++){let o=this.spots[a];o.x=n[a].x,o.z=n[a].z,o.y=Dn(o.x,o.z),o.done=!1,o.revealed=!1,o.capAmount=1,o.rise=0,o.plant.position.set(o.x,o.y+.011,o.z),o.plant.rotation.set(0,this.rng()*6.28,0),o.plant.scale.setScalar(1),o.plant.visible=t,o.plant.userData.setStretch(0),o.plant.userData.setDirt(.8),o.cap.position.set(o.x,o.y-.004,o.z),o.cap.rotation.y=this.rng()*6.28,o.cap.scale.setScalar(1),o.cap.visible=t,o.hole.position.set(o.x,o.y+.005,o.z),o.hole.visible=!1,o.marker.setAt(o.x,o.y+.22,o.z),o.marker.show(!1)}let r=this.spots.map(a=>{let o=a.plant.userData.leafProfile;return{x:a.x,z:a.z,baseY:a.plant.position.y,bin:o.bin,prof:o.max,margin:.028}});t?this.field.reset(!0,r):this.field.startRegrow(r)}get remaining(){return this.spots.filter(t=>!t.done)}overviewPose(){return ks(new C(0,.16,-.1),.03,25,.78,this.camera,2.25)}workPose(t){return ks(new C(t.x,t.y+.06,t.z),.16+t.x*.18,45,.3,this.camera,.72)}closePose(t){return ks(new C(t.x,t.y+.07,t.z),.2+t.x*.18,38,.215,this.camera,.58)}pullPose(t){return ks(new C(t.x,t.y+.095,t.z),.22+t.x*.16,30,.195,this.camera,.54)}carryPose(t){let e=new C;this.crate.getWorldPosition(e);let n=t.x-e.x,s=t.z-e.z,r=Math.max(.6,Math.hypot(n,s)),a=Math.atan2(n,s),o=new C((t.x+e.x)/2,t.y+.3,(t.z+e.z)/2),l=.58*r+.95,c=32*Math.PI/180;return{pos:new C(o.x+Math.sin(a)*l*Math.cos(c),o.y+l*Math.sin(c),o.z+Math.cos(a)*l*Math.cos(c)),look:o.clone()}}currentPose(){let t=this.active;switch(this.state){case Kt.INTRO:case Kt.OVERVIEW:case Kt.REFILL:return this.overviewPose();case Kt.APPROACH:case Kt.DIG:return t?t.revealed?this.closePose(t):this.workPose(t):this.overviewPose();case Kt.GRAB:case Kt.PULL:case Kt.POP:return t?this.pullPose(t):this.overviewPose();case Kt.CARRY:case Kt.BOX:return t?this.carryPose(t):this.overviewPose();default:return this.overviewPose()}}refreshPose(){let t=this.currentPose();this.rig.goTo(t.pos,t.look,.35,En)}setState(t){this.state=t,this.stateT=0}enterIntro(){let t=this.overviewPose();this.rig.set(new C(t.pos.x-t.pos.z*.34,t.pos.y*1.5,t.pos.z*1.45),new C(0,.3,-1.4),this.camera.fov),this.rig.goTo(t.pos,t.look,5.5,En),this.setState(Kt.INTRO),this.hint.set("none")}enterOverview(t=1.5){let e=this.overviewPose();this.rig.goTo(e.pos,e.look,t,En),this.setState(Kt.OVERVIEW),this.hand.show(!1);for(let n of this.spots)n.marker.show(!n.done);this.crateMarker.show(!1),this.hint.set("tap"),this.idleT=0}selectSpot(t){this.active=t;for(let n of this.spots)n.marker.show(!1);let e=this.workPose(t);this.rig.goTo(e.pos,e.look,1.35,En),this.setState(Kt.APPROACH),ch(1.1)}enterDig(){this.setState(Kt.DIG),this.hand.setGrip(0);let t=this.active;this.hand.pos.set(t.x,t.y+.3,t.z+.12),this.hand.target.copy(this.hand.pos),this.hint.set("sweep"),this.idleT=0}enterGrab(){let t=this.active;this.hand.show(!1);let e=this.pullPose(t);this.rig.goTo(e.pos,e.look,1,En),this.setState(Kt.GRAB),this.pullPx=0,this.pullProgress=0,this.hand.setGrip(1),this.hint.set("pull"),this.idleT=0,t.marker.show(!1),ch(1.3)}enterPull(){this.setState(Kt.PULL),this.hint.set("none"),this.hand.setGrip(1)}enterPop(){let t=this.active;this.setState(Kt.POP),this.hint.set("none"),this.hand.show(!1),vl(0),Qd();let e=t.x,n=t.z,s=t.y;this.fx.popFlare(new C(e,s+.1,n)),this.fx.burstSparkle(e,s+.1,n,18,1.3),this.fx.puffSoil(e,s+.02,n,.25,1.6),this.fx.puffSnow(e,s+.04,n,0,0,.12),this.rig.addShake(.5),t.hole.visible=!0,t.plant.userData.setStretch(0),t.plant.userData.setDirt(.44),t.cap.visible=!1,this.popFrom=t.rise,this.popT=0,this.held=!1;let r=ks(new C(t.x,t.y+.13,t.z),.22+t.x*.16,26,.17,this.camera,.48);this.rig.goTo(r.pos,r.look,2.2,nh)}enterCarry(){let t=this.active;this.setState(Kt.CARRY);let e=this.carryPose(t);this.rig.goTo(e.pos,e.look,1.3,En),this.crateMarker.show(!0),this.carried=!1,this.idleT=0,this.carryPos=new C(t.x,t.y+.3,t.z),this.hint.set("carry")}enterBox(){this.setState(Kt.BOX),this.hint.set("none"),this.crateMarker.show(!1);let t=this.active,e=new C;this.crate.getWorldPosition(e),this.boxFrom=this.carryPos.clone(),this.boxTo=e.clone(),this.boxTo.y+=.16,this.boxT=0}enterRefill(){this.setState(Kt.REFILL),this.hint.set("none");let t=this.overviewPose();this.rig.goTo(new C(t.pos.x,t.pos.y*1.18,t.pos.z*1.12),new C(0,.25,-.2),2,En),this.world.setSnowfallIntensity(3.2),this.newRound(!1)}surfaceHeight(t,e){return this.field.inside(t,e)?Dn(t,e)+this.field.snowAt(t,e):Xe(t,e)}raySurface(t){let e=this.raycaster.ray,n=e.origin,s=e.direction,r=.02,a=16;s.y<-1e-4&&(r=Math.max(r,(.55-n.y)/s.y),a=Math.min(a,(-.45-n.y)/s.y)),a>r||(r=.02,a=16);let o=d=>{let u=n.x+s.x*d,f=n.y+s.y*d,g=n.z+s.z*d;return f-this.surfaceHeight(u,g)},l=r,c=o(r),h=64;for(let d=1;d<=h;d++){let u=r+(a-r)*d/h,f=o(u);if(c>0&&f<=0){let g=l,_=u;for(let m=0;m<12;m++){let M=(g+_)/2;o(M)>0?g=M:_=M}let p=(g+_)/2;return t.set(n.x+s.x*p,n.y+s.y*p,n.z+s.z*p),!0}l=u,c=f}return!1}setRayFromScreen(t,e){let n=this.container.clientWidth,s=this.container.clientHeight;this.ndc.set(t/n*2-1,-(e/s)*2+1),this.raycaster.setFromCamera(this.ndc,this.camera)}toScreen(t){let e=this.container.clientWidth,n=this.container.clientHeight;return this.tmpV2.copy(t).project(this.camera),{x:(this.tmpV2.x*.5+.5)*e,y:(-this.tmpV2.y*.5+.5)*n}}onDown(t,e){if(this.audioStarted||(this.audioStarted=$d()),Jd(),this.pointer.down=!0,this.pointer.x=this.pointer.px=t,this.pointer.y=this.pointer.py=e,this.pointer.moved=0,this.hasLastWorld=!1,this.idleT=0,this.state===Kt.INTRO){this.enterOverview(1.1);return}if(this.state===Kt.OVERVIEW&&!this.rig.moving){this.setRayFromScreen(t,e);let n=this.raySurface(this.tmpV),s=this.remaining;if(!s.length)return;let r=s[0],a=1/0;for(let o of s){let l=n?Math.hypot(o.x-this.tmpV.x,o.z-this.tmpV.z):Math.hypot(this.toScreen(new C(o.x,o.y+.1,o.z)).x-t,this.toScreen(new C(o.x,o.y+.1,o.z)).y-e);l<a&&(a=l,r=o)}this.selectSpot(r);return}if(this.state===Kt.GRAB){this.enterPull();return}this.state===Kt.CARRY&&(this.carried=!0,this.hint.set("none"))}onMove(t,e){let n=t-this.pointer.x,s=e-this.pointer.y;this.pointer.px=this.pointer.x,this.pointer.py=this.pointer.y,this.pointer.x=t,this.pointer.y=e,this.pointer.down&&(this.pointer.moved+=Math.hypot(n,s),this.idleT=0,this.state===Kt.DIG?this.sweep(t,e):this.state===Kt.PULL?(s<0&&(this.pullPx+=-s),this.pullPx+=Math.abs(n)*.18):this.state===Kt.CARRY&&this.carried&&this.dragCarrot(t,e))}onUp(){this.pointer.down=!1,this.hasLastWorld=!1,vl(0),this.state===Kt.PULL&&(this.pullPx*=.72,this.setState(Kt.GRAB),this.hint.set("pull")),this.state===Kt.CARRY&&(this.carried=!1)}sweep(t,e){if(this.setRayFromScreen(t,e),!this.raySurface(this.tmpV))return;let n=this.tmpV,s=this.active,r=n.x,a=n.z,o=1;if(this.hasLastWorld){let u=Math.hypot(n.x-this.lastWorld.x,n.z-this.lastWorld.z);o=Ji(Math.ceil(u/.028),1,14)}let l=0,c=0,h=0;for(let u=1;u<=o;u++){let f=o===1?1:u/o,g=this.hasLastWorld?Wt(this.lastWorld.x,n.x,f):n.x,_=this.hasLastWorld?Wt(this.lastWorld.z,n.z,f):n.z;if(!this.field.inside(g,_))continue;let p=this.hasLastWorld?.03:.016;this.field.snowAt(g,_)>.004?l+=this.field.brush(g,_,ef,p):(this.field.scrub(g,_,ef*.8,p*1.2),this.rng()<.16&&this.fx.puffSoil(g,Dn(g,_),_,.04,.45),l+=4e-4),r=g,a=_}this.hasLastWorld&&(c=n.x-this.lastWorld.x,h=n.z-this.lastWorld.z);let d=Math.hypot(c,h)*60;if(s&&Math.hypot(r-s.x,a-s.z)<.19&&this.field.snowAround(s.x,s.z,.075)<.055&&s.capAmount>0){let f=s.capAmount;s.capAmount=Math.max(0,s.capAmount-(.01+Math.min(.05,d*.02))),f>s.capAmount&&this.fx.puffSoil(r,Dn(r,a)+.01,a,.05,.6)}if(l>15e-5){let u=this.field.snowAt(r,a)<=.006;this.fx.puffSnow(r,this.surfaceHeight(r,a),a,c*8,h*8,Math.min(.05,l*(u?.2:1))),Kd(oe(d*.55),u?.9:0)}this.hand.moveTo(r,this.surfaceHeight(r,a),a,c,h,Math.min(1,d*.5)),this.lastWorld.set(n.x,n.y,n.z),this.hasLastWorld=!0}dragCarrot(t,e){this.setRayFromScreen(t,e),this.plane.set(this._up,-this.carryPos.y);let n=this.tmpV2;this.raycaster.ray.intersectPlane(this.plane,n)&&(this.carryPos.x=Wt(this.carryPos.x,n.x,.6),this.carryPos.z=Wt(this.carryPos.z,n.z,.6));let s=this.surfaceHeight(this.carryPos.x,this.carryPos.z)+.24;this.carryPos.y=on(this.carryPos.y,s,7,1/60)}crateSlot(t){let e=t%nf,n=Math.floor(e/6),s=e%6,r=s%3,a=Math.floor(s/3);return new C(-.13+r*.13+(n?.045:0),.035+n*.045,-.06+a*.115+(n?.02:0))}addToCrate(){let t=Xd(4),e=this.crateSlot(this.crateCount);if(t.position.copy(e),t.rotation.set(Math.PI/2+(this.rng()-.5)*.4,this.rng()*6.28,(this.rng()-.5)*.5),this.cratePile.add(t),this.crateCount++,this.cratePile.children.length>nf){let n=this.cratePile.children[0];this.cratePile.remove(n)}}update(t){this.freezeT>0&&(this.freezeT-=t,this.freezeT<=0&&(this.timeScaleTarget=1)),this.timeScale=on(this.timeScale,this.timeScaleTarget,9,t);let e=t*this.timeScale;this.stateT+=t,this.pointer.down||(this.idleT+=t),this.field.update(e),this.world.update(e,this.camera,this.renderer.getPixelRatio()),this.fx.update(e,(n,s)=>this.surfaceHeight(n,s),this.renderer.getPixelRatio());for(let n of this.spots)n.marker.update(e);this.crateMarker.update(e),this.hand.update(t,this.camera),this.rig.update(t);for(let n of this.spots)!n.done&&n.plant.visible&&n.plant.userData.setWind(this.stateT+n.x*3);switch(this.state){case Kt.INTRO:this.tickIntro(t);break;case Kt.OVERVIEW:this.tickOverview(t);break;case Kt.APPROACH:this.tickApproach(t);break;case Kt.DIG:this.tickDig(t);break;case Kt.GRAB:this.tickGrab(t);break;case Kt.PULL:this.tickPull(t);break;case Kt.POP:this.tickPop(t);break;case Kt.CARRY:this.tickCarry(t);break;case Kt.BOX:this.tickBox(t);break;case Kt.REFILL:this.tickRefill(t);break}this.hint.update(t)}tickIntro(){this.stateT>5.2&&this.enterOverview(1.2)}tickOverview(t){if(this.rig.moving)return;let e=this.remaining;if(!e.length){this.enterRefill();return}let n=e[0],s=this.toScreen(this.tmpV.set(n.x,n.y+.12,n.z));this.hint.set("tap",s),this.hint.setAnchor(s.x,s.y),this.idleT>11&&this.selectSpot(n)}tickApproach(){this.rig.moving||this.enterDig()}tickDig(t){let e=this.active,n=this.field.snowAround(e.x,e.z,.075),s=oe(e.capAmount);if(e.cap.visible=s>.04,e.cap.scale.set(Wt(.55,1,s),Wt(.15,1,s),Wt(.55,1,s)),!e.revealed&&n<e.leafHeight-.004){e.revealed=!0,jd(),this.fx.burstSparkle(e.x,e.y+e.leafHeight*.85,e.z,12,.45);let a=this.closePose(e);this.rig.goTo(a.pos,a.look,1.5,En)}let r=this.toScreen(this.tmpV.set(e.x,e.y+.08,e.z));this.hint.setAnchor(r.x,r.y),this.hint.set(this.pointer.moved>40&&this.idleT<2.2?"none":"sweep"),this.hand.show(this.pointer.down),e.marker.show(!e.revealed,.55),n<.014&&e.capAmount<=.08&&this.enterGrab()}tickGrab(t){let e=this.active,n=this.toScreen(this.tmpV.set(e.x,e.y+e.leafHeight*.62,e.z));this.hint.setAnchor(n.x,n.y),this.hand.show(!1),this.pullProgress=on(this.pullProgress,this.pullPx/this.pullNeed(),6,t),this.applyRise(e,this.pullProgress)}pullNeed(){return Math.max(120,this.container.clientHeight*.2)}riseCurve(t){return t<.28?.055*(t/.28):t<.82?.055+.36*Math.pow((t-.28)/.54,1.25):.415+.3*((t-.82)/.18)}applyRise(t,e){let n=oe(e);t.rise=this.riseCurve(n)*zs;let s=n>.2?(Math.random()-.5)*.0022*n:0;t.plant.position.set(t.x+s,t.y+.004+t.rise,t.z+s*.6),t.plant.userData.setStretch(n*.85),n>.05&&(t.hole.visible=!0,t.hole.scale.setScalar(Wt(.35,1,oe(n*1.4))))}tickPull(t){let e=this.active;this.pointer.down&&(this.pullPx+=t*this.pullNeed()*.16);let n=this.pullPx/this.pullNeed(),s=this.pullProgress;this.pullProgress=on(this.pullProgress,n,14,t),this.applyRise(e,this.pullProgress),vl(oe(this.pullProgress*1.1)),this.pullProgress-s>.0025&&(this.rng()<.55&&this.fx.puffSoil(e.x,e.y+.01,e.z,.03,.35),this.field.scrub(e.x,e.z,.11,.02),this.rig.addShake(.05));let r=this.toScreen(this.tmpV.set(e.x,e.y+e.leafHeight*.55+e.rise,e.z));this.hint.setAnchor(r.x,r.y),this.pullProgress>=.995&&this.enterPop()}tickPop(t){let e=this.active;this.popT+=t;let n=oe(this.popT/.34),s=Md(n),r=zs*1.06+.045;e.rise=Wt(this.popFrom,r,s),e.plant.position.set(e.x,e.y+.004+e.rise,e.z),e.plant.rotation.z=Math.sin(n*Math.PI)*.22,e.plant.rotation.x=Math.sin(n*Math.PI*1.4)*.1,e.plant.userData.setStretch(Wt(.85,0,n)),!this.held&&n>=1&&(this.held=!0,this.freezeT=.62,this.timeScaleTarget=.14),this.stateT>2&&this.enterCarry()}tickCarry(t){let e=this.active,n=this.cratePos;this.crate.getWorldPosition(n),this.carried||(this.carryPos.y=on(this.carryPos.y,e.y+.34,4,t)+Math.sin(this.stateT*2.4)*.0016),(!this.carried&&this.idleT>2.2||this.stateT>7)&&this.carryPos.lerp(this.tmpV.set(n.x,n.y+.3,n.z),1-Math.exp(-2*t)),e.plant.position.copy(this.carryPos),e.plant.rotation.x=on(e.plant.rotation.x,.16,5,t),e.plant.rotation.z=on(e.plant.rotation.z,Math.sin(this.stateT*1.6)*.12,5,t),e.plant.userData.setStretch(Math.min(.7,this.stateT*1.1));let s=this.toScreen(this.carryPos),r=this.toScreen(this.tmpV.set(n.x,n.y+.22,n.z));this.hint.setAnchor(s.x,s.y),this.hint.setSecondary(r.x,r.y),!this.carried&&this.idleT>.8&&this.hint.set("carry"),Math.hypot(this.carryPos.x-n.x,this.carryPos.z-n.z)<.42&&this.stateT>.5&&this.enterBox()}tickBox(t){let e=this.active;this.boxT+=t;let n=oe(this.boxT/.5),s=nh(n);if(e.plant.position.lerpVectors(this.boxFrom,this.boxTo,s),e.plant.position.y+=Math.sin(n*Math.PI)*.09,e.plant.rotation.x=Wt(e.plant.rotation.x,Math.PI*.5,s*.6),e.plant.scale.setScalar(Wt(1,.85,s)),n>=1&&!e.done){e.done=!0,e.plant.visible=!1,e.hole.visible=!1,e.cap.visible=!1,tf(),this.addToCrate();let r=this.boxTo;this.fx.burstSparkle(r.x,r.y,r.z,16,.55),this.rig.addShake(.14)}this.boxT>1.15&&(this.remaining.length?this.enterOverview(1.6):this.enterRefill())}tickRefill(t){if(this.world.setSnowfallIntensity(Wt(1,3.4,Math.sin(oe(this.stateT/3.4)*Math.PI))),this.stateT>2.2)for(let e of this.spots)e.plant.visible=!0,e.cap.visible=!0;this.stateT>4.2&&(this.world.setSnowfallIntensity(1),this.enterOverview(1.6))}};var uh={low:{texBig:256,shadowMap:512,groundSeg:86,snowflakes:220,maxDpr:1.5,shadows:!0},mid:{texBig:512,shadowMap:1024,groundSeg:130,snowflakes:380,maxDpr:2,shadows:!0},high:{texBig:512,shadowMap:2048,groundSeg:172,snowflakes:560,maxDpr:2,shadows:!0}};function A_(){let i=navigator.userAgent,t=/iPad|iPhone|iPod/.test(i)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,e=/Android/i.test(i),n=t||e,s=navigator.deviceMemory||(n?4:8),r=navigator.hardwareConcurrency||4,a="high";return n&&(a=s>=4&&r>=6?"mid":"low"),!n&&(r<=4||s<=4)&&(a="mid"),{tier:a,...uh[a],mobile:n,iOS:t}}function sf(){let i=document.getElementById("app"),t=document.getElementById("loader"),e=new URLSearchParams(location.search),n=A_(),s=e.get("q");s&&uh[s]&&Object.assign(n,uh[s],{tier:s});let r;try{r=new al({antialias:n.tier!=="low",alpha:!1,stencil:!1,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1})}catch{document.getElementById("fallback").style.display="flex",t.style.display="none";return}if(!r.getContext()){document.getElementById("fallback").style.display="flex",t.style.display="none";return}let a=parseFloat(e.get("dpr")),o=a>0?a:Math.min(window.devicePixelRatio||1,n.maxDpr),l=a>0;r.setPixelRatio(o),r.outputColorSpace=Ne,r.toneMapping=Dr,r.toneMappingExposure=.96,r.shadowMap.enabled=n.shadows,r.shadowMap.type=qi,r.domElement.id="view",i.appendChild(r.domElement);let c=new lr,h=new $e(46,1,.04,620),d=null,u=0;function f(){let x=i.clientWidth||window.innerWidth,T=i.clientHeight||window.innerHeight;r.setSize(x,T,!1);let P=x/T;h.aspect=P,h.fov=P<1?Ji(46+(1-P)*20,46,62):46,h.updateProjectionMatrix(),d&&(d.rig.fov=h.fov,Math.abs(P-u)>.01&&d.refreshPose()),u=P}f(),d=new yl({renderer:r,scene:c,camera:h,container:i,quality:n}),d.rig.fov=h.fov,window.addEventListener("resize",f),window.addEventListener("orientationchange",()=>setTimeout(f,120)),window.visualViewport&&window.visualViewport.addEventListener("resize",f);let g=r.domElement,_=null,p=x=>{let T=g.getBoundingClientRect();return[x.clientX-T.left,x.clientY-T.top]};g.addEventListener("pointerdown",x=>{if(_!==null&&_!==x.pointerId){try{g.releasePointerCapture(_)}catch{}d.onUp()}_=x.pointerId;try{g.setPointerCapture(x.pointerId)}catch{}let[T,P]=p(x);d.onDown(T,P),x.preventDefault()},{passive:!1}),g.addEventListener("pointermove",x=>{if(_!==x.pointerId)return;let[T,P]=p(x);d.onMove(T,P),x.preventDefault()},{passive:!1});let m=x=>{_===x.pointerId&&(_=null,d.onUp(),x.preventDefault())};g.addEventListener("pointerup",m,{passive:!1}),g.addEventListener("pointercancel",m,{passive:!1}),document.addEventListener("touchmove",x=>x.preventDefault(),{passive:!1}),document.addEventListener("gesturestart",x=>x.preventDefault()),g.addEventListener("contextmenu",x=>x.preventDefault());let M=performance.now(),S=0,y=0,w=0,E=!0;document.addEventListener("visibilitychange",()=>{E=!document.hidden,M=performance.now()});function R(){if(requestAnimationFrame(R),!E)return;let x=performance.now(),T=Math.min((x-M)/1e3,1/20);if(M=x,d.update(T),r.render(c,h),!l&&(S+=T,y++,y>=45)){let P=S/y,I=Math.min(window.devicePixelRatio||1,n.maxDpr);P>.0235&&o>1?(w++,w>=2&&(o=Math.max(1,o-.25),r.setPixelRatio(o),f(),w=0)):(P<.0142&&o<I&&(o=Math.min(I,o+.25),r.setPixelRatio(o),f()),w=0),S=0,y=0}}r.compile(c,h),r.render(c,h),R(),t.classList.add("gone"),setTimeout(()=>{t.style.display="none"},700),window.__step=(x=1/60,T=1)=>{for(let P=0;P<T;P++)d.update(x);M=performance.now()},window.__render=()=>r.render(c,h),window.__game=d,window.__renderer=r}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",sf):sf();})();
