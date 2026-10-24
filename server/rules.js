// Business rules module for wholesale cosmetic distribution in Bamako

function isQuantityAllowed(qty, product) {
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
    return { valid: false, message: 'La quantité doit être un nombre entier positif.' };
  }

  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);

  // Check stock constraint if defined
  if (typeof product.stock === 'number' && qty > product.stock) {
    return {
      valid: false,
      message: `Stock insuffisant pour ${product.name}. Stock disponible: ${product.stock} unités.`
    };
  }

  if (allows3) {
    // Authorized: 3, 6, 12, 18, 24, 30... (9, 15, 21 forbidden)
    if (qty === 3) {
      return { valid: true };
    }
    if (qty >= 6 && qty % 6 === 0) {
      return { valid: true };
    }
    if (qty === 9 || qty === 15 || qty === 21) {
      return {
        valid: false,
        message: `Règle de colisage stricte : la quantité ${qty} est formellement interdite. Les paliers autorisés sont 3, 6, 12, 18, 24...`
      };
    }
    return {
      valid: false,
      message: `Pour cet article avec exception (3 unités), la quantité ${qty} est formellement interdite. Les paliers autorisés sont 3, 6, 12, 18, 24...`
    };
  } else {
    // Standard rule: 6, 12, 18, 24, 30... (3, 9, 15 forbidden)
    if (qty >= 6 && qty % 6 === 0) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `Colisage standard: minimum 6 unités, progression par 6 (6, 12, 18, 24...). Quantité ${qty} non autorisée.`
    };
  }
}

function getInitialQuantity(product) {
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
  return allows3 ? 3 : 6;
}

function getNextQuantity(currentQty, product) {
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
  const maxStock = typeof product.stock === 'number' ? product.stock : Infinity;

  if (!currentQty || currentQty < (allows3 ? 3 : 6)) {
    const init = allows3 ? 3 : 6;
    return Math.min(init, maxStock);
  }

  let next;
  if (allows3 && currentQty < 6) {
    next = 6;
  } else {
    next = currentQty + 6;
  }

  if (next > maxStock) {
    return currentQty; // cannot exceed stock
  }
  return next;
}

function getPrevQuantity(currentQty, product) {
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
  const minAllowed = allows3 ? 3 : 6;

  if (currentQty <= minAllowed) {
    return minAllowed;
  }

  if (allows3 && currentQty === 6) {
    return 3;
  }

  const prev = currentQty - 6;
  return Math.max(prev, minAllowed);
}

function formatFCFA(amount) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  return amount.toLocaleString('fr-FR') + ' FCFA';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isQuantityAllowed,
    getInitialQuantity,
    getNextQuantity,
    getPrevQuantity,
    formatFCFA
  };
}
