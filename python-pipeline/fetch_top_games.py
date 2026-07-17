import httpx
import psycopg2
import os
import json
from dotenv import load_dotenv
from groq import Groq
import time

load_dotenv()

CLIENT_ID = os.getenv("IGDB_CLIENT_ID")
CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET")
DATABASE_URL = os.getenv("DATABASE_URL").split('?')[0]
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# IGDB website category mapping
IGDB_SITE_CATEGORIES = {
    1: ("Steam", "store"),
    2: ("GOG", "store"),
    5: ("Epic Games", "store"),
    6: ("Official Website", "official"),
    13: ("IGDB", "wiki"),
    17: ("Xbox", "store"),
    18: ("PlayStation", "store"),
    21: ("Nintendo", "store"),
}

def get_igdb_token():
    url = "https://id.twitch.tv/oauth2/token"
    params = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    response = httpx.post(url, data=params)
    if response.status_code != 200:
        print(f"Error: {response.text}")
        exit()
    return response.json()["access_token"]

def fetch_top_games(token, limit=20):
    """Fetch top-rated games from IGDB"""
    url = "https://api.igdb.com/v4/games"
    headers = {
        "Client-ID": CLIENT_ID,
        "Authorization": f"Bearer {token}"
    }
    query = f'''
        fields id, name, summary, cover.url, platforms.name, websites.url, websites.category, total_rating;
        where total_rating != null & version_parent = null;
        sort total_rating desc;
        limit {limit};
    '''
    response = httpx.post(url, headers=headers, data=query)
    return response.json()

def save_game_to_database(game):
    """Save a single game and its data to the database"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # 1. Insert Platforms
    platform_ids = []
    for platform_obj in game.get('platforms', []):
        platform_name = platform_obj.get('name')
        if not platform_name:
            continue
        cur.execute("SELECT id FROM platforms WHERE name = %s", (platform_name,))
        result = cur.fetchone()
        if result:
            platform_ids.append(result[0])
        else:
            slug = platform_name.lower().replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '')
            cur.execute("""
                INSERT INTO platforms (name, slug) 
                VALUES (%s, %s) RETURNING id
            """, (platform_name, slug))
            platform_ids.append(cur.fetchone()[0])

    # 2. Insert Game
    cover_url = None
    if game.get('cover'):
        cover_url = f"https:{game['cover'].get('url', '')}".replace('t_thumb', 't_cover_big')
    
    slug = game['name'].lower().replace(' ', '-').replace(':', '').replace('(', '').replace(')', '')
    
    cur.execute("""
        INSERT INTO games (igdb_id, title, slug, summary, cover_url)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (igdb_id) DO NOTHING RETURNING id
    """, (game['id'], game['name'], slug, game.get('summary', ''), cover_url))
    
    game_id = cur.fetchone()
    if game_id:
        game_id = game_id[0]
        
        # 3. Link Game to Platforms
        for p_id in platform_ids:
            cur.execute("""
                INSERT INTO game_platforms (game_id, platform_id)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (game_id, p_id))
        
        # 4. Insert External Links
        for website in game.get('websites', []):
            category = website.get('category')
            url = website.get('url')
            
            if category in IGDB_SITE_CATEGORIES and url:
                site_name, site_type = IGDB_SITE_CATEGORIES[category]
                cur.execute("""
                    INSERT INTO game_external_links (game_id, site_name, site_type, url)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (game_id, site_name) DO NOTHING
                """, (game_id, site_name, site_type, url))
        
        conn.commit()
        cur.close()
        conn.close()
        return game_id
    else:
        cur.close()
        conn.close()
        return None

def fetch_steam_reviews(steam_app_id):
    """Fetch reviews from Steam"""
    url = f"https://store.steampowered.com/appreviews/{steam_app_id}?json=1&num_per_page=15&language=english"
    try:
        response = httpx.get(url, timeout=10)
        data = response.json()
        if data.get('success'):
            return data.get('reviews', [])
    except:
        pass
    return []

def save_reviews_to_database(game_id, reviews, source_name="Steam"):
    """Save reviews to database"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Get or create source
    cur.execute("SELECT id FROM sources WHERE name = %s", (source_name,))
    source_result = cur.fetchone()
    if source_result:
        source_id = source_result[0]
    else:
        cur.execute("INSERT INTO sources (name, type) VALUES (%s, 'user') RETURNING id", (source_name,))
        source_id = cur.fetchone()[0]

    review_count = 0
    for review in reviews:
        author = review.get('author', {})
        playtime = review.get('author_playtime_forever', 0) / 60
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

    conn.commit()
    cur.close()
    conn.close()
    return review_count

def generate_ai_summary(reviews_text, game_title):
    """Generate AI summary using Groq"""
    if not GROQ_API_KEY:
        return None
    
    client = Groq(api_key=GROQ_API_KEY)
    
    prompt = f"""You are a game review analyst. Analyze these Steam reviews for {game_title} and provide:

