import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-sm bg-opacity-95">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <span className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
              GameReview
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/" 
              className="text-gray-300 hover:text-white font-medium transition-colors"
            >
              Home
            </Link>
            <Link 
              href="/?sort=score" 
              className="text-gray-300 hover:text-white font-medium transition-colors"
            >
              Top Rated
            </Link>
            <Link 
              href="/?sort=created_at" 
              className="text-gray-300 hover:text-white font-medium transition-colors"
            >
              New Releases
            </Link>
          </div>

          {/* Mobile Menu Button (placeholder for now) */}
          <button className="md:hidden text-gray-300 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}