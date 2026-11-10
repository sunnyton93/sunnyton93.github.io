// Append after Spelling Bee: the first 24 save indices must never move.
const EVERYDAY_LESSONS=[
 {topic:'Frutas',words:[
  ['Apple','Manzana'],['Kiwi','Kiwi'],['Papaya','Papaya'],['Pear','Pera'],
  ['Plum','Ciruela'],['Raspberry','Frambuesa'],['Watermelon','Sandía'],['Pineapple','Piña'],
  ['Mango','Mango'],['Peach','Durazno'],['Cherry','Cereza'],['Lemon','Limón']
 ]},
 {topic:'Verduras',words:[
  ['Carrot','Zanahoria'],['Eggplant','Berenjena'],['Onion','Cebolla'],['Lettuce','Lechuga'],
  ['Broccoli','Brócoli'],['Cucumber','Pepino'],['Spinach','Espinaca'],['Peas','Chícharos'],
  ['Celery','Apio'],['Cauliflower','Coliflor'],['Bell pepper','Pimiento morrón'],['Zucchini','Calabacita']
 ]},
 {topic:'Partes de la casa',words:[
  ['Kitchen','Cocina'],['Bedroom','Recámara'],['Bathroom','Baño'],['Living room','Sala'],
  ['Dining room','Comedor'],['Garage','Cochera'],['Garden','Jardín'],['Door','Puerta'],
  ['Window','Ventana'],['Roof','Techo exterior'],['Wall','Pared'],['Floor','Piso']
 ]},
 {topic:'Partes del cuerpo',words:[
  ['Knee','Rodilla'],['Face','Cara'],['Hair','Cabello'],['Eye','Ojo'],
  ['Ear','Oreja'],['Nose','Nariz'],['Mouth','Boca'],['Tooth','Diente'],
  ['Arm','Brazo'],['Hand','Mano'],['Leg','Pierna'],['Foot','Pie']
 ]},
 {topic:'Actividades',words:[
  ['Read','Leer'],['Write','Escribir'],['Clap','Aplaudir'],['Paint','Pintar'],
  ['Dance','Bailar'],['Sing','Cantar'],['Cook','Cocinar'],['Eat','Comer'],
  ['Drink','Beber'],['Sleep','Dormir'],['Walk','Caminar'],['Jump','Saltar']
 ]},
 {topic:'Oficios y profesiones',words:[
  ['Doctor','Médico / médica'],['Nurse','Enfermero / enfermera'],['Plumber','Plomero / plomera'],['Firefighter','Bombero / bombera'],
  ['Police officer','Policía'],['Chef','Chef'],['Farmer','Granjero / granjera'],['Dentist','Dentista'],
  ['Pilot','Piloto'],['Builder','Constructor / constructora'],['Baker','Panadero / panadera'],['Mechanic','Mecánico / mecánica']
 ]},
 {topic:'Objetos de casa',words:[
  ['Bed','Cama'],['Chair','Silla'],['Table','Mesa'],['Desk','Escritorio'],
  ['Sofa','Sofá'],['Lamp','Lámpara'],['Mirror','Espejo'],['Fridge','Refrigerador'],
  ['Stove','Estufa'],['Sink','Fregadero'],['Cupboard','Alacena'],['Clock','Reloj']
 ]},
 {topic:'Objetos de cocina',words:[
  ['Fork','Tenedor'],['Spoon','Cuchara'],['Knife','Cuchillo'],['Plate','Plato'],
  ['Cup','Taza'],['Bottle','Botella'],['Pan','Sartén'],['Pot','Olla'],
  ['Kettle','Tetera'],['Tray','Charola'],['Napkin','Servilleta'],['Ladle','Cucharón']
 ]},
 {topic:'Animales',words:[
  ['Cat','Gato'],['Horse','Caballo'],['Cow','Vaca'],['Pig','Cerdo'],
  ['Duck','Pato'],['Sheep','Oveja'],['Goat','Cabra'],['Lion','León'],
  ['Tiger','Tigre'],['Elephant','Elefante'],['Giraffe','Jirafa'],['Monkey','Mono']
 ]},
 {topic:'Ropa cotidiana',words:[
  ['Shirt','Camisa'],['Dress','Vestido'],['Skirt','Falda'],['Shorts','Pantalones cortos'],
  ['Jeans','Pantalones de mezclilla'],['Shoes','Zapatos'],['Sandals','Sandalias'],['Slippers','Pantuflas'],
  ['Pajamas','Pijama'],['Swimsuit','Traje de baño'],['Apron','Delantal'],['Tie','Corbata']
 ]},
 {topic:'Más alimentos',words:[
  ['Pizza','Pizza'],['Sandwich','Sándwich'],['Burger','Hamburguesa'],['Sausage','Salchicha'],
  ['Pasta','Pasta'],['Cereal','Cereal'],['Cookie','Galleta'],['Chocolate','Chocolate'],
  ['Butter','Mantequilla'],['Honey','Miel'],['Yogurt','Yogur'],['Pancake','Panqueque']
 ]},
 {topic:'Útiles y tecnología escolar',words:[
  ['Book','Libro'],['Paper','Papel'],['Folder','Carpeta'],['Marker','Marcador'],
  ['Crayon','Crayón'],['Stapler','Engrapadora'],['Tape','Cinta adhesiva'],['Calculator','Calculadora'],
  ['Computer','Computadora'],['Keyboard','Teclado'],['Printer','Impresora'],['Tablet','Tableta']
 ]}
].map(lesson=>({...lesson,words:lesson.words.map(([en,es],id)=>({
 id,en,es,icon:'✦',image:'/icons/words/everyday/'+en.toLowerCase().replace(/ /g,'-')+'.webp'
}))}));
islandLessons.push(...EVERYDAY_LESSONS);
