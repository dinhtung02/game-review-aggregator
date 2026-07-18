import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic' // This prevents static generation during build

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json([])
    }

    const games = await prisma.games.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        title: true,
        slug: true,
        cover_url: true
      },
      take: 5
    })

    return NextResponse.json(games)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json([], { status: 500 })
  }
}