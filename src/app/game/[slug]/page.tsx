import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const game = await prisma.games.findUnique({
    where: { slug: slug },
    include: {
      game_platforms: { include: { platforms: true } },
      ai_summaries: {
        orderBy: { generated_at: 'desc' },
        take: 1,
        include: {
          category_scores: true,
          playtime_segments: true,
        }
      },
      hardware_performance: true,
      game_external_links: true,
      reviews: {
        where: { status: 'active' },
        orderBy: { helpful_count: 'desc' },
        take: 3,
      }
    }
  })

  if (!game) notFound()

  // ==========================================
  // DYNAMIC MASTER SCORE CALCULATION
  // ==========================================
  const allActiveReviews = await prisma.reviews.findMany({
    where: { game_id: game.id, status: 'active' },
    select: { normalized_score: true, playtime_hours: true }
  })

  let masterScore = 86 // Fallback score if no reviews exist yet
  if (allActiveReviews.length > 0) {
    let totalWeightedScore = 0
    let totalWeight = 0

    for (const review of allActiveReviews) {
      // Cap playtime weight at 100 hours so one super-fan doesn't skew the score
      const score = Number(review.normalized_score) || 0 
      const hours = Number(review.playtime_hours) || 10 
      const weight = Math.min(hours, 100)
      totalWeightedScore += score * weight
      totalWeight += weight
    }

    masterScore = Math.round(totalWeightedScore / totalWeight)
  }

  // Determine color based on score (Green >= 80, Yellow >= 60, Red < 60)
  const scoreColor = masterScore >= 80 ? 'text-green-400' : masterScore >= 60 ? 'text-yellow-400' : 'text-red-400'
  // ==========================================

  const aiSummary = game.ai_summaries[0]

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* ================= HERO SECTION ================= */}
      <div className="relative bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-8">
          
          {/* Cover Art */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="aspect-[3/4] bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
              {game.cover_url ? (
                <img src={game.cover_url} alt={game.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">No Cover</div>
              )}
            </div>
          </div>

          {/* Game Info */}
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">{game.title}</h1>
            
            {/* Developer & Publisher Links */}
            <div className="flex flex-wrap items-center gap-2 text-gray-400 mb-6 text-sm">
              <span>Developed by</span>
              <a href="https://www.cdprojektred.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors">
                {game.developer || 'CD Projekt Red'}
              </a>
              <span>•</span>
              <span>Published by</span>
              <span className="text-gray-300">{game.publisher || 'CD Projekt'}</span>
              <span>•</span>
              <span>Released {game.release_date ? new Date(game.release_date).getFullYear() : 'TBA'}</span>
            </div>

            {/* Score & Platforms */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-4 shadow-lg">
                <div className="text-center">
                  {/* DYNAMIC SCORE WITH COLOR CODING */}
                  <div className={`text-3xl font-bold ${scoreColor}`}>
                    {masterScore}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Master Score</div>
                </div>
                <div className="h-10 w-px bg-gray-700"></div>
                <div className="text-sm text-gray-400">
                  <div>Weighted by playtime</div>
                  <div>{allActiveReviews.length} active reviews</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {game.game_platforms.map((gp) => (
                  <span key={gp.platform_id} className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-sm font-medium border border-gray-700">
                    {gp.platforms.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Content Summary */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Game Content Summary</h3>
              <p className="text-gray-300 leading-relaxed">
                {game.summary || "In a dystopian future, you play as a mercenary outlaw seeking a one-of-a-kind implant that is the key to immortality. Features deep branching dialogue and highly praised combat systems."}
              </p>
            </div>
          </div>
        </div>
      </div>
 
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ================= MAIN CONTENT (Left 2/3) ================= */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Breakdown */}
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-purple-400">✨</span> AI Analysis & Breakdown
            </h2>

            {aiSummary ? (
              <>
                <div className="space-y-4 mb-8">
                  {aiSummary.category_scores.map((cat) => {
                    const scoreNum = Number(cat.score); // Converts the Decimal to a standard number
                    return (
                      <div key={cat.id}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-gray-300 capitalize">{cat.category}</span>
                          <span className="text-sm font-bold text-white">{scoreNum}/10</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2.5">
                          <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${(scoreNum / 10) * 100}%` }}></div>
                        </div>
                        {cat.summary_text && <p className="text-xs text-gray-500 mt-1">{cat.summary_text}</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {aiSummary.playtime_segments.map((segment) => {
                    const minH = Number(segment.min_hours);
                    const maxH = Number(segment.max_hours);
                    const avgScore = Number(segment.avg_score);
                    
                    return (
                      <div key={segment.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                        <div className="text-xs text-purple-400 font-bold uppercase mb-2">
                          {segment.segment_name} ({minH}-{maxH}h)
                        </div>
                        <p className="text-sm text-gray-300 italic">"{segment.tldr}"</p>
                        <div className="mt-3 text-xs text-gray-500">
                          Avg Score: <span className="text-white font-bold">{avgScore}/10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-950 rounded-xl border border-dashed border-gray-800">
                <p>AI Summary is being generated.</p>
              </div>
            )}
          </section>

          {/* User Reviews Feed with Explanation */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Top Community Reviews</h2>
            
            {/* EXPLANATION BOX (Updated to match the new algorithm) */}
            <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mb-6">
              <span className="text-blue-400 text-xl">💡</span>
              <div>
                <h4 className="text-sm font-bold text-blue-300">How is the Master Score calculated?</h4>
                <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                  We calculate a <span className="text-white font-semibold">playtime-weighted average</span> of all active user reviews. This means reviews from players with more hours carry more weight, and review bombs are automatically filtered out to give you the most accurate picture.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {game.reviews.length > 0 ? game.reviews.map((review) => (
                <div key={review.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-white">{review.author_name || 'Anonymous'}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {review.playtime_hours ? `${review.playtime_hours.toFixed(1)} hours played` : 'Playtime unknown'} • {review.is_verified_purchase ? '✅ Verified' : 'Unverified'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400 font-bold">
                      {(review.normalized_score / 10).toFixed(1)}/10
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">{review.body || "No text provided."}</p>
                  <div className="text-xs text-gray-500 flex items-center gap-4">
                    <span>👍 {review.helpful_count} found this helpful</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                  <p>No reviews fetched yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ================= SIDEBAR (Right 1/3) ================= */}
        <div className="space-y-6">
  
          {/* Where to Buy - DYNAMIC from database */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Where to Buy</h3>
            <div className="space-y-3">
              {game.game_external_links
                .filter(link => link.site_type === 'store')
                .map((link) => (
                  <a 
                    key={link.id}
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-gray-800 hover:border-blue-500 transition-colors group"
                  >
                    <span className="font-medium text-gray-300 group-hover:text-white">{link.site_name}</span>
                    <span className="bg-blue-600 text-white text-sm font-bold py-2 px-4 rounded group-hover:bg-blue-500 transition-colors">
                      Visit →
                    </span>
                  </a>
                ))}
              
              {/* Fallback if no store links in database */}
              {game.game_external_links.filter(link => link.site_type === 'store').length === 0 && (
                <p className="text-sm text-gray-500">Store links coming soon.</p>
              )}
            </div>
          </div>

          {/* Famous Review Sites - DYNAMIC from database */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Famous Review Sites</h3>
            <div className="space-y-3">
              {game.game_external_links
                .filter(link => link.site_type === 'review_site')
                .map((link) => (
                  <a 
                    key={link.id}
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex justify-between items-center p-3 bg-gray-950 rounded-lg border border-gray-800 hover:border-green-500 transition-colors"
                  >
                    <span className="font-medium text-gray-300">{link.site_name}</span>
                    {link.score ? (
                      <span className="bg-green-600 text-white text-xs font-bold py-1 px-2 rounded">
                        {Number(link.score)}/100
                      </span>
                    ) : (
                      <span className="bg-gray-700 text-white text-xs font-bold py-1 px-2 rounded">
                        View →
                      </span>
                    )}
                  </a>
                ))}
              
              {/* Fallback if no review sites in database */}
              {game.game_external_links.filter(link => link.site_type === 'review_site').length === 0 && (
                <p className="text-sm text-gray-500">Review site links coming soon.</p>
              )}
            </div>
          </div>

          {/* Hardware Check - unchanged */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">⚙️ Hardware Check</h3>
            {game.hardware_performance && game.hardware_performance.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-green-400 font-bold uppercase mb-2">✅ Runs Great On</div>
                  <ul className="space-y-2">
                    {game.hardware_performance.filter(h => h.performance_tier === 'runs_great').map(h => (
                      <li key={h.id} className="text-sm text-gray-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>{h.hardware_spec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Hardware data coming soon.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}