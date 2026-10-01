import { q, tx, json } from '../../core/db.js';

const SIZES = (p, m, f) => [
  { name: 'Personal', price: p },
  { name: 'Mediana', price: m },
  { name: 'Familiar', price: f },
];
const SODAS = ['Coca-Cola', 'Kola Román', 'Colombiana', 'Manzana', 'Uva', 'Naranja', 'Pepsi'].map((name) => ({ name, price: null }));
const FLAVORS = (...names) => names.map((name) => ({ name, price: null }));

const MENU = [
  {
    category: 'Salchipapas',
    icon: 'salchipapa',
    products: [
      { name: 'Salchipapa Clásica', icon: 'salchipapa', featured: 1, optionsLabel: 'Tamaño', options: SIZES(14000, 20000, 30000), description: 'La de siempre: papita, salchicha y queso costeño.', ingredients: ['Papa a la francesa', 'Salchicha', 'Queso costeño', 'Papa ripio'], sauces: 1, extras: 1 },
      { name: 'Salchipapa Costeña', icon: 'salchipapa', featured: 1, optionsLabel: 'Tamaño', options: SIZES(18000, 25000, 36000), description: 'Con butifarra, huevos de codorniz y suero.', ingredients: ['Papa a la francesa', 'Salchicha', 'Butifarra', 'Huevos de codorniz', 'Queso costeño', 'Papa ripio'], sauces: 1, extras: 1 },
      { name: 'Salchipapa Mixta', icon: 'salchipapa', optionsLabel: 'Tamaño', options: SIZES(22000, 30000, 42000), description: 'Pollo, carne, tocineta, maíz y queso gratinado.', ingredients: ['Papa a la francesa', 'Salchicha', 'Pollo desmechado', 'Carne desmechada', 'Tocineta', 'Maíz tierno', 'Queso gratinado'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Hamburguesas',
    icon: 'hamburguesa',
    products: [
      { name: 'Hamburguesa Clásica', icon: 'hamburguesa', price: 16000, featured: 1, description: 'Carne de 150 g, queso cheddar y vegetales frescos.', ingredients: ['Carne 150 g', 'Queso cheddar', 'Lechuga', 'Tomate', 'Cebolla', 'Papa ripio'], sauces: 1, extras: 1 },
      { name: 'Hamburguesa Doble', icon: 'hamburguesa', price: 23000, description: 'Doble carne, doble queso y tocineta.', ingredients: ['Doble carne', 'Doble queso', 'Tocineta', 'Lechuga', 'Tomate', 'Cebolla caramelizada'], sauces: 1, extras: 1 },
      { name: 'Hamburguesa Costeña', icon: 'hamburguesa', price: 21000, description: 'Con queso costeño frito, maduro y suero.', ingredients: ['Carne 150 g', 'Queso costeño frito', 'Maduro', 'Suero costeño', 'Lechuga', 'Cebolla'], sauces: 1, extras: 1 },
      { name: 'Hamburguesa de Pollo', icon: 'hamburguesa', price: 17000, description: 'Pechuga apanada crocante.', ingredients: ['Pechuga apanada', 'Queso cheddar', 'Lechuga', 'Tomate'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Perros',
    icon: 'perro',
    products: [
      { name: 'Perro Sencillo', icon: 'perro', price: 9000, description: 'El clásico de esquina.', ingredients: ['Salchicha', 'Cebolla', 'Queso rallado', 'Papa ripio'], sauces: 1, extras: 1 },
      { name: 'Perro Suizo', icon: 'perro', price: 13000, description: 'Salchicha suiza, queso gratinado y tocineta.', ingredients: ['Salchicha suiza', 'Queso gratinado', 'Tocineta', 'Cebolla', 'Papa ripio'], sauces: 1, extras: 1 },
      { name: 'Perro Mixto', icon: 'perro', price: 16000, featured: 1, description: 'Con pollo, tocineta y maíz tierno.', ingredients: ['Salchicha', 'Pollo desmechado', 'Tocineta', 'Maíz tierno', 'Queso gratinado', 'Papa ripio'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Especiales',
    icon: 'patacon',
    products: [
      { name: 'Patacón con Todo', icon: 'patacon', price: 22000, featured: 1, description: 'Patacón gigante con carne, pollo y queso gratinado.', ingredients: ['Carne desmechada', 'Pollo desmechado', 'Tocineta', 'Maíz tierno', 'Queso gratinado', 'Lechuga'], sauces: 1, extras: 1 },
      { name: 'Patacón Sencillo', icon: 'patacon', price: 10000, description: 'Con hogao y queso costeño.', ingredients: ['Hogao', 'Queso costeño'], sauces: 1, extras: 1 },
      { name: 'Mazorcada', icon: 'mazorca', price: 22000, description: 'Maíz desgranado, pollo, carne y mucho queso.', ingredients: ['Maíz tierno', 'Pollo desmechado', 'Carne desmechada', 'Tocineta', 'Queso gratinado', 'Papa ripio'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Fritos & Chuzos',
    icon: 'arepa',
    products: [
      { name: 'Arepa de Huevo', icon: 'arepa', featured: 1, optionsLabel: 'Relleno', options: [{ name: 'Huevo', price: 6000 }, { name: 'Huevo y carne', price: 8000 }], description: 'Doradita, recién frita.', ingredients: [], sauces: 1, extras: 0 },
      { name: 'Carimañola', icon: 'empanada', price: 3500, optionsLabel: 'Relleno', options: FLAVORS('Carne', 'Queso'), description: 'De yuca, bien crocante.', ingredients: [], sauces: 1, extras: 0 },
      { name: 'Empanada', icon: 'empanada', price: 3000, optionsLabel: 'Relleno', options: FLAVORS('Carne', 'Pollo', 'Mixta'), description: 'De maíz, con ají.', ingredients: [], sauces: 1, extras: 0 },
      { name: 'Chuzo', icon: 'chuzo', optionsLabel: 'Proteína', options: [{ name: 'Pollo', price: 15000 }, { name: 'Cerdo', price: 15000 }, { name: 'Mixto', price: 17000 }], description: 'A la brasa, con arepa y papas.', ingredients: ['Arepa', 'Papa a la francesa', 'Ensalada'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Combos',
    icon: 'combo',
    products: [
      { name: 'Combo Hamburguesa', icon: 'combo', price: 22000, featured: 1, optionsLabel: 'Gaseosa', options: SODAS, description: 'Hamburguesa clásica + papas + gaseosa.', ingredients: ['Queso cheddar', 'Lechuga', 'Tomate', 'Cebolla', 'Papa ripio', 'Papas a la francesa'], sauces: 1, extras: 1 },
      { name: 'Combo Perro', icon: 'combo', price: 15000, optionsLabel: 'Gaseosa', options: SODAS, description: 'Perro sencillo + papas + gaseosa.', ingredients: ['Cebolla', 'Queso rallado', 'Papa ripio', 'Papas a la francesa'], sauces: 1, extras: 1 },
      { name: 'Combo Parcero', icon: 'salchipapa', price: 26000, optionsLabel: 'Gaseosa 1.5 L', options: SODAS, description: 'Salchipapa mediana + gaseosa de 1.5 L.', ingredients: ['Salchicha', 'Queso costeño', 'Papa ripio'], sauces: 1, extras: 1 },
    ],
  },
  {
    category: 'Bebidas',
    icon: 'gaseosa',
    products: [
      { name: 'Gaseosa 400 ml', icon: 'gaseosa', price: 4000, optionsLabel: 'Sabor', options: SODAS, ingredients: ['Hielo'] },
      { name: 'Gaseosa 1.5 L', icon: 'gaseosa', price: 8500, optionsLabel: 'Sabor', options: SODAS, ingredients: [] },
      { name: 'Agua', icon: 'agua', price: 2500, optionsLabel: 'Tipo', options: FLAVORS('Sin gas', 'Con gas'), ingredients: [] },
      { name: 'Cerveza', icon: 'cerveza', price: 5000, optionsLabel: 'Marca', options: FLAVORS('Águila', 'Costeña', 'Club Colombia', 'Poker'), ingredients: [] },
    ],
  },
  {
    category: 'Jugos',
    icon: 'jugo',
    products: [
      { name: 'Jugo en Agua', icon: 'jugo', price: 5000, optionsLabel: 'Fruta', options: FLAVORS('Corozo', 'Maracuyá', 'Mango', 'Lulo', 'Mora', 'Tamarindo'), ingredients: ['Azúcar', 'Hielo'] },
      { name: 'Jugo en Leche', icon: 'jugo', price: 6500, optionsLabel: 'Fruta', options: FLAVORS('Mango', 'Mora', 'Lulo', 'Guanábana', 'Níspero'), ingredients: ['Azúcar', 'Hielo'] },
      { name: 'Limonada de Coco', icon: 'limonada', price: 8000, featured: 1, description: 'Cremosita y bien fría.', ingredients: ['Azúcar', 'Hielo'] },
      { name: 'Limonada Natural', icon: 'limonada', price: 4500, ingredients: ['Azúcar', 'Hielo'] },
    ],
  },
];

const SAUCES = [
  ['Tomate', '#E0452B'],
  ['Mayonesa', '#F6E7B8'],
  ['Rosada', '#F39A8B'],
  ['Piña', '#FFC53D'],
  ['BBQ', '#7A3414'],
  ['Mostaza', '#E2B21A'],
  ['Tártara', '#D5DDB0'],
  ['Ajo', '#EFE6CF'],
  ['Suero costeño', '#FFF6E6'],
  ['Picante', '#C0291D'],
];

const EXTRAS = [
  ['Queso extra', 2500],
  ['Queso costeño', 3000],
  ['Tocineta', 3000],
  ['Huevos de codorniz', 2500],
  ['Salchicha extra', 3000],
  ['Maíz tierno', 2000],
  ['Papa ripio', 1000],
  ['Pollo desmechado', 4000],
  ['Carne desmechada', 4500],
  ['Maduro', 2000],
];

export async function seedIfEmpty() {
  if ((await q.get('SELECT COUNT(*) AS n FROM categories')).n > 0) return false;
  const now = Date.now();
  await tx(async () => {
    let productSort = 0;
    for (const [ci, cat] of MENU.entries()) {
      const { lastInsertRowid } = await q.run('INSERT INTO categories (name, icon, sort) VALUES (?, ?, ?)', cat.category, cat.icon, ci);
      const categoryId = Number(lastInsertRowid);
      for (const p of cat.products) {
        const price = p.price ?? p.options?.[0]?.price ?? 0;
        await q.run(
          `INSERT INTO products (category_id, name, description, price, icon, options_label, options, ingredients,
             allow_sauces, allow_extras, featured, sort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          categoryId,
          p.name,
          p.description ?? '',
          price,
          p.icon,
          p.optionsLabel ?? 'Opción',
          json.str(p.options ?? []),
          json.str(p.ingredients ?? []),
          p.sauces ? 1 : 0,
          p.extras ? 1 : 0,
          p.featured ? 1 : 0,
          productSort++,
          now,
          now,
        );
      }
    }
    for (const [i, [name, color]] of SAUCES.entries()) await q.run('INSERT INTO sauces (name, color, sort) VALUES (?, ?, ?)', name, color, i);
    for (const [i, [name, price]] of EXTRAS.entries()) await q.run('INSERT INTO extras (name, price, sort) VALUES (?, ?, ?)', name, price, i);
  });
  return true;
}
