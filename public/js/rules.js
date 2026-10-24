// Commercial rules module for browser frontend (Bamako Wholesale)

export function isQuantityAllowed(qty, product) {
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
    return { valid: false, message: 'La quantité doit être un nombre entier positif.' };
  }

  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);

  if (typeof product.stock === 'number' && qty > product.stock) {
    return {
      valid: false,
      message: `Stock insuffisant (${product.stock} unités disponibles).`
    };
  }

  if (allows3) {
    if (qty === 3) return { valid: true };
    if (qty >= 6 && qty % 6 === 0) return { valid: true };
    return {
      valid: false,
      message: `Règle de colisage stricte : la quantité ${qty} est formellement interdite. Paliers autorisés : 3, 6, 12, 18, 24...`
    };
  } else {
    if (qty >= 6 && qty % 6 === 0) return { valid: true };
    return {
      valid: false,
      message: `Colisage standard : minimum 6 unités, progression de 6 en 6 (6, 12, 18, 24...). ${qty} non autorisé.`
    };
  }
}

export function getInitialQuantity(product) {
  const allows3 = Boolean(product.allow3UnitsPermanent || product.allow3UnitsSpecial);
  return allows3 ? 3 : 6;
}

export function getNextQuantity(currentQty, product) {
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
    return currentQty;
  }
  return next;
}

export function getPrevQuantity(currentQty, product) {
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

export function formatFCFA(amount) {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  return amount.toLocaleString('fr-FR') + ' FCFA';
}
