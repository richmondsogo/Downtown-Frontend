import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { db } from "../index";
import { user, listing, listingPhoto, campus, category, location } from "../schema";
import { assertSafeSeedEnvironment } from "../guard-seed";
import { sql, eq } from "drizzle-orm";

interface SeedPlaceholder {
  categorySlug: string;
  displayKey: string;
  thumbKey: string;
}

const PLACEHOLDERS: Record<string, SeedPlaceholder> = {
  electronics: {
    categorySlug: "electronics",
    displayKey: "/placeholders/laptop_display.webp",
    thumbKey: "/placeholders/laptop_thumb.webp",
  },
  phone: {
    categorySlug: "electronics",
    displayKey: "/placeholders/phone_display.webp",
    thumbKey: "/placeholders/phone_thumb.webp",
  },
  "books-study-materials": {
    categorySlug: "books-study-materials",
    displayKey: "/placeholders/book_display.webp",
    thumbKey: "/placeholders/book_thumb.webp",
  },
  "fashion-accessories": {
    categorySlug: "fashion-accessories",
    displayKey: "/placeholders/fashion_display.webp",
    thumbKey: "/placeholders/fashion_thumb.webp",
  },
  "home-living": {
    categorySlug: "home-living",
    displayKey: "/placeholders/appliance_display.webp",
    thumbKey: "/placeholders/appliance_thumb.webp",
  },
};

const SAMPLE_TITLES: { categorySlug: string; titles: string[]; placeholderType: string }[] = [
  {
    categorySlug: "electronics",
    placeholderType: "electronics",
    titles: [
      "HP EliteBook 840 G5 Core i5 16GB RAM 512GB SSD",
      "Dell Latitude 7490 Core i7 8GB RAM Clean",
      "MacBook Pro 13-inch 2019 Touch Bar Space Gray",
      "Lenovo ThinkPad T480 Dual Battery Solid Condition",
      "Oraimo 20000mAh Power Bank Fast Charging",
      "Scientific Calculator Casio fx-991EX ClassWiz",
      "Extension Box 6-way with Surge Protector",
      "Rechargeable Standing Fan with Remote Control",
      "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
      "iPad 9th Generation 64GB WiFi with Apple Pencil 1",
    ],
  },
  {
    categorySlug: "electronics",
    placeholderType: "phone",
    titles: [
      "iPhone 12 128GB Factory Unlocked 86% Battery Health",
      "Samsung Galaxy S21 5G 128GB Phantom Gray",
      "Redmi Note 11 6GB/128GB Dual SIM Star Blue",
      "Infinix Hot 12 Play 4GB/64GB Long Battery Life",
      "Tecno Camon 19 Pro 8GB/128GB Pristine Condition",
      "iPhone XR 64GB Red Flawless Face ID Active",
    ],
  },
  {
    categorySlug: "books-study-materials",
    placeholderType: "books-study-materials",
    titles: [
      "Essential Engineering Mathematics by K.A. Stroud 7th Ed",
      "Guyton and Hall Medical Physiology Textbook Latest Edition",
      "Principles of Economics by Mankiw (Soft Copy & Hardcover)",
      "General Chemistry 101 Lecture Notes and Past Questions",
      "Introduction to Computer Science with Python Handbook",
      "GST 101 Use of English Complete Compendium and Past Questions",
      "Anatomy and Physiology Laboratory Manual Clean Unmarked",
      "Business Law Principles and Practice by Kodilinye",
    ],
  },
  {
    categorySlug: "fashion-accessories",
    placeholderType: "fashion-accessories",
    titles: [
      "Vintage Denim Jacket Unisex Size Large",
      "Nike Air Force 1 All White Size 43 Pristine",
      "Black Leather Chelsea Boots Size 42 Handcrafted",
      "Casual Oxford Button-down Shirts (Pack of 3)",
      "Traditional Senator Wear Navy Blue Tailored Fit",
      "Unisex Campus Backpack with Laptop Compartment Water Resistant",
      "Casio Vintage Digital Watch Gold Stainless Steel",
      "Trendy Oversized Graphic Tees (Black & Khaki)",
    ],
  },
  {
    categorySlug: "home-living",
    placeholderType: "home-living",
    titles: [
      "Compact Single-Door Refrigerator Hisense 90L Clean",
      "Stainless Steel Electric Kettle 2.0L Fast Boil",
      "Orthopedic Foam Mattress 4.5 x 6 ft with Cover",
      "Single Burner Gas Cooker with 6kg Gas Cylinder & Regulator",
      "Sturdy Wooden Study Desk and Ergonomic Swivel Chair",
      "Plastic Wardrobe Storage Organizer 4-tier Modular",
      "Rechargeable Table Lamp LED 3 Lighting Modes",
      "Bedside Drawer with Lock and Key Brown Oak",
    ],
  },
  {
    categorySlug: "food-drinks",
    placeholderType: "home-living",
    titles: [
      "Bag of Rice 50kg Royal Stallion (Half Bag Sharing)",
      "Fresh Farm Plantain Bunch Direct from Farm",
      "Carton of Indomie Instant Noodles Super Pack (40 Pcs)",
      "Tubers of Benue Yam (Set of 5 Large Tubers)",
    ],
  },
  {
    categorySlug: "beauty-personal-care",
    placeholderType: "fashion-accessories",
    titles: [
      "Rechargeable Hair Clipper Kemei Professional Cordless",
      "CeraVe Hydrating Facial Cleanser 473ml Authentic",
      "Original Arabian Perfume Fragrance Eau De Parfum 100ml",
      "Hair Dryer 2000W with Diffuser and Comb Attachments",
    ],
  },
  {
    categorySlug: "services",
    placeholderType: "electronics",
    titles: [
      "Laptop Repair & OS Installation Windows/Mac on Campus",
      "Project & Thesis Binding / Fast Laser Printing Service",
      "Professional Haircut & Home Barbering Service",
      "Assignment Typesetting and Statistical Analysis SPSS",
    ],
  },
];

