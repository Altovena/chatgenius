/* Shared machine registry for Arcade Hall 2.5D and future 3D hall.
 * Add a game object to this array to place a machine in the hall.
 * Required: id, name, icon, desc, url, color. Optional side (-1 left / 1 right), z (depth).
 * If side/z omitted, the hall assigns the next available cabinet position.
 * Only link to playable ChatGenius games; keep ids unique.
 */
window.CHATGENIUS_ARCADE_MACHINES=[
{id:'castle-chaos',name:'Castle Chaos',icon:'🏰',desc:'Middelalderflipper med borg, ramper og drageoppdrag.',url:'/spill/flipperhall/?machine=0',side:-1,z:.75,color:'#ffb36c'},
{id:'space-invaders',name:'Space Invaders',icon:'👾',desc:'Klassisk invasjon av romvesener, oppdatert for mobil og PC.',url:'/spill/mobil/',side:1,z:.75,color:'#64f5dc'},
{id:'neon-velocity',name:'Neon Velocity',icon:'🏎️',desc:'Futuristisk racingflipper med lysende sløyfer og turbobonus.',url:'/spill/flipperhall/?machine=1',side:-1,z:1.65,color:'#54ecff'},
{id:'neon-rift-2026',name:'Neon Rift 2026',icon:'⚡',desc:'Overlev fiendebølger i den futuristiske neonarenaen.',url:'/spill/neon-rift-2026/',side:1,z:1.65,color:'#d598ff'},
{id:'cosmic-odyssey',name:'Cosmic Odyssey',icon:'🚀',desc:'Kosmisk flipper med portaler, planeter og bonusbaner.',url:'/spill/flipperhall/?machine=2',side:-1,z:2.55,color:'#d69aff'},
{id:'galaga',name:'Galaga',icon:'🛸',desc:'Luftkamp med retrofølelse, bølger og rask arkadeaction.',url:'/spill/galaga/mobil/',side:1,z:2.55,color:'#9cf9fc'},
{id:'jungle-temple',name:'Jungle Temple',icon:'🌿',desc:'Flipper mellom jungelruiner, tunneler og skjulte mål.',url:'/spill/flipperhall/?machine=3',side:-1,z:3.45,color:'#cbf08b'},
{id:'tank-battle',name:'Tank Battle',icon:'🛡️',desc:'Naviger, sikt og bekjemp fiendtlige stridsvogner.',url:'/spill/tank-battle/mobil/',side:1,z:3.45,color:'#ffcd70'},
{id:'abyssal-depths',name:'Abyssal Depths',icon:'🐙',desc:'Dyphavsflipper med glødende koraller og undervannsramper.',url:'/spill/flipperhall/?machine=4',side:-1,z:4.35,color:'#66eaff'},
{id:'donkey-kong',name:'Donkey Kong',icon:'🦍',desc:'Hopp mellom plattformene i et klassisk arkadeeventyr.',url:'/spill/donkey-kong/mobil/',side:1,z:4.35,color:'#ffa66f'},
{id:'clockwork-carnival',name:'Clockwork Carnival',icon:'🎡',desc:'Mekanisk tivoliflipper med tannhjul og bonusoppdrag.',url:'/spill/flipperhall/?machine=5',side:-1,z:5.2,color:'#ffca85'},
{id:'sjakkakademiet',name:'Sjakkakademiet',icon:'♟️',desc:'Ta en pause fra action og tren sjakk mot motor og tidligere partier.',url:'/spill/sjakk/',side:1,z:5.2,color:'#f3f4fd'}];
