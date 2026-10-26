import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is missing in environment variables.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function setup() {
  console.log('--- Setting up Neon PostgreSQL Database for Zomato Lite ---');

  // Step 1: Create Tables
  console.log('1. Creating tables: "restaurants" and "reviews"...');
  await sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      cuisine   TEXT NOT NULL,
      area      TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id            SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment       TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  console.log('✓ Tables created successfully.');

  // Step 2: Seed restaurant if not exists
  console.log('2. Seeding initial restaurant: "Indian Cuisine"...');
  const existingRestaurants = await sql`
    SELECT * FROM restaurants WHERE id = 1;
  `;

  let restaurantId = 1;
  if (existingRestaurants.length === 0) {
    const inserted = await sql`
      INSERT INTO restaurants (id, name, cuisine, area)
      VALUES (1, 'Indian Cuisine', 'Indian', 'Karol Bagh, New Delhi 110005')
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;
    console.log('✓ Inserted restaurant:', inserted[0] || 'Indian Cuisine (id: 1)');
  } else {
    // Keep name and area updated
    await sql`UPDATE restaurants SET name = 'Indian Cuisine', area = 'Karol Bagh, New Delhi 110005' WHERE id = 1;`;
    console.log('✓ Restaurant id 1 updated to Indian Cuisine in Karol Bagh, New Delhi 110005');
  }

  // Step 3: Seed initial reviews if none exist for restaurant 1
  const existingReviews = await sql`
    SELECT COUNT(*)::int as count FROM reviews WHERE restaurant_id = 1;
  `;

  if (existingReviews[0].count === 0) {
    console.log('3. Seeding 3 initial reviews with past timestamps...');
    await sql`
      INSERT INTO reviews (restaurant_id, rating, comment, created_at)
      VALUES 
        (1, 5, 'Paneer burrito is unreal', NOW() - INTERVAL '8 days'),
        (1, 4, 'Good, but slow service', NOW() - INTERVAL '6 days'),
        (1, 4, 'Solid. Would repeat.', NOW() - INTERVAL '2 days');
    `;
    console.log('✓ Seeded 3 reviews.');
  } else {
    console.log(`✓ Existing reviews count: ${existingReviews[0].count}`);
  }

  // Step 4: Show rows created
  console.log('\n--- Current Database State ---');
  const allRestaurants = await sql`SELECT * FROM restaurants;`;
  console.log('Restaurants Table:');
  console.table(allRestaurants);

  const allReviews = await sql`SELECT id, restaurant_id, rating, comment, created_at FROM reviews WHERE restaurant_id = 1 ORDER BY created_at DESC;`;
  console.log('\nReviews Table (for Restaurant 1):');
  console.table(allReviews);

  console.log('\nNOTE FOR PM:');
  console.log('Notice what is NOT in these tables:');
  console.log('- NO average_rating column');
  console.log('- NO latest_review column');
  console.log('Because they are not facts. They are computed answers!');
  console.log('----------------------------------------------------');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
