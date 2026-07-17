import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <span className="text-xl font-bold text-white">GameReview</span>
            </div>
            <p className="text-sm text-gray-400">
              AI-powered game reviews with playtime-weighted scores and real community insights.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                  All Games
                </Link>
              </li>
              <li>
                <Link href="/?sort=score" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Top Rated
                </Link>
              </li>
              <li>
                <Link href="/?sort=created_at" className="text-sm text-gray-400 hover:text-white transition-colors">
                  New Releases
                </Link>
              </li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-white font-semibold mb-3">About</h3>
            <ul className="space-y-2">
              <li className="text-sm text-gray-400">
                Data sourced from IGDB, Steam, and community reviews
              </li>
              <li className="text-sm text-gray-400">
                AI analysis powered by Groq
              </li>
              <li className="text-sm text-gray-400">
                Built with Next.js and Supabase
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">
            © 2026 GameReview. All game data and trademarks belong to their respective owners.
          </p>
        </div>
      </div>
    </footer>
  )
}