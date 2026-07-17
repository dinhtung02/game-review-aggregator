import httpx
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("IGDB_CLIENT_ID")
CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET")
DATABASE_URL = os.getenv("DATABASE_URL").split('?')[0]

# IGDB website category mapping
# Source: https://api-docs.igdb.com/#game-website
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
        print("❌ Failed to get token:", response.text)
        exit()
    return response.json()["access_token"]

def fetch_game_data(token, game_name):
    url = "https://api.igdb.com/v4/games"
    headers = {
        "Client-ID": CLIENT_ID,
        "Authorization": f"Bearer {token}"
    }
    # Added 'websites' field to get external links
    query = f'''
        fields id, name, summary, cover.url, platforms.name, websites.url, websites.category; 
        where name = "{game_name}";
    '''
    response = httpx.post(url, headers=headers, data=query)
    return response.json()

def save_to_database(game_data):
    if not game_data:
        print("No game data found!")
        return

    game = game_data[0]
    print(f"Found game: {game['name']}")

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
            print(f"  -> Added platform: {platform_name}")

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
        print(f"  -> Added new game!")
        
        # 3. Link Game to Platforms
        for p_id in platform_ids:
            cur.execute("""
                INSERT INTO game_platforms (game_id, platform_id)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (game_id, p_id))
        
        # 4. ✨ NEW: Insert External Links from IGDB
        links_added = 0
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
                links_added += 1
                print(f"  -> Added link: {site_name}")
        
        print(f"  -> Total external links added: {links_added}")
        conn.commit()
        print("✅ Successfully saved to Supabase!")
    else:
        print("⚠️ Game already exists.")

    cur.close()
    conn.close()

def seed_review_site_urls(game_name):
    """Manually add review site URLs for known games (since IGDB doesn't have them)"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get game ID
    cur.execute("SELECT id FROM games WHERE title ILIKE %s", (f"%{game_name}%",))
    result = cur.fetchone()
    if not result:
        print(f"❌ Game '{game_name}' not found. Run fetch_games.py first!")
        return
    game_id = result[0]
    
    # Review site URLs for Cyberpunk 2077 (you can add more games here)
    review_sites = {
        "Cyberpunk 2077": [
            ("Metacritic", "review_site", "https://www.metacritic.com/game/cyberpunk-2077/", 86.0),
            ("OpenCritic", "review_site", "https://opencritic.com/game/7530/cyberpunk-2077", 86.0),
            ("IGN", "review_site", "https://www.ign.com/games/cyberpunk-2077", 90.0),
            ("GameSpot", "review_site", "https://www.gamespot.com/games/cyberpunk-2077/", 90.0),
        ]
    }
    
    if game_name in review_sites:
        for site_name, site_type, url, score in review_sites[game_name]:
            cur.execute("""
                INSERT INTO game_external_links (game_id, site_name, site_type, url, score)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (game_id, site_name) DO UPDATE SET url = EXCLUDED.url, score = EXCLUDED.score
            """, (game_id, site_name, site_type, url, score))
            print(f"  -> Seeded review site: {site_name}")
        
        conn.commit()
        print("✅ Review site URLs seeded!")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    print("Starting Data Pipeline...")
    token = get_igdb_token()
    data = fetch_game_data(token, "Cyberpunk 2077")
    save_to_database(data)
    
    # Seed review site URLs (since IGDB doesn't provide them)
    print("\n🔗 Seeding review site URLs...")
    seed_review_site_urls("Cyberpunk 2077")