// Normal islands continue the existing Adventure route, after Mario Kart.
// Keep Bee at 21–23 so stars, selected games, times and coins retain their owners.
const EVERYDAY_ISLAND_START=oceanIslands.length;
const EVERYDAY_ISLAND_POSITIONS=[[1800,4600],[2850,5000],[4050,4600],[5250,5100],[4200,5800],[2850,6050]];
const EVERYDAY_ISLANDS=[
 {type:'fruit-garden',name:'Jardín Frutal',color:'#c4dc91',scale:1.5},
 {type:'vegetable-garden',name:'Huerto Encantado',color:'#9dd4a0',scale:1.5},
 {type:'cozy-home',name:'Hogar Acogedor',color:'#e4c9a0',scale:1.5},
 {type:'body-motion',name:'Cuerpo en Movimiento',color:'#a8dcd3',scale:1.5},
 {type:'daily-adventures',name:'Mil Aventuras',color:'#d5b6df',scale:1.5},
 {type:'great-jobs',name:'Grandes Oficios',color:'#e2cf86',scale:1.5}
];
islandRoutePositions[1].push(...EVERYDAY_ISLAND_POSITIONS);
islandRoutes[1].islands.push(...EVERYDAY_ISLANDS.map((_,i)=>EVERYDAY_ISLAND_START+i));
oceanIslands.push(...EVERYDAY_ISLANDS.map((island,i)=>configureOceanIsland({
 ...island,zone:'everyday',roomBackground:`/icons/islands/${island.type}-room.webp`,
 requiredStars:250+i*15,previousIslandForStars:i?EVERYDAY_ISLAND_START+i-1:undefined
},EVERYDAY_ISLAND_START+i)));
Object.assign(islandRoomThemes,{
 'fruit-garden':['#fff0dd','#c4dc91','#4a6b4d','#c78067','forest','leaf','sun','¡Una cosecha de palabras deliciosas!'],
 'vegetable-garden':['#e8f4df','#a4cda2','#40654e','#91a95e','forest','leaf','drop','Cada semilla es un nuevo descubrimiento'],
 'cozy-home':['#fff0e1','#e0c39d','#705e4e','#c7846b','school','bell','book','¡Pasa, estás en tu casa!'],
 'body-motion':['#e4f5f0','#a8dcd3','#3d6968','#6b9eaf','sport','ball','star','¡Descubre todo lo que puedes hacer!'],
 'daily-adventures':['#f4eafa','#d5b6df','#6b537c','#ba87a3','music','note','pencil','Lee, crea, canta… ¡vive una aventura!'],
 'great-jobs':['#fff3da','#e2cf86','#6d6343','#ad9560','school','compass','bell','Un pueblo lleno de grandes talentos']
});

// The same landmark appears on the map, in the island room and on reward cards.
function everydayIslandScenery(type){
 if(!EVERYDAY_ISLANDS.some(island=>island.type===type))return '';
 return `<image href="/icons/islands/${type}.webp" x="-122" y="-168" width="244" height="205" preserveAspectRatio="xMidYMax meet"/>`;
}
