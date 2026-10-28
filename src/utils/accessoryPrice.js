export function accessorySalePrice(prices, quantity) {
  const wholesale = prices?.precioMayorista ?? prices?.precioMayoristaSoles;
  const minimum = prices?.cantidadMinimaMayorista;
  return wholesale != null && minimum != null && Number(quantity) >= Number(minimum)
    ? Number(wholesale) : (prices?.precioPublicado ?? prices?.precioPublicadoSoles ?? null);
}
