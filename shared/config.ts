import type { RestaurantConfig, Sop } from './types.ts'

export const DEFAULT_SOP: Sop = {
  greetWithinMin: 2,
  orderNudgeAfterMin: 8,
  kitchenDelayToleranceMin: 4,
  pickupWithinMin: 1.5,
  checkbackAfterMin: 3,
  courseCheckAfterMin: 14,
  billPresentWithinMin: 3,
  farewellWithinMin: 2,
  resetWithinMin: 5,
  maxActiveTablesPerServer: 4,
}

export const DEMO_CONFIG: RestaurantConfig = {
  name: 'Saffron House',
  sections: { A: 's_aisha', B: 's_rohan', C: 's_meera' },
  staff: [
    { id: 's_aisha', name: 'Aisha', role: 'server', color: '#e07a5f' },
    { id: 's_rohan', name: 'Rohan', role: 'server', color: '#3d9a8b' },
    { id: 's_meera', name: 'Meera', role: 'server', color: '#8d6cd1' },
    { id: 'k_pass', name: 'Chef Vikram', role: 'kitchen', color: '#d4a24c' },
    { id: 'm_floor', name: 'Floor Manager', role: 'manager', color: '#6b7280' },
  ],
  tables: [
    { id: 'T1', name: 'T1', seats: 2, section: 'A', posTableId: '1', pos: { x: 26, y: 32 } },
    { id: 'T2', name: 'T2', seats: 4, section: 'A', posTableId: '2', pos: { x: 74, y: 32 } },
    { id: 'T3', name: 'T3', seats: 4, section: 'A', posTableId: '3', pos: { x: 26, y: 74 } },
    { id: 'T4', name: 'T4', seats: 6, section: 'A', posTableId: '4', pos: { x: 74, y: 74 } },
    { id: 'T5', name: 'T5', seats: 2, section: 'B', posTableId: '5', pos: { x: 25, y: 40 } },
    { id: 'T6', name: 'T6', seats: 4, section: 'B', posTableId: '6', pos: { x: 75, y: 40 } },
    { id: 'T7', name: 'T7', seats: 4, section: 'B', posTableId: '7', pos: { x: 50, y: 78 } },
    { id: 'T8', name: 'T8', seats: 2, section: 'C', posTableId: '8', pos: { x: 25, y: 35 } },
    { id: 'T9', name: 'T9', seats: 4, section: 'C', posTableId: '9', pos: { x: 75, y: 35 } },
    { id: 'T10', name: 'T10', seats: 8, section: 'C', posTableId: '10', pos: { x: 50, y: 76 } },
  ],
  menu: [
    { id: 'm_burrata', name: 'Burrata & heirloom tomato', course: 'starter', station: 'cold', prepMin: 6, posItemId: '1001', contains: ['dairy'] },
    { id: 'm_galouti', name: 'Galouti kebab', course: 'starter', station: 'grill', prepMin: 9, posItemId: '1002', contains: ['meat', 'root', 'nuts'] },
    { id: 'm_soup', name: 'Wild mushroom soup', course: 'starter', station: 'hot', prepMin: 7, posItemId: '1003', contains: ['dairy', 'root'] },
    { id: 'm_tikka', name: 'Paneer tikka', course: 'starter', station: 'grill', prepMin: 10, posItemId: '1004', contains: ['dairy', 'root'] },
    { id: 'm_lamb', name: 'Slow-cooked lamb shank', course: 'main', station: 'hot', prepMin: 14, posItemId: '2001', contains: ['meat', 'root', 'alcohol'] },
    { id: 'm_seabass', name: 'Pan-seared sea bass', course: 'main', station: 'grill', prepMin: 16, posItemId: '2002', contains: ['fish', 'dairy'] },
    { id: 'm_risotto', name: 'Truffle risotto', course: 'main', station: 'hot', prepMin: 15, posItemId: '2003', contains: ['dairy', 'root', 'alcohol'] },
    { id: 'm_biryani', name: 'Dum biryani', course: 'main', station: 'hot', prepMin: 12, posItemId: '2004', contains: ['meat', 'nuts', 'dairy', 'root'] },
    { id: 'm_gnocchi', name: 'Pumpkin gnocchi', course: 'main', station: 'hot', prepMin: 13, posItemId: '2005', contains: ['gluten', 'dairy', 'egg', 'root'] },
    { id: 'm_fondant', name: 'Chocolate fondant', course: 'dessert', station: 'pastry', prepMin: 11, posItemId: '3001', contains: ['gluten', 'dairy', 'egg'] },
    { id: 'm_kulfi', name: 'Pistachio kulfi', course: 'dessert', station: 'pastry', prepMin: 4, posItemId: '3002', contains: ['dairy', 'nuts'] },
    { id: 'm_brulee', name: 'Saffron crème brûlée', course: 'dessert', station: 'pastry', prepMin: 6, posItemId: '3003', contains: ['dairy', 'egg'] },
  ],
  sop: DEFAULT_SOP,
}
