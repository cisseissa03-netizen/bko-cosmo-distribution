const XLSX = require('xlsx');

// Headers definition for the template and export
const TEMPLATE_COLUMNS = [
  { header: 'Reference', key: 'ref', example: 'DERM-BKO-20' },
  { header: 'Nom_Produit', key: 'name', example: 'Crème Hydratante Apaisante Aloé Vera' },
  { header: 'Marque', key: 'brand', example: 'DermoPlus Sahel' },
  { header: 'Categorie', key: 'category', example: 'Dermo-Cosmétique' },
  { header: 'Format_Contenance', key: 'format', example: 'Tube 150 ml' },
  { header: 'Prix_Unitaire_FCFA', key: 'unitPrice', example: 4500 },
  { header: 'Stock_Disponible', key: 'stock', example: 96 },
  { header: 'Exception_3_Unites', key: 'allow3UnitsPermanent', example: 'NON' },
  { header: 'Nouveau_Arrivage', key: 'isNewArrival', example: 'OUI' },
  { header: 'Retour_Stock', key: 'isRestock', example: 'NON' },
  { header: 'Description', key: 'description', example: 'Soin hydratant quotidien pour peaux sensibles et échauffées.' },
  { header: 'Photo_URL', key: 'image', example: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80' }
];

function normalizeKey(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseYesNo(val) {
  if (!val) return false;
  const s = val.toString().trim().toUpperCase();
  return s === 'OUI' || s === 'YES' || s === 'TRUE' || s === '1' || s === 'VRAI';
}

function mapHeaderToKey(rawHeader) {
  const norm = normalizeKey(rawHeader);

  // Reference checks
  if (norm === 'ref' || norm === 'reference' || norm === 'code' || norm === 'coderef' || norm === 'referenceproduit' || norm.startsWith('ref') || norm.endsWith('ref')) {
    return 'ref';
  }
  // Price checks (must precede anything generic)
  if (norm.includes('prix') || norm.includes('price') || norm.includes('tarif') || norm.includes('fcfa') || norm === 'pu') {
    return 'unitPrice';
  }
  // Name / Title
  if (norm.includes('nom') || norm.includes('designation') || norm.includes('title') || norm === 'produit') {
    return 'name';
  }
  // Brand
  if (norm.includes('marque') || norm.includes('brand')) {
    return 'brand';
  }
  // Category
  if (norm.includes('cat') || norm.includes('rayon')) {
    return 'category';
  }
  // Format / Size
  if (norm.includes('format') || norm.includes('contenance') || norm.includes('taille') || norm.includes('volume') || norm.includes('ml') || norm.includes('gr')) {
    return 'format';
  }
  // Restock check (must precede stock check since 'Retour_Stock' contains 'stock')
  if (norm.includes('retour') || norm.includes('restock') || norm.includes('reassort')) {
    return 'isRestock';
  }
  // Stock
  if (norm === 'stock' || norm.includes('stockdispo') || norm.includes('qte') || norm.includes('quantite') || norm.includes('dispo') || norm.includes('stock')) {
    return 'stock';
  }
  // 3-unit exception
  if (norm.includes('3unite') || norm.includes('exception') || norm.includes('tech') || norm.includes('troisunite')) {
    return 'allow3Units';
  }
  // Arrivals
  if (norm.includes('arriv') || norm.includes('nouveaute') || norm.includes('nouvel')) {
    return 'isNewArrival';
  }
  // Description
  if (norm.includes('desc') || norm.includes('detail') || norm.includes('indic') || norm.includes('resume')) {
    return 'description';
  }
  // Photo / Image
  if (norm.includes('photo') || norm.includes('image') || norm.includes('visuel') || norm.includes('img') || norm.includes('url')) {
    return 'image';
  }
  return null;
}

// Generate Excel Template Buffer
function generateTemplateBuffer() {
  const sampleData = [
    {
      'Reference': 'DERM-BKO-20',
      'Nom_Produit': 'Crème Hydratante Apaisante Aloé Vera',
      'Marque': 'DermoPlus Sahel',
      'Categorie': 'Dermo-Cosmétique',
      'Format_Contenance': 'Tube 150 ml',
      'Prix_Unitaire_FCFA': 4500,
      'Stock_Disponible': 96,
      'Exception_3_Unites': 'NON',
      'Nouveau_Arrivage': 'OUI',
      'Retour_Stock': 'NON',
      'Description': 'Soin hydratant quotidien pour peaux sensibles et échauffées par le climat de Bamako.',
      'Photo_URL': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80'
    },
    {
      'Reference': 'SOL-BKO-21',
      'Nom_Produit': 'Fluide Solaire Minéral Teinté SPF 50+',
      'Marque': 'Solaris Pro',
      'Categorie': 'Protection Solaire',
      'Format_Contenance': 'Flacon 50 ml',
      'Prix_Unitaire_FCFA': 6800,
      'Stock_Disponible': 60,
      'Exception_3_Unites': 'OUI',
      'Nouveau_Arrivage': 'OUI',
      'Retour_Stock': 'NON',
      'Description': 'Protection solaire haute tolérance sans traces blanches. Produit technique autorisé dès 3 unités.',
      'Photo_URL': 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80'
    },
    {
      'Reference': 'BEBE-BKO-22',
      'Nom_Produit': 'Eau Nettoyante Micellaire Bébé',
      'Marque': 'Bébé Douceur',
      'Categorie': 'Soins Bébé & Maternité',
      'Format_Contenance': 'Flacon 500 ml',
      'Prix_Unitaire_FCFA': 3900,
      'Stock_Disponible': 120,
      'Exception_3_Unites': 'NON',
      'Nouveau_Arrivage': 'NON',
      'Retour_Stock': 'OUI',
      'Description': 'Nettoie en douceur le siège et le visage du nourrisson sans rinçage.',
      'Photo_URL': 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=600&auto=format&fit=crop&q=80'
    }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);

  ws['!cols'] = [
    { wch: 16 }, { wch: 38 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
    { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
    { wch: 45 }, { wch: 40 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue Produits');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Export Current Catalog to Excel
function generateCatalogExportBuffer(products) {
  const exportData = products.map(p => ({
    'Reference': p.ref,
    'Nom_Produit': p.name,
    'Marque': p.brand || 'Générique',
    'Categorie': p.category || 'Dermo-Cosmétique',
    'Format_Contenance': p.format || 'Standard',
    'Prix_Unitaire_FCFA': p.unitPrice,
    'Stock_Disponible': p.stock || 0,
    'Exception_3_Unites': (p.allow3UnitsPermanent || p.allow3UnitsSpecial) ? 'OUI' : 'NON',
    'Nouveau_Arrivage': p.isNewArrival ? 'OUI' : 'NON',
    'Retour_Stock': p.isRestock ? 'OUI' : 'NON',
    'Description': p.description || '',
    'Photo_URL': p.image || ''
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [
    { wch: 16 }, { wch: 38 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
    { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
    { wch: 45 }, { wch: 40 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Catalogue Existant');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Parse Excel or CSV buffer
function parseExcelFile(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Le fichier Excel ne contient aucune feuille.');
  }

  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], { defval: '' });
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error('Le fichier Excel est vide ou ne contient aucune ligne de données.');
  }

  const parsedProducts = [];

  rawRows.forEach((row, index) => {
    const item = {};
    for (const [key, val] of Object.entries(row)) {
      const field = mapHeaderToKey(key);
      if (field) {
        if (field === 'ref') item.ref = val.toString().trim().toUpperCase();
        else if (field === 'name') item.name = val.toString().trim();
        else if (field === 'brand') item.brand = val.toString().trim();
        else if (field === 'category') item.category = val.toString().trim();
        else if (field === 'format') item.format = val.toString().trim();
        else if (field === 'unitPrice') item.unitPrice = Number(val) || 0;
        else if (field === 'stock') item.stock = Number(val) || 0;
        else if (field === 'allow3Units') item.allow3Units = parseYesNo(val);
        else if (field === 'isNewArrival') item.isNewArrival = parseYesNo(val);
        else if (field === 'isRestock') item.isRestock = parseYesNo(val);
        else if (field === 'description') item.description = val.toString().trim();
        else if (field === 'image') item.image = val.toString().trim();
      }
    }

    if (!item.name && !item.ref) return;

    if (!item.ref) {
      item.ref = `REF-BKO-${Date.now().toString(36).toUpperCase()}-${index + 1}`;
    }
    if (!item.name) {
      item.name = `Produit ${item.ref}`;
    }

    item.brand = item.brand || 'DermoPlus Sahel';
    item.category = item.category || 'Dermo-Cosmétique';
    item.format = item.format || 'Standard';
    item.unitPrice = Number(item.unitPrice) || 3500;
    item.stock = Number(item.stock) || 48;
    item.allow3UnitsPermanent = Boolean(item.allow3Units);
    item.allow3UnitsSpecial = false;
    item.isNewProduct = false;
    item.isNewArrival = Boolean(item.isNewArrival);
    item.isRestock = Boolean(item.isRestock);
    item.description = item.description || '';
    item.image = item.image || 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80';
    item.active = true;

    parsedProducts.push(item);
  });

  return parsedProducts;
}

module.exports = {
  generateTemplateBuffer,
  generateCatalogExportBuffer,
  parseExcelFile
};
