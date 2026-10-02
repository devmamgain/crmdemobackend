// DEMO comparable-transaction dataset: clearly synthetic historical sale prices (USD per unit, "Good" condition).
// These are NOT real or current market prices. Replace via marketDataService for a real provider.
export const MARKET_SEED = [
  // Laptops
  { model: 'Dell Latitude 5420', category: 'Laptop', brand: 'Dell', prices: [380, 410, 425, 395, 420] },
  { model: 'Dell Latitude 5430', category: 'Laptop', brand: 'Dell', prices: [470, 495, 510, 485, 500, 480] },
  { model: 'Dell Latitude 5520', category: 'Laptop', brand: 'Dell', prices: [430, 455, 470, 440, 460] },
  { model: 'Dell Latitude 7420', category: 'Laptop', brand: 'Dell', prices: [440, 465, 450, 470, 455] },
  { model: 'HP EliteBook 840 G7', category: 'Laptop', brand: 'HP', prices: [340, 365, 350, 372, 358] },
  { model: 'HP EliteBook 840 G8', category: 'Laptop', brand: 'HP', prices: [455, 480, 495, 470, 490, 465] },
  { model: 'HP ProBook 450 G8', category: 'Laptop', brand: 'HP', prices: [290, 310, 325, 300, 315] },
  { model: 'Lenovo ThinkPad T14', category: 'Laptop', brand: 'Lenovo', prices: [360, 385, 370, 395, 380] },
  { model: 'Lenovo ThinkPad T480', category: 'Laptop', brand: 'Lenovo', prices: [190, 210, 200, 185, 205, 240] },
  { model: 'Lenovo ThinkPad X1 Carbon Gen 9', category: 'Laptop', brand: 'Lenovo', prices: [610, 645, 660, 630, 650, 640] },
  { model: 'MacBook Pro 2021', category: 'Laptop', brand: 'Apple', prices: [560, 590, 610, 575, 600, 585] },
  { model: 'MacBook Air M1', category: 'Laptop', brand: 'Apple', prices: [480, 510, 495, 520, 505] },
  // Desktops
  { model: 'Dell OptiPlex 7090', category: 'Desktop', brand: 'Dell', prices: [320, 345, 335, 355, 330] },
  { model: 'Dell OptiPlex 3080', category: 'Desktop', brand: 'Dell', prices: [190, 205, 215, 200, 210] },
  { model: 'HP EliteDesk 800 G6', category: 'Desktop', brand: 'HP', prices: [300, 325, 315, 335, 310] },
  { model: 'Lenovo ThinkCentre M720', category: 'Desktop', brand: 'Lenovo', prices: [180, 195, 205, 190, 200] },
  // Servers
  { model: 'Dell PowerEdge R640', category: 'Server', brand: 'Dell', prices: [980, 1050, 1120, 1015, 1090, 1040] },
  { model: 'Dell PowerEdge R740', category: 'Server', brand: 'Dell', prices: [1250, 1340, 1420, 1290, 1360] },
  { model: 'HP ProLiant DL380 Gen10', category: 'Server', brand: 'HP', prices: [1020, 1090, 1160, 1060, 1110] },
  { model: 'Lenovo ThinkSystem SR650', category: 'Server', brand: 'Lenovo', prices: [940, 1005, 1070, 985, 1030] },
  // Monitors
  { model: 'Dell P2422H', category: 'Monitor', brand: 'Dell', prices: [85, 92, 98, 90, 95] },
  { model: 'Dell UltraSharp U2719D', category: 'Monitor', brand: 'Dell', prices: [150, 162, 170, 158, 165] },
  { model: 'HP E24 G4', category: 'Monitor', brand: 'HP', prices: [70, 78, 82, 75, 80] },
  { model: 'Lenovo ThinkVision T24i', category: 'Monitor', brand: 'Lenovo', prices: [65, 72, 76, 70, 74] },
  // Networking
  { model: 'Cisco Catalyst 9200-24P', category: 'Networking', brand: 'Cisco', prices: [620, 665, 700, 645, 680] },
  { model: 'Cisco Catalyst 2960X-48', category: 'Networking', brand: 'Cisco', prices: [210, 235, 250, 225, 240] },
  { model: 'Aruba 2930F 48G', category: 'Networking', brand: 'HPE Aruba', prices: [330, 360, 380, 350, 370] },
  { model: 'Juniper EX4300-48T', category: 'Networking', brand: 'Juniper', prices: [540, 585, 620, 570, 600] },
  // Mobile
  { model: 'iPhone 13', category: 'Phone', brand: 'Apple', prices: [390, 410, 400, 385, 420] },
  { model: 'iPhone 14', category: 'Phone', brand: 'Apple', prices: [520, 545, 530, 555, 540] },
  { model: 'Samsung Galaxy S22', category: 'Phone', brand: 'Samsung', prices: [300, 320, 310, 295, 330] },
  { model: 'iPad 9th Gen', category: 'Tablet', brand: 'Apple', prices: [215, 230, 225, 220, 235] },
];

// Demo client inventories used to pre-seed a few saved valuations (model, qty, condition).
export const SEED_ANALYSES = [
  { filename: 'Northbridge-Health-laptop-refresh.xlsx', daysAgo: 4, rows: [['Dell Latitude 5420', 120, 'Good'], ['HP EliteBook 840 G7', 80, 'Good'], ['Dell P2422H', 150, 'Good'], ['Lenovo ThinkPad T14', 40, 'Fair']] },
  { filename: 'Harborview-Credit-Union-branch-decommission.xlsx', daysAgo: 9, rows: [['Dell OptiPlex 7090', 60, 'Good'], ['HP E24 G4', 90, 'Good'], ['Cisco Catalyst 2960X-48', 14, 'Fair'], ['HP ProLiant DL380 Gen10', 6, 'Good']] },
  { filename: 'Meridian-Data-Centers-rack-retirement.xlsx', daysAgo: 16, rows: [['Dell PowerEdge R740', 18, 'Good'], ['Dell PowerEdge R640', 24, 'Fair'], ['Cisco Catalyst 9200-24P', 10, 'Good'], ['Juniper EX4300-48T', 8, 'Excellent']] },
];
