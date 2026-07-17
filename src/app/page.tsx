import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SearchBar from '@/components/SearchBar'

// This component will be a Server Component, but we'll add a Client Component for interactivity
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const searchQuery = typeof params.search === 'string' ? params.search : ''
  const platformFilter = typeof params.platform === 'string' ? params.platform : ''
  const sortBy = typeof params.sort === 'string' ? params.sort : 'created_at'

  // Fetch all games with their platforms and reviews
  const allGames = await prisma.games.findMany({
    include: {
      game_platforms: {
        include: {
          platforms: true
        }
      },
      reviews: {
        where: { status: 'active' },
        select: { normalized_score: true, playtime_hours: true }
      }
    },
    orderBy: { created_at: 'desc' }
  })

  // Calculate master score for each game
  const gamesWithScores = allGames.map(game => {
    let masterScore = 0
    if (game.reviews.length > 0) {
      let totalWeightedScore = 0
      let totalWeight = 0

      for (const review of game.reviews) {
        const score = Number(review.normalized_score) || 0
        const hours = Number(review.playtime_hours) || 10
        const weight = Math.min(hours, 100)
        
        totalWeightedScore += score * weight
        totalWeight += weight
      }

      masterScore = Math.round(totalWeightedScore / totalWeight)
    }

    return {
      ...game,
      masterScore,
      reviewCount: game.reviews.length
    }
  })

  // Get all unique platforms for filter buttons
  const allPlatforms = Array.from(
    new Set(gamesWithScores.flatMap(g => g.game_platforms.map(gp => gp.platforms.name)))
  ).sort()

  // Apply filters
  let filteredGames = gamesWithScores

  // Search filter
  if (searchQuery) {
    filteredGames = filteredGames.filter(game =>
      game.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  // Platform filter
  if (platformFilter) {
    filteredGames = filteredGames.filter(game =>
      game.game_platforms.some(gp => gp.platforms.name === platformFilter)
    )
  }

  // Sort
  if (sortBy === 'score') {
    filteredGames = filteredGames.sort((a, b) => b.masterScore - a.masterScore)
  } else if (sortBy === 'title') {
    filteredGames = filteredGames.sort((a, b) => a.title.localeCompare(b.title))
  } else if (sortBy === 'reviews') {
    filteredGames = filteredGames.sort((a, b) => b.reviewCount - a.reviewCount)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* ================= HERO SECTION ================= */}
      <div className="relative bg-gradient-to-b from-purple-900/20 to-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4">
            Game Review Aggregator
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Discover games with AI-powered analysis, playtime-weighted scores, and real community reviews.
          </p>
          
          {/* Stats */}
          <div className="flex justify-center gap-8 text-sm">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{allGames.length}</div>
              <div className="text-gray-500">Games</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {gamesWithScores.reduce((sum, g) => sum + g.reviewCount, 0)}
              </div>
              <div className="text-gray-500">Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {allPlatforms.length}
              </div>
              <div className="text-gray-500">Platforms</div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <SearchBar initialQuery={searchQuery} />
          </div>

          {/* Platform Filters */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !platformFilter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              All Platforms
            </Link>
            {allPlatforms.map(platform => (
              <Link
                key={platform}
                href={`/?platform=${encodeURIComponent(platform)}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  platformFilter === platform
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {platform}
              </Link>
            ))}
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Sort by:</span>
            <div className="flex gap-2">
              <Link
                href={`/?${new URLSearchParams({ search: searchQuery, platform: platformFilter, sort: 'created_at' }).toString()}`}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  sortBy === 'created_at'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Newest
              </Link>
              <Link
                href={`/?${new URLSearchParams({ search: searchQuery, platform: platformFilter, sort: 'score' }).toString()}`}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  sortBy === 'score'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Highest Score
              </Link>
              <Link
                href={`/?${new URLSearchParams({ search: searchQuery, platform: platformFilter, sort: 'title' }).toString()}`}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  sortBy === 'title'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Title A-Z
              </Link>
              <Link
                href={`/?${new URLSearchParams({ search: searchQuery, platform: platformFilter, sort: 'reviews' }).toString()}`}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  sortBy === 'reviews'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                Most Reviews
              </Link>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">
            {searchQuery ? `Results for "${searchQuery}"` : 'All Games'}
          </h2>
          <div className="text-sm text-gray-500">
            Showing {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Games Grid */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGames.map((game) => {
              const platforms = game.game_platforms.map(gp => gp.platforms.name)
              const scoreColor = game.masterScore >= 80 ? 'text-green-400' : 
                                game.masterScore >= 60 ? 'text-yellow-400' : 
                                game.masterScore > 0 ? 'text-red-400' : 'text-gray-500'
              
              return (
                <Link 
                  key={game.id} 
                  href={`/game/${game.slug}`}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10"
                >
                  {/* Cover Image */}
                  <div className="aspect-[3/4] bg-gray-800 relative overflow-hidden">
                    {game.cover_url ? (
                      <img 
                        src={game.cover_url} 
                        alt={game.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        No Cover
                      </div>
                    )}
                    
                    {/* Score Badge */}
                    {game.masterScore > 0 && (
                      <div className="absolute top-3 right-3 bg-gray-950/90 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2">
                        <div className={`text-2xl font-bold ${scoreColor}`}>
                          {game.masterScore}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Game Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors line-clamp-2">
                      {game.title}
                    </h3>
                    
                    {/* Platforms */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {platforms.slice(0, 3).map((platform, idx) => (
                        <span 
                          key={idx}
                          className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded"
                        >
                          {platform}
                        </span>
                      ))}
                      {platforms.length > 3 && (
                        <span className="text-xs text-gray-500">+{platforms.length - 3}</span>
                      )}
                    </div>

                    {/* Summary Preview */}
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {game.summary || 'No description available.'}
                    </p>

                    {/* Review Count */}
                    <div className="text-xs text-gray-600">
                      {game.reviewCount} review{game.reviewCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Games Found</h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search or filters.
            </p>
            <Link
              href="/"
              className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors"
            >
              Clear Filters
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}