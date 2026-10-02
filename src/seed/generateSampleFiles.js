import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sample-data');
const header = ['Model Number', 'Category', 'Quantity', 'Condition'];

function write(name, rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Client Inventory');
  XLSX.writeFile(wb, path.join(dir, name));
  console.log(`wrote ${name}`);
}

// 1) End-user device refresh. Note "ThinkPad T14" (partial name) demonstrates asset normalization/matching.
const refresh = [
  ['Dell Latitude 5420', 'Laptop', 40, 'Good'],
  ['Dell Latitude 5520', 'Laptop', 25, 'Good'],
  ['HP EliteBook 840 G7', 'Laptop', 30, 'Good'],
  ['ThinkPad T14', 'Laptop', 18, 'Fair'],
  ['MacBook Pro 2021', 'Laptop', 6, 'Excellent'],
  ['Dell OptiPlex 7090', 'Desktop', 22, 'Good'],
  ['HP EliteDesk 800 G6', 'Desktop', 15, 'Fair'],
  ['Dell P2422H', 'Monitor', 60, 'Good'],
  ['Dell UltraSharp U2719D', 'Monitor', 24, 'Excellent'],
  ['iPhone 14', 'Phone', 15, 'Good'],
];
write('sample-inventory.xlsx', refresh);

// 2) Data center decommission: servers + networking.
write('sample-datacenter-decommission.xlsx', [
  ['Dell PowerEdge R640', 'Server', 12, 'Good'],
  ['PowerEdge R740', 'Server', 8, 'Good'],
  ['HP ProLiant DL380 Gen10', 'Server', 10, 'Fair'],
  ['Lenovo ThinkSystem SR650', 'Server', 4, 'Good'],
  ['Cisco Catalyst 9200-24P', 'Networking', 14, 'Good'],
  ['Cisco Catalyst 2960X-48', 'Networking', 20, 'Fair'],
  ['Aruba 2930F 48G', 'Networking', 9, 'Good'],
  ['Juniper EX4300-48T', 'Networking', 6, 'Excellent'],
]);

// 3) Messy real-world input: punctuation variants, missing condition, an ambiguous model, and an unknown model.
write('sample-inventory-with-unknown.xlsx', [
  ['Dell Latitude-5430', 'Laptop', 12, ''],                 // normalized match, condition assumed Good
  ['HP Elitebook 840 G8', 'Laptop', 20, 'Good'],           // case variant -> normalized match
  ['HP EliteBook 840', 'Laptop', 10, 'Good'],              // ambiguous (G7 vs G8) -> no market data
  ['Dell OptiPlex 7090', 'Desktop', 30, 'Good'],
  ['Cisco Catalyst 9200-24P', 'Networking', 8, 'Good'],
  ['Fortinet FortiGate 100F', 'Networking', 5, 'Good'],    // unknown -> "Add market data"
]);
