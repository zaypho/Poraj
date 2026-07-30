/** Tiny module-level cart store for the merch shop. */
export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  size?: string | null;
}

let lines: CartLine[] = [];

export const getCart = () => lines;
export const cartCount = () => lines.reduce((s, l) => s + l.qty, 0);
export const cartTotal = () => lines.reduce((s, l) => s + l.price * l.qty, 0);

export const addToCart = (line: CartLine) => {
  const key = `${line.product_id}:${line.size || ""}`;
  const found = lines.find((l) => `${l.product_id}:${l.size || ""}` === key);
  if (found) found.qty += line.qty;
  else lines = [...lines, { ...line }];
};

export const setQty = (idx: number, qty: number) => {
  if (qty <= 0) lines = lines.filter((_, i) => i !== idx);
  else lines = lines.map((l, i) => (i === idx ? { ...l, qty } : l));
};

export const clearCart = () => {
  lines = [];
};
