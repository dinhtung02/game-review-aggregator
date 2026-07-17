import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">🎮</div>
        <h1 className="text-4xl font-bold text-white mb-4">Game Over</h1>
        <p className="text-xl text-gray-400 mb-8">
          This page doesn't exist. Maybe it was a bug in the matrix?
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/?sort=score"
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-lg transition-colors border border-gray-700"
          >
            Browse Top Games
          </Link>
        </div>
      </div>
    </main>
  )
}