'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  title: string
  slug: string
  cover_url: string | null
}

export default function SearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setResults(data)
        setIsOpen(data.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        router.push(`/game/${results[selectedIndex].slug}`)
        setIsOpen(false)
      } else {
        // Submit search
        router.push(`/?search=${encodeURIComponent(query)}`)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/?search=${encodeURIComponent(query)}`)
      setIsOpen(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="Search games..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-12 pr-20 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Clear Button */}
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-1.5 rounded-md transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl overflow-hidden z-50"
        >
          {results.map((result, index) => (
            <Link
              key={result.id}
              href={`/game/${result.slug}`}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors ${
                selectedIndex === index ? 'bg-gray-800' : ''
              }`}
            >
              {/* Cover Image */}
              <div className="w-12 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                {result.cover_url ? (
                  <img
                    src={result.cover_url}
                    alt={result.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                    No Cover
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{result.title}</div>
              </div>

              {/* Arrow */}
              <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}

          {/* View All Results */}
          <button
            onClick={() => {
              router.push(`/?search=${encodeURIComponent(query)}`)
              setIsOpen(false)
            }}
            className="w-full px-4 py-3 text-center text-sm text-purple-400 hover:bg-gray-800 border-t border-gray-800 transition-colors"
          >
            View all results for "{query}"
          </button>
        </div>
      )}
    </div>
  )
}