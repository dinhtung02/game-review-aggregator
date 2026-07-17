import httpx
import psycopg2
import os
import json
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL").split('?')[0]

# Cyberpunk 2077 Steam App ID
STEAM_APP_ID = "1091500"

def fetch_steam_reviews():
    """Fetches recent reviews from Steam."""
    print("🔍 Fetching reviews from Steam...")
    url = f"https://store.steampowered.com/appreviews/{STEAM_APP_ID}?json=1&num_per_page=15&language=english"
    response = httpx.get(url)
    data = response.json()
    
    if not data.get('success'):
        print("❌ Failed to fetch Steam reviews.")
        return []
    
    return data.get('reviews', [])

def generate_mock_ai_summary(reviews):
    """Generates a realistic AI summary. 
    (Swap this with OpenAI API later for real dynamic generation!)"""
    print("🤖 Generating AI Summary...")
    
    # This mimics the exact JSON structure your Next.js UI expects
    return {
        "tldr": "A visually stunning RPG with tight combat and an incredible redemption arc, though the open-world exploration can still feel a bit empty.",
        "pros": ["Incredible storytelling and characters", "Massively improved performance since 2.0", "No predatory microtransactions"],
        "cons": ["Police AI still has minor quirks", "Endgame content is somewhat limited"],
        "categories": [
            {"category": "gameplay", "score": 9.2, "summary_text": "Tight combat, deep skill trees, and great hacking mechanics."},
            {"category": "narrative", "score": 9.5, "summary_text": "Best-in-class writing. Johnny Silverhand's arc is phenomenal."},
            {"category": "audio_visual", "score": 9.0, "summary_text": "Stunning art direction and an iconic, atmospheric soundtrack."},
            {"category": "technical", "score": 7.5, "summary_text": "Runs great on modern hardware, but still has minor bugs."},
            {"category": "monetization", "score": 10.0, "summary_text": "Zero microtransactions. You get what you pay for."}
        ],
        "playtime_segments": [
            {"segment_name": "Casual", "min_hours": 0, "max_hours": 10, "tldr": "The opening hours are incredible. Night City feels alive and the story hooks you immediately.", "avg_score": 8.2},
            {"segment_name": "Mid-Game", "min_hours": 10, "max_hours": 50, "tldr": "The side quests are better than most games' main stories. The 2.0 update fixed most performance issues.", "avg_score": 9.1},
            {"segment_name": "Veteran", "min_hours": 50, "max_hours": 500, "tldr": "After 100+ hours, I can say this is a masterpiece now. Build variety is excellent.", "avg_score": 8.8}
        ]
    }

def save_to_database(reviews, ai_data):
    """Inserts reviews and AI data into Supabase."""
    print("💾 Saving to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # 1. Get the Game ID for Cyberpunk 2077
    cur.execute("SELECT id FROM games WHERE igdb_id = 1091500 OR title ILIKE '%cyberpunk 2077%' LIMIT 1")
    game_result = cur.fetchone()
    if not game_result:
        print("❌ Game not found in database. Run fetch_games.py first!")
        return
    game_id = game_result[0]

    # 2. Get or Create Source ID for "Steam"
    cur.execute("SELECT id FROM sources WHERE name = 'Steam'")
    source_result = cur.fetchone()
    if source_result:
        source_id = source_result[0]
    else:
        cur.execute("INSERT INTO sources (name, type) VALUES ('Steam', 'user') RETURNING id")
        source_id = cur.fetchone()[0]

    # 3. Insert Reviews
    review_count = 0
    for review in reviews:
        author = review.get('author', {})
        playtime = review.get('author_playtime_forever', 0) / 60  # Convert minutes to hours
        
        # Normalize Steam's True/False recommendation to a 0-100 score
        score = 90.0 if review.get('voted_up') else 30.0
        
        cur.execute("""
            INSERT INTO reviews (
                game_id, source_id, author_name, author_avatar_url, 
                normalized_score, body, playtime_hours, is_verified_purchase, 
                helpful_count, status, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s))
            ON CONFLICT DO NOTHING
        """, (
            game_id, source_id, author.get('steamid', 'Anonymous'), author.get('avatar_full', ''),
            score, review.get('review', ''), playtime, True,
            review.get('votes_up', 0), 'active', review.get('timestamp_created')
        ))
        review_count += 1

    print(f"  -> Inserted {review_count} Steam reviews.")

    # 4. Insert AI Summary
    cur.execute("""
        INSERT INTO ai_summaries (game_id, tldr, pros, cons, raw_llm_output)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (
        game_id, 
        ai_data['tldr'], 
        ai_data['pros'], 
        ai_data['cons'], 
        json.dumps(ai_data)
    ))
    summary_id = cur.fetchone()[0]
    print("  -> Inserted AI Summary.")

    # 5. Insert Category Scores
    for cat in ai_data['categories']:
        cur.execute("""
            INSERT INTO category_scores (summary_id, category, score, summary_text)
            VALUES (%s, %s, %s, %s)
        """, (summary_id, cat['category'], cat['score'], cat['summary_text']))
    
    # 6. Insert Playtime Segments
    for seg in ai_data['playtime_segments']:
        cur.execute("""
            INSERT INTO playtime_segments (summary_id, min_hours, max_hours, segment_name, tldr, avg_score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (summary_id, seg['min_hours'], seg['max_hours'], seg['segment_name'], seg['tldr'], seg['avg_score']))

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Successfully saved Reviews and AI Data to Supabase!")

if __name__ == "__main__":
    print("🚀 Starting Review & AI Pipeline...")
    steam_reviews = fetch_steam_reviews()
    if steam_reviews:
        ai_summary = generate_mock_ai_summary(steam_reviews)
        save_to_database(steam_reviews, ai_summary)
    else:
        print("❌ Pipeline stopped: No reviews fetched.")