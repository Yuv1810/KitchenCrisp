export const productCategories = ["Breakfast", "Snacks", "Sweet treats", "Cookies", "Food Platter"] as const;
export type ShopProduct = { id: string; name: string; description: string; price: number; image: string; category: string; productType: "PREMIX" | "READY_TO_EAT"; weight: string; badge: string | null; active?: boolean };
export function matchesCollection(product: ShopProduct, collection: string) {
  if (collection === "All products") return true;
  if (collection === "Premixes") return product.productType === "PREMIX";
  if (collection === "Ready to eat") return product.productType === "READY_TO_EAT";
  return product.category.toLowerCase() === collection.toLowerCase();
}
export const sampleProducts: ShopProduct[] = [
  { id: "ragi-dosa", name: "Ragi Dosa Premix", description: "Earthy ragi, a golden crisp, and all the comfort of a homemade breakfast. Just add water, rest, and cook.", price: 18000, image: "/images/dosa.jpg", category: "Breakfast", productType: "PREMIX", weight: "250 g", badge: "BESTSELLER" },
  { id: "idli", name: "Classic Idli Premix", description: "Soft, fluffy idlis made simple. A little steam and a lot of home-style goodness.", price: 16000, image: "/images/idli.jpg", category: "Breakfast", productType: "PREMIX", weight: "250 g", badge: null },
  { id: "chilla", name: "Moong Dal Chilla Premix", description: "A savoury, protein-rich start to your day with moong dal and warming Indian spices.", price: 19000, image: "/images/chilla.jpg", category: "Breakfast", productType: "PREMIX", weight: "250 g", badge: "KITCHEN FAVOURITE" },
  { id: "pancake", name: "Millet Pancake Premix", description: "A wholesome twist on a weekend favourite. Light, delicious pancakes ready for your favourite toppings.", price: 22000, image: "/images/pancake.jpg", category: "Sweet treats", productType: "PREMIX", weight: "250 g", badge: "NEW" },
  { id: "dhokla", name: "Instant Dhokla Premix", description: "Light, tangy and wonderfully fluffy. Your favourite teatime snack, without the long prep.", price: 17000, image: "/images/dhokla.jpg", category: "Snacks", productType: "PREMIX", weight: "250 g", badge: null },
  { id: "brownie", name: "Chocolate Brownie Premix", description: "Rich chocolate comfort with a soft, fudgy centre. Bake a little happiness at home.", price: 24000, image: "/images/brownie.jpg", category: "Sweet treats", productType: "PREMIX", weight: "250 g", badge: null },
  { id: "choc-chip-cookies", name: "Chocolate Chip Cookies", description: "Baked cookies with chocolate chips and crisp edges. Ready to open, share and eat.", price: 22000, image: "/images/cookies.jpg", category: "Cookies", productType: "READY_TO_EAT", weight: "Pack of 6", badge: null },
  { id: "food-platter", name: "Special Food Platter", description: "A generous assortment of crisp patties, savoury bites, mini chillas, and fresh homemade chutneys. Perfect for sharing.", price: 55000, image: "/images/food-platter.jpg", category: "Food Platter", productType: "READY_TO_EAT", weight: "1 Platter (Serves 3-4)", badge: "SPECIAL" },
  { id: "baked-brownies", name: "Fudgy Chocolate Brownies", description: "Baked chocolate brownies with a soft centre. Serve straight from the box.", price: 28000, image: "/images/brownie.jpg", category: "Sweet treats", productType: "READY_TO_EAT", weight: "Box of 4", badge: null },
];
export const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
export function orderTotals(items: { unitPrice: number; quantity: number }[]) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shipping = 0;
  return { subtotal, shipping: 0, total: subtotal };
}
