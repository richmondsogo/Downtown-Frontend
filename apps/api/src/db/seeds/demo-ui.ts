import { db } from "../index";
import { user, listing, listingPhoto } from "../schema";
import { eq } from "drizzle-orm";
import { auth } from "../../services/auth.service";

async function createOrUpdateUser(email: string, sellerStatus: "verified" | "not_a_seller") {
  let [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!existing) {
    const signUpReq = new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        name: email.startsWith("nonseller") ? "Tunde Student" : "Richmond Seller",
        email,
        password: "DemoPassword123!",
        role: "student",
        matricNumber: email.startsWith("nonseller") ? "2024/11223" : "2024/99887",
      }),
    });
    await auth.handler(signUpReq);
    [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  }

  if (existing) {
    await db.update(user).set({
      sellerStatus,
      accountStatus: "active",
      emailVerified: true,
    }).where(eq(user.id, existing.id));
  }
  return existing;
}

async function main() {
  console.log("Seeding demo UI users...");
  const nonSeller = await createOrUpdateUser("nonseller_demo@example.com", "not_a_seller");
  const sellerDemo = await createOrUpdateUser("seller_demo@example.com", "verified");
  const sellerEmpty = await createOrUpdateUser("seller_empty@example.com", "verified");

  if (!sellerDemo) throw new Error("Failed to create seller_demo");

  // Clear existing listings for sellerDemo
  await db.delete(listingPhoto).where(eq(listingPhoto.ownerId, sellerDemo.id));
  await db.delete(listing).where(eq(listing.sellerId, sellerDemo.id));

  // Clear listings for sellerEmpty
  if (sellerEmpty) {
    await db.delete(listing).where(eq(listing.sellerId, sellerEmpty.id));
  }

  // Insert sample photo
  const photoId = "pht_demo_laptop_01";
  await db.insert(listingPhoto).values({
    id: photoId,
    ownerId: sellerDemo.id,
    listingId: null,
    key: "listings/demo/laptop/display.webp",
    thumbKey: "listings/demo/laptop/thumb.webp",
    width: 1000,
    height: 750,
    bytes: 45000,
    position: 0,
  });

  // 1. Published listing
  const pubId = `lst_demo_laptop_${Date.now()}`;
  const [pub] = await db.insert(listing).values({
    id: pubId,
    sellerId: sellerDemo.id,
    title: "HP EliteBook 840 G5 (16GB RAM, 256GB SSD)",
    description: "Neat UK-used laptop in great condition, tested battery for campus lectures.",
    price: 185000,
    isNegotiable: true,
    categoryId: "cat_electronics",
    condition: "good",
    locationId: "loc_campus_osogbo",
    status: "published",
    quantityAvailable: 1,
    quantityReserved: 0,
  }).returning();

  await db.update(listingPhoto).set({ listingId: pub.id }).where(eq(listingPhoto.id, photoId));

  // 2. Pending moderation listing
  const modId = `lst_demo_calc_${Date.now()}`;
  await db.insert(listing).values({
    id: modId,
    sellerId: sellerDemo.id,
    title: "Casio fx-991EX ClassWiz Scientific Calculator",
    description: "Original natural textbook display calculator for engineering maths.",
    price: 12000,
    isNegotiable: false,
    categoryId: "cat_electronics",
    condition: "like_new",
    locationId: "loc_campus_osogbo",
    status: "pending_moderation",
    quantityAvailable: 1,
    quantityReserved: 0,
  });

  // 3. Draft listing
  const draftId = `lst_demo_draft_${Date.now()}`;
  const [draft] = await db.insert(listing).values({
    id: draftId,
    sellerId: sellerDemo.id,
    title: "Calculus 101 Lecture Notes & Past Questions",
    description: "Full semester MTH 101 spiral bound notes with solved exam questions.",
    price: 1500,
    isNegotiable: false,
    categoryId: "cat_books_study_materials",
    condition: "good",
    locationId: "loc_campus_osogbo",
    status: "draft",
    quantityAvailable: 2,
    quantityReserved: 0,
  }).returning();

  console.log("Demo seed finished successfully! Published ID:", pub.id, "Draft ID:", draft.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
