const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial demonstration products - Professional Wholesale Cosmetics for Bamako
const INITIAL_PRODUCTS = [
  {
    id: 'prod-001',
    ref: 'DERM-BKO-01',
    name: 'Baume Réparateur Intense Cica-Derm',
    brand: 'DermoPlus Sahel',
    category: 'Dermo-Cosmétique',
    format: 'Tube 100 ml',
    unitPrice: 4200,
    stock: 96,
    active: true,
    allow3UnitsPermanent: true, // Technical product designated for 3 units
    allow3UnitsSpecial: false,
    isNewProduct: true,
    isNewArrival: true,
    isRestock: false,
    description: 'Soin réparateur apaisant à l\'acide hyaluronique et zinc. Idéal pour peaux échauffées et post-actes dermatologiques. Fortement recommandé en officine.',
    image: 'https://images.unsplash.com/photo-1608248597359-25f0a3821817?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-002',
    ref: 'HYG-BKO-02',
    name: 'Lait Corporel Hydratant Karité & Vitamine E',
    brand: 'Sahel Naturals',
    category: 'Hygiène & Corps',
    format: 'Flacon pompe 500 ml',
    unitPrice: 3800,
    stock: 144,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: false,
    isRestock: true, // Restock
    description: 'Lait fluide haute tolérance pour le corps. Pénétration rapide sans film gras. Bestseller pour les rayons supermarchés et pharmacies.',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-003',
    ref: 'SOL-BKO-03',
    name: 'Fluide Solaire Teinté SPF 50+ Anti-Taches',
    brand: 'Solaris Pro',
    category: 'Protection Solaire',
    format: 'Flacon 50 ml',
    unitPrice: 6500,
    stock: 72,
    active: true,
    allow3UnitsPermanent: true, // Technical product (SPF 50+ anti-tache teinté)
    allow3UnitsSpecial: false,
    isNewProduct: true,
    isNewArrival: true,
    isRestock: false,
    description: 'Protection solaire à très large spectre UVA/UVB avec unifiant de teint invisible adapté aux carnations foncées à métissées. Ne laisse aucun résidu blanc.',
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-004',
    ref: 'BEBE-BKO-04',
    name: 'Gel Lavant Doux Bébé Sans Savon',
    brand: 'Bébé Douceur',
    category: 'Soins Bébé & Maternité',
    format: 'Flacon 750 ml',
    unitPrice: 4900,
    stock: 120,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: true,
    isRestock: false,
    description: 'Formule hypoallergénique au calendula bio. Ne pique pas les yeux, préserve la barrière cutanée fragile du nourrisson.',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-005',
    ref: 'CAP-BKO-05',
    name: 'Masque Nutrition Profonde Kératine & Huile d\'Argan',
    brand: 'KeraLiss Pro',
    category: 'Capillaire',
    format: 'Pot 500 ml',
    unitPrice: 5200,
    stock: 60,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: false,
    isRestock: false,
    description: 'Soin intensif restructurant pour cheveux secs, défrisés ou agressés par le soleil et la poussière. Brillance et souplesse immédiate.',
    image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-006',
    ref: 'DERM-BKO-06',
    name: 'Sérum Anti-Imperfections Niacinamide 10% + Zinc',
    brand: 'DermoPlus Sahel',
    category: 'Dermo-Cosmétique',
    format: 'Flacon pipette 30 ml',
    unitPrice: 5800,
    stock: 18, // Low stock -> Administrator exceptional toggle enabled
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: true, // One-off stock authorization by CEO
    isNewProduct: true,
    isNewArrival: false,
    isRestock: false,
    description: 'Traitement concentré pour resserrer les pores et réguler le sébum. Stock limité en entrepôt, autorisation temporaire de commande à partir de 3 unités.',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-007',
    ref: 'HYG-BKO-07',
    name: 'Pain Dermatologique Surgras Sans Savon',
    brand: 'DermoPlus Sahel',
    category: 'Hygiène & Corps',
    format: 'Pain 150 g',
    unitPrice: 2200,
    stock: 180,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: false,
    isRestock: true,
    description: 'Nettoyant visage et corps au pH neutre. Recommandé pour peaux atopiques, intolérantes ou sujettes aux tiraillements.',
    image: 'https://images.unsplash.com/photo-1607006314144-8d9335ef0f04?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-008',
    ref: 'SOL-BKO-08',
    name: 'Brume Solaire Rafraîchissante Invisible SPF 50',
    brand: 'Solaris Pro',
    category: 'Protection Solaire',
    format: 'Aérosol 200 ml',
    unitPrice: 7200,
    stock: 84,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: true,
    isRestock: false,
    description: 'Application ultra-rapide sans étalement, fini sec instantané. Résistante à la sueur et au climat chaud de Bamako.',
    image: 'https://images.unsplash.com/photo-1556228722-d0b7773229b4?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-009',
    ref: 'DERM-BKO-09',
    name: 'Eau Micellaire Purifiante Peaux Sensibles',
    brand: 'BioSoin Pure',
    category: 'Dermo-Cosmétique',
    format: 'Flacon 500 ml',
    unitPrice: 3400,
    stock: 108,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: false,
    isRestock: false,
    description: 'Démaquille et apaise en un seul geste sans rinçage. Convient aux yeux sensibles et porteurs de lentilles.',
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'prod-010',
    ref: 'BEBE-BKO-10',
    name: 'Crème de Change Protectrice à l\'Oxyde de Zinc',
    brand: 'Bébé Douceur',
    category: 'Soins Bébé & Maternité',
    format: 'Tube 100 ml',
    unitPrice: 2800,
    stock: 132,
    active: true,
    allow3UnitsPermanent: false,
    allow3UnitsSpecial: false,
    isNewProduct: false,
    isNewArrival: false,
    isRestock: true,
    description: 'Isole l\'épiderme fessier contre l\'humidité et prévient les rougeurs et irritations du nourrisson dès la première application.',
    image: 'https://images.unsplash.com/photo-1594824813589-780b62e49755?w=600&auto=format&fit=crop&q=80'
  }
];

const INITIAL_SETTINGS = {
  companyName: 'BKO COSMO DISTRIBUTION (Démonstration)',
  ceoName: 'Directeur Commercial & Gérant',
  whatsappNumber: '+22370000000', // Bamako international format placeholder
  email: 'contact@bko-cosmo-distrib.demo',
  city: 'Bamako, Mali',
  warehouseAddress: 'Zone Industrielle Sotuba / ACI 2000, Bamako',
  currency: 'FCFA',
  adminPasswordHash: 'admin123' // default admin pass
};

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Database helper object
const db = {
  getProducts() {
    return readJsonFile(PRODUCTS_FILE, INITIAL_PRODUCTS);
  },
  saveProducts(products) {
    return writeJsonFile(PRODUCTS_FILE, products);
  },
  getOrders() {
    return readJsonFile(ORDERS_FILE, []);
  },
  saveOrders(orders) {
    return writeJsonFile(ORDERS_FILE, orders);
  },
  getSettings() {
    return readJsonFile(SETTINGS_FILE, INITIAL_SETTINGS);
  },
  saveSettings(settings) {
    return writeJsonFile(SETTINGS_FILE, settings);
  }
};

module.exports = db;