const SELLER_NAMES = [
  { name: "Tunde Bakare", business: "Tunde Gadgets Hub", verified: true },
  { name: "Blessing Okafor", business: "Blessing Fashion Closet", verified: true },
  { name: "Richmond Sogo", business: "Downtown Express Deals", verified: true },
  { name: "Amina Bello", business: null, verified: true },
  { name: "Emeka Nwosu", business: "Emeka Electronics & Parts", verified: true },
  { name: "Farida Adeleke", business: "Campus Essentials Store", verified: true },
  { name: "Kehinde Adeyemi", business: null, verified: false },
  { name: "Oluwaseun Ajayi", business: null, verified: false },
  { name: "Chidimma Eze", business: "Chidi Study Materials", verified: true },
  { name: "Femi Balogun", business: "Balogun Tech Support", verified: true },
];

export async function seed500Listings() {
  assertSafeSeedEnvironment();
  console.log("Starting 500 listings seed generation...");

  // 1. Fetch campuses, categories, and locations
  const allCampuses = await db.select().from(campus);
  const allCategories = await db.select().from(category);
  const allLocations = await db.select().from(location);

  if (allCampuses.length === 0 || allCategories.length === 0 || allLocations.length === 0) {
    throw new Error("Missing prerequisite seed data (campuses, categories, or locations). Run base seed first.");
  }

  // 2. Ensure seed sellers exist
  const sellerIds: { id: string; verified: boolean; campusId: string }[] = [];
  for (let i = 0; i < SELLER_NAMES.length; i++) {
    const s = SELLER_NAMES[i];
    const email = `seed.seller.${i + 1}@uniosun.edu.ng`;
    const campusId = allCampuses[i % allCampuses.length].id;

    let [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!existing) {
      const newId = `usr_seed_seller_${i + 1}`;
      await db.insert(user).values({
        id: newId,
        name: s.name,
        email,
        emailVerified: true,
        role: "student",
        matricNumber: `2023/${10000 + i}`,
        sellerStatus: s.verified ? "verified" : "not_a_seller",
        accountStatus: "active",
        createdAt: new Date(Date.now() - (30 - i) * 86400000),
      });
      sellerIds.push({ id: newId, verified: s.verified, campusId });
    } else {
      await db.update(user).set({
        name: s.name,
        sellerStatus: s.verified ? "verified" : "not_a_seller",
        accountStatus: "active",
        emailVerified: true,
      }).where(eq(user.id, existing.id));
      sellerIds.push({ id: existing.id, verified: s.verified, campusId });
    }
  }

  // 3. Clean up any previous seed 500 listings
  console.log("Cleaning up prior seed 500 listings...");
  await db.execute(sql`
    DELETE FROM listing_photos WHERE is_seed = true;
    DELETE FROM listings WHERE id LIKE 'lst_seed_500_%';
  `);

  console.log("Generating 500 listings...");
  const listingsToInsert = [];
  const photosToInsert = [];

  const categoryMap = new Map(allCategories.map(c => [c.slug, c.id]));
  const campusesBySlug = allCampuses;

  // Status breakdown:
  // 380 published, 40 reserved, 40 sold, 20 draft, 10 pending_moderation, 10 archived = 500 total
  const statuses: ("published" | "reserved" | "sold" | "draft" | "pending_moderation" | "archived")[] = [];
  for (let i = 0; i < 380; i++) statuses.push("published");
  for (let i = 0; i < 40; i++) statuses.push("reserved");
  for (let i = 0; i < 40; i++) statuses.push("sold");
  for (let i = 0; i < 20; i++) statuses.push("draft");
  for (let i = 0; i < 10; i++) statuses.push("pending_moderation");
  for (let i = 0; i < 10; i++) statuses.push("archived");

  const conditions: ("new" | "like_new" | "good" | "fair")[] = ["new", "like_new", "good", "fair"];

  for (let i = 0; i < 500; i++) {
    const listId = `lst_seed_500_${String(i + 1).padStart(4, "0")}`;
    const status = statuses[i];
    const seller = sellerIds[i % sellerIds.length];
    
    // Pick category and sample title
    const templateGroup = SAMPLE_TITLES[i % SAMPLE_TITLES.length];
    const categoryId = categoryMap.get(templateGroup.categorySlug) || allCategories[0].id;
    const baseTitle = templateGroup.titles[i % templateGroup.titles.length];
    // Add unique identifier or descriptor so full text search has variety
    const titleVariant = (i % 3 === 0) ? `${baseTitle} (Great Deal)` : (i % 3 === 1) ? `${baseTitle} - Grade A` : baseTitle;

    // Pick location corresponding to seller campus or fallback campus location
    const campusLocs = allLocations.filter(l => l.campusId === seller.campusId);
    const chosenLoc = campusLocs.length > 0 ? campusLocs[i % campusLocs.length] : allLocations[0];

    const condition = templateGroup.categorySlug === "food-drinks" || templateGroup.categorySlug === "services" 
      ? null 
      : conditions[i % conditions.length];

    // Price between ₦1,500 and ₦250,000 (stored in kobo: * 100)
    const basePriceNaira = 1500 + ((i * 179 + 450) % 248000);
    const priceKobo = basePriceNaira * 100;
    const isNegotiable = (i % 2 === 0);

    // Stagger creation dates over last 60 days
    const daysAgo = (500 - i) * 0.12;
    const createdAt = new Date(Date.now() - Math.floor(daysAgo * 86400000));
    const publishedAt = (status === "published" || status === "reserved" || status === "sold") ? createdAt : null;

    listingsToInsert.push({
      id: listId,
      sellerId: seller.id,
      categoryId,
      campusId: seller.campusId,
      locationId: chosenLoc.id,
      title: titleVariant,
      description: `Authentic ${titleVariant}. Available for pickup or delivery within ${chosenLoc.name}. Contact seller for immediate inspection and campus pickup. Guaranteed authentic student item.`,
      price: priceKobo,
      isNegotiable,
      condition,
      status,
      viewCount: (i * 7) % 350,
      createdAt,
      updatedAt: createdAt,
      publishedAt,
    });

    // Seed photo row
    const placeholderInfo = PLACEHOLDERS[templateGroup.placeholderType] || PLACEHOLDERS["electronics"];
    photosToInsert.push({
      id: `pht_seed_500_${String(i + 1).padStart(4, "0")}`,
      ownerId: seller.id,
      listingId: listId,
      key: `${placeholderInfo.displayKey}?seed=${listId}`,
      thumbKey: `${placeholderInfo.thumbKey}?seed=${listId}`,
      width: 1000,
      height: 750,
      bytes: 140000,
      position: 0,
      isSeed: true,
      createdAt,
    });
  }

  // Batch insert in chunks of 100
  console.log(`Inserting ${listingsToInsert.length} listings in chunks...`);
  const chunkSize = 100;
  for (let c = 0; c < listingsToInsert.length; c += chunkSize) {
    const listChunk = listingsToInsert.slice(c, c + chunkSize);
    const photoChunk = photosToInsert.slice(c, c + chunkSize);
    await db.insert(listing).values(listChunk);
    await db.insert(listingPhoto).values(photoChunk);
  }

  console.log(`Successfully seeded 500 listings and 500 photos (isSeed: true)!`);
}

if (require.main === module) {
  seed500Listings()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to seed 500 listings:", err);
      process.exit(1);
    });
}