1. TLDR (1-2 sentences)
2. Top 3 pros
3. Top 3 cons
4. Category scores (0-10) for: gameplay, narrative, audio_visual, technical, monetization
5. Playtime segments for Casual (0-10h), Mid-Game (10-50h), Veteran (50+h)

Format as JSON:
{{
  "tldr": "string",
  "pros": ["string", "string", "string"],
  "cons": ["string", "string", "string"],
  "categories": [
    {{"category": "gameplay", "score": 8.5, "summary_text": "string"}},
    {{"category": "narrative", "score": 9.0, "summary_text": "string"}},
    {{"category": "audio_visual", "score": 8.0, "summary_text": "string"}},
    {{"category": "technical", "score": 7.5, "summary_text": "string"}},
    {{"category": "monetization", "score": 10.0, "summary_text": "string"}}
  ],
  "playtime_segments": [
    {{"segment_name": "Casual", "min_hours": 0, "max_hours": 10, "tldr": "string", "avg_score": 8.0}},
    {{"segment_name": "Mid-Game", "min_hours": 10, "max_hours": 50, "tldr": "string", "avg_score": 8.5}},
    {{"segment_name": "Veteran", "min_hours": 50, "max_hours": 500, "tldr": "string", "avg_score": 9.0}}
  ]
}}

Reviews:
{reviews_text}

Respond ONLY with valid JSON."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a game review analyst. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        result = completion.choices[0].message.content
        return json.loads(result)
    except Exception as e:
        print(f"Error: {e}")
        return None

def save_ai_summary(game_id, ai_data):
    """Save AI summary to database"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
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
    
    for cat in ai_data['categories']:
        cur.execute("""
            INSERT INTO category_scores (summary_id, category, score, summary_text)
            VALUES (%s, %s, %s, %s)
        """, (summary_id, cat['category'], cat['score'], cat['summary_text']))
    
    for seg in ai_data['playtime_segments']:
        cur.execute("""
            INSERT INTO playtime_segments (summary_id, min_hours, max_hours, segment_name, tldr, avg_score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (summary_id, seg['min_hours'], seg['max_hours'], seg['segment_name'], seg['tldr'], seg['avg_score']))
    
    conn.commit()
    cur.close()
    conn.close()

# Mapping of popular game names to Steam App IDs
STEAM_APP_IDS = {
    "The Witcher 3: Wild Hunt": "292030",
    "Red Dead Redemption 2": "1174180",
    "Grand Theft Auto V": "271590",
    "Elden Ring": "1245620",
    "Baldur's Gate 3": "1086940",
    "God of War": "1593500",
    "Horizon Zero Dawn": "1151640",
    "Death Stranding": "1190460",
    "Hades": "1145360",
    "Hollow Knight": "367520",
    "Celeste": "504230",
    "Stardew Valley": "413150",
    "Terraria": "105600",
    "Deep Rock Galactic": "548430",
    "Valheim": "892970",
    "Subnautica": "264710",
    "Doom Eternal": "782330",
    "Resident Evil Village": "1196590",
    "It Takes Two": "1426210",
    "Sekiro: Shadows Die Twice": "814380",
}

if __name__ == "__main__":
    print("Starting Top Games Fetch...")
    token = get_igdb_token()
    
    print("Fetching top 20 games from IGDB...")
    games = fetch_top_games(token, limit=20)
    
    print(f"Found {len(games)} games")
    
    for i, game in enumerate(games, 1):
        print(f"\n[{i}/{len(games)}] Processing: {game['name']}")
        
        # Save game data
        game_id = save_game_to_database(game)
        if not game_id:
            print("  Game already exists, skipping...")
            continue
        
        print(f"  Saved game (ID: {game_id})")
        
        # Fetch Steam reviews if we have the App ID
        steam_app_id = STEAM_APP_IDS.get(game['name'])
        if steam_app_id:
            print(f"  Fetching Steam reviews (App ID: {steam_app_id})...")
            reviews = fetch_steam_reviews(steam_app_id)
            if reviews:
                review_count = save_reviews_to_database(game_id, reviews)
                print(f"  Saved {review_count} reviews")
                
                # Generate AI summary
                if GROQ_API_KEY and review_count > 0:
                    print("  Generating AI summary...")
                    reviews_text = "\n\n".join([
                        f"Review {j+1} ({r.get('author', {}).get('author_playtime_forever', 0) // 60}h played):\n{r.get('review', '')}"
                        for j, r in enumerate(reviews[:10])
                    ])
                    ai_data = generate_ai_summary(reviews_text, game['name'])
                    if ai_data:
                        save_ai_summary(game_id, ai_data)
                        print("  AI summary saved")
            else:
                print("  No Steam reviews found")
        else:
            print("  No Steam App ID mapping, skipping reviews")
        
        # Small delay to avoid rate limiting
        time.sleep(1)
    
    print("\nDone! All games processed.")