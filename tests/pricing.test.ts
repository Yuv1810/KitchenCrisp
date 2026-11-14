import { test } from "node:test";
import assert from "node:assert/strict";
import { orderTotals, matchesCollection, sampleProducts } from "../src/lib/products";
test("cash-on-delivery totals use integer paise and apply the delivery threshold", () => {
  assert.deepEqual(orderTotals([{ unitPrice: 18000, quantity: 2 }]), { subtotal: 36000, shipping: 0, total: 36000 });
  assert.deepEqual(orderTotals([{ unitPrice: 49900, quantity: 1 }]), { subtotal: 49900, shipping: 0, total: 49900 });
  assert.deepEqual(orderTotals([{ unitPrice: 18000, quantity: 2 }, { unitPrice: 16000, quantity: 1 }]), { subtotal: 52000, shipping: 0, total: 52000 });
});
test("collections distinguish preparation type from food category", () => {
  const bakedBrownie = sampleProducts.find(p => p.id === "baked-brownies")!;
  const brownieMix = sampleProducts.find(p => p.id === "brownie")!;
  const cookies = sampleProducts.find(p => p.id === "choc-chip-cookies")!;
  assert.equal(matchesCollection(bakedBrownie, "Ready to eat"), true);
  assert.equal(matchesCollection(bakedBrownie, "Premixes"), false);
  assert.equal(matchesCollection(brownieMix, "Premixes"), true);
  assert.equal(matchesCollection(brownieMix, "Ready to eat"), false);
  assert.equal(matchesCollection(cookies, "Cookies"), true);
  assert.equal(matchesCollection({ ...cookies, productType: "PREMIX" }, "Ready to eat"), false);
  assert.equal(matchesCollection(cookies, "All products"), true);
});
