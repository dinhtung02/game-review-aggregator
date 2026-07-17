import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
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
}