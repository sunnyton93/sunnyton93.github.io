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
oceanIslands.push(...EVERYDAY_ISLANDS.map((island,i)=>configureOceanIsland(island,EVERYDAY_ISLAND_START+i)));
Object.assign(islandRoomThemes,{
 'fruit-garden':['#fff0dd','#c4dc91','#4a6b4d','#c78067','forest','leaf','sun','¡Una cosecha de palabras deliciosas!'],
 'vegetable-garden':['#e8f4df','#a4cda2','#40654e','#91a95e','forest','leaf','drop','Cada semilla es un nuevo descubrimiento'],
 'cozy-home':['#fff0e1','#e0c39d','#705e4e','#c7846b','school','bell','book','¡Pasa, estás en tu casa!'],
 'body-motion':['#e4f5f0','#a8dcd3','#3d6968','#6b9eaf','sport','ball','star','¡Descubre todo lo que puedes hacer!'],
 'daily-adventures':['#f4eafa','#d5b6df','#6b537c','#ba87a3','music','note','pencil','Lee, crea, canta… ¡vive una aventura!'],
 'great-jobs':['#fff3da','#e2cf86','#6d6343','#ad9560','school','compass','bell','Un pueblo lleno de grandes talentos']
});

// Same hand-drawn SVG language as the original archipelago; no bitmap downloads.
function everydayIslandScenery(type){
 const tree=(x,y,fruit)=>`<g transform="translate(${x} ${y})"><path d="M-7 5v-66h14V5" fill="#ad7950"/><path d="M-1-48-24-20m26-15 23-24" stroke="#ad7950" stroke-width="7"/><path d="M-43-60q-11-25 12-37-2-28 28-27 30-12 40 17 28 6 16 34 4 31-30 25-31 20-50-12Z" fill="#65a77a"/><path d="M-31-85q7-22 29-20m12 0q17-3 22 14" fill="none" stroke="#a3cc8b" stroke-width="6" stroke-linecap="round"/>${[[-23,-77],[9,-94],[28,-65],[-3,-59]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="8" fill="${fruit}"/><path d="m${a} ${b-6} 2-6" stroke="#567c4d" stroke-width="2"/>`).join('')}</g>`;
 const sign=text=>`<g transform="translate(0 28)"><path d="M-33 12v16m66-16v16" stroke="#9b7c54" stroke-width="4"/><rect x="-57" y="-8" width="114" height="26" rx="7" fill="#fff1cb" stroke="#b19b6c" stroke-width="2"/><text y="9" text-anchor="middle" font-size="10" font-weight="bold" fill="#426d65">${text}</text></g>`;
 const art={
  'fruit-garden':`${tree(-55,-5,'#e88173')}${tree(52,-12,'#edc45e')}<path d="M-25 2h52l-6 31h-40Z" fill="#bb885b" stroke="#946b4b" stroke-width="2"/><path d="M-19 5q18-34 38 0" fill="none" stroke="#946b4b" stroke-width="4"/><g fill="#f0bd5c"><circle cx="-12" cy="8" r="9"/><circle cx="10" cy="9" r="10"/></g><circle cx="0" cy="2" r="9" fill="#da7c70"/>${sign('FRUIT MARKET')}`,
  'vegetable-garden':`<path d="m-95-12 94-47 98 43-94 49Z" fill="#ae8665" stroke="#e7cd96" stroke-width="4"/>${[-1,0,1].map(i=>`<path d="m${-57+i*26} ${5+i*12} 93-46" stroke="#896b53" stroke-width="7"/>`).join('')}${[[-59,-13],[-28,2],[4,17],[0,-42],[33,-27],[64,-12]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><path d="M-8-3 0 13 7-3Z" fill="${i%2?'#efb85d':'#e88e58'}"/><path d="M0-3q-20-24-14-25Q0-24 0-3q2-30 15-30Q21-18 0-3" fill="#619b67"/></g>`).join('')}<path d="M-72-55v-70m-21 22h43" stroke="#b28c61" stroke-width="5"/><circle cx="-72" cy="-123" r="13" fill="#f4daa1"/><path d="m-96-131 24-17 24 17Z" fill="#bd8d59"/><path d="m-90-103 18-8 18 8-8 27h-22Z" fill="#8fb7c2"/>${sign('GROW & LEARN')}`,
  'cozy-home':`<path d="M-81-57H81V28H-81Z" fill="#fff0cc" stroke="#b39470" stroke-width="3"/><path d="M-96-57 0-132 97-57Z" fill="#ce8170" stroke="#ad6d60" stroke-width="3"/><path d="m-66-67 66-51 66 51" fill="none" stroke="#e8ae8a" stroke-width="4"/><path d="M49-111v-26h18v40" fill="#d8b68d"/><rect x="-17" y="-25" width="34" height="53" rx="16" fill="#6caaa0"/><circle cx="9" cy="6" r="3" fill="#f7d990"/>${[-59,33].map(x=>`<rect x="${x}" y="-38" width="28" height="28" rx="5" fill="#9ed8dd" stroke="#fffdf0" stroke-width="4"/><path d="M${x+14}-38v28m-14-14h28" stroke="#fff5d9" stroke-width="3"/>`).join('')}<path d="M-21 29-35 48H35L21 29" fill="#decaa2"/>${tree(104,7,'#f1ce82')}`,
  'body-motion':`<ellipse cy="9" rx="93" ry="32" fill="#7bb7af" stroke="#d5f0cf" stroke-width="5"/><ellipse cy="5" rx="72" ry="23" fill="#b4ded2"/><g stroke="#f6d0a9" stroke-width="13" stroke-linecap="round" fill="none"><path d="M-18-74-56-92m76 18 35-24M-13-20-34 15m46-35 27 35"/></g><path d="m-22-85 22-12 24 12-9 63h-30Z" fill="#7eadd0" stroke="#547f9b" stroke-width="3"/><circle cy="-115" r="23" fill="#f6d0a9"/><path d="M-23-121q-1-31 27-22 23 5 20 25l-12-12q-16 17-35 9" fill="#74564c"/><path d="m-9-109 4 0m11 0h4" stroke="#45676a" stroke-width="3" stroke-linecap="round"/><path d="M-6-100q6 5 12 0" stroke="#b87e71" stroke-width="2" fill="none"/><g fill="none" stroke="#efc86e" stroke-width="4" stroke-linecap="round"><path d="M-80-98q-22 33-7 53m153-65q27 29 20 53m-97 47-10 15m53-15 10 15"/></g>${sign('MOVE & DISCOVER')}`,
  'daily-adventures':`<path d="M-94 11q90-38 188 0v20H-94Z" fill="#b498c5"/><g transform="translate(-59 -37) rotate(-9)"><rect x="-25" y="-36" width="50" height="65" rx="6" fill="#f1cc7f" stroke="#a87d59" stroke-width="3"/><path d="M-17-27h35v46h-35Z" fill="#fff3d7"/><path d="M-11-15h24m-24 9h24m-24 9h16" stroke="#9dbab3" stroke-width="3"/></g><g transform="translate(16 -60)"><path d="M-27-22q28-22 55 1 16 13-4 26-12 1-9 12-4 15-25 8-35-8-17-47" fill="#efc786" stroke="#ad8259" stroke-width="3"/><g fill="#de827d"><circle cx="-11" cy="-14" r="6"/></g><circle cx="9" cy="-18" r="6" fill="#7eaad1"/><circle cx="20" cy="-1" r="6" fill="#83b681"/><path d="M2 15 28-53" stroke="#638b8b" stroke-width="6"/><path d="m25-51 7-17 2 19Z" fill="#c88671"/></g><g transform="translate(76 -32)" fill="#6989a6"><path d="M-7-1v-61l33-8v57H19v-44L0-52v51Z"/><ellipse cx="-9" cy="1" rx="12" ry="9"/><ellipse cx="18" cy="-10" rx="12" ry="9"/></g>${sign('CREATE & PLAY')}`,
  'great-jobs':`${house(-68,-24,'#d98772')}${house(67,-24,'#7eaabd')}<path d="M-38-31h76v60h-76Z" fill="#f8e9c4" stroke="#b5996e" stroke-width="3"/><path d="m-49-30 49-64 49 64Z" fill="#6c9c9e"/><rect x="-11" y="-5" width="22" height="34" rx="5" fill="#8bafa4"/><g transform="translate(-65 -81)" fill="#fff7dd"><rect x="-5" y="-14" width="10" height="28"/><rect x="-14" y="-5" width="28" height="10"/></g><g transform="translate(67 -80)"><path d="M-18 0q0-27 18-27T18 0Z" fill="#eac16a"/><path d="M-23 0h46m-22-28V0" stroke="#b68a4e" stroke-width="4"/></g>${sign('OUR LITTLE TOWN')}`
 };
 return art[type]||'';
}
