/* Wanlong Mountain Atlas. Procedural illustration, not a surveyed terrain model. */
(()=>{'use strict';
const DELIVERY_MODE=/* DELIVERY_MODE */ true;
const $=id=>document.getElementById(id), V=THREE.Vector3, clamp=THREE.MathUtils.clamp, lerp=THREE.MathUtils.lerp;
let seed=76103;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const state={tab:'trails',filter:'all',query:'',selected:null,snow:false,trees:true,skiers:true,routes:false,labels:true,paused:false,intensity:32,wind:18,speed:1,time:'day',quality:'low',mode:'orbit',rideT:0,activeLift:null};
let labelGeneration=0;
let hotelSnowFlow=null,pisteGrading=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced)state.paused=true;
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});}
catch(err){if(DELIVERY_MODE){window.dispatchEvent(new Event('wanlong-webgl-unavailable'));return;}$('loading').hidden=true;const box=document.createElement('div');box.className='error';box.innerHTML='<div><div class="eyebrow">WANLONG MOUNTAIN ATLAS</div><h2>这个雪境需要 WebGL 图形支持</h2><p>请在 Chrome 或 Edge 中启用硬件加速后重新打开。雪道与索道资料仍可在下方查看。</p><button class="primary" id="fallback-sources">阅读资料与来源</button><div class="error-list">'+trails.map(t=>'<p>'+t.name+' · '+levels[t.level].label+' · '+t.length+' m · 均坡 '+(t.avg??'—')+'°</p>').join('')+'</div></div>';document.body.append(box);$('fallback-sources').onclick=()=>{$('sources').hidden=false;$('sources').style.zIndex=70;};document.querySelector('.close-modal').onclick=()=>{$('sources').hidden=true;};return;}
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('scene').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#dce8ec');scene.fog=new THREE.FogExp2('#dce8ec',.000105);
function mapCameraFov(){
 if(innerWidth>760)return 35;
 return innerHeight<=500?30:60;
}
const camera=new THREE.PerspectiveCamera(mapCameraFov(),innerWidth/innerHeight,1,35000);
const hemi=new THREE.HemisphereLight('#d2e5f8','#9dada4',1.65);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d5',3.1);sun.position.set(-2300,2400,1300);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-2500;sun.shadow.camera.right=2500;sun.shadow.camera.top=2200;sun.shadow.camera.bottom=-2200;sun.shadow.camera.near=100;sun.shadow.camera.far=7500;sun.shadow.normalBias=.16;sun.shadow.bias=-.000035;sun.shadow.radius=2;sun.target.position.set(0,100,0);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#c8e5f4',.6);fill.position.set(1800,900,-1700);scene.add(fill);
const mountain=new THREE.Group(),forest=new THREE.Group(),liftGroup=new THREE.Group(),buildings=new THREE.Group(),pisteGroup=new THREE.Group();scene.add(mountain,forest,liftGroup,buildings,pisteGroup);
function xy(p){return[(p[0]-960)*1.65,(p[1]-600)*3.6];}
// Contact points use the actual projected DEM triangles, not a bilinear patch
// that can sit above or below the visible mesh. Source DEM vertices stay unchanged.
const heightCells=new Map();
function heightAt(x,z){
 const c=unprojectGeo(x,z),lon=clamp(c[0],GEO.bounds[0],GEO.bounds[2]),lat=clamp(c[1],GEO.bounds[1],GEO.bounds[3]);
 if(lon!==c[0]||lat!==c[1])[x,z]=projectGeo([lon,lat]);
 const u=(GEO.bounds[2]-lon)/(GEO.bounds[2]-GEO.bounds[0])*(GEO.cols-1),v=(lat-GEO.bounds[1])/(GEO.bounds[3]-GEO.bounds[1])*(GEO.rows-1),i=Math.min(GEO.cols-2,Math.floor(u)),j=Math.min(GEO.rows-2,Math.floor(v)),key=j*GEO.cols+i;
 let cell=heightCells.get(key);if(!cell){cell=[[i,j],[i+1,j],[i,j+1],[i+1,j+1]].map(([xx,yy])=>{const[x,z]=projectGeo([lerp(GEO.bounds[2],GEO.bounds[0],xx/(GEO.cols-1)),lerp(GEO.bounds[1],GEO.bounds[3],yy/(GEO.rows-1))]);return[x,GEO.heights[yy*GEO.cols+xx]/10-GEO.baseElevation,z];});heightCells.set(key,cell);}
 function sample(a,b,c){const dx=x-a[0],dz=z-a[2],bx=b[0]-a[0],bz=b[2]-a[2],cx=c[0]-a[0],cz=c[2]-a[2],det=bx*cz-bz*cx,p=(dx*cz-dz*cx)/det,q=(bx*dz-bz*dx)/det;return{p,q,y:a[1]+p*(b[1]-a[1])+q*(c[1]-a[1])};}
 const first=sample(cell[0],cell[1],cell[2]);return first.p+first.q<=1?first.y:sample(cell[3],cell[2],cell[1]).y;
}
function posAtMap(p,offset=0){const[x,z]=xy(p);return new V(x,heightAt(x,z)+offset,z);}
function material(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.88,metalness:0,...extra});}
const snowMat=material('#f2f6f6',{vertexColors:true}),rockMat=material('#abbec1'),woodMat=material('#877b66'),roofMat=material('#526766'),windowMat=material('#577c88',{roughness:.23,metalness:.25}),warmMat=material('#ead8aa',{emissive:'#e5b16a',emissiveIntensity:.15});
const rawDemMode=/* RAW_DEM_MODE */ true;
const localDemMode=/* LOCAL_DEM_MODE */ false;
/* NATURAL_VALLEYS */
/* GEO_TERRAIN */
if(rawDemMode){
 sourceTerrainPositions=new Float32Array(terrainGeo.attributes.position.array);
 sourceTerrainNormals=new Float32Array(terrainGeo.attributes.normal.array);
 sourceTerrainColours=new Float32Array(terrainGeo.attributes.color.array);
}
else applyNaturalValleyTerrain();
const pathSamples=[],pickables=[];
function lineFromPoints(points,color,opacity=1){const clipped=[];for(let i=1;i<points.length;i++){if(insideExtent(points[i-1])&&insideExtent(points[i]))clipped.push(points[i-1],points[i]);}const g=new THREE.BufferGeometry().setFromPoints(clipped);return new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
function groundLine(points,color,opacity=1){const dense=[];for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/2));for(let j=0;j<steps;j++){const p=a.clone().lerp(b,j/steps);p.y=heightAt(p.x,p.z)+.055;dense.push(p);}}if(points.length){const p=points.at(-1).clone();p.y=heightAt(p.x,p.z)+.055;dense.push(p);}return lineFromPoints(dense,color,opacity);}
function ribbon(points,width,color,opacity=1){const v=[],uv=[],ix=[];for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;for(const side of [-1,1]){const x=p.x+nx*width*.5*side,z=p.z+nz*width*.5*side;v.push(x,heightAt(x,z)+2.2,z);uv.push(side*.5+.5,i/(points.length-1));}if(i<points.length-1){const n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.95,transparent:opacity<1,opacity,side:THREE.DoubleSide,depthWrite:opacity>=1,polygonOffset:true,polygonOffsetFactor:-1}));}
/* GEO_ROUTES */
/* TERRAIN_SURFACE */
let highlight=null,highlightLine=null;
// A screen-space ribbon stays readable at both overview and station scale.
// Its positions come directly from the selected rope, without moving the lift.
function liftSelectionRibbon(lift){
 const points=[];for(let i=0;i<=180;i++)points.push(lift.runtime.cablePoint(i/180));
 const positions=[],other=[],side=[],edgeSides=[],indices=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],n=positions.length/3;
  for(const [p,q,s,e] of [[a,b,-1,-1],[a,b,1,1],[b,a,-1,1],[b,a,1,-1]]){positions.push(...p.toArray());other.push(...q.toArray());side.push(s);edgeSides.push(e);}
  indices.push(n,n+1,n+2,n,n+2,n+3);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('other',new THREE.Float32BufferAttribute(other,3));geometry.setAttribute('side',new THREE.Float32BufferAttribute(side,1));geometry.setAttribute('edgeSide',new THREE.Float32BufferAttribute(edgeSides,1));geometry.setIndex(indices);
 const mat=new THREE.ShaderMaterial({uniforms:{resolution:{value:new THREE.Vector2(innerWidth,innerHeight)},width:{value:8}},vertexShader:`attribute vec3 other;attribute float side;attribute float edgeSide;uniform vec2 resolution;uniform float width;varying float edge;void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);vec4 q=projectionMatrix*modelViewMatrix*vec4(other,1.);vec2 d=(q.xy/q.w-p.xy/p.w)*resolution;float dl=max(length(d),.001);vec2 n=vec2(-d.y,d.x)/dl;edge=edgeSide; p.xy+=n*side*width/resolution*p.w;gl_Position=p;}`,fragmentShader:`varying float edge;void main(){float a=abs(edge);vec3 dark=vec3(.10,.24,.28),gold=vec3(1.,.68,.17),light=vec3(1.,.94,.71);vec3 c=a>.7?dark:(a<.2?light:gold);gl_FragColor=vec4(c,1.);}`,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 // Keep the same disposal interface as the ordinary selected-trail line.
 mat.color=new THREE.Color('#ffad2b');const mesh=new THREE.Mesh(geometry,mat);mesh.frustumCulled=false;mesh.renderOrder=18;mesh.userData.selectionOverlay='lift';return mesh;
}
function clearSelection(){
 for(const m of [highlight,highlightLine])if(m){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
 highlight=highlightLine=null;state.selected=null;setSurfaceSelection(null);$('detail').hidden=true;$('selection-chip').hidden=true;
 if(state.mode==='orbit')document.body.classList.remove('exploring');
 renderList();updateLabels();drawMinimap();
}
function setSettingsOpen(open){
 if(open){toggleCatalogue(false);$('detail').hidden=true;$('legend-panel').hidden=true;}
 $('settings').hidden=!open;$('settings-toggle').classList.toggle('active',open);$('settings-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('settings-open',open);
 if(open)$('settings').scrollTop=0;
}
function syncSelectionControls(){
 const selected=state.selected,show=!!selected&&state.mode==='orbit',close=$('detail').querySelector('.close'),title=$('detail').querySelector('h2')?.textContent||'当前选择',key=[selected?.kind,selected?.id,show,title].join('|');
 if(syncSelectionControls.key===key&&syncSelectionControls.close===close)return;syncSelectionControls.key=key;syncSelectionControls.close=close;
 $('selection-chip').hidden=!show;
 if(show){$('selection-name').textContent=title;$('selection-chip').classList.toggle('is-lift',selected.kind==='lift');$('settings-return').hidden=false;$('settings-return').textContent='返回'+title+'详情';}
 else $('settings-return').hidden=true;
 if(close){close.textContent='收起 ×';close.setAttribute('aria-label','收起详情');close.title='收起详情';}
}
function distanceTrail(x,z){let best=1e9;for(const p of pathSamples){const d=(x-p.x)**2+(z-p.z)**2;if(d<best)best=d;}return Math.sqrt(best);}
function inLiftCorridor(x,z){return lifts.some(l=>{const[a,b]=l.path.map(xy),dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<30;});}
function box(w,h,d,mat,x,y,z,parent=buildings){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function beam(a,b,r,mat,parent=liftGroup){const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new V(0,1,0),delta.normalize());m.castShadow=true;parent.add(m);return m;}
const steelMat=material('#586e73',{roughness:.6,metalness:.38}),cableMat=new THREE.LineBasicMaterial({color:'#526971',transparent:true,opacity:.85}),stationMat=material('#ebe8dc'),redMat=material('#be5448',{roughness:.43,metalness:.15}),glassMat=material('#3f6675',{roughness:.18,metalness:.45}),chairMat=material('#4d666b',{roughness:.5,metalness:.4});
/* FACILITIES */
// Miniature architecture: layered snow roofs and recessed glazing at the foot and on the ridge.
function lodge(p,w,d,h,angle=0){const v=posAtMap(p),group=new THREE.Group();group.position.copy(v);group.rotation.y=angle;buildings.add(group);box(w,h,d,woodMat,0,h/2,0,group);box(w+1.2,1.2,d+1.2,roofMat,0,h+.6,0,group);box(w+2,.35,d+2,material('#e6efec'),0,h+1.37,0,group);box(w*.86,h*.5,1.5,windowMat,0,h*.5,d/2+.9,group);for(let i=0;i<Math.floor(w/9);i++)box(1,h*.52,2,woodMat,-w*.4+i*9,h*.5,d/2+1,group);return group;}
const hutFootprint=GEO.buildings.find(b=>b.id==='259554545').coords.slice(0,-1).map(projectGeo),hutCenter=hutFootprint.reduce((a,p)=>[a[0]+p[0]/hutFootprint.length,a[1]+p[1]/hutFootprint.length],[0,0]),hutEdge=hutFootprint.map((a,i)=>{const b=hutFootprint[(i+1)%hutFootprint.length];return{dx:b[0]-a[0],dz:b[1]-a[1],length:Math.hypot(b[0]-a[0],b[1]-a[1])};}).sort((a,b)=>b.length-a.length)[0],hutAngle=Math.atan2(-hutEdge.dz,hutEdge.dx);const ridgeLodge=lodge(mapPixel(unprojectGeo(...hutCenter)),hutEdge.length,Math.abs(hutPlanArea(hutFootprint))/hutEdge.length,5,hutAngle);function hutPlanArea(p){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;}foundation(ridgeLodge,"ridge-lodge","lodge");registerSolids(ridgeLodge,"ridge-lodge");
/* HOTELS */
// Source footprint outlines belong to the optional reference overlay; they must
// not float across the model's facades and entrances in the normal scene.
// Forest boundary controls do not include legacy building outlines.
/* SUMMIT_BUILDINGS */
/* CABLEWAYS */
// Re-anchor displayed tower foundations to the excavated park surface.
// Source plan positions stay recorded, including unresolved park overlaps.
const parkPylonFoundations=[];
for(const post of liftGroup.children.filter(g=>g.userData.kind==='pylon')){
 const data=post.userData,rt=lifts.find(l=>l.id===data.liftId).runtime,p=rt.cablePoint(data.t);
 if(!menglongPark.contains(p.x,p.z,0))continue;
 const y=menglongPark.surfaceHeight(p.x,p.z),raw=liftSurfaceHeight(p.x,p.z);
 if(Math.abs(y-raw)<.1)continue;
 const owner='pylon-'+data.liftId+'-'+data.index;
 for(let i=solidVolumes.length-1;i>=0;i--)if(solidVolumes[i].owner===owner)solidVolumes.splice(i,1);
 post.traverse(m=>{if(m.geometry&&m.geometry!==pylonWheels)m.geometry.dispose();});post.clear();
 const foot=new V(p.x,y-.4,p.z);detailPylon(post,rt,p,foot);
 const pad=box(2.4,2,2.4,redMat,foot.x,foot.y+1.35,foot.z,post);pad.userData.pylonProtection=true;
 registerSolids(post,owner);parkPylonFoundations.push({liftId:data.liftId,index:data.index,sourceGround:raw,displayGround:y,footY:foot.y,protected:true});
}

/* NIGHT_SCENE */
nightSurface(menglongPark.materials.snow,.85);
nightSurface(menglongPark.materials.skin,.85);
// Two covered magic carpets near the learning zone (schematic station locations).
// Source magic-carpet reference is sampled against the final displayed ground
// in scene-access.js; a raised two-point chord floated across the forecourt.
// One visible-height sampler for people, trees and free camera movement.
const summitGroundCores=hotelDisplaySites.filter(site=>site.kind==='summit');
function displayGroundHeightAt(x,z){
 const pool=scene.userData.reservoir;if(pool&&inPolygon(x,z,pool.polygon))return pool.waterLevel;
 if(pisteGrading){
  for(const site of summitGroundCores){
   const {min,max}=site.siteBounds;
   if(x>=min.x&&x<=max.x&&z>=min.z&&z<=max.z&&inPolygon(x,z,site.footprint))return site.top;
  }
  const graded=pisteGrading.heightAt(x,z);if(graded!==null)return graded;
 }
 if(hotelSnowFlow?.contains(x,z))return hotelSnowFlow.heightAt(x,z);
 const hotel=hotelDisplayGroundHeightAt(x,z);if(hotel!==null)return hotel;
 if(menglongPark.contains(x,z))return menglongPark.surfaceHeight(x,z);
 const ground=heightAt(x,z),station=liftSurfaceHeight(x,z);
 return Math.abs(station-ground)>1e-7?station:visibleTerrainHeightAt(x,z);
}
/* HOTEL_SNOW_FLOW */
/* PISTE_GRADING */
/* SITE_RECONSTRUCTION */
/* FOREST */
// Preserve the separate materials later modified by the night-light system.
const dedicatedMaterials=new Set([...Object.values(facadeMats),...hotelLights,snowMat]);
const staticMaterialKeys=new WeakMap();
function staticMaterialKey(mat){
 if(staticMaterialKeys.has(mat))return staticMaterialKeys.get(mat);
 let key=mat.uuid;
 if(mat.isMeshStandardMaterial&&!mat.transparent&&!mat.clippingPlanes&&mat.colorWrite&&mat.depthWrite&&
    !Object.keys(mat.userData).length&&!dedicatedMaterials.has(mat)&&
    mat.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&
    mat.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey&&
    !mat.emissive.getHex()&&!Object.values(mat).some(value=>value?.isTexture)){
  const {uuid,metadata,name,...appearance}=mat.toJSON();
  key=JSON.stringify([appearance,mat.color.toArray()]);
 }
 staticMaterialKeys.set(mat,key);
 return key;
}
function batchStatic(group){
 group.updateWorldMatrix(true,true);
 const batches=new Map(),originals=[];
 group.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.visible||mesh.parent?.visible===false||
     mesh.parent?.userData.moving||Array.isArray(mesh.material)||mesh.material.map||mesh.material.vertexColors)return;
  const key=staticMaterialKey(mesh.material);
  let batch=batches.get(key);
  if(!batch){
   batch={mat:mesh.material,positions:[],normals:[]};
   batches.set(key,batch);
  }
  const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  batch.positions.push(geometry.attributes.position.array);
  batch.normals.push(geometry.attributes.normal.array);
  geometry.dispose();
  originals.push(mesh);
 });
 for(const mesh of originals){mesh.removeFromParent();mesh.geometry.dispose();}
 for(const batch of batches.values()){
  const length=batch.positions.reduce((sum,p)=>sum+p.length,0);
  const positions=new Float32Array(length),normals=new Float32Array(length);
  let offset=0;
  batch.positions.forEach((source,i)=>{
   positions.set(source,offset);
   normals.set(batch.normals[i],offset);
   offset+=source.length;
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  const mesh=new THREE.Mesh(geometry,batch.mat);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  group.add(mesh);
 }
}
batchStatic(buildings);batchStatic(liftGroup);batchStatic(menglongPark.group);
/* PERFORMANCE */
// Raycaster still intersects explicitly supplied hidden meshes. Picking-only
// ribbons need no GPU draw calls, shader compilation or depth-buffer traffic.
for(const mesh of pickables)if(mesh.isMesh&&!Array.isArray(mesh.material)&&mesh.material.colorWrite===false&&mesh.material.depthWrite===false){
 mesh.visible=false;
 mesh.userData.pickOnly=true;
}
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
// Snow is simulated entirely on the GPU. Two particle scales create depth without per-frame CPU traffic.
const snowCount=7600,snowPositions=new Float32Array(snowCount*3),snowRnd=new Float32Array(snowCount),snowSizes=new Float32Array(snowCount);
for(let i=0;i<snowCount;i++){snowPositions[i*3]=(rand()-.5)*6900;snowPositions[i*3+1]=rand()*2600-80;snowPositions[i*3+2]=(rand()-.5)*5900;snowRnd[i]=rand();snowSizes[i]=2+rand()*4;}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));snowGeo.setAttribute('aRand',new THREE.BufferAttribute(snowRnd,1));snowGeo.setAttribute('aSize',new THREE.BufferAttribute(snowSizes,1));
const snowUniforms={uTime:{value:0},uWind:{value:.18},uOpacity:{value:.7},uDpr:{value:renderer.getPixelRatio()}};
const snowMaterial=new THREE.ShaderMaterial({uniforms:snowUniforms,transparent:true,depthWrite:false,vertexShader:'attribute float aRand;attribute float aSize;uniform float uTime;uniform float uWind;uniform float uDpr;varying float vFade;void main(){vec3 p=position;p.y=mod(position.y-uTime*(12.0+aRand*21.0)+2600.0,2600.0)-80.0;p.x=mod(position.x+3450.0+uTime*uWind*(10.0+aRand*12.0),6900.0)-3450.0;p.z+=sin(uTime*.22+aRand*30.0)*10.0;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uDpr*550.0/(-mv.z),1.0,7.0);vFade=clamp((-mv.z-150.0)/600.0,0.0,1.0)*(.35+aRand*.45);}',fragmentShader:'uniform float uOpacity;varying float vFade;void main(){float d=length(gl_PointCoord-vec2(.5));float a=(1.0-smoothstep(.1,.5,d))*uOpacity*vFade;gl_FragColor=vec4(.98,.99,1.0,a);}',fog:false});
const snow=new THREE.Points(snowGeo,snowMaterial);snow.frustumCulled=false;scene.add(snow);snowGeo.setDrawRange(0,Math.floor(snowCount*.32));
// A few tiny skiers give the piste a human scale; they are deliberately sparse.
const skierCount=32,skierBody=new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.82,.30),material('#bc6756'),skierCount),skierHeads=new THREE.InstancedMesh(new THREE.SphereGeometry(.15,10,7),material('#e8d7b7'),skierCount),skierSkis=new THREE.InstancedMesh(new THREE.BoxGeometry(.60,.055,1.75),material('#4f6e75'),skierCount);const skierGroup=new THREE.Group();skierGroup.name='雪道滑行者';const skierLegs=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,.65,.16),material('#40565c'),skierCount*2);skierGroup.add(skierBody,skierHeads,skierSkis,skierLegs);scene.add(skierGroup);const skiers=Array.from({length:skierCount},(_,i)=>({trail:trails.filter(t=>t.mapped)[i%trails.filter(t=>t.mapped).length],phase:rand(),speed:.006+rand()*.008}));
// Orbit camera uses damping and supports single-pointer orbit plus two-pointer pan/pinch.
const home={theta:.03,phi:1.01,radius:innerWidth<=760?8200:6600,target:new V(0,280,0)};
const orbit={theta:home.theta,phi:home.phi,radius:home.radius,target:home.target.clone()},desired={theta:home.theta,phi:home.phi,radius:home.radius,target:home.target.clone()};
function resetView(top=false){exitExperience(false);document.body.classList.remove('exploring');clearSelection();desired.theta=top?0:home.theta;desired.phi=top?.16:home.phi;desired.radius=top?(innerWidth<=760?6500:5200):(innerWidth<=760?8200:home.radius);desired.target.copy(home.target);$('view-top').classList.toggle('active',top);$('view-home').classList.toggle('active',!top);}
function orbitPosition(){const s=Math.sin(orbit.phi);return new V(Math.sin(orbit.theta)*s*orbit.radius,Math.cos(orbit.phi)*orbit.radius,Math.cos(orbit.theta)*s*orbit.radius).add(orbit.target);}
camera.position.copy(orbitPosition());camera.lookAt(orbit.target);
/* CAMERA_CONTROLS */
const raycaster=new THREE.Raycaster();raycaster.params.Line.threshold=8;let lastHover=0;
function pointerInScene(e){const r=renderer.domElement.getBoundingClientRect();return new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);}
function intersect(e){
 raycaster.setFromCamera(pointerInScene(e),camera);
 const hits=raycaster.intersectObjects(pickables.filter(p=>p.userData.kind!=='trail'),false);
 // Classify the actual ground hit: a two-edge ribbon cannot represent the
 // interior of a graded, variable-width piste accurately.
 const ground=raycaster.intersectObject(terrain)[0];
 if(ground){
  const footprint=pisteFootprintClearance(ground.point.x,ground.point.z);
  const trail=footprint.clearance<=0?trails.find(t=>t.mapped&&t.name===footprint.trail):null;
  if(trail?.mesh)hits.push({...ground,object:trail.mesh});
 }
 return hits.sort((a,b)=>a.distance-b.distance).find(h=>h.object.visible||
  (h.object.userData.pickOnly&&!state.imagery));
}
function pick(e){if(state.mode==='architecture')return;if(state.measuring&&!document.body.classList.contains('foreground-open')){handleMeasurement(e);return;}const hit=intersect(e);if(hit){const d=hit.object.userData;selectItem(d.kind,d.id);}else if(state.selected)clearSelection();}
function hover(e){if(state.mode==='architecture'){$('tooltip').hidden=true;return;}if(performance.now()-lastHover<80)return;lastHover=performance.now();const hit=intersect(e);canvas.style.cursor=hit?'pointer':'grab';if(!hit){$('tooltip').hidden=true;if(DELIVERY_MODE)return;const groundHit=raycaster.intersectObject(terrain)[0];if(groundHit){const c=unprojectGeo(groundHit.point.x,groundHit.point.z);$('coordinate-readout').textContent=c[1].toFixed(5)+'°N / '+c[0].toFixed(5)+'°E · DEM '+Math.round(heightAt(groundHit.point.x,groundHit.point.z)+GEO.baseElevation)+' m · 模型 '+Math.round(groundHit.point.y+GEO.baseElevation)+' m';}return;}const d=hit.object.userData,item=(d.kind==='trail'?trails:d.kind==='hotel'?hotels:d.kind==='landscape'?LANDSCAPE_ITEMS:lifts).find(t=>t.id===d.id);$('tooltip').textContent=item.name+' · '+(d.kind==='trail'?trailGrade(item).label+' / '+item.length+' m':d.kind==='hotel'?(DELIVERY_MODE?'酒店':'建筑与住宿资料'):d.kind==='landscape'?(DELIVERY_MODE?'景点与设施':'公园形态示意'):(item.capacity?item.capacity+'人'+(item.type==='gondola'?'吊箱':'吊椅'):'索道'));$('tooltip').style.left=Math.min(innerWidth-190,e.clientX+14)+'px';$('tooltip').style.top=Math.max(10,e.clientY-33)+'px';$('tooltip').hidden=false;}
function trailGrade(t){return t.officialGrade==='double'?{label:'双钻高级',symbol:'◆◆',color:levels.hard.color}:levels[t.level];}
function renderList(){const isTrail=state.tab==='trails',isHotel=state.tab==='hotels',isLandscape=state.tab==='landscape',kind=isTrail?'trail':isHotel?'hotel':isLandscape?'landscape':'lift';const data=(isTrail?trails:isHotel?hotels:isLandscape?LANDSCAPE_ITEMS:lifts).filter(t=>(!DELIVERY_MODE||!isLandscape||guestLandscapeVisible(t))&&(!state.query||t.name.includes(state.query)||String(isTrail?t.mapRef:t.id)===state.query)&&(state.filter==='all'||!isTrail||(state.filter==='double'?t.officialGrade==='double':t.level===state.filter)));if(isTrail)data.sort((a,b)=>a.mapRef-b.mapRef);$('list').innerHTML=data.length?data.map(t=>{const active=state.selected?.kind===kind&&state.selected.id===t.id;return '<button class="row '+(active?'active':'')+'" data-id="'+t.id+'" aria-pressed="'+active+'"><span class="num">'+String(isTrail?t.mapRef:t.id).padStart(2,'0')+'</span><span class="marker" style="color:'+(isTrail?levels[t.level].color:isHotel||isLandscape?'#ab8e5c':'#b46052')+'">'+(isTrail?trailGrade(t).symbol:isHotel?'▥':isLandscape?'♧':t.type==='gondola'?'▣':'⊓')+'</span><span class="name">'+t.name+'</span><span class="meta">'+(isHotel||isLandscape?'↗':(t.length?((t.length/1000).toFixed(t.length%1000===0?1:2)+' km') :(DELIVERY_MODE?'—':'坐标线')))+'</span></button>';}).join(''):'<div style="padding:25px 14px;color:#81999c;font-size:11px;line-height:2">没有找到这个项目。<br>试试“金龙”“龙宫”或“1”。</div>';document.querySelectorAll('#list .row').forEach(b=>b.onclick=()=>selectItem(kind,Number(b.dataset.id)));}
function cell(label,value,unit=''){return '<div><label>'+label+'</label><strong>'+value+'</strong><small>'+unit+'</small></div>';}
function selectItem(kind,id,focus=true){if(innerWidth<=760)setSettingsOpen(false);if(state.mode==='architecture'&&!(kind==='hotel'&&id===5))exitExperience(false);if(kind==='hotel'){selectHotel(id,focus);return;}if(kind==='landscape'){selectLandscape(id);return;}if(kind==='trail'&&!trails.find(t=>t.id===id)?.mapped){selectUnmappedTrail(id);return;}state.selected={kind,id};document.body.classList.add('exploring');$('detail').classList.remove('hotel-detail');if(highlight){pisteGroup.remove(highlight);highlight.geometry.dispose();highlight.material.dispose();highlight=null;}if(highlightLine){pisteGroup.remove(highlightLine);highlightLine.geometry.dispose();highlightLine.material.dispose();highlightLine=null;}
 const d=$('detail');d.hidden=false;let item;
 if(kind==='trail'){item=trails.find(t=>t.id===id);const level=trailGrade(item);setSurfaceSelection(item.id);highlight=trailRibbon(item,'#c4a66d',.43,.9);highlight.material.colorWrite=false;highlight.material.depthWrite=false;highlight.position.y=3;pisteGroup.add(highlight);highlightLine=lineFromPoints((item.displayPoints||item.points).map(p=>new V(p.x,displayGroundHeightAt(p.x,p.z)+5,p.z)),'#b49255',.85);pisteGroup.add(highlightLine);
  const alt=item.officialAltitudeStatus==='printed-anomaly'?'待核实':item.alt??'—';const metrics=currentTrailMetrics(item),profile=metrics.points.filter((_,i)=>i%3===0||i===metrics.points.length-1),min=Math.min(...profile.map(p=>p.y)),max=Math.max(...profile.map(p=>p.y)),den=Math.max(30,max-min);const pts=profile.map((p,i)=>(p.routeDistance/Math.max(metrics.length,.001)*236).toFixed(1)+','+(62-(p.y-min)/den*50).toFixed(1)).join(' ');
  d.innerHTML='<div class="detail-top"><div class="eyebrow">MAP ROUTE '+String(item.mapRef).padStart(2,'0')+'</div><button class="close" aria-label="关闭详情">×</button></div><h2>'+item.name+'</h2><div class="detail-sub">沿着雪的纹理，进入山间。</div><div class="badge"><span style="color:'+level.color+'">'+level.symbol+'</span>'+level.label+'雪道 · 2026.09 官方图分级</div><div class="data-grid">'+cell('资料长度',item.length,'m')+cell('最高海拔',alt,item.officialAltitudeStatus==='printed-anomaly'||item.alt===null?'':'m')+cell('平均坡度',item.avg??'—',item.avg===null?'':'°')+cell('最大坡度',item.max??'—',item.max===null?'':'°')+'</div><div class="profile"><div class="profile-title"><span>模型雪面剖面</span><span>模型高程 · 米</span></div><svg viewBox="0 0 236 74" preserveAspectRatio="none" aria-label="当前模型雪面高程剖面"><defs><linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b5cfc9" stop-opacity=".55"/><stop offset="1" stop-color="#b5cfc9" stop-opacity="0"/></linearGradient></defs><path d="M0,68 L'+pts.replaceAll(' ',' L')+' L236,68Z" fill="url(#profile-fill)"/><polyline points="'+pts+'" fill="none" stroke="#83aaa3" stroke-width="1.5"/><path d="M0 68H236" stroke="#a8c0c0" stroke-width=".4"/></svg></div><p class="detail-note">'+('名称、路标号、参数采用用户提供的2026.09官方高清图。表格斜杠项保留缺失；几何走向已对照审核后的卫星拼接图校准。'+(item.officialAltitudeNote||''))+'</p><div class="profile-title"><span>模型坡面长 '+Math.round(metrics.length)+' m</span><span>模型海拔 '+Math.round(metrics.min)+'–'+Math.round(metrics.max)+' m</span></div><p class="detail-note">卫星核对路线 / 公开 DEM 与局部场地修整；资料长度可能包含不同分段，不对坐标强行拉伸。宽度按有比例尺影像逐段估读：约 '+Math.round(item.widthRecord.min/5)*5+'–'+Math.round(item.widthRecord.max/5)*5+' m；'+(item.widthRecord.status==='partly-provisional'?'局部边界待核实。':'影像日期不明，非当前雪季测绘。')+'</p><p class="detail-note">'+item.widthRecord.note+'</p><button class="primary" id="experience">▷ 沿道滑行</button><a class="source-link" href="'+SOURCE+'" target="_blank" rel="noopener">既有网页资料 ↗</a><button class="source-link" id="trail-official-source">查看2026.09官方图参数表 ↗</button><p class="detail-note">地理要素：'+item.geoName+'</p>'+coordinateSourceLink(item.geoSources);
  $('experience').onclick=()=>startSki(item);$('trail-official-source').onclick=()=>focusOfficialMapRegion(.35,.82,5);
 }else{setSurfaceSelection(null);item=lifts.find(t=>t.id===id);if(item.conflict){selectUnverifiedLift(item,focus);return;}const rt=item.runtime;highlightLine=liftSelectionRibbon(item);pisteGroup.add(highlightLine);d.innerHTML='<div class="detail-top"><div class="eyebrow">CABLEWAY '+String(id).padStart(2,'0')+'</div><button class="close" aria-label="关闭详情">×</button></div><h2>'+item.name+'</h2><div class="detail-sub">越过林海，向山顶靠近。</div><div class="badge">'+(item.type==='gondola'?'▣ '+item.capacity+' 人吊箱':'⊓ '+item.capacity+' 人吊椅')+'</div><div class="data-grid">'+cell('线路长度',item.length,'m')+cell('垂直落差',item.drop,'m')+cell('最高运行速度',item.speed,'m/s')+cell('每小时运力',item.flow,'人')+'</div><div class="profile"><div class="profile-title"><span>公开参考运营时间</span><span>非实时</span></div><p class="guest-description" style="font-family:Georgia,serif;font-size:22px;letter-spacing:1px;margin:10px 0 14px">'+item.hours+'</p><div class="profile-title"><span>理论单程行程 ≈ '+Math.ceil(item.length/item.speed/60)+' 分钟</span></div></div><p class="detail-note">按线路长度 ÷ 最高速度估算，不含站内减速及停机。车数、车距为演示；保留原始塔位与用户确认点，站口过渡及缺资料塔位仍为模拟。具体运行以现场公告为准。</p><button class="primary" id="experience">▷ 乘坐这条缆车</button><a class="source-link" href="'+SOURCE+'" target="_blank" rel="noopener">索道设备参数来源 · 2026.10 ↗</a>';$('experience').onclick=()=>startLift(item);}
 if(kind==='lift')addStationViews(item,d);
 d.querySelector('.close').onclick=clearSelection;
 if(innerWidth<=760)$('sidebar').classList.add('mobile-hidden');
 if(focus&&state.mode==='orbit'){if(kind==='trail'){const mid=item.curve.getPoint(.45);desired.target.copy(mid).add(new V(0,40,0));desired.radius=Math.max(1400,Math.min(4500,item.modelLength*1.4));desired.phi=.88;}else{desired.target.copy(item.runtime.a).lerp(item.runtime.b,.5);desired.radius=3400;desired.phi=1.02;}}
 renderList();updateLabels();drawMinimap();
}
const catalogueTabs=[['trail-tab','trails','雪道'],['lift-tab','lifts','索道'],['hotel-tab','hotels','酒店'],['landscape-tab','landscape','林野与公园']];
function syncCatalogueTabs(tab){
 for(const [id,key,label] of catalogueTabs){
  const selected=tab===key,button=$(id);
  button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));
  button.tabIndex=selected?0:-1;button.setAttribute('aria-controls','list');
  if(selected){$('list').setAttribute('aria-labelledby',id);$('search').setAttribute('aria-label','搜索'+label);}
 }
}
$('list').setAttribute('role','tabpanel');
for(const [id] of catalogueTabs)$(id).addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();
 const current=catalogueTabs.findIndex(([key])=>key===id);
 const next=e.key==='Home'?0:e.key==='End'?catalogueTabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+catalogueTabs.length)%catalogueTabs.length;
 const [target,tab]=catalogueTabs[next];switchTab(tab);$(target).focus();
});
syncCatalogueTabs(state.tab);
function switchTab(tab){state.tab=tab;state.query='';state.filter='all';$('search').value='';$('search').placeholder=tab==='trails'?'寻找一条雪道…':tab==='hotels'?'寻找一间酒店…':tab==='landscape'?'查找林野与公园…':'寻找一条索道…';syncCatalogueTabs(tab);$('filters').hidden=tab!=='trails';document.querySelectorAll('#filters button').forEach(b=>b.classList.toggle('active',b.dataset.level==='all'));if(tab==='hotels'){exitExperience(false);desired.target.set(0,50,1060);desired.radius=2850;desired.phi=1.0;desired.theta=.07;document.body.classList.add('exploring');}renderList();}
$('trail-tab').onclick=()=>switchTab('trails');$('lift-tab').onclick=()=>switchTab('lifts');$('hotel-tab').onclick=()=>switchTab('hotels');$('landscape-tab').onclick=()=>switchTab('landscape');$('search').oninput=e=>{state.query=e.target.value.trim();renderList();};document.querySelectorAll('#filters button').forEach(b=>b.onclick=()=>{state.filter=b.dataset.level;document.querySelectorAll('#filters button').forEach(bb=>bb.classList.toggle('active',bb===b));renderList();});
// Selected route plus a small set of place labels keep the landscape legible.
const labelData=[{text:'<span>红花梁 · 公开标高</span><strong>2,110.3 <small>m</small></strong>',p:posAtMap(mapPixel([115.396711,40.9540773]),100),summit:true},{text:'猛龙公园 · 形态示意',p:menglongPark.center.clone().add(new V(0,22,0)),park:true,maxDistance:2400},{text:'万龙木屋',p:posAtMap(mapPixel([115.39770,40.95391]),22),guide:13,maxDistance:1700},{text:'五索山脚站',p:posAtMap(mapPixel([115.3821863,40.9669557]),42),maxDistance:1600},...hotels.filter(h=>h.id!==6&&h.id!==5&&!h.locationUnverified).map(h=>({text:h.name,p:h.modelCenter.clone().add(new V(0,h.id===3?55:h.id===4?50:h.id===6?20:44,0)),hotel:h.id}))];
function updateLabels(){labelGeneration++;const labels=$('labels');labels.innerHTML='';labelData.forEach(l=>{const el=document.createElement(l.hotel||l.trail||l.officialFeatureId!==undefined||l.wild||l.park||l.guide||l.summitFacility||l.bike!==undefined?'button':'div');el.className=l.summit?'summit-label':'map-label'+(l.hotel?' hotel-pin':'')+(l.trail?' trail-pin':'')+(l.wild?' wild-zone-label':'')+(l.park?' park-pin':'')+(l.guide||l.summitFacility||l.bike!==undefined?' facility-pin':'');el.innerHTML=l.text;if(l.trail){el.setAttribute('aria-label','查看'+l.text);el.onclick=()=>selectItem('trail',l.trail);}if(l.officialFeatureId!==undefined)el.onclick=()=>officialMapFeatures.show(l.officialFeatureId);if(l.hotel){el.setAttribute('aria-label','查看'+l.text);el.onclick=()=>selectHotel(l.hotel);}if(l.park){el.setAttribute('aria-label',DELIVERY_MODE?'查看猛龙公园':'查看猛龙公园形态示意');el.onclick=()=>selectLandscape(4);}if(l.bike!==undefined){el.setAttribute('aria-label','查看'+l.text);el.onclick=()=>{if(innerWidth<=760)setSettingsOpen(false);selectBikeRoutes(l.bike);};}if(l.guide){el.setAttribute('aria-label','查看'+l.text);el.onclick=()=>selectLandscape(l.guide);}if(l.summitFacility){el.setAttribute('aria-label','查看'+l.text);el.onclick=()=>{if(innerWidth<=760)setSettingsOpen(false);selectSummitFacility(l.summitFacility);};}if(l.wild){el.setAttribute('aria-label','查看野雪'+l.wild+'区参考');el.onclick=()=>selectWildZone(l.wild);}labels.append(el);l.el=el;});if(state.selected?.kind==='trail'&&trails.find(t=>t.id===state.selected.id)?.mapped){const t=trails.find(t=>t.id===state.selected.id);const l={trail:t.id,p:(()=>{const p=t.curve.getPoint(.45);p.y=displayGroundHeightAt(p.x,p.z)+8;return p;})(),text:String(t.mapRef).padStart(2,'0')+' '+t.name};const el=document.createElement('div');el.className='map-label selected';el.textContent=l.text;labels.append(el);l.el=el;labels.current=l;}else labels.current=null;if(state.selected?.kind==='lift'){const l=lifts.find(l=>l.id===state.selected.id);if(l){const p=l.runtime.cablePoint(.5).add(new V(0,20,0)),el=document.createElement('div');el.className='map-label selected lift-selected-label';el.textContent=l.name+' · 已选中';labels.append(el);labels.current={p,lift:l.id,text:el.textContent,el};}}}
let compassAngle=null;
function updateCompass(){
 const compass=document.querySelector('.compass');compass.hidden=state.mode==='architecture';
 // A heading indicator must not depend on pitch, zoom or ground avoidance.
 // Orbit yaw also remains well-defined directly above the target.
 const m=camera.matrixWorld.elements;
 let heading=compassAngle??180;
 if(state.mode==='orbit'||state.mode==='architecture')heading=180+orbit.theta*180/Math.PI;
 else if(Math.hypot(m[8],m[10])>1e-4)heading=Math.atan2(m[2],-m[0])*180/Math.PI;
 const angle=compassAngle===null?heading:compassAngle+((heading-compassAngle+180)%360+360)%360-180;
 compassAngle=angle;
 $('compass-needle').setAttribute('transform','rotate('+angle+' 20 20)');
 $('compass-north').setAttribute('transform','rotate('+(-angle)+' 20 7)');
}
function positionLabels(){if(state.mode==='architecture'){$('labels').hidden=true;$('coordinate-readout').textContent='独立建筑展示 · 无地理坐标';return;}$('labels').hidden=false;const all=$('labels').current?[...labelData,$('labels').current]:labelData;const dir=camera.getWorldDirection(new V()),occupied=[];for(const l of all){const p=l.p.clone().project(camera),front=l.p.clone().sub(camera.position).dot(dir)>0,x=sceneViewport.left+(p.x*.5+.5)*sceneViewport.width,y=sceneViewport.top+(-p.y*.5+.5)*sceneViewport.height;let visible=state.labels&&front&&p.z<1&&p.x>-.95&&p.x<.95&&p.y>-.9&&p.y<.88;if(l.officialLayer)visible=visible&&officialMapFeatures.labelLayer.visible;if(l.maxDistance)visible=visible&&camera.position.distanceTo(l.p)<l.maxDistance;if(l.bike!==undefined)visible=visible&&bikeReference.visible;if(l.wild)visible=visible&&wildReference.visible;if(l.hotel)visible=visible&&state.mode==='orbit';if(state.mode==='ski'||state.mode==='lift')visible=visible&&camera.position.distanceTo(l.p)<1800;const w=l.wild?28:l.summit?120:Math.min(190,l.text.replace(/<[^>]*>/g,'').length*9+18),h=l.summit?45:25,rect=[x-w/2,y-h,x+w/2,y];visible=visible&&rect[0]>=sceneViewport.left+4&&rect[2]<=sceneViewport.left+sceneViewport.width-4&&rect[1]>=sceneViewport.top+4&&rect[3]<=sceneViewport.top+sceneViewport.height-4;if(visible&&occupied.some(r=>rect[0]<r[2]+4&&rect[2]>r[0]-4&&rect[1]<r[3]+4&&rect[3]>r[1]-4))visible=false;if(visible)occupied.push(rect);l.el.style.display=visible?'block':'none';l.el.style.left=x+'px';l.el.style.top=y+'px';}}
const mini=$('minimap'),ctx=mini.getContext('2d');function miniCoord(p){return[(p.x-GEO.extent[0])/(GEO.extent[2]-GEO.extent[0])*268,(p.z-GEO.extent[1])/(GEO.extent[3]-GEO.extent[1])*170];}
function drawMinimap(){ctx.clearRect(0,0,268,170);ctx.strokeStyle=state.time==='night'?'#698b9140':'#b7cdcc80';ctx.lineWidth=.8;for(let r=1;r<5;r++){ctx.beginPath();ctx.ellipse(134,83,120-r*17,73-r*9,0,0,Math.PI*2);ctx.stroke();}trails.forEach(t=>{ctx.beginPath();t.points.forEach((p,i)=>{const[x,y]=miniCoord(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=state.selected?.kind==='trail'&&state.selected.id===t.id?'#b18e52':levels[t.level].color;ctx.globalAlpha=state.selected?.id===t.id?1:.42;ctx.lineWidth=state.selected?.id===t.id?2.6:1;ctx.stroke();});ctx.globalAlpha=.6;ctx.strokeStyle='#bd6f60';lifts.forEach(l=>{const[a,b]=[l.runtime.a,l.runtime.b].map(miniCoord);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();});ctx.globalAlpha=1;}
mini.onclick=e=>{const r=mini.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*268,y=(e.clientY-r.top)/r.height*170;let best=13,trail=null;trails.forEach(t=>t.points.forEach(p=>{const[a,b]=miniCoord(p),d=Math.hypot(x-a,y-b);if(d<best){best=d;trail=t;}}));if(trail)selectItem('trail',trail.id);};
function toast(text){if(DELIVERY_MODE){if(/OSM|DEM|测绘|核验|校核|候选|模型|轮廓|建模/.test(text))text='已显示相关区域';text=text.replace('当前预览不支持全屏，可在浏览器中打开 HTML。','当前环境不支持全屏');}$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,2700);}
let modalFocus=null;function openSources(){modalFocus=document.activeElement;$('sources').hidden=false;document.querySelector('.close-modal').focus();}
function closeSources(){$('sources').hidden=true;modalFocus?.focus();}
$('about').onclick=openSources;$('settings-about').onclick=openSources;document.querySelector('.close-modal').onclick=closeSources;$('sources').onclick=e=>{if(e.target===$('sources'))closeSources();};
$('sources').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const f=[...$('sources').querySelectorAll('button,a[href]')],first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
function toggleCatalogue(force){const open=force??document.body.classList.contains('catalog-collapsed');document.body.classList.toggle('catalog-collapsed',!open);$('sidebar').hidden=false;$('sidebar').classList.toggle('mobile-hidden',!open);$('toggle-list').setAttribute('aria-expanded',open);if(open){setSettingsOpen(false);$('detail').hidden=true;$('legend-panel').hidden=true;}} $('toggle-list').onclick=()=>toggleCatalogue();$('catalog-close').onclick=()=>toggleCatalogue(false);$('interface-toggle').onclick=()=>{const clean=document.body.classList.toggle('clean-view');$('interface-toggle').textContent=clean?'显示菜单':'收起面板';$('interface-toggle').setAttribute('aria-pressed',clean);};
$('view-home').onclick=()=>resetView();$('view-top').onclick=()=>resetView(true);$('zoom-in').onclick=()=>{if(state.mode==='lift'||state.mode==='ski'){camera.fov=rideLook.fov=Math.max(28,camera.fov-6);camera.updateProjectionMatrix();return;}if(state.mode!=='orbit'&&state.mode!=='architecture')exitExperience(false);desired.radius=Math.max(8,desired.radius*.8);};$('zoom-out').onclick=()=>{if(state.mode==='lift'||state.mode==='ski'){camera.fov=rideLook.fov=Math.min(75,camera.fov+6);camera.updateProjectionMatrix();return;}if(state.mode!=='orbit'&&state.mode!=='architecture')exitExperience(false);desired.radius=Math.min(24000,desired.radius*1.25);};
$('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('当前预览不支持全屏，可在浏览器中打开 HTML。');}};
function toggleSnow(){toggleEnvironmentSnow();}
$('snow-toggle').onclick=toggleSnow;
function togglePause(){state.paused=!state.paused;$('play-toggle').classList.toggle('active',state.paused);$('play-toggle').setAttribute('aria-pressed',state.paused);$('play-toggle').innerHTML='<span class="icon">'+(state.paused?'▷':'Ⅱ')+'</span><span class="word">'+(state.paused?'继续':'暂停')+'</span>';}
$('play-toggle').onclick=togglePause;if(state.paused){state.paused=false;togglePause();}
$('settings-toggle').onclick=()=>setSettingsOpen($('settings').hidden);$('settings-close').onclick=()=>setSettingsOpen(false);$('settings-return').onclick=()=>{setSettingsOpen(false);$('detail').hidden=false;};$('selection-clear').onclick=clearSelection;$('dining-toggle').addEventListener('click',()=>{clearSelection();if(innerWidth<=760)setSettingsOpen(false);},true);$('selection-detail').onclick=()=>{setSettingsOpen(false);$('detail').hidden=false;};$('detail').addEventListener('click',e=>{if(e.target.closest('.close')){e.preventDefault();e.stopImmediatePropagation();$('detail').hidden=true;$('selection-detail').focus();}},true);
$('snow-range').oninput=e=>{state.intensity=Number(e.target.value);snowGeo.setDrawRange(0,Math.floor(snowCount*state.intensity/100));$('snow-value').value=state.intensity===0?'无雪':state.intensity<35?'轻雪':state.intensity<70?'纷雪':'大雪';if(!state.snow&&state.intensity>0)toggleSnow();};
$('wind-range').oninput=e=>{state.wind=Number(e.target.value);snowUniforms.uWind.value=state.wind/100;$('wind-value').value=state.wind<30?'微风':state.wind<65?'山风':'劲风';};
$('speed-range').oninput=e=>{state.speed=Number(e.target.value);$('speed-value').value=state.speed+'×';};
function switchControl(id,key,apply){$(id).onclick=()=>{state[key]=!state[key];$(id).setAttribute('aria-checked',state[key]);apply(state[key]);};}
switchControl('trees-switch','trees',v=>{treeSnowCaps.forEach(m=>m.visible=v);renderer.shadowMap.needsUpdate=true;});switchControl('skiers-switch','skiers',v=>{skierGroup.visible=v;});switchControl('routes-switch','routes',v=>setSurfaceRouteColours(v));switchControl('labels-switch','labels',()=>positionLabels());
const palettes={day:{bg:'#dce8ec',sun:'#fff0d5',sunPower:3.1,hemi:1.65,exposure:.96,sunPos:[-2300,2400,1300],snow:.7},golden:{bg:'#e8dcd0',sun:'#ffc382',sunPower:3.4,hemi:1.35,exposure:1.0,sunPos:[-2800,1250,-600],snow:.55},night:{bg:'#080c15',sun:'#b7c7dd',sunPower:.13,hemi:.18,exposure:1.1,sunPos:[-1600,2200,1200],snow:.72}};
function setTime(time){setEnvironmentTimePreset(time);}
document.querySelectorAll('#time-segments button').forEach(b=>b.onclick=()=>setTime(b.dataset.time));
function setQuality(q){state.quality=q;const p=q==='low'?1:q==='high'?Math.min(devicePixelRatio,2):Math.min(devicePixelRatio,1.65);renderer.setPixelRatio(p);snowUniforms.uDpr.value=p;renderer.shadowMap.enabled=q!=='low';renderer.shadowMap.needsUpdate=true;$('quality-label').value={low:'流畅',auto:'自适应',high:'精细'}[q];document.querySelectorAll('#quality-segments button').forEach(b=>b.classList.toggle('active',b.dataset.quality===q));}
document.querySelectorAll('#quality-segments button').forEach(b=>b.onclick=()=>setQuality(b.dataset.quality));
function showRide(title,subtitle){if(DELIVERY_MODE)subtitle='拖动环视 · Esc 退出';document.body.classList.add('exploring');$('ride-title').innerHTML=title+'<small>'+subtitle+'</small>';$('ride-bar').hidden=false;$('detail').hidden=true;$('settings').hidden=true;$('settings-toggle').classList.remove('active');$('settings-toggle').setAttribute('aria-expanded','false');$('hint').hidden=true;$('tooltip').hidden=true;}
function resetRideLook(){rideLook.yaw=rideLook.pitch=rideLook.targetYaw=rideLook.targetPitch=0;camera.fov=rideLook.fov=innerWidth<=760?60:50;camera.updateProjectionMatrix();}
function applyRideLook(p,ahead,realDt){rideLook.yaw=lerp(rideLook.yaw,rideLook.targetYaw,1-Math.exp(-realDt*9));rideLook.pitch=lerp(rideLook.pitch,rideLook.targetPitch,1-Math.exp(-realDt*9));const d=ahead.clone().sub(p),yaw=Math.atan2(d.x,d.z)+rideLook.yaw,pitch=clamp(Math.atan2(d.y,Math.hypot(d.x,d.z))*(state.mode==='lift'?.35:1)+(state.mode==='lift'?-.10:0)+rideLook.pitch,-1.4,1.4);lookTarget.copy(camera.position).add(new V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(80));}
function startLift(lift){state.mode='lift';state.activeLift=lift;const rt=lift.runtime,turn=Math.PI*laneWidth/(2*rt.length+2*Math.PI*laneWidth),straight=.5-turn;let best=Infinity,index=0;for(let i=0;i<rt.count;i++){const u=rt.vehicleU(rt.phase+i/rt.count);if(u<straight&&u<best){best=u;index=i;}}state.rideIndex=index;state.rideT=best/straight;resetRideLook();const boarding=rt.loopPoint(best).p;boarding.y-=lift.type==='gondola'?3.9:2.3;camera.position.copy(boarding);showRide(lift.name+' · 林海上空','拖动自由环视 · 滚轮调视野 · Esc / 退出乘坐');toast('拖动可左右环视，点击不会退出乘坐');}
let skiTrail=null,skiRideLength=1,skiRideSpeedKmh=30;
function startSki(t){state.mode='ski';state.rideT=0;skiTrail=t;skiRideLength=Math.max(1,t.curve.getLength());resetRideLook();showRide(t.name+' · 随雪而下','拖动环视 · 滑行速度为示意 · Esc 退出');$('ski-speed-control').hidden=false;$('ski-speed-range').value=skiRideSpeedKmh;$('ski-speed-value').value=skiRideSpeedKmh+' km/h';toast('已进入沿道滑行视角');}
$('ski-speed-range').oninput=e=>{skiRideSpeedKmh=Number(e.target.value);$('ski-speed-value').value=skiRideSpeedKmh+' km/h';};
function startTour(){if(state.mode==='tour'){exitExperience();return;}state.mode='tour';state.rideT=0;$('tour').classList.add('active');showRide('山野漫游 · 山林之间','环山镜头约 65 秒 · 可随时退出');}
$('tour').onclick=startTour;
function exitExperience(returnHome=true){const previous=state.mode;if(previous==='lift'||previous==='ski'){camera.fov=mapCameraFov();camera.updateProjectionMatrix();}state.mode='orbit';$('labels').hidden=false;if(previous==='architecture'){referenceState();}$('ride-bar').hidden=true;$('ski-speed-control').hidden=true;$('hint').hidden=false;$('tour').classList.remove('active');if(previous!=='orbit'){if(returnHome){desired.target.copy(home.target);desired.theta=home.theta;desired.phi=home.phi;desired.radius=home.radius;}else{const delta=camera.position.clone().sub(orbit.target);orbit.radius=desired.radius=clamp(delta.length(),8,24000);orbit.theta=desired.theta=Math.atan2(delta.x,delta.z);orbit.phi=desired.phi=clamp(Math.acos(clamp(delta.y/delta.length(),-1,1)),.015,1.565);}}}
$('exit-ride').onclick=()=>exitExperience();
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('reference-modal').hidden){$('reference-modal').hidden=true;return;}if(!$('sources').hidden){closeSources();return;}if(state.mode!=='orbit')exitExperience();else if(!$('settings').hidden){setSettingsOpen(false);}else clearSelection();}if(['INPUT','SELECT','TEXTAREA','BUTTON','A'].includes(document.activeElement.tagName)||!$('sources').hidden)return;if(e.code==='Space'){e.preventDefault();togglePause();}if(e.key.toLowerCase()==='h')resetView();});
let previousWidth=innerWidth;addEventListener('resize',()=>{if(previousWidth>760&&innerWidth<=760)toggleCatalogue(false);previousWidth=innerWidth;camera.fov=mapCameraFov();sceneFrameKey='';updateSceneFraming();});
/* GEO_UI */
/* GEO_REFERENCE */
/* BIKE_PERSPECTIVE */
/* MAP_FACILITIES */
renderList();updateLabels();drawMinimap();
toggleCatalogue(false);
const sceneViewport={left:0,top:0,width:innerWidth,height:innerHeight};
const dockPanelIds=['sidebar','detail','settings','legend-panel','dining-panel','official-features-panel'];
let sceneFrameKey='';
let frameLayoutStamp='',frameLayoutChecked=0;
function updateSceneFraming(){
 const stamp=[innerWidth,innerHeight,document.body.className,...dockPanelIds.flatMap(id=>[$(id).hidden,$(id).className])].join('|'),now=performance.now();
 if(stamp===frameLayoutStamp&&now-frameLayoutChecked<200)return;
 frameLayoutStamp=stamp;frameLayoutChecked=now;
 const clean=document.body.classList.contains('clean-view'),mobile=innerWidth<=760,sheet=mobile&&innerHeight>500;
 document.body.classList.toggle('settings-open',!$('settings').hidden);syncSelectionControls();
 let left=0,right=innerWidth,top=0,bottom=innerHeight;
 if(!clean){
  top=Math.ceil(document.querySelector('.top').getBoundingClientRect().bottom)+12;
  const toolbarTop=document.querySelector('.toolbar').getBoundingClientRect().top;
  bottom=Math.floor(toolbarTop)-8;
  document.documentElement.style.setProperty('--header-bottom',top+'px');
  document.documentElement.style.setProperty('--dock-inset',innerHeight-bottom+'px');
  for(const id of dockPanelIds){
   const el=$(id);if(el.hidden||getComputedStyle(el).display==='none')continue;
   const r=el.getBoundingClientRect();
   if(sheet)bottom=Math.min(bottom,r.top-12);
   else left=Math.max(left,r.right+16);
  }
 }
 const width=Math.max(1,Math.round(right-left)),height=Math.max(1,Math.round(bottom-top));
 const framingAspect=mobile?.75:1.25;
 const zoom=['orbit','architecture'].includes(state.mode)?Math.min(1,width/height/framingAspect):1;
 const key=[left,top,width,height,zoom].join(',');if(key===sceneFrameKey)return;
 Object.assign(sceneViewport,{left,top,width,height});
 const el=$('scene');Object.assign(el.style,{inset:'auto',left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
 camera.clearViewOffset();camera.aspect=width/height;camera.zoom=zoom;camera.updateProjectionMatrix();
 renderer.setSize(width,height);sceneFrameKey=key;
 // Decorative text follows the visible canvas, never a floating side panel.
 document.documentElement.style.setProperty('--scene-left',left+'px');
 document.documentElement.style.setProperty('--scene-top',top+'px');document.documentElement.style.setProperty('--scene-width',width+'px');
 document.documentElement.style.setProperty('--scene-bottom',innerHeight-top-height+'px');
}
// Camera interpolation uses delta time; simulations pause independently of pointer navigation.
let previousTime=performance.now(),simTime=0,frames=0,fpsStart=performance.now(),fpsValue=60,qualityCheck=0;
const lookTarget=home.target.clone(),vTemp=new V(),carrierBasis=new THREE.Matrix4(),carrierBodyMatrix=new THREE.Matrix4(),carrierRopeMatrix=new THREE.Matrix4();
const skierPosition=new V(),skierTangent=new V(),skierCross=new V(),skierCenter=new V();
function updateVehicles(dt){for(const rotor of stationRotors)rotor.rotation.y-=dt*.4;for(const rt of liftRuntimes){rt.phase=(rt.phase+dt/rt.cycleDuration)%1;for(let i=0;i<rt.count;i++){const u=rt.vehicleU(rt.phase+i/rt.count),frames=carrierFrames(rt,u),{p}=frames,tangent=frames.body[2];const angle=Math.atan2(tangent.x,tangent.z);
 obj.position.copy(p);obj.scale.set(1,1,1);obj.rotation.set(0,angle,Math.sin(simTime*.4+i)*.015*(state.wind/100));obj.updateMatrix();carrierBodyMatrix.copy(obj.matrix);
 obj.quaternion.setFromRotationMatrix(carrierBasis.makeBasis(...frames.rope));obj.updateMatrix();carrierRopeMatrix.copy(obj.matrix);
 for(const part of rt.renderParts||rt.parts){if(part.y===0){part.mesh.setMatrixAt(i,part.mesh.geometry.userData.ropeAligned?carrierRopeMatrix:carrierBodyMatrix);continue;}obj.position.copy(p);if(part.mesh.geometry.userData.ropeAligned){obj.position.addScaledVector(frames.rope[1],part.y);obj.quaternion.setFromRotationMatrix(carrierBasis.makeBasis(...frames.rope));}else{obj.position.y+=part.y;obj.rotation.set(0,angle,Math.sin(simTime*.4+i)*.015*(state.wind/100));}obj.scale.set(1,1,1);obj.updateMatrix();part.mesh.setMatrixAt(i,obj.matrix);}}(rt.renderParts||rt.parts).forEach(part=>part.mesh.instanceMatrix.needsUpdate=true);}
 skiers.forEach((s,i)=>{s.phase=(s.phase+dt*s.speed)%1;if(!skierGroup.visible)return;const p=s.trail.curve.getPoint(s.phase,skierPosition),tan=s.trail.curve.getTangent(s.phase,skierTangent),cross=skierCross.set(-tan.z,0,tan.x).normalize();const center=skierCenter.copy(p);p.addScaledVector(cross,keepSkiersOnParkBypass(s.trail,s.phase,Math.sin(s.phase*30+i)*Math.min(...Object.values(trailWidthAt(s.trail,s.phase)))*.32));hotelSnowFlow?.limitOffset(center,p);p.y=displayGroundHeightAt(p.x,p.z);if(s.trail.id===menglongPark.trailId)p.copy(menglongPark.routePoint(s.phase,true));const angle=Math.atan2(tan.x,tan.z);obj.rotation.set(0,angle,0);obj.scale.set(1,1,1);for(let leg=0;leg<2;leg++){obj.position.copy(p).addScaledVector(cross,(leg-.5)*.25);obj.position.y+=.38;obj.updateMatrix();skierLegs.setMatrixAt(i*2+leg,obj.matrix);}obj.position.copy(p);obj.position.y+=1.05;obj.updateMatrix();skierBody.setMatrixAt(i,obj.matrix);obj.position.y=p.y+1.64;obj.updateMatrix();skierHeads.setMatrixAt(i,obj.matrix);obj.position.y=p.y+.08;obj.updateMatrix();skierSkis.setMatrixAt(i,obj.matrix);});if(skierGroup.visible)skierBody.instanceMatrix.needsUpdate=skierHeads.instanceMatrix.needsUpdate=skierSkis.instanceMatrix.needsUpdate=skierLegs.instanceMatrix.needsUpdate=true;}
const shadowFocus=new V(Infinity,Infinity,Infinity);let shadowSpan=0;function updateShadowDetail(){if(!renderer.shadowMap.enabled||state.time==='night'||state.mode==='architecture')return;const target=state.mode==='orbit'?orbit.target:camera.position,span=clamp(state.mode==='orbit'?orbit.radius*.78:260,160,2500);if(target.distanceToSquared(shadowFocus)<36&&Math.abs(span-shadowSpan)<Math.max(10,shadowSpan*.05))return;shadowFocus.copy(target);shadowSpan=span;sun.target.position.copy(target);sun.position.copy(target).add(new V(...palettes[state.time].sunPos));const c=sun.shadow.camera;c.left=c.bottom=-span;c.right=c.top=span;c.updateProjectionMatrix();sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;}
// Interactions wake the scene on the next display refresh. A stationary
// atlas still animates at 20 Hz, and paused probes submit no GL draw calls.
const idleInterval=1000/20,pausedProbeInterval=150;
let sceneFrameRequest=0,sceneFrameTimer=0,sceneDirty=true,renderedMotion=false;
let visualSnapshot=[],labelSnapshot=[],lastLabelFrame=-Infinity,vehicleTime=0,lastPaused=state.paused;
const renderedPosition=new V(Infinity,Infinity,Infinity),renderedRotation=new THREE.Quaternion();
function scheduleSceneFrame(delay=0){
 if(document.hidden||sceneFrameRequest||sceneFrameTimer)return;
 if(delay>0){
  sceneFrameTimer=setTimeout(()=>{sceneFrameTimer=0;scheduleSceneFrame();},delay);
 }else sceneFrameRequest=requestAnimationFrame(animate);
}
function requestSceneFrame(){
 sceneDirty=true;
 if(sceneFrameTimer){clearTimeout(sceneFrameTimer);sceneFrameTimer=0;}
 scheduleSceneFrame();
}
function orbitPosePending(){
 const distance=Math.max(.005,orbit.radius*.000025);
 return Math.abs(desired.theta-orbit.theta)>.0001||Math.abs(desired.phi-orbit.phi)>.0001||
  Math.abs(desired.radius-orbit.radius)>distance||desired.target.distanceToSquared(orbit.target)>distance*distance;
}
function posePending(){
 if(state.mode==='orbit'||state.mode==='architecture')return orbitPosePending();
 if(state.mode==='lift'||state.mode==='ski')return Math.abs(rideLook.targetYaw-rideLook.yaw)>.0001||
  Math.abs(rideLook.targetPitch-rideLook.pitch)>.0001;
 return false;
}
function cameraDiffers(){
 const distance=Math.max(.002,orbit.radius*.00002);
 return renderedPosition.distanceToSquared(camera.position)>distance*distance||
  Math.abs(renderedRotation.dot(camera.quaternion))<1-1e-9;
}
function visualState(){
 return [state.mode,state.paused,state.selected,state.labels,state.snow,state.intensity,state.imagery,state.trees,
  state.skiers,state.routes,state.quality,state.wind,state.rideT,state.activeLift,weatherState.preset,weatherState.hour,
  weatherState.auto,camera.fov,camera.aspect,camera.zoom,innerWidth,innerHeight,document.body.className,
  $('sidebar').hidden,$('sidebar').className,$('settings').hidden,$('detail').hidden,$('detail').className,
  forest.visible,contours.visible,geoOverlay.visible,pathOverlay.visible,officialMapFeatures.labelLayer.visible,
  bikeReference.visible,wildReference.visible,terrain.material,imageryOverlay?.material.map?.version,
  labelGeneration,labelData.length];
}
const changed=(before,after)=>before.length!==after.length||after.some((value,i)=>value!==before[i]);
function idleDelay(now){return Math.max(1,idleInterval-(performance.now()-now)-8);}
function animate(now){
 sceneFrameRequest=0;
 if(document.hidden)return;
 // Opaque inspection surfaces own interaction; resume without a simulation jump.
 if(interfacePanels.blocksScene){previousTime=fpsStart=now;frames=0;return;}
 const animated=!state.paused&&state.mode!=='architecture';
 const activeRide=animated&&['lift','ski','tour'].includes(state.mode);
 const moving=posePending()||renderedMotion||activeRide;
 const visual=visualState();
 const refresh=sceneDirty||changed(visualSnapshot,visual)||cameraDiffers();
 if(!refresh&&!moving&&(!animated||now-previousTime<idleInterval-8)){
  scheduleSceneFrame(animated?idleDelay(previousTime):pausedProbeInterval);
  return;
 }
 sceneDirty=false;
 updateSceneFraming();
 const pausedChanged=lastPaused!==state.paused;
 const realDt=pausedChanged?0:clamp((now-previousTime)/1000,0,.12);
 previousTime=now;
 lastPaused=state.paused;
 const dt=animated?realDt*state.speed:0;
 simTime+=dt;snowUniforms.uTime.value=simTime;
 const damp=1-Math.exp(-realDt*5);
 vehicleTime+=dt;
 if(vehicleTime>0&&(state.mode==='lift'||vehicleTime>=state.speed/30)){
  updateVehicles(vehicleTime);
  vehicleTime=0;
 }
 if(state.mode==='orbit'||state.mode==='architecture'){
  // Derive the rendered position and look direction from one pose. This
  // keeps the cursor anchor fixed throughout the zoom interpolation.
  const manualZoom=wheelGesture&&now-wheelGesture.time<350;
  const weight=!orbitPosePending()||navigationGesture?.moved?1:
   manualZoom?1-Math.exp(-realDt*16):damp;
  orbit.theta=lerp(orbit.theta,desired.theta,weight);
  orbit.phi=lerp(orbit.phi,desired.phi,weight);
  orbit.radius=lerp(orbit.radius,desired.radius,weight);
  orbit.target.lerp(desired.target,weight);
  camera.position.copy(orbitPosition());
  lookTarget.copy(orbit.target);
 }
 else if(state.mode==='lift'){const rt=state.activeLift.runtime,turn=Math.PI*laneWidth/(2*rt.length+2*Math.PI*laneWidth),straight=.5-turn,u=rt.vehicleU(rt.phase+state.rideIndex/rt.count),t=clamp(u/straight,0,.999),p=rt.loopPoint(u).p;p.y-=state.activeLift.type==='gondola'?3.9:2.3;camera.position.copy(p);const ahead=rt.cablePoint(Math.min(1,t+.04),-laneWidth);ahead.y-=state.activeLift.type==='gondola'?3.9:2.3;applyRideLook(p,ahead,realDt);state.rideT=t;$('ride-progress').style.width=Math.min(100,t*100)+'%';if(t>=.985){exitExperience();toast('到达山顶，欢迎回到全景。');}}
 else if(state.mode==='ski'){state.rideT+=dt*(skiRideSpeedKmh/3.6)/skiRideLength;const t=clamp(state.rideT,0,1),p=skiTrail.id===menglongPark.trailId?menglongPark.routePoint(t,true):skiTrail.curve.getPointAt(t);p.y=displayGroundHeightAt(p.x,p.z)+2.1;camera.position.lerp(p,1-Math.exp(-realDt*3));const lookT=Math.min(1,t+12/skiRideLength),ahead=skiTrail.id===menglongPark.trailId?menglongPark.routePoint(lookT,true):skiTrail.curve.getPointAt(lookT);ahead.y=displayGroundHeightAt(ahead.x,ahead.z)+1.5;applyRideLook(p,ahead,realDt);$('ride-progress').style.width=t*100+'%';if(t>=1){exitExperience();toast('滑行结束，再去发现另一条雪道。');}}
 else if(state.mode==='tour'){state.rideT+=dt/65;const t=state.rideT,angle=.15+Math.PI*2*t,r=5700-700*Math.sin(t*Math.PI)**2,p=new V(Math.sin(angle)*r,2700+350*Math.sin(t*Math.PI*2),Math.cos(angle)*r).add(new V(0,50,-100));camera.position.lerp(p,1-Math.exp(-realDt*2));lookTarget.lerp(new V(0,210,-120),damp);orbit.theta=angle;$('ride-progress').style.width=t*100+'%';if(t>=1)exitExperience();}
 if(state.mode==='orbit'||state.mode==='tour'||state.mode==='ski'){protectCamera(camera.position);camera.position.y=Math.max(camera.position.y,displayGroundHeightAt(camera.position.x,camera.position.z)+(state.mode==='ski'?1.7:2));}const desiredNear=state.mode==='orbit'||state.mode==='architecture'?clamp(orbit.radius/700,.25,12):.15;if(Math.abs(camera.near-desiredNear)>camera.near*.04){camera.near=desiredNear;camera.updateProjectionMatrix();}camera.lookAt(lookTarget);if(highlightLine?.userData.selectionOverlay==='lift')highlightLine.material.uniforms.resolution.value.set(sceneViewport.width,sceneViewport.height);updateWeatherSystem(realDt);updateShadowDetail();updateVehicleDetail(now);renderer.render(state.mode==='architecture'?inspectionScene:scene,camera);updateCompass();
 renderedMotion=cameraDiffers();
 renderedPosition.copy(camera.position);
 renderedRotation.copy(camera.quaternion);
 const labelState=[state.mode,state.labels,sceneFrameKey,labelGeneration,labelData.length,
  officialMapFeatures.labelLayer.visible,bikeReference.visible,wildReference.visible];
 if(changed(labelSnapshot,labelState)||renderedMotion&&now-lastLabelFrame>=1000/30||!renderedMotion&&moving){
  positionLabels();
  labelSnapshot=labelState;
  lastLabelFrame=now;
 }
 visualSnapshot=visualState();
 const continuous=posePending()||renderedMotion||activeRide;
 if(continuous){
  frames++;
  if(now-fpsStart>2000){
   fpsValue=frames*1000/(now-fpsStart);frames=0;fpsStart=now;qualityCheck++;
   if(state.quality==='auto'&&qualityCheck>2&&fpsValue<31&&renderer.getPixelRatio()>1.05){
    renderer.setPixelRatio(Math.max(1,renderer.getPixelRatio()-.25));
    snowUniforms.uDpr.value=renderer.getPixelRatio();qualityCheck=0;
   }
  }
  scheduleSceneFrame();
 }else{
  fpsValue=animated?1000/idleInterval:0;
  frames=0;fpsStart=now;qualityCheck=0;
  scheduleSceneFrame(animated?idleDelay(now):pausedProbeInterval);
 }
}
for(const event of ['pointerdown','pointerup','click','wheel','input','change','keydown','resize','fullscreenchange']){
 window.addEventListener(event,requestSceneFrame,{capture:true,passive:true});
}
canvas.addEventListener('pointermove',()=>{if(pointers.size)requestSceneFrame();},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{
 if(sceneFrameRequest)cancelAnimationFrame(sceneFrameRequest);
 if(sceneFrameTimer)clearTimeout(sceneFrameTimer);
 sceneFrameRequest=sceneFrameTimer=0;
 previousTime=fpsStart=performance.now();frames=0;qualityCheck=0;
 if(!document.hidden)requestSceneFrame();
});
/* DELIVERY_UI */
/* INTERFACE_UI */
if(DELIVERY_MODE)initializeDeliveryUI();
/* PERFORMANCE_RENDER */
const terrainRenderTiles=initializeTerrainRenderTiles({terrain,scene,renderer,geo:GEO,snowMaterial:snowMat,
 exactRendering:()=>state.imagery||state.quality==='high'||state.mode==='ski'||state.mode==='lift'});
const spatialRender=initializeSceneSpatialCulling({scene,camera,forest,treeData,liftRuntimes});
updateVehicles(0);
requestSceneFrame();
requestAnimationFrame(()=>{requestAnimationFrame(()=>{$('loading').classList.add('hidden');setTimeout(()=>$('loading').hidden=true,800);});});
// Read-only diagnostics are intentionally exposed for repeatable local QA.
window.__WANLONG__={bikePerspective,mapFacilities,terrainRenderTiles,spatialRender,requestSceneFrame,cabinObstacleTop,registrationWorkbench,officialMapFeatures,officialMapViewer,trailGrade,hotelSnowFlow,pisteGrading,weatherState,weatherPresets,setEnvironmentHour,setWeatherPreset,setEnvironmentSnow,updateWeatherSystem,setEnvironmentTimePreset,resortRoads,accessRoadGroup,summitFacilities,selectSummitFacility,bikeRoutes,focusBikeRoute,selectBikeRoutes,liftStructureAudit,terminalMechanismRecords,vehicleHangingEnvelope,hotelNightSpots,hotelNightLayer,magicCarpetReference,carpetShoulderDepth,clearSelection,setSettingsOpen,get selectionHighlight(){return highlightLine;},trailWidthAt,pisteFootprintClearance,supportPisteClearance,sceneViewport,pointerInScene,sourceTerrainPositions,parkPylonFoundations,naturalValleys,naturalValleyAt,naturalValleyDelta,visibleTerrainHeightAt,displayGroundHeightAt,focusNaturalValley,forestReferencePatches,forestPatchAt,forestCounters,forestClearance,canopyEvidence,hotelDisplaySites,hotelDisplayGroundHeightAt,state,trails,lifts,hotels,renderer,camera,scene,GEO,terrain,forest,contours,pathOverlay,geoOverlay,treeCount:treeData.length,treeSnowCaps,skierGroup,menglongPark,rideLook,facilityGrounds,solidVolumes,stationRecords,stationDetailRecords,pylonDetailRecords,liftCrossings,liftStationSites,supportSitingRecords,liftSurfaceHeight,heightAt,treeData,orbit,desired,wildZones,wildReference,selectWildZone,surfaceState,surfaceLayers,siteCuts,nightLayer,nightPoleSpots,nightUniform,orientedOverlap,vehicleVolume,vehicleParts,protectCamera,get fps(){return fpsValue;},get drawCalls(){return renderer.info.render.calls;},select:selectItem,selectLandscape,startLift,setTime,resetView};
})();

