import psycopg2
import os
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL").split('?')[0]

def generate_ai_summary(reviews_text, game_title):
    """Uses Groq to generate AI summary from reviews"""
    client = Groq(api_key=GROQ_API_KEY)
    
    prompt = f"""You are a game review analyst. Analyze these Steam reviews for {game_title} and provide:

1. TLDR (1-2 sentences summarizing overall sentiment)
2. Top 3 pros (short bullet points)
3. Top 3 cons (short bullet points)
4. Category scores (0-10) for: gameplay, narrative, audio_visual, technical, monetization
5. Playtime segments: What do players think at different stages?
   - Casual (0-10 hours)
   - Mid-Game (10-50 hours)
   - Veteran (50+ hours)

Format your response as valid JSON like this:
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

Respond ONLY with valid JSON, no markdown or explanations."""

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
        print(f"[ERROR] Groq API error: {e}")
        return None

def get_reviews_for_game(game_id):
    """Fetch all active reviews for a game"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT body, playtime_hours, normalized_score 
        FROM reviews 
        WHERE game_id = %s AND status = 'active'
    """, (game_id,))
    
    reviews = cur.fetchall()
    cur.close()
    conn.close()
    
    return reviews

def save_ai_summary(game_id, ai_data):
    """Save AI summary to database"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Insert main summary
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
    
    # Insert category scores
    for cat in ai_data['categories']:
        cur.execute("""
            INSERT INTO category_scores (summary_id, category, score, summary_text)
            VALUES (%s, %s, %s, %s)
        """, (summary_id, cat['category'], cat['score'], cat['summary_text']))
    
    # Insert playtime segments
    for seg in ai_data['playtime_segments']:
        cur.execute("""
            INSERT INTO playtime_segments (summary_id, min_hours, max_hours, segment_name, tldr, avg_score)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (summary_id, seg['min_hours'], seg['max_hours'], seg['segment_name'], seg['tldr'], seg['avg_score']))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return summary_id

def process_game(game_title):
    """Main function to process a game"""
    print(f"[INFO] Processing: {game_title}")
    
    # Get game ID
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT id FROM games WHERE title ILIKE %s", (f"%{game_title}%",))
    result = cur.fetchone()
    
    if not result:
        print(f"[ERROR] Game '{game_title}' not found!")
        return
    
    game_id = result[0]
    cur.close()
    conn.close()
    
    # Fetch reviews
    reviews = get_reviews_for_game(game_id)
    if not reviews:
        print("[ERROR] No reviews found for this game!")
        return
    
    print(f"[INFO] Found {len(reviews)} reviews")
    
    # Combine reviews into text
    reviews_text = "\n\n".join([
        f"Review {i+1} ({hours}h played, score: {score}/100):\n{body}"
        for i, (body, hours, score) in enumerate(reviews)
    ])
    
    # Generate AI summary
    print("[INFO] Generating AI summary with Groq...")
    ai_data = generate_ai_summary(reviews_text, game_title)
    
    if not ai_data:
        print("[ERROR] Failed to generate AI summary!")
        return
    
    # Save to database
    print("[INFO] Saving to database...")
    summary_id = save_ai_summary(game_id, ai_data)
    
    print(f"[SUCCESS] Successfully saved AI summary (ID: {summary_id})!")

if __name__ == "__main__":
    print("[START] Starting AI Summary Generation...")
    process_game("Cyberpunk 2077")