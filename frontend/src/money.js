const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(amount) {
    return currency.format(Number(amount));
}

export function toCents(amount) {
    return Math.round(Number(amount) * 100);
}
