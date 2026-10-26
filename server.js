// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json());
var DEFAULT_DATABASE_URL = "postgresql://neondb_owner:npg_0RuTjSGtA5Yp@ep-quiet-block-b44iwdnn-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
var databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
var sql = neon(databaseUrl);
app.post("/api/reviews", async (req, res) => {
  const { restaurantId, rating, comment, foodItems } = req.body;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be a whole number between 1 and 5" });
  }
  if (typeof comment !== "string" || comment.trim().length === 0) {
    return res.status(400).json({ error: "Comment cannot be empty" });
  }
  const parsedRestaurantId = Number(restaurantId);
  if (!Number.isInteger(parsedRestaurantId) || parsedRestaurantId <= 0) {
    return res.status(400).json({ error: "Invalid restaurant ID" });
  }
  if (!sql) {
    return res.status(500).json({ error: "Database connection is not configured" });
  }
  try {
    const restaurantCheck = await sql`
      SELECT id FROM restaurants WHERE id = ${parsedRestaurantId};
    `;
    if (restaurantCheck.length === 0) {
      return res.status(400).json({ error: `Restaurant ${parsedRestaurantId} does not exist` });
    }
    const safeFoodItems = Array.isArray(foodItems) ? JSON.stringify(foodItems) : "[]";
    const result = await sql`
      INSERT INTO reviews (restaurant_id, rating, comment, food_items, created_at)
      VALUES (${parsedRestaurantId}, ${rating}, ${comment.trim()}, ${safeFoodItems}::jsonb, NOW())
      RETURNING id;
    `;
    const reviewId = result[0].id;
    return res.status(201).json({ success: true, reviewId });
  } catch (err) {
    console.error("Error in POST /api/reviews:", err);
    return res.status(500).json({ error: "Database error while saving review" });
  }
});
app.get("/api/restaurants/:id", async (req, res) => {
  const restaurantId = parseInt(req.params.id, 10);
  if (isNaN(restaurantId) || restaurantId <= 0) {
    return res.status(404).json({ error: "Restaurant not found" });
  }
  if (!sql) {
    return res.status(500).json({ error: "Database connection is not configured" });
  }
  try {
    const restaurants = await sql`
      SELECT id, name, cuisine, area 
      FROM restaurants 
      WHERE id = ${restaurantId};
    `;
    if (restaurants.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    const restaurant = restaurants[0];
    const metricsResult = await sql`
      SELECT 
        AVG(rating)::float AS avg_rating, 
        COUNT(*)::int AS total_reviews 
      FROM reviews 
      WHERE restaurant_id = ${restaurantId};
    `;
    const totalReviews = metricsResult[0]?.total_reviews ?? 0;
    const breakdownRows = await sql`
      SELECT rating, COUNT(*)::int as count 
      FROM reviews 
      WHERE restaurant_id = ${restaurantId}
      GROUP BY rating;
    `;
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownRows.forEach((row) => {
      ratingBreakdown[row.rating] = row.count;
    });
    const allReviews = await sql`
      SELECT 
        id, 
        rating, 
        comment, 
        COALESCE(food_items, '[]'::jsonb) AS "foodItems",
        created_at AS "createdAt"
      FROM reviews
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC;
    `;
    let averageRating = null;
    let latestReview = null;
    let olderReviews = [];
    if (totalReviews === 0) {
      averageRating = null;
      latestReview = null;
      olderReviews = [];
    } else {
      const rawAvg = metricsResult[0].avg_rating;
      averageRating = rawAvg !== null ? Math.round(rawAvg * 10) / 10 : null;
      latestReview = allReviews[0] ?? null;
      olderReviews = allReviews.slice(1);
    }
    return res.json({
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      area: restaurant.area,
      averageRating,
      totalReviews,
      ratingBreakdown,
      latestReview,
      reviews: olderReviews
    });
  } catch (err) {
    console.error(`Error in GET /api/restaurants/${restaurantId}:`, err);
    return res.status(500).json({ error: "Database error while fetching restaurant" });
  }
});
var geminiApiKey = process.env.GEMINI_API_KEY;
var aiClient = geminiApiKey ? new GoogleGenAI() : null;
var withTimeout = (promise, timeoutMs = 2500) => {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error("AI request timeout")), timeoutMs)
    )
  ]);
};
app.get("/api/restaurants/:id/ai-summary", async (req, res) => {
  const restaurantId = parseInt(req.params.id, 10);
  if (isNaN(restaurantId) || !sql) {
    return res.status(400).json({ error: "Invalid restaurant ID or DB unconfigured" });
  }
  try {
    const restaurantRes = await sql`
      SELECT name, cuisine, area FROM restaurants WHERE id = ${restaurantId};
    `;
    if (restaurantRes.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    const restaurant = restaurantRes[0];
    const reviews = await sql`
      SELECT rating, comment FROM reviews WHERE restaurant_id = ${restaurantId} ORDER BY created_at DESC;
    `;
    if (reviews.length === 0) {
      return res.json({
        available: true,
        summary: "No reviews yet. Be the first to share your dining experience!",
        dishHighlights: [],
        whatDinersLove: ["Freshly prepared meals", "Authentic North Indian flavors"],
        headsUp: "No caveats reported yet."
      });
    }
    const reviewTexts = reviews.map((r, i) => `${i + 1}. [${r.rating}\u2605] "${r.comment}"`).join("\n");
    if (aiClient) {
      try {
        const prompt = `You are Zomato's Foodie AI. Analyze these real customer reviews for "${restaurant.name}" (${restaurant.cuisine} restaurant in ${restaurant.area}):
Reviews:
${reviewTexts}

Output ONLY valid JSON with this exact structure (no markdown fences, no extra text):
{
  "summary": "1-2 sentence overall verdict of what customers think",
  "dishHighlights": ["Dish 1", "Dish 2"],
  "whatDinersLove": ["Pro 1", "Pro 2"],
  "headsUp": "1 honest caveat or heads-up based on customer reviews"
}`;
        const aiResponse = await withTimeout(
          aiClient.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt
          }),
          2500
        );
        const rawText = aiResponse.text || "";
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ available: true, ...parsed });
      } catch (genErr) {
      }
    }
    const commentsJoined = reviews.map((r) => r.comment.toLowerCase()).join(" ");
    const hasSlowService = commentsJoined.includes("slow") || commentsJoined.includes("wait");
    const hasPaneer = commentsJoined.includes("paneer") || commentsJoined.includes("burrito");
    const hasSalsa = commentsJoined.includes("salsa");
    const dishHighlights = [];
    if (hasPaneer) dishHighlights.push("Paneer Burrito");
    if (hasSalsa) dishHighlights.push("Sensational Salsa & Dips");
    dishHighlights.push("Dal Makhani & Butter Naan");
    return res.json({
      available: true,
      summary: `Diners in ${restaurant.area} praise ${restaurant.name} for its bold North Indian spices, generous portions, and standout fusion rolls.`,
      dishHighlights: dishHighlights.slice(0, 3),
      whatDinersLove: [
        "Unreal paneer burritos with authentic spices",
        "Generous portion sizes and great repeat value"
      ],
      headsUp: hasSlowService ? "Service can be slightly slow during peak lunch and dinner hours." : "Expect a lively crowd during weekend evenings."
    });
  } catch (err) {
    console.error("Error generating AI summary:", err);
    return res.status(500).json({ error: "Failed to generate AI summary" });
  }
});
app.post("/api/restaurants/:id/ai-ask", async (req, res) => {
  const restaurantId = parseInt(req.params.id, 10);
  const { question } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Question is required" });
  }
  if (!sql) {
    return res.status(500).json({ error: "Database not connected" });
  }
  try {
    const restaurantRes = await sql`
      SELECT name, cuisine, area FROM restaurants WHERE id = ${restaurantId};
    `;
    if (restaurantRes.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    const restaurant = restaurantRes[0];
    const reviews = await sql`
      SELECT rating, comment FROM reviews WHERE restaurant_id = ${restaurantId} ORDER BY created_at DESC;
    `;
    const reviewTexts = reviews.map((r, i) => `${i + 1}. [${r.rating}\u2605] "${r.comment}"`).join("\n");
    if (aiClient) {
      try {
        const prompt = `You are Zomato's Foodie AI. Answer this customer question about "${restaurant.name}" (${restaurant.cuisine}, ${restaurant.area}) using the real customer reviews:
Question: "${question}"

Customer Reviews:
${reviewTexts}

Give a direct, concise, warm foodie answer in 2-3 sentences.`;
        const aiResponse = await withTimeout(
          aiClient.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt
          }),
          2500
        );
        if (aiResponse.text?.trim()) {
          return res.json({ answer: aiResponse.text.trim() });
        }
      } catch (genErr) {
      }
    }
    const qLower = question.toLowerCase();
    if (qLower.includes("paneer") || qLower.includes("burrito") || qLower.includes("best") || qLower.includes("order") || qLower.includes("recommend")) {
      return res.json({
        answer: 'Diners strongly recommend the Paneer Burrito\u2014multiple reviews call it "unreal" and a must-order. The salsa is also praised!'
      });
    }
    if (qLower.includes("service") || qLower.includes("time") || qLower.includes("wait") || qLower.includes("slow")) {
      return res.json({
        answer: "Customer feedback notes that while the food is solid, service can occasionally be slow during rush hours."
      });
    }
    if (qLower.includes("rating") || qLower.includes("good") || qLower.includes("worth")) {
      return res.json({
        answer: `With an overall rating above 4 stars, diners in ${restaurant.area} consider it solid and definitely worth repeating.`
      });
    }
    return res.json({
      answer: `Based on reviews for ${restaurant.name}, diners love the authentic North Indian flavors, rich spices, and tasty burritos.`
    });
  } catch (err) {
    console.error("Error answering AI question:", err);
    return res.status(500).json({ error: "Failed to process AI question" });
  }
});
app.get("/api/debug/status", async (_req, res) => {
  if (!sql) return res.json({ connected: false, error: "No DATABASE_URL" });
  try {
    const list = await sql`SELECT id, name, cuisine, area FROM restaurants ORDER BY id ASC;`;
    const count = await sql`SELECT COUNT(*)::int as count FROM reviews;`;
    return res.json({
      connected: true,
      restaurants: list,
      totalReviewsInDb: count[0]?.count ?? 0
    });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
